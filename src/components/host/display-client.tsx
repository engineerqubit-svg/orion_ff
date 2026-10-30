"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { ConnectionBadge } from "@/components/arena/connection-badge";
import { FestiveLights } from "@/components/arena/festive-lights";
import {
  LeaderboardStage,
  LobbyStage,
  PodiumStage,
  PrepareStage,
  QuestionStage,
  ResultsStage,
} from "@/components/host/host-stages";
import { Button } from "@/components/ui/button";
import { useHostGameView } from "@/hooks/use-host-game-view";
import { useSound } from "@/hooks/use-sound";
import type { ServerEvent } from "@/types/realtime";

/**
 * The projector screen — cast or HDMI'd to the TV the whole room watches.
 * Pure output: no buttons, no commands. Run `/host/game/[gameId]/control`
 * on your own phone alongside this to actually run the game.
 */
export function DisplayClient({ gameId, gamePin }: { gameId: string; gamePin: string }) {
  const { muted, toggleMuted, play } = useSound();
  const celebratedRef = useRef(false);

  const onServerEvent = (event: ServerEvent) => {
    switch (event.type) {
      case "PLAYER_JOINED":
        play("player-joined");
        break;
      case "QUESTION_ENDED":
        play("answer-locked");
        break;
      case "ANSWER_REVEALED":
        play("correct");
        break;
      case "LEADERBOARD_SHOW":
        play("leaderboard");
        break;
      case "GAME_FINISHED":
        play("podium");
        break;
      default:
        break;
    }
  };

  const { view, connection, serverNow } = useHostGameView(gameId, onServerEvent);

  // Confetti is reserved for the podium — nowhere else.
  useEffect(() => {
    if (!view) return;
    const finished = view.game.status === "FINAL_RESULTS" || view.game.status === "FINISHED";
    if (!finished || celebratedRef.current) return;
    celebratedRef.current = true;

    void confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#e2971f", "#c92f4a", "#3e6b9e", "#e0632a"],
    });
  }, [view]);

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
      <ArenaBackground dense />
      {status === "LOBBY" ? <FestiveLights /> : null}

      <header className="relative z-10 flex items-center justify-between px-6 pt-5 xl:px-10">
        <BrandMark size="md" />
        <div className="flex items-center gap-4">
          {status !== "LOBBY" ? (
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">
              Question {view.game.currentQuestionIndex + 1} / {view.quiz.questionCount}
            </span>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
          </Button>
          <ConnectionBadge status={connection} />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-6 xl:px-10">
        {status === "LOBBY" ? (
          <LobbyStage view={view} gamePin={gamePin} />
        ) : status === "QUESTION_PREPARE" ? (
          <PrepareStage view={view} />
        ) : status === "QUESTION_ACTIVE" ? (
          <QuestionStage view={view} serverNow={serverNow} />
        ) : status === "QUESTION_ENDED" ? (
          <QuestionStage view={view} serverNow={serverNow} closed />
        ) : status === "ANSWER_REVEAL" ? (
          <ResultsStage view={view} />
        ) : status === "LEADERBOARD" ? (
          <LeaderboardStage view={view} />
        ) : status === "FINAL_RESULTS" || status === "FINISHED" ? (
          <PodiumStage view={view} />
        ) : status === "PAUSED" ? (
          <div className="text-center">
            <h1 className="font-display text-projector-hero font-extrabold text-solar-500">
              PAUSED
            </h1>
            <p className="mt-3 text-lg text-ink-400">Resume when everyone&apos;s ready.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
