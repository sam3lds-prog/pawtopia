/**
 * Progressive onboarding. Level 1 is a guided, forgiving board (no hearts lost) where the deduction engine picks
 * two forced placements and they are highlighted one at a time. Later levels introduce one idea each with a
 * single line of coaching at the moment the idea first matters. No walls of text.
 */

import type { ModeRef } from '../game/modes';
import type { SaveV2 } from '../services/storage';

/** The first Journey board, before it has ever been solved, is the guided tutorial. */
export function isTutorial(mode: ModeRef, save: Pick<SaveV2, 'onboarding'>): boolean {
  return mode.kind === 'level' && mode.level === 1 && !save.onboarding.tutorialDone;
}

/** Guided placements in the tutorial (only two highlights, one at a time). */
export const TUTORIAL_STEPS = 2;

const TIPS: Record<number, string> = {
  2: 'Every row and every column holds exactly one cat and one dog.',
  4: 'Colors count too: each color region gets one cat and one dog.',
  6: 'Seven by seven already! Same rules, more room. There is always a logical next step.',
  7: 'New idea: pets never sit side by side. Mark tiles beside a pet as Empty.',
  10: 'A smaller board now and then is a breather, not always an easy one.',
  12: 'Stuck? Hint first shows where to look, then why.',
  15: 'Eight by eight. Start with lines that have only a few open tiles.',
  19: "If a color's open tiles all share one row, that row's pet must live in that color.",
  40: 'Nine by nine, the biggest boards. Take it one line at a time.',
};

/** One-sentence coaching shown when a Journey level opens, or null. */
export function levelTip(level: number): string | null {
  return TIPS[level] ?? null;
}
