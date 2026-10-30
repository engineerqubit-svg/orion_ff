"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Loader2, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { ConnectionBadge } from "@/components/arena/connection-badge";
import { HostControlBar } from "@/components/host/control-bar";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useHostGameView } from "@/hooks/use-host-game-view";
import { STATUS_LABELS } from "@/lib/game-engine/state-machine";
import { formatGamePin } from "@/lib/ids";
import type { HostGameView } from "@/lib/game-engine/engine";
import type { HostCommand } from "@/lib/validation/schemas";

/**
 * The host's own control panel — meant for your phone, not the projector.
 * Open `/host/game/[gameId]` on the TV/laptop that's actually cast or
 * plugged in; run the game from here instead. Deliberately plain: a status
 * readout plus the same control bar, no projector-sized staging.
 */
export function ControlClient({ gameId, gamePin }: { gameId: string; gamePin: string }) {
  const [busy, setBusy] = useState(false);
  const { view, connection } = useHostGameView(gameId);

  const runCommand = useCallback(
    async (command: HostCommand) => {
      setBusy(true);
      try {
        // The realtime subscription (shared with every other screen watching
        // this game) brings the update back — no need to apply the response here.
        await apiFetch<{ view: HostGameView }>(`/api/games/${gameId}/control`, {
          method: "POST",
          json: command,
        });
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "That action didn't go through.");
      } finally {
        setBusy(false);
      }
    },
    [gameId],
  );

  if (!view) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <Loader2 className="relative z-10 size-7 animate-spin text-ink-500" aria-hidden />
      </main>
    );
  }

  const { status } = view.game;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <ArenaBackground />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5">
        <BrandMark size="sm" />
        <ConnectionBadge status={connection} />
      </header>

      <div className="relative z-10 flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">
        <div className="panel rounded-xl2 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
              {STATUS_LABELS[status]}
            </span>
            <span className="tabular text-sm text-ink-400">
              {view.players.length} player{view.players.length === 1 ? "" : "s"}
            </span>
          </div>

          {status === "LOBBY" ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">Game PIN</p>
              <p className="mt-1 font-display text-4xl font-extrabold tabular brand-gradient-text">
                {formatGamePin(gamePin)}
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <a href={`/host/game/${gameId}`} target="_blank" rel="noreferrer">
                  <MonitorPlay aria-hidden /> Open projector display
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-ink-400">
                Question {view.game.currentQuestionIndex + 1} / {view.quiz.questionCount}
              </p>
              {view.question ? (
                <p className="mt-1 text-sm leading-snug text-ink-100">{view.question.question}</p>
              ) : null}
              {status === "QUESTION_ACTIVE" || status === "QUESTION_ENDED" ? (
                <p className="mt-2 tabular text-sm text-ink-400">
                  {view.answeredCount} / {view.players.length} answered
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <HostControlBar view={view} busy={busy} onCommand={runCommand} />
    </main>
  );
}
