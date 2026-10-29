import { describe, expect, it } from 'vitest';
import { JOURNEY_PACK_2 } from '../../src/data/journeyPack2';
import { JOURNEY_PACK_3 } from '../../src/data/journeyPack3';
import { JOURNEY_PACK3_LAST, JOURNEY_PACK_FIRST, JOURNEY_PACK_LAST } from '../../src/data/journeyPackRange';
import { LEVEL_PACK } from '../../src/data/levelPack';
import { decodePack, verifyBoard } from '../../src/data/packFormat';
import { generatePuzzle } from '../../src/engine/generator';
import { dailySpec, levelSpec } from '../../src/engine/levels';
import { CAT, DOG, EMPTY, type Species } from '../../src/engine/types';
import { cupBoardSpec } from '../../src/competitions/cup';
import { addDaysKey, dateFromKey } from '../../src/game/dates';
import { GRADING_VERSION, profileBoard, profileOf, tierFor, displayDifficulty, difficultyReason } from '../../src/game/grading';
import { currentSpec, puzzleDigest, puzzleFor, sizeFor, journeyMeta } from '../../src/game/puzzles';
import { DAILY_V2_FROM, JOURNEY_V2_FROM, JOURNEY_V3_FROM, MAX_JOURNEY_SIZE, MAX_NEW_BOARD_SIZE, dailyTargetV2, journeyTargetV2, journeyTargetV3, pickBoard } from '../../src/game/specs';
import { Session } from '../../src/game/session';
import { captureSession, resumeSession } from '../../src/game/sessionPersistence';
import { recordWin } from '../../src/meta/progression';
import { defaultSave } from '../../src/services/storage';

const LEVEL_PACK_BY_LEVEL = (level: number) => decodePack(LEVEL_PACK).find((e) => e.level === level)!.puzzle;

const pack2 = decodePack(JOURNEY_PACK_2);
const pack3 = decodePack(JOURNEY_PACK_3);

describe('measured difficulty', () => {
  it('is deterministic for a board', () => {
    const p = generatePuzzle({ size: 7, seed: 77 });
    expect(profileBoard(p.size, p.regions, p.givens)).toEqual(profileBoard(p.size, p.regions, p.givens));
  });

  it('Easy means singles only; anything that needs an idea is at least Medium; Expert needs neighbor logic', () => {
    expect(tierFor(999, 'single')).toBe('easy');
    expect(tierFor(999, null)).toBe('easy');
    expect(tierFor(0, 'pointing')).toBe('medium');
    expect(tierFor(999, 'pointing')).toBe('hard');
    expect(tierFor(999, 'neighbor-lock')).toBe('expert');
  });

  it('agrees with the engine on singles-only boards across sizes, and every shipped board is logic-solvable', () => {
    for (const e of decodePack(LEVEL_PACK)) {
      const prof = profileOf(e.puzzle);
      expect(prof.solved, `level ${e.level}`).toBe(true);
      if (e.meta.technique === 'single') expect(prof.tier, `level ${e.level}`).toBe('easy');
      else expect(prof.tier, `level ${e.level}`).not.toBe('easy');
    }
  });

  it('gives a short, honest reason', () => {
    const easy = profileOf(decodePack(LEVEL_PACK)[0].puzzle);
    expect(difficultyReason(easy)).toMatch(/single spot/);
    const hard = pack2.find((e) => e.meta.tier === 'expert')!;
    expect(difficultyReason(profileOf(hard.puzzle)).length).toBeGreaterThan(5);
  });
});

