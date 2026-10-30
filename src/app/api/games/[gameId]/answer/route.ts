import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { submitAnswer } from "@/lib/game-engine/engine";
import { submitAnswerSchema } from "@/lib/validation/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Participant answer submission.
 *
 * The body carries only the chosen answer id plus the player's session token.
 * Response time, correctness and points are all decided server-side; the response
 * deliberately reports the measured time but NOT whether it was right.
 */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const input = submitAnswerSchema.parse(await readJson(request));
    const result = await submitAnswer(gameId, input);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
