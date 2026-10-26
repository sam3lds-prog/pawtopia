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
  7: 'New idea: pets never sit side by side. Mark tiles beside a pet as Empty.',
  11: 'Six by six. Same rules, a little more room to think.',
  12: 'Stuck? Hint first shows where to look, then why.',
  19: "If a color's open tiles all share one row, that row's pet must live in that color.",
  27: 'Seven by seven. There is always a logical next step.',
  41: 'Eight by eight. Start with lines that have only a few open tiles.',
};

/** One-sentence coaching shown when a Journey level opens, or null. */
export function levelTip(level: number): string | null {
  return TIPS[level] ?? null;
}
