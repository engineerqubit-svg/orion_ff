"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ANSWER_KEYS, ANSWER_SHAPES, answerTone } from "@/components/arena/answer-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api/client";
import { newId } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { quizDraftSchema } from "@/lib/validation/schemas";
import {
  ALLOWED_DURATIONS,
  QUESTION_MODE_LABELS,
  QUESTION_MODES,
  type QuestionMode,
  type QuizWithQuestions,
} from "@/types/quiz";

interface DraftQuestion {
  questionId: string;
  question: string;
  imageUrl: string;
  videoUrl: string;
  answers: { id: string; text: string }[];
  correctAnswerId: string;
  durationSeconds: number;
  mode: QuestionMode;
}

function blankQuestion(): DraftQuestion {
  const answers = ANSWER_KEYS.map(() => ({ id: newId("ans"), text: "" }));
  return {
    questionId: newId("q"),
    question: "",
    imageUrl: "",
    videoUrl: "",
    answers,
    correctAnswerId: answers[0]!.id,
    durationSeconds: 20,
    mode: "NORMAL",
  };
}

export function QuizEditor({ initial }: { initial?: QuizWithQuestions }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initial?.questions.map((question) => ({
      questionId: question.questionId,
      question: question.question,
      imageUrl: question.imageUrl ?? "",
      videoUrl: question.videoUrl ?? "",
      answers: question.answers.map((answer) => ({ ...answer })),
      correctAnswerId: question.correctAnswerId,
      durationSeconds: question.durationSeconds,
      mode: question.mode,
    })) ?? [blankQuestion()],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question, i) => (i === index ? { ...question, ...patch } : question)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setOpenIndex(target);
  }

  function duplicate(index: number) {
    setQuestions((current) => {
      const source = current[index]!;
      // Fresh ids throughout, so the copy is genuinely independent.
      const answers = source.answers.map((answer) => ({ ...answer, id: newId("ans") }));
      const correctIndex = source.answers.findIndex((a) => a.id === source.correctAnswerId);
      const copy: DraftQuestion = {
        ...source,
        questionId: newId("q"),
        answers,
        correctAnswerId: answers[Math.max(0, correctIndex)]!.id,
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setOpenIndex(index + 1);
  }

  async function save() {
    setErrors({});
    const draft = {
      title,
      description: description || undefined,
      category: category || undefined,
      gameMode: "QUIZ_BATTLE" as const,
      questions: questions.map((question) => ({
        ...question,
        imageUrl: question.imageUrl || undefined,
        videoUrl: question.videoUrl || undefined,
      })),
    };

    const parsed = quizDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[issue.path.join(".")] ??= issue.message;
      setErrors(flat);

      const firstQuestion = parsed.error.issues.find((issue) => issue.path[0] === "questions");
      if (typeof firstQuestion?.path[1] === "number") setOpenIndex(firstQuestion.path[1]);

      toast.error(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(isEdit ? `/api/quizzes/${initial!.quizId}` : "/api/quizzes", {
        method: isEdit ? "PUT" : "POST",
        json: parsed.data,
      });
      toast.success(isEdit ? "Quiz updated" : "Quiz created");
      router.push("/host/quizzes");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the quiz.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="font-display text-3xl font-bold">
          {isEdit ? "Edit quiz" : "Create quiz"}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Four options per question, one correct answer, and a timer. That&apos;s it.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quiz-title">Quiz name</Label>
            <Input
              id="quiz-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Diwali Dhamaka"
              invalid={Boolean(errors.title)}
              maxLength={80}
            />
            {errors.title ? <FieldError>{errors.title}</FieldError> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-category">Category</Label>
            <Input
              id="quiz-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Mixed"
              maxLength={40}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-description">Description</Label>
            <Input
              id="quiz-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ten rounds of office trivia"
              maxLength={300}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Questions <span className="tabular text-ink-400">({questions.length})</span>
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuestions((current) => [...current, blankQuestion()]);
              setOpenIndex(questions.length);
            }}
          >
            <Plus aria-hidden /> Add question
          </Button>
        </div>

        {questions.map((question, index) => (
          <QuestionCard
            key={question.questionId}
            index={index}
            total={questions.length}
            question={question}
            open={openIndex === index}
            errors={errors}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            onChange={(patch) => update(index, patch)}
            onMove={(direction) => move(index, direction)}
            onDuplicate={() => duplicate(index)}
            onRemove={() =>
              setQuestions((current) =>
                current.length === 1 ? current : current.filter((_, i) => i !== index),
              )
            }
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-600/50 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <p className="text-xs text-ink-400">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/host/quizzes")}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              <Save aria-hidden /> Save quiz
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-pulse-500">{children}</p>;
}

function QuestionCard({
  index,
  total,
  question,
  open,
  errors,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  total: number;
  question: DraftQuestion;
  open: boolean;
  errors: Record<string, string>;
  onToggle: () => void;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const prefix = `questions.${index}`;
  const hasError = Object.keys(errors).some((key) => key.startsWith(prefix));

  return (
    <Card className={cn(hasError && "border-pulse-500/50")}>
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-700/70 font-display text-sm font-bold tabular text-ink-200">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">
            {question.question || <span className="text-ink-500">Untitled question</span>}
          </span>
          {question.mode !== "NORMAL" ? (
            <Badge tone="brand" className="hidden sm:inline-flex">
              {QUESTION_MODE_LABELS[question.mode]}
            </Badge>
          ) : null}
          <Badge className="hidden sm:inline-flex">{question.durationSeconds}s</Badge>
          <ChevronDown
            className={cn("size-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>

        <div className="flex shrink-0 gap-0.5">
          <IconButton label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove(1)} disabled={index === total - 1}>
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Duplicate question" onClick={onDuplicate}>
            <Copy className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Remove question" onClick={onRemove} disabled={total === 1} danger>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-ink-700/50 p-4 sm:p-5">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-text`}>Question</Label>
                <Textarea
                  id={`${prefix}-text`}
                  rows={2}
                  value={question.question}
                  onChange={(event) => onChange({ question: event.target.value })}
                  placeholder="Which planet is known as the Red Planet?"
                  invalid={Boolean(errors[`${prefix}.question`])}
                  maxLength={300}
                />
                {errors[`${prefix}.question`] ? (
                  <FieldError>{errors[`${prefix}.question`]}</FieldError>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${prefix}-image`}>Image URL (optional)</Label>
                <Input
                  id={`${prefix}-image`}
                  value={question.imageUrl}
                  onChange={(event) => onChange({ imageUrl: event.target.value })}
                  placeholder="https://…"
                  invalid={Boolean(errors[`${prefix}.imageUrl`])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${prefix}-video`}>YouTube URL (optional)</Label>
                <Input
                  id={`${prefix}-video`}
                  value={question.videoUrl}
                  onChange={(event) => onChange({ videoUrl: event.target.value })}
                  placeholder="https://www.youtube.com/watch?v=…"
                  invalid={Boolean(errors[`${prefix}.videoUrl`])}
                />
                <p className="text-xs text-ink-500">
                  Plays on the projector display only — phones get a &quot;watch the big
                  screen&quot; prompt instead.
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">
                  Options — select the correct one
                </legend>
                {question.answers.map((answer, answerIndex) => {
                  const tone = answerTone(answerIndex);
                  const correct = answer.id === question.correctAnswerId;
                  return (
                    <div key={answer.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ correctAnswerId: answer.id })}
                        aria-pressed={correct}
                        aria-label={`Mark option ${ANSWER_KEYS[answerIndex]} as correct`}
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white transition-all",
                          correct ? "ring-2 ring-lime-500 ring-offset-2 ring-offset-ink-900" : "opacity-70 active:opacity-100",
                        )}
                        style={{ background: tone.bg }}
                      >
                        {ANSWER_SHAPES[answerIndex]}
                      </button>
                      <Input
                        value={answer.text}
                        onChange={(event) =>
                          onChange({
                            answers: question.answers.map((a, i) =>
                              i === answerIndex ? { ...a, text: event.target.value } : a,
                            ),
                          })
                        }
                        placeholder={`Option ${ANSWER_KEYS[answerIndex]}`}
                        aria-label={`Option ${ANSWER_KEYS[answerIndex]} text`}
                        invalid={Boolean(errors[`${prefix}.answers.${answerIndex}.text`])}
                        maxLength={120}
                      />
                    </div>
                  );
                })}
                {errors[`${prefix}.correctAnswerId`] ? (
                  <FieldError>{errors[`${prefix}.correctAnswerId`]}</FieldError>
                ) : null}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}-timer`}>Timer</Label>
                  <Select
                    id={`${prefix}-timer`}
                    value={String(question.durationSeconds)}
                    onChange={(value) => onChange({ durationSeconds: Number(value) })}
                    options={ALLOWED_DURATIONS.map((seconds) => ({
                      value: String(seconds),
                      label: `${seconds} sec`,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}-mode`}>Question mode</Label>
                  <Select
                    id={`${prefix}-mode`}
                    value={question.mode}
                    onChange={(value) => onChange({ mode: value as QuestionMode })}
                    options={QUESTION_MODES.map((mode) => ({
                      value: mode,
                      label: QUESTION_MODE_LABELS[mode],
                    }))}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors active:bg-ink-700/60 active:text-ink-100 disabled:opacity-30",
        danger && "active:bg-pulse-500/15 active:text-pulse-500",
      )}
    >
      {children}
    </button>
  );
}

/** Native select styled to match — keyboard and screen-reader behaviour for free. */
function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-lg border border-ink-600/70 bg-ink-900/60 px-3 text-sm text-ink-100 transition-colors focus:border-brand-500/70"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-ink-900">
          {option.label}
        </option>
      ))}
    </select>
  );
}
