import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import type { GameSummary } from "@/types/game";

/** Aggregates the dashboard cards and the recent-games table in one round trip. */
export async function GET(): Promise<NextResponse> {
  try {
    await requireHost();
    await ensureSeedData();

    const store = getStore();
    const [quizzes, games] = await Promise.all([store.listQuizzes(), store.listGames(20)]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let playersToday = 0;
    const recentGames: GameSummary[] = [];

    for (const game of games) {
      const players = await store.listPlayers(game.gameId);
      if (new Date(game.createdAt) >= startOfToday) playersToday += players.length;

      const quiz = quizzes.find((q) => q.quizId === game.quizId);
      const winner = [...players].sort((a, b) => b.score - a.score)[0];
      const complete = game.status === "FINISHED" || game.status === "FINAL_RESULTS";

      recentGames.push({
        gameId: game.gameId,
        gamePin: game.gamePin,
        quizId: game.quizId,
        quizTitle: quiz?.title ?? (game.gameMode === "SCRIBBLE" ? "Scribble" : "Deleted quiz"),
        status: game.status,
        playerCount: players.length,
        questionCount: quiz?.questionCount ?? 0,
        winner: complete ? winner?.nickname : undefined,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
      });
    }

    return ok({
      stats: {
        quizCount: quizzes.length,
        gamesPlayed: games.filter((g) => g.status === "FINISHED").length,
        playersToday,
        liveGames: games.filter(
          (g) => g.status !== "FINISHED" && new Date(g.createdAt) >= startOfToday,
        ).length,
      },
      quizzes,
      recentGames,
    });
  } catch (error) {
    return fail(error);
  }
}
