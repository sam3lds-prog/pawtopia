/** Journey chapters: 20 levels each. The first three are the curated, verified launch pack. */

export interface Chapter {
  index: number; // 0-based
  name: string;
  first: number;
  last: number;
  blurb: string;
}

const NAMES: Array<[string, string]> = [
  ['Meadow Gate', 'Learn the rules on small boards and welcome the first residents.'],
  ['Willow Lane', 'Six-by-six and seven-by-seven boards with trickier regions.'],
  ['Lantern Hill', 'Eight-by-eight boards for patient, careful thinkers.'],
  ['Starlit Orchard', 'Eight-by-eight boards, then every size mixed: small can be hard, big can be gentle.'],
  ['Moonpond Glade', 'Every size from 5×5 to 8×8, with longer chains of reasoning.'],
];

export const LEVELS_PER_CHAPTER = 20;
/** Levels shipped as a frozen, verified pack (see src/data/levelPack.ts). */
export const CURATED_LEVELS = 60;

export function chapterAt(index: number): Chapter {
  const [name, blurb] = NAMES[index] ?? [`Far Fields ${index - NAMES.length + 2}`, 'Endless boards, generated and verified on your device.'];
  const first = index * LEVELS_PER_CHAPTER + 1;
  return { index, name, first, last: first + LEVELS_PER_CHAPTER - 1, blurb };
}

export function chapterOf(level: number): Chapter {
  return chapterAt(Math.floor((Math.max(1, level) - 1) / LEVELS_PER_CHAPTER));
}

/** Chapters the player can browse: all reached ones plus the next. */
export function visibleChapters(nextLevel: number): Chapter[] {
  const reached = chapterOf(nextLevel).index;
  return Array.from({ length: Math.max(3, reached + 1) }, (_, i) => chapterAt(i));
}
