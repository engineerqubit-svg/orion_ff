import type {
  GameStats,
  LeaderboardEntry,
  Player,
  PlayerAnswer,
} from "@/types/game";
import type { Question } from "@/types/quiz";

/**
 * Rank and statistics calculation. Pure functions over already-persisted state —
 * the engine owns the writes, this file owns the maths.
 */

/**
 * Ranking: score first, then the deeper streak, then whoever joined earliest.
 * Deterministic, so two clients rendering the same data always agree.
 */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) =>
      b.score - a.score ||
      b.bestStreak - a.bestStreak ||
      a.joinedAt.localeCompare(b.joinedAt),
  );
}

export interface LeaderboardOptions {
  /** Points earned on the question just played, keyed by playerId. */
  pointsThisQuestion?: Map<string, number>;
  /** Include position deltas against each player's stored `previousRank`. */
  withDeltas?: boolean;
}

export function buildLeaderboard(
  players: Player[],
  options: LeaderboardOptions = {},
): LeaderboardEntry[] {
  return rankPlayers(players).map((player, index) => {
    const rank = index + 1;
    const previousRank = player.previousRank;
    return {
      rank,
      playerId: player.playerId,
      nickname: player.nickname,
      score: player.score,
      streak: player.streak,
      previousRank,
      // Positive = climbed. A player with no history yet has no delta.
      positionDelta:
        options.withDeltas && typeof previousRank === "number"
          ? previousRank - rank
          : undefined,
      pointsThisQuestion: options.pointsThisQuestion?.get(player.playerId),
    };
  });
}

export function rankOf(players: Player[], playerId: string): number {
  const index = rankPlayers(players).findIndex((p) => p.playerId === playerId);
  return index === -1 ? players.length : index + 1;
}

/**
 * End-of-game fun facts.
 *
 * "Biggest comeback" is derived by replaying the question-by-question score
 * history, so it reflects the worst position a player climbed out of. Manual host
 * adjustments are excluded from the replay — they land outside the question flow.
 */
export function computeGameStats(
  players: Player[],
  answers: PlayerAnswer[],
  questions: Question[],
): GameStats {
  const stats: GameStats = {};
  if (players.length === 0) return stats;

  const nickname = new Map(players.map((p) => [p.playerId, p.nickname] as const));

  const correctAnswers = answers.filter((a) => a.isCorrect);
  const fastest = correctAnswers.reduce<PlayerAnswer | null>(
    (best, current) => (!best || current.responseTimeMs < best.responseTimeMs ? current : best),
    null,
  );
  if (fastest) {
    stats.fastestAnswer = {
      nickname: nickname.get(fastest.playerId) ?? "Unknown",
      responseTimeMs: fastest.responseTimeMs,
      questionIndex: questions.findIndex((q) => q.questionId === fastest.questionId),
    };
  }

  const streakLeader = players.reduce((best, current) =>
    current.bestStreak > best.bestStreak ? current : best,
  );
  if (streakLeader.bestStreak > 0) {
    stats.longestStreak = {
      nickname: streakLeader.nickname,
      streak: streakLeader.bestStreak,
    };
  }

  const correctLeader = players.reduce((best, current) =>
    current.correctCount > best.correctCount ? current : best,
  );
  if (correctLeader.correctCount > 0) {
    stats.mostCorrect = {
      nickname: correctLeader.nickname,
      correctCount: correctLeader.correctCount,
    };
  }

  const comeback = computeBiggestComeback(players, answers, questions);
  if (comeback) stats.biggestComeback = comeback;

  return stats;
}

function computeBiggestComeback(
  players: Player[],
  answers: PlayerAnswer[],
  questions: Question[],
): GameStats["biggestComeback"] {
  const running = new Map<string, number>(players.map((p) => [p.playerId, 0]));
  const worstRank = new Map<string, number>(players.map((p) => [p.playerId, 1]));

  const byQuestion = new Map<string, PlayerAnswer[]>();
  for (const answer of answers) {
    const list = byQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    byQuestion.set(answer.questionId, list);
  }

  for (const question of questions) {
    for (const answer of byQuestion.get(question.questionId) ?? []) {
      const total = answer.pointsAwarded + answer.streakBonus;
      running.set(answer.playerId, (running.get(answer.playerId) ?? 0) + total);
    }

    const standings = [...running.entries()].sort((a, b) => b[1] - a[1]);
    standings.forEach(([playerId], index) => {
      worstRank.set(playerId, Math.max(worstRank.get(playerId) ?? 1, index + 1));
    });
  }

  const finalRanks = new Map(
    rankPlayers(players).map((player, index) => [player.playerId, index + 1] as const),
  );

  let best: { nickname: string; positionsGained: number } | undefined;
  for (const player of players) {
    const gained = (worstRank.get(player.playerId) ?? 1) - (finalRanks.get(player.playerId) ?? 1);
    if (gained > 0 && (!best || gained > best.positionsGained)) {
      best = { nickname: player.nickname, positionsGained: gained };
    }
  }
  return best;
}
