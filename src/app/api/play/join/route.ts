import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { ensureSeedData } from "@/lib/dynamodb";
import { joinGame } from "@/lib/game-engine/engine";
import { joinGameSchema } from "@/lib/validation/schemas";

/**
 * Participant join. No authentication — a PIN and a nickname is the whole ceremony.
 * The returned token is the player's credential for every later request.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await ensureSeedData();
    const input = joinGameSchema.parse(await readJson(request));
    const { game, player } = await joinGame(input);

    return ok(
      {
        gameId: game.gameId,
        gamePin: game.gamePin,
        playerId: player.playerId,
        playerToken: player.token,
        nickname: player.nickname,
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
