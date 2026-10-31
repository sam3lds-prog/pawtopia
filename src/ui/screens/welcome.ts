/**
 * First run: a calm splash of the Farm with the sheep who is on the first board, a two-sentence story, then straight
 * into the guided first board. The art is what the player is about to play (D36): not cats and dogs, who come later.
 */

import { app } from '../../app/app';
import { startGame } from '../../app/gameFlow';
import { castFor } from '../../meta/cast';
import { animalInfo } from '../../meta/animals';
import { track } from '../../services/analytics';
import { animalSvg } from '../art/animals';
import { regionThumb } from '../art/regions';
import { actionOf, esc, h } from '../dom';
import type { ScreenDef } from '../router';

/** Fresh installs that haven't started the tutorial see the welcome screen instead of Home. */
export function needsWelcome(): boolean {
  const s = app.save;
  return !s.onboarding.tutorialDone && !s.onboarding.seenRules && s.journey.nextLevel === 1 && s.migratedFrom === null;
}

export const welcomeScreen: ScreenDef = {
  tab: null,
  title: 'Pawtopia',
  mount(root, scope) {
    track('onboarding_step', { step: 'welcome' });
    // The animal on the very first board (the Farm's sheep for a fresh save), so the splash shows what comes next.
    const first = castFor(app.save, 'solo', 1);
    const a = animalInfo(first.a);
    const el = h(`
      <div class="welcome">
        <div class="welcome__art" aria-hidden="true">
          <svg class="welcome__scene" viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice">${regionThumb('farm', 1, 'welcome')}</svg>
          <div class="welcome__pair welcome__pair--one">
            <span class="welcome__tile" style="--rc:var(--r1)">${animalSvg(first.a, { mood: 'happy' })}</span>
          </div>
        </div>
        <div class="welcome__copy">
          <h1 class="wordmark wordmark--lg" data-autofocus>Pawtopia</h1>
          <p class="welcome__story">Meadow Farm is waiting for its first friend. Solve a little logic puzzle and ${esc(a.name)} the ${esc(a.noun)} moves in. More animals follow, home by home.</p>
        </div>
        <div class="welcome__actions">
          <button class="btn btn--block btn--lg" data-act="start">Meet ${esc(a.name)}</button>
          <button class="btn btn--quiet" data-act="skip">I know how to play</button>
        </div>
      </div>`);
    root.appendChild(el);
    scope.on(el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'start') {
        track('onboarding_step', { step: 'tutorial_start' });
        startGame({ kind: 'level', level: 1 });
      } else if (a.act === 'skip') {
        track('onboarding_step', { step: 'skipped' });
        app.save.onboarding.seenRules = true;
        app.persist();
        app.router.reset({ screen: 'journey' });
      }
    });
  },
};
