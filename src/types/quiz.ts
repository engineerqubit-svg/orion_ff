/**
 * Quiz authoring domain. These shapes are what the host creates and edits;
 * they are never sent verbatim to participants (see `types/realtime.ts` for the
 * redacted payloads that cross the wire).
 */

/** How a question is scored. Extendable without touching the engine's core loop. */
export const QUESTION_MODES = [
  "NORMAL",
  "DOUBLE_POINTS",
  "FASTEST_FINGER",
  "NO_POINTS",
] as const;

export type QuestionMode = (typeof QUESTION_MODES)[number];

export const QUESTION_MODE_LABELS: Record<QuestionMode, string> = {
  NORMAL: "Normal",
  DOUBLE_POINTS: "Double Points",
  FASTEST_FINGER: "Fastest Finger",
  NO_POINTS: "No Points",
};

/** Dramatic pre-question announcement shown on the projector. */
export const QUESTION_MODE_ANNOUNCEMENT: Record<
  QuestionMode,
  { emoji: string; title: string; blurb: string } | null
> = {
  NORMAL: null,
  DOUBLE_POINTS: {
    emoji: "⚡",
    title: "DOUBLE POINTS",
    blurb: "Every point on this question counts twice.",
  },
  FASTEST_FINGER: {
    emoji: "🔥",
    title: "FASTEST FINGER",
    blurb: "Only the five fastest correct answers score.",
  },
  NO_POINTS: {
    emoji: "🎈",
    title: "JUST FOR FUN",
    blurb: "No points on the line — answer honestly.",
  },
};

export const ALLOWED_DURATIONS = [10, 15, 20, 30, 45, 60] as const;
export type QuestionDuration = (typeof ALLOWED_DURATIONS)[number];

/** Game modes the platform is architected for. Only QUIZ_BATTLE is implemented today. */
export const GAME_MODES = [
  "QUIZ_BATTLE",
  "SCRIBBLE",
  "TEAM_BATTLE",
  "GUESS_THE_IMAGE",
  "GUESS_THE_LOGO",
  "EMOJI_GUESS",
  "THIS_OR_THAT",
  "RAPID_FIRE",
  "AUDIO_GUESS",
  "ELIMINATION",
  "POLL",
] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const IMPLEMENTED_GAME_MODES: readonly GameMode[] = ["QUIZ_BATTLE", "SCRIBBLE"];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  QUIZ_BATTLE: "Quiz Battle",
  SCRIBBLE: "Scribble",
  TEAM_BATTLE: "Team Battle",
  GUESS_THE_IMAGE: "Guess the Image",
  GUESS_THE_LOGO: "Guess the Logo",
  EMOJI_GUESS: "Emoji Guess",
  THIS_OR_THAT: "This or That",
  RAPID_FIRE: "Rapid Fire",
  AUDIO_GUESS: "Audio Guess",
  ELIMINATION: "Elimination",
  POLL: "Poll",
};

export interface Answer {
  id: string;
  text: string;
}

export interface Question {
  questionId: string;
  quizId: string;
  order: number;
  question: string;
  imageUrl?: string;
  /** YouTube URL. Plays on the host display only — never embedded on participant phones. */
  videoUrl?: string;
  answers: Answer[];
  /** Server-only. Stripped from every participant-bound payload before reveal. */
  correctAnswerId: string;
  durationSeconds: number;
  mode: QuestionMode;
}

export interface Quiz {
  quizId: string;
  title: string;
  description?: string;
  category?: string;
  gameMode: GameMode;
  createdAt: string;
  updatedAt: string;
}

export interface QuizWithQuestions extends Quiz {
  questions: Question[];
}

export interface QuizSummary extends Quiz {
  questionCount: number;
}
