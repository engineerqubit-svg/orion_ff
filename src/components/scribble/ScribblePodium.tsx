"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown, Medal } from "lucide-react";
import { CountUp } from "@/components/arena/count-up";
import { ScribbleLeaderboard } from "@/components/scribble/ScribbleLeaderboard";
import type { ScribbleScoreEntry } from "@/types/scribble";
import { cn, initials, nicknameAccent } from "@/lib/utils";

/** Slot order left-to-right is 2nd, 1st, 3rd; reveal order is 3rd, 2nd, 1st. */
const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_HEIGHTS = ["h-48", "h-32", "h-24"] as const;
const COMPACT_HEIGHTS = ["h-28", "h-20", "h-14"] as const;

/** ms after mount for each beat of the reveal. */
const BEATS = { third: 2600, second: 4200, drumroll: 5600, winner: 7600, rest: 9400 } as const;

const CONFETTI_COLORS = ["#e2971f", "#c92f4a", "#3e6b9e", "#e0632a"];

/**
 * Final reveal, shared by the projector and every phone. Builds suspense —
 * 3rd, 2nd, a drumroll, then the winner with fireworks — and only then shows
 * the rest of the table. Each screen runs the same timeline from the moment it
 * sees the game finish, so the room celebrates together.
 */
export function ScribblePodium({
  entries,
  compact = false,
  highlightPlayerId,
  onWinner,
}: {
  entries: ScribbleScoreEntry[];
  compact?: boolean;
  highlightPlayerId?: string;
  onWinner?: () => void;
}) {
  const [beat, setBeat] = useState<keyof typeof BEATS | "intro">("intro");
  const onWinnerRef = useRef(onWinner);
  useEffect(() => {
    onWinnerRef.current = onWinner;
  });

  useEffect(() => {
    const timers = (Object.keys(BEATS) as (keyof typeof BEATS)[]).map((key) =>
      setTimeout(() => {
        setBeat(key);
        if (key === "winner") {
          onWinnerRef.current?.();
          celebrate();
        }
      }, BEATS[key]),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const order = ["intro", ...Object.keys(BEATS)] as const;
  const reached = (key: (typeof order)[number]) => order.indexOf(beat) >= order.indexOf(key);
  const visibleFor = (position: number) =>
    position === 2 ? reached("third") : position === 1 ? reached("second") : reached("winner");

  const top3 = entries.slice(0, 3);
  const winner = top3[0];
  const heights = compact ? COMPACT_HEIGHTS : PODIUM_HEIGHTS;

  return (
    <div className={cn("w-full text-center", compact ? "max-w-md" : "max-w-6xl")}>
      <AnimatePresence mode="wait">
        {!reached("winner") ? (
          <motion.div
            key="suspense"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <p
              className={cn(
                "font-bold uppercase tracking-[0.3em] text-ink-400",
                compact ? "text-xs" : "text-sm",
              )}
            >
              Scribble is over
            </p>
            <motion.h1
              animate={reached("drumroll") ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.35, repeat: Infinity }}
              className={cn(
                "mt-2 font-display font-extrabold uppercase brand-gradient-text",
                compact ? "text-3xl" : "text-5xl xl:text-7xl",
              )}
            >
              {reached("drumroll") ? "And the winner is…" : "The results are in…"}
            </motion.h1>
          </motion.div>
        ) : (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
          >
            <p
              className={cn(
                "font-bold uppercase tracking-[0.3em] text-solar-500",
                compact ? "text-xs" : "text-sm",
              )}
            >
              Scribble Champion
            </p>
            <h1
              className={cn(
                "mt-1 font-display font-extrabold uppercase",
                compact ? "text-4xl" : "text-6xl xl:text-8xl",
              )}
              style={{ color: winner ? nicknameAccent(winner.nickname) : undefined }}
            >
              {winner?.nickname ?? "—"}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex items-end justify-center",
          compact ? "mt-8 gap-2" : "mt-12 gap-4 sm:gap-8",
        )}
      >
        {PODIUM_ORDER.map((position) => {
          const entry = top3[position];
          const width = compact ? "w-24" : "w-32 sm:w-48";
          if (!entry) return <div key={`empty-${position}`} className={width} />;
          const visible = visibleFor(position);
          const isWinner = position === 0;

          return (
            <div key={entry.playerId} className={cn("flex flex-col items-center", width)}>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ type: "spring", stiffness: 170, damping: isWinner ? 11 : 18 }}
                className="flex w-full flex-col items-center"
              >
                {isWinner ? (
                  <motion.div
                    animate={visible ? { rotate: [-12, 12, -6, 0], y: [0, -8, 0] } : {}}
                    transition={{ duration: 0.9, delay: 0.2 }}
                  >
                    <Crown
                      className={cn("mb-1 text-solar-500", compact ? "size-7" : "size-12")}
                      aria-hidden
                    />
                  </motion.div>
                ) : (
                  <Medal
                    className={cn(
                      "mb-1",
                      position === 1 ? "text-ink-200" : "text-[#cd7f32]",
                      compact ? "size-5" : "size-8",
                    )}
                    aria-hidden
                  />
                )}

                <span
                  className={cn(
                    "flex items-center justify-center rounded-full font-bold text-ink-100",
                    isWinner && visible ? "ring-4 ring-solar-500/60" : "",
                    compact ? "size-11 text-sm" : "size-16 text-lg sm:size-20 sm:text-xl",
                  )}
                  style={{ background: nicknameAccent(entry.nickname) }}
                  aria-hidden
                >
                  {initials(entry.nickname)}
                </span>

                <p
                  className={cn(
                    "mt-2 w-full truncate font-display font-bold uppercase",
                    entry.playerId === highlightPlayerId ? "text-aqua-400" : "text-ink-100",
                    compact ? "text-sm" : "text-lg sm:text-2xl",
                  )}
                >
                  {entry.nickname}
                </p>
                <p
                  className={cn(
                    "font-display font-extrabold tabular text-aqua-400",
                    compact ? "text-base" : "text-xl sm:text-3xl",
                  )}
                >
                  {visible ? <CountUp value={entry.score} duration={1.2} /> : "0"}
                </p>
              </motion.div>

              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: visible ? 1 : 0.15 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
                style={{ transformOrigin: "bottom" }}
                className={cn(
                  "mt-3 flex w-full items-start justify-center rounded-t-2xl border-x border-t pt-2",
                  heights[position],
                  isWinner
                    ? "border-solar-500/60 bg-gradient-to-b from-solar-500/35 to-transparent"
                    : "border-ink-500/50 bg-gradient-to-b from-ink-700/60 to-transparent",
                )}
              >
                <span
                  className={cn(
                    "font-display font-extrabold text-ink-300",
                    compact ? "text-xl" : "text-3xl sm:text-5xl",
                  )}
                >
                  {position + 1}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>

      {reached("rest") && entries.length > 3 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mx-auto", compact ? "mt-6" : "mt-10 flex justify-center")}
        >
          <ScribbleLeaderboard
            entries={entries.slice(3)}
            title=""
            highlightPlayerId={highlightPlayerId}
            limit={compact ? 5 : 7}
          />
        </motion.div>
      ) : null}
    </div>
  );
}

/** Side cannons, then a few seconds of fireworks. */
function celebrate(): void {
  const fire = (options: confetti.Options) =>
    void confetti({ colors: CONFETTI_COLORS, disableForReducedMotion: true, ...options });

  fire({ particleCount: 140, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
  fire({ particleCount: 140, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });

  const end = Date.now() + 4_000;
  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }
    fire({
      particleCount: 45,
      startVelocity: 30,
      spread: 360,
      ticks: 70,
      origin: { x: 0.15 + Math.random() * 0.7, y: Math.random() * 0.4 },
    });
  }, 320);
}
