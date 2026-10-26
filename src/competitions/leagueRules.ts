/**
 * Paw Cup league structure (spec §8.3, §8.7). Pure rules a server would run at the UTC weekly close.
 * Tiers: Seedling → Bronze Paw → Silver Garden → Gold Grove → Diamond Den. Cohorts of ~20 REAL players.
 * Top 5 promote; bottom 3 relegate only if the cohort had at least 15 qualified active players; nobody is
 * demoted for not playing; new players are provisional for two weeks. No paid tiers, no score multipliers.
 */

import { compareStandings, totals, type Standing } from './scoring';

export type LeagueTier = 'seedling' | 'bronze' | 'silver' | 'gold' | 'diamond';
export const TIERS: readonly LeagueTier[] = ['seedling', 'bronze', 'silver', 'gold', 'diamond'];

export const TIER_INFO: Record<LeagueTier, { name: string; color: string }> = {
  seedling: { name: 'Seedling', color: '#8DBF8B' },
  bronze: { name: 'Bronze Paw', color: '#C98A5A' },
  silver: { name: 'Silver Garden', color: '#9AA7B4' },
  gold: { name: 'Gold Grove', color: '#D5A04B' },
  diamond: { name: 'Diamond Den', color: '#7FB7C9' },
};

export const LEAGUE_RULES = {
  cohortTarget: 20,
  promote: 5,
  relegate: 3,
  /** Relegation applies only when at least this many qualified players took part. */
  minForRelegation: 15,
  /** Boards a player must finish to count as "qualified active" this week. */
  qualifyBoards: 1,
  provisionalWeeks: 2,
  boards: 5,
  attemptsPerBoard: 2,
} as const;

/** Weekly participation rewards (coins and cosmetics only). */
export const LEAGUE_REWARDS = [
  { place: [1, 1], coins: 100, cosmetic: 'Trophy frame' },
  { place: [2, 3], coins: 80, cosmetic: 'Medal' },
  { place: [4, 5], coins: 60, cosmetic: 'Promotion ribbon' },
] as const;
export const PARTICIPATION_REWARD = { boards: 3, coins: 40, cosmetic: 'Badge fragment' } as const;

export interface CohortMember {
  standing: Standing;
  tier: LeagueTier;
  provisional: boolean;
}

export type Movement = 'promote' | 'stay' | 'relegate';

export interface SettledMember {
  playerId: string;
  rank: number;
  total: number;
  movement: Movement;
  nextTier: LeagueTier;
  coins: number;
  cosmetics: string[];
}

function step(t: LeagueTier, d: 1 | -1): LeagueTier {
  const i = TIERS.indexOf(t) + d;
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, i))];
}

/** Settles one weekly cohort. Deterministic given the standings. */
export function settleCohort(members: CohortMember[]): SettledMember[] {
  const qualified = members.filter((m) => totals(m.standing).boardsPlayed >= LEAGUE_RULES.qualifyBoards);
  const sorted = [...qualified].sort((a, b) => compareStandings(a.standing, b.standing));
  const relegationOn = qualified.length >= LEAGUE_RULES.minForRelegation;
  const out: SettledMember[] = [];
  sorted.forEach((m, i) => {
    const rank = i + 1;
    const t = totals(m.standing);
    let movement: Movement = 'stay';
    if (rank <= LEAGUE_RULES.promote && m.tier !== 'diamond') movement = 'promote';
    else if (relegationOn && rank > sorted.length - LEAGUE_RULES.relegate && !m.provisional && m.tier !== 'seedling') movement = 'relegate';
    const reward = LEAGUE_REWARDS.find((r) => rank >= r.place[0] && rank <= r.place[1]);
    const cosmetics: string[] = reward ? [reward.cosmetic] : [];
    let coins = reward?.coins ?? 0;
    if (t.boardsPlayed >= PARTICIPATION_REWARD.boards) {
      coins += PARTICIPATION_REWARD.coins;
      cosmetics.push(PARTICIPATION_REWARD.cosmetic);
    }
    out.push({
      playerId: m.standing.playerId,
      rank,
      total: t.total,
      movement,
      nextTier: movement === 'promote' ? step(m.tier, 1) : movement === 'relegate' ? step(m.tier, -1) : m.tier,
      coins,
      cosmetics,
    });
  });
  // Non-participants keep their tier: no penalty for skipping a week.
  for (const m of members)
    if (!qualified.includes(m)) out.push({ playerId: m.standing.playerId, rank: 0, total: 0, movement: 'stay', nextTier: m.tier, coins: 0, cosmetics: [] });
  return out;
}

/** "N points to reach #k" — only meaningful against real standings; returns null if already first. */
export function pointsToNext(standings: Standing[], playerId: string): { rank: number; gap: number } | null {
  const sorted = [...standings].sort(compareStandings);
  const i = sorted.findIndex((s) => s.playerId === playerId);
  if (i <= 0) return null;
  return { rank: i, gap: totals(sorted[i - 1]).total - totals(sorted[i]).total + 1 };
}
