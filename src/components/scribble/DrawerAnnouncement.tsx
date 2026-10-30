"use client";

import { motion } from "framer-motion";
import { EyeOff, Pencil } from "lucide-react";

/**
 * Projector beat between rounds. The drawer is a secret — only their own screen
 * is told — so this announces *that* someone was picked, never who.
 */
export function DrawerAnnouncement({
  roundNumber,
  totalRounds,
  practice = false,
}: {
  roundNumber: number;
  totalRounds: number;
  practice?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-400">
        {practice ? "Practice round — no points" : `Round ${roundNumber} of ${totalRounds}`}
      </p>

      <motion.div
        initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mx-auto mt-8 flex size-28 items-center justify-center rounded-full border border-brand-500/50 bg-brand-500/15"
      >
        <motion.span
          animate={{ rotate: [0, -14, 14, -8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.4 }}
        >
          <Pencil className="size-12 text-brand-400" aria-hidden />
        </motion.span>
      </motion.div>

      <h1 className="mt-8 font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
        A secret artist has been chosen
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 inline-flex items-center gap-2 text-lg text-ink-400"
      >
        <EyeOff className="size-5" aria-hidden /> Check your screen — and keep it to yourself!
      </motion.p>
    </div>
  );
}
