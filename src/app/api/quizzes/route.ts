import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import { newId } from "@/lib/ids";
import { quizDraftSchema } from "@/lib/validation/schemas";
import type { QuizWithQuestions } from "@/types/quiz";

export async function GET(): Promise<NextResponse> {
  try {
    await requireHost();
    await ensureSeedData();
    return ok({ quizzes: await getStore().listQuizzes() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireHost();
    const draft = quizDraftSchema.parse(await readJson(request));

    const quizId = newId("quiz");
    const timestamp = new Date().toISOString();

    const quiz: QuizWithQuestions = {
      quizId,
      title: draft.title,
      description: draft.description || undefined,
      category: draft.category || undefined,
      gameMode: draft.gameMode,
      createdAt: timestamp,
      updatedAt: timestamp,
      questions: draft.questions.map((question, index) => ({
        ...question,
        quizId,
        order: index,
        imageUrl: question.imageUrl || undefined,
        videoUrl: question.videoUrl || undefined,
      })),
    };

    await getStore().putQuiz(quiz);
    return ok({ quiz }, 201);
  } catch (error) {
    return fail(error);
  }
}
