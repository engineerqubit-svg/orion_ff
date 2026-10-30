import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { recordHeartbeat } from "@/lib/game-engine/engine";
import { clientEventSchema } from "@/lib/validation/schemas";

/**
 * Upstream half of the local transport. Presence only — no state-changing action
 * is accepted here, which keeps the realtime channel impossible to abuse.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const event = clientEventSchema.parse(await readJson(request));
    if (event.playerId && event.playerToken) {
      await recordHeartbeat(event.gameId, event.playerId, event.playerToken);
    }
    return ok({});
  } catch (error) {
    return fail(error);
  }
}
