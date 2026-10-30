"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trophy,
  UserCog,
  UserX,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/game-engine/state-machine";
import type { HostGameView } from "@/lib/game-engine/engine";
import type { HostCommand } from "@/lib/validation/schemas";
import { cn, formatDateTime, formatScore } from "@/lib/utils";

const AWARD_STEPS = [100, 250, 500] as const;

interface Props {
  view: HostGameView;
  busy: boolean;
  /** Omit on screens that don't own sound (e.g. the control panel — sound plays from the display). */
  muted?: boolean;
  onToggleMute?: () => void;
  onCommand: (command: HostCommand) => void;
}

/**
 * Persistent host control bar.
 *
 * Buttons are enabled strictly by the game's current state, mirroring the server
 * state machine — so the host is never offered an action the engine would reject.
 */
export function HostControlBar({ view, busy, muted, onToggleMute, onCommand }: Props) {
  const [panel, setPanel] = useState<"none" | "players">("none");
  const { status } = view.game;

  const isLast = view.game.currentQuestionIndex >= view.quiz.questionCount - 1;
  const noPlayers = view.players.length === 0;

  const primary = (() => {
    switch (status) {
      case "LOBBY":
        return {
          label: "Start Game",
          icon: Play,
          command: { type: "START_GAME" } as const,
          disabled: noPlayers,
          hint: noPlayers ? "Waiting for players to join" : undefined,
        };
      case "QUESTION_PREPARE":
        return { label: "Start Question", icon: Play, command: { type: "START_QUESTION" } as const };
      case "QUESTION_ACTIVE":
        return { label: "End Question", icon: Square, command: { type: "END_QUESTION" } as const };
      case "QUESTION_ENDED":
        return { label: "Reveal Answer", icon: Eye, command: { type: "REVEAL_ANSWER" } as const };
      case "ANSWER_REVEAL":
        return {
          label: "Show Leaderboard",
          icon: Trophy,
          command: { type: "SHOW_LEADERBOARD" } as const,
        };
      case "LEADERBOARD":
        return {
          label: isLast ? "Final Results" : "Next Question",
          icon: isLast ? Flag : ChevronRight,
          command: { type: "NEXT_QUESTION" } as const,
        };
      case "FINAL_RESULTS":
        return { label: "Close Game", icon: Flag, command: { type: "FINISH_GAME" } as const };
      case "PAUSED":
        return { label: "Resume Game", icon: Play, command: { type: "RESUME_GAME" } as const };
      default:
        return null;
    }
  })();

  const canStep = status !== "LOBBY" && status !== "FINISHED" && status !== "FINAL_RESULTS";

  return (
    <>
      <AnimatePresence>
        {panel === "players" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative z-20 mx-auto w-full max-w-5xl px-6 pb-3"
          >
            <div className="glass-strong max-h-[42vh] overflow-y-auto rounded-2xl p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                Players — award, deduct or remove
              </h3>

              {view.players.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">No players yet.</p>
              ) : (
                <ul className="space-y-2">
                  {view.players.map((player) => (
                    <li
                      key={player.playerId}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600/50 bg-ink-900/50 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-100">
                        {player.nickname}
                        {!player.connected ? (
                          <span className="ml-2 text-xs text-ink-500">offline</span>
                        ) : null}
                      </span>
                      <span className="tabular text-sm text-aqua-400">
                        {formatScore(player.score)}
                      </span>

                      <div className="flex gap-1">
                        {AWARD_STEPS.map((amount) => (
                          <button
                            key={`plus-${amount}`}
                            type="button"
                            onClick={() =>
                              onCommand({ type: "ADJUST_POINTS", playerId: player.playerId, amount })
                            }
                            className="rounded-lg border border-lime-500/40 bg-lime-500/10 px-2 py-1 text-xs font-semibold text-lime-500 active:bg-lime-500/20"
                          >
                            +{amount}
                          </button>
                        ))}
                        {AWARD_STEPS.map((amount) => (
                          <button
                            key={`minus-${amount}`}
                            type="button"
                            onClick={() =>
                              onCommand({
                                type: "ADJUST_POINTS",
                                playerId: player.playerId,
                                amount: -amount,
                              })
                            }
                            className="rounded-lg border border-pulse-500/40 bg-pulse-500/10 px-2 py-1 text-xs font-semibold text-pulse-500 active:bg-pulse-500/20"
                          >
                            −{amount}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            onCommand({ type: "KICK_PLAYER", playerId: player.playerId })
                          }
                          aria-label={`Remove ${player.nickname}`}
                          className="rounded-lg border border-ink-500/50 px-2 py-1 text-ink-400 active:bg-pulse-500/15 active:text-pulse-500"
                        >
                          <UserX className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {view.adjustments.length > 0 ? (
                <div className="mt-4 border-t border-ink-600/50 pt-3">
                  <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-500">
                    Manual adjustments
                  </h4>
                  <ul className="mt-2 space-y-1 text-xs text-ink-400">
                    {view.adjustments
                      .slice(-6)
                      .reverse()
                      .map((adjustment) => (
                        <li key={adjustment.adjustmentId} className="tabular">
                          {formatDateTime(adjustment.createdAt)} · {adjustment.nickname} ·{" "}
                          <span
                            className={
                              adjustment.amount >= 0 ? "text-lime-500" : "text-pulse-500"
                            }
                          >
                            {adjustment.amount >= 0 ? "+" : ""}
                            {adjustment.amount}
                          </span>{" "}
                          → {formatScore(adjustment.scoreAfter)}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-20 border-t border-ink-600/50 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
              {STATUS_LABELS[status]}
            </span>
            {primary?.hint ? (
              <span className="text-xs text-ink-500">{primary.hint}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand({ type: "PREVIOUS_QUESTION" })}
              disabled={busy || !canStep || view.game.currentQuestionIndex <= 0}
              title="Previous question"
            >
              <ChevronLeft aria-hidden /> Prev
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand({ type: "RESTART_QUESTION" })}
              disabled={busy || !canStep}
              title="Clear answers and run this question again"
            >
              <RotateCcw aria-hidden /> Restart
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onCommand({ type: status === "PAUSED" ? "RESUME_GAME" : "PAUSE_GAME" })
              }
              disabled={busy || status === "FINISHED"}
            >
              {status === "PAUSED" ? <Play aria-hidden /> : <Pause aria-hidden />}
              {status === "PAUSED" ? "Resume" : "Pause"}
            </Button>

            <Button
              size="sm"
              variant={panel === "players" ? "outline" : "ghost"}
              onClick={() => setPanel(panel === "players" ? "none" : "players")}
              aria-expanded={panel === "players"}
            >
              <UserCog aria-hidden /> Players
            </Button>

            {onToggleMute ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={onToggleMute}
                aria-label={muted ? "Unmute sound" : "Mute sound"}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
              </Button>
            ) : null}

            {status !== "FINISHED" && status !== "FINAL_RESULTS" ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onCommand({ type: "END_GAME" })}
                disabled={busy}
              >
                <Flag aria-hidden /> End Game
              </Button>
            ) : null}

            {status === "LEADERBOARD" || status === "ANSWER_REVEAL" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onCommand({ type: "SHOW_LEADERBOARD" })}
                disabled={busy || status === "LEADERBOARD"}
              >
                <BarChart3 aria-hidden /> Leaderboard
              </Button>
            ) : null}

            {primary ? (
              <Button
                size="lg"
                onClick={() => onCommand(primary.command)}
                disabled={busy || primary.disabled}
                loading={busy}
                className={cn("min-w-52")}
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
