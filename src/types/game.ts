import type { GameMode, QuestionMode } from "./quiz";

/**
 * Live game domain. The server is the sole authority for every field here —
 * nothing in this file is ever accepted from a participant browser.
 */

export const GAME_STATUSES = [
  "LOBBY",
  "QUESTION_PREPARE",
  "QUESTION_ACTIVE",
  "QUESTION_ENDED",
  "ANSWER_REVEAL",
  "LEADERBOARD",
  "FINAL_RESULTS",
  "FINISHED",
  "PAUSED",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

/**
 * Player scoring state captured immediately before a question is finalised.
 * Restart / previous-question rewinds replay from these so points and streaks
 * unwind exactly rather than being approximated.
 */
export interface PlayerScoreSnapshot {
  playerId: string;
  score: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  streakMilestonesAwarded: number[];
  previousRank?: number;
}

export interface GameSession {
  gameId: string;
  gamePin: string;
  quizId: string;
  hostId: string;
  gameMode: GameMode;
  status: GameStatus;
  /** -1 while in the lobby; otherwise the index into the quiz's ordered questions. */
  currentQuestionIndex: number;
  /** Epoch ms, set by the server the instant a question goes live. */
  questionStartedAt?: number;
  /** Epoch ms deadline = questionStartedAt + durationSeconds * 1000. */
  questionEndsAt?: number;
  /** Epoch ms, set when the question closed (timer, host, or everyone answered). */
  questionEndedAt?: number;
  /** Status to return to when the game is resumed. */
  pausedFrom?: GameStatus;
  /** Accumulated ms spent paused during the current question, added to the deadline. */
  pausedAccumulatedMs?: number;
  pausedAt?: number;
  /**
   * Pre-finalisation snapshots keyed by questionId, capped to the most recent few
   * questions. Enough to rewind a restart or a step backwards without carrying
   * the whole game history on the session item.
   */
  scoreSnapshots?: Record<string, PlayerScoreSnapshot[]>;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface Player {
  playerId: string;
  gameId: string;
  nickname: string;
  score: number;
  streak: number;
  bestStreak: number;
  /** Streak milestones already paid out during the current unbroken streak. */
  streakMilestonesAwarded: number[];
  correctCount: number;
  /** Rank after the previous leaderboard reveal, used for position-change animations. */
  previousRank?: number;
  connected: boolean;
  kicked?: boolean;
  joinedAt: string;
  lastSeenAt: string;
  /** Never leaves the server except in the join/resume response to its own owner. */
  token: string;
}

/** Player shape safe to broadcast to every client. */
export type PublicPlayer = Omit<Player, "token">;

export interface PlayerAnswer {
  gameId: string;
  questionId: string;
  playerId: string;
  answerId: string;
  submittedAt: number;
  responseTimeMs: number;
  isCorrect: boolean;
  pointsAwarded: number;
  speedBonus: number;
  streakBonus: number;
  /** Placement among correct answers, 1-based. Only set for FASTEST_FINGER. */
  fastestFingerRank?: number;
  /** True once the question has been finalised and points committed. */
  scored: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  streak: number;
  previousRank?: number;
  /** Positive = climbed, negative = dropped. */
  positionDelta?: number;
  pointsThisQuestion?: number;
}

export interface AnswerDistributionBucket {
  answerId: string;
  text: string;
  count: number;
  isCorrect: boolean;
}

/** Per-player outcome for one question, broadcast only after ANSWER_REVEALED. */
export interface PlayerQuestionResult {
  playerId: string;
  answerId: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
  speedBonus: number;
  streakBonus: number;
  responseTimeMs: number | null;
  streak: number;
  totalScore: number;
  rank: number;
  fastestFingerRank?: number;
}

export interface GameStats {
  fastestAnswer?: { nickname: string; responseTimeMs: number; questionIndex: number };
  longestStreak?: { nickname: string; streak: number };
  mostCorrect?: { nickname: string; correctCount: number };
  biggestComeback?: { nickname: string; positionsGained: number };
}

export type PointAdjustmentDirection = "AWARD" | "DEDUCT";

/** Audit trail for manual host point changes. */
export interface PointAdjustment {
  adjustmentId: string;
  gameId: string;
  playerId: string;
  nickname: string;
  hostId: string;
  direction: PointAdjustmentDirection;
  amount: number;
  scoreBefore: number;
  scoreAfter: number;
  reason?: string;
  createdAt: string;
}

export interface GameSummary {
  gameId: string;
  gamePin: string;
  quizId: string;
  quizTitle: string;
  status: GameStatus;
  playerCount: number;
  questionCount: number;
  winner?: string;
  createdAt: string;
  finishedAt?: string;
}

/** The question view the host/projector receives — includes the correct answer. */
export interface HostQuestionView {
  questionId: string;
  index: number;
  total: number;
  question: string;
  imageUrl?: string;
  /** YouTube URL — the display embeds and plays this. */
  videoUrl?: string;
  answers: { id: string; text: string }[];
  correctAnswerId: string;
  durationSeconds: number;
  mode: QuestionMode;
}

/**
 * The question view a participant receives — the correct answer is absent by
 * construction. Video never ships here as a URL: 200 phones individually
 * streaming the same clip is how you break a venue's wifi mid-game. Phones
 * only learn `hasVideo` so they can point players at the shared screen.
 */
export interface ParticipantQuestionView {
  questionId: string;
  index: number;
  total: number;
  question: string;
  imageUrl?: string;
  hasVideo?: boolean;
  answers: { id: string; text: string }[];
  durationSeconds: number;
  mode: QuestionMode;
}
