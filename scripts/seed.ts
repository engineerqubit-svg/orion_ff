import { ensureSeedData, getStore } from "../src/lib/dynamodb";

/**
 * Writes the built-in "Qubit Fun Friday" quiz into whichever store is configured.
 * Only useful for DynamoDB — the memory store seeds itself on first request.
 *
 *   npm run seed
 */
async function main(): Promise<void> {
  await ensureSeedData();
  const quizzes = await getStore().listQuizzes();
  console.log(`Store: ${getStore().name}`);
  for (const quiz of quizzes) {
    console.log(` - ${quiz.title} (${quiz.questionCount} questions)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
