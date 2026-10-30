import { getStore } from "@/lib/dynamodb";
import { GameError } from "@/lib/game-engine/errors";
import { withGameLock } from "@/lib/game-engine/lock";
import { generateGamePin, newId } from "@/lib/ids";
import { publish } from "@/lib/realtime/publisher";
import type { GameSession, Player } from "@/types/game";
import type {
  CorrectGuess,
  DrawingPoint,
  GuessLogEntry,
  GuessResult,
  RoundDuration,
  ScribbleAdminView,
  ScribblePlayerView,
  ScribbleRound,
  ScribbleRoundRecord,
  ScribbleScoreEntry,
  ScribbleStatus,
} from "@/types/scribble";
import {
  buildHint,
  calculateDrawerPoints,
  calculateGuessPoints,
  chooseRevealIndices,
  containsWord,
  isCloseGuess,
  isExactMatch,
  revealCountFor,
  wordLetterCount,
} from "./scoring";
import { buildArchive, saveArchive } from "./archive";
import { pickWordChoices } from "./words";

/**
 * Scribble round engine.
 *
 * Players, the PIN, the lobby and the QR join flow are reused wholesale from the
 * quiz `DataStore` — a Scribble game is just a `GameSession` with
 * `gameMode: "SCRIBBLE"`. Only the round state is Scribble-specific, and for this
 * prototype it lives in memory behind `runtime()`, which is the single place to
 * change when it needs to be persisted.
 *
 * The secret word is held here and never placed in any payload bound for the
 * projector or a non-drawer while a round is live.
 */

const DEFAULT_ROUNDS = 8;
const DEFAULT_DURATION: RoundDuration = 60;
/** Roulette animation on the projector before the drawer is confirmed. */
const ANNOUNCE_MS = 3_500;
/** How long the drawer gets to pick from three words. */
const WORD_SELECT_MS = 10_000;
/** 3 - 2 - 1 - DRAW! */
const COUNTDOWN_MS = 3_500;

interface ScribbleRuntime {
  gameId: string;
  status: ScribbleStatus;
  roundNumber: number;
  totalRounds: number;
  durationSeconds: RoundDuration;
  round: ScribbleRound | null;
  previousDrawers: string[];
  usedWords: string[];
  pausedFrom?: ScribbleStatus;
  /** ms already spent paused during the current round. */
  pausedAccumulatedMs: number;
  pausedAt?: number;
  /** The current round is a scoreless warm-up. */
  practice: boolean;
  /** Every finished round, for the saved record. */
  history: ScribbleRoundRecord[];
}

const cache = globalThis as unknown as {
  __scribbleRuntimes?: Map<string, ScribbleRuntime>;
  __scribbleTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __scribbleHintTimers?: Map<string, ReturnType<typeof setTimeout>[]>;
};

function runtimes(): Map<string, ScribbleRuntime> {
  cache.__scribbleRuntimes ??= new Map();
  return cache.__scribbleRuntimes;
}

function timers(): Map<string, ReturnType<typeof setTimeout>> {
  cache.__scribbleTimers ??= new Map();
  return cache.__scribbleTimers;
}

function hintTimers(): Map<string, ReturnType<typeof setTimeout>[]> {
  cache.__scribbleHintTimers ??= new Map();
  return cache.__scribbleHintTimers;
}

function clearPhaseTimer(gameId: string): void {
  const existing = timers().get(gameId);
  if (existing) clearTimeout(existing);
  timers().delete(gameId);
}

/** Cancels every pending transition and hint for the game. */
function clearTimer(gameId: string): void {
  clearPhaseTimer(gameId);
  for (const timer of hintTimers().get(gameId) ?? []) clearTimeout(timer);
  hintTimers().delete(gameId);
}

/**
 * Single pending transition per game — a new one always replaces the old.
 *
 * The step runs inside the game lock so it can't interleave with a guess or a
 * host command. If a command replaced or cleared this timer while the step was
 * queued behind the lock, the step is stale and does nothing.
 */
function scheduleTimer(gameId: string, delayMs: number, task: () => Promise<void>): void {
  clearPhaseTimer(gameId);
  const timer = setTimeout(() => {
    void withGameLock(gameId, async () => {
      if (timers().get(gameId) !== timer) return;
      timers().delete(gameId);
      await task();
    }).catch((error) => console.error("[scribble] scheduled step failed", error));
  }, Math.max(0, delayMs));
  timer.unref?.();
  timers().set(gameId, timer);
}

function runtime(gameId: string): ScribbleRuntime {
  const map = runtimes();
  let state = map.get(gameId);
  if (!state) {
    state = {
      gameId,
      status: "LOBBY",
      roundNumber: 0,
      totalRounds: DEFAULT_ROUNDS,
      durationSeconds: DEFAULT_DURATION,
      round: null,
      previousDrawers: [],
      usedWords: [],
      pausedAccumulatedMs: 0,
      practice: false,
      history: [],
    };
    map.set(gameId, state);
  }
  return state;
}

