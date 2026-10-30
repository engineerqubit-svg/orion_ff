import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { getStore } from "@/lib/dynamodb";
import { GameError } from "@/lib/game-engine/errors";
import { getPlayerView } from "@/lib/scribble/engine";
import { scribbleViewSchema } from "@/lib/scribble/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Participant view. POST rather than GET so the session token stays out of URLs,
 * logs and referrers. The word is only included for the authenticated drawer.
 */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const input = scribbleViewSchema.parse(await readJson(request));

    // An unverified playerId must never be enough to be treated as the drawer.
    if (input.playerId) {
      const player = await getStore().getPlayer(gameId, input.playerId);
      if (!player || player.token !== input.playerToken) throw new GameError("INVALID_TOKEN");
      if (player.kicked) throw new GameError("PLAYER_KICKED");
    }

    return ok({ view: await getPlayerView(gameId, input.playerId, input.includeStrokes) });
  } catch (error) {
    return fail(error);
  }
}
