"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useRealtime } from "@/hooks/use-realtime";
import type { HostGameView } from "@/lib/game-engine/engine";
import type { ServerEvent } from "@/types/realtime";

/**
 * The game-state half shared by every host-side screen (display, control).
 * Each screen keeps its own realtime subscription and its own copy of
 * `view` — the server's SSE bus is a broadcast, so any number of screens can
 * watch the same game at once with no coordination between them.
 *
 * Side effects that differ per screen (sound on the display, none on the
 * control panel) are left to the caller via `onServerEvent`.
 */
export function useHostGameView(gameId: string, onServerEvent?: (event: ServerEvent) => void) {
  const [view, setView] = useState<HostGameView | null>(null);
  const onServerEventRef = useRef(onServerEvent);

  useEffect(() => {
    onServerEventRef.current = onServerEvent;
  });

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch<{ view: HostGameView }>(`/api/games/${gameId}`);
      setView(response.view);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Lost sync with the game.");
    }
  }, [gameId]);

  useEffect(() => {
    // Initial load: an async fetch that resolves after commit, not a sync setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      onServerEventRef.current?.(event);

      switch (event.type) {
        // High-frequency counter: update in place instead of refetching per answer.
        case "ANSWER_SUBMITTED":
          setView((current) =>
            current ? { ...current, answeredCount: event.answeredCount } : current,
          );
          return;
        default:
          void refresh();
      }
    },
    [refresh],
  );

  const { status: connection, serverNow } = useRealtime({
    gameId,
    role: "HOST",
    onEvent: handleEvent,
  });

  return { view, connection, serverNow, refresh };
}