describe('Journey pack 2 (levels 61–150)', () => {
  it('is contiguous and records the grading version', () => {
    expect(pack2.map((e) => e.level)).toEqual(Array.from({ length: JOURNEY_PACK_LAST - JOURNEY_PACK_FIRST + 1 }, (_, i) => i + JOURNEY_PACK_FIRST));
    expect(JOURNEY_PACK_2.gradingVersion).toBe(GRADING_VERSION);
  });

  it('every board is valid, uniquely solvable, logic-solvable and at most 8×8', () => {
    for (const e of pack2) {
      expect(verifyBoard(e.puzzle), `level ${e.level}`).toEqual([]);
      expect(e.puzzle.size, `level ${e.level}`).toBeLessThanOrEqual(MAX_NEW_BOARD_SIZE);
    }
  }, 60_000);

  it('levels 61–70 are exactly the boards the original ladder already gave players', () => {
    for (const e of pack2.filter((x) => x.level < JOURNEY_V2_FROM)) {
      const s = levelSpec(e.level);
      expect(e.meta.spec).toBe(1);
      expect(puzzleDigest(generatePuzzle({ size: s.size, seed: s.seed, difficulty: s.difficulty })), `level ${e.level}`).toBe(puzzleDigest(e.puzzle));
    }
  }, 30_000);

  it('levels 71+ are the rotated ladder: reproducible, labeled by measurement, and the label is what was asked for', () => {
    const sizes = new Set<number>();
    for (const e of pack2.filter((x) => x.level >= JOURNEY_V2_FROM)) {
      const t = journeyTargetV2(e.level);
      expect(e.meta.spec).toBe(2);
      expect(e.puzzle.size).toBe(t.size);
      expect(e.meta.tier).toBe(profileOf(e.puzzle).tier);
      expect(e.meta.tier, `level ${e.level}`).toBe(t.tier);
      expect(puzzleDigest(pickBoard(t)), `level ${e.level}`).toBe(puzzleDigest(e.puzzle));
      sizes.add(e.puzzle.size);
    }
    expect([...sizes].sort()).toEqual([5, 6, 7, 8]);
  }, 120_000);

  it('rotates sizes instead of only growing them', () => {
    const run = pack2.filter((x) => x.level >= JOURNEY_V2_FROM && x.level < JOURNEY_V2_FROM + 10).map((e) => e.puzzle.size);
    expect(run.some((s, i) => i > 0 && s < run[i - 1])).toBe(true);
  });
});

describe('Journey pack 3 (spec 3, levels 6–150): the steeper ramp', () => {
  it('is contiguous, records the grading version, and every board is valid, unique, logic-solvable and at most 9×9', () => {
    expect(pack3.map((e) => e.level)).toEqual(Array.from({ length: JOURNEY_PACK3_LAST - JOURNEY_V3_FROM + 1 }, (_, i) => i + JOURNEY_V3_FROM));
    expect(JOURNEY_PACK_3.gradingVersion).toBe(GRADING_VERSION);
    for (const e of pack3) {
      expect(e.meta.spec).toBe(3);
      expect(verifyBoard(e.puzzle), `level ${e.level}`).toEqual([]);
      expect(e.puzzle.size, `level ${e.level}`).toBeLessThanOrEqual(MAX_JOURNEY_SIZE);
    }
  }, 120_000);

  it('is reproducible, and each board measures exactly the difficulty its slot asks for', () => {
    for (const e of pack3) {
      const t = journeyTargetV3(e.level);
      expect(e.puzzle.size, `level ${e.level}`).toBe(t.size);
      expect(e.meta.tier, `level ${e.level}`).toBe(profileOf(e.puzzle).tier);
      expect(e.meta.tier, `level ${e.level}`).toBe(t.tier);
    }
    for (const L of [6, 15, 40, 77, 150]) expect(puzzleDigest(pickBoard(journeyTargetV3(L))), `level ${L}`).toBe(puzzleDigest(pack3.find((e) => e.level === L)!.puzzle));
  }, 120_000);

  it('ramps the way it should: 7×7 right after the first lessons, 8×8 joining, 9×9 from 40 and the main size after 70', () => {
    const size = (L: number) => pack3.find((e) => e.level === L)!.puzzle.size;
    const share = (from: number, to: number, n: number) => pack3.filter((e) => e.level >= from && e.level <= to && e.puzzle.size === n).length / (to - from + 1);
    expect(size(6)).toBe(7);
    expect(share(6, 20, 7)).toBeGreaterThanOrEqual(0.6);
    expect(share(6, 39, 9)).toBe(0);
    expect(size(40)).toBe(9);
    expect(share(21, 40, 8)).toBeGreaterThan(share(21, 40, 7));
    expect(share(41, 70, 9)).toBeGreaterThan(0.2);
    expect(share(71, 150, 9)).toBeGreaterThanOrEqual(0.6);
    // Breathers: a smaller board still turns up now and then.
    expect(pack3.some((e) => e.level > 40 && e.puzzle.size <= 7)).toBe(true);
  });
});

