/** Error codes surfaced to clients. Each maps to a specific toast/empty state. */
export const GAME_ERROR_CODES = {
  INVALID_PIN: "INVALID_PIN",
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  GAME_FINISHED: "GAME_FINISHED",
  NICKNAME_TAKEN: "NICKNAME_TAKEN",
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  PLAYER_KICKED: "PLAYER_KICKED",
  INVALID_TOKEN: "INVALID_TOKEN",
  ANSWER_ALREADY_SUBMITTED: "ANSWER_ALREADY_SUBMITTED",
  QUESTION_NOT_ACTIVE: "QUESTION_NOT_ACTIVE",
  QUESTION_MISMATCH: "QUESTION_MISMATCH",
  INVALID_ANSWER: "INVALID_ANSWER",
  QUIZ_NOT_FOUND: "QUIZ_NOT_FOUND",
  QUIZ_HAS_NO_QUESTIONS: "QUIZ_HAS_NO_QUESTIONS",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  UNAUTHORISED: "UNAUTHORISED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type GameErrorCode = (typeof GAME_ERROR_CODES)[keyof typeof GAME_ERROR_CODES];

const STATUS_BY_CODE: Record<GameErrorCode, number> = {
  INVALID_PIN: 404,
  GAME_NOT_FOUND: 404,
  GAME_ALREADY_STARTED: 409,
  GAME_FINISHED: 409,
  NICKNAME_TAKEN: 409,
  PLAYER_NOT_FOUND: 404,
  PLAYER_KICKED: 403,
  INVALID_TOKEN: 401,
  ANSWER_ALREADY_SUBMITTED: 409,
  QUESTION_NOT_ACTIVE: 409,
  QUESTION_MISMATCH: 409,
  INVALID_ANSWER: 400,
  QUIZ_NOT_FOUND: 404,
  QUIZ_HAS_NO_QUESTIONS: 400,
  INVALID_TRANSITION: 409,
  UNAUTHORISED: 401,
  VALIDATION_FAILED: 400,
  SERVER_ERROR: 500,
};

/** Default copy. Callers may override with something more specific. */
const MESSAGES: Record<GameErrorCode, string> = {
  INVALID_PIN: "That game PIN doesn't match a live game.",
  GAME_NOT_FOUND: "We couldn't find that game.",
  GAME_ALREADY_STARTED: "This game has already started — ask the host for a fresh PIN.",
  GAME_FINISHED: "This game has already finished.",
  NICKNAME_TAKEN: "Someone in this game already took that nickname.",
  PLAYER_NOT_FOUND: "We couldn't find your player in this game.",
  PLAYER_KICKED: "You were removed from this game by the host.",
  INVALID_TOKEN: "Your session is no longer valid. Please join again.",
  ANSWER_ALREADY_SUBMITTED: "You've already locked in an answer for this question.",
  QUESTION_NOT_ACTIVE: "That question isn't accepting answers right now.",
  QUESTION_MISMATCH: "The game has moved on to another question.",
  INVALID_ANSWER: "That isn't one of the available answers.",
  QUIZ_NOT_FOUND: "We couldn't find that quiz.",
  QUIZ_HAS_NO_QUESTIONS: "Add at least one question before hosting this quiz.",
  INVALID_TRANSITION: "That action isn't available right now.",
  UNAUTHORISED: "You need to sign in as a host to do that.",
  VALIDATION_FAILED: "Some of the details you entered aren't valid.",
  SERVER_ERROR: "Something went wrong on our side. Please try again.",
};

export class GameError extends Error {
  readonly status: number;

  constructor(
    readonly code: GameErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? MESSAGES[code]);
    this.name = "GameError";
    this.status = STATUS_BY_CODE[code];
  }
}

export function isGameError(error: unknown): error is GameError {
  return error instanceof GameError;
}
