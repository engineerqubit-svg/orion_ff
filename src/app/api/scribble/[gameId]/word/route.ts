import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { selectWord } from "@/lib/scribble/engine";
import { wordChoiceSchema } from "@/lib/scribble/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/** The drawer picks one of their three offered words. */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const input = wordChoiceSchema.parse(await readJson(request));
    await selectWord(gameId, input.playerId, input.playerToken, input.word);
    return ok({});
  } catch (error) {
    return fail(error);
  }
}