describe('versioned specs', () => {
  it('Journey 6+ uses spec 3, dailies from the cut-over spec 2; the first lessons, Zen and Paw Cup stay on spec 1', () => {
    expect(currentSpec({ kind: 'level', level: 5 })).toBe(1);
    expect(currentSpec({ kind: 'level', level: 6 })).toBe(3);
    expect(currentSpec({ kind: 'level', level: 70 })).toBe(3);
    expect(currentSpec({ kind: 'level', level: 71 })).toBe(3);
    expect(currentSpec({ kind: 'daily', dateKey: addDaysKey(DAILY_V2_FROM, -1) })).toBe(1);
    expect(currentSpec({ kind: 'daily', dateKey: DAILY_V2_FROM })).toBe(2);
    expect(currentSpec({ kind: 'zen', size: 6, seed: 3 })).toBe(1);
    expect(currentSpec({ kind: 'cup', weekKey: '2026-W44', index: 4 })).toBe(1);
  });

  it('new Journey boards come from pack 3, and boards saved under spec 1 or 2 still find their own board', () => {
    const now = puzzleFor({ kind: 'level', level: 75 });
    expect(puzzleDigest(now)).toBe(puzzleDigest(pack3.find((e) => e.level === 75)!.puzzle));
    expect(journeyMeta(75)?.spec).toBe(3);
    expect(sizeFor({ kind: 'level', level: 75 })).toBe(now.size);
    // Spec 2 (the ≤ 8×8 rotation) and spec 1 (the original 9×9) are still buildable for saves made under them.
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 75 }, 2))).toBe(puzzleDigest(pack2.find((e) => e.level === 75)!.puzzle));
    expect(journeyMeta(75, 2)?.spec).toBe(2);
    expect(puzzleFor({ kind: 'level', level: 75 }, 1).size).toBe(9);
    expect(sizeFor({ kind: 'level', level: 75 }, 1)).toBe(9);
    // Levels 6–60 under spec 1 are still the launch pack's boards; 1–5 never changed.
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 12 }, 1))).toBe(puzzleDigest(decodePack(LEVEL_PACK)[11].puzzle));
    expect(puzzleDigest(puzzleFor({ kind: 'level', level: 3 }))).toBe(puzzleDigest(decodePack(LEVEL_PACK)[2].puzzle));
  });

  it('levels beyond pack 3 are picked on device by the same rule (≤ 9×9, measured label = target)', () => {
    for (const L of [151, 156, 158]) {
      const p = puzzleFor({ kind: 'level', level: L });
      const t = journeyTargetV3(L);
      expect(p.size).toBe(t.size);
      expect(displayDifficulty(p)).toBe(t.tier);
    }
    // The old spec-2 rule still works for boards saved under it.
    const old = puzzleFor({ kind: 'level', level: 160 }, 2);
    expect(old.size).toBe(journeyTargetV2(160).size);
  }, 60_000);

  it('no daily from the cut-over is larger than 8×8, and its label is measured', () => {
    let k = DAILY_V2_FROM;
    for (let i = 0; i < 366; i++, k = addDaysKey(k, 1)) expect(sizeFor({ kind: 'daily', dateKey: k })).toBeLessThanOrEqual(8);
    k = DAILY_V2_FROM;
    for (let i = 0; i < 7; i++, k = addDaysKey(k, 1)) {
      const p = puzzleFor({ kind: 'daily', dateKey: k });
      expect(p.size).toBe(dailyTargetV2(k).size);
      expect(displayDifficulty(p)).toBe(dailyTargetV2(k).tier);
    }
  }, 30_000);

  it('a daily from before the cut-over is the original board', () => {
    const k = addDaysKey(DAILY_V2_FROM, -2);
    const s = dailySpec(dateFromKey(k));
    expect(puzzleDigest(puzzleFor({ kind: 'daily', dateKey: k }))).toBe(puzzleDigest(generatePuzzle({ size: s.size, seed: s.seed, difficulty: s.difficulty })));
  });

  it('Paw Cup keeps its published lineup, 9×9 Grand Hall included', () => {
    expect(cupBoardSpec('2026-W44', 4)).toMatchObject({ size: 9, difficulty: 'expert', label: 'Grand Hall' });
  });
});

