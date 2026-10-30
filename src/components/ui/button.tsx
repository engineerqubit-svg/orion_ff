"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        // Touch has no cursor, so feedback lives on `:active` (press/release)
        // instead of `:hover` — `:hover` on a touchscreen can stick after a
        // tap until the next touch elsewhere, which looks like a UI bug.
        primary:
          "brand-gradient-bg text-ink-100 shadow-[0_10px_28px_-10px_var(--color-brand-500)] active:brightness-105",
        secondary:
          "bg-ink-700/70 text-ink-100 border border-ink-500/50 active:bg-ink-600/70 active:border-ink-400/60",
        ghost: "text-ink-200 active:bg-ink-700/60 active:text-ink-100",
        outline:
          "border border-brand-500/45 text-ink-100 bg-brand-500/5 active:bg-brand-500/15 active:border-brand-400/70",
        danger:
          "bg-pulse-500/15 text-pulse-500 border border-pulse-500/40 active:bg-pulse-500/25",
        success:
          "bg-lime-500/15 text-lime-500 border border-lime-500/40 active:bg-lime-500/25",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-13 px-7 text-base [&_svg]:size-5",
        xl: "h-16 px-9 text-lg [&_svg]:size-6 rounded-xl",
        icon: "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      // Slot forwards to exactly one child, so no spinner is injected here.
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          aria-disabled={disabled || undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
