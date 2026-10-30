"use client";

import { useEffect, useState } from "react";

export interface CountdownState {
  /** Whole seconds remaining, floored at 0. */
  secondsLeft: number;
  /** 0 -> 1 progress through the question. */
  progress: number;
  msLeft: number;
  expired: boolean;
}

/**
 * Countdown driven by the server clock.
 *
 * `endsAt` and `startedAt` are server timestamps and `now()` is server-corrected,
 * so every screen in the room shows the same number at the same moment.
 */
export function useCountdown(
  startedAt: number | undefined,
  endsAt: number | undefined,
  now: () => number,
  active: boolean,
): CountdownState {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active || !endsAt) return;
    const interval = setInterval(() => setTick((value) => value + 1), 100);
    return () => clearInterval(interval);
  }, [active, endsAt, startedAt]);

  void tick;

  if (!endsAt) {
    return { secondsLeft: 0, progress: 0, msLeft: 0, expired: !active };
  }

  const current = now();
  const msLeft = Math.max(0, endsAt - current);
  const total = startedAt ? Math.max(1, endsAt - startedAt) : 1;

  return {
    secondsLeft: Math.ceil(msLeft / 1000),
    progress: Math.min(1, Math.max(0, 1 - msLeft / total)),
    msLeft,
    expired: msLeft <= 0,
  };
}