const store = () => getStore();

async function loadGame(gameId: string): Promise<GameSession> {
  const game = await store().getGame(gameId);
  if (!game) throw new GameError("GAME_NOT_FOUND");
  return game;
}

async function authenticate(gameId: string, playerId: string, token: string): Promise<Player> {
  const player = await store().getPlayer(gameId, playerId);
  if (!player) throw new GameError("PLAYER_NOT_FOUND");
  if (player.token !== token) throw new GameError("INVALID_TOKEN");
  if (player.kicked) throw new GameError("PLAYER_KICKED");
  return player;
}

/** Deadline including any time the game spent paused mid-round. */
function deadline(state: ScribbleRuntime): number {
  return (state.round?.endsAt ?? 0) + state.pausedAccumulatedMs;
}

/** Once a round is over, naming who drew it gives nothing away. */
function roundIsOver(status: ScribbleStatus): boolean {
  return status === "ROUND_END" || status === "LEADERBOARD" || status === "FINISHED";
}

/**
 * The last two rounds play blind: no leaderboard and no ranks on phones, so the
 * final podium is a genuine surprise. Short games (under three rounds) are exempt.
 */
function standingsHidden(state: ScribbleRuntime): boolean {
  return (
    state.status !== "FINISHED" &&
    state.totalRounds >= 3 &&
    state.roundNumber >= state.totalRounds - 1
  );
}

/** Upper bound on guesses kept per round, so a spammer can't bloat the save file. */
const MAX_GUESS_LOG = 5_000;

/** Writes the whole game to disk. Never awaited by callers' critical path and never throws. */
async function persist(gameId: string): Promise<void> {
  try {
    const state = runtime(gameId);
    const game = await store().getGame(gameId);
    if (!game) return;
    const players = await store().listPlayers(gameId);
    void saveArchive(
      buildArchive({
        game,
        status: state.status,
        totalRounds: state.totalRounds,
        durationSeconds: state.durationSeconds,
        players,
        leaderboard: buildLeaderboard(players, state),
        rounds: state.history,
      }),
    );
  } catch (error) {
    console.error("[scribble] could not snapshot game for saving", error);
  }
}

function logGuess(
  state: ScribbleRuntime,
  entry: Omit<GuessLogEntry, "atMs">,
): void {
  const round = state.round;
  if (!round) return;
  round.guessLog ??= [];
  if (round.guessLog.length >= MAX_GUESS_LOG) return;
  const atMs = Math.max(0, Date.now() - (round.startedAt ?? Date.now()) - state.pausedAccumulatedMs);
  round.guessLog.push({ ...entry, atMs });
}

/** Minimum gap between one player's guesses, so a held Enter key can't flood the room feed. */
const GUESS_COOLDOWN_MS = 350;

/** Kicked players keep their row (so their token resolves cleanly) but are out of the game. */
function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.kicked);
}

/**
 * Who the round is waiting on: everyone still in the game except the drawer.
 * Offline players are left out so one locked phone can't stop "everyone got it"
 * from ending the round — unless they already scored, which always counts.
 */
function countGuessers(players: Player[], round: ScribbleRound | null): number {
  if (!round) return activePlayers(players).length;
  const solved = new Set(round.correctGuesses.map((g) => g.playerId));
  return activePlayers(players).filter(
    (p) => p.playerId !== round.drawerId && (p.connected || solved.has(p.playerId)),
  ).length;
}

/* --------------------------------------------------------------- Game setup */

export async function createScribbleGame(hostId: string): Promise<GameSession> {
  let gamePin = generateGamePin();
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await store().getGameByPin(gamePin);
    if (!existing || existing.status === "FINISHED") break;
    gamePin = generateGamePin();
  }

  const game: GameSession = {
    gameId: newId("scrb"),
    gamePin,
    // Scribble draws from a word bank rather than a quiz.
    quizId: "",
    hostId,
    gameMode: "SCRIBBLE",
    status: "LOBBY",
    currentQuestionIndex: -1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store().putGame(game);
  runtime(game.gameId);
  return game;
}

/*
 * Joining is deliberately NOT reimplemented here. A Scribble game keeps its
 * `GameSession.status` at LOBBY for its whole life, so the existing
 * `joinGame` / `/api/play/join` path works unchanged — and late arrivals can
 * still join mid-game, which suits Scribble better than it does the quiz.
 */

/* ------------------------------------------------------------------- Views */

