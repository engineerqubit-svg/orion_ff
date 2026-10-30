import type { ServerEvent } from "@/types/realtime";
import type { ScribbleServerEvent } from "@/types/scribble";

/** Both game modes share one channel per game; the bus only needs gameId/seq/at. */
export type BusEvent = ServerEvent | ScribbleServerEvent;

/**
 * In-process fan-out bus.
 *
 * Every game has a channel that stamps each event with a monotonic sequence
 * number and keeps a short replay buffer. A client that reconnects sends the last
 * sequence it saw and gets the gap replayed, so a dropped connection mid-question
 * never leaves a screen stale.
 *
 * This is the transport for `LocalRealtimeProvider` (SSE) and is also used
 * alongside API Gateway in the AWS setup, so a single-server deployment works
 * with no extra infrastructure.
 */

const REPLAY_BUFFER_SIZE = 60;
/** Channels are dropped this long after their last activity. */
const CHANNEL_IDLE_MS = 1000 * 60 * 60 * 4;

type Listener = (event: BusEvent) => void;

interface Channel {
  seq: number;
  buffer: BusEvent[];
  listeners: Set<Listener>;
  lastActivity: number;
}

const cache = globalThis as unknown as { __arenaBus?: Map<string, Channel> };

function channels(): Map<string, Channel> {
  cache.__arenaBus ??= new Map();
  return cache.__arenaBus;
}

function getChannel(gameId: string): Channel {
  const map = channels();
  let channel = map.get(gameId);
  if (!channel) {
    channel = { seq: 0, buffer: [], listeners: new Set(), lastActivity: Date.now() };
    map.set(gameId, channel);
  }
  return channel;
}

/** Distributes over the union so each variant keeps its own payload fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Events are authored without `seq`/`at`; the bus is the only thing that stamps them. */
export type ServerEventInput = DistributiveOmit<BusEvent, "seq" | "at">;

export function nextSequence(gameId: string): number {
  return getChannel(gameId).seq + 1;
}

/** Stamps, buffers and fans out an event. Returns the fully-formed event. */
export function publishToBus(input: ServerEventInput): BusEvent {
  const channel = getChannel(input.gameId);
  channel.seq += 1;
  channel.lastActivity = Date.now();

  const event = { ...input, seq: channel.seq, at: Date.now() } as BusEvent;

  channel.buffer.push(event);
  if (channel.buffer.length > REPLAY_BUFFER_SIZE) {
    channel.buffer.splice(0, channel.buffer.length - REPLAY_BUFFER_SIZE);
  }

  for (const listener of channel.listeners) {
    try {
      listener(event);
    } catch {
      // A broken listener must never stop the rest of the room from updating.
    }
  }

  return event;
}

export interface SubscribeOptions {
  /** Replay everything after this sequence number before going live. */
  sinceSeq?: number;
}

export function subscribeToBus(
  gameId: string,
  listener: Listener,
  options: SubscribeOptions = {},
): () => void {
  const channel = getChannel(gameId);
  channel.listeners.add(listener);
  channel.lastActivity = Date.now();

  if (typeof options.sinceSeq === "number") {
    for (const event of channel.buffer) {
      if (event.seq > options.sinceSeq) listener(event);
    }
  }

  return () => {
    channel.listeners.delete(listener);
  };
}

export function listenerCount(gameId: string): number {
  return channels().get(gameId)?.listeners.size ?? 0;
}

/** Drops idle channels so a long-lived server doesn't accumulate finished games. */
export function pruneIdleChannels(now = Date.now()): void {
  for (const [gameId, channel] of channels()) {
    if (channel.listeners.size === 0 && now - channel.lastActivity > CHANNEL_IDLE_MS) {
      channels().delete(gameId);
    }
  }
}
