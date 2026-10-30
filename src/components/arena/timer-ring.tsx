"use client";

import { cn } from "@/lib/utils";

/** Countdown ring. Turns amber at 40% remaining and pink in the last few seconds. */
export function TimerRing({
  secondsLeft,
  progress,
  size = 120,
  className,
}: {
  secondsLeft: number;
  progress: number;
  size?: number;
  className?: string;
}) {
  const stroke = size / 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, 1 - progress);

  const colour =
    remaining > 0.4
      ? "var(--color-aqua-500)"
      : remaining > 0.15
        ? "var(--color-solar-500)"
        : "var(--color-pulse-500)";

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - remaining)}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 400ms ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-display font-bold tabular"
        style={{ fontSize: size / 2.6, color: colour }}
        role="timer"
        aria-live="off"
      >
        {secondsLeft}
      </div>
    </div>
  );
}
