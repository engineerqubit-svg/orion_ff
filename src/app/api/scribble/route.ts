import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { getStore } from "@/lib/dynamodb";
import { createScribbleGame } from "@/lib/scribble/engine";

/** Lists the host's Scribble games, newest first. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireHost();
    const games = await getStore().listGames(20);
    return ok({
      games: games.filter((g) => g.gameMode === "SCRIBBLE" && g.hostId === session.hostId),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const session = await requireHost();
    const game = await createScribbleGame(session.hostId);
    return ok({ game }, 201);
  } catch (error) {
    return fail(error);
  }
}
