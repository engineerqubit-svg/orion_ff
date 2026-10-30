"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Six-box PIN entry. Keeps a single hidden-ish input behind the boxes so mobile
 * keyboards, autofill and paste all behave, while the boxes handle the visuals.
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={6}
        value={value}
        disabled={disabled}
        aria-label="Game PIN, 6 digits"
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete?.(next);
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="pointer-events-none flex justify-center gap-2 sm:gap-3">
        {digits.map((digit, index) => {
          const filled = digit.trim().length > 0;
          const active = index === Math.min(value.length, 5) && !disabled;
          return (
            <div
              key={index}
              className={cn(
                "flex h-16 w-11 items-center justify-center rounded-xl border font-display text-3xl font-bold tabular transition-all sm:h-20 sm:w-14 sm:text-4xl",
                filled
                  ? "border-brand-500/60 bg-brand-500/10 text-ink-100"
                  : "border-ink-600/70 bg-ink-900/50 text-ink-500",
                active && "border-aqua-400 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-aqua-500)_22%,transparent)]",
              )}
            >
              {filled ? digit : <span className="text-ink-600">•</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
