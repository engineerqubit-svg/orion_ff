"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readKey, subscribeToKey, writeKey } from "@/lib/local-store";

/**
 * Sound layer.
 *
 * The app ships without audio assets, so each cue is synthesised with the Web
 * Audio API — enough to be genuinely useful on a projector today. Drop a real
 * file at `/public/sounds/<cue>.mp3` and it is used instead, no code change.
 */

export const SOUND_CUES = [
  "countdown",
  "answer-locked",
  "correct",
  "incorrect",
  "leaderboard",
  "podium",
  "player-joined",
] as const;

export type SoundCue = (typeof SOUND_CUES)[number];

const MUTE_KEY = "qubit-arena-muted";

interface ToneSpec {
  notes: number[];
  duration: number;
  type: OscillatorType;
  gain: number;
}

const TONES: Record<SoundCue, ToneSpec> = {
  countdown: { notes: [880], duration: 0.09, type: "triangle", gain: 0.05 },
  "answer-locked": { notes: [523.25, 784], duration: 0.1, type: "sine", gain: 0.07 },
  correct: { notes: [523.25, 659.25, 987.77], duration: 0.13, type: "sine", gain: 0.08 },
  incorrect: { notes: [311.13, 233.08], duration: 0.18, type: "sawtooth", gain: 0.05 },
  leaderboard: { notes: [392, 523.25, 659.25], duration: 0.12, type: "triangle", gain: 0.06 },
  podium: { notes: [523.25, 659.25, 783.99, 1046.5], duration: 0.18, type: "sine", gain: 0.09 },
  "player-joined": { notes: [659.25, 880], duration: 0.07, type: "sine", gain: 0.05 },
};

let audioContext: AudioContext | null = null;
const sampleCache = new Map<SoundCue, HTMLAudioElement | null>();

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

function playSynth(cue: SoundCue): void {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume();

  const spec = TONES[cue];
  spec.notes.forEach((frequency, index) => {
    const start = ctx.currentTime + index * spec.duration;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(spec.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + spec.duration + 0.02);
  });
}

/** Prefers a real asset when one has been added, otherwise falls back to the tone. */
function playSample(cue: SoundCue): boolean {
  if (!sampleCache.has(cue)) {
    const audio = new Audio(`/sounds/${cue}.mp3`);
    audio.preload = "auto";
    let usable = true;
    audio.addEventListener("error", () => {
      usable = false;
      sampleCache.set(cue, null);
    });
    sampleCache.set(cue, usable ? audio : null);
  }

  const cached = sampleCache.get(cue);
  if (!cached) return false;

  const clone = cached.cloneNode(true) as HTMLAudioElement;
  clone.volume = 0.6;
  const played = clone.play();
  if (played) void played.catch(() => undefined);
  return true;
}

export function useSound() {
  // Starts muted: browsers block audio until a gesture, and a projector that
  // suddenly makes noise on load is worse than one the host un-mutes.
  const muted = useSyncExternalStore(
    (listener) => subscribeToKey(MUTE_KEY, listener),
    () => readKey(MUTE_KEY, (raw) => raw === "true") ?? true,
    () => true,
  );

  const toggleMuted = useCallback(() => {
    const next = !(readKey(MUTE_KEY, (raw) => raw === "true") ?? true);
    writeKey(MUTE_KEY, String(next));
    // Browsers only unlock audio inside a user gesture — this toggle is one.
    if (!next) void context()?.resume();
  }, []);

  const play = useCallback(
    (cue: SoundCue) => {
      if (muted) return;
      if (!playSample(cue)) playSynth(cue);
    },
    [muted],
  );

  return { muted, toggleMuted, play };
}
