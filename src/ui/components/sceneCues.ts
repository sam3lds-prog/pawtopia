/**
 * One-time cues in a sanctuary (D36): the animals can be tapped (they greet, and offer tricks) and the special
 * decorations can be used (the animals ride and play on them). Each shows once, under the scene, until the player does
 * the thing or closes it; never during a puzzle.
 */

import { app } from '../../app/app';
import { ICON } from '../icons';

export type SceneCue = 'tap' | 'decor';

/** The one cue to show now, if any: tapping an animal first, then using a decoration. */
export function sceneCue(hasAnimals: boolean, hasActivities: boolean): SceneCue | null {
  const ob = app.save.onboarding;
  if (hasAnimals && !ob.sceneTapTipSeen) return 'tap';
  if (hasActivities && !ob.decorTipSeen) return 'decor';
  return null;
}

export function sceneCueMarkup(cue: SceneCue | null): string {
  if (!cue) return '';
  const text = cue === 'tap' ? 'Try tapping an animal: they say hello, and some know tricks.' : 'Tap a decoration with a sparkle: the animals love to use them.';
  return `<p class="scene-cue" data-scene-cue="${cue}" role="note">${ICON.paw}<span>${text}</span><button class="icon-btn icon-btn--bare" data-act="cue-ok" aria-label="Got it">${ICON.close}</button></p>`;
}

/** Marks a cue as done (the player did it or closed it) and removes it from the screen. */
export function dismissSceneCue(el: HTMLElement, cue: SceneCue): void {
  const ob = app.save.onboarding;
  if (cue === 'tap') ob.sceneTapTipSeen = true;
  else ob.decorTipSeen = true;
  app.persist();
  el.querySelector(`[data-scene-cue="${cue}"]`)?.remove();
}
