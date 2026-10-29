/**
 * Reward videos, always the player's choice: an extra life, a hint, or a video token. One gentle daily cap is shared by
 * all of them. A reward is granted only when the ad service confirms the video was watched, and it is granted even if
 * the player left the screen meanwhile (they watched it).
 */

import { app } from './app';
import { ads } from '../services/ads';
import { track } from '../services/analytics';
import { grantItem } from '../meta/items';
import { localDateKey } from '../game/dates';
import type { SaveV2 } from '../services/storage';

export const REWARDED_DAILY_CAP = 10;

export type VideoReward = 'life' | 'hint' | 'vtoken';

export function videosLeftToday(save: Pick<SaveV2, 'ads'>, now = new Date()): number {
  const day = localDateKey(now);
  return save.ads.day === day ? Math.max(0, REWARDED_DAILY_CAP - save.ads.rewarded) : REWARDED_DAILY_CAP;
}

/** Whether a "watch a video" button should be offered at all. */
export function canOfferVideo(): boolean {
  return ads.available && videosLeftToday(app.save) > 0;
}

/** Counts a watched video toward today's cap and grants the reward once. Pure apart from mutating the save. */
export function recordVideoReward(save: SaveV2, reward: VideoReward, now = new Date()): boolean {
  const day = localDateKey(now);
  if (save.ads.day !== day) save.ads = { day, rewarded: 0 };
  if (save.ads.rewarded >= REWARDED_DAILY_CAP) return false;
  save.ads.rewarded++;
  const g = grantItem(save, `ad:${reward}:${now.getTime().toString(36)}:${save.ads.rewarded}`, reward, 1, 'ad', now, 'Reward video');
  return !!g;
}

export type WatchResult = 'granted' | 'no-video' | 'cap' | 'unavailable';

export async function watchVideoFor(reward: VideoReward): Promise<WatchResult> {
  if (!ads.available) return 'unavailable';
  if (videosLeftToday(app.save) <= 0) return 'cap';
  const placement = reward === 'vtoken' ? 'token' : reward;
  track('rewarded_ad_offer', { placement });
  const ok = await ads.showRewarded(placement);
  if (!ok) return 'no-video';
  if (!recordVideoReward(app.save, reward)) return 'cap';
  track('rewarded_ad_complete', { placement });
  app.persist();
  return 'granted';
}
