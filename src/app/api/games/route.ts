import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import { createGame } from "@/lib/game-engine/engine";
import { createGameSchema } from "@/lib/validation/schemas";
import type { GameSummary } from "@/types/game";

/** Recent games for the host dashboard table. */
export async function GET(): Promise<NextResponse> {
  try {
    await requireHost();
    const store = getStore();
    const games = await store.listGames(20);

    const summaries: GameSummary[] = await Promise.all(
      games.map(async (game) => {
        const [quiz, players] = await Promise.all([
          store.getQuiz(game.quizId),
          store.listPlayers(game.gameId),
        ]);
        const winner = [...players].sort((a, b) => b.score - a.score)[0];

        return {
          gameId: game.gameId,
          gamePin: game.gamePin,
          quizId: game.quizId,
          quizTitle: quiz?.title ?? (game.gameMode === "SCRIBBLE" ? "Scribble" : "Deleted quiz"),
          status: game.status,
          playerCount: players.length,
          questionCount: quiz?.questions.length ?? 0,
          winner: game.status === "FINISHED" || game.status === "FINAL_RESULTS"
            ? winner?.nickname
            : undefined,
          createdAt: game.createdAt,
          finishedAt: game.finishedAt,
        };
      }),
    );

    return ok({ games: summaries });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireHost();
    await ensureSeedData();
    const { quizId } = createGameSchema.parse(await readJson(request));
    const game = await createGame(quizId, session.hostId);
    return ok({ game }, 201);
  } catch (error) {
    return fail(error);
  }
}
