"use client";

import { cn } from "@/lib/utils";

/**
 * Renders the masked word. Spaces between words are shown as a wider gap so the
 * room can see it's two words without learning any letters.
 */
export function WordHint({
  hint,
  letterCount,
  size = "md",
  className,
}: {
  hint: string | null;
  letterCount?: number | null;
  size?: "md" | "projector";
  className?: string;
}) {
  if (!hint) return null;

  const words = hint.split("   ");

  return (
    <div className={cn("text-center", className)}>
      {letterCount ? (
        <p
          className={cn(
            "font-semibold uppercase tracking-[0.24em] text-ink-400",
            size === "projector" ? "text-base xl:text-xl" : "text-[0.65rem]",
          )}
        >
          The word has {letterCount} letters
        </p>
      ) : null}

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-display font-extrabold text-ink-100",
          size === "projector" ? "text-4xl tracking-[0.3em] xl:text-6xl" : "text-xl tracking-[0.25em]",
        )}
        aria-label={`Word hint: ${hint}`}
      >
        {words.map((word, index) => (
          <span key={index}>{word}</span>
        ))}
      </div>
    </div>
  );
}
