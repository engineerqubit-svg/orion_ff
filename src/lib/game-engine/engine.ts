import { getStore } from "@/lib/dynamodb";
import { generateGamePin, newId, newToken } from "@/lib/ids";
import { publish } from "@/lib/realtime/publisher";
import { applyStreak, calculateQuestionPoints } from "@/lib/scoring";
import type {
  AnswerDistributionBucket,
  GameSession,
  GameStats,
  HostQuestionView,
  LeaderboardEntry,
  ParticipantQuestionView,
  Player,
  PlayerAnswer,
  PlayerQuestionResult,
  PlayerScoreSnapshot,
  PointAdjustment,
  PublicPlayer,
} from "@/types/game";
import type { Question, QuizWithQuestions } from "@/types/quiz";
import type { RevealPayload, StateSyncEvent } from "@/types/realtime";
import type { HostCommand, JoinGameInput, SubmitAnswerInput } from "@/lib/validation/schemas";
import { GameError } from "./errors";
import { buildLeaderboard, computeGameStats, rankPlayers } from "./leaderboard";
import { withGameLock } from "./lock";
import { assertTransition, isRevealed } from "./state-machine";

/**
 * The authoritative game engine.
 *
 * Everything that can change a game passes through here, inside a per-game lock,
 * and every timing and scoring decision is made from the server clock against
 * server-held state. Nothing a participant sends is ever trusted beyond "which
 * answer id did you tap".
 */

/** How long a disconnected player keeps their seat before being marked offline. */
const DISCONNECT_GRACE_MS = 20_000;
/** How many pre-question snapshots to retain for rewinds. */
const SNAPSHOT_HISTORY = 3;
/** Clock skew tolerance when accepting an answer that lands right on the buzzer. */
const LATE_ANSWER_GRACE_MS = 750;

const store = () => getStore();

/* ------------------------------------------------------------------ Timers */

const timers = globalThis as unknown as {
  __arenaTimers?: Map<string, ReturnType<typeof setTimeout>>;
};

function timerMap(): Map<string, ReturnType<typeof setTimeout>> {
  timers.__arenaTimers ??= new Map();
  return timers.__arenaTimers;
}

function clearAutoEnd(gameId: string): void {
  const existing = timerMap().get(gameId);
  if (existing) clearTimeout(existing);
  timerMap().delete(gameId);
}

/**
 * Pushes QUESTION_ENDED the instant the timer expires rather than waiting for the
 * next request. `endQuestionInternal` is idempotent, so a host click that lands
 * first simply makes this a no-op.
 */
function scheduleAutoEnd(gameId: string, delayMs: number): void {
  clearAutoEnd(gameId);
  const timer = setTimeout(() => {
    timerMap().delete(gameId);
    void withGameLock(gameId, async () => {
      const game = await store().getGame(gameId);
      if (!game || game.status !== "QUESTION_ACTIVE") return;
      if (Date.now() < effectiveDeadline(game)) return;
      await endQuestionInternal(game, "TIMER");
    }).catch((error) => console.error("[engine] auto-end failed", error));
  }, Math.max(0, delayMs));
  timer.unref?.();
  timerMap().set(gameId, timer);
}

/* ------------------------------------------------------------------ Helpers */

function nowIso(): string {
  return new Date().toISOString();
}

function toPublicPlayer(player: Player): PublicPlayer {
  const { token: _token, ...rest } = player;
  return rest;
}

/** Deadline including any time the game spent paused during this question. */
function effectiveDeadline(game: GameSession): number {
  return (game.questionEndsAt ?? 0) + (game.pausedAccumulatedMs ?? 0);
}

function toParticipantView(
  question: Question,
  index: number,
  total: number,
): ParticipantQuestionView {
  // Built by explicit field pick, never by deleting from the full question — the
  // correct answer cannot leak into a participant payload by accident. Same
  // reasoning keeps videoUrl out: phones get a boolean, never the URL.
  return {
    questionId: question.questionId,
    index,
    total,
    question: question.question,
    imageUrl: question.imageUrl,
    hasVideo: Boolean(question.videoUrl),
    answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
    durationSeconds: question.durationSeconds,
    mode: question.mode,
  };
}

function toHostView(question: Question, index: number, total: number): HostQuestionView {
  // Built independently, not derived from toParticipantView — the host view
  // carries videoUrl, which participants must never receive.
  return {
    questionId: question.questionId,
    index,
    total,
    question: question.question,
    imageUrl: question.imageUrl,
    videoUrl: question.videoUrl,
    answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
    correctAnswerId: question.correctAnswerId,
    durationSeconds: question.durationSeconds,
    mode: question.mode,
  };
}

