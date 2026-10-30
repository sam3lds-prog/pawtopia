import { describe, expect, it } from 'vitest';
import { LEVEL_PACK } from '../../src/data/levelPack';
import { decodePack, verifyBoard } from '../../src/data/packFormat';
import { generatePuzzle } from '../../src/engine/generator';
import { levelSpec } from '../../src/engine/levels';
import { CURATED_LEVELS } from '../../src/meta/chapters';
import { levelMeta, puzzleDigest, puzzleFor, GENERATOR_VERSION } from '../../src/game/puzzles';

const pack = decodePack(LEVEL_PACK);

describe('Journey launch pack', () => {
  it(`ships levels 1–${CURATED_LEVELS}, contiguous`, () => {
    expect(pack.map((e) => e.level)).toEqual(Array.from({ length: CURATED_LEVELS }, (_, i) => i + 1));
    expect(LEVEL_PACK.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it('every board is valid, connected, uniquely solvable and solvable by logic alone', () => {
    for (const e of pack) expect(verifyBoard(e.puzzle), `level ${e.level}`).toEqual([]);
  });

  it('is exactly what the generator produced for these level numbers (v1 players keep their boards)', () => {
    for (const e of pack) {
      const spec = levelSpec(e.level);
      const g = generatePuzzle({ size: spec.size, seed: spec.seed, difficulty: spec.difficulty });
      expect(puzzleDigest(g), `level ${e.level}`).toBe(puzzleDigest(e.puzzle));
      expect(g.solution).toEqual(e.puzzle.solution);
    }
  }, 30_000);

  it('Journey levels come from the pack (the first lessons as levels 21–25 today; levels 1–60 for boards saved under spec 1)', () => {
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 24 }))).toBe(puzzleDigest(pack[3].puzzle));
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 4 }, 1))).toBe(puzzleDigest(pack[3].puzzle));
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 12 }, 1))).toBe(puzzleDigest(pack[11].puzzle));
    expect(levelMeta(7)?.technique).toBe('neighbor-lock');
    expect(levelMeta(61)).toBeNull();
  });

  it('teaches in order: small easy boards first, sizes never shrink', () => {
    for (let i = 0; i < 6; i++) expect(pack[i].puzzle).toMatchObject({ size: 5, difficulty: 'easy' });
    for (let i = 1; i < pack.length; i++) expect(pack[i].puzzle.size).toBeGreaterThanOrEqual(pack[i - 1].puzzle.size);
  });
});
