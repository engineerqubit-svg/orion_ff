"use client";

import { animate, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import { formatScore } from "@/lib/utils";

/** Animated score counter. Falls straight to the final value if motion is reduced. */
export function CountUp({ value, duration = 1 }: { value: number; duration?: number }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion still lands on the final value — it just gets there at once.
    const controls = animate(motionValue, value, {
      duration: reduce ? 0 : duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, duration, motionValue]);

  return <span className="tabular">{formatScore(display)}</span>;
}
