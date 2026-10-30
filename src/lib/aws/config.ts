/** Centralised, validated read of every AWS-related environment variable. */

export const awsConfig = {
  region: process.env.AWS_REGION ?? "ap-south-1",
  tableName: process.env.DYNAMODB_TABLE_NAME ?? "",
  /** wss:// endpoint of the API Gateway WebSocket API (browser-visible). */
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "",
  /** https:// management endpoint used server-side to push to connections. */
  websocketManagementEndpoint: process.env.WEBSOCKET_MANAGEMENT_ENDPOINT ?? "",
} as const;

export type DataProvider = "memory" | "dynamodb";
export type RealtimeProviderName = "local" | "aws";

export function resolveDataProvider(): DataProvider {
  const explicit = process.env.DATA_PROVIDER;
  if (explicit === "dynamodb" || explicit === "memory") return explicit;
  // Fall back to DynamoDB only when a table has actually been configured.
  return awsConfig.tableName ? "dynamodb" : "memory";
}

export function resolveRealtimeProvider(): RealtimeProviderName {
  const explicit = process.env.NEXT_PUBLIC_REALTIME_PROVIDER;
  if (explicit === "aws" || explicit === "local") return explicit;
  return awsConfig.websocketUrl ? "aws" : "local";
}
