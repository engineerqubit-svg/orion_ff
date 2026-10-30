"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** `00:42`, turning amber under 10s and pulsing pink for the final five. */
export function ScribbleTimer({
  secondsLeft,
  size = "md",
  className,
}: {
  secondsLeft: number;
  size?: "md" | "projector";
  className?: string;
}) {
  const urgent = secondsLeft <= 10;
  const critical = secondsLeft <= 5 && secondsLeft > 0;

  const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
  const seconds = Math.max(0, secondsLeft) % 60;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <motion.span
      key={critical ? secondsLeft : "steady"}
      animate={critical ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      role="timer"
      aria-live="off"
      className={cn(
        "font-display font-extrabold tabular tracking-tight",
        size === "projector" ? "text-5xl xl:text-7xl" : "text-2xl",
        critical ? "text-pulse-500" : urgent ? "text-solar-500" : "text-aqua-400",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}