function buildLeaderboard(players: Player[], state: ScribbleRuntime): ScribbleScoreEntry[] {
  const drawnCounts = new Map<string, number>();
  for (const id of state.previousDrawers) {
    drawnCounts.set(id, (drawnCounts.get(id) ?? 0) + 1);
  }

  return activePlayers(players)
    .sort((a, b) => b.score - a.score || a.joinedAt.localeCompare(b.joinedAt))
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.playerId,
      nickname: player.nickname,
      score: player.score,
      roundsDrawn: drawnCounts.get(player.playerId) ?? 0,
      correctGuesses: player.correctCount,
    }));
}

/** Hint mask for right now, derived from elapsed time. Deterministic per word. */
function currentHint(state: ScribbleRuntime): string | null {
  const round = state.round;
  if (!round) return null;
  if (state.status === "WORD_SELECT" || state.status === "COUNTDOWN") {
    return buildHint(round.word, []);
  }
  return buildHint(round.word, round.revealedIndices);
}

/**
 * The drawer is secret while a round is being set up or played — otherwise
 * people could walk over and read the word off their screen. The host can ask
 * for it explicitly (`revealDrawer`) to check someone is actually drawing.
 */
export async function getAdminView(
  gameId: string,
  revealDrawer = false,
): Promise<ScribbleAdminView> {
  const game = await loadGame(gameId);
  const state = await reconcileForView(gameId);
  const players = await store().listPlayers(gameId);
  const round = state.round;

  const revealed = state.status === "ROUND_END" || state.status === "LEADERBOARD" || state.status === "FINISHED";
  const guesserCount = countGuessers(players, round);

  return {
    gameId,
    gamePin: game.gamePin,
    status: state.status,
    roundNumber: state.roundNumber,
    totalRounds: state.totalRounds,
    durationSeconds: state.durationSeconds,
    players: activePlayers(players).map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      connected: p.connected,
      score: p.score,
    })),
    drawer:
      round && (revealDrawer || roundIsOver(state.status))
        ? { playerId: round.drawerId, nickname: round.drawerName }
        : null,
    wordHint: round ? currentHint(state) : null,
    wordLength: round ? wordLetterCount(round.word) : null,
    // The projector only ever learns the word after the round is over.
    revealedWord: revealed && round ? round.word : null,
    startedAt: round?.startedAt,
    endsAt: round?.endsAt ? deadline(state) : undefined,
    strokes: round?.strokes ?? [],
    correctGuesses: round?.correctGuesses ?? [],
    correctCount: round?.correctGuesses.length ?? 0,
    guesserCount,
    drawerPoints: round?.drawerPoints ?? 0,
    leaderboard: buildLeaderboard(players, state),
    standingsHidden: standingsHidden(state),
    practice: state.practice,
    previousDrawers: state.previousDrawers,
    serverTime: Date.now(),
  };
}

/**
 * `includeStrokes` is off by default: phase refreshes from 50 phones would
 * otherwise each pull the whole drawing. Clients ask for it on (re)connect only.
 */
export async function getPlayerView(
  gameId: string,
  playerId?: string,
  includeStrokes = false,
): Promise<ScribblePlayerView> {
  const state = await reconcileForView(gameId);
  const players = await store().listPlayers(gameId);
  const round = state.round;
  const isDrawer = Boolean(round && playerId && round.drawerId === playerId);

  const revealed =
    state.status === "ROUND_END" || state.status === "LEADERBOARD" || state.status === "FINISHED";
  // Standings are withheld server-side during the blind rounds, not just hidden in the UI.
  const hidden = standingsHidden(state);
  const leaderboard = hidden ? [] : buildLeaderboard(players, state);
  const me = leaderboard.find((entry) => entry.playerId === playerId);
  const myScore = activePlayers(players).find((p) => p.playerId === playerId)?.score ?? 0;

  return {
    gameId,
    status: state.status,
    roundNumber: state.roundNumber,
    totalRounds: state.totalRounds,
    isDrawer,
    // Only the drawer themselves learns who's drawing until the round is over.
    drawer:
      round && (isDrawer || roundIsOver(state.status))
        ? { playerId: round.drawerId, nickname: round.drawerName }
        : null,
    // The word travels to exactly one browser in the room.
    word: isDrawer && round ? round.word : revealed && round ? round.word : null,
    wordChoices: isDrawer && state.status === "WORD_SELECT" && round ? round.wordChoices : null,
    wordHint: round ? currentHint(state) : null,
    wordLength: round ? wordLetterCount(round.word) : null,
    revealedWord: revealed && round ? round.word : null,
    startedAt: round?.startedAt,
    endsAt: round?.endsAt ? deadline(state) : undefined,
    strokes: includeStrokes ? (round?.strokes ?? []) : undefined,
    correctCount: round?.correctGuesses.length ?? 0,
    guesserCount: countGuessers(players, round),
    myGuess: round?.correctGuesses.find((g) => g.playerId === playerId) ?? null,
    myRank: me?.rank ?? null,
    myScore,
    leaderboard,
    standingsHidden: hidden,
    practice: state.practice,
    serverTime: Date.now(),
  };
}

