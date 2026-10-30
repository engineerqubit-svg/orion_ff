import type { GameStatus } from "@/types/game";

/**
 * Game progression as an explicit state machine.
 *
 *   LOBBY -> QUESTION_PREPARE -> QUESTION_ACTIVE -> QUESTION_ENDED
 *         -> ANSWER_REVEAL -> LEADERBOARD -> QUESTION_PREPARE ...
 *
 * On the final question: ANSWER_REVEAL -> FINAL_RESULTS -> FINISHED.
 *
 * Every host command is checked against this table before the engine mutates
 * anything, so an out-of-order click (e.g. "reveal answer" while the timer is
 * still running) is rejected with a clear error instead of corrupting the game.
 */

const TRANSITIONS: Record<GameStatus, readonly GameStatus[]> = {
  LOBBY: ["QUESTION_PREPARE", "PAUSED", "FINISHED"],
  QUESTION_PREPARE: ["QUESTION_ACTIVE", "LEADERBOARD", "PAUSED", "FINISHED"],
  // QUESTION_ACTIVE can go back to QUESTION_PREPARE via "restart question".
  QUESTION_ACTIVE: ["QUESTION_ENDED", "QUESTION_PREPARE", "PAUSED", "FINISHED"],
  QUESTION_ENDED: ["ANSWER_REVEAL", "QUESTION_PREPARE", "PAUSED", "FINISHED"],
  ANSWER_REVEAL: [
    "LEADERBOARD",
    "QUESTION_PREPARE",
    "FINAL_RESULTS",
    "PAUSED",
    "FINISHED",
  ],
  LEADERBOARD: ["QUESTION_PREPARE", "FINAL_RESULTS", "PAUSED", "FINISHED"],
  FINAL_RESULTS: ["FINISHED", "LEADERBOARD", "PAUSED"],
  FINISHED: [],
  // Resolved by the engine back to `pausedFrom`; listed permissively here.
  PAUSED: [
    "LOBBY",
    "QUESTION_PREPARE",
    "QUESTION_ACTIVE",
    "QUESTION_ENDED",
    "ANSWER_REVEAL",
    "LEADERBOARD",
    "FINAL_RESULTS",
    "FINISHED",
  ],
};

export function canTransition(from: GameStatus, to: GameStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: GameStatus): readonly GameStatus[] {
  return TRANSITIONS[from];
}

export class InvalidTransitionError extends Error {
  readonly code = "INVALID_TRANSITION";
  constructor(
    readonly from: GameStatus,
    readonly to: GameStatus,
    hint?: string,
  ) {
    super(hint ?? `Cannot go from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

/** Human-readable guidance shown in the host toast when a command is rejected. */
const HINTS: Partial<Record<`${GameStatus}->${GameStatus}`, string>> = {
  "QUESTION_ACTIVE->ANSWER_REVEAL":
    "End the question before revealing the answer.",
  "LOBBY->QUESTION_ACTIVE": "Start the game first.",
  "LOBBY->ANSWER_REVEAL": "There is no question in play yet.",
  "QUESTION_PREPARE->ANSWER_REVEAL":
    "The question hasn't started yet — start it first.",
  "FINISHED->QUESTION_PREPARE": "This game has already finished.",
};

export function assertTransition(from: GameStatus, to: GameStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to, HINTS[`${from}->${to}`]);
  }
}

/** True for statuses where the question timer should be running. */
export function isQuestionLive(status: GameStatus): boolean {
  return status === "QUESTION_ACTIVE";
}

/** True once the correct answer may legally be sent to participants. */
export function isRevealed(status: GameStatus): boolean {
  return status === "ANSWER_REVEAL" || status === "LEADERBOARD" || status === "FINAL_RESULTS" || status === "FINISHED";
}

export const STATUS_LABELS: Record<GameStatus, string> = {
  LOBBY: "Lobby",
  QUESTION_PREPARE: "Get ready",
  QUESTION_ACTIVE: "Question live",
  QUESTION_ENDED: "Question closed",
  ANSWER_REVEAL: "Answer reveal",
  LEADERBOARD: "Leaderboard",
  FINAL_RESULTS: "Final results",
  FINISHED: "Finished",
  PAUSED: "Paused",
};
