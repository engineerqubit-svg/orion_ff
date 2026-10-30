"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, Loader2, MonitorPlay, Pause, Trophy } from "lucide-react";
import { AnswerTile } from "@/components/arena/answer-tile";
import { CountUp } from "@/components/arena/count-up";
import { TimerRing } from "@/components/arena/timer-ring";
import { useCountdown } from "@/hooks/use-countdown";
import type { PlayerSession } from "@/hooks/use-player-session";
import { formatSeconds } from "@/lib/utils";
import { QUESTION_MODE_ANNOUNCEMENT } from "@/types/quiz";
import type { PlayerQuestionResult } from "@/types/game";
import type { ParticipantState } from "./play-client";

interface Props {
  session: PlayerSession;
  state: ParticipantState;
  answerId: string | null;
  responseTimeMs: number | null;
  result: PlayerQuestionResult | null;
  serverNow: () => number;
  onAnswer: (answerId: string) => void;
}

const panel =
  "ticket glass-strong flex w-full max-w-md flex-col items-center p-7 text-center";

/** Everything a participant sees once they're in the game. */
export function ParticipantStage({
  session,
  state,
  answerId,
  responseTimeMs,
  result,
  serverNow,
  onAnswer,
}: Props) {
  const countdown = useCountdown(
    state.questionStartedAt,
    state.questionEndsAt,
    serverNow,
    state.status === "QUESTION_ACTIVE",
  );

  const myRank =
    result?.rank ??
    state.leaderboard.find((entry) => entry.playerId === session.playerId)?.rank;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6">
      <AnimatePresence mode="wait">
        {state.status === "LOBBY" ? (
          <Panel key="lobby">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-aqua-400">
              You&apos;re in!
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold break-words text-ink-100">
              {session.nickname}
            </h1>
            <WaitingDots label="Waiting for the host to start the game" />
          </Panel>
        ) : state.status === "PAUSED" ? (
          <Panel key="paused">
            <Pause className="size-10 text-solar-500" aria-hidden />
            <h1 className="mt-4 font-display text-3xl font-bold">Game paused</h1>
            <p className="mt-2 text-sm text-ink-400">Hang tight — the host will resume shortly.</p>
          </Panel>
        ) : state.status === "QUESTION_PREPARE" ? (
          <Panel key="prepare">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-400">
              Question {state.currentQuestionIndex + 1} of {state.questionCount}
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold brand-gradient-text">
              Get ready
            </h1>
            <WaitingDots label="Eyes on the big screen" />
          </Panel>
        ) : state.status === "QUESTION_ACTIVE" && state.question ? (
          answerId ? (
            <Panel key="locked">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="flex size-16 items-center justify-center rounded-full bg-lime-500/15 text-lime-500"
              >
                <Check className="size-9" aria-hidden />
              </motion.div>
              <h1 className="mt-5 font-display text-3xl font-extrabold uppercase tracking-tight">
                Answer locked
              </h1>
              {responseTimeMs !== null ? (
                <p className="mt-2 text-sm text-ink-300">
                  Answered in{" "}
                  <span className="font-semibold text-aqua-400">
                    {formatSeconds(responseTimeMs)}
                  </span>
                </p>
              ) : null}
              <WaitingDots label="Waiting for everyone" />
            </Panel>
          ) : (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex w-full max-w-2xl flex-1 flex-col"
            >
              <div className="mb-4 flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">
                    Question {state.question.index + 1} / {state.question.total}
                  </p>
                  <h1 className="mt-2 font-display text-xl font-bold leading-snug text-ink-100 sm:text-2xl">
                    {state.question.question}
                  </h1>
                </div>
                <TimerRing
                  secondsLeft={countdown.secondsLeft}
                  progress={countdown.progress}
                  size={72}
                />
              </div>

              {state.question.imageUrl ? (
                /* Host-supplied URL; next/image would need per-host domain config. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={state.question.imageUrl}
                  alt=""
                  className="mx-auto mb-4 max-h-[22vh] w-auto rounded-xl object-contain"
                />
              ) : null}

              {state.question.hasVideo ? (
                // No video here on purpose — 200 phones streaming the same clip
                // at once is how a venue's wifi gives out mid-game.
                <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 py-4 text-sm font-semibold text-brand-400">
                  <MonitorPlay className="size-4" aria-hidden /> Watch &amp; listen on the big
                  screen
                </div>
              ) : null}

              <div className="grid flex-1 content-center gap-3">
                {state.question.answers.map((answer, index) => (
                  <AnswerTile
                    key={answer.id}
                    index={index}
                    text={answer.text}
                    onClick={() => onAnswer(answer.id)}
                  />
                ))}
              </div>
            </motion.div>
          )
        ) : state.status === "QUESTION_ENDED" ? (
          <Panel key="ended">
            <h1 className="font-display text-3xl font-bold">Time&apos;s up</h1>
            <WaitingDots label="Checking the answers" />
          </Panel>
        ) : result && (state.status === "ANSWER_REVEAL" || state.status === "LEADERBOARD") ? (
          <ResultPanel key="result" result={result} state={state} />
        ) : state.status === "FINAL_RESULTS" || state.status === "FINISHED" ? (
          <Panel key="final">
            <Trophy className="size-10 text-solar-500" aria-hidden />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-ink-400">
              Final position
            </p>
            <p className="font-display text-7xl font-extrabold brand-gradient-text">
              #{myRank ?? "—"}
            </p>
            <p className="mt-2 text-sm text-ink-300">
              {state.leaderboard.find((e) => e.playerId === session.playerId)?.score ?? 0} points
            </p>
            <p className="mt-6 text-xs text-ink-500">Check the big screen for the podium.</p>
          </Panel>
        ) : (
          <Panel key="waiting">
            <WaitingDots label="Waiting for the host" />
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className={panel}
    >
      {children}
    </motion.div>
  );
}

function WaitingDots({ label }: { label: string }) {
  return (
    <div className="mt-7 flex flex-col items-center gap-3">
      <Loader2 className="size-5 animate-spin text-ink-500" aria-hidden />
      <p className="text-sm text-ink-400">{label}…</p>
    </div>
  );
}

function ResultPanel({
  result,
  state,
}: {
  result: PlayerQuestionResult;
  state: ParticipantState;
}) {
  const correctText = state.question?.answers.find(
    (answer) => answer.id === state.reveal?.correctAnswerId,
  )?.text;
  const announcement = state.question ? QUESTION_MODE_ANNOUNCEMENT[state.question.mode] : null;
  const total = result.pointsAwarded + result.streakBonus;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={panel}
    >
      <h1
        className={`font-display text-4xl font-extrabold uppercase tracking-tight ${
          result.isCorrect ? "text-lime-500" : "text-pulse-500"
        }`}
      >
        {result.isCorrect ? "Correct!" : "Not this time"}
      </h1>

      {!result.isCorrect && correctText ? (
        <p className="mt-3 text-sm text-ink-400">
          Correct answer:{" "}
          <span className="font-semibold text-ink-100">{correctText}</span>
        </p>
      ) : null}

      <p className="mt-6 font-display text-6xl font-extrabold text-ink-100">
        {total > 0 ? "+" : ""}
        <CountUp value={total} />
      </p>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">points</p>

      {result.streakBonus > 0 ? (
        <p className="mt-2 text-xs font-semibold text-solar-500">
          includes +{result.streakBonus} streak bonus
        </p>
      ) : null}

      {announcement && result.isCorrect ? (
        <p className="mt-2 text-xs font-semibold text-brand-400">
          {announcement.emoji} {announcement.title}
        </p>
      ) : null}

      {result.streak >= 2 ? (
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-solar-500/40 bg-solar-500/10 px-4 py-1.5 text-sm font-bold text-solar-500"
        >
          <Flame className="size-4" aria-hidden /> {result.streak} answer streak
        </motion.p>
      ) : null}

      <div className="panel mt-7 w-full rounded-xl2 py-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-ink-400">
          Current position
        </p>
        <p className="font-display text-5xl font-extrabold brand-gradient-text">#{result.rank}</p>
      </div>
    </motion.div>
  );
}
