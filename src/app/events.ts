/**
 * Meta-progression hooks. Screens call these after the things that matter (a solved board, a sanctuary visit, a
 * purchase); they advance missions and unlock achievements, and report what changed so the UI can say so.
 */

import { app } from './app';
import type { ModeRef } from '../game/modes';
import { checkAchievements, type AchievementDef } from '../meta/achievements';
import { recordMissionEvent, type MissionDef } from '../meta/missions';
import { track } from '../services/analytics';

export interface MetaNews {
  achievements: AchievementDef[];
  missions: MissionDef[];
}

function finish(missions: MissionDef[]): MetaNews {
  const achievements = checkAchievements(app.save);
  for (const a of achievements) track('achievement_unlocked', { id: a.id });
  return { achievements, missions };
}

export function afterSolve(mode: ModeRef, size: number, mistakes: number, hints: number): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'solved', mode: mode.kind, size, mistakes, hints }));
}

export function afterSanctuaryVisit(): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'sanctuary' }));
}

export function afterDecorChange(): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'decor' }));
}

/** Catch up on achievements earned before they existed (e.g. v1 players). */
export function catchUpAchievements(): AchievementDef[] {
  return checkAchievements(app.save);
}
