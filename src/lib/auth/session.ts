import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { GameError } from "@/lib/game-engine/errors";

/**
 * Minimal host session.
 *
 * Deliberately small and self-contained: a signed, HttpOnly cookie carrying a
 * host id. Everything server-side asks `requireHost()` and gets a `HostSession`,
 * so swapping this for Cognito, an SSO provider or NextAuth later means replacing
 * this file only — no call sites change.
 *
 * Participants never touch any of this; joining a game requires no account.
 */

export const SESSION_COOKIE = "arena_host_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export interface HostSession {
  hostId: string;
  email: string;
  issuedAt: number;
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "qubit-friday-arena-development-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function encodeSession(session: HostSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): HostSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as HostSession;
    if (Date.now() - session.issuedAt > SESSION_TTL_MS) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getHostSession(): Promise<HostSession | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireHost(): Promise<HostSession> {
  const session = await getHostSession();
  if (!session) throw new GameError("UNAUTHORISED");
  return session;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Development credentials come from the environment with a documented default so
 * a fresh checkout can sign in immediately. Replace with a real identity provider
 * before this is exposed outside the office network.
 */
export function verifyCredentials({ email, password }: Credentials): HostSession | null {
  const expectedEmail = process.env.ADMIN_EMAIL ?? "host@qubit.local";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "fun-friday";

  const emailMatches = email.trim().toLowerCase() === expectedEmail.toLowerCase();
  const passwordMatches = safeEqual(password, expectedPassword);
  if (!emailMatches || !passwordMatches) return null;

  return {
    hostId: `host_${Buffer.from(expectedEmail).toString("hex").slice(0, 16)}`,
    email: expectedEmail,
    issuedAt: Date.now(),
  };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS / 1000,
} as const;
