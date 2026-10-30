"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api/client";
import { formatGamePin } from "@/lib/ids";
import { formatDateTime } from "@/lib/utils";

interface LiveGame {
  gameId: string;
  gamePin: string;
  createdAt: string;
}

export function ScribbleLauncher({ liveGames }: { liveGames: LiveGame[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createGame() {
    setCreating(true);
    try {
      const response = await apiFetch<{ game: { gameId: string } }>("/api/scribble", {
        method: "POST",
      });
      router.push(`/admin/scribble/${response.game.gameId}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't start Scribble.");
      setCreating(false);
    }
  }

  return (
    <main className="relative min-h-dvh">
      <ArenaBackground dense />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <BrandMark size="sm" href="/host" />

        <div className="mt-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-aqua-500/40 bg-aqua-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-aqua-400">
            <Pencil className="size-3.5" aria-hidden /> Scribble
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold uppercase brand-gradient-text sm:text-6xl">
            One draws.
            <br />
            Everyone guesses.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-ink-400">
            A random player gets a secret word and 60 seconds. Everybody else races
            to guess it from their own screen.
          </p>

          <Button size="xl" className="mt-8" onClick={() => void createGame()} loading={creating}>
            <Plus aria-hidden /> New Scribble Game
          </Button>
        </div>

        {liveGames.length > 0 ? (
          <section className="mt-12 space-y-3">
            <h2 className="font-display text-lg font-semibold">Games in progress</h2>
            {liveGames.map((game) => (
              <Card key={game.gameId}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-display text-2xl font-bold tabular">
                      {formatGamePin(game.gamePin)}
                    </p>
                    <p className="text-xs text-ink-500">
                      Started {formatDateTime(game.createdAt)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/admin/scribble/${game.gameId}`}>
                      Resume <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
