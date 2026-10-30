import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { submitGuess } from "@/lib/scribble/engine";
import { guessSchema } from "@/lib/scribble/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Guess submission. The response is private to the guesser — a correct guess
 * returns the word and the points, a wrong one returns nothing that could be
 * used to narrow the answer down.
 */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const input = guessSchema.parse(await readJson(request));
    const result = await submitGuess(gameId, input.playerId, input.playerToken, input.guess);
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
}
