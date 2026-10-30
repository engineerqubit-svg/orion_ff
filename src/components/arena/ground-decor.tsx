import { cn } from "@/lib/utils";

/**
 * Ground-level Diwali decoration: a bunting garland of diya / flower /
 * firework icons strung along a dashed line. Rendered in normal document
 * flow (not absolutely positioned) so it always has room to show and never
 * fights the layout above it for space.
 *
 * Every icon is deliberately just 2-3 flat shapes. At the ~28-36px size
 * these render on a phone, anything finer (rim lines, gradients layered on
 * gradients, inner glow shapes) turns into an unreadable smear — a bolder,
 * flatter silhouette is what actually survives being that small.
 */

function DiyaGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" aria-hidden>
      <path
        d="M16,3 C10,10 9,17 16,23 C22,17 21,10 16,3 Z"
        fill="var(--color-brand-400)"
      />
      <path
        d="M3,22 Q16,15 29,22 Q23,30 16,30 Q9,30 3,22 Z"
        fill="var(--color-brand-600)"
        stroke="var(--color-ink-100)"
        strokeWidth={1.2}
      />
    </svg>
  );
}

const FLOWER_PETAL_COLOURS = ["var(--color-brand-500)", "var(--color-pulse-500)"];

function FlowerGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <ellipse
          key={i}
          cx={16}
          cy={16}
          rx={7}
          ry={3.2}
          fill={FLOWER_PETAL_COLOURS[i % FLOWER_PETAL_COLOURS.length]}
          transform={`rotate(${i * 60} 16 16) translate(8 0)`}
        />
      ))}
      <circle cx={16} cy={16} r={4} fill="var(--color-solar-500)" />
    </svg>
  );
}

const SPARK_ANGLES = [-42, -20, 0, 20, 42];

function FireworkGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" aria-hidden>
      <path
        d="M11,30 L13,18 L19,18 L21,30 Z"
        fill="var(--color-pulse-500)"
        stroke="var(--color-ink-100)"
        strokeWidth={1}
      />
      {SPARK_ANGLES.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={16}
            y1={16}
            x2={16 + 11 * Math.sin(rad)}
            y2={16 - 11 * Math.cos(rad)}
            stroke="var(--color-solar-500)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={16} cy={16} r={2.2} fill="var(--color-ink-100)" />
    </svg>
  );
}

const GARLAND_ICONS = [DiyaGlyph, FlowerGlyph, FireworkGlyph] as const;
const GARLAND_ANIMATIONS = [
  "var(--animate-flicker)",
  "var(--animate-twinkle)",
  "var(--animate-twinkle)",
] as const;

function GarlandItem({ index }: { index: number }) {
  const Icon = GARLAND_ICONS[index % GARLAND_ICONS.length]!;
  const animation = GARLAND_ANIMATIONS[index % GARLAND_ANIMATIONS.length]!;

  return (
    <div className="flex flex-col items-center">
      <div className="h-2.5 w-px bg-ink-400/50 sm:h-3" />
      <div
        className="w-7 sm:w-9"
        style={{ animation, animationDelay: `${(index * 0.37) % 2.6}s`, transformOrigin: "50% 30%" }}
      >
        <Icon />
      </div>
    </div>
  );
}

/** A dashed string with alternating diya / flower / firework icons hanging off it. */
export function GroundFestivity({ count = 9, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("border-t border-dashed border-ink-400/40", className)} aria-hidden>
      <div className="flex items-start justify-between px-2 pt-0 sm:px-4">
        {Array.from({ length: count }).map((_, i) => (
          <GarlandItem key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
