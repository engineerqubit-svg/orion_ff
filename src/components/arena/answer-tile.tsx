"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shape + colour together, so the option is identifiable without relying on hue. */
export const ANSWER_SHAPES = ["▲", "◆", "●", "■"] as const;
export const ANSWER_KEYS = ["A", "B", "C", "D"] as const;

const TONES = [
  { bg: "var(--color-answer-a)", soft: "var(--color-answer-a-soft)" },
  { bg: "var(--color-answer-b)", soft: "var(--color-answer-b-soft)" },
  { bg: "var(--color-answer-c)", soft: "var(--color-answer-c-soft)" },
  { bg: "var(--color-answer-d)", soft: "var(--color-answer-d-soft)" },
] as const;

export function answerTone(index: number) {
  return TONES[index % TONES.length]!;
}

interface AnswerTileProps {
  index: number;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** After reveal: mark the right answer and dim the rest. */
  revealed?: "correct" | "wrong" | null;
  size?: "participant" | "projector";
}

export function AnswerTile({
  index,
  text,
  onClick,
  disabled,
  selected,
  revealed = null,
  size = "participant",
}: AnswerTileProps) {
  const tone = answerTone(index);
  const dimmed = revealed !== null && revealed !== "correct" && !selected;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: dimmed ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05 }}
      aria-label={`Option ${ANSWER_KEYS[index]}: ${text}`}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border text-left transition-all",
        size === "participant" ? "min-h-[5.5rem] p-4 sm:min-h-[6.5rem] sm:p-5" : "min-h-[7rem] p-6",
        disabled ? "cursor-default" : "cursor-pointer",
        selected ? "ring-2 ring-offset-2 ring-offset-ink-950" : "",
        revealed === "correct" && "ring-2 ring-lime-500 ring-offset-2 ring-offset-ink-950",
      )}
      style={{
        background: `linear-gradient(135deg, ${tone.bg}22, ${tone.soft})`,
        borderColor: `${tone.bg}66`,
        ...(selected ? { boxShadow: `0 0 0 2px ${tone.bg}` } : {}),
      }}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl font-bold text-white",
          size === "participant" ? "size-12 text-xl sm:size-14 sm:text-2xl" : "size-16 text-3xl",
        )}
        style={{ background: tone.bg, boxShadow: `0 8px 24px -10px ${tone.bg}` }}
        aria-hidden
      >
        {ANSWER_SHAPES[index]}
      </span>

      <span
        className={cn(
          "flex-1 font-semibold text-ink-100",
          size === "participant" ? "text-base sm:text-xl" : "text-2xl xl:text-4xl",
        )}
      >
        {text}
      </span>

      {revealed === "correct" ? (
        <Check className="size-7 shrink-0 text-lime-500" aria-hidden />
      ) : null}
      {revealed === "wrong" && selected ? (
        <X className="size-7 shrink-0 text-pulse-500" aria-hidden />
      ) : null}
    </motion.button>
  );
}