/** Closes a round whose timer expired while nothing was actively running. Caller holds the lock. */
async function reconcile(gameId: string): Promise<ScribbleRuntime> {
  const state = runtime(gameId);
  if (state.status !== "DRAWING" || !state.round?.endsAt) return state;
  if (Date.now() < deadline(state)) {
    applyHintProgress(state);
    return state;
  }
  await endRoundInternal(gameId, "TIMER");
  return runtime(gameId);
}

/** Read paths don't hold the lock; they only take it when there's a round to close. */
async function reconcileForView(gameId: string): Promise<ScribbleRuntime> {
  const state = runtime(gameId);
  if (state.status === "DRAWING" && state.round?.endsAt && Date.now() >= deadline(state)) {
    return withGameLock(gameId, () => reconcile(gameId));
  }
  if (state.status === "DRAWING") applyHintProgress(state);
  return state;
}

/** Advances the hint mask in place based on how much drawing time has elapsed. */
function applyHintProgress(state: ScribbleRuntime): void {
  const round = state.round;
  if (!round?.startedAt || !round.endsAt) return;

  // Paused time doesn't count towards the hint schedule.
  const total = Math.max(1, round.endsAt - round.startedAt);
  const elapsed = (Date.now() - round.startedAt - state.pausedAccumulatedMs) / total;
  const target = revealCountFor(elapsed, round.word);

  if (target > round.revealedIndices.length) {
    round.revealedIndices = chooseRevealIndices(round.word, target);
  }
}

/* ---------------------------------------------------------------- Drawing */

export async function appendStroke(
  gameId: string,
  playerId: string,
  token: string,
  stroke: { id: string; color: string; width: number; erase?: boolean; points: DrawingPoint[] },
): Promise<void> {
  await authenticate(gameId, playerId, token);
  const state = runtime(gameId);
  const round = state.round;

  // Only the current drawer can put marks on the canvas.
  if (!round || round.drawerId !== playerId) throw new GameError("UNAUTHORISED");
  if (state.status !== "DRAWING") throw new GameError("QUESTION_NOT_ACTIVE", "The round isn't live.");
  if (stroke.points.length === 0) return;

  const existing = round.strokes.find((s) => s.id === stroke.id);
  if (existing) {
    existing.points.push(...stroke.points);
  } else {
    round.strokes.push({
      id: stroke.id,
      color: stroke.color,
      width: stroke.width,
      erase: stroke.erase,
      points: [...stroke.points],
    });
  }

  // Deltas only — receivers append by stroke id.
  await publish({
    type: "DRAW_STROKE",
    gameId,
    strokeId: stroke.id,
    color: stroke.color,
    width: stroke.width,
    erase: stroke.erase,
    points: stroke.points,
  });
}

export async function clearCanvas(
  gameId: string,
  playerId: string,
  token: string,
): Promise<void> {
  await authenticate(gameId, playerId, token);
  const state = runtime(gameId);
  if (!state.round || state.round.drawerId !== playerId) throw new GameError("UNAUTHORISED");

  state.round.strokes = [];
  await publish({ type: "CLEAR_CANVAS", gameId });
}

export async function undoStroke(
  gameId: string,
  playerId: string,
  token: string,
  strokeId: string,
): Promise<void> {
  await authenticate(gameId, playerId, token);
  const state = runtime(gameId);
  if (!state.round || state.round.drawerId !== playerId) throw new GameError("UNAUTHORISED");

  state.round.strokes = state.round.strokes.filter((stroke) => stroke.id !== strokeId);
  await publish({ type: "UNDO_STROKE", gameId, strokeId });
}

/* ---------------------------------------------------------------- Guessing */

