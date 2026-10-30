import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { getApiGatewayClient } from "@/lib/aws/clients";
import { awsConfig, resolveRealtimeProvider } from "@/lib/aws/config";
import { listConnections, unregisterConnection } from "./aws-connections";
import { publishToBus, type BusEvent, type ServerEventInput } from "./server-bus";

/**
 * The single exit point for server -> client events.
 *
 * The in-process bus always runs (it powers SSE and costs nothing). When an API
 * Gateway WebSocket API is configured, the same stamped event is also pushed to
 * every registered connection. Callers never know or care which is active.
 */
export async function publish(input: ServerEventInput): Promise<BusEvent> {
  const event = publishToBus(input);

  if (resolveRealtimeProvider() === "aws" && awsConfig.websocketManagementEndpoint) {
    // Fan-out failures must never roll back a committed game state change.
    void broadcastOverWebSocket(event).catch((error) => {
      console.error("[realtime] WebSocket fan-out failed", error);
    });
  }

  return event;
}

async function broadcastOverWebSocket(event: BusEvent): Promise<void> {
  const client = getApiGatewayClient();
  const connections = await listConnections(event.gameId);
  const payload = Buffer.from(JSON.stringify(event));

  await Promise.all(
    connections.map(async (connection) => {
      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: payload,
          }),
        );
      } catch (error) {
        // 410 Gone means the client is long gone; drop it from the registry.
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 410) {
          await unregisterConnection(connection.connectionId).catch(() => undefined);
        } else {
          console.error("[realtime] postToConnection failed", error);
        }
      }
    }),
  );
}

/** Publishes several events in order, preserving sequence numbering. */
export async function publishAll(inputs: ServerEventInput[]): Promise<BusEvent[]> {
  const events: BusEvent[] = [];
  for (const input of inputs) {
    events.push(await publish(input));
  }
  return events;
}
