import { getStore } from "@/lib/dynamodb";
import { buildStateSync, reapDisconnectedPlayers } from "@/lib/game-engine/engine";
import { getPlayerView } from "@/lib/scribble/engine";
import { nextSequence, pruneIdleChannels, subscribeToBus } from "@/lib/realtime/server-bus";
import type { ServerEvent } from "@/types/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comment frames keep proxies from closing an idle stream. */
const KEEPALIVE_MS = 15_000;
/** How often any one game gets its offline players swept, regardless of viewers. */
const REAP_INTERVAL_MS = 10_000;

const reapCache = globalThis as unknown as { __arenaLastReap?: Map<string, number> };

function shouldReap(gameId: string): boolean {
  reapCache.__arenaLastReap ??= new Map();
  const last = reapCache.__arenaLastReap.get(gameId) ?? 0;
  if (Date.now() - last < REAP_INTERVAL_MS) return false;
  reapCache.__arenaLastReap.set(gameId, Date.now());
  return true;
}

/**
 * Downstream half of the local transport: one Server-Sent Events stream per
 * connected screen.
 *
 * On connect the client gets a full STATE_SYNC and then the live feed. A client
 * that reconnects passes the last sequence it saw, and the bus replays the gap
 * before going live — so a phone that locks mid-question comes back correct.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId");
  const lastSeq = Number(url.searchParams.get("lastSeq") ?? "0");

  if (!gameId) {
    return new Response("gameId is required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // The client vanished between the check and the write; cleanup follows.
        }
      };

      const sendEvent = (event: ServerEvent | Record<string, unknown>) =>
        send(`data: ${JSON.stringify(event)}\n\n`);

      // Snapshot first, stamped with the current sequence so the client's dedupe
      // window lines up with the replay buffer.
      try {
        const game = await getStore().getGame(gameId);
        const seq = Math.max(lastSeq, nextSequence(gameId) - 1);

        if (game?.gameMode === "SCRIBBLE") {
          // Scribble snapshots are per-viewer (only the drawer may see the word),
          // so the stream sends a status ping and clients fetch their own view.
          const view = await getPlayerView(gameId);
          sendEvent({ type: "SCRIBBLE_STATE_SYNC", gameId, status: view.status, seq, at: Date.now() });
        } else {
          sendEvent({ ...(await buildStateSync(gameId)), seq, at: Date.now() });
        }
      } catch (error) {
        sendEvent({
          type: "STREAM_ERROR",
          message: error instanceof Error ? error.message : "Unable to load game state.",
        });
        controller.close();
        return;
      }

      unsubscribe = subscribeToBus(gameId, (event) => sendEvent(event), {
        sinceSeq: Number.isFinite(lastSeq) ? lastSeq : 0,
      });

      keepalive = setInterval(() => {
        send(": keepalive\n\n");
        if (shouldReap(gameId)) {
          void reapDisconnectedPlayers(gameId).catch(() => undefined);
        }
        pruneIdleChannels();
      }, KEEPALIVE_MS);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },

    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    unsubscribe = null;
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
  }

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disables buffering on nginx-style proxies, which would otherwise batch frames.
      "x-accel-buffering": "no",
    },
  });
}
