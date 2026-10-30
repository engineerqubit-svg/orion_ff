"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRealtimeProvider } from "@/lib/realtime";
import type { ConnectionStatus, ServerEvent } from "@/types/realtime";

export interface UseRealtimeOptions {
  gameId: string | null;
  role: "HOST" | "PLAYER";
  playerId?: string;
  playerToken?: string;
  onEvent: (event: ServerEvent) => void;
  enabled?: boolean;
}

export interface UseRealtimeResult {
  status: ConnectionStatus;
  /** Server-corrected clock. Use this for every countdown, never `Date.now()`. */
  serverNow: () => number;
}

/**
 * Subscribes a screen to its game channel.
 *
 * Two things worth knowing:
 *  - The handler is held in a ref, so re-renders never tear down the connection.
 *  - Every event carries the server's clock, which we use to maintain an offset.
 *    Timers then run against server time, so a laptop with a skewed clock still
 *    counts down in step with the projector.
 */
export function useRealtime({
  gameId,
  role,
  playerId,
  playerToken,
  onEvent,
  enabled = true,
}: UseRealtimeOptions): UseRealtimeResult {
  const [status, setStatus] = useState<ConnectionStatus>("IDLE");
  const handlerRef = useRef(onEvent);
  const offsetRef = useRef(0);

  // Kept in sync after commit so a re-render never tears down the connection.
  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    if (!gameId || !enabled) return;

    const provider = createRealtimeProvider({ gameId, role, playerId, playerToken });

    const unsubscribeStatus = provider.onStatusChange(setStatus);
    const unsubscribeEvents = provider.subscribe((event) => {
      if (typeof event.at === "number") {
        const sample = event.at - Date.now();
        // Light smoothing keeps a single slow response from jerking the countdown.
        offsetRef.current = offsetRef.current === 0 ? sample : offsetRef.current * 0.7 + sample * 0.3;
      }
      handlerRef.current(event);
    });

    void provider.connect();

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      provider.disconnect();
    };
  }, [gameId, role, playerId, playerToken, enabled]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { status, serverNow };
}
