/**
 * Scribble game mode.
 *
 * Self-contained by design — this file imports nothing from the quiz types, so
 * the two modes can evolve independently inside the same application.
 */

/** Normalised to 0..1 against the canvas box, so every screen renders identically. */
export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  color: string;
  width: number;
  points: DrawingPoint[];
  /** Eraser strokes paint the canvas background rather than a colour. */
  erase?: boolean;
}

export const SCRIBBLE_STATUSES = [
  "LOBBY",
  "TUTORIAL",
  "DRAWER_ANNOUNCE",
  "WORD_SELECT",
  "COUNTDOWN",
  "DRAWING",
  "ROUND_END",
  "LEADERBOARD",
  "FINISHED",
  "PAUSED",
] as const;

export type ScribbleStatus = (typeof SCRIBBLE_STATUSES)[number];

export const ROUND_DURATIONS = [30, 45, 60] as const;
export type RoundDuration = (typeof ROUND_DURATIONS)[number];

export interface CorrectGuess {
  playerId: string;
  nickname: string;
  /** ms from the first stroke being allowed, measured server-side. */
  responseTimeMs: number;
  points: number;
  order: number;
}

/** Round state as the server holds it. `word` never leaves this object directly. */
export interface ScribbleRound {
  roundNumber: number;
  drawerId: string;
  drawerName: string;
  word: string;
  wordChoices: string[];
  category: string;
  durationSeconds: number;
  startedAt?: number;
  endsAt?: number;
  endedAt?: number;
  strokes: DrawingStroke[];
  correctGuesses: CorrectGuess[];
  drawerPoints: number;
  /** Indices of letters already revealed as hints. */
  revealedIndices: number[];
  /** Per-player time of the last guess, for the flood guard. */
  lastGuessAt?: Record<string, number>;
  /** Every guess this round, kept for the saved record. */
  guessLog?: GuessLogEntry[];
}

export interface GuessLogEntry {
  playerId: string;
  nickname: string;
  guess: string;
  outcome: "CORRECT" | "CLOSE" | "WRONG";
  /** ms into the drawing phase, pauses excluded. */
  atMs: number;
  points?: number;
}

/** A finished round as written to the saved game file. */
export interface ScribbleRoundRecord {
  roundNumber: number;
  practice: boolean;
  drawerId: string;
  drawerName: string;
  word: string;
  category: string;
  wordChoices: string[];
  durationSeconds: number;
  startedAt?: number;
  endedAt?: number;
  endReason: "TIMER" | "HOST" | "ALL_GUESSED";
  correctGuesses: CorrectGuess[];
  drawerPoints: number;
  guesses: GuessLogEntry[];
  strokes: DrawingStroke[];
}

export interface ScribbleScoreEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  roundsDrawn: number;
  correctGuesses: number;
}

/**
 * What the projector receives. Deliberately has no `word` field while a round is
 * live — the big screen can't leak what it doesn't have.
 */
export interface ScribbleAdminView {
  gameId: string;
  gamePin: string;
  status: ScribbleStatus;
  roundNumber: number;
  totalRounds: number;
  durationSeconds: number;
  players: { playerId: string; nickname: string; connected: boolean; score: number }[];
  drawer: { playerId: string; nickname: string } | null;
  /** Masked form, e.g. "_ _ F F _ _ _". Present from WORD_SELECT onwards. */
  wordHint: string | null;
  wordLength: number | null;
  /** Only populated once the round has ended. */
  revealedWord: string | null;
  startedAt?: number;
  endsAt?: number;
  strokes: DrawingStroke[];
  correctGuesses: CorrectGuess[];
  correctCount: number;
  guesserCount: number;
  drawerPoints: number;
  leaderboard: ScribbleScoreEntry[];
  /** True during the final blind rounds — skip the leaderboard and go straight on. */
  standingsHidden: boolean;
  /** A warm-up round: plays for real, scores nothing. */
  practice: boolean;
  previousDrawers: string[];
  serverTime: number;
}

/** What a participant receives. `word` appears only for the drawer. */
export interface ScribblePlayerView {
  gameId: string;
  status: ScribbleStatus;
  roundNumber: number;
  totalRounds: number;
  isDrawer: boolean;
  drawer: { playerId: string; nickname: string } | null;
  /** Drawer only. */
  word: string | null;
  /** Drawer only, during WORD_SELECT. */
  wordChoices: string[] | null;
  wordHint: string | null;
  wordLength: number | null;
  revealedWord: string | null;
  startedAt?: number;
  endsAt?: number;
  /** Only present when the view was requested with `includeStrokes`. */
  strokes?: DrawingStroke[];
  correctCount: number;
  guesserCount: number;
  /** This player's own result for the current round, if they got it. */
  myGuess: CorrectGuess | null;
  myRank: number | null;
  myScore: number;
  /** Empty while `standingsHidden` is true. */
  leaderboard: ScribbleScoreEntry[];
  standingsHidden: boolean;
  practice: boolean;
  serverTime: number;
}

