"use client";

import { motion } from "framer-motion";
import { EyeOff, Flame, Gauge, Lightbulb, Pencil, Scale, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: EyeOff,
    title: "A secret artist is picked",
    body: "Each round one person is chosen to draw. Only their own screen knows — keep it hidden!",
  },
  {
    icon: Pencil,
    title: "They pick a word and draw it",
    body: "Three words to choose from, 10 seconds to decide. No letters or numbers in the drawing.",
  },
  {
    icon: Gauge,
    title: "Everyone else guesses — fast",
    body: "Type as many guesses as you like. The quicker you get it, the more points: 1000 down to 300.",
  },
  {
    icon: Users,
    title: "Wrong guesses are public",
    body: "Everybody sees the misses. If you're one letter off you'll see “So close!” — just for you.",
  },
  {
    icon: Lightbulb,
    title: "Hints appear as time runs",
    body: "A letter is revealed halfway through, and another at the three-quarter mark.",
  },
  {
    icon: Scale,
    title: "Drawing is fair",
    body: "The artist earns what the average correct guesser earned — draw clearly and nobody falls behind for not drawing.",
  },
  {
    icon: Flame,
    title: "The last two rounds are blind",
    body: "No leaderboard at the end — standings stay secret until the winner is revealed.",
  },
  {
    icon: Trophy,
    title: "Most points wins",
    body: "Watch the big screen for the final reveal.",
  },
] as const;

/** Rules screen for the projector (`size="projector"`) and every phone. */
export function HowToPlay({ size = "phone" }: { size?: "phone" | "projector" }) {
  const projector = size === "projector";

  return (
    <div className={cn("w-full text-center", projector ? "max-w-6xl" : "max-w-md")}>
      <p
        className={cn(
          "font-bold uppercase tracking-[0.3em] text-aqua-400",
          projector ? "text-sm" : "text-xs",
        )}
      >
        Scribble
      </p>
      <h1
        className={cn(
          "mt-2 font-display font-extrabold uppercase brand-gradient-text",
          projector ? "text-5xl xl:text-7xl" : "text-3xl",
        )}
      >
        How to play
      </h1>

      <ol
        className={cn(
          "text-left",
          projector ? "mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4" : "mt-6 space-y-2.5",
        )}
      >
        {STEPS.map((step, index) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * (projector ? 0.25 : 0.08) }}
            className={cn(
              "glass flex gap-3 rounded-2xl",
              projector ? "flex-col p-5" : "items-start p-3.5",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400",
                projector ? "size-11" : "size-9",
              )}
            >
              <step.icon className={projector ? "size-6" : "size-5"} aria-hidden />
            </span>
            <div>
              <p
                className={cn(
                  "font-display font-bold text-ink-100",
                  projector ? "text-xl" : "text-sm",
                )}
              >
                {index + 1}. {step.title}
              </p>
              <p className={cn("mt-1 text-ink-400", projector ? "text-base" : "text-xs")}>
                {step.body}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
