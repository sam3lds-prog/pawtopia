/**
 * Progressive onboarding (D35). Level 1 is a guided, forgiving one-animal board (no hearts lost) where the deduction
 * engine picks two forced placements and they are highlighted one at a time; level 21, the first two-animal board, is
 * guided the same way (with its hearts). Players who never saw a rule get a short how-to sheet the first time they meet
 * it (an existing player's first one-animal board, say). Other levels introduce one idea each with a single line of
 * coaching at the moment the idea first matters. No walls of text.
 */

import { FIRST_PAIR_LEVEL, type ModeRef } from '../game/modes';
import type { SaveV2 } from '../services/storage';

/** The first Journey board, before it has ever been solved, is the guided tutorial. */
export function isTutorial(mode: ModeRef, save: Pick<SaveV2, 'onboarding'>): boolean {
  return mode.kind === 'level' && mode.level === 1 && !save.onboarding.tutorialDone;
}

/** The first two-animal Journey board, until it has been solved, is a guided lesson. */
export function isPairLesson(mode: ModeRef, save: Pick<SaveV2, 'onboarding'>): boolean {
  return mode.kind === 'level' && mode.level === FIRST_PAIR_LEVEL && !save.onboarding.pairLessonDone;
}

/** Guided placements in the tutorial and the two-animal lesson (two highlights, one at a time). */
export const TUTORIAL_STEPS = 2;

/** `{a}` and `{b}` are the board's animals ("sheep", "piglet"). */
const TIPS: Record<number, string> = {
  // One animal
  2: 'Each {a} rules out its whole row, column and color, and the eight tiles around it. Mark them ✕ to keep track.',
  3: "Look for a color that fits in a single row: that row's {a} has to live in that color.",
  4: 'Six by six. The smallest colors are the best place to start.',
  6: 'Stuck? Hint first shows where to look, then why.',
  7: 'Seven by seven already! There is always a logical next step.',
  9: 'If {a} on a tile would leave some color with nowhere to go, that tile stays empty.',
  12: 'Eight by eight. Start with the smallest colors and the shortest lines.',
  14: 'Two colors squeezed into the same two rows use up both rows: nothing else in them can hold {a}.',
  17: 'Nine by nine, the biggest boards. One color at a time.',
  20: 'The last one-animal board! At level 21 a second animal joins in.',
  // Two animals
  22: 'Every row and every column holds exactly one {a} and one {b}.',
  24: 'Colors count too: each color gets one {a} and one {b}.',
  26: 'Seven by seven, with two animals. There is always a logical next step.',
  27: 'Tiles right beside an animal always stay empty: mark them ✕.',
  30: 'A smaller board now and then is a breather, not always an easy one.',
  35: 'Eight by eight. Start with lines that have only a few open tiles.',
  39: "If a color's open tiles for {a} all share one row, that row's {a} must live in that color.",
  60: 'Nine by nine, the biggest boards. Take it one line at a time.',
};

/** One-sentence coaching shown when a Journey level opens, or null. */
export function levelTip(level: number, a = 'animal', b = 'animal'): string | null {
  const t = TIPS[level];
  if (!t) return null;
  return t.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
}
