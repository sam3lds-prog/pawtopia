/** Short fingerprint of a board layout (size, regions, givens, and the rule when it isn't the original), never the solution. */

import { hashString } from '../engine/rng';
import type { Puzzle } from '../engine/types';

export function puzzleDigest(p: Pick<Puzzle, 'size' | 'regions' | 'givens'> & { rule?: Puzzle['rule'] }): string {
  const givens = [...p.givens].sort((a, b) => a.r - b.r || a.c - b.c).map((g) => `${g.r}.${g.c}.${g.kind}`);
  // Two-animal digests stay exactly as they were; a one-animal board is marked so the two can never collide.
  const rule = p.rule === 'solo' ? '|solo' : '';
  return hashString(`${p.size}|${p.regions.map((row) => row.join(',')).join(';')}|${givens.join(';')}${rule}`)
    .toString(16)
    .padStart(8, '0');
}
