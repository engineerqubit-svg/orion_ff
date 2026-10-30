"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-lg border border-ink-600/70 bg-ink-900/60 px-4 text-sm text-ink-100 placeholder:text-ink-400 transition-colors",
        "focus:border-brand-500/70 focus:bg-ink-900/80 disabled:opacity-50",
        invalid && "border-pulse-500/70 focus:border-pulse-500",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "w-full rounded-lg border border-ink-600/70 bg-ink-900/60 px-4 py-3 text-sm text-ink-100 placeholder:text-ink-400 transition-colors resize-y",
      "focus:border-brand-500/70 disabled:opacity-50",
      invalid && "border-pulse-500/70",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
