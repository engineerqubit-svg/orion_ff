/**
 * Light, warm, quiet backdrop — soft ivory, a faint marigold blush from
 * the top, a small block-print dot texture, and grain so it reads as warm
 * card stock rather than a flat digital fill. Deliberately one soft effect,
 * not several stacked ones — "subtle" was the explicit ask after an
 * earlier pass piled on a spotlight, a second glow pool and a heavy
 * vignette at once.
 */
export function ArenaBackground({ dense = false }: { dense?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-ink-950" />

      {/* faint marigold blush, top-centre */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh] opacity-70"
        style={{
          background:
            "radial-gradient(60% 65% at 50% -10%, color-mix(in oklab, var(--color-brand-500) 19%, transparent), transparent 72%)",
        }}
      />

      {/* block-print dot texture — fabric/card-stock quality, not a flat vector fill */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--color-ink-500) 60%, transparent) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      />

      {dense ? (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 48px, color-mix(in oklab, var(--color-ink-100) 4%, transparent) 48px 49px)",
            maskImage: "radial-gradient(ellipse at 50% 20%, black 0%, transparent 70%)",
          }}
        />
      ) : null}

      <div className="grain-overlay" />
    </div>
  );
}
