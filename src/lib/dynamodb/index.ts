import { resolveDataProvider } from "@/lib/aws/config";
import { sampleQuiz } from "@/lib/seed/qubit-fun-friday";
import { practiceQuiz } from "@/lib/seed/diwali-practice";
import { diwaliQuiz } from "@/lib/seed/diwali-bollywood-night";
import { DynamoStore } from "./dynamo-store";
import { MemoryStore } from "./memory-store";
import type { DataStore } from "./store";

export type { DataStore } from "./store";
export { StoreError, normaliseNickname } from "./store";
export { MemoryStore } from "./memory-store";
export { DynamoStore } from "./dynamo-store";

const cache = globalThis as unknown as {
  __arenaStore?: DataStore;
  __arenaSeeded?: boolean;
};

/**
 * Returns the active store. Selection is driven entirely by environment, so a
 * deployment switches from in-memory to DynamoDB without a code change.
 */
export function getStore(): DataStore {
  if (!cache.__arenaStore) {
    cache.__arenaStore =
      resolveDataProvider() === "dynamodb" ? new DynamoStore() : new MemoryStore();
  }
  return cache.__arenaStore;
}

/**
 * Makes sure the built-in sample quizzes exist. Runs once per process for the memory
 * store so a fresh `npm run dev` always has something to host.
 */
export async function ensureSeedData(): Promise<void> {
  const store = getStore();
  if (store.name === "memory") {
    if (cache.__arenaSeeded) return;
    cache.__arenaSeeded = true;
  }
  for (const quiz of [sampleQuiz, practiceQuiz, diwaliQuiz]) {
    const existing = await store.getQuiz(quiz.quizId);
    if (!existing) await store.putQuiz(quiz);
  }
}
