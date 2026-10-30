/**
 * Scribble scoring and guess matching. Pure functions — the engine owns the writes.
 */

export const SCRIBBLE_SCORING = {
  /** Points for an instant correct guess. */
  MAX_GUESS_POINTS: 1000,
  /** Floor for a correct guess right on the buzzer — being right always pays. */
  MIN_GUESS_POINTS: 300,
  /** Share of the room that must get it for the drawer to earn a full guesser's average. */
  DRAWER_FULL_SHARE: 0.5,
} as const;

/**
 * Linear decay from 1000 at t=0 down to 300 at the buzzer.
 *
 *   5s of 60   -> ~942
 *   15s        -> ~825
 *   30s        -> ~650
 *   45s        -> ~475
 *   58s        -> ~323
 */
export function calculateGuessPoints(responseTimeMs: number, durationMs: number): number {
  if (durationMs <= 0) return SCRIBBLE_SCORING.MIN_GUESS_POINTS;

  const elapsed = Math.min(1, Math.max(0, responseTimeMs / durationMs));
  const spread = SCRIBBLE_SCORING.MAX_GUESS_POINTS - SCRIBBLE_SCORING.MIN_GUESS_POINTS;

  return Math.round(SCRIBBLE_SCORING.MIN_GUESS_POINTS + spread * (1 - elapsed));
}

/**
 * Drawing is score-neutral. With 50 players only a handful ever draw, so a
 * drawer bonus would hand those few a lead the rest can't earn. Instead the
 * drawer gets what a typical correct guesser got this round — exactly what
 * they'd likely have scored had they been guessing — scaled down when less than
 * half the room understood the drawing, so scribbling nonsense still doesn't pay.
 *
 *   30 of 49 got it, averaging 720  -> 720
 *   12 of 49 got it, averaging 650  -> 650 x (0.245 / 0.5) = 318
 *   nobody got it                   -> 0, same as every guesser
 */
export function calculateDrawerPoints(correctPoints: number[], guesserCount: number): number {
  if (guesserCount <= 0 || correctPoints.length === 0) return 0;

  const average = correctPoints.reduce((sum, points) => sum + points, 0) / correctPoints.length;
  const share = correctPoints.length / guesserCount;
  const scale = Math.min(1, share / SCRIBBLE_SCORING.DRAWER_FULL_SHARE);
  return Math.round(average * scale);
}

/**
 * Guess matching is forgiving about formatting and strict about spelling:
 * "Coffee Machine", "coffee-machine" and "  COFFEE   machine " all match.
 */
export function normalizeGuess(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

/** Spacing is ignored too: "cricket-match", "cricketmatch" and "Cricket Match" are all right. */
export function isExactMatch(guess: string, word: string): boolean {
  const compact = (value: string) => normalizeGuess(value).replace(/ /g, "");
  return compact(guess) === compact(word);
}

/** "an alien spaceship" contains "alien" — wrong, but far too revealing to show the room. */
export function containsWord(guess: string, word: string): boolean {
  const g = normalizeGuess(guess).replace(/ /g, "");
  const w = normalizeGuess(word).replace(/ /g, "");
  return w.length > 0 && g.includes(w);
}

/** Classic iterative Levenshtein — the strings here are a few words at most. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost,
      );
    }
    previous = current;
  }

  return previous[b.length]!;
}

/**
 * "So close!" fires at one edit away — enough to catch a typo or a near-miss
 * without hinting at longer words that merely share a prefix.
 */
export function isCloseGuess(guess: string, word: string): boolean {
  const normalisedGuess = normalizeGuess(guess);
  const normalisedWord = normalizeGuess(word);
  if (normalisedGuess.length < 3) return false;

  const distance = levenshtein(normalisedGuess, normalisedWord);
  if (distance === 0) return false;
  if (distance <= 1) return true;

  // Getting one word of a two-word answer right also counts as close.
  const parts = normalisedWord.split(" ");
  return parts.length > 1 && parts.includes(normalisedGuess);
}

/* ------------------------------------------------------------------- Hints */

/** Letter positions that can be revealed — spaces are always visible. */
export function hintableIndices(word: string): number[] {
  return [...word].reduce<number[]>((indices, char, index) => {
    if (char.trim().length > 0) indices.push(index);
    return indices;
  }, []);
}

/**
 * How many letters to expose at a given point. Capped at 40% of the word so a
 * hint never makes the answer trivial.
 */
export function revealCountFor(elapsedFraction: number, word: string): number {
  const hintable = hintableIndices(word).length;
  const cap = Math.floor(hintable * 0.4);
  if (cap <= 0) return 0;

  if (elapsedFraction >= 0.75) return Math.min(cap, 2);
  if (elapsedFraction >= 0.5) return Math.min(cap, 1);
  return 0;
}

/**
 * Deterministic pick, so every screen shows the same letters and a reconnect
 * doesn't shuffle the hint.
 */
export function chooseRevealIndices(word: string, count: number): number[] {
  const candidates = hintableIndices(word);
  if (count <= 0 || candidates.length === 0) return [];

  let seed = 0;
  for (const char of word) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;

  const picked: number[] = [];
  const pool = [...candidates];
  while (picked.length < Math.min(count, candidates.length)) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const [index] = pool.splice(seed % pool.length, 1);
    if (index !== undefined) picked.push(index);
  }

  return picked.sort((a, b) => a - b);
}

/** `"Coffee Machine"` with index 2 revealed -> `"_ _ F _ _ _   _ _ _ _ _ _ _"`. */
export function buildHint(word: string, revealedIndices: number[]): string {
  const revealed = new Set(revealedIndices);
  return [...word]
    .map((char, index) => {
      if (char.trim().length === 0) return " ";
      return revealed.has(index) ? char.toUpperCase() : "_";
    })
    .join(" ")
    .replace(/\s{3,}/g, "   ");
}

export function wordLetterCount(word: string): number {
  return hintableIndices(word).length;
}
