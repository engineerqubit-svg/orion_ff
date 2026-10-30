/** ID and PIN helpers. Uses the platform crypto available in Node and browsers. */

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Opaque, unguessable player session token. */
export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Six digits, never starting with 0 so the PIN always reads as six characters. */
export function generateGamePin(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const value = 100000 + ((bytes[0] ?? 0) % 900000);
  return String(value);
}

/** `482193` -> `482 193` for the projector screen. */
export function formatGamePin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}
