import { z } from "zod";
import { ALLOWED_DURATIONS, GAME_MODES, QUESTION_MODES } from "@/types/quiz";

/**
 * Every request body crossing into the server is parsed here first. Client-side
 * forms reuse the same schemas so the rules can never drift apart.
 */

export const gamePinSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "A game PIN is exactly 6 digits.");

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Nicknames need at least 2 characters.")
  .max(20, "Nicknames can be at most 20 characters.")
  .regex(
    /^[\p{L}\p{N} ._'-]+$/u,
    "Use letters, numbers, spaces and . _ ' - only.",
  );

export const joinGameSchema = z.object({
  gamePin: gamePinSchema,
  nickname: nicknameSchema,
});
export type JoinGameInput = z.infer<typeof joinGameSchema>;

export const resumeSessionSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1),
  playerToken: z.string().min(1),
});
export type ResumeSessionInput = z.infer<typeof resumeSessionSchema>;

export const submitAnswerSchema = z.object({
  playerId: z.string().min(1),
  playerToken: z.string().min(1),
  questionId: z.string().min(1),
  answerId: z.string().min(1),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

/* ----------------------------------------------------------------- Quizzes */

export const answerDraftSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Every option needs text.").max(120),
});

export const questionDraftSchema = z
  .object({
    questionId: z.string().min(1),
    question: z.string().trim().min(1, "Add the question text.").max(300),
    // Accepts a full URL or a root-relative path, so images bundled under
    // /public work the same as ones hosted elsewhere.
    imageUrl: z
      .union([
        z.literal(""),
        z.string().trim().url("Enter a valid image URL."),
        z.string().trim().regex(/^\/[^\s]*$/, "Enter a URL or a path starting with /"),
      ])
      .optional(),
    // Plays on the host display only (see types/game.ts) — never sent to phones.
    videoUrl: z
      .union([z.literal(""), z.string().trim().url("Enter a valid YouTube URL.")])
      .optional(),
    answers: z.array(answerDraftSchema).length(4, "Provide exactly four options."),
    correctAnswerId: z.string().min(1, "Mark one option as correct."),
    durationSeconds: z
      .number()
      .refine(
        (value): value is (typeof ALLOWED_DURATIONS)[number] =>
          (ALLOWED_DURATIONS as readonly number[]).includes(value),
        "Pick one of the preset timer values.",
      ),
    mode: z.enum(QUESTION_MODES),
  })
  .refine((question) => question.answers.some((a) => a.id === question.correctAnswerId), {
    message: "The correct answer must be one of the four options.",
    path: ["correctAnswerId"],
  });

export const quizDraftSchema = z.object({
  title: z.string().trim().min(1, "Give the quiz a name.").max(80),
  description: z.string().trim().max(300).optional(),
  category: z.string().trim().max(40).optional(),
  gameMode: z.enum(GAME_MODES).default("QUIZ_BATTLE"),
  questions: z
    .array(questionDraftSchema)
    .min(1, "A quiz needs at least one question.")
    .max(60, "Keep quizzes to 60 questions or fewer."),
});
export type QuizDraftInput = z.infer<typeof quizDraftSchema>;

/* ------------------------------------------------------------------- Games */

export const createGameSchema = z.object({
  quizId: z.string().min(1),
});

const adjustmentAmountSchema = z
  .number()
  .int()
  .refine((value) => Math.abs(value) > 0 && Math.abs(value) <= 5000, {
    message: "Adjustments must be between 1 and 5000 points.",
  });

/**
 * Host control surface. Every button on the control bar maps to exactly one of
 * these, and the engine validates each against the state machine before acting.
 */
export const hostCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_GAME") }),
  z.object({ type: z.literal("START_QUESTION") }),
  z.object({ type: z.literal("END_QUESTION") }),
  z.object({ type: z.literal("REVEAL_ANSWER") }),
  z.object({ type: z.literal("SHOW_LEADERBOARD") }),
  z.object({ type: z.literal("NEXT_QUESTION") }),
  z.object({ type: z.literal("PREVIOUS_QUESTION") }),
  z.object({ type: z.literal("RESTART_QUESTION") }),
  z.object({ type: z.literal("PAUSE_GAME") }),
  z.object({ type: z.literal("RESUME_GAME") }),
  z.object({ type: z.literal("END_GAME") }),
  z.object({ type: z.literal("FINISH_GAME") }),
  z.object({ type: z.literal("KICK_PLAYER"), playerId: z.string().min(1) }),
  z.object({
    type: z.literal("ADJUST_POINTS"),
    playerId: z.string().min(1),
    amount: adjustmentAmountSchema,
    reason: z.string().trim().max(120).optional(),
  }),
]);
export type HostCommand = z.infer<typeof hostCommandSchema>;
export type HostCommandType = HostCommand["type"];

/* --------------------------------------------------------------- Transport */

export const clientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HEARTBEAT"),
    gameId: z.string().min(1),
    playerId: z.string().optional(),
    playerToken: z.string().optional(),
  }),
  z.object({
    type: z.literal("HELLO"),
    gameId: z.string().min(1),
    role: z.enum(["HOST", "PLAYER"]),
    playerId: z.string().optional(),
    playerToken: z.string().optional(),
  }),
]);

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your host password."),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** Flattens a ZodError into `{ fieldPath: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    result[path] ??= issue.message;
  }
  return result;
}