/* ---------------------------------------------------------------- Events */

interface ScribbleEventBase {
  gameId: string;
  at: number;
  seq: number;
}

/**
 * Stroke deltas, not whole strokes. Only the points added since the last flush
 * travel, and receivers append by stroke id — a full stroke every frame would be
 * roughly ten times the bandwidth with 80 people watching.
 */
export interface DrawStrokeEvent extends ScribbleEventBase {
  type: "DRAW_STROKE";
  strokeId: string;
  color: string;
  width: number;
  erase?: boolean;
  points: DrawingPoint[];
}

export interface ClearCanvasEvent extends ScribbleEventBase {
  type: "CLEAR_CANVAS";
}

export interface UndoStrokeEvent extends ScribbleEventBase {
  type: "UNDO_STROKE";
  strokeId: string;
}

export interface GuessCorrectEvent extends ScribbleEventBase {
  type: "GUESS_CORRECT";
  playerId: string;
  playerName: string;
  correctCount: number;
  guesserCount: number;
  order: number;
}

/** Deliberately anonymous — who's drawing is never broadcast. */
export interface DrawerChosenEvent extends ScribbleEventBase {
  type: "DRAWER_CHOSEN";
  roundNumber: number;
}

/** A wrong guess, shown to the room. Near-misses are never broadcast. */
export interface GuessWrongEvent extends ScribbleEventBase {
  type: "GUESS_WRONG";
  playerId: string;
  playerName: string;
  guess: string;
}

export interface WordSelectedEvent extends ScribbleEventBase {
  type: "WORD_SELECTED";
  wordLength: number;
  wordHint: string;
}

export interface RoundStartedEvent extends ScribbleEventBase {
  type: "ROUND_STARTED";
  roundNumber: number;
  startedAt: number;
  endsAt: number;
  wordHint: string;
  wordLength: number;
}

export interface HintUpdatedEvent extends ScribbleEventBase {
  type: "HINT_UPDATED";
  wordHint: string;
}

export interface RoundEndedEvent extends ScribbleEventBase {
  type: "ROUND_ENDED";
  word: string;
  correctGuesses: CorrectGuess[];
  drawerPoints: number;
  reason: "TIMER" | "HOST" | "ALL_GUESSED";
}

export interface ScribbleLeaderboardEvent extends ScribbleEventBase {
  type: "SCRIBBLE_LEADERBOARD";
  leaderboard: ScribbleScoreEntry[];
}

export interface ScribbleStateSyncEvent extends ScribbleEventBase {
  type: "SCRIBBLE_STATE_SYNC";
  status: ScribbleStatus;
}

export interface ScribbleGameOverEvent extends ScribbleEventBase {
  type: "SCRIBBLE_GAME_OVER";
  leaderboard: ScribbleScoreEntry[];
}

/** Host moved between the lobby and the how-to-play screen. */
export interface ScribbleTutorialEvent extends ScribbleEventBase {
  type: "SCRIBBLE_TUTORIAL";
  showing: boolean;
}

export interface ScribblePausedEvent extends ScribbleEventBase {
  type: "SCRIBBLE_PAUSED";
  paused: boolean;
}

export type ScribbleServerEvent =
  | DrawStrokeEvent
  | ClearCanvasEvent
  | UndoStrokeEvent
  | GuessCorrectEvent
  | GuessWrongEvent
  | DrawerChosenEvent
  | WordSelectedEvent
  | RoundStartedEvent
  | HintUpdatedEvent
  | RoundEndedEvent
  | ScribbleLeaderboardEvent
  | ScribbleStateSyncEvent
  | ScribbleGameOverEvent
  | ScribblePausedEvent
  | ScribbleTutorialEvent;

export type ScribbleEventType = ScribbleServerEvent["type"];

/** Result of a guess, returned to the guesser only. */
export interface GuessResult {
  outcome: "CORRECT" | "CLOSE" | "WRONG";
  points?: number;
  word?: string;
  rank?: number;
  correctCount?: number;
  guesserCount?: number;
}
