import Link from "next/link";
import { cn } from "@/lib/utils";
import { FlameGlyph } from "@/components/arena/icons";

export function BrandMark({
  className,
  size = "md",
  href,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
}) {
  const sizes = {
    sm: { text: "text-sm tracking-[0.22em]", glyph: "size-3" },
    md: { text: "text-base tracking-[0.24em]", glyph: "size-3.5" },
    lg: { text: "text-lg tracking-[0.26em]", glyph: "size-4" },
  } as const;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-[0.45em] font-display font-semibold uppercase",
        sizes[size].text,
        className,
      )}
    >
      <span className="brand-gradient-text">Qubit</span>
      <FlameGlyph className={cn(sizes[size].glyph, "shrink-0 text-ink-500")} aria-hidden />
      <span className="text-ink-200">Diwali Arena</span>
    </span>
  );

  return href ? (
    <Link href={href} className="rounded-lg transition-opacity active:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}
