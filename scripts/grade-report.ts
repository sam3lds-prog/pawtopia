/**
 * Difficulty calibration report.
 *
 *   npm run grade:report            # 300 boards per size
 *   npm run grade:report -- 1000    # more boards
 *
 * For every size it generates boards from fixed seeds (so the report is reproducible), measures each with the
 * grading module, and prints the score distribution, how the measured labels compare with the engine's coarse grade,
 * and the label mix. Thresholds in src/game/grading.ts were chosen from this output (docs/DIFFICULTY.md).
 */

import { generatePuzzle } from '../src/engine/generator';
import { hashString } from '../src/engine/rng';
import type { Difficulty } from '../src/engine/types';
import { profileBoard, type DifficultyProfile } from '../src/game/grading';
import { decodePack } from '../src/data/packFormat';
import { LEVEL_PACK } from '../src/data/levelPack';

const N = Number(process.argv[2] ?? 300);
const TIERS: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

function pct(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

for (const size of [5, 6, 7, 8, 9]) {
  const profs: Array<DifficultyProfile & { engine: Difficulty }> = [];
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const p = generatePuzzle({ size, seed: hashString(`cal-${size}-${i}`) });
    profs.push({ ...profileBoard(p.size, p.regions, p.givens), engine: p.difficulty });
  }
  const ms = Date.now() - t0;
  const scores = profs.map((p) => p.score);
  const mix = Object.fromEntries(TIERS.map((t) => [t, profs.filter((p) => p.tier === t).length]));
  console.log(`\n${size}×${size}  (${N} boards, ${(ms / N).toFixed(1)} ms each incl. generation)`);
  console.log(`  score p10/p25/p50/p75/p90/max: ${[0.1, 0.25, 0.5, 0.75, 0.9].map((q) => pct(scores, q)).join(' / ')} / ${Math.max(...scores)}`);
  console.log(`  breakthroughs p50/p90: ${pct(profs.map((p) => p.breakthroughs), 0.5)} / ${pct(profs.map((p) => p.breakthroughs), 0.9)}   longest chain p50/p90: ${pct(profs.map((p) => p.longestChain), 0.5)} / ${pct(profs.map((p) => p.longestChain), 0.9)}`);
  console.log(`  measured label mix: ${JSON.stringify(mix)}`);
  for (const e of TIERS) {
    const g = profs.filter((p) => p.engine === e);
    if (!g.length) continue;
    const m = Object.fromEntries(TIERS.map((t) => [t, g.filter((p) => p.tier === t).length]).filter(([, v]) => v));
    console.log(`  engine "${e}" (${g.length}) → measured ${JSON.stringify(m)}  score p50 ${pct(g.map((p) => p.score), 0.5)}`);
  }
  if (profs.some((p) => !p.solved)) console.log('  !! some boards not solvable by logic');
}

console.log('\nLaunch pack (levels 1–60): level size engine → measured (score)');
const rows = decodePack(LEVEL_PACK).map(({ level, puzzle }) => {
  const pr = profileBoard(puzzle.size, puzzle.regions, puzzle.givens);
  return `${String(level).padStart(2)} ${puzzle.size}×${puzzle.size} ${puzzle.difficulty.padEnd(6)} → ${pr.tier.padEnd(6)} (${pr.score})`;
});
for (let i = 0; i < rows.length; i += 3) console.log('  ' + rows.slice(i, i + 3).join('   '));