export async function submitGuess(
  gameId: string,
  playerId: string,
  token: string,
  guess: string,
): Promise<GuessResult> {
  return withGameLock(gameId, async () => {
    const player = await authenticate(gameId, playerId, token);
    const state = await reconcile(gameId);
    const round = state.round;

    if (!round || state.status !== "DRAWING") {
      throw new GameError("QUESTION_NOT_ACTIVE", "There's no round accepting guesses.");
    }
    if (round.drawerId === playerId) {
      throw new GameError("UNAUTHORISED", "The drawer can't guess their own word.");
    }
    if (round.correctGuesses.some((g) => g.playerId === playerId)) {
      throw new GameError("ANSWER_ALREADY_SUBMITTED", "You've already got this one.");
    }

    const now = Date.now();
    const lastGuess = round.lastGuessAt?.[playerId] ?? 0;
    if (now - lastGuess < GUESS_COOLDOWN_MS) {
      throw new GameError("VALIDATION_FAILED", "Slow down a little!");
    }
    round.lastGuessAt = { ...round.lastGuessAt, [playerId]: now };

    if (!isExactMatch(guess, round.word)) {
      // Near-misses get encouragement without hinting at which letter is wrong.
      // They stay private: shown to the room, a near-miss would give the word away.
      if (isCloseGuess(guess, round.word) || containsWord(guess, round.word)) {
        logGuess(state, { playerId, nickname: player.nickname, guess, outcome: "CLOSE" });
        return { outcome: "CLOSE" } satisfies GuessResult;
      }

      logGuess(state, { playerId, nickname: player.nickname, guess, outcome: "WRONG" });

      await publish({
        type: "GUESS_WRONG",
        gameId,
        playerId,
        playerName: player.nickname,
        guess: guess.trim().slice(0, 40),
      });
      return { outcome: "WRONG" } satisfies GuessResult;
    }

    const startedAt = round.startedAt ?? Date.now();
    const responseTimeMs = Math.max(
      0,
      Math.min(
        round.durationSeconds * 1000,
        Date.now() - startedAt - state.pausedAccumulatedMs,
      ),
    );
    const points = calculateGuessPoints(responseTimeMs, round.durationSeconds * 1000);

    const entry: CorrectGuess = {
      playerId,
      nickname: player.nickname,
      responseTimeMs,
      points,
      order: round.correctGuesses.length + 1,
    };
    round.correctGuesses.push(entry);
    logGuess(state, { playerId, nickname: player.nickname, guess, outcome: "CORRECT", points });

    // Practice rounds show the points but never bank them.
    if (!state.practice) {
      await store().putPlayer({
        ...player,
        score: player.score + points,
        correctCount: player.correctCount + 1,
        lastSeenAt: new Date().toISOString(),
      });
    }

    const players = await store().listPlayers(gameId);
    const guesserCount = countGuessers(players, round);

    // The feed says who, never what — players still guessing learn nothing.
    await publish({
      type: "GUESS_CORRECT",
      gameId,
      playerId,
      playerName: player.nickname,
      correctCount: round.correctGuesses.length,
      guesserCount,
      order: entry.order,
    });

    const rank = standingsHidden(state)
      ? undefined
      : buildLeaderboard(players, state).find((e) => e.playerId === playerId)?.rank;

    // Nothing left to guess — don't make the room watch an empty timer.
    if (guesserCount > 0 && round.correctGuesses.length >= guesserCount) {
      await endRoundInternal(gameId, "ALL_GUESSED");
    }

    return {
      outcome: "CORRECT",
      points,
      word: round.word,
      rank,
      correctCount: round.correctGuesses.length,
      guesserCount,
    } satisfies GuessResult;
  });
}

/* ------------------------------------------------------------ Round control */

