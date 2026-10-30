import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-ink-500/50 bg-ink-700/50 text-ink-200",
        brand: "border-brand-500/45 bg-brand-500/12 text-brand-400",
        aqua: "border-aqua-500/45 bg-aqua-500/12 text-aqua-400",
        solar: "border-solar-500/45 bg-solar-500/12 text-solar-500",
        pulse: "border-pulse-500/45 bg-pulse-500/12 text-pulse-500",
        lime: "border-lime-500/45 bg-lime-500/12 text-lime-500",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
