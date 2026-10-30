import type { QuestionMode } from "@/types/quiz";

/**
 * Scoring rules. Pure functions, no I/O — the game engine calls these and is the
 * only thing that ever writes a score. Nothing here reads client-supplied timing.
 */

export const SCORING = {
  /** Flat points for any correct answer on a scoring question. */
  BASE_POINTS: 500,
  /** Maximum additional points for answering instantly. */
  MAX_SPEED_BONUS: 500,
  DOUBLE_POINTS_MULTIPLIER: 2,
  /** Points by placement for FASTEST_FINGER; anyone past this list scores 0. */
  FASTEST_FINGER_TABLE: [1000, 800, 600, 400, 200] as const,
  /** Consecutive-correct milestones. Each pays out at most once per unbroken streak. */
  STREAK_MILESTONES: [
    { streak: 3, bonus: 100 },
    { streak: 5, bonus: 250 },
    { streak: 10, bonus: 500 },
  ] as const,
} as const;

export interface SpeedInput {
  responseTimeMs: number;
  durationMs: number;
}

/**
 * Linear decay from full bonus at t=0 to zero bonus at the deadline. Never negative,
 * so a late-but-correct answer still banks the full base points.
 *
 *   instant  -> ~1000   (500 base + ~500 bonus)
 *   halfway  -> ~750
 *   at buzzer-> ~500
 */
export function calculateSpeedBonus({ responseTimeMs, durationMs }: SpeedInput): number {
  if (durationMs <= 0) return 0;
  const elapsedRatio = Math.min(1, Math.max(0, responseTimeMs / durationMs));
  return Math.round(SCORING.MAX_SPEED_BONUS * (1 - elapsedRatio));
}

export interface QuestionPointsInput {
  mode: QuestionMode;
  isCorrect: boolean;
  responseTimeMs: number;
  durationMs: number;
  /** 1-based placement among correct answers. Required for FASTEST_FINGER. */
  fastestFingerRank?: number;
}

export interface QuestionPointsResult {
  basePoints: number;
  speedBonus: number;
  /** basePoints + speedBonus, after any mode multiplier. Excludes streak bonus. */
  points: number;
}

export function calculateQuestionPoints(input: QuestionPointsInput): QuestionPointsResult {
  const empty: QuestionPointsResult = { basePoints: 0, speedBonus: 0, points: 0 };

  if (!input.isCorrect || input.mode === "NO_POINTS") return empty;

  if (input.mode === "FASTEST_FINGER") {
    const rank = input.fastestFingerRank;
    if (!rank || rank < 1) return empty;
    const points = SCORING.FASTEST_FINGER_TABLE[rank - 1] ?? 0;
    return { basePoints: points, speedBonus: 0, points };
  }

  const basePoints = SCORING.BASE_POINTS;
  const speedBonus = calculateSpeedBonus(input);
  const multiplier = input.mode === "DOUBLE_POINTS" ? SCORING.DOUBLE_POINTS_MULTIPLIER : 1;

  return {
    basePoints: basePoints * multiplier,
    speedBonus: speedBonus * multiplier,
    points: (basePoints + speedBonus) * multiplier,
  };
}

export interface StreakInput {
  /** Streak before this question. */
  currentStreak: number;
  /** Milestones already paid during the current unbroken streak. */
  awardedMilestones: number[];
  isCorrect: boolean;
  /** NO_POINTS questions still advance the streak but pay no bonus. */
  awardsPoints: boolean;
}

export interface StreakResult {
  streak: number;
  bonus: number;
  awardedMilestones: number[];
}

/**
 * A wrong answer resets both the streak and its milestone ledger, so a player who
 * climbs back to 3 correct earns the +100 again — but a player sitting on a live
 * streak never gets paid twice for the same milestone.
 */
export function applyStreak(input: StreakInput): StreakResult {
  if (!input.isCorrect) {
    return { streak: 0, bonus: 0, awardedMilestones: [] };
  }

  const streak = input.currentStreak + 1;
  const awarded = [...input.awardedMilestones];
  let bonus = 0;

  if (input.awardsPoints) {
    for (const milestone of SCORING.STREAK_MILESTONES) {
      if (streak >= milestone.streak && !awarded.includes(milestone.streak)) {
        bonus += milestone.bonus;
        awarded.push(milestone.streak);
      }
    }
  }

  return { streak, bonus, awardedMilestones: awarded };
}

/** The next milestone a player is working toward, for participant-side UI hints. */
export function nextStreakMilestone(streak: number): { streak: number; bonus: number } | null {
  return SCORING.STREAK_MILESTONES.find((m) => m.streak > streak) ?? null;
}
