import type {
  GameSession,
  Player,
  PlayerAnswer,
  PointAdjustment,
} from "@/types/game";
import type { QuizSummary, QuizWithQuestions } from "@/types/quiz";
import { normaliseNickname, type DataStore } from "./store";

interface MemoryTables {
  quizzes: Map<string, QuizWithQuestions>;
  games: Map<string, GameSession>;
  pinIndex: Map<string, string>;
  players: Map<string, Map<string, Player>>;
  nicknames: Map<string, Map<string, string>>;
  answers: Map<string, Map<string, PlayerAnswer>>;
  adjustments: Map<string, PointAdjustment[]>;
}

/**
 * Kept on globalThis so Next.js hot-reloads in development don't wipe a live game.
 */
const globalTables = globalThis as unknown as { __arenaTables?: MemoryTables };

function tables(): MemoryTables {
  globalTables.__arenaTables ??= {
    quizzes: new Map(),
    games: new Map(),
    pinIndex: new Map(),
    players: new Map(),
    nicknames: new Map(),
    answers: new Map(),
    adjustments: new Map(),
  };
  return globalTables.__arenaTables;
}

const clone = <T,>(value: T): T => structuredClone(value);
const answerKey = (questionId: string, playerId: string) => `${questionId}#${playerId}`;

/**
 * In-memory store for local development. Single-process and non-durable by design:
 * it exists so the whole UI and game flow can be exercised before any AWS
 * infrastructure is provisioned.
 */
export class MemoryStore implements DataStore {
  readonly name = "memory" as const;

  async putQuiz(quiz: QuizWithQuestions): Promise<void> {
    tables().quizzes.set(quiz.quizId, clone(quiz));
  }

  async getQuiz(quizId: string): Promise<QuizWithQuestions | null> {
    const quiz = tables().quizzes.get(quizId);
    if (!quiz) return null;
    const copy = clone(quiz);
    copy.questions.sort((a, b) => a.order - b.order);
    return copy;
  }

  async listQuizzes(): Promise<QuizSummary[]> {
    return [...tables().quizzes.values()]
      .map(({ questions, ...quiz }) => ({ ...quiz, questionCount: questions.length }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteQuiz(quizId: string): Promise<void> {
    tables().quizzes.delete(quizId);
  }

  async putGame(game: GameSession): Promise<void> {
    const t = tables();
    t.games.set(game.gameId, clone(game));
    t.pinIndex.set(game.gamePin, game.gameId);
  }

  async getGame(gameId: string): Promise<GameSession | null> {
    const game = tables().games.get(gameId);
    return game ? clone(game) : null;
  }

  async getGameByPin(gamePin: string): Promise<GameSession | null> {
    const gameId = tables().pinIndex.get(gamePin);
    return gameId ? this.getGame(gameId) : null;
  }

  async listGames(limit = 25): Promise<GameSession[]> {
    return [...tables().games.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }

  async putPlayer(player: Player): Promise<void> {
    const t = tables();
    const gamePlayers = t.players.get(player.gameId) ?? new Map<string, Player>();
    gamePlayers.set(player.playerId, clone(player));
    t.players.set(player.gameId, gamePlayers);
  }

  async getPlayer(gameId: string, playerId: string): Promise<Player | null> {
    const player = tables().players.get(gameId)?.get(playerId);
    return player ? clone(player) : null;
  }

  async listPlayers(gameId: string): Promise<Player[]> {
    const gamePlayers = tables().players.get(gameId);
    if (!gamePlayers) return [];
    return [...gamePlayers.values()]
      .filter((p) => !p.kicked)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map(clone);
  }

  async deletePlayer(gameId: string, playerId: string): Promise<void> {
    tables().players.get(gameId)?.delete(playerId);
  }

  async reserveNickname(gameId: string, nickname: string, playerId: string): Promise<boolean> {
    const t = tables();
    const taken = t.nicknames.get(gameId) ?? new Map<string, string>();
    const key = normaliseNickname(nickname);
    if (taken.has(key)) return false;
    taken.set(key, playerId);
    t.nicknames.set(gameId, taken);
    return true;
  }

  async releaseNickname(gameId: string, nickname: string): Promise<void> {
    tables().nicknames.get(gameId)?.delete(normaliseNickname(nickname));
  }

  async putAnswerIfAbsent(answer: PlayerAnswer): Promise<boolean> {
    const t = tables();
    const gameAnswers = t.answers.get(answer.gameId) ?? new Map<string, PlayerAnswer>();
    const key = answerKey(answer.questionId, answer.playerId);
    if (gameAnswers.has(key)) return false;
    gameAnswers.set(key, clone(answer));
    t.answers.set(answer.gameId, gameAnswers);
    return true;
  }

  async updateAnswer(answer: PlayerAnswer): Promise<void> {
    const t = tables();
    const gameAnswers = t.answers.get(answer.gameId) ?? new Map<string, PlayerAnswer>();
    gameAnswers.set(answerKey(answer.questionId, answer.playerId), clone(answer));
    t.answers.set(answer.gameId, gameAnswers);
  }

  async getAnswer(
    gameId: string,
    questionId: string,
    playerId: string,
  ): Promise<PlayerAnswer | null> {
    const answer = tables().answers.get(gameId)?.get(answerKey(questionId, playerId));
    return answer ? clone(answer) : null;
  }

  async listAnswersForQuestion(gameId: string, questionId: string): Promise<PlayerAnswer[]> {
    return [...(tables().answers.get(gameId)?.values() ?? [])]
      .filter((a) => a.questionId === questionId)
      .map(clone);
  }

  async listAnswersForGame(gameId: string): Promise<PlayerAnswer[]> {
    return [...(tables().answers.get(gameId)?.values() ?? [])].map(clone);
  }

  async deleteAnswersForQuestion(gameId: string, questionId: string): Promise<void> {
    const gameAnswers = tables().answers.get(gameId);
    if (!gameAnswers) return;
    for (const [key, answer] of gameAnswers) {
      if (answer.questionId === questionId) gameAnswers.delete(key);
    }
  }

  async putAdjustment(adjustment: PointAdjustment): Promise<void> {
    const t = tables();
    const list = t.adjustments.get(adjustment.gameId) ?? [];
    list.push(clone(adjustment));
    t.adjustments.set(adjustment.gameId, list);
  }

  async listAdjustments(gameId: string): Promise<PointAdjustment[]> {
    return [...(tables().adjustments.get(gameId) ?? [])].map(clone);
  }
}
