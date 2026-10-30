import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 8420 -> "8,420" */
export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}

/** 2843 -> "2.84 sec" */
export function formatSeconds(ms: number, fractionDigits = 2): string {
  return `${(ms / 1000).toFixed(fractionDigits)} sec`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** #1 / #2 / #3 ... */
export function ordinal(position: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = position % 100;
  return `${position}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** youtube.com/watch?v=ID, youtu.be/ID or youtube.com/embed/ID -> an embeddable player URL, or null. */
export function youTubeEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parsed.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.split("/")[2] || null;
    }
  }

  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

/** Deterministic pastel-ish accent per nickname, for lobby pills and avatars. */
export function nicknameAccent(nickname: string): string {
  const palette = [
    "var(--color-brand-500)",
    "var(--color-aqua-500)",
    "var(--color-solar-500)",
    "var(--color-pulse-500)",
    "var(--color-lime-500)",
  ];
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}

export function initials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
