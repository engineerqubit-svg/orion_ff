import type {
  GameSession,
  Player,
  PlayerAnswer,
  PointAdjustment,
} from "@/types/game";
import type { QuizSummary, QuizWithQuestions } from "@/types/quiz";

/**
 * Persistence contract. Two implementations ship:
 *  - `MemoryStore` — zero-config, used for local development and tests.
 *  - `DynamoStore` — single-table DynamoDB, used in deployed environments.
 *
 * Nothing above this interface knows which one is active.
 */
export interface DataStore {
  readonly name: "memory" | "dynamodb";

  /* Quizzes */
  putQuiz(quiz: QuizWithQuestions): Promise<void>;
  getQuiz(quizId: string): Promise<QuizWithQuestions | null>;
  listQuizzes(): Promise<QuizSummary[]>;
  deleteQuiz(quizId: string): Promise<void>;

  /* Games */
  putGame(game: GameSession): Promise<void>;
  getGame(gameId: string): Promise<GameSession | null>;
  getGameByPin(gamePin: string): Promise<GameSession | null>;
  listGames(limit?: number): Promise<GameSession[]>;

  /* Players */
  putPlayer(player: Player): Promise<void>;
  getPlayer(gameId: string, playerId: string): Promise<Player | null>;
  listPlayers(gameId: string): Promise<Player[]>;
  deletePlayer(gameId: string, playerId: string): Promise<void>;

  /**
   * Atomically claims a nickname for a game. Returns false if it is already taken.
   * Backed by a conditional write, so two simultaneous joins cannot both win.
   */
  reserveNickname(gameId: string, nickname: string, playerId: string): Promise<boolean>;
  releaseNickname(gameId: string, nickname: string): Promise<void>;

  /* Answers */
  /**
   * Writes an answer only if this player has no answer for this question yet.
   * Returns false when an answer already exists — this is the single source of
   * truth for "one answer per question per player", enforced at the storage layer.
   */
  putAnswerIfAbsent(answer: PlayerAnswer): Promise<boolean>;
  updateAnswer(answer: PlayerAnswer): Promise<void>;
  getAnswer(gameId: string, questionId: string, playerId: string): Promise<PlayerAnswer | null>;
  listAnswersForQuestion(gameId: string, questionId: string): Promise<PlayerAnswer[]>;
  listAnswersForGame(gameId: string): Promise<PlayerAnswer[]>;
  deleteAnswersForQuestion(gameId: string, questionId: string): Promise<void>;

  /* Manual point adjustments (audit trail) */
  putAdjustment(adjustment: PointAdjustment): Promise<void>;
  listAdjustments(gameId: string): Promise<PointAdjustment[]>;
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: string = "STORE_ERROR",
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export function normaliseNickname(nickname: string): string {
  return nickname.trim().toLowerCase().replace(/\s+/g, " ");
}
