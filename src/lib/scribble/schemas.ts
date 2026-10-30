import { z } from "zod";
import { ROUND_DURATIONS } from "@/types/scribble";

/** Request validation for every Scribble endpoint. */

const identity = {
  playerId: z.string().min(1),
  playerToken: z.string().min(1),
};

export const scribbleViewSchema = z.object({
  playerId: z.string().min(1).optional(),
  playerToken: z.string().min(1).optional(),
  /** Full drawing — only wanted on first load and after a reconnect. */
  includeStrokes: z.boolean().optional(),
});

export const pointSchema = z.object({
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
});

export const strokeSchema = z.object({
  ...identity,
  id: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value."),
  width: z.number().min(1).max(48),
  erase: z.boolean().optional(),
  // One flush of a drag; the client batches roughly every 120ms.
  points: z.array(pointSchema).min(1).max(400),
});

export const canvasActionSchema = z.object({
  ...identity,
  action: z.enum(["CLEAR", "UNDO"]),
  strokeId: z.string().min(1).optional(),
});

export const guessSchema = z.object({
  ...identity,
  guess: z.string().trim().min(1).max(60),
});

export const wordChoiceSchema = z.object({
  ...identity,
  word: z.string().min(1).max(60),
});

export const scribbleCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_GAME") }),
  z.object({ type: z.literal("SHOW_TUTORIAL") }),
  z.object({ type: z.literal("BACK_TO_LOBBY") }),
  z.object({ type: z.literal("START_PRACTICE") }),
  z.object({ type: z.literal("END_ROUND") }),
  z.object({ type: z.literal("NEXT_ROUND") }),
  z.object({ type: z.literal("SHOW_LEADERBOARD") }),
  z.object({ type: z.literal("PASS_DRAWER") }),
  z.object({ type: z.literal("CHOOSE_DRAWER"), playerId: z.string().min(1) }),
  z.object({
    type: z.literal("SET_DURATION"),
    durationSeconds: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  }),
  z.object({ type: z.literal("SET_TOTAL_ROUNDS"), totalRounds: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal("PAUSE_GAME") }),
  z.object({ type: z.literal("RESUME_GAME") }),
  z.object({ type: z.literal("END_GAME") }),
]);

export const ROUND_DURATION_VALUES = ROUND_DURATIONS;
