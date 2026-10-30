import { notFound } from "next/navigation";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import { QuizEditor } from "@/components/quiz/quiz-editor";

export const dynamic = "force-dynamic";

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  await ensureSeedData();
  const { quizId } = await params;
  const quiz = await getStore().getQuiz(quizId);
  if (!quiz) notFound();

  return <QuizEditor initial={quiz} />;
}