async function loadGame(gameId: string): Promise<GameSession> {
  const game = await store().getGame(gameId);
  if (!game) throw new GameError("GAME_NOT_FOUND");
  return game;
}

async function loadQuiz(quizId: string): Promise<QuizWithQuestions> {
  const quiz = await store().getQuiz(quizId);
  if (!quiz) throw new GameError("QUIZ_NOT_FOUND");
  return quiz;
}

function questionAt(quiz: QuizWithQuestions, index: number): Question | null {
  return quiz.questions[index] ?? null;
}

async function saveGame(game: GameSession): Promise<GameSession> {
  const next = { ...game, updatedAt: nowIso() };
  await store().putGame(next);
  return next;
}

/* --------------------------------------------------------------- Game setup */

export async function createGame(quizId: string, hostId: string): Promise<GameSession> {
  const quiz = await loadQuiz(quizId);
  if (quiz.questions.length === 0) throw new GameError("QUIZ_HAS_NO_QUESTIONS");

  // Retry on the rare PIN collision with a live game.
  let gamePin = generateGamePin();
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await store().getGameByPin(gamePin);
    if (!existing || existing.status === "FINISHED") break;
    gamePin = generateGamePin();
  }

  const game: GameSession = {
    gameId: newId("game"),
    gamePin,
    quizId,
    hostId,
    gameMode: quiz.gameMode,
    status: "LOBBY",
    currentQuestionIndex: -1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await store().putGame(game);
  return game;
}

export async function findGameByPin(gamePin: string): Promise<GameSession> {
  const game = await store().getGameByPin(gamePin);
  if (!game) throw new GameError("INVALID_PIN");
  return game;
}

/* -------------------------------------------------------------- Participants */

export interface JoinResult {
  game: GameSession;
  player: Player;
}

export async function joinGame(input: JoinGameInput): Promise<JoinResult> {
  const game = await findGameByPin(input.gamePin);

  return withGameLock(game.gameId, async () => {
    const current = await loadGame(game.gameId);
    if (current.status === "FINISHED") throw new GameError("GAME_FINISHED");
    if (current.status !== "LOBBY") throw new GameError("GAME_ALREADY_STARTED");

    const playerId = newId("plr");
    const claimed = await store().reserveNickname(current.gameId, input.nickname, playerId);
    if (!claimed) throw new GameError("NICKNAME_TAKEN");

    const player: Player = {
      playerId,
      gameId: current.gameId,
      nickname: input.nickname.trim(),
      score: 0,
      streak: 0,
      bestStreak: 0,
      streakMilestonesAwarded: [],
      correctCount: 0,
      connected: true,
      joinedAt: nowIso(),
      lastSeenAt: nowIso(),
      token: newToken(),
    };

    await store().putPlayer(player);
    const players = await store().listPlayers(current.gameId);

    await publish({
      type: "PLAYER_JOINED",
      gameId: current.gameId,
      player: toPublicPlayer(player),
      playerCount: players.length,
    });

    return { game: current, player };
  });
}

/**
 * Restores a session after a refresh or a dropped connection. The token is the
 * only credential — it is generated server-side and validated here on every use.
 */
export async function resumeSession(
  gameId: string,
  playerId: string,
  playerToken: string,
): Promise<{ game: GameSession; player: Player }> {
  const game = await loadGame(gameId);
  const player = await authenticatePlayer(gameId, playerId, playerToken);

  if (!player.connected) {
    // Re-read inside the lock so a score written a moment ago isn't overwritten.
    await withGameLock(gameId, async () => {
      const fresh = await store().getPlayer(gameId, playerId);
      if (fresh) await store().putPlayer({ ...fresh, connected: true, lastSeenAt: nowIso() });
    });
    player.connected = true;
    await publish({
      type: "PLAYER_JOINED",
      gameId,
      player: toPublicPlayer(player),
      playerCount: (await store().listPlayers(gameId)).length,
    });
  }

  return { game, player };
}

async function authenticatePlayer(
  gameId: string,
  playerId: string,
  playerToken: string,
): Promise<Player> {
  const player = await store().getPlayer(gameId, playerId);
  if (!player) throw new GameError("PLAYER_NOT_FOUND");
  if (player.token !== playerToken) throw new GameError("INVALID_TOKEN");
  if (player.kicked) throw new GameError("PLAYER_KICKED");
  return player;
}