describe('saved boards across the spec change', () => {
  it('a level-75 board saved before specs existed resumes as its original 9×9', () => {
    const mode = { kind: 'level' as const, level: 75 };
    const legacy = puzzleFor(mode, 1);
    const s = new Session(legacy, { maxHearts: 5 });
    let placed: [number, number] | null = null;
    for (let r = 0; r < legacy.size && !placed; r++)
      for (let c = 0; c < legacy.size && !placed; c++)
        if (!s.givenMask[r][c] && legacy.solution[r][c] !== EMPTY) {
          s.place(r, c, legacy.solution[r][c] as Species);
          placed = [r, c];
        }
    const saved = captureSession(mode, s, new Date(), 1)!;
    delete saved.specVersion; // what an older build wrote
    const back = resumeSession(saved)!;
    expect(back).not.toBeNull();
    expect(back.spec).toBe(1);
    expect(back.session.size).toBe(9);
    expect(back.session.cells[placed![0]][placed![1]]).toBe(legacy.solution[placed![0]][placed![1]]);
  });

  it('a launch-pack board (spec 1) started before D31 at levels 6–60 resumes on that exact board', () => {
    for (const level of [6, 30, 60]) {
      const mode = { kind: 'level' as const, level };
      const old = puzzleFor(mode, 1);
      expect(puzzleDigest(old)).toBe(puzzleDigest(LEVEL_PACK_BY_LEVEL(level)));
      const saved = captureSession(mode, new Session(old, { maxHearts: 5 }), new Date(), 1)!;
      const back = resumeSession(JSON.parse(JSON.stringify(saved)))!;
      expect(back.spec, `level ${level}`).toBe(1);
      expect(puzzleDigest(back.session.puzzle), `level ${level}`).toBe(puzzleDigest(old));
      expect(puzzleDigest(puzzleFor(mode)), `level ${level}`).not.toBe(puzzleDigest(old));
    }
  });

  it('new saves record their spec and resume on it; a board saved under spec 2 resumes on spec 2', () => {
    const mode = { kind: 'level' as const, level: 75 };
    const s = new Session(puzzleFor(mode), { maxHearts: 5 });
    const saved = captureSession(mode, s)!;
    expect(saved.specVersion).toBe(3);
    expect(resumeSession(saved)!.session.size).toBe(puzzleFor(mode).size);
    const old = new Session(puzzleFor(mode, 2), { maxHearts: 5 });
    const saved2 = captureSession(mode, old, new Date(), 2)!;
    const back = resumeSession(JSON.parse(JSON.stringify(saved2)))!;
    expect(back.spec).toBe(2);
    expect(puzzleDigest(back.session.puzzle)).toBe(puzzleDigest(puzzleFor(mode, 2)));
  });

  it('times only compare on the same board: a level that moved to spec 2 starts a fresh best, keeps its clear and stars', () => {
    const save = defaultSave();
    save.journey.clears.L75 = { firstClearAt: 'x', bestSeconds: 30, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    save.journey.bestTimes.L75 = 30;
    const rec = recordWin(save, { kind: 'level', level: 75 }, { size: 7, seconds: 200, mistakes: 1, hintsUsed: 1, revives: 0, hearts: true, spec: 2 });
    expect(rec.firstClear).toBe(false);
    expect(rec.isBest).toBe(true);
    expect(rec.prevBest).toBeNull();
    expect(save.journey.bestTimes.L75).toBe(200);
    expect(save.journey.clears.L75).toMatchObject({ bestSeconds: 200, stars: 3, spec: 2 });
    // Same board again: normal comparison.
    const again = recordWin(save, { kind: 'level', level: 75 }, { size: 7, seconds: 250, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true, spec: 2 });
    expect(again.isBest).toBe(false);
    expect(again.prevBest).toBe(200);
  });
});

describe('species never leak through grading', () => {
  it('the profile depends only on the layout and givens, never the hidden solution', () => {
    const p = generatePuzzle({ size: 6, seed: 5 });
    const swapped = { ...p, solution: p.solution.map((row) => row.map((v) => (v === CAT ? DOG : v === DOG ? CAT : v))) };
    expect(profileOf(swapped)).toEqual(profileOf(p));
  });
});
