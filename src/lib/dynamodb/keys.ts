/**
 * Single-table key layout.
 *
 *  PK                 SK                              Entity
 *  ------------------ ------------------------------- ---------------------------
 *  QUIZ#<quizId>      META                            Quiz
 *  QUIZ#<quizId>      Q#<order>#<questionId>          Question
 *  GAME#<gameId>      META                            GameSession
 *  GAME#<gameId>      PLAYER#<playerId>               Player
 *  GAME#<gameId>      NICK#<normalised nickname>      Nickname reservation
 *  GAME#<gameId>      ANS#<questionId>#<playerId>     PlayerAnswer
 *  GAME#<gameId>      ADJ#<createdAt>#<adjustmentId>  PointAdjustment
 *  PIN#<gamePin>      GAME                            PIN -> gameId pointer
 *
 *  GSI1 (GSI1PK / GSI1SK) backs the two "list newest first" reads:
 *  TYPE#QUIZ / <updatedAt>  and  TYPE#GAME / <createdAt>.
 */

export const GSI1 = "GSI1" as const;

export const pk = {
  quiz: (quizId: string) => `QUIZ#${quizId}`,
  game: (gameId: string) => `GAME#${gameId}`,
  pin: (gamePin: string) => `PIN#${gamePin}`,
} as const;

export const sk = {
  meta: "META",
  question: (order: number, questionId: string) =>
    `Q#${String(order).padStart(4, "0")}#${questionId}`,
  questionPrefix: "Q#",
  player: (playerId: string) => `PLAYER#${playerId}`,
  playerPrefix: "PLAYER#",
  nickname: (normalised: string) => `NICK#${normalised}`,
  answer: (questionId: string, playerId: string) => `ANS#${questionId}#${playerId}`,
  answerPrefix: "ANS#",
  answerQuestionPrefix: (questionId: string) => `ANS#${questionId}#`,
  adjustment: (createdAt: string, adjustmentId: string) => `ADJ#${createdAt}#${adjustmentId}`,
  adjustmentPrefix: "ADJ#",
  pinPointer: "GAME",
} as const;

export const gsi1 = {
  quizList: "TYPE#QUIZ",
  gameList: "TYPE#GAME",
} as const;

export interface KeyedItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  entity: string;
}
