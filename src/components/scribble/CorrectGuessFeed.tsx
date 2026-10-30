"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { CorrectGuess } from "@/types/scribble";
import { nicknameAccent } from "@/lib/utils";

/**
 * Projector feed. Deliberately shows the name and nothing else — the submitted
 * word never appears, so players still guessing learn nothing from the big screen.
 */
export function CorrectGuessFeed({
  guesses,
  correctCount,
  guesserCount,
}: {
  guesses: CorrectGuess[];
  correctCount: number;
  guesserCount: number;
}) {
  const recent = [...guesses].slice(-6).reverse();

  return (
    <div className="flex items-center justify-between gap-8">
      <ul className="flex min-h-16 flex-1 flex-wrap items-center gap-2">
        <AnimatePresence initial={false}>
          {recent.map((guess) => (
            <motion.li
              key={guess.playerId}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="inline-flex items-center gap-2 rounded-full border border-lime-500/40 bg-lime-500/10 px-4 py-2 text-lg font-semibold text-lime-500"
            >
              <Check className="size-4" aria-hidden />
              <span style={{ color: nicknameAccent(guess.nickname) }}>{guess.nickname}</span>
              <span className="text-ink-300">got it!</span>
            </motion.li>
          ))}
        </AnimatePresence>

        {recent.length === 0 ? (
          <li className="text-lg text-ink-500">Nobody has it yet…</li>
        ) : null}
      </ul>

      <div className="shrink-0 text-right">
        <p className="font-display text-4xl font-extrabold tabular xl:text-6xl">
          {correctCount}{" "}
          <span className="text-ink-500">/ {guesserCount}</span>
        </p>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-ink-400">
          got it
        </p>
      </div>
    </div>
  );
}
