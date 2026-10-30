import type {
  AnswerDistributionBucket,
  GameStats,
  GameStatus,
  LeaderboardEntry,
  ParticipantQuestionView,
  PlayerQuestionResult,
  PublicPlayer,
} from "./game";
import type { QuestionMode } from "./quiz";

/**
 * Typed realtime contract.
 *
 * Direction of travel:
 *  - ServerEvent  : server -> every client subscribed to a game channel (fan-out).
 *  - ClientEvent  : client -> server over the realtime transport (presence only).
 *
 * State-changing actions (join, answer, host commands) deliberately do NOT travel
 * over the realtime transport. They use the HTTP command API in `lib/game-engine`
 * so the caller gets an authoritative request/response with real error handling.
 * The transport stays a dumb, replaceable fan-out pipe.
 *
 * Anti-cheat invariant: no event in this file carries `correctAnswerId` or any
 * per-player scoring detail before `ANSWER_REVEALED`. `QuestionStartedEvent`
 * carries a `ParticipantQuestionView`, which has no correct-answer field at all.
 */

export const SERVER_EVENT_TYPES = [
  "STATE_SYNC",
  "PLAYER_JOINED",
  "PLAYER_LEFT",
  "PLAYER_KICKED",
  "GAME_STARTED",
  "QUESTION_PREPARE",
  "QUESTION_STARTED",
  "ANSWER_SUBMITTED",
  "QUESTION_ENDED",
  "ANSWER_REVEALED",
  "RESULTS_UPDATED",
  "LEADERBOARD_SHOW",
  "LEADERBOARD_UPDATED",
  "NEXT_QUESTION",
  "GAME_PAUSED",
  "GAME_RESUMED",
  "GAME_FINISHED",
  "SCORE_ADJUSTED",
] as const;

export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];

interface EventBase {
  gameId: string;
  /** Server clock, epoch ms. Clients use this to correct for local clock drift. */
  at: number;
  /** Monotonic per game. Lets clients drop duplicates and detect gaps on reconnect. */
  seq: number;
}

/** Full snapshot pushed the moment a client subscribes, and after any reconnect. */
export interface StateSyncEvent extends EventBase {
  type: "STATE_SYNC";
  status: GameStatus;
  currentQuestionIndex: number;
  questionCount: number;
  players: PublicPlayer[];
  /** Present while a question is live or ended but not yet reset. */
  question?: ParticipantQuestionView;
  questionStartedAt?: number;
  questionEndsAt?: number;
  answeredCount: number;
  leaderboard: LeaderboardEntry[];
  /** Only populated once the answer for the current question has been revealed. */
  reveal?: RevealPayload;
}

export interface PlayerJoinedEvent extends EventBase {
  type: "PLAYER_JOINED";
  player: PublicPlayer;
  playerCount: number;
}

export interface PlayerLeftEvent extends EventBase {
  type: "PLAYER_LEFT";
  playerId: string;
  playerCount: number;
}

export interface PlayerKickedEvent extends EventBase {
  type: "PLAYER_KICKED";
  playerId: string;
  nickname: string;
  playerCount: number;
}

export interface GameStartedEvent extends EventBase {
  type: "GAME_STARTED";
  questionCount: number;
}

/** Dramatic pre-roll: special-round announcement plus a countdown to the question. */
export interface QuestionPrepareEvent extends EventBase {
  type: "QUESTION_PREPARE";
  index: number;
  total: number;
  mode: QuestionMode;
  isFinalQuestion: boolean;
}

export interface QuestionStartedEvent extends EventBase {
  type: "QUESTION_STARTED";
  question: ParticipantQuestionView;
  questionStartedAt: number;
  questionEndsAt: number;
  playerCount: number;
}

/** Aggregate only — never reveals which player picked which answer. */
export interface AnswerSubmittedEvent extends EventBase {
  type: "ANSWER_SUBMITTED";
  questionId: string;
  answeredCount: number;
  playerCount: number;
}

