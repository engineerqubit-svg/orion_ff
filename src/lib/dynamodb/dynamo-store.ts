import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "@/lib/aws/clients";
import { awsConfig } from "@/lib/aws/config";
import type { GameSession, Player, PlayerAnswer, PointAdjustment } from "@/types/game";
import type { Question, QuizSummary, QuizWithQuestions } from "@/types/quiz";
import { GSI1, gsi1, pk, sk } from "./keys";
import { normaliseNickname, StoreError, type DataStore } from "./store";

type Row = Record<string, unknown>;
type WriteRequest = { PutRequest?: { Item: Row }; DeleteRequest?: { Key: Row } };

/** Strips key/bookkeeping attributes so callers get clean domain objects back. */
function unwrap<T>(item: Row | undefined): T | null {
  if (!item) return null;
  const { PK: _pk, SK: _sk, GSI1PK: _g1, GSI1SK: _g2, entity: _e, ttl: _ttl, ...rest } = item;
  return rest as T;
}

function isConditionalFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "ConditionalCheckFailedException"
  );
}

/** Single-table DynamoDB implementation. See keys.ts for the full layout. */
export class DynamoStore implements DataStore {
  readonly name = "dynamodb" as const;
  private readonly table: string;

  constructor(tableName = awsConfig.tableName) {
    if (!tableName) {
      throw new StoreError(
        "DYNAMODB_TABLE_NAME is not set. Set it, or run with DATA_PROVIDER=memory.",
        "MISSING_TABLE",
      );
    }
    this.table = tableName;
  }

  private get client() {
    return getDocumentClient();
  }

