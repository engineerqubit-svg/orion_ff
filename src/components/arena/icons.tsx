import type { SVGProps } from "react";

/**
 * A handful of house-made glyphs for the moments that matter most (the
 * wordmark badge, the join CTA, the ticket stub) — sized and stroked to
 * drop in anywhere a lucide icon is used (24x24, currentColor, 1.75 stroke)
 * but not another copy of the same icon set every AI-built site reaches
 * for first.
 */

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor" } as const;
const strokeProps = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A lit diya flame — stands in for "sparkle/new" badges. */
export function FlameGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path
        {...strokeProps}
        d="M12 2.5c2.4 3.1 3.6 5.4 3.6 7.6a3.6 3.6 0 1 1-7.2 0c0-.9.3-1.7.8-2.5-.3 1.6.2 2.6 1 3.1-.4-2 .4-4.3 1.8-8.2Z"
      />
      <path {...strokeProps} d="M4.5 18.5c2-1.6 4.8-2.5 7.5-2.5s5.5.9 7.5 2.5" />
      <path {...strokeProps} d="M3 21c2.4-1.9 5.8-3 9-3s6.6 1.1 9 3" />
    </svg>
  );
}

/** A torn-stub ticket — the join CTA and the ticket-card eyebrow. */
export function TicketGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path
        {...strokeProps}
        d="M3 9.5a2 2 0 0 0 0-3.8V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v.7a2 2 0 0 0 0 3.8V9a1 1 0 0 1 0 .2v3.6a2 2 0 0 1 0 3.8v.7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-.7a2 2 0 0 0 0-3.8Z"
      />
      <path {...strokeProps} d="M15 4.5v15" strokeDasharray="1.5 2.5" />
    </svg>
  );
}

/** Film clapperboard — the Bollywood-night cue, standing in for a generic game controller. */
export function ClapperGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path {...strokeProps} d="M3.5 10.5h17L19 20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1l-1.5-9.5Z" />
      <path {...strokeProps} d="M3.3 9 4 5.3a1 1 0 0 1 1.17-.79l13.6 2.5a1 1 0 0 1 .8 1.17L19.2 10" />
      <path {...strokeProps} d="M6.8 5.1 9 9.3M11.6 5.9 13.8 10M16.4 6.8l2.2 4.1" />
    </svg>
  );
}

/** Five-point spark burst — a firework beat for leaderboard/winner moments. */
export function SparkBurstGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <line
          key={angle}
          {...strokeProps}
          x1="12"
          y1="12"
          x2={12 + 8.5 * Math.sin((angle * Math.PI) / 180)}
          y2={12 - 8.5 * Math.cos((angle * Math.PI) / 180)}
        />
      ))}
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