/** Presence ping. A missed heartbeat never removes a player, it only marks them offline. */
export async function recordHeartbeat(
  gameId: string,
  playerId: string,
  playerToken: string,
): Promise<void> {
  // Inside the lock: this rewrites the whole player row, so an unlocked
  // read-then-write here could silently undo points scored in between.
  await withGameLock(gameId, async () => {
    const player = await store().getPlayer(gameId, playerId);
    if (!player || player.token !== playerToken || player.kicked) return;
    await store().putPlayer({ ...player, connected: true, lastSeenAt: nowIso() });
  });
}

/**
 * Marks players offline once they've missed the grace period. They keep their
 * seat, score and streak — a flaky office wifi should never cost someone the game.
 * Only the transition publishes an event, so repeated sweeps stay silent.
 */
export async function reapDisconnectedPlayers(gameId: string): Promise<void> {
  const cutoff = Date.now() - DISCONNECT_GRACE_MS;
  // Locked for the same reason as heartbeats: these are whole-row writes.
  const dropped = await withGameLock(gameId, async () => {
    const players = await store().listPlayers(gameId);
    const stale = players.filter(
      (p) => p.connected && new Date(p.lastSeenAt).getTime() < cutoff,
    );
    await Promise.all(stale.map((p) => store().putPlayer({ ...p, connected: false })));
    return stale;
  });
  if (dropped.length === 0) return;

  const remaining = await store().listPlayers(gameId);
  for (const player of dropped) {
    await publish({
      type: "PLAYER_LEFT",
      gameId,
      playerId: player.playerId,
      playerCount: remaining.length,
    });
  }
}

/* -------------------------------------------------------------- Answer intake */

export interface SubmitAnswerResult {
  questionId: string;
  responseTimeMs: number;
}

/**
 * Accepts one answer per player per question. The response time is measured from
 * the server-recorded question start, so a doctored client clock changes nothing.
 */
