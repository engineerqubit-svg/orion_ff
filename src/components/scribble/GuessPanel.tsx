"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { GuessInput } from "./GuessInput";
import { WordHint } from "./WordHint";
import { cn, nicknameAccent } from "@/lib/utils";

export interface LocalGuess {
  id: number;
  text: string;
  outcome: "CORRECT" | "CLOSE" | "WRONG";
  /** Set for other players' guesses; absent for this player's own. */
  author?: string;
}

/**
 * Guesser sidebar: the hint, the input, and a live feed mixing this player's own
 * guesses with everyone else's wrong ones. Near-misses ("so close") are only
 * ever shown to the person who typed them.
 */
export function GuessPanel({
  hint,
  letterCount,
  guesses,
  onGuess,
  disabled,
  correctCount,
  guesserCount,
}: {
  hint: string | null;
  letterCount: number | null;
  guesses: LocalGuess[];
  onGuess: (guess: string) => void;
  disabled?: boolean;
  correctCount: number;
  guesserCount: number;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="glass rounded-2xl p-5">
        <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.22em] text-aqua-400">
          Guess the word
        </p>
        <WordHint hint={hint} letterCount={letterCount} className="mt-3" />
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">
          Your guess
        </p>
        <GuessInput onGuess={onGuess} disabled={disabled} />
        <p className="mt-2 text-xs text-ink-500">
          Press Enter to fire — guess as many times as you like.
        </p>
      </div>

      <div className="glass flex max-h-[50vh] min-h-48 flex-1 flex-col rounded-2xl p-5 lg:max-h-none">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">
            Guesses
          </p>
          <span className="tabular text-xs text-ink-500">
            {correctCount} / {guesserCount} got it
          </span>
        </div>

        <GuessFeed guesses={guesses} />
      </div>
    </div>
  );
}

/** The scrolling feed on its own, so the drawer's sidebar can show it too. */
export function GuessFeed({
  guesses,
  emptyLabel = "Nothing yet — start typing.",
}: {
  guesses: LocalGuess[];
  emptyLabel?: string;
}) {
  return (
    <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      <AnimatePresence initial={false}>
        {guesses.map((guess) => (
          <motion.li
            key={guess.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              guess.outcome === "CORRECT"
                ? "bg-lime-500/15 font-semibold text-lime-500"
                : guess.outcome === "CLOSE"
                  ? "bg-solar-500/12 text-solar-500"
                  : "bg-ink-900/50 text-ink-400",
            )}
          >
            <span className="truncate">
              {guess.author ? (
                <span
                  className="mr-1.5 font-semibold"
                  style={{ color: nicknameAccent(guess.author) }}
                >
                  {guess.author}
                </span>
              ) : null}
              {guess.text}
            </span>
            {guess.outcome === "CLOSE" ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-bold">
                <Flame className="size-3.5" aria-hidden /> So close!
              </span>
            ) : null}
          </motion.li>
        ))}
      </AnimatePresence>

      {guesses.length === 0 ? (
        <li className="py-6 text-center text-xs text-ink-500">{emptyLabel}</li>
      ) : null}
    </ul>
  );
}
