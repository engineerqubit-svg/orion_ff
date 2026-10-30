import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { getHostView } from "@/lib/game-engine/engine";
import { GameError } from "@/lib/game-engine/errors";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Host-only view of a game. This is the one endpoint that returns the correct
 * answer, and it is gated on the host session — participants have no route to it.
 */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  try {
    const session = await requireHost();
    const { gameId } = await context.params;
    const view = await getHostView(gameId);
    if (view.game.hostId !== session.hostId) throw new GameError("UNAUTHORISED");
    return ok({ view });
  } catch (error) {
    return fail(error);
  }
}
