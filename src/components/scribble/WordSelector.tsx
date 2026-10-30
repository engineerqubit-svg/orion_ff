"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Three words, ten seconds. Silence means the first one is used. */
export function WordSelector({
  choices,
  onChoose,
  seconds = 10,
}: {
  choices: string[];
  onChoose: (word: string) => void;
  seconds?: number;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass w-full max-w-2xl rounded-xl3 p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-aqua-400">
        You&apos;re drawing
      </p>
      <h1 className="mt-3 font-display text-4xl font-extrabold">Choose a word</h1>
      <p className="mt-2 text-sm text-ink-400">
        {remaining > 0 ? `${remaining}s to pick — otherwise we choose for you.` : "Locking in…"}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {choices.map((word, index) => (
          <motion.button
            key={word}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={chosen !== null}
            onClick={() => {
              setChosen(word);
              onChoose(word);
            }}
            className={cn(
              "rounded-2xl border px-5 py-6 font-display text-xl font-bold transition-colors",
              chosen === word
                ? "border-lime-500/70 bg-lime-500/15 text-lime-500"
                : "border-ink-500/50 bg-ink-800/60 text-ink-100 active:border-brand-500/70 active:bg-brand-500/12",
            )}
          >
            {word}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
