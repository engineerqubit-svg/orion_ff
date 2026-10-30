"use client";

import { useCallback, useSyncExternalStore } from "react";
import { noopSubscribe, readKey, subscribeToKey, writeKey } from "@/lib/local-store";

export interface PlayerSession {
  gameId: string;
  gamePin: string;
  playerId: string;
  playerToken: string;
  nickname: string;
}

const STORAGE_KEY = "qubit-arena-player-session";

function parse(raw: string): PlayerSession | null {
  const parsed = JSON.parse(raw) as Partial<PlayerSession>;
  if (!parsed.gameId || !parsed.playerId || !parsed.playerToken) return null;
  return parsed as PlayerSession;
}

/**
 * Persists the participant's identity so a refresh, a locked phone or a dropped
 * connection can be recovered. The token is validated server-side on every use —
 * nothing stored here is trusted on its own.
 */
export function usePlayerSession() {
  const session = useSyncExternalStore(
    (listener) => subscribeToKey(STORAGE_KEY, listener),
    () => readKey(STORAGE_KEY, parse),
    () => null,
  );

  // False during SSR and the first client render, true once hydrated.
  const loaded = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const save = useCallback((next: PlayerSession) => {
    writeKey(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clear = useCallback(() => {
    writeKey(STORAGE_KEY, null);
  }, []);

  return { session, loaded, save, clear };
}