function pickDrawer(players: Player[], state: ScribbleRuntime, exclude?: string): Player | null {
  const inGame = activePlayers(players).filter((p) => p.playerId !== exclude);
  // Never hand the pen to someone whose phone has gone offline, unless nobody's online.
  const online = inGame.filter((p) => p.connected);
  const eligible = online.length > 0 ? online : inGame;
  if (eligible.length === 0) return null;

  // Everyone draws once before anyone draws twice.
  const unused = eligible.filter((p) => !state.previousDrawers.includes(p.playerId));
  const pool = unused.length > 0 ? unused : eligible;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

async function announceDrawer(
  gameId: string,
  options: { exclude?: string; drawerId?: string } = {},
): Promise<void> {
  const state = runtime(gameId);
  const players = await store().listPlayers(gameId);
  const drawer = options.drawerId
    ? activePlayers(players).find((p) => p.playerId === options.drawerId)
    : pickDrawer(players, state, options.exclude);

  if (!drawer) {
    if (options.drawerId) throw new GameError("PLAYER_NOT_FOUND");
    throw new GameError("VALIDATION_FAILED", "Nobody is available to draw.");
  }

  // Reset the pool once everyone has had a turn.
  if (state.previousDrawers.length >= activePlayers(players).length) state.previousDrawers = [];

  clearTimer(gameId);
  const choices = pickWordChoices(state.usedWords);
  state.status = "DRAWER_ANNOUNCE";
  state.pausedAccumulatedMs = 0;
  state.round = {
    roundNumber: state.roundNumber,
    drawerId: drawer.playerId,
    drawerName: drawer.nickname,
    word: choices[0]?.word ?? "Laptop",
    wordChoices: choices.map((c) => c.word),
    category: choices[0]?.category ?? "Random",
    durationSeconds: state.durationSeconds,
    strokes: [],
    correctGuesses: [],
    drawerPoints: 0,
    revealedIndices: [],
  };

  // Broadcast to every screen, so it says *that* a drawer was picked, never who.
  // The drawer finds out by refetching their own view.
  await publish({
    type: "DRAWER_CHOSEN",
    gameId,
    roundNumber: state.roundNumber,
  });

  scheduleTimer(gameId, ANNOUNCE_MS, async () => {
    await enterWordSelect(gameId);
  });
}

async function enterWordSelect(gameId: string): Promise<void> {
  const state = runtime(gameId);
  if (!state.round || state.status !== "DRAWER_ANNOUNCE") return;

  state.status = "WORD_SELECT";
  await publish({
    type: "WORD_SELECTED",
    gameId,
    wordLength: wordLetterCount(state.round.word),
    wordHint: buildHint(state.round.word, []),
  });

  // No pick in time means the first option stands.
  scheduleTimer(gameId, WORD_SELECT_MS, async () => {
    if (runtime(gameId).status === "WORD_SELECT") await beginCountdown(gameId);
  });
}

export async function selectWord(
  gameId: string,
  playerId: string,
  token: string,
  word: string,
): Promise<void> {
  return withGameLock(gameId, async () => {
    await authenticate(gameId, playerId, token);
    const state = runtime(gameId);
    const round = state.round;

    if (!round || round.drawerId !== playerId) throw new GameError("UNAUTHORISED");
    if (state.status !== "WORD_SELECT") throw new GameError("INVALID_TRANSITION");
    if (!round.wordChoices.includes(word)) throw new GameError("INVALID_ANSWER");

    round.word = word;
    await beginCountdown(gameId);
  });
}

async function beginCountdown(gameId: string): Promise<void> {
  const state = runtime(gameId);
  if (!state.round || state.status !== "WORD_SELECT") return;

  state.status = "COUNTDOWN";
  state.usedWords.push(state.round.word);

  await publish({
    type: "WORD_SELECTED",
    gameId,
    wordLength: wordLetterCount(state.round.word),
    wordHint: buildHint(state.round.word, []),
  });

  scheduleTimer(gameId, COUNTDOWN_MS, async () => {
    await beginDrawing(gameId);
  });
}

async function beginDrawing(gameId: string): Promise<void> {
  const state = runtime(gameId);
  const round = state.round;
  if (!round || state.status !== "COUNTDOWN") return;

  const startedAt = Date.now();
  state.status = "DRAWING";
  state.pausedAccumulatedMs = 0;
  round.startedAt = startedAt;
  round.endsAt = startedAt + round.durationSeconds * 1000;
  round.revealedIndices = [];

  await publish({
    type: "ROUND_STARTED",
    gameId,
    roundNumber: state.roundNumber,
    startedAt,
    endsAt: round.endsAt,
    wordHint: buildHint(round.word, []),
    wordLength: wordLetterCount(round.word),
  });

  scheduleHints(gameId);
}

/**
 * Schedules the end of the round plus the hint reveals at the halfway and
 * three-quarter marks. Safe to call again on resume: everything is measured
 * against the pause-adjusted deadline, and reveals already passed are skipped.
 */
function scheduleHints(gameId: string): void {
  const state = runtime(gameId);
  const round = state.round;
  if (!round?.startedAt || !round.endsAt) return;

  const total = round.endsAt - round.startedAt;
  const end = deadline(state);

  scheduleTimer(gameId, end - Date.now(), async () => {
    if (runtime(gameId).status === "DRAWING") await endRoundInternal(gameId, "TIMER");
  });

  for (const timer of hintTimers().get(gameId) ?? []) clearTimeout(timer);
  const pending: ReturnType<typeof setTimeout>[] = [];

  for (const fraction of [0.5, 0.75]) {
    const fireAt = end - total * (1 - fraction);
    if (fireAt <= Date.now()) continue;

    const timer = setTimeout(() => {
      void withGameLock(gameId, async () => {
        const current = runtime(gameId);
        if (current.status !== "DRAWING" || current.round !== round) return;
        applyHintProgress(current);
        await publish({
          type: "HINT_UPDATED",
          gameId,
          wordHint: buildHint(round.word, round.revealedIndices),
        });
      }).catch(() => undefined);
    }, fireAt - Date.now());
    timer.unref?.();
    pending.push(timer);
  }

  hintTimers().set(gameId, pending);
}

async function endRoundInternal(
  gameId: string,
  reason: "TIMER" | "HOST" | "ALL_GUESSED",
): Promise<void> {
  const state = runtime(gameId);
  const round = state.round;
  if (!round || state.status !== "DRAWING") return;

  clearTimer(gameId);
  state.status = "ROUND_END";
  round.endedAt = Date.now();

  const players = await store().listPlayers(gameId);
  const guesserCount = countGuessers(players, round);
  round.drawerPoints = calculateDrawerPoints(
    round.correctGuesses.map((g) => g.points),
    guesserCount,
  );

  // A practice drawer neither scores nor uses up their turn.
  if (!state.practice) {
    const drawer = players.find((p) => p.playerId === round.drawerId);
    if (drawer) {
      await store().putPlayer({ ...drawer, score: drawer.score + round.drawerPoints });
    }
    if (!state.previousDrawers.includes(round.drawerId)) {
      state.previousDrawers.push(round.drawerId);
    }
  }

  state.history.push({
    roundNumber: round.roundNumber,
    practice: state.practice,
    drawerId: round.drawerId,
    drawerName: round.drawerName,
    word: round.word,
    category: round.category,
    wordChoices: round.wordChoices,
    durationSeconds: round.durationSeconds,
    startedAt: round.startedAt,
    endedAt: round.endedAt,
    endReason: reason,
    correctGuesses: [...round.correctGuesses],
    drawerPoints: round.drawerPoints,
    guesses: [...(round.guessLog ?? [])],
    strokes: round.strokes.map((s) => ({ ...s, points: [...s.points] })),
  });
  void persist(gameId);

  await publish({
    type: "ROUND_ENDED",
    gameId,
    word: round.word,
    correctGuesses: round.correctGuesses,
    drawerPoints: round.drawerPoints,
    reason,
  });
}

/* --------------------------------------------------------- Host commands */

export type ScribbleCommand =
  | { type: "START_GAME" }
  | { type: "SHOW_TUTORIAL" }
  | { type: "BACK_TO_LOBBY" }
  | { type: "START_PRACTICE" }
  | { type: "END_ROUND" }
  | { type: "NEXT_ROUND" }
  | { type: "SHOW_LEADERBOARD" }
  | { type: "PASS_DRAWER" }
  | { type: "CHOOSE_DRAWER"; playerId: string }
  | { type: "SET_DURATION"; durationSeconds: RoundDuration }
  | { type: "SET_TOTAL_ROUNDS"; totalRounds: number }
  | { type: "PAUSE_GAME" }
  | { type: "RESUME_GAME" }
  | { type: "END_GAME" };

export async function executeScribbleCommand(
  gameId: string,
  command: ScribbleCommand,
): Promise<void> {
  return withGameLock(gameId, async () => {
    const state = await reconcile(gameId);
    const { status } = state;

    // Every command is checked against the current phase, so a double-click or
    // two host tabs can't skip a round or restart a running game.
    if (status === "FINISHED" && command.type !== "END_GAME") {
      throw new GameError("GAME_FINISHED");
    }

    // Before the real game: the lobby, the rules screen, or the end of a practice round.
    const preGame =
      status === "LOBBY" || status === "TUTORIAL" || (state.practice && status === "ROUND_END");

    const requirePlayers = async () => {
      const players = activePlayers(await store().listPlayers(gameId));
      if (players.length < 2) {
        throw new GameError(
          "VALIDATION_FAILED",
          "Scribble needs at least two players — one to draw and one to guess.",
        );
      }
    };

    switch (command.type) {
      case "START_GAME": {
        if (!preGame) throw new GameError("INVALID_TRANSITION", "The game has already started.");
        await requirePlayers();
        state.practice = false;
        state.roundNumber = 1;
        await announceDrawer(gameId);
        void persist(gameId);
        return;
      }

      case "SHOW_TUTORIAL":
      case "BACK_TO_LOBBY": {
        if (!preGame) throw new GameError("INVALID_TRANSITION", "The game has already started.");
        const showing = command.type === "SHOW_TUTORIAL";
        clearTimer(gameId);
        state.status = showing ? "TUTORIAL" : "LOBBY";
        state.round = null;
        state.practice = false;
        state.roundNumber = 0;
        await publish({ type: "SCRIBBLE_TUTORIAL", gameId, showing });
        return;
      }

      case "START_PRACTICE": {
        if (!preGame) throw new GameError("INVALID_TRANSITION", "Practice is only available before the game starts.");
        await requirePlayers();
        state.practice = true;
        state.roundNumber = 0;
        await announceDrawer(gameId);
        return;
      }

      case "END_ROUND":
        if (status !== "DRAWING") return;
        await endRoundInternal(gameId, "HOST");
        return;

      case "NEXT_ROUND": {
        if (state.practice) {
          throw new GameError("INVALID_TRANSITION", "That was a practice round — start the real game.");
        }
        if (status !== "ROUND_END" && status !== "LEADERBOARD") {
          throw new GameError("INVALID_TRANSITION", "Finish the current round first.");
        }
        if (state.roundNumber >= state.totalRounds) {
          await finishGame(gameId);
          return;
        }
        state.roundNumber += 1;
        await announceDrawer(gameId);
        return;
      }

      case "SHOW_LEADERBOARD": {
        if (status !== "ROUND_END" && status !== "LEADERBOARD") {
          throw new GameError("INVALID_TRANSITION", "End the round before showing the leaderboard.");
        }
        if (standingsHidden(state) || state.practice) {
          throw new GameError("INVALID_TRANSITION", "There's no leaderboard to show right now.");
        }
        state.status = "LEADERBOARD";
        const players = await store().listPlayers(gameId);
        await publish({
          type: "SCRIBBLE_LEADERBOARD",
          gameId,
          leaderboard: buildLeaderboard(players, state),
        });
        return;
      }

      case "PASS_DRAWER": {
        if (status !== "DRAWER_ANNOUNCE" && status !== "WORD_SELECT" && status !== "COUNTDOWN") {
          throw new GameError("INVALID_TRANSITION", "You can only skip a drawer before they start drawing.");
        }
        // The passed-over player isn't marked as having drawn, so they stay in
        // the pool and aren't penalised.
        await announceDrawer(gameId, { exclude: state.round?.drawerId });
        return;
      }

      case "CHOOSE_DRAWER": {
        if (status === "DRAWING" || status === "PAUSED") {
          throw new GameError("INVALID_TRANSITION", "End the current round before choosing a drawer.");
        }
        if (state.practice && status === "ROUND_END") {
          // Choosing a drawer after practice starts the real game with them.
          state.practice = false;
          state.roundNumber = 0;
        } else if (status === "ROUND_END" || status === "LEADERBOARD") {
          // Picking a drawer between rounds starts the next round.
          if (state.roundNumber >= state.totalRounds) {
            throw new GameError("INVALID_TRANSITION", "That was the last round — add more rounds in settings first.");
          }
          state.roundNumber += 1;
        }
        if (state.roundNumber === 0) state.roundNumber = 1;
        await announceDrawer(gameId, { drawerId: command.playerId });
        return;
      }

      case "SET_DURATION":
        state.durationSeconds = command.durationSeconds;
        if (state.round && state.status !== "DRAWING" && state.status !== "PAUSED") {
          state.round.durationSeconds = command.durationSeconds;
        }
        return;

      case "SET_TOTAL_ROUNDS":
        state.totalRounds = Math.max(
          Math.max(1, state.roundNumber),
          Math.min(30, Math.round(command.totalRounds)),
        );
        return;

      case "PAUSE_GAME": {
        if (status === "PAUSED" || status === "LOBBY" || status === "TUTORIAL") return;
        clearTimer(gameId);
        state.pausedFrom = status;
        state.pausedAt = Date.now();
        state.status = "PAUSED";
        await publish({ type: "SCRIBBLE_PAUSED", gameId, paused: true });
        return;
      }

      case "RESUME_GAME": {
        if (status !== "PAUSED") return;
        const resumed = state.pausedFrom ?? "LOBBY";
        // Paused time is handed back to the players, not swallowed by the clock.
        if (resumed === "DRAWING") {
          state.pausedAccumulatedMs += state.pausedAt ? Date.now() - state.pausedAt : 0;
        }
        state.status = resumed;
        state.pausedFrom = undefined;
        state.pausedAt = undefined;

        // Re-arm whichever step the pause cancelled; otherwise the game would sit
        // in that phase forever.
        if (resumed === "DRAWING") {
          scheduleHints(gameId);
        } else if (resumed === "DRAWER_ANNOUNCE") {
          scheduleTimer(gameId, ANNOUNCE_MS, async () => {
            await enterWordSelect(gameId);
          });
        } else if (resumed === "WORD_SELECT") {
          scheduleTimer(gameId, WORD_SELECT_MS, async () => {
            if (runtime(gameId).status === "WORD_SELECT") await beginCountdown(gameId);
          });
        } else if (resumed === "COUNTDOWN") {
          scheduleTimer(gameId, COUNTDOWN_MS, async () => {
            await beginDrawing(gameId);
          });
        }
        await publish({ type: "SCRIBBLE_PAUSED", gameId, paused: false });
        return;
      }

      case "END_GAME":
        if (status === "FINISHED") return;
        await finishGame(gameId);
        return;
    }
  });
}

async function finishGame(gameId: string): Promise<void> {
  const state = runtime(gameId);
  clearTimer(gameId);
  state.status = "FINISHED";

  const players = await store().listPlayers(gameId);
  const game = await store().getGame(gameId);
  if (game) {
    await store().putGame({
      ...game,
      status: "FINISHED",
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await publish({
    type: "SCRIBBLE_GAME_OVER",
    gameId,
    leaderboard: buildLeaderboard(players, state),
  });
  void persist(gameId);
}

/** The saved record for the export endpoint — fresh from memory if the game is live. */
export async function exportGame(gameId: string) {
  const game = await loadGame(gameId);
  const state = runtime(gameId);
  const players = await store().listPlayers(gameId);
  return buildArchive({
    game,
    status: state.status,
    totalRounds: state.totalRounds,
    durationSeconds: state.durationSeconds,
    players,
    leaderboard: buildLeaderboard(players, state),
    rounds: state.history,
  });
}

/** Used by the SSE route to decide which snapshot shape to send. */
export function isScribbleGame(game: GameSession): boolean {
  return game.gameMode === "SCRIBBLE";
}
