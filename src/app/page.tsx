"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { FestiveLights } from "@/components/arena/festive-lights";
import { GroundFestivity } from "@/components/arena/ground-decor";
import { FlameGlyph } from "@/components/arena/icons";
import { PinInput } from "@/components/arena/pin-input";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api/client";

/**
 * A single full-bleed poster, not a marketing hero beside a signup card —
 * there's no one to convince here, just a PIN to type, so the PIN entry is
 * the poster's own focal point instead of something tucked beside it.
 */
export default function LandingPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  async function joinWithPin(candidate: string) {
    if (candidate.length !== 6 || checking) return;
    setChecking(true);
    try {
      await apiFetch<{ gameId: string }>(`/api/games/pin/${candidate}`);
      router.push(`/play/${candidate}`);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "We couldn't check that PIN. Try again.";
      toast.error(message);
      setChecking(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <ArenaBackground dense />
      <FestiveLights />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <BrandMark size="sm" />
          <Button variant="ghost" size="sm" asChild>
            <a href="/host">
              Host sign in <ArrowRight aria-hidden />
            </a>
          </Button>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-1 flex-col items-center justify-center py-10 text-center"
        >
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-brand-400">
            <span className="h-px w-8 bg-brand-500/50" />
            <FlameGlyph className="size-3.5" aria-hidden />
            Diwali Bollywood Night
            <FlameGlyph className="size-3.5" aria-hidden />
            <span className="h-px w-8 bg-brand-500/50" />
          </p>

          <h1 className="mt-5 font-display text-projector-hero font-extrabold uppercase leading-[0.9] text-ink-100">
            Qubit
            <br />
            <span className="brand-gradient-text">Diwali Arena</span>
          </h1>

          <p className="mt-4 font-display text-xl italic text-ink-200 sm:text-2xl">
            Ready. Set. Quiz.
          </p>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-300">
            Everyone plays from their own phone. The big screen keeps score. No
            apps, no sign-ups — just a six-digit PIN.
          </p>

          <div className="mt-9 w-full max-w-xs">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-300">
              Enter game PIN
            </p>

            <form
              className="mt-5"
              onSubmit={(event) => {
                event.preventDefault();
                void joinWithPin(pin);
              }}
            >
              <PinInput value={pin} onChange={setPin} onComplete={(v) => void joinWithPin(v)} disabled={checking} />

              <Button
                type="submit"
                size="xl"
                className="mt-7 w-full"
                loading={checking}
                disabled={pin.length !== 6}
              >
                Join Game
              </Button>
            </form>

            <p className="mt-5 text-xs text-ink-400">
              Scan the QR code on the big screen to skip this step.
            </p>
          </div>
        </motion.div>

        <GroundFestivity className="pb-3" />
      </div>
    </main>
  );
}
