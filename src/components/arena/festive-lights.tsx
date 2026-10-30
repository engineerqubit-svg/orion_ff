/**
 * Diwali string lights + hanging akash kandil lanterns. Pure decoration —
 * kept off functional/gameplay screens (questions, leaderboard, dashboard)
 * and used only at arrival moments: the landing page, host sign-in, and the
 * lobby screen before a game starts. Gold-only by design, see globals.css.
 */

const BULBS = [
  [60, 35], [150, 80], [240, 122], [330, 88], [420, 40],
  [540, 35], [630, 80], [720, 122], [810, 88], [900, 40],
  [1020, 35], [1110, 80], [1200, 122], [1290, 88], [1380, 40],
] as const;

export function StringLights({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 140"
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: "auto" }}
      aria-hidden
    >
      <path
        d="M0,10 Q240,130 480,20 Q720,130 960,20 Q1200,130 1440,10"
        fill="none"
        stroke="var(--color-ink-500)"
        strokeWidth={1.5}
        opacity={0.5}
      />
      {BULBS.map(([x, y], i) => {
        const warm = i % 4 === 0;
        const colour = warm ? "var(--color-solar-500)" : "var(--color-brand-400)";
        return (
          <g
            key={i}
            style={{
              animation: "var(--animate-twinkle)",
              animationDelay: `${(i * 0.37) % 3.2}s`,
              transformOrigin: `${x}px ${y}px`,
            }}
          >
            <circle cx={x} cy={y} r={11} fill={colour} opacity={0.3} />
            <circle cx={x} cy={y} r={4} fill={colour} />
          </g>
        );
      })}
    </svg>
  );
}

function LanternGlyph({ tone }: { tone: "gold" | "ruby" }) {
  const top = tone === "gold" ? "var(--color-brand-400)" : "#c75a6e";
  const mid = tone === "gold" ? "var(--color-brand-500)" : "var(--color-pulse-500)";
  const deep = tone === "gold" ? "var(--color-brand-600)" : "#6e1727";
  const glowColour = tone === "gold" ? "rgba(199,132,26,0.65)" : "rgba(176,45,68,0.6)";
  const gradientId = `lantern-grad-${tone}`;

  return (
    <svg
      viewBox="0 0 120 230"
      className="h-full w-full"
      style={{ filter: `drop-shadow(0 0 28px ${glowColour})` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${gradientId}-glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${gradientId}-burst`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={top} stopOpacity={0.5} />
          <stop offset="100%" stopColor={top} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* soft radiant burst — a sky lantern reads as a light source, not just an object */}
      <g style={{ animation: "var(--animate-twinkle)", transformOrigin: "60px 115px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={i}
            x1={60}
            y1={115}
            x2={60 + 56 * Math.cos((i * Math.PI) / 4)}
            y2={115 + 56 * Math.sin((i * Math.PI) / 4)}
            stroke={top}
            strokeWidth={1}
            opacity={0.3}
          />
        ))}
        <circle cx={60} cy={115} r={50} fill={`url(#${gradientId}-burst)`} />
      </g>

      {/* hanging thread */}
      <line x1={60} y1={0} x2={60} y2={34} stroke="var(--color-ink-400)" strokeWidth={1.5} />
      {/* brass fitting */}
      <rect x={52} y={30} width={16} height={8} rx={2} fill="var(--color-ink-300)" />

      {/* body — a rounded gem/kandil silhouette */}
      <polygon
        points="60,40 84,62 96,95 96,135 84,168 60,190 36,168 24,135 24,95 36,62"
        fill={`url(#${gradientId})`}
        stroke="var(--color-ink-100)"
        strokeWidth={1}
      />

      {/* lit-from-within glow */}
      <ellipse cx={60} cy={115} rx={30} ry={38} fill={`url(#${gradientId}-glow)`} />

      {/* rib seams */}
      <line x1={42} y1={60} x2={42} y2={170} stroke="var(--color-ink-100)" strokeWidth={1} opacity={0.22} />
      <line x1={78} y1={60} x2={78} y2={170} stroke="var(--color-ink-100)" strokeWidth={1} opacity={0.22} />

      {/* trim bands */}
      <line x1={26} y1={70} x2={94} y2={70} stroke="var(--color-ink-100)" strokeWidth={1.5} opacity={0.4} />
      <line x1={26} y1={158} x2={94} y2={158} stroke="var(--color-ink-100)" strokeWidth={1.5} opacity={0.4} />

      {/* tassel */}
      <line x1={60} y1={190} x2={48} y2={222} stroke="var(--color-ink-300)" strokeWidth={1.5} />
      <line x1={60} y1={190} x2={60} y2={226} stroke="var(--color-ink-300)" strokeWidth={1.5} />
      <line x1={60} y1={190} x2={72} y2={222} stroke="var(--color-ink-300)" strokeWidth={1.5} />
    </svg>
  );
}

/** A single hanging lantern, positioned by the caller. */
export function HangingLantern({
  tone = "gold",
  height = 230,
  className,
  delay = "0s",
}: {
  tone?: "gold" | "ruby";
  height?: number;
  className?: string;
  delay?: string;
}) {
  return (
    <div
      className={className}
      style={{
        height,
        animation: "var(--animate-lantern-sway)",
        animationDelay: delay,
        transformOrigin: "top center",
      }}
    >
      <LanternGlyph tone={tone} />
    </div>
  );
}

/**
 * Full composition: string lights along the top edge, framed by two
 * lanterns hanging from the corners. Drop it just under a full-bleed
 * background — absolutely positioned, non-interactive, clipped to avoid
 * horizontal scroll on narrow screens.
 */
export function FestiveLights() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[5]" aria-hidden>
      <StringLights className="opacity-80" />
      {/* Lanterns hang from below the header row (BrandMark sits top-left on
          every screen this is used on) so they never crowd the logo on a
          phone, where there's no spare width to dodge it sideways. */}
      <HangingLantern
        tone="gold"
        height={180}
        className="absolute left-[2%] top-12 w-14 sm:left-[4%] sm:top-14 sm:w-24"
      />
      <HangingLantern
        tone="ruby"
        height={150}
        delay="-2.4s"
        className="absolute right-[2%] top-12 w-12 sm:right-[6%] sm:top-14 sm:w-20"
      />
    </div>
  );
}
