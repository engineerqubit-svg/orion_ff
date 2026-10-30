/**
 * Deterministic answer placement for seed-authored quiz options.
 *
 * Every seed file in this project was hand-written with the correct answer
 * listed first in `options` (the natural way to write trivia while
 * fact-checking it) and nothing ever reordered them before they reached
 * `correctIndex`/`correctAnswerId` — so every question in every quiz
 * (Diwali Dhamaka, the Diwali practice round, and the original sample quiz)
 * shipped with the correct answer sitting in slot A. A quiz where "always
 * pick the first option" scores perfectly isn't a quiz.
 *
 * A plain per-question shuffle (seed the PRNG differently per question, let
 * it land wherever) fixed "always A" but not the underlying risk: on a small
 * set of questions a shuffle can still cluster — the first version of this
 * fix put the correct answer in slot B on 10 of the Diwali quiz's 20
 * questions. `placeAnswer` instead *assigns* the correct answer's slot by
 * cycling A→B→C→D→A… across question order, which is correct by
 * construction rather than by luck, and only uses the PRNG to shuffle which
 * of the three wrong answers fills each remaining slot (so those aren't
 * always in their original written order either).
 */

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  const next = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };

  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Returns `options` reordered so the correct answer lands in a slot chosen
 * by cycling through all positions in order across the quiz (question 1 →
 * slot 0, question 2 → slot 1, question 3 → slot 2, question 4 → slot 3,
 * question 5 → slot 0, …), guaranteeing an even spread no matter how many
 * questions the quiz has. The wrong answers fill the remaining slots in a
 * seeded-shuffled order.
 */
export function placeAnswer<T>(
  options: readonly T[],
  correctIndex: number,
  questionOrder: number,
): T[] {
  const correct = options[correctIndex]!;
  const wrong = options.filter((_, i) => i !== correctIndex);
  const shuffledWrong = seededShuffle(wrong, questionOrder * 104729);
  const targetSlot = (questionOrder - 1) % options.length;

  const result: T[] = [];
  let cursor = 0;
  for (let i = 0; i < options.length; i++) {
    result.push(i === targetSlot ? correct : shuffledWrong[cursor++]!);
  }
  return result;
}
