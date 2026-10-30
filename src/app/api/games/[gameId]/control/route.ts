import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { executeHostCommand, getHostView } from "@/lib/game-engine/engine";
import { GameError } from "@/lib/game-engine/errors";
import { getStore } from "@/lib/dynamodb";
import { hostCommandSchema } from "@/lib/validation/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/** Every host control-bar button lands here. The engine validates the transition. */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const session = await requireHost();
    const { gameId } = await context.params;

    const game = await getStore().getGame(gameId);
    if (!game) throw new GameError("GAME_NOT_FOUND");
    if (game.hostId !== session.hostId) throw new GameError("UNAUTHORISED");

    const command = hostCommandSchema.parse(await readJson(request));
    await executeHostCommand(gameId, session.hostId, command);

    return ok({ view: await getHostView(gameId) });
  } catch (error) {
    return fail(error);
  }
}
