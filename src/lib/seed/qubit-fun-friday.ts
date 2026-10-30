import type { QuestionMode, QuizWithQuestions } from "@/types/quiz";
import { placeAnswer } from "./shuffle";

/**
 * Built-in sample quiz: a Bollywood "guess the movie" round built around the
 * stills in `public/quiz-media`, where the file name is the question number.
 *
 * Question 2 has no image (there is no 2.png), so it runs as a text question.
 * Entirely self-contained — no external API calls or remote image hosts.
 *
 * `options` is written correct-answer-first; `build()` places the answer via
 * `placeAnswer` before use — see shuffle.ts for why that step exists.
 */

export const SAMPLE_QUIZ_ID = "quiz-qubit-fun-friday";

interface Seed {
  order: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  durationSeconds: number;
  mode?: QuestionMode;
  /** File in public/quiz-media, named after the question number. */
  image?: string;
}

const SEEDS: Seed[] = [
  {
    order: 1,
    question: "Name the film — Madhuri and Aishwarya face off in 'Dola Re Dola'.",
    options: ["Devdas", "Hum Dil De Chuke Sanam", "Bajirao Mastani", "Saawariya"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "1.png",
  },
  {
    order: 2,
    question: "Which Bollywood film was India's first official entry to win the Filmfare Best Film award in 1954?",
    options: ["Do Bigha Zamin", "Mother India", "Awaara", "Shree 420"],
    correctIndex: 0,
    durationSeconds: 20,
  },
  {
    order: 3,
    question: "Madhuri Dixit returns to the screen in this Yash Raj title track. Which film?",
    options: ["Aaja Nachle", "Dedh Ishqiya", "Gulaab Gang", "Devdas"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "3.png",
  },
  {
    order: 4,
    question: "Katrina lands the kick, Aamir keeps his hat on. Which film is this?",
    options: ["Dhoom 3", "Bang Bang", "Jagga Jasoos", "Thugs of Hindostan"],
    correctIndex: 0,
    durationSeconds: 20,
    mode: "DOUBLE_POINTS",
    image: "4.png",
  },
  {
    order: 5,
    question: "Holi, a dhol, and 'Balam Pichkari'. Name the film.",
    options: [
      "Yeh Jawaani Hai Deewani",
      "Tamasha",
      "Rockstar",
      "Ae Dil Hai Mushkil",
    ],
    correctIndex: 0,
    durationSeconds: 20,
    image: "5.png",
  },
  {
    order: 6,
    question: "SRK and Kajol, mustard fields and one very famous train. Which film?",
    options: [
      "Dilwale Dulhania Le Jayenge",
      "Kuch Kuch Hota Hai",
      "Kabhi Khushi Kabhie Gham",
      "My Name Is Khan",
    ],
    correctIndex: 0,
    durationSeconds: 15,
    mode: "FASTEST_FINGER",
    image: "6.png",
  },
  {
    order: 7,
    question: "Salman and Aishwarya, a courtyard full of diyas. Name the film.",
    options: [
      "Hum Dil De Chuke Sanam",
      "Devdas",
      "Jodhaa Akbar",
      "Hum Saath-Saath Hain",
    ],
    correctIndex: 0,
    durationSeconds: 20,
    image: "7.png",
  },
  {
    order: 8,
    question: "Salman carried through the crowd in a temple town. Which film?",
    options: ["Bajrangi Bhaijaan", "Dabangg", "Sultan", "Tubelight"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "8.png",
  },
  {
    order: 9,
    question: "Salman and Anushka at the wedding. Name the film.",
    options: ["Sultan", "Ae Dil Hai Mushkil", "Rab Ne Bana Di Jodi", "Zero"],
    correctIndex: 0,
    durationSeconds: 20,
    image: "9.png",
  },
  {
    order: 10,
    question: "Final question — Salman in the white vest, a garden at night. Which film?",
    options: ["Maine Pyar Kiya", "Hum Aapke Hain Koun..!", "Judwaa", "Biwi No.1"],
    correctIndex: 0,
    durationSeconds: 30,
    mode: "DOUBLE_POINTS",
    image: "10.png",
  },
];

function build(seed: Seed) {
  const correctText = seed.options[seed.correctIndex];
  const placed = placeAnswer(seed.options, seed.correctIndex, seed.order);
  const answers = placed.map((text, index) => ({
    id: `q${seed.order}a${index + 1}`,
    text,
  }));

  return {
    questionId: `${SAMPLE_QUIZ_ID}-q${seed.order}`,
    quizId: SAMPLE_QUIZ_ID,
    order: seed.order - 1,
    question: seed.question,
    imageUrl: seed.image ? `/quiz-media/${seed.image}` : undefined,
    answers,
    correctAnswerId: answers.find((a) => a.text === correctText)!.id,
    durationSeconds: seed.durationSeconds,
    mode: seed.mode ?? ("NORMAL" as QuestionMode),
  };
}

export const sampleQuiz: QuizWithQuestions = {
  quizId: SAMPLE_QUIZ_ID,
  title: "Qubit Fun Friday — Bollywood Edition",
  description: "Ten stills, ten films. Shout it out before the timer does.",
  category: "Movies",
  gameMode: "QUIZ_BATTLE",
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
  questions: SEEDS.map(build),
};
