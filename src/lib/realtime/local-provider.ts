"use client";

import type {
  ClientEvent,
  ConnectionStatus,
  RealtimeProvider,
  RealtimeProviderOptions,
  ServerEvent,
} from "@/types/realtime";

const HEARTBEAT_MS = 15_000;
const MAX_BACKOFF_MS = 8_000;

/**
 * Development / single-server transport: Server-Sent Events downstream, plain
 * HTTP upstream. Works on any machine with `npm run dev` and needs no AWS
 * infrastructure, which lets the whole UI be built and tested before deploying.
 *
 * Reconnection is handled manually rather than leaning on EventSource's built-in
 * retry, because we need to pass the last sequence number we saw so the server
 * can replay the gap.
 */
export class LocalRealtimeProvider implements RealtimeProvider {
  private source: EventSource | null = null;
  private eventListeners = new Set<(event: ServerEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private currentStatus: ConnectionStatus = "IDLE";
  private lastSeq = 0;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(private readonly options: RealtimeProviderOptions) {}

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  async connect(): Promise<void> {
    this.closed = false;
    this.open();
    this.startHeartbeat();
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.source?.close();
    this.source = null;
    this.setStatus("CLOSED");
  }

  send(event: ClientEvent): void {
    void fetch("/api/realtime/client-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // Presence traffic is best-effort; the SSE stream is the real signal.
    });
  }

  subscribe(callback: (event: ServerEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private open(): void {
    if (this.closed) return;
    this.setStatus(this.attempt === 0 ? "CONNECTING" : "RECONNECTING");

    const params = new URLSearchParams({
      gameId: this.options.gameId,
      role: this.options.role,
      lastSeq: String(this.lastSeq),
    });
    if (this.options.playerId) params.set("playerId", this.options.playerId);

    const source = new EventSource(`/api/realtime/stream?${params.toString()}`);
    this.source = source;

    source.onopen = () => {
      this.attempt = 0;
      this.setStatus("CONNECTED");
    };

    source.onmessage = (message) => {
      // Keep-alive comments never reach onmessage, but empty data can.
      if (!message.data) return;
      try {
        const event = JSON.parse(message.data) as ServerEvent;
        if (event.seq <= this.lastSeq) return; // duplicate from a replay overlap
        this.lastSeq = event.seq;
        for (const listener of this.eventListeners) listener(event);
      } catch {
        // Ignore malformed frames rather than tearing down a live game screen.
      }
    };

    source.onerror = () => {
      source.close();
      if (this.source === source) this.source = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    this.setStatus("RECONNECTING");
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      this.send({
        type: "HEARTBEAT",
        gameId: this.options.gameId,
        playerId: this.options.playerId,
        playerToken: this.options.playerToken,
      });
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
