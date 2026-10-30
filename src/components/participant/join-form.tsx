"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TicketPanel } from "@/components/arena/ticket-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { PlayerSession } from "@/hooks/use-player-session";
import { formatGamePin } from "@/lib/ids";
import { nicknameSchema } from "@/lib/validation/schemas";

interface JoinResponse {
  gameId: string;
  gamePin: string;
  playerId: string;
  playerToken: string;
  nickname: string;
}

/** Nickname step. The PIN is already known from the URL or the QR code. */
export function JoinForm({
  gamePin,
  onJoined,
}: {
  gamePin: string;
  onJoined: (session: PlayerSession) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That nickname won't work.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch<JoinResponse>("/api/play/join", {
        method: "POST",
        json: { gamePin, nickname: parsed.data },
      });
      onJoined({
        gameId: response.gameId,
        gamePin: response.gamePin,
        playerId: response.playerId,
        playerToken: response.playerToken,
        nickname: response.nickname,
      });
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "We couldn't join that game.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex flex-1 flex-col items-center justify-center"
    >
      <TicketPanel eyebrow="Your seat" className="max-w-sm">
        <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-ink-400">
          Game PIN
        </p>
        <p className="mt-1 text-center font-display text-4xl font-extrabold tabular text-ink-100">
          {formatGamePin(gamePin)}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <Label htmlFor="nickname">Your nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="e.g. Pritish"
            maxLength={20}
            autoFocus
            autoComplete="off"
            invalid={Boolean(error)}
            aria-describedby={error ? "nickname-error" : undefined}
            className="h-14 text-center text-lg"
          />
          <div className="flex items-center justify-between px-1 text-xs">
            <span id="nickname-error" className={error ? "text-pulse-500" : "text-ink-500"}>
              {error ?? "2–20 characters"}
            </span>
            <span className="tabular text-ink-500">{nickname.length}/20</span>
          </div>

          <Button type="submit" size="xl" className="w-full" loading={submitting}>
            Join Game
          </Button>
        </form>
      </TicketPanel>
    </motion.div>
  );
}
