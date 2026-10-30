"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlameGlyph } from "@/components/arena/icons";
import { GameModePicker } from "@/components/host/game-mode-picker";
import { ApiError, apiFetch } from "@/lib/api/client";
import { STATUS_LABELS } from "@/lib/game-engine/state-machine";
import { cn, formatDateTime, formatScore } from "@/lib/utils";
import { formatGamePin } from "@/lib/ids";
import type { GameSummary } from "@/types/game";
import type { QuizSummary } from "@/types/quiz";

interface DashboardData {
  stats: { quizCount: number; gamesPlayed: number; playersToday: number; liveGames: number };
  quizzes: QuizSummary[];
  recentGames: GameSummary[];
}

export function HostDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/api/host/dashboard")
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof ApiError ? caught.message : "Couldn't load the dashboard."),
      );
  }, []);

  async function hostGame(quizId: string) {
    setStartingQuizId(quizId);
    try {
      const response = await apiFetch<{ game: { gameId: string } }>("/api/games", {
        method: "POST",
        json: { quizId },
      });
      router.push(`/host/game/${response.game.gameId}/control`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Couldn't start that game.");
      setStartingQuizId(null);
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-pulse-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-500" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Diwali control room</h1>
          <p className="mt-1 text-sm text-ink-400">
            Build a quiz, get a PIN on the big screen, and let the party fight it out.
          </p>
        </div>
        <span className="tag-flag panel hidden items-center gap-1.5 py-1.5 pl-3 pr-5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-300 sm:inline-flex">
          <FlameGlyph className="size-3 text-brand-500" aria-hidden />
          Night of the party
        </span>
      </div>

      <GameModePicker />

      <ScoreStrip stats={data.stats} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Start a quiz game</h2>
          <Button size="sm" variant="outline" asChild>
            <Link href="/host/quizzes/new">
              <Plus aria-hidden /> Create Quiz
            </Link>
          </Button>
        </div>

        {data.quizzes.length === 0 ? (
          <EmptyState
            title="No quizzes yet"
            body="Create your first quiz and it will show up here, ready to host."
            action={
              <Button asChild>
                <Link href="/host/quizzes/new">
                  <Plus aria-hidden /> Create Quiz
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.quizzes.map((quiz) => (
              <Card key={quiz.quizId} className="flex flex-col justify-between">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-ink-100">{quiz.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-400">
                        {quiz.description ?? "No description"}
                      </p>
                    </div>
                    <Badge tone="brand">{quiz.questionCount} Qs</Badge>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void hostGame(quiz.quizId)}
                      loading={startingQuizId === quiz.quizId}
                      disabled={quiz.questionCount === 0}
                    >
                      <Play aria-hidden /> Host
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/host/quizzes/${quiz.quizId}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent games</h2>
        {data.recentGames.length === 0 ? (
          <EmptyState title="No games yet" body="Your hosted games will be listed here." />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-ink-600/50 text-xs uppercase tracking-wider text-ink-400">
                  <tr>
                    {["Quiz", "Date", "Players", "Questions", "Winner", "Status"].map((heading) => (
                      <th key={heading} className="px-5 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.recentGames.map((game) => (
                    <tr key={game.gameId} className="border-b border-ink-700/40 last:border-0">
                      <td className="px-5 py-3">
                        <span className="font-medium text-ink-100">{game.quizTitle}</span>
                        <span className="ml-2 tabular text-xs text-ink-500">
                          {formatGamePin(game.gamePin)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-300">{formatDateTime(game.createdAt)}</td>
                      <td className="px-5 py-3 tabular text-ink-300">{game.playerCount}</td>
                      <td className="px-5 py-3 tabular text-ink-300">{game.questionCount}</td>
                      <td className="px-5 py-3 text-ink-300">{game.winner ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge tone={game.status === "FINISHED" ? "neutral" : "aqua"}>
                          {STATUS_LABELS[game.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {game.status !== "FINISHED" ? (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/host/game/${game.gameId}/control`}>Resume</Link>
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

/** One perforated strip instead of four repeated icon-chip cards. */
function ScoreStrip({
  stats,
}: {
  stats: { quizCount: number; gamesPlayed: number; playersToday: number; liveGames: number };
}) {
  const entries = [
    { label: "My Quizzes", value: stats.quizCount, border: "border-b border-r sm:border-b-0 sm:border-r" },
    { label: "Games Played", value: stats.gamesPlayed, border: "border-b sm:border-b-0 sm:border-r" },
    { label: "Players Today", value: stats.playersToday, border: "border-r" },
    { label: "Live Today", value: stats.liveGames, border: "" },
  ];

  return (
    <div className="panel grid grid-cols-2 rounded-xl2 sm:grid-cols-4">
      {entries.map((entry) => (
        <div key={entry.label} className={cn("border-dashed border-ink-500/30 px-5 py-4", entry.border)}>
          <p className="font-display text-3xl font-bold tabular text-ink-100">
            {formatScore(entry.value)}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
            {entry.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <h3 className="font-display text-lg font-semibold text-ink-200">{title}</h3>
        <p className="max-w-sm text-sm text-ink-400">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}
