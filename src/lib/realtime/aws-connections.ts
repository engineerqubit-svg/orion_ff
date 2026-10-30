import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "@/lib/aws/clients";
import { awsConfig } from "@/lib/aws/config";

/**
 * API Gateway WebSocket connection registry.
 *
 * Layout (same table as everything else):
 *   PK GAME#<gameId>        SK CONN#<connectionId>   -> a live subscriber
 *   PK CONN#<connectionId>  SK POINTER               -> reverse lookup for $disconnect
 *
 * Rows carry a TTL so connections that vanish without a clean $disconnect are
 * reaped automatically.
 */

const CONNECTION_TTL_SECONDS = 60 * 60 * 6;

export interface ConnectionRecord {
  connectionId: string;
  gameId: string;
  role: "HOST" | "PLAYER";
  playerId?: string;
}

function ttl(): number {
  return Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS;
}

export async function registerConnection(record: ConnectionRecord): Promise<void> {
  const client = getDocumentClient();
  await Promise.all([
    client.send(
      new PutCommand({
        TableName: awsConfig.tableName,
        Item: {
          PK: `GAME#${record.gameId}`,
          SK: `CONN#${record.connectionId}`,
          entity: "CONNECTION",
          ttl: ttl(),
          ...record,
        },
      }),
    ),
    client.send(
      new PutCommand({
        TableName: awsConfig.tableName,
        Item: {
          PK: `CONN#${record.connectionId}`,
          SK: "POINTER",
          entity: "CONNECTION_POINTER",
          ttl: ttl(),
          ...record,
        },
      }),
    ),
  ]);
}

export async function findConnection(connectionId: string): Promise<ConnectionRecord | null> {
  const result = await getDocumentClient().send(
    new GetCommand({
      TableName: awsConfig.tableName,
      Key: { PK: `CONN#${connectionId}`, SK: "POINTER" },
    }),
  );
  if (!result.Item) return null;
  const { connectionId: id, gameId, role, playerId } = result.Item as ConnectionRecord;
  return { connectionId: id, gameId, role, playerId };
}

export async function unregisterConnection(connectionId: string): Promise<void> {
  const record = await findConnection(connectionId);
  const client = getDocumentClient();
  const deletes = [
    client.send(
      new DeleteCommand({
        TableName: awsConfig.tableName,
        Key: { PK: `CONN#${connectionId}`, SK: "POINTER" },
      }),
    ),
  ];
  if (record) {
    deletes.push(
      client.send(
        new DeleteCommand({
          TableName: awsConfig.tableName,
          Key: { PK: `GAME#${record.gameId}`, SK: `CONN#${connectionId}` },
        }),
      ),
    );
  }
  await Promise.all(deletes);
}

export async function listConnections(gameId: string): Promise<ConnectionRecord[]> {
  const result = await getDocumentClient().send(
    new QueryCommand({
      TableName: awsConfig.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `GAME#${gameId}`, ":prefix": "CONN#" },
    }),
  );
  return ((result.Items ?? []) as ConnectionRecord[]).map(
    ({ connectionId, gameId: id, role, playerId }) => ({
      connectionId,
      gameId: id,
      role,
      playerId,
    }),
  );
}
