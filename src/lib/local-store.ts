"use client";

/**
 * Tiny localStorage-backed external store.
 *
 * Read through `useSyncExternalStore` rather than "read in an effect, then
 * setState": it keeps server and client renders explicit, updates every hook
 * instance at once, and picks up writes made in another tab.
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

export function subscribeToKey(key: string, listener: Listener): () => void {
  const set = listeners.get(key) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(key, set);

  // Writes from another tab arrive as a storage event.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Snapshot must be referentially stable between reads or React will loop, so the
 * parsed value is cached against the raw string it came from.
 */
export function readKey<T>(key: string, parse: (raw: string) => T | null): T | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.parsed as T | null;

  let parsed: T | null = null;
  if (raw !== null) {
    try {
      parsed = parse(raw);
    } catch {
      parsed = null;
    }
  }

  cache.set(key, { raw, parsed });
  return parsed;
}

export function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or a full quota — the app still works, it just forgets.
  }
  cache.delete(key);
  notify(key);
}

/** Subscribe target for "has the client hydrated yet". */
export const noopSubscribe = (): (() => void) => () => {};
