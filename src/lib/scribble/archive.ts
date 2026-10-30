import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GameSession, Player } from "@/types/game";
import type { ScribbleRoundRecord, ScribbleScoreEntry } from "@/types/scribble";

/**
 * Durable record of a Scribble game on the host's disk.
 *
 * Game state lives in memory, so if the server dies mid-event everything would
 * be gone. After every round (and at start/finish) the engine hands the full
 * picture to `saveArchive`, which writes `.data/scribble/<PIN>-<gameId>.json`.
 * The live game can't be resumed from it, but nobody's score, guesses or
 * drawings are lost.
 *
 * Writes are atomic (temp file + rename) and serialised per game, so a crash
 * mid-write leaves the previous good copy in place.
 */

export const ARCHIVE_DIR = path.join(process.cwd(), ".data", "scribble");

export interface ScribbleArchive {
  savedAt: string;
  game: {
    gameId: string;
    gamePin: string;
    createdAt: string;
    finishedAt?: string;
    status: string;
    totalRounds: number;
    durationSeconds: number;
  };
  players: {
    playerId: string;
    nickname: string;
    score: number;
    correctGuesses: number;
    joinedAt: string;
    connected: boolean;
    kicked: boolean;
  }[];
  leaderboard: ScribbleScoreEntry[];
  rounds: ScribbleRoundRecord[];
}

const cache = globalThis as unknown as { __scribbleArchiveQueue?: Map<string, Promise<void>> };

function queue(): Map<string, Promise<void>> {
  cache.__scribbleArchiveQueue ??= new Map();
  return cache.__scribbleArchiveQueue;
}

export function archivePath(game: Pick<GameSession, "gameId" | "gamePin">): string {
  return path.join(ARCHIVE_DIR, `${game.gamePin}-${game.gameId}.json`);
}

export function buildArchive(input: {
  game: GameSession;
  status: string;
  totalRounds: number;
  durationSeconds: number;
  players: Player[];
  leaderboard: ScribbleScoreEntry[];
  rounds: ScribbleRoundRecord[];
}): ScribbleArchive {
  return {
    savedAt: new Date().toISOString(),
    game: {
      gameId: input.game.gameId,
      gamePin: input.game.gamePin,
      createdAt: input.game.createdAt,
      finishedAt: input.game.finishedAt,
      status: input.status,
      totalRounds: input.totalRounds,
      durationSeconds: input.durationSeconds,
    },
    // Tokens are credentials; they never go to disk.
    players: input.players.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
      correctGuesses: p.correctCount,
      joinedAt: p.joinedAt,
      connected: p.connected,
      kicked: Boolean(p.kicked),
    })),
    leaderboard: input.leaderboard,
    rounds: input.rounds,
  };
}

/** Fire-and-forget from the engine's point of view: a disk error never stops the game. */
export function saveArchive(archive: ScribbleArchive): Promise<void> {
  const file = path.join(ARCHIVE_DIR, `${archive.game.gamePin}-${archive.game.gameId}.json`);
  const previous = queue().get(file) ?? Promise.resolve();

  const next = previous
    .then(async () => {
      await mkdir(ARCHIVE_DIR, { recursive: true });
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(archive, null, 2), "utf8");
      await rename(temp, file);
    })
    .catch((error) => console.error("[scribble] failed to save archive", error));

  queue().set(file, next);
  return next;
}

export async function readArchive(
  game: Pick<GameSession, "gameId" | "gamePin">,
): Promise<ScribbleArchive | null> {
  try {
    return JSON.parse(await readFile(archivePath(game), "utf8")) as ScribbleArchive;
  } catch {
    return null;
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  // BOM so Excel opens names with non-ASCII characters correctly.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** One row per player, ranked — the sheet people actually want afterwards. */
export function resultsCsv(archive: ScribbleArchive): string {
  return toCsv([
    ["Rank", "Nickname", "Score", "Correct guesses", "Rounds drawn"],
    ...archive.leaderboard.map((e) => [e.rank, e.nickname, e.score, e.correctGuesses, e.roundsDrawn]),
  ]);
}

/** Every guess of every round, practice included and marked as such. */
export function guessesCsv(archive: ScribbleArchive): string {
  return toCsv([
    ["Round", "Practice", "Word", "Drawer", "Player", "Guess", "Outcome", "Seconds into round", "Points"],
    ...archive.rounds.flatMap((round) =>
      round.guesses.map((g) => [
        round.roundNumber,
        round.practice ? "yes" : "no",
        round.word,
        round.drawerName,
        g.nickname,
        g.guess,
        g.outcome,
        (g.atMs / 1000).toFixed(1),
        g.points ?? "",
      ]),
    ),
  ]);
}
