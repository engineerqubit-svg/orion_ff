import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { buildStateSync, resumeSession } from "@/lib/game-engine/engine";
import { resumeSessionSchema } from "@/lib/validation/schemas";

/**
 * Restores a participant after a refresh or a dropped connection. The token is
 * validated server-side; a stale or forged one is rejected outright.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = resumeSessionSchema.parse(await readJson(request));
    const { game, player } = await resumeSession(input.gameId, input.playerId, input.playerToken);

    return ok({
      gameId: game.gameId,
      gamePin: game.gamePin,
      player: {
        playerId: player.playerId,
        nickname: player.nickname,
        score: player.score,
        streak: player.streak,
      },
      state: await buildStateSync(game.gameId),
    });
  } catch (error) {
    return fail(error);
  }
}
