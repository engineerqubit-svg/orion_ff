"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { StrokeBuffer } from "@/lib/scribble/stroke-buffer";
import type { ServerEvent } from "@/types/realtime";
import type { ScribbleServerEvent } from "@/types/scribble";

const SCRIBBLE_EVENTS = new Set<string>([
  "DRAW_STROKE",
  "CLEAR_CANVAS",
  "UNDO_STROKE",
  "GUESS_CORRECT",
  "GUESS_WRONG",
  "DRAWER_CHOSEN",
  "WORD_SELECTED",
  "ROUND_STARTED",
  "HINT_UPDATED",
  "ROUND_ENDED",
  "SCRIBBLE_LEADERBOARD",
  "SCRIBBLE_STATE_SYNC",
  "SCRIBBLE_GAME_OVER",
  "SCRIBBLE_PAUSED",
  "SCRIBBLE_TUTORIAL",
]);

/**
 * Applied locally with no refetch; everything else means "refetch your view".
 * Wrong guesses are here because 50 people typing would otherwise mean 50
 * refetches per keystroke-burst.
 */
const LOCAL_EVENTS = new Set<string>(["DRAW_STROKE", "CLEAR_CANVAS", "UNDO_STROKE", "GUESS_WRONG"]);

export interface UseScribbleSyncOptions {
  gameId: string | null;
  role: "HOST" | "PLAYER";
  playerId?: string;
  playerToken?: string;
  /** Called when a phase-changing event arrives. Should refetch the caller's view. */
  onRefresh: () => void;
  /** Extra handling for events the caller cares about (sounds, toasts, feeds). */
  onEvent?: (event: ScribbleServerEvent) => void;
  /** True for strokes this client drew itself — echoes are skipped to avoid doubling. */
  isOwnStroke?: (strokeId: string) => boolean;
}

/**
 * Shared realtime plumbing for both Scribble screens.
 *
 * Stroke deltas land straight in the `StrokeBuffer` and never touch React state,
 * so eight canvas updates a second cost no re-renders. Phase changes trigger one
 * refetch of the caller's own view — which keeps the word server-side, since the
 * projector and the guessers are simply never sent it.
 */
export function useScribbleSync({
  gameId,
  role,
  playerId,
  playerToken,
  onRefresh,
  onEvent,
  isOwnStroke,
}: UseScribbleSyncOptions) {
  const buffer = useMemo(() => new StrokeBuffer(), []);
  const refreshRef = useRef(onRefresh);
  const eventRef = useRef(onEvent);
  const ownRef = useRef(isOwnStroke);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
    eventRef.current = onEvent;
    ownRef.current = isOwnStroke;
  });

  /** Coalesces bursts (several correct guesses at once) into a single fetch. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      refreshRef.current();
    }, 120);
  }, []);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (!SCRIBBLE_EVENTS.has(event.type)) {
        // Lobby traffic (players joining/leaving) still matters to both screens.
        if (event.type === "PLAYER_JOINED" || event.type === "PLAYER_LEFT" || event.type === "PLAYER_KICKED") {
          scheduleRefresh();
        }
        return;
      }

      const scribbleEvent = event as ScribbleServerEvent;

      switch (scribbleEvent.type) {
        case "DRAW_STROKE":
          // The drawer already painted this locally.
          if (!ownRef.current?.(scribbleEvent.strokeId)) {
            buffer.applyDelta(
              scribbleEvent.strokeId,
              scribbleEvent.color,
              scribbleEvent.width,
              scribbleEvent.points,
              scribbleEvent.erase,
            );
          }
          break;
        case "CLEAR_CANVAS":
          buffer.clear();
          break;
        case "UNDO_STROKE":
          buffer.remove(scribbleEvent.strokeId);
          break;
        default:
          break;
      }

      eventRef.current?.(scribbleEvent);
      if (!LOCAL_EVENTS.has(scribbleEvent.type)) scheduleRefresh();
    },
    [buffer, scheduleRefresh],
  );

  const { status, serverNow } = useRealtime({
    gameId,
    role,
    playerId,
    playerToken,
    onEvent: handleEvent,
  });

  return { buffer, connection: status, serverNow };
}