export async function submitAnswer(
  gameId: string,
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResult> {
  return withGameLock(gameId, async () => {
    const game = await loadGame(gameId);
    const player = await authenticatePlayer(gameId, input.playerId, input.playerToken);

    if (game.status !== "QUESTION_ACTIVE") throw new GameError("QUESTION_NOT_ACTIVE");

    const quiz = await loadQuiz(game.quizId);
    const question = questionAt(quiz, game.currentQuestionIndex);
    if (!question) throw new GameError("QUESTION_NOT_ACTIVE");
    if (question.questionId !== input.questionId) throw new GameError("QUESTION_MISMATCH");
    if (!question.answers.some((a) => a.id === input.answerId)) {
      throw new GameError("INVALID_ANSWER");
    }

    const submittedAt = Date.now();
    const deadline = effectiveDeadline(game);
    if (submittedAt > deadline + LATE_ANSWER_GRACE_MS) {
      // The timer has run out but the sweep hasn't fired yet — close it now.
      await endQuestionInternal(game, "TIMER");
      throw new GameError("QUESTION_NOT_ACTIVE", "Time's up for that question.");
    }

    const startedAt = game.questionStartedAt ?? submittedAt;
    const responseTimeMs = Math.max(
      0,
      Math.min(
        question.durationSeconds * 1000,
        submittedAt - startedAt - (game.pausedAccumulatedMs ?? 0),
      ),
    );

    const answer: PlayerAnswer = {
      gameId,
      questionId: question.questionId,
      playerId: player.playerId,
      answerId: input.answerId,
      submittedAt,
      responseTimeMs,
      isCorrect: input.answerId === question.correctAnswerId,
      pointsAwarded: 0,
      speedBonus: 0,
      streakBonus: 0,
      scored: false,
    };

    // Conditional write: the storage layer, not this function, is what makes
    // "one answer per question" race-proof.
    const stored = await store().putAnswerIfAbsent(answer);
    if (!stored) throw new GameError("ANSWER_ALREADY_SUBMITTED");

    await store().putPlayer({ ...player, connected: true, lastSeenAt: nowIso() });

    const players = await store().listPlayers(gameId);
    const answers = await store().listAnswersForQuestion(gameId, question.questionId);

    await publish({
      type: "ANSWER_SUBMITTED",
      gameId,
      questionId: question.questionId,
      answeredCount: answers.length,
      playerCount: players.length,
    });

    // Everyone is in — no reason to make the room watch an empty timer.
    if (players.length > 0 && answers.length >= players.length) {
      await endQuestionInternal(await loadGame(gameId), "ALL_ANSWERED");
    }

    return { questionId: question.questionId, responseTimeMs };
  });
}

/* ------------------------------------------------------------- Finalisation */

function snapshotPlayers(players: Player[]): PlayerScoreSnapshot[] {
  return players.map((p) => ({
    playerId: p.playerId,
    score: p.score,
    streak: p.streak,
    bestStreak: p.bestStreak,
    correctCount: p.correctCount,
    streakMilestonesAwarded: [...p.streakMilestonesAwarded],
    previousRank: p.previousRank,
  }));
}

/**
 * Closes the current question and commits scores. Idempotent: a host click, the
 * timer and the everyone-answered path all funnel here and only the first wins.
 */
async function endQuestionInternal(
  game: GameSession,
  reason: "TIMER" | "HOST" | "ALL_ANSWERED",
): Promise<GameSession> {
  if (game.status !== "QUESTION_ACTIVE") return game;

  clearAutoEnd(game.gameId);

  const quiz = await loadQuiz(game.quizId);
  const question = questionAt(quiz, game.currentQuestionIndex);
  if (!question) return game;

  const players = await store().listPlayers(game.gameId);
  const answers = await store().listAnswersForQuestion(game.gameId, question.questionId);

  const snapshots = { ...(game.scoreSnapshots ?? {}) };
  snapshots[question.questionId] = snapshotPlayers(players);
  pruneSnapshots(snapshots, quiz, game.currentQuestionIndex);

  await scoreQuestion(question, players, answers);

  const updated = await saveGame({
    ...game,
    status: "QUESTION_ENDED",
    questionEndedAt: Date.now(),
    scoreSnapshots: snapshots,
  });

  await publish({
    type: "QUESTION_ENDED",
    gameId: game.gameId,
    questionId: question.questionId,
    answeredCount: answers.length,
    playerCount: players.length,
    reason,
  });

  return updated;
}

function pruneSnapshots(
  snapshots: Record<string, PlayerScoreSnapshot[]>,
  quiz: QuizWithQuestions,
  currentIndex: number,
): void {
  const keep = new Set(
    quiz.questions
      .slice(Math.max(0, currentIndex - SNAPSHOT_HISTORY + 1), currentIndex + 1)
      .map((q) => q.questionId),
  );
  for (const key of Object.keys(snapshots)) {
    if (!keep.has(key)) delete snapshots[key];
  }
}

/**
 * Commits points for one question across every player — including those who never
 * answered, whose streak breaks here.
 */
async function scoreQuestion(
  question: Question,
  players: Player[],
  answers: PlayerAnswer[],
): Promise<void> {
  const byPlayer = new Map(answers.map((a) => [a.playerId, a] as const));

  // Fastest Finger placements are only knowable once the question is closed.
  const fastestFingerRanks = new Map<string, number>();
  if (question.mode === "FASTEST_FINGER") {
    answers
      .filter((a) => a.isCorrect)
      .sort((a, b) => a.responseTimeMs - b.responseTimeMs || a.submittedAt - b.submittedAt)
      .forEach((answer, index) => fastestFingerRanks.set(answer.playerId, index + 1));
  }

  const awardsPoints = question.mode !== "NO_POINTS";
  const durationMs = question.durationSeconds * 1000;

  await Promise.all(
    players.map(async (player) => {
      const answer = byPlayer.get(player.playerId) ?? null;
      const isCorrect = answer?.isCorrect ?? false;

      const points = calculateQuestionPoints({
        mode: question.mode,
        isCorrect,
        responseTimeMs: answer?.responseTimeMs ?? durationMs,
        durationMs,
        fastestFingerRank: fastestFingerRanks.get(player.playerId),
      });

      const streak = applyStreak({
        currentStreak: player.streak,
        awardedMilestones: player.streakMilestonesAwarded,
        isCorrect,
        awardsPoints,
      });

      await store().putPlayer({
        ...player,
        score: player.score + points.points + streak.bonus,
        streak: streak.streak,
        bestStreak: Math.max(player.bestStreak, streak.streak),
        streakMilestonesAwarded: streak.awardedMilestones,
        correctCount: player.correctCount + (isCorrect ? 1 : 0),
      });

      if (answer) {
        await store().updateAnswer({
          ...answer,
          pointsAwarded: points.points,
          speedBonus: points.speedBonus,
          streakBonus: streak.bonus,
          fastestFingerRank: fastestFingerRanks.get(player.playerId),
          scored: true,
        });
      }
    }),
  );
}

/* ----------------------------------------------------------------- Reveals */

function buildReveal(
  question: Question,
  players: Player[],
  answers: PlayerAnswer[],
): RevealPayload {
  const ranked = rankPlayers(players);
  const rankByPlayer = new Map(ranked.map((p, index) => [p.playerId, index + 1] as const));
  const byPlayer = new Map(answers.map((a) => [a.playerId, a] as const));

  const distribution: AnswerDistributionBucket[] = question.answers.map((option) => ({
    answerId: option.id,
    text: option.text,
    count: answers.filter((a) => a.answerId === option.id).length,
    isCorrect: option.id === question.correctAnswerId,
  }));

  const results: Record<string, PlayerQuestionResult> = {};
  for (const player of players) {
    const answer = byPlayer.get(player.playerId);
    results[player.playerId] = {
      playerId: player.playerId,
      answerId: answer?.answerId ?? null,
      isCorrect: answer?.isCorrect ?? false,
      pointsAwarded: answer?.pointsAwarded ?? 0,
      speedBonus: answer?.speedBonus ?? 0,
      streakBonus: answer?.streakBonus ?? 0,
      responseTimeMs: answer?.responseTimeMs ?? null,
      streak: player.streak,
      totalScore: player.score,
      rank: rankByPlayer.get(player.playerId) ?? players.length,
      fastestFingerRank: answer?.fastestFingerRank,
    };
  }

  return {
    questionId: question.questionId,
    correctAnswerId: question.correctAnswerId,
    distribution,
    results,
  };
}

/* ------------------------------------------------------------ State readout */

export type StateSyncPayload = Omit<StateSyncEvent, "seq" | "at">;

/**
 * The snapshot handed to any client that connects or reconnects. It is built from
 * the participant view, so it is safe to send to everyone; the correct answer
 * appears only once the game has actually reached a revealed state.
 */
export async function buildStateSync(gameId: string): Promise<StateSyncPayload> {
  const game = await reconcile(await loadGame(gameId));
  const quiz = await loadQuiz(game.quizId);
  const players = await store().listPlayers(gameId);
  const question = questionAt(quiz, game.currentQuestionIndex);

  const answers = question
    ? await store().listAnswersForQuestion(gameId, question.questionId)
    : [];

  const showQuestion =
    question !== null && game.status !== "LOBBY" && game.status !== "FINAL_RESULTS";

  return {
    type: "STATE_SYNC",
    gameId,
    status: game.status,
    currentQuestionIndex: game.currentQuestionIndex,
    questionCount: quiz.questions.length,
    players: players.map(toPublicPlayer),
    question:
      showQuestion && question
        ? toParticipantView(question, game.currentQuestionIndex, quiz.questions.length)
        : undefined,
    questionStartedAt: game.questionStartedAt,
    questionEndsAt: game.questionEndsAt ? effectiveDeadline(game) : undefined,
    answeredCount: answers.length,
    leaderboard: buildLeaderboard(players),
    reveal:
      question && isRevealed(game.status)
        ? buildReveal(question, players, answers)
        : undefined,
  };
}

/** Everything the host/projector screen needs, including host-only information. */
export interface HostGameView {
  game: GameSession;
  quiz: { quizId: string; title: string; description?: string; questionCount: number };
  question: HostQuestionView | null;
  players: PublicPlayer[];
  answeredCount: number;
  leaderboard: LeaderboardEntry[];
  reveal: RevealPayload | null;
  stats: GameStats | null;
  adjustments: PointAdjustment[];
  serverTime: number;
}

export async function getHostView(gameId: string): Promise<HostGameView> {
  const game = await reconcile(await loadGame(gameId));
  const quiz = await loadQuiz(game.quizId);
  const players = await store().listPlayers(gameId);
  const question = questionAt(quiz, game.currentQuestionIndex);
  const answers = question
    ? await store().listAnswersForQuestion(gameId, question.questionId)
    : [];

  const showStats = game.status === "FINAL_RESULTS" || game.status === "FINISHED";

  return {
    game: { ...game, questionEndsAt: game.questionEndsAt ? effectiveDeadline(game) : undefined },
    quiz: {
      quizId: quiz.quizId,
      title: quiz.title,
      description: quiz.description,
      questionCount: quiz.questions.length,
    },
    question: question
      ? toHostView(question, game.currentQuestionIndex, quiz.questions.length)
      : null,
    players: players.map(toPublicPlayer),
    answeredCount: answers.length,
    leaderboard: buildLeaderboard(players, { withDeltas: true }),
    reveal:
      question && isRevealed(game.status) ? buildReveal(question, players, answers) : null,
    stats: showStats
      ? computeGameStats(players, await store().listAnswersForGame(gameId), quiz.questions)
      : null,
    adjustments: await store().listAdjustments(gameId),
    serverTime: Date.now(),
  };
}

/**
 * Lazily closes a question whose timer expired while nothing was running — covers
 * serverless environments where an in-process timeout may not survive.
 */
async function reconcile(game: GameSession): Promise<GameSession> {
  if (game.status !== "QUESTION_ACTIVE") return game;
  if (Date.now() < effectiveDeadline(game)) return game;
  return endQuestionInternal(game, "TIMER");
}

/* ------------------------------------------------------------ Host commands */

export async function executeHostCommand(
  gameId: string,
  hostId: string,
  command: HostCommand,
): Promise<GameSession> {
  return withGameLock(gameId, async () => {
    const game = await reconcile(await loadGame(gameId));
    const quiz = await loadQuiz(game.quizId);

    switch (command.type) {
      case "START_GAME":
        return startGame(game, quiz);
      case "START_QUESTION":
        return startQuestion(game, quiz);
      case "END_QUESTION":
        return endQuestionInternal(game, "HOST");
      case "REVEAL_ANSWER":
        return revealAnswer(game, quiz);
      case "SHOW_LEADERBOARD":
        return showLeaderboard(game);
      case "NEXT_QUESTION":
        return moveToQuestion(game, quiz, game.currentQuestionIndex + 1);
      case "PREVIOUS_QUESTION":
        return moveToQuestion(game, quiz, game.currentQuestionIndex - 1);
      case "RESTART_QUESTION":
        return moveToQuestion(game, quiz, game.currentQuestionIndex, { forceRewind: true });
      case "PAUSE_GAME":
        return pauseGame(game);
      case "RESUME_GAME":
        return resumeGame(game);
      case "END_GAME":
        return endGame(game, quiz);
      case "FINISH_GAME":
        return finishGame(game);
      case "KICK_PLAYER":
        return kickPlayer(game, command.playerId);
      case "ADJUST_POINTS":
        return adjustPoints(game, quiz, hostId, command.playerId, command.amount, command.reason);
    }
  });
}

async function startGame(game: GameSession, quiz: QuizWithQuestions): Promise<GameSession> {
  assertTransition(game.status, "QUESTION_PREPARE");
  if (quiz.questions.length === 0) throw new GameError("QUIZ_HAS_NO_QUESTIONS");

  const players = await store().listPlayers(game.gameId);
  if (players.length === 0) {
    throw new GameError("VALIDATION_FAILED", "Wait for at least one player to join.");
  }

  const updated = await saveGame({ ...game, status: "QUESTION_PREPARE", currentQuestionIndex: 0 });

  await publish({
    type: "GAME_STARTED",
    gameId: game.gameId,
    questionCount: quiz.questions.length,
  });
  await publishPrepare(updated, quiz);

  return updated;
}

async function publishPrepare(game: GameSession, quiz: QuizWithQuestions): Promise<void> {
  const question = questionAt(quiz, game.currentQuestionIndex);
  if (!question) return;
  await publish({
    type: "QUESTION_PREPARE",
    gameId: game.gameId,
    index: game.currentQuestionIndex,
    total: quiz.questions.length,
    mode: question.mode,
    isFinalQuestion: game.currentQuestionIndex === quiz.questions.length - 1,
  });
}

async function startQuestion(game: GameSession, quiz: QuizWithQuestions): Promise<GameSession> {
  assertTransition(game.status, "QUESTION_ACTIVE");

  const question = questionAt(quiz, game.currentQuestionIndex);
  if (!question) throw new GameError("QUESTION_NOT_ACTIVE");

  const startedAt = Date.now();
  const updated = await saveGame({
    ...game,
    status: "QUESTION_ACTIVE",
    questionStartedAt: startedAt,
    questionEndsAt: startedAt + question.durationSeconds * 1000,
    questionEndedAt: undefined,
    pausedAccumulatedMs: 0,
    pausedAt: undefined,
  });

  const players = await store().listPlayers(game.gameId);

  await publish({
    type: "QUESTION_STARTED",
    gameId: game.gameId,
    question: toParticipantView(question, game.currentQuestionIndex, quiz.questions.length),
    questionStartedAt: startedAt,
    questionEndsAt: updated.questionEndsAt!,
    playerCount: players.length,
  });

  scheduleAutoEnd(game.gameId, question.durationSeconds * 1000);
  return updated;
}

async function revealAnswer(game: GameSession, quiz: QuizWithQuestions): Promise<GameSession> {
  assertTransition(game.status, "ANSWER_REVEAL");

  const question = questionAt(quiz, game.currentQuestionIndex);
  if (!question) throw new GameError("QUESTION_NOT_ACTIVE");

  const players = await store().listPlayers(game.gameId);
  const answers = await store().listAnswersForQuestion(game.gameId, question.questionId);
  const updated = await saveGame({ ...game, status: "ANSWER_REVEAL" });

  await publish({
    type: "ANSWER_REVEALED",
    gameId: game.gameId,
    reveal: buildReveal(question, players, answers),
  });

  return updated;
}

async function showLeaderboard(game: GameSession): Promise<GameSession> {
  assertTransition(game.status, "LEADERBOARD");

  const players = await store().listPlayers(game.gameId);
  const leaderboard = buildLeaderboard(players, { withDeltas: true });
  const updated = await saveGame({ ...game, status: "LEADERBOARD" });

  await publish({ type: "LEADERBOARD_SHOW", gameId: game.gameId, leaderboard });

  // Bank the ranks just shown so the next reveal can animate the movement.
  const ranked = rankPlayers(players);
  await Promise.all(
    ranked.map((player, index) => store().putPlayer({ ...player, previousRank: index + 1 })),
  );

  return updated;
}

interface MoveOptions {
  forceRewind?: boolean;
}

async function moveToQuestion(
  game: GameSession,
  quiz: QuizWithQuestions,
  targetIndex: number,
  options: MoveOptions = {},
): Promise<GameSession> {
  if (targetIndex >= quiz.questions.length) return endGame(game, quiz);
  if (targetIndex < 0) {
    throw new GameError("INVALID_TRANSITION", "You're already on the first question.");
  }

  assertTransition(game.status, "QUESTION_PREPARE");

  const goingBack = targetIndex <= game.currentQuestionIndex;
  let next = game;

  if (goingBack || options.forceRewind) {
    next = await rewindQuestion(next, quiz, targetIndex);
  }

  next = await saveGame({
    ...next,
    status: "QUESTION_PREPARE",
    currentQuestionIndex: targetIndex,
    questionStartedAt: undefined,
    questionEndsAt: undefined,
    questionEndedAt: undefined,
    pausedAccumulatedMs: 0,
  });

  await publish({
    type: "NEXT_QUESTION",
    gameId: game.gameId,
    index: targetIndex,
    total: quiz.questions.length,
  });
  await publishPrepare(next, quiz);

  return next;
}

/**
 * Undoes a question so it can be run again: restores every player's score, streak
 * and milestone ledger from the pre-scoring snapshot and clears its answers.
 *
 * If the snapshot has aged out of the retained window we clear the answers but
 * leave scores alone rather than guessing — the host UI says as much.
 */
async function rewindQuestion(
  game: GameSession,
  quiz: QuizWithQuestions,
  targetIndex: number,
): Promise<GameSession> {
  const question = questionAt(quiz, targetIndex);
  if (!question) return game;

  const snapshot = game.scoreSnapshots?.[question.questionId];
  await store().deleteAnswersForQuestion(game.gameId, question.questionId);

  if (!snapshot) return game;

  const players = await store().listPlayers(game.gameId);
  const byId = new Map(snapshot.map((s) => [s.playerId, s] as const));

  await Promise.all(
    players.map((player) => {
      const restore = byId.get(player.playerId);
      if (!restore) return Promise.resolve();
      return store().putPlayer({
        ...player,
        score: restore.score,
        streak: restore.streak,
        bestStreak: restore.bestStreak,
        correctCount: restore.correctCount,
        streakMilestonesAwarded: [...restore.streakMilestonesAwarded],
        previousRank: restore.previousRank,
      });
    }),
  );

  const snapshots = { ...(game.scoreSnapshots ?? {}) };
  delete snapshots[question.questionId];
  return { ...game, scoreSnapshots: snapshots };
}

async function pauseGame(game: GameSession): Promise<GameSession> {
  if (game.status === "PAUSED") return game;
  assertTransition(game.status, "PAUSED");

  clearAutoEnd(game.gameId);
  const updated = await saveGame({
    ...game,
    status: "PAUSED",
    pausedFrom: game.status,
    pausedAt: Date.now(),
  });

  await publish({ type: "GAME_PAUSED", gameId: game.gameId, pausedFrom: game.status });
  return updated;
}

async function resumeGame(game: GameSession): Promise<GameSession> {
  if (game.status !== "PAUSED") {
    throw new GameError("INVALID_TRANSITION", "The game isn't paused.");
  }

  const target = game.pausedFrom ?? "LOBBY";
  // Time spent paused is handed back to the players, not swallowed by the clock.
  const pausedFor = game.pausedAt ? Date.now() - game.pausedAt : 0;
  const pausedAccumulatedMs = (game.pausedAccumulatedMs ?? 0) + pausedFor;

  const updated = await saveGame({
    ...game,
    status: target,
    pausedFrom: undefined,
    pausedAt: undefined,
    pausedAccumulatedMs,
  });

  if (target === "QUESTION_ACTIVE") {
    scheduleAutoEnd(game.gameId, Math.max(0, effectiveDeadline(updated) - Date.now()));
  }

  await publish({
    type: "GAME_RESUMED",
    gameId: game.gameId,
    status: target,
    questionEndsAt: updated.questionEndsAt ? effectiveDeadline(updated) : undefined,
  });

  return updated;
}

async function endGame(game: GameSession, quiz: QuizWithQuestions): Promise<GameSession> {
  clearAutoEnd(game.gameId);

  // A game abandoned in the lobby has nothing to celebrate — close it outright.
  if (game.status === "LOBBY") return finishGame(game);

  assertTransition(game.status, "FINAL_RESULTS");

  const players = await store().listPlayers(game.gameId);
  const answers = await store().listAnswersForGame(game.gameId);
  const updated = await saveGame({ ...game, status: "FINAL_RESULTS" });

  await publish({
    type: "GAME_FINISHED",
    gameId: game.gameId,
    leaderboard: buildLeaderboard(players, { withDeltas: true }),
    stats: computeGameStats(players, answers, quiz.questions),
  });

  return updated;
}

async function finishGame(game: GameSession): Promise<GameSession> {
  clearAutoEnd(game.gameId);
  if (game.status === "FINISHED") return game;
  assertTransition(game.status, "FINISHED");
  return saveGame({ ...game, status: "FINISHED", finishedAt: nowIso() });
}

async function kickPlayer(game: GameSession, playerId: string): Promise<GameSession> {
  const player = await store().getPlayer(game.gameId, playerId);
  if (!player) throw new GameError("PLAYER_NOT_FOUND");

  // The row is kept (not deleted) so the kicked player's token resolves to a
  // clear "you were removed" instead of a confusing "session invalid".
  await store().putPlayer({ ...player, kicked: true, connected: false });

  const players = await store().listPlayers(game.gameId);
  await publish({
    type: "PLAYER_KICKED",
    gameId: game.gameId,
    playerId,
    nickname: player.nickname,
    playerCount: players.length,
  });

  return game;
}

async function adjustPoints(
  game: GameSession,
  quiz: QuizWithQuestions,
  hostId: string,
  playerId: string,
  amount: number,
  reason?: string,
): Promise<GameSession> {
  const player = await store().getPlayer(game.gameId, playerId);
  if (!player) throw new GameError("PLAYER_NOT_FOUND");

  const scoreBefore = player.score;
  const scoreAfter = Math.max(0, scoreBefore + amount);
  await store().putPlayer({ ...player, score: scoreAfter });

  const adjustment: PointAdjustment = {
    adjustmentId: newId("adj"),
    gameId: game.gameId,
    playerId,
    nickname: player.nickname,
    hostId,
    direction: amount >= 0 ? "AWARD" : "DEDUCT",
    amount,
    scoreBefore,
    scoreAfter,
    reason,
    createdAt: nowIso(),
  };
  await store().putAdjustment(adjustment);

  const players = await store().listPlayers(game.gameId);
  await publish({
    type: "SCORE_ADJUSTED",
    gameId: game.gameId,
    playerId,
    nickname: player.nickname,
    delta: scoreAfter - scoreBefore,
    newScore: scoreAfter,
    leaderboard: buildLeaderboard(players),
  });

  // A live result screen is showing stale totals — refresh it in place.
  if (isRevealed(game.status)) {
    const question = questionAt(quiz, game.currentQuestionIndex);
    if (question) {
      const answers = await store().listAnswersForQuestion(game.gameId, question.questionId);
      await publish({
        type: "RESULTS_UPDATED",
        gameId: game.gameId,
        reveal: buildReveal(question, players, answers),
      });
    }
  }

  return game;
}
