import Link from "next/link";
import { Plus } from "lucide-react";
import { ensureSeedData, getStore } from "@/lib/dynamodb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/host/dashboard";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  await ensureSeedData();
  const quizzes = await getStore().listQuizzes();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">My quizzes</h1>
          <p className="mt-1 text-sm text-ink-400">
            {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"} ready to host.
          </p>
        </div>
        <Button asChild>
          <Link href="/host/quizzes/new">
            <Plus aria-hidden /> Create Quiz
          </Link>
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          body="Build your first quiz — four options per question and a timer is all it takes."
          action={
            <Button asChild>
              <Link href="/host/quizzes/new">
                <Plus aria-hidden /> Create Quiz
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.quizId}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink-100">{quiz.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-400">
                      {quiz.description ?? "No description"}
                    </p>
                  </div>
                  <Badge tone="brand">{quiz.questionCount} Qs</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-ink-500">
                    Updated {formatDateTime(quiz.updatedAt)}
                  </span>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/host/quizzes/${quiz.quizId}/edit`}>Edit</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