  private async queryByPrefix(partition: string, prefix?: string): Promise<Row[]> {
    const rows: Row[] = [];
    let cursor: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: prefix
            ? "#pk = :pk AND begins_with(#sk, :prefix)"
            : "#pk = :pk",
          ExpressionAttributeNames: prefix ? { "#pk": "PK", "#sk": "SK" } : { "#pk": "PK" },
          ExpressionAttributeValues: prefix
            ? { ":pk": partition, ":prefix": prefix }
            : { ":pk": partition },
          ExclusiveStartKey: cursor,
        }),
      );
      rows.push(...((result.Items ?? []) as Row[]));
      cursor = result.LastEvaluatedKey;
    } while (cursor);

    return rows;
  }

  /** Chunked batch write with backoff on the unprocessed remainder. */
  private async batchWrite(requests: WriteRequest[]): Promise<void> {
    for (let i = 0; i < requests.length; i += 25) {
      const chunk = requests.slice(i, i + 25);
      if (chunk.length === 0) continue;

      let unprocessed = await this.client
        .send(new BatchWriteCommand({ RequestItems: { [this.table]: chunk } }))
        .then((r) => r.UnprocessedItems?.[this.table] ?? []);

      for (let attempt = 0; attempt < 4 && unprocessed.length > 0; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 50));
        unprocessed = await this.client
          .send(new BatchWriteCommand({ RequestItems: { [this.table]: unprocessed } }))
          .then((r) => r.UnprocessedItems?.[this.table] ?? []);
      }

      if (unprocessed.length > 0) {
        throw new StoreError("DynamoDB batch write did not complete.", "BATCH_INCOMPLETE");
      }
    }
  }

  /* ------------------------------------------------------------------ Quizzes */

  async putQuiz(quiz: QuizWithQuestions): Promise<void> {
    const { questions, ...meta } = quiz;
    const partition = pk.quiz(quiz.quizId);

    // Questions that were removed or reordered leave stale rows behind; sweep them.
    const existing = await this.queryByPrefix(partition, sk.questionPrefix);
    const keepKeys = new Set(questions.map((q) => sk.question(q.order, q.questionId)));

    const requests: WriteRequest[] = [
      {
        PutRequest: {
          Item: {
            PK: partition,
            SK: sk.meta,
            GSI1PK: gsi1.quizList,
            GSI1SK: quiz.updatedAt,
            entity: "QUIZ",
            ...meta,
          },
        },
      },
      ...questions.map((question) => ({
        PutRequest: {
          Item: {
            PK: partition,
            SK: sk.question(question.order, question.questionId),
            entity: "QUESTION",
            ...question,
          },
        },
      })),
      ...existing
        .map((row) => String(row.SK))
        .filter((key) => !keepKeys.has(key))
        .map((key) => ({ DeleteRequest: { Key: { PK: partition, SK: key } } })),
    ];

    await this.batchWrite(requests);
  }

  async getQuiz(quizId: string): Promise<QuizWithQuestions | null> {
    const rows = await this.queryByPrefix(pk.quiz(quizId));
    const metaRow = rows.find((row) => row.SK === sk.meta);
    if (!metaRow) return null;

    const questions = rows
      .filter((row) => String(row.SK).startsWith(sk.questionPrefix))
      .map((row) => unwrap<Question>(row))
      .filter((q): q is Question => q !== null)
      .sort((a, b) => a.order - b.order);

    const meta = unwrap<Omit<QuizWithQuestions, "questions">>(metaRow);
    return meta ? { ...meta, questions } : null;
  }

  async listQuizzes(): Promise<QuizSummary[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: GSI1,
        KeyConditionExpression: "GSI1PK = :type",
        ExpressionAttributeValues: { ":type": gsi1.quizList },
        ScanIndexForward: false,
      }),
    );

    const quizzes = ((result.Items ?? []) as Row[])
      .map((row) => unwrap<QuizWithQuestions>(row))
      .filter((q): q is QuizWithQuestions => q !== null);

    return Promise.all(
      quizzes.map(async (quiz) => {
        const questions = await this.queryByPrefix(pk.quiz(quiz.quizId), sk.questionPrefix);
        return { ...quiz, questionCount: questions.length } as QuizSummary;
      }),
    );
  }

  async deleteQuiz(quizId: string): Promise<void> {
    const rows = await this.queryByPrefix(pk.quiz(quizId));
    await this.batchWrite(
      rows.map((row) => ({
        DeleteRequest: { Key: { PK: row.PK as string, SK: row.SK as string } },
      })),
    );
  }

  /* -------------------------------------------------------------------- Games */

  async putGame(game: GameSession): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: pk.game(game.gameId),
          SK: sk.meta,
          GSI1PK: gsi1.gameList,
          GSI1SK: game.createdAt,
          entity: "GAME",
          ...game,
        },
      }),
    );

    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: pk.pin(game.gamePin),
          SK: sk.pinPointer,
          entity: "PIN",
          gameId: game.gameId,
          // PIN pointers expire after 24h so codes can be recycled safely.
          ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    );
  }

  async getGame(gameId: string): Promise<GameSession | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { PK: pk.game(gameId), SK: sk.meta } }),
    );
    return unwrap<GameSession>(result.Item as Row | undefined);
  }

  async getGameByPin(gamePin: string): Promise<GameSession | null> {
    const pointer = await this.client.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: pk.pin(gamePin), SK: sk.pinPointer },
      }),
    );
    const gameId = pointer.Item?.gameId as string | undefined;
    return gameId ? this.getGame(gameId) : null;
  }

  async listGames(limit = 25): Promise<GameSession[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: GSI1,
        KeyConditionExpression: "GSI1PK = :type",
        ExpressionAttributeValues: { ":type": gsi1.gameList },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return ((result.Items ?? []) as Row[])
      .map((row) => unwrap<GameSession>(row))
      .filter((g): g is GameSession => g !== null);
  }

  /* ------------------------------------------------------------------ Players */

  async putPlayer(player: Player): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: pk.game(player.gameId),
          SK: sk.player(player.playerId),
          entity: "PLAYER",
          ...player,
        },
      }),
    );
  }

  async getPlayer(gameId: string, playerId: string): Promise<Player | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: pk.game(gameId), SK: sk.player(playerId) },
      }),
    );
    return unwrap<Player>(result.Item as Row | undefined);
  }

  async listPlayers(gameId: string): Promise<Player[]> {
    const rows = await this.queryByPrefix(pk.game(gameId), sk.playerPrefix);
    return rows
      .map((row) => unwrap<Player>(row))
      .filter((p): p is Player => p !== null && !p.kicked)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async deletePlayer(gameId: string, playerId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { PK: pk.game(gameId), SK: sk.player(playerId) },
      }),
    );
  }

  async reserveNickname(gameId: string, nickname: string, playerId: string): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            PK: pk.game(gameId),
            SK: sk.nickname(normaliseNickname(nickname)),
            entity: "NICKNAME",
            playerId,
            nickname,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }

  async releaseNickname(gameId: string, nickname: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { PK: pk.game(gameId), SK: sk.nickname(normaliseNickname(nickname)) },
      }),
    );
  }

  /* ------------------------------------------------------------------ Answers */

  async putAnswerIfAbsent(answer: PlayerAnswer): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            PK: pk.game(answer.gameId),
            SK: sk.answer(answer.questionId, answer.playerId),
            entity: "ANSWER",
            ...answer,
          },
          // The atomic guarantee behind "one answer per question per player".
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalFailure(error)) return false;
      throw error;
    }
  }

  async updateAnswer(answer: PlayerAnswer): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: pk.game(answer.gameId),
          SK: sk.answer(answer.questionId, answer.playerId),
          entity: "ANSWER",
          ...answer,
        },
      }),
    );
  }

  async getAnswer(
    gameId: string,
    questionId: string,
    playerId: string,
  ): Promise<PlayerAnswer | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: pk.game(gameId), SK: sk.answer(questionId, playerId) },
      }),
    );
    return unwrap<PlayerAnswer>(result.Item as Row | undefined);
  }

  async listAnswersForQuestion(gameId: string, questionId: string): Promise<PlayerAnswer[]> {
    const rows = await this.queryByPrefix(pk.game(gameId), sk.answerQuestionPrefix(questionId));
    return rows
      .map((row) => unwrap<PlayerAnswer>(row))
      .filter((a): a is PlayerAnswer => a !== null);
  }

  async listAnswersForGame(gameId: string): Promise<PlayerAnswer[]> {
    const rows = await this.queryByPrefix(pk.game(gameId), sk.answerPrefix);
    return rows
      .map((row) => unwrap<PlayerAnswer>(row))
      .filter((a): a is PlayerAnswer => a !== null);
  }

  async deleteAnswersForQuestion(gameId: string, questionId: string): Promise<void> {
    const rows = await this.queryByPrefix(pk.game(gameId), sk.answerQuestionPrefix(questionId));
    await this.batchWrite(
      rows.map((row) => ({
        DeleteRequest: { Key: { PK: row.PK as string, SK: row.SK as string } },
      })),
    );
  }

  /* -------------------------------------------------------------- Adjustments */

  async putAdjustment(adjustment: PointAdjustment): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: pk.game(adjustment.gameId),
          SK: sk.adjustment(adjustment.createdAt, adjustment.adjustmentId),
          entity: "ADJUSTMENT",
          ...adjustment,
        },
      }),
    );
  }

  async listAdjustments(gameId: string): Promise<PointAdjustment[]> {
    const rows = await this.queryByPrefix(pk.game(gameId), sk.adjustmentPrefix);
    return rows
      .map((row) => unwrap<PointAdjustment>(row))
      .filter((a): a is PointAdjustment => a !== null);
  }
}
