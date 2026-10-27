/**
 * Achievements: deterministic badges for things a player did, each with a small fixed coin gift through the ledger.
 * Never random, never purchasable. League finisher badges arrive with online leagues (they need verified results).
 */

import type { SaveV2 } from '../services/storage';
import { DECOR } from './catalogs/decor';
import { PETS } from './catalogs/pets';
import { grant } from './ledger';
import { liveStreak } from './progression';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: 'paw' | 'check' | 'hint' | 'calendar' | 'home' | 'heart' | 'flame' | 'restart' | 'leaf' | 'star' | 'trophy' | 'sparkle';
  coins: number;
  /** Progress toward the goal: [current, target]. */
  progress(save: SaveV2): [number, number];
}

const count = (o: Record<string, unknown>) => Object.keys(o).length;
const solvedSize = (s: SaveV2, min: number) => Object.entries(s.stats.bestBySize).some(([k]) => Number(k) >= min);

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_friend', name: 'First Friend', description: 'Solve your first board.', icon: 'paw', coins: 20, progress: (s) => [Math.min(1, s.stats.solved), 1] },
  { id: 'perfect_pair', name: 'Perfect Pair', description: 'Solve a board without a single mistake.', icon: 'check', coins: 20, progress: (s) => [Math.min(1, s.stats.clean), 1] },
  { id: 'quiet_thinker', name: 'Quiet Thinker', description: 'Solve 10 boards without using a hint.', icon: 'hint', coins: 30, progress: (s) => [Math.min(10, s.stats.hintFree), 10] },
  { id: 'seven_days', name: 'Seven-Day Explorer', description: 'Play on seven different days.', icon: 'calendar', coins: 30, progress: (s) => [Math.min(7, count(s.stats.playDays)), 7] },
  { id: 'home_decorator', name: 'Home Decorator', description: 'Own five sanctuary decorations.', icon: 'home', coins: 30, progress: (s) => [Math.min(5, count(s.inventory.decor)), 5] },
  { id: 'whole_family', name: 'The Whole Family', description: `Welcome all ${PETS.length} residents.`, icon: 'heart', coins: 50, progress: (s) => [Math.min(PETS.length, count(s.inventory.pets)), PETS.length] },
  { id: 'daily_devotee', name: 'Daily Devotee', description: 'Reach a 7-day Daily streak.', icon: 'flame', coins: 50, progress: (s) => [Math.min(7, Math.max(s.daily.bestStreak, liveStreak(s))), 7] },
  { id: 'comeback_kid', name: 'Comeback Kid', description: 'Finish a board after two mistakes, or after refilling your hearts.', icon: 'restart', coins: 20, progress: (s) => [Math.min(1, s.stats.comebacks), 1] },
  { id: 'master_regions', name: 'Master of Regions', description: 'Finish the first chapter, Meadow Gate.', icon: 'star', coins: 40, progress: (s) => [Math.min(20, s.journey.nextLevel - 1), 20] },
  { id: 'zen_gardener', name: 'Zen Gardener', description: 'Solve five Zen boards.', icon: 'leaf', coins: 20, progress: (s) => [Math.min(5, s.zen.solved), 5] },
  { id: 'grand_thinker', name: 'Grand Thinker', description: 'Solve a 9×9 board (Paw Cup\'s Grand Hall).', icon: 'sparkle', coins: 40, progress: (s) => [solvedSize(s, 9) ? 1 : 0, 1] },
  { id: 'full_garden', name: 'In Full Bloom', description: `Own all ${DECOR.length} decorations.`, icon: 'trophy', coins: 100, progress: (s) => [Math.min(DECOR.length, count(s.inventory.decor)), DECOR.length] },
];

export function isUnlocked(save: SaveV2, id: string): boolean {
  return !!save.achievements[id];
}

/** Unlocks every achievement whose goal is met. Idempotent; returns the newly unlocked ones. */
export function checkAchievements(save: SaveV2, now = new Date()): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    const [cur, target] = a.progress(save);
    if (cur >= target) {
      save.achievements[a.id] = now.toISOString();
      grant(save, `ach:${a.id}`, a.coins, 'achievement', now, a.name);
      out.push(a);
    }
  }
  return out;
}
