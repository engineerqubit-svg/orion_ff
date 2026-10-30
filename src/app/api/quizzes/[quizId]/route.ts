import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import { GameError } from "@/lib/game-engine/errors";
import { quizDraftSchema } from "@/lib/validation/schemas";

interface Context {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireHost();
    await ensureSeedData();
    const { quizId } = await context.params;
    const quiz = await getStore().getQuiz(quizId);
    if (!quiz) throw new GameError("QUIZ_NOT_FOUND");
    return ok({ quiz });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireHost();
    const { quizId } = await context.params;
    const existing = await getStore().getQuiz(quizId);
    if (!existing) throw new GameError("QUIZ_NOT_FOUND");

    const draft = quizDraftSchema.parse(await readJson(request));

    const quiz = {
      ...existing,
      title: draft.title,
      description: draft.description || undefined,
      category: draft.category || undefined,
      gameMode: draft.gameMode,
      updatedAt: new Date().toISOString(),
      questions: draft.questions.map((question, index) => ({
        ...question,
        quizId,
        order: index,
        imageUrl: question.imageUrl || undefined,
        videoUrl: question.videoUrl || undefined,
      })),
    };

    await getStore().putQuiz(quiz);
    return ok({ quiz });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireHost();
    const { quizId } = await context.params;
    await getStore().deleteQuiz(quizId);
    return ok({});
  } catch (error) {
    return fail(error);
  }
}
