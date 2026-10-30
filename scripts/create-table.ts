import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

/**
 * Provisions the single DynamoDB table the app uses.
 *
 *   npm run ddb:create-table
 *
 * Layout and access patterns are documented in src/lib/dynamodb/keys.ts.
 */
const tableName = process.env.DYNAMODB_TABLE_NAME;
const region = process.env.AWS_REGION ?? "ap-south-1";

if (!tableName) {
  console.error("Set DYNAMODB_TABLE_NAME before running this script.");
  process.exit(1);
}

const client = new DynamoDBClient({ region });

async function main(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table "${tableName}" already exists — nothing to do.`);
    return;
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceNotFoundException") throw error;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );

  console.log(`Created table "${tableName}". Waiting for it to become active…`);

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const described = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (described.Table?.TableStatus === "ACTIVE") break;
  }

  // PIN pointers and WebSocket connection rows expire on their own.
  await client.send(
    new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: { Enabled: true, AttributeName: "ttl" },
    }),
  );

  console.log("Table is active and TTL is enabled.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
