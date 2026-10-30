"use client";

import type {
  ClientEvent,
  ConnectionStatus,
  RealtimeProvider,
  RealtimeProviderOptions,
  ServerEvent,
} from "@/types/realtime";

const HEARTBEAT_MS = 30_000;
const MAX_BACKOFF_MS = 10_000;

/**
 * Production transport: AWS API Gateway WebSocket.
 *
 * Identical surface to `LocalRealtimeProvider`, so switching between them is an
 * environment variable (`NEXT_PUBLIC_REALTIME_PROVIDER`) rather than a code change.
 *
 * Expected API Gateway routes:
 *   $connect    — reads gameId/role/playerId from the query string and registers
 *                 the connection (see `lib/realtime/aws-connections.ts`)
 *   $disconnect — unregisters it
 *   $default    — accepts `ClientEvent` frames (presence only)
 */
export class AWSWebSocketProvider implements RealtimeProvider {
  private socket: WebSocket | null = null;
  private eventListeners = new Set<(event: ServerEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private currentStatus: ConnectionStatus = "IDLE";
  private lastSeq = 0;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly options: RealtimeProviderOptions,
    private readonly endpoint: string,
  ) {}

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  async connect(): Promise<void> {
    this.closed = false;
    this.open();
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setStatus("CLOSED");
  }

  send(event: ClientEvent): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
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

    const url = new URL(this.endpoint);
    url.searchParams.set("gameId", this.options.gameId);
    url.searchParams.set("role", this.options.role);
    url.searchParams.set("lastSeq", String(this.lastSeq));
    if (this.options.playerId) url.searchParams.set("playerId", this.options.playerId);
    if (this.options.playerToken) url.searchParams.set("token", this.options.playerToken);

    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus("CONNECTED");
      this.send({
        type: "HELLO",
        gameId: this.options.gameId,
        role: this.options.role,
        playerId: this.options.playerId,
        playerToken: this.options.playerToken,
      });
      this.startHeartbeat();
    };

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as ServerEvent;
        if (typeof event.seq !== "number" || event.seq <= this.lastSeq) return;
        this.lastSeq = event.seq;
        for (const listener of this.eventListeners) listener(event);
      } catch {
        // Ignore frames that aren't well-formed ServerEvents.
      }
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      if (this.socket === socket) this.socket = null;
      this.scheduleReconnect();
    };

    socket.onerror = () => socket.close();
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
