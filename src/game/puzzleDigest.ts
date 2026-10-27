/** Short fingerprint of a board layout (size, regions, givens), never the solution. */

import { hashString } from '../engine/rng';
import type { Puzzle } from '../engine/types';

export function puzzleDigest(p: Pick<Puzzle, 'size' | 'regions' | 'givens'>): string {
  const givens = [...p.givens].sort((a, b) => a.r - b.r || a.c - b.c).map((g) => `${g.r}.${g.c}.${g.kind}`);
  return hashString(`${p.size}|${p.regions.map((row) => row.join(',')).join(';')}|${givens.join(';')}`).toString(16).padStart(8, '0');
}
