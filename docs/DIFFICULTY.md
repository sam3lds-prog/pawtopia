# Difficulty: how Pawtopia measures and labels boards

Labels players see ("7×7 · Expert") come from measuring the board, never from what a level or a day asked for.
Code: `src/game/grading.ts` (measurement, `GRADING_VERSION = 1`), `src/game/specs.ts` (which board a level or day gets).
Run `npm run grade:report` to reproduce the numbers below.

## What is measured

The grader replays the same human deduction engine the hints use (`src/engine/deduce.ts`, unchanged) one step at a
time and records:

| Metric | Meaning |
| --- | --- |
| `openingSingles` | placements forced by a single before any thinking (how many easy ways in) |
| `breakthroughs` | times the board went quiet (no single anywhere) and needed a pointing / neighbor-lock idea |
| `longestChain` | the longest run of eliminations before the next placement appears |
| `pointing`, `neighborLock` | elimination steps by technique (placements always come from singles) |
| `givens` | pets home at the start |

Score = (3 × breakthroughs + 2 × (longestChain − 1) + 2 × neighborLock + min(pointing, 12) / 2 +
2 × max(0, 3 − openingSingles) + 2 × max(0, round(n/3) − givens)) × (0.8 + 0.07 × (n − 5)).

The size factor reflects that the same chain is harder to spot on a bigger board.

## Labels

- **Easy**: singles only. Every placement is "the one spot left in a line", however big the board.
- **Medium**: needs at least one idea beyond singles, score < 18.
- **Hard**: score ≥ 18.
- **Expert**: score ≥ 34 *and* needs neighbor logic (the least obvious technique).

## Calibration (300 generated boards per size, fixed seeds)

| Size | Score p50 / p75 / p90 | Measured mix (easy / medium / hard / expert) |
| --- | --- | --- |
| 5×5 | 20.4 / 28.8 / 37.6 | 63 / 61 / 127 / 49 |
| 6×6 | 13.1 / 26.5 / 38.3 | 115 / 57 / 86 / 42 |
| 7×7 | 12.2 / 25.9 / 35.7 | 123 / 67 / 72 / 38 |
| 8×8 | 13.6 / 30.3 / 49.5 | 109 / 69 / 60 / 62 |
| 9×9 | 10.8 / 29.7 / 43.2 | 123 / 57 / 63 / 57 |

The engine's own coarse grade lumps very different boards together: of the 237 5×5 boards it calls "hard", the
measurement splits 61 Medium / 127 Hard / 49 Expert. It also called almost nothing "medium" at 6×6 (11 of 300), which
is why a level that asked for Medium could silently get something else under the old ladder.

## Where each label is used

- Board header chip, the Play path's next level, and Home's continue card show the measured label.
- Journey levels 6+ (spec 3, D31) and dailies from 2026-10-27 (spec 2) are *chosen* by it: `pickBoard` tries
  candidate seeds in a fixed order and takes the first board whose measured label matches the slot (80 tries; every
  slot through level 150 and a year of dailies matched). If nothing matched it would take the closest and label it
  truthfully.
- **Spec 3 ramp** (`journeyTargetV3`): levels 6–20 are mostly 7×7 (easy → hard) with a first 8×8 at 15 and two 6×6
  breathers; 21–40 mix 7×7 and 8×8 (8×8 more often) and end on the first 9×9; 41–70 are mostly 8×8 with a 9×9 every
  few levels; 71–100 make 9×9 the main size; 101+ lean harder. A smaller board still turns up now and then, so size
  and difficulty stay independent. Levels 6–150 are frozen in `src/data/journeyPack3.ts` (mix: 9×9 ×66, 8×8 ×45,
  7×7 ×27, 6×6 ×7). Levels 1–5 keep their launch boards. Dailies stay at most 8×8.
- Paw Cup keeps its published lineup and par times (owner decision, 2026-10-26); its in-game chip still shows the
  measured label.

## One-animal boards (spec 4, D35)

Journey levels 1–20, and the Daily and Zen until a player has had the two-animal lesson, use the one-animal rule. They
are measured the same way with that rule's own steps (`src/engine/solo.ts`): **single** (the only spot left in a line
or region), **pointing** (a region's spots all in one line clear the rest of it, and the reverse), **neighbor lock**
(a tile whose animal would leave some line or region with no spot), and **subset** (k regions that fit only in k rows
or columns own those lines).

Score = (3 × breakthroughs + 1.5 × (longestChain − 1) + 1.5 × min(neighborLock, 10) + 4 × subset +
min(pointing, 12) / 2 + 2 × max(0, 2 − openingSingles)) × (0.8 + 0.07 × (n − 5)). Labels: **Easy** singles only;
**Medium** needs more, score < 16 (or pointing only, < 16); **Hard** ≥ 16; **Expert** ≥ 40 *and* needs a subset.

Ladder (`V4_SOLO`, frozen in `src/data/journeyPack4.ts`, every slot matched): 5×5 easy, easy, medium; 6×6 easy,
medium, medium; 7×7 easy, medium; 6×6 hard; 7×7 medium, hard; 8×8 easy, medium; 7×7 hard; 8×8 medium, hard; 9×9
medium; 8×8 hard; 9×9 medium, hard. Level 1 has a one-tile region so the guided first move is obvious. Level 21 is
the two-animal lesson and level L ≥ 21 plays two-animal level L − 20's board. The one-animal Daily follows the week
(Mon 6×6 easy … Sat 8×8 hard, never above 8×8).

## Changing the formula

Changing a weight or threshold changes labels and which boards future slots pick. Bump `GRADING_VERSION`, re-run
`npm run grade:report`, and note it in `DECISIONS.md`. Shipped Journey levels are frozen in `src/data/journeyPack2.ts`
and `src/data/journeyPack3.ts`, and `npm run pack:check` fails if regenerating them would give a different board, so a formula change can never
silently swap a level a player has seen. Levels beyond 150 and future dailies would change; that needs a spec bump.

Calibration data collected from real players (solve time, mistakes and hint use by size) would sharpen these weights,
but only with a reviewed privacy plan; nothing is collected today.
