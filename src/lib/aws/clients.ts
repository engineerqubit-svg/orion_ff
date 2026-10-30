import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import { awsConfig } from "./config";

/**
 * SDK clients are expensive to construct and safe to share, so they are cached on
 * globalThis to survive Next.js module reloads in development.
 */
const cache = globalThis as unknown as {
  __arenaDocClient?: DynamoDBDocumentClient;
  __arenaApiGwClient?: ApiGatewayManagementApiClient;
};

export function getDocumentClient(): DynamoDBDocumentClient {
  cache.__arenaDocClient ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: awsConfig.region }),
    {
      marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
      unmarshallOptions: { wrapNumbers: false },
    },
  );
  return cache.__arenaDocClient;
}

export function getApiGatewayClient(): ApiGatewayManagementApiClient {
  if (!awsConfig.websocketManagementEndpoint) {
    throw new Error(
      "WEBSOCKET_MANAGEMENT_ENDPOINT is not set — cannot push to API Gateway connections.",
    );
  }
  cache.__arenaApiGwClient ??= new ApiGatewayManagementApiClient({
    region: awsConfig.region,
    endpoint: awsConfig.websocketManagementEndpoint,
  });
  return cache.__arenaApiGwClient;
}
