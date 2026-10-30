"use client";

import type { RealtimeProvider, RealtimeProviderOptions } from "@/types/realtime";
import { AWSWebSocketProvider } from "./aws-provider";
import { LocalRealtimeProvider } from "./local-provider";

export { LocalRealtimeProvider } from "./local-provider";
export { AWSWebSocketProvider } from "./aws-provider";

/**
 * Picks the transport from the environment. Every consumer talks to the
 * `RealtimeProvider` interface, so swapping SSE for API Gateway (or anything else
 * later) touches only this function.
 */
export function createRealtimeProvider(options: RealtimeProviderOptions): RealtimeProvider {
  const explicit = process.env.NEXT_PUBLIC_REALTIME_PROVIDER;
  const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

  const useAws = explicit === "aws" || (explicit !== "local" && Boolean(websocketUrl));

  if (useAws) {
    if (!websocketUrl) {
      throw new Error(
        "NEXT_PUBLIC_REALTIME_PROVIDER=aws requires NEXT_PUBLIC_WEBSOCKET_URL to be set.",
      );
    }
    return new AWSWebSocketProvider(options, websocketUrl);
  }

  return new LocalRealtimeProvider(options);
}
