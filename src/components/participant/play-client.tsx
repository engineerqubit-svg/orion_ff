"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { ConnectionBadge } from "@/components/arena/connection-badge";
import { JoinForm } from "@/components/participant/join-form";
import { ParticipantStage } from "@/components/participant/participant-stage";
import { ApiError, apiFetch } from "@/lib/api/client";
import { usePlayerSession, type PlayerSession } from "@/hooks/use-player-session";
import { useRealtime } from "@/hooks/use-realtime";
import { useSound } from "@/hooks/use-sound";
import type { GameStatus, LeaderboardEntry, ParticipantQuestionView } from "@/types/game";
import type { RevealPayload, ServerEvent } from "@/types/realtime";

export interface ParticipantState {
  status: GameStatus;
  question: ParticipantQuestionView | null;
  questionStartedAt?: number;
  questionEndsAt?: number;
  questionCount: number;
  currentQuestionIndex: number;
  leaderboard: LeaderboardEntry[];
  reveal: RevealPayload | null;
  playerCount: number;
}

const INITIAL_STATE: ParticipantState = {
  status: "LOBBY",
  question: null,
  questionCount: 0,
  currentQuestionIndex: -1,
  leaderboard: [],
  reveal: null,
  playerCount: 0,
};

/**
 * Participant shell: owns the session, the realtime subscription and the derived
 * game state. All the visual work lives in `ParticipantStage`.
 */
