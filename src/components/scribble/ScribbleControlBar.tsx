"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Download,
  Dumbbell,
  Flag,
  LogOut,
  Undo2,
  Pause,
  Play,
  Settings,
  SkipForward,
  Square,
  Trophy,
  UserCog,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScribbleCommand } from "@/lib/scribble/engine";
import { cn, formatScore } from "@/lib/utils";
import { ROUND_DURATIONS, type RoundDuration, type ScribbleAdminView } from "@/types/scribble";

const STATUS_LABELS: Record<ScribbleAdminView["status"], string> = {
  LOBBY: "Lobby",
  TUTORIAL: "How to play",
  DRAWER_ANNOUNCE: "Choosing drawer",
  WORD_SELECT: "Picking a word",
  COUNTDOWN: "Get ready",
  DRAWING: "Round live",
  ROUND_END: "Round over",
  LEADERBOARD: "Leaderboard",
  FINISHED: "Finished",
  PAUSED: "Paused",
};

interface Props {
  view: ScribbleAdminView;
  busy: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onCommand: (command: ScribbleCommand) => void;
}

/**
 * Host controls. Settings live in a drawer rather than on the bar, so the
 * projector shows the game and nothing else while a round is running.
 */
export function ScribbleControlBar({ view, busy, muted, onToggleMute, onCommand }: Props) {
  const [panel, setPanel] = useState<"none" | "players" | "settings">("none");
  const { status } = view;

  const primary = (() => {
    // After a practice round the only way on is the real game.
    if (view.practice && status === "ROUND_END") {
      return {
        label: "Start Real Game",
        icon: Play,
        command: { type: "START_GAME" } as const,
        hint: "Practice round — no points were counted",
      };
    }

    switch (status) {
      case "LOBBY":
      case "TUTORIAL":
        return {
          label: "Start Scribble",
          icon: Play,
          command: { type: "START_GAME" } as const,
          disabled: view.players.length < 2,
          hint: view.players.length < 2 ? "Needs at least two players" : undefined,
        };
      case "DRAWING":
        return { label: "End Round", icon: Square, command: { type: "END_ROUND" } as const };
      case "ROUND_END":
        // Final rounds are played blind: straight on, no leaderboard.
        if (view.standingsHidden) {
          const last = view.roundNumber >= view.totalRounds;
          return {
            label: last ? "Reveal Winner" : "Next Round",
            icon: last ? Flag : SkipForward,
            command: { type: "NEXT_ROUND" } as const,
            hint: "Leaderboard hidden for the final rounds",
          };
        }
        return {
          label: "Show Leaderboard",
          icon: Trophy,
          command: { type: "SHOW_LEADERBOARD" } as const,
        };
      case "LEADERBOARD":
        return {
          label: view.roundNumber >= view.totalRounds ? "Finish Game" : "Next Round",
          icon: view.roundNumber >= view.totalRounds ? Flag : SkipForward,
          command: { type: "NEXT_ROUND" } as const,
        };
      case "PAUSED":
        return { label: "Resume", icon: Play, command: { type: "RESUME_GAME" } as const };
      default:
        return null;
    }
  })();

  const canPass =
    status === "DRAWER_ANNOUNCE" || status === "WORD_SELECT" || status === "COUNTDOWN";
  const preGame =
    status === "LOBBY" || status === "TUTORIAL" || (view.practice && status === "ROUND_END");
  const enoughPlayers = view.players.length >= 2;
  const exportHref = (format: "results" | "guesses" | "json") =>
    `/api/scribble/${view.gameId}/export?format=${format}`;

  return (
    <>
      <AnimatePresence>
        {panel !== "none" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative z-20 mx-auto w-full max-w-5xl px-6 pb-3"
          >
            <div className="glass-strong max-h-[42vh] overflow-y-auto rounded-2xl p-4">
              {panel === "players" ? (
                <>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                    Choose the next drawer
                  </h3>
                  {view.players.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-500">No players yet.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {view.players.map((player) => (
                        <li key={player.playerId}>
                          <button
                            type="button"
                            onClick={() => {
                              onCommand({ type: "CHOOSE_DRAWER", playerId: player.playerId });
                              setPanel("none");
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                              view.previousDrawers.includes(player.playerId)
                                ? "border-ink-700/60 bg-ink-900/40 text-ink-400"
                                : "border-ink-600/50 bg-ink-900/50 text-ink-100 active:border-brand-500/60",
                            )}
                          >
                            <span className="truncate font-semibold">{player.nickname}</span>
                            {view.standingsHidden ? null : (
                              <span className="tabular text-xs text-aqua-400">
                                {formatScore(player.score)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-ink-500">
                    Dimmed names have already drawn this game.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                    Round settings
                  </h3>

                  <p className="mb-2 text-xs text-ink-400">Round duration</p>
                  <div className="flex gap-2">
                    {ROUND_DURATIONS.map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() =>
                          onCommand({
                            type: "SET_DURATION",
                            durationSeconds: seconds as RoundDuration,
                          })
                        }
                        aria-pressed={view.durationSeconds === seconds}
                        className={cn(
                          "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                          view.durationSeconds === seconds
                            ? "border-brand-500/70 bg-brand-500/15 text-brand-400"
                            : "border-ink-600/60 text-ink-300 active:border-ink-500",
                        )}
                      >
                        {seconds} sec
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 mt-5 text-xs text-ink-400">
                    Total rounds — {view.totalRounds}
                  </p>
                  <div className="flex gap-2">
                    {[4, 6, 8, 12].map((rounds) => (
                      <button
                        key={rounds}
                        type="button"
                        onClick={() => onCommand({ type: "SET_TOTAL_ROUNDS", totalRounds: rounds })}
                        aria-pressed={view.totalRounds === rounds}
                        className={cn(
                          "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                          view.totalRounds === rounds
                            ? "border-brand-500/70 bg-brand-500/15 text-brand-400"
                            : "border-ink-600/60 text-ink-300 active:border-ink-500",
                        )}
                      >
                        {rounds}
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-ink-500">
                    Duration applies from the next round onwards.
                  </p>

                  <p className="mb-2 mt-5 text-xs text-ink-400">
                    Download data — also auto-saved to .data/scribble after every round
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["results", "Results (CSV)"],
                        ["guesses", "All guesses (CSV)"],
                        ["json", "Everything (JSON)"],
                      ] as const
                    ).map(([format, label]) => (
                      <a
                        key={format}
                        href={exportHref(format)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-ink-600/60 px-3 py-2 text-sm font-semibold text-ink-300 active:border-ink-500"
                      >
                        <Download className="size-4" aria-hidden /> {label}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-20 border-t border-ink-600/50 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
              {STATUS_LABELS[status]}
            </span>
            {primary?.hint ? <span className="text-xs text-ink-500">{primary.hint}</span> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {preGame && status !== "TUTORIAL" && !view.practice ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCommand({ type: "SHOW_TUTORIAL" })}
                disabled={busy}
              >
                <BookOpen aria-hidden /> How to Play
              </Button>
            ) : null}
            {status === "TUTORIAL" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCommand({ type: "BACK_TO_LOBBY" })}
                disabled={busy}
              >
                <Undo2 aria-hidden /> Back to Lobby
              </Button>
            ) : null}
            {preGame ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCommand({ type: "START_PRACTICE" })}
                disabled={busy || !enoughPlayers}
                title="One full round that doesn't count towards scores"
              >
                <Dumbbell aria-hidden /> {view.practice ? "Practice Again" : "Practice Round"}
              </Button>
            ) : null}

            {canPass ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCommand({ type: "PASS_DRAWER" })}
                disabled={busy}
                title="Pick somebody else to draw"
              >
                <SkipForward aria-hidden /> Skip drawer
              </Button>
            ) : null}

            {status !== "FINISHED" ? (
              <>
                <Button
                  size="sm"
                  variant={panel === "players" ? "outline" : "ghost"}
                  onClick={() => setPanel(panel === "players" ? "none" : "players")}
                  disabled={busy}
                  aria-expanded={panel === "players"}
                >
                  <UserCog aria-hidden /> Choose Drawer
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onCommand({ type: status === "PAUSED" ? "RESUME_GAME" : "PAUSE_GAME" })
                  }
                  disabled={busy || status === "LOBBY"}
                >
                  {status === "PAUSED" ? <Play aria-hidden /> : <Pause aria-hidden />}
                  {status === "PAUSED" ? "Resume" : "Pause"}
                </Button>

                <Button
                  size="sm"
                  variant={panel === "settings" ? "outline" : "ghost"}
                  onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
                  aria-expanded={panel === "settings"}
                  aria-label="Round settings"
                >
                  <Settings aria-hidden /> Settings
                </Button>
              </>
            ) : null}

            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleMute}
              aria-label={muted ? "Unmute sound" : "Mute sound"}
            >
              {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </Button>

            {status !== "FINISHED" ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  // One stray click here ends the game for the whole room.
                  if (window.confirm("End the game now and show the final results to everyone?")) {
                    onCommand({ type: "END_GAME" });
                  }
                }}
                disabled={busy}
              >
                <Flag aria-hidden /> End Game
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <a href={exportHref("results")}>
                    <Download aria-hidden /> Results CSV
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={exportHref("json")}>
                    <Download aria-hidden /> Full data
                  </a>
                </Button>
                <Button size="lg" asChild className="min-w-52">
                  <Link href="/host">
                    <LogOut aria-hidden /> Exit to Dashboard
                  </Link>
                </Button>
              </>
            )}

            {primary ? (
              <Button
                size="lg"
                onClick={() => onCommand(primary.command)}
                disabled={busy || primary.disabled}
                loading={busy}
                className="min-w-52"
              >
                <primary.icon aria-hidden />
                {primary.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
