import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import { ensureSeedData } from "@/lib/dynamodb";
import { findGameByPin } from "@/lib/game-engine/engine";
import { GameError } from "@/lib/game-engine/errors";
import { gamePinSchema } from "@/lib/validation/schemas";

interface Context {
  params: Promise<{ gamePin: string }>;
}

/**
 * Public PIN lookup used by the join screen. Returns only what a prospective
 * player needs to know — no quiz content, no player list.
 */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  try {
    await ensureSeedData();
    const { gamePin } = await context.params;
    const game = await findGameByPin(gamePinSchema.parse(gamePin));

    if (game.status === "FINISHED") throw new GameError("GAME_FINISHED");
    if (game.status !== "LOBBY") throw new GameError("GAME_ALREADY_STARTED");

    return ok({ gameId: game.gameId, gamePin: game.gamePin, status: game.status });
  } catch (error) {
    return fail(error);
  }
}