export function PlayClient({ gamePin }: { gamePin: string }) {
  const { session, loaded, save, clear } = usePlayerSession();
  const { play } = useSound();

  const [state, setState] = useState<ParticipantState>(INITIAL_STATE);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  // Only trust a stored session that belongs to the PIN in the URL.
  const activeSession = session && session.gamePin === gamePin ? session : null;
  const answeredQuestionRef = useRef<string | null>(null);

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      setState((current) => reduce(current, event));

      switch (event.type) {
        case "QUESTION_STARTED":
          answeredQuestionRef.current = null;
          setAnswerId(null);
          setResponseTimeMs(null);
          break;
        case "ANSWER_REVEALED": {
          const result = activeSession ? event.reveal.results[activeSession.playerId] : undefined;
          if (result) play(result.isCorrect ? "correct" : "incorrect");
          break;
        }
        case "LEADERBOARD_SHOW":
          play("leaderboard");
          break;
        case "GAME_FINISHED":
          play("podium");
          break;
        case "PLAYER_KICKED":
          if (activeSession && event.playerId === activeSession.playerId) {
            setKicked(true);
            clear();
          }
          break;
        default:
          break;
      }
    },
    [activeSession, clear, play],
  );

  const { status: connection, serverNow } = useRealtime({
    gameId: activeSession?.gameId ?? null,
    role: "PLAYER",
    playerId: activeSession?.playerId,
    playerToken: activeSession?.playerToken,
    onEvent: handleEvent,
    enabled: Boolean(activeSession) && !kicked,
  });

  // A stored session has to be validated by the server before we show anything.
  const resuming = loaded && Boolean(activeSession) && !restoreAttempted;

  useEffect(() => {
    if (!loaded || !activeSession) return;

    let cancelled = false;
    void apiFetch<{ state: ParticipantState & { type: string } }>("/api/play/resume", {
      method: "POST",
      json: {
        gameId: activeSession.gameId,
        playerId: activeSession.playerId,
        playerToken: activeSession.playerToken,
      },
    })
      .then((response) => {
        if (cancelled) return;
        setState((current) => ({ ...current, ...pickState(response.state) }));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "PLAYER_KICKED") {
          setKicked(true);
        } else {
          toast.error("Your previous session expired — join again.");
        }
        clear();
      })
      .finally(() => {
        if (!cancelled) setRestoreAttempted(true);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when the identity itself changes.
  }, [loaded, activeSession?.gameId, activeSession?.playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitAnswer = useCallback(
    async (chosenAnswerId: string) => {
      if (!activeSession || !state.question || submitting) return;
      if (answeredQuestionRef.current === state.question.questionId) return;

      answeredQuestionRef.current = state.question.questionId;
      setAnswerId(chosenAnswerId);
      setSubmitting(true);

      try {
        const result = await apiFetch<{ responseTimeMs: number }>(
          `/api/games/${activeSession.gameId}/answer`,
          {
            method: "POST",
            json: {
              playerId: activeSession.playerId,
              playerToken: activeSession.playerToken,
              questionId: state.question.questionId,
              answerId: chosenAnswerId,
            },
          },
        );
        setResponseTimeMs(result.responseTimeMs);
        play("answer-locked");
      } catch (error) {
        // A rejected answer must not leave the UI claiming it was locked in.
        answeredQuestionRef.current = null;
        setAnswerId(null);
        toast.error(
          error instanceof ApiError ? error.message : "We couldn't send your answer.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [activeSession, state.question, submitting, play],
  );

  const onJoined = useCallback(
    (next: PlayerSession) => {
      save(next);
      setKicked(false);
      setState(INITIAL_STATE);
    },
    [save],
  );

  const myResult = useMemo(() => {
    if (!activeSession || !state.reveal) return null;
    return state.reveal.results[activeSession.playerId] ?? null;
  }, [activeSession, state.reveal]);

  if (!loaded || resuming) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <div className="relative z-10 animate-pulse font-display text-sm uppercase tracking-[0.3em] text-ink-400">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col">
      <ArenaBackground />

      <header className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6">
        <BrandMark size="sm" href="/" />
        {activeSession ? <ConnectionBadge status={connection} /> : null}
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-4 pb-6 safe-bottom sm:px-6">
        <AnimatePresence mode="wait">
          {kicked ? (
            <motion.div
              key="kicked"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <h1 className="font-display text-3xl font-bold text-pulse-500">Removed from game</h1>
              <p className="mt-3 max-w-xs text-sm text-ink-400">
                The host removed you from this game. Ask them for a new PIN if this
                was a mistake.
              </p>
            </motion.div>
          ) : !activeSession ? (
            <JoinForm key="join" gamePin={gamePin} onJoined={onJoined} />
          ) : (
            <ParticipantStage
              key="stage"
              session={activeSession}
              state={state}
              answerId={answerId}
              responseTimeMs={responseTimeMs}
              result={myResult}
              serverNow={serverNow}
              onAnswer={submitAnswer}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function pickState(sync: Partial<ParticipantState>): Partial<ParticipantState> {
  return {
    status: sync.status,
    question: sync.question ?? null,
    questionStartedAt: sync.questionStartedAt,
    questionEndsAt: sync.questionEndsAt,
    questionCount: sync.questionCount ?? 0,
    currentQuestionIndex: sync.currentQuestionIndex ?? -1,
    leaderboard: sync.leaderboard ?? [],
    reveal: sync.reveal ?? null,
  };
}

/** Folds a server event into the local view. The server stays authoritative. */
function reduce(state: ParticipantState, event: ServerEvent): ParticipantState {
  switch (event.type) {
    case "STATE_SYNC":
      return {
        ...state,
        status: event.status,
        question: event.question ?? null,
        questionStartedAt: event.questionStartedAt,
        questionEndsAt: event.questionEndsAt,
        questionCount: event.questionCount,
        currentQuestionIndex: event.currentQuestionIndex,
        leaderboard: event.leaderboard,
        reveal: event.reveal ?? null,
        playerCount: event.players.length,
      };
    case "PLAYER_JOINED":
    case "PLAYER_LEFT":
    case "PLAYER_KICKED":
      return { ...state, playerCount: event.playerCount };
    case "GAME_STARTED":
      return { ...state, questionCount: event.questionCount };
    case "QUESTION_PREPARE":
      return {
        ...state,
        status: "QUESTION_PREPARE",
        currentQuestionIndex: event.index,
        questionCount: event.total,
        reveal: null,
      };
    case "QUESTION_STARTED":
      return {
        ...state,
        status: "QUESTION_ACTIVE",
        question: event.question,
        questionStartedAt: event.questionStartedAt,
        questionEndsAt: event.questionEndsAt,
        currentQuestionIndex: event.question.index,
        questionCount: event.question.total,
        reveal: null,
      };
    case "QUESTION_ENDED":
      return { ...state, status: "QUESTION_ENDED" };
    case "ANSWER_REVEALED":
      return { ...state, status: "ANSWER_REVEAL", reveal: event.reveal };
    case "RESULTS_UPDATED":
      return { ...state, reveal: event.reveal };
    case "LEADERBOARD_SHOW":
      return { ...state, status: "LEADERBOARD", leaderboard: event.leaderboard };
    case "LEADERBOARD_UPDATED":
    case "SCORE_ADJUSTED":
      return { ...state, leaderboard: event.leaderboard };
    case "NEXT_QUESTION":
      return {
        ...state,
        status: "QUESTION_PREPARE",
        currentQuestionIndex: event.index,
        questionCount: event.total,
        reveal: null,
      };
    case "GAME_PAUSED":
      return { ...state, status: "PAUSED" };
    case "GAME_RESUMED":
      return { ...state, status: event.status, questionEndsAt: event.questionEndsAt };
    case "GAME_FINISHED":
      return { ...state, status: "FINAL_RESULTS", leaderboard: event.leaderboard };
    default:
      return state;
  }
}
