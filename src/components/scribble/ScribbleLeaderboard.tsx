"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "@/components/arena/count-up";
import type { ScribbleScoreEntry } from "@/types/scribble";
import { cn, initials, nicknameAccent } from "@/lib/utils";

export function ScribbleLeaderboard({
  entries,
  title = "Scribble Leaderboard",
  highlightPlayerId,
  limit = 10,
}: {
  entries: ScribbleScoreEntry[];
  title?: string;
  highlightPlayerId?: string;
  limit?: number;
}) {
  return (
    <div className="w-full max-w-4xl">
      {title ? (
        <h1 className="mb-10 text-center font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
          {title}
        </h1>
      ) : null}

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {entries.slice(0, limit).map((entry) => (
            <motion.div
              key={entry.playerId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className={cn(
                "flex items-center gap-4 rounded-2xl border px-5 py-4",
                entry.playerId === highlightPlayerId
                  ? "border-aqua-500/60 bg-aqua-500/10"
                  : entry.rank <= 3
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
