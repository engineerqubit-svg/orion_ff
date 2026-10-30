"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { Crown, Flame, Target, Timer, TrendingUp, Users } from "lucide-react";
import { ANSWER_SHAPES, AnswerTile, answerTone } from "@/components/arena/answer-tile";
import { CountUp } from "@/components/arena/count-up";
import { TimerRing } from "@/components/arena/timer-ring";
import { useCountdown } from "@/hooks/use-countdown";
import type { HostGameView } from "@/lib/game-engine/engine";
import { formatGamePin } from "@/lib/ids";
import { cn, formatScore, formatSeconds, initials, nicknameAccent, youTubeEmbedUrl } from "@/lib/utils";
import { QUESTION_MODE_ANNOUNCEMENT } from "@/types/quiz";

/* --------------------------------------------------------------------- Lobby */

export function LobbyStage({ view, gamePin }: { view: HostGameView; gamePin: string }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const joinUrl = `${window.location.origin}/play/${gamePin}`;
    void QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 1,
      color: { dark: "#2b1f16", light: "#ffffff" },
    }).then(setQr);
  }, [gamePin]);

  return (
    <div className="grid w-full max-w-7xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <div className="text-center lg:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-400">Game PIN</p>
        <p className="font-display text-projector-pin font-extrabold tabular brand-gradient-text">
          {formatGamePin(gamePin)}
        </p>

        <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row lg:items-start">
          {qr ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={qr}
              alt={`QR code to join game ${gamePin}`}
              className="size-40 rounded-2xl border-4 border-white bg-white xl:size-52"
            />
          ) : (
            <div className="size-40 animate-pulse rounded-2xl bg-ink-700/50 xl:size-52" />
          )}
          <div className="text-sm text-ink-400">
            <p className="font-semibold text-ink-200">Scan to join</p>
            <p className="mt-1">or open</p>
            <p className="font-mono text-xs text-aqua-400">/play/{gamePin}</p>
          </div>
        </div>
      </div>

      <div className="panel rounded-xl3 p-6">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-brand-400" aria-hidden />
          <h2 className="font-display text-2xl font-bold tabular">
            <CountUp value={view.players.length} duration={0.4} />{" "}
            <span className="text-ink-400">
              player{view.players.length === 1 ? "" : "s"} joined
            </span>
          </h2>
        </div>

        <div className="mt-5 flex max-h-[46vh] flex-wrap gap-2 overflow-y-auto">
          <AnimatePresence initial={false}>
            {view.players.map((player) => (
              <motion.span
                key={player.playerId}
                layout
                initial={{ opacity: 0, scale: 0.7, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
                  player.connected
                    ? "border-ink-500/50 bg-ink-800/70 text-ink-100"
                    : "border-ink-700/60 bg-ink-900/50 text-ink-500",
                )}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full text-[0.6rem] font-bold text-ink-100"
                  style={{ background: nicknameAccent(player.nickname) }}
                  aria-hidden
                >
                  {initials(player.nickname)}
                </span>
                {player.nickname}
              </motion.span>
            ))}
          </AnimatePresence>

          {view.players.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500">
              Waiting for the first player…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Prepare */

export function PrepareStage({ view }: { view: HostGameView }) {
  const announcement = view.question ? QUESTION_MODE_ANNOUNCEMENT[view.question.mode] : null;
  const isFinal = view.game.currentQuestionIndex === view.quiz.questionCount - 1;

  return (
    <motion.div
      key={view.game.currentQuestionIndex}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      {announcement ? (
        <>
          <p className="text-7xl">{announcement.emoji}</p>
          <h1 className="mt-4 font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
            {announcement.title}
          </h1>
          <p className="mt-3 text-xl text-ink-300">{announcement.blurb}</p>
        </>
      ) : isFinal ? (
        <>
          <p className="text-7xl">🎯</p>
          <h1 className="mt-4 font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
            Final Question
          </h1>
          <p className="mt-3 text-xl text-ink-300">Everything rides on this one.</p>
        </>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-400">
            Question {view.game.currentQuestionIndex + 1} of {view.quiz.questionCount}
          </p>
          <h1 className="mt-4 font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
            Get Ready
          </h1>
        </>
      )}
      <p className="mt-8 text-sm uppercase tracking-[0.2em] text-ink-500">
        Press Start Question when the room is ready
      </p>
    </motion.div>
  );
}

/**
 * YouTube embed for the display only — never shipped to participant phones
 * (see ParticipantQuestionView). There's no separate "watch, then answer"
 * phase in the state machine, so a video question just plays alongside the
 * countdown and visible answers; give it a longer durationSeconds in the
 * quiz data so there's time to actually watch before the timer runs out.
 */
function VideoEmbed({ url }: { url: string }) {
  const embedUrl = youTubeEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className="mx-auto mt-6 aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-600/50">
      <iframe
        src={embedUrl}
        title="Question video"
        className="size-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Question */

export function QuestionStage({
  view,
  serverNow,
  closed = false,
}: {
  view: HostGameView;
  serverNow: () => number;
  closed?: boolean;
}) {
  const countdown = useCountdown(
    view.game.questionStartedAt,
    view.game.questionEndsAt,
    serverNow,
    !closed,
  );

  const question = view.question;
  if (!question) return null;

  const answeredPercent =
    view.players.length === 0 ? 0 : (view.answeredCount / view.players.length) * 100;

  return (
    <div className="grid w-full max-w-[100rem] gap-8 xl:grid-cols-[1fr_auto] xl:items-start">
      <div>
        <h1 className="font-display text-projector-question font-bold text-ink-100">
          {question.question}
        </h1>

        {question.imageUrl ? (
          // Host-supplied URL from any host; next/image would need domain config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.imageUrl}
            alt=""
            className="mx-auto mt-6 max-h-[28vh] rounded-2xl object-contain"
          />
        ) : null}

        {question.videoUrl ? <VideoEmbed url={question.videoUrl} /> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {question.answers.map((answer, index) => (
            <AnswerTile
              key={answer.id}
              index={index}
              text={answer.text}
              size="projector"
              disabled
            />
          ))}
        </div>
      </div>

      <aside className="flex flex-row items-center gap-8 xl:w-72 xl:flex-col xl:items-stretch">
        <div className="flex justify-center">
          <TimerRing
            secondsLeft={closed ? 0 : countdown.secondsLeft}
            progress={closed ? 1 : countdown.progress}
            size={168}
          />
        </div>

        <div className="panel flex-1 rounded-2xl p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">
            Answers received
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink-700">
            <motion.div
              className="h-full brand-gradient-bg"
              animate={{ width: `${answeredPercent}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="mt-3 font-display text-3xl font-bold tabular">
            {view.answeredCount}{" "}
            <span className="text-ink-400">/ {view.players.length}</span>
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------- Results */

export function ResultsStage({ view }: { view: HostGameView }) {
  const reveal = view.reveal;
  const question = view.question;
  if (!reveal || !question) return null;

  const max = Math.max(1, ...reveal.distribution.map((bucket) => bucket.count));

  return (
    <div className="w-full max-w-5xl">
      <h1 className="text-center font-display text-3xl font-bold text-ink-100 xl:text-5xl">
        {question.question}
      </h1>

      <div className="mt-10 space-y-4">
        {reveal.distribution.map((bucket, index) => {
          const tone = answerTone(index);
          return (
            <div key={bucket.answerId} className="flex items-center gap-4">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white"
                style={{ background: tone.bg }}
                aria-hidden
              >
                {ANSWER_SHAPES[index]}
              </span>

              <span
                className={cn(
                  "w-40 shrink-0 truncate text-lg font-semibold xl:w-64 xl:text-2xl",
                  bucket.isCorrect ? "text-lime-500" : "text-ink-300",
                )}
              >
                {bucket.text}
              </span>

              <div className="h-11 flex-1 overflow-hidden rounded-xl bg-ink-800/70">
                <motion.div
                  className="h-full rounded-xl"
                  style={{ background: bucket.isCorrect ? "var(--color-lime-500)" : tone.bg }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(bucket.count / max) * 100}%` }}
                  transition={{ duration: 0.9, delay: index * 0.1, ease: "easeOut" }}
                />
              </div>

              <span className="w-16 shrink-0 text-right font-display text-2xl font-bold tabular">
                {bucket.count}
                {bucket.isCorrect ? <span className="ml-1 text-lime-500">✓</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Leaderboard */

export function LeaderboardStage({ view }: { view: HostGameView }) {
  const top = view.leaderboard.slice(0, 10);

  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-center font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
        Leaderboard
      </h1>

      <div className="mt-10 space-y-2.5">
        <AnimatePresence initial={false}>
          {top.map((entry) => (
            <motion.div
              key={entry.playerId}
              layout
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className={cn(
                "flex items-center gap-4 rounded-2xl border px-5 py-4",
                entry.rank <= 3
                  ? "border-brand-500/45 bg-brand-500/10"
                  : "border-ink-600/50 bg-ink-800/50",
              )}
            >
              <span className="w-10 shrink-0 font-display text-2xl font-bold tabular text-ink-400">
                {entry.rank}
              </span>

              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink-100"
                style={{ background: nicknameAccent(entry.nickname) }}
                aria-hidden
              >
                {initials(entry.nickname)}
              </span>

              <span className="flex-1 truncate text-xl font-semibold text-ink-100 xl:text-2xl">
                {entry.nickname}
              </span>

              {entry.streak >= 3 ? (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-solar-500">
                  <Flame className="size-4" aria-hidden />
                  {entry.streak}
                </span>
              ) : null}

              {entry.positionDelta ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-bold",
                    entry.positionDelta > 0 ? "text-lime-500" : "text-pulse-500",
                  )}
                >
                  <TrendingUp
                    className={cn("size-4", entry.positionDelta < 0 && "rotate-180")}
                    aria-hidden
                  />
                  {Math.abs(entry.positionDelta)}
                </span>
              ) : null}

              <span className="w-28 shrink-0 text-right font-display text-2xl font-bold tabular">
                <CountUp value={entry.score} duration={0.8} />
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Podium */

const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_HEIGHTS = ["h-40", "h-56", "h-32"] as const;

export function PodiumStage({ view }: { view: HostGameView }) {
  const [revealStep, setRevealStep] = useState(0);
  const top3 = view.leaderboard.slice(0, 3);

  // 3rd, then 2nd, then 1st.
  useEffect(() => {
    const timers = [1, 2, 3].map((step) =>
      setTimeout(() => setRevealStep(step), step * 1200),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const stats = view.stats;

  return (
    <div className="w-full max-w-6xl text-center">
      <p className="text-6xl">🏆</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase brand-gradient-text xl:text-6xl">
        Final Results
      </h1>

      <div className="mt-12 flex items-end justify-center gap-4 sm:gap-8">
        {PODIUM_ORDER.map((position, slot) => {
          const entry = top3[position];
          const visible = revealStep >= 3 - position;
          if (!entry) return <div key={slot} className="w-28 sm:w-44" />;

          return (
            <motion.div
              key={entry.playerId}
              initial={{ opacity: 0, y: 60 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
              className="flex w-28 flex-col items-center sm:w-44"
            >
              {position === 0 ? (
                <Crown className="mb-2 size-8 text-solar-500" aria-hidden />
              ) : null}

              <span
                className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-ink-100 sm:size-16 sm:text-lg"
                style={{ background: nicknameAccent(entry.nickname) }}
                aria-hidden
              >
                {initials(entry.nickname)}
              </span>

              <p className="mt-3 w-full truncate font-display text-lg font-bold uppercase text-ink-100 sm:text-2xl">
                {entry.nickname}
              </p>
              <p className="font-display text-xl font-extrabold tabular text-aqua-400 sm:text-3xl">
                {formatScore(entry.score)}
              </p>

              <div
                className={cn(
                  "mt-3 flex w-full items-start justify-center rounded-t-2xl border-t border-x pt-3",
                  PODIUM_HEIGHTS[position],
                  position === 0
                    ? "border-solar-500/50 bg-gradient-to-b from-solar-500/25 to-transparent"
                    : "border-ink-500/50 bg-gradient-to-b from-ink-700/60 to-transparent",
                )}
              >
                <span className="font-display text-3xl font-extrabold text-ink-300 sm:text-5xl">
                  #{entry.rank}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {stats ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: revealStep >= 3 ? 1 : 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatTile
            icon={Timer}
            label="Fastest answer"
            value={stats.fastestAnswer?.nickname}
            detail={
              stats.fastestAnswer ? formatSeconds(stats.fastestAnswer.responseTimeMs) : undefined
            }
          />
          <StatTile
            icon={Flame}
            label="Longest streak"
            value={stats.longestStreak?.nickname}
            detail={stats.longestStreak ? `${stats.longestStreak.streak} in a row` : undefined}
          />
          <StatTile
            icon={Target}
            label="Most correct"
            value={stats.mostCorrect?.nickname}
            detail={stats.mostCorrect ? `${stats.mostCorrect.correctCount} correct` : undefined}
          />
          <StatTile
            icon={TrendingUp}
            label="Biggest comeback"
            value={stats.biggestComeback?.nickname}
            detail={
              stats.biggestComeback
                ? `+${stats.biggestComeback.positionsGained} places`
                : undefined
            }
          />
        </motion.div>
      ) : null}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Timer;
  label: string;
  value?: string;
  detail?: string;
}) {
  return (
    <div className="panel rounded-2xl p-4 text-left">
      <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ink-400">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 truncate font-display text-lg font-bold text-ink-100">
        {value ?? "—"}
      </p>
      {detail ? <p className="text-xs text-aqua-400">{detail}</p> : null}
    </div>
  );
}
