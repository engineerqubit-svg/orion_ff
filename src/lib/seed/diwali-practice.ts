import type { QuestionMode, QuizWithQuestions } from "@/types/quiz";
import { placeAnswer } from "./shuffle";

/**
 * Warm-up round for the live 10-minute rules segment. Three deliberately easy
 * questions — the point is teaching the tap-to-answer mechanic to a 10-to-60
 * age range in front of 200 people, not testing anyone. All NO_POINTS so
 * nobody feels behind before the real quiz starts.
 *
 * Q2 carries a poster image (DDLJ, verified resolving on Wikimedia) so the
 * warm-up also previews what the real quiz's media questions will look like.
 *
 * `options` is written correct-answer-first; `build()` places the answer via
 * `placeAnswer` before use — see shuffle.ts for why that step exists.
 */

export const PRACTICE_QUIZ_ID = "quiz-diwali-practice";

interface Seed {
  order: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  durationSeconds: number;
  mode?: QuestionMode;
  image?: string;
}

const SEEDS: Seed[] = [
  {
    order: 1,
    question: "Warm-up! What do we light to celebrate Diwali?",
    options: ["Diyas", "Jack-o'-lanterns", "Birthday candles", "Paper lanterns"],
    correctIndex: 0,
    durationSeconds: 10,
    mode: "NO_POINTS",
  },
  {
    order: 2,
    question: "Which Bollywood superstar is known the world over as 'King Khan'?",
    options: ["Shah Rukh Khan", "Salman Khan", "Aamir Khan", "Akshay Kumar"],
    correctIndex: 0,
    durationSeconds: 10,
    mode: "NO_POINTS",
    image: "https://upload.wikimedia.org/wikipedia/en/8/80/Dilwale_Dulhania_Le_Jayenge_poster.jpg",
  },
  {
    order: 3,
    question: "Which colours are traditionally considered auspicious to wear on Diwali?",
    options: ["Red and gold", "All black", "Grey", "All white"],
    correctIndex: 0,
    durationSeconds: 10,
    mode: "NO_POINTS",
  },
];

function build(seed: Seed) {
  const correctText = seed.options[seed.correctIndex];
  const placed = placeAnswer(seed.options, seed.correctIndex, seed.order);
  const answers = placed.map((text, index) => ({
    id: `pq${seed.order}a${index + 1}`,
    text,
  }));

  return {
    questionId: `${PRACTICE_QUIZ_ID}-q${seed.order}`,
    quizId: PRACTICE_QUIZ_ID,
    order: seed.order - 1,
    question: seed.question,
    imageUrl: seed.image,
    answers,
    correctAnswerId: answers.find((a) => a.text === correctText)!.id,
    durationSeconds: seed.durationSeconds,
    mode: seed.mode ?? ("NORMAL" as QuestionMode),
  };
}

export const practiceQuiz: QuizWithQuestions = {
  quizId: PRACTICE_QUIZ_ID,
  title: "Practice Round — Just for Fun",
  description: "Three warm-up questions to get everyone used to tapping an answer. No points, no pressure.",
  category: "Warm-up",
  gameMode: "QUIZ_BATTLE",
  createdAt: "2026-10-28T09:00:00.000Z",
  updatedAt: "2026-10-28T09:00:00.000Z",
  questions: SEEDS.map(build),
};
