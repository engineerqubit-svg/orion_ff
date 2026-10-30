"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { ClapperGlyph } from "@/components/arena/icons";
import { cn } from "@/lib/utils";

const MODES = [
  {
    href: "/host/quizzes",
    number: "01",
    label: "Quiz Battle",
    blurb: "Four options, one answer, points for speed.",
    icon: ClapperGlyph,
    accent: "var(--color-brand-500)",
  },
  {
    href: "/admin/scribble",
    number: "02",
    label: "Scribble",
    blurb: "One draws, everybody races to guess it.",
    icon: Pencil,
    accent: "var(--color-aqua-500)",
  },
] as const;

/** The fork at the top of the dashboard: which game are we playing today? */
export function GameModePicker() {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-ink-400">Diwali Night</p>
      <h2 className="mt-1 font-display text-2xl font-bold">Choose a game</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {MODES.map((mode, index) => (
          <motion.div
            key={mode.href}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Link
              href={mode.href}
              className={cn(
                "panel group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 transition-colors",
                "active:border-ink-400/40",
              )}
              style={{ borderBottom: `2px solid color-mix(in oklab, ${mode.accent} 55%, transparent)` }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-3 font-display text-6xl font-bold text-ink-100/[0.05]"
              >
                {mode.number}
              </span>
              <mode.icon
                className="size-8 shrink-0 transition-transform group-active:scale-110"
                style={{ color: mode.accent }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-display text-xl font-bold uppercase tracking-wide text-ink-100">
                  {mode.label}
                </span>
                <span className="mt-0.5 block text-sm text-ink-400">{mode.blurb}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