export interface QuestionEndedEvent extends EventBase {
  type: "QUESTION_ENDED";
  questionId: string;
  answeredCount: number;
  playerCount: number;
  reason: "TIMER" | "HOST" | "ALL_ANSWERED";
}

export interface RevealPayload {
  questionId: string;
  correctAnswerId: string;
  distribution: AnswerDistributionBucket[];
  /** Keyed by playerId. Safe to broadcast: the question is over. */
  results: Record<string, PlayerQuestionResult>;
}

export interface AnswerRevealedEvent extends EventBase {
  type: "ANSWER_REVEALED";
  reveal: RevealPayload;
}

export interface ResultsUpdatedEvent extends EventBase {
  type: "RESULTS_UPDATED";
  reveal: RevealPayload;
}

export interface LeaderboardShowEvent extends EventBase {
  type: "LEADERBOARD_SHOW";
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardUpdatedEvent extends EventBase {
  type: "LEADERBOARD_UPDATED";
  leaderboard: LeaderboardEntry[];
}

export interface NextQuestionEvent extends EventBase {
  type: "NEXT_QUESTION";
  index: number;
  total: number;
}

export interface GamePausedEvent extends EventBase {
  type: "GAME_PAUSED";
  pausedFrom: GameStatus;
}

export interface GameResumedEvent extends EventBase {
  type: "GAME_RESUMED";
  status: GameStatus;
  questionEndsAt?: number;
}

export interface GameFinishedEvent extends EventBase {
  type: "GAME_FINISHED";
  leaderboard: LeaderboardEntry[];
  stats: GameStats;
}

export interface ScoreAdjustedEvent extends EventBase {
  type: "SCORE_ADJUSTED";
  playerId: string;
  nickname: string;
  delta: number;
  newScore: number;
  leaderboard: LeaderboardEntry[];
}

export type QuizServerEvent =
  | StateSyncEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerKickedEvent
  | GameStartedEvent
  | QuestionPrepareEvent
  | QuestionStartedEvent
  | AnswerSubmittedEvent
  | QuestionEndedEvent
  | AnswerRevealedEvent
  | ResultsUpdatedEvent
  | LeaderboardShowEvent
  | LeaderboardUpdatedEvent
  | NextQuestionEvent
  | GamePausedEvent
  | GameResumedEvent
  | GameFinishedEvent
  | ScoreAdjustedEvent;

/** Every event that can arrive on a game channel, across both game modes. */
export type ServerEvent = QuizServerEvent | import("./scribble").ScribbleServerEvent;

/** Narrow a ServerEvent to one variant, e.g. `isEvent(e, "QUESTION_STARTED")`. */
export function isEvent<T extends ServerEvent["type"]>(
  event: ServerEvent,
  type: T,
): event is Extract<ServerEvent, { type: T }> {
  return event.type === type;
}

/* ---------------------------------------------------------------------- */
/* Client -> server                                                        */
/* ---------------------------------------------------------------------- */

export interface HeartbeatEvent {
  type: "HEARTBEAT";
  gameId: string;
  playerId?: string;
  playerToken?: string;
}

export interface HelloEvent {
  type: "HELLO";
  gameId: string;
  role: "HOST" | "PLAYER";
  playerId?: string;
  playerToken?: string;
}

export type ClientEvent = HeartbeatEvent | HelloEvent;

/* ---------------------------------------------------------------------- */
/* Transport                                                               */
/* ---------------------------------------------------------------------- */

export type ConnectionStatus = "IDLE" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "CLOSED";

export interface RealtimeProviderOptions {
  gameId: string;
  role: "HOST" | "PLAYER";
  playerId?: string;
  playerToken?: string;
}

/**
 * Swap-in point for the transport. `LocalRealtimeProvider` (SSE over the Next.js
 * server) and `AWSWebSocketProvider` (API Gateway WebSocket) both implement this,
 * and nothing above this line knows which one is in play.
 */
export interface RealtimeProvider {
  connect(): Promise<void>;
  disconnect(): void;
  send(event: ClientEvent): void;
  subscribe(callback: (event: ServerEvent) => void): () => void;
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
  readonly status: ConnectionStatus;
}
