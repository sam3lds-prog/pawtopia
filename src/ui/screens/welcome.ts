/** First run: a calm splash, the two-sentence story, then straight into a guided first board. */

import { app } from '../../app/app';
import { startGame } from '../../app/gameFlow';
import { track } from '../../services/analytics';
import { petSvg } from '../art/pets';
import { sceneBackdrop } from '../art/scene';
import { actionOf, h } from '../dom';
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
    const el = h(`
      <div class="welcome">
        <div class="welcome__art" aria-hidden="true">
          <svg class="welcome__scene" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice">${sceneBackdrop({ id: 'welcome' })}</svg>
          <div class="welcome__pair">
            <span class="welcome__tile" style="--rc:var(--r1)">${petSvg('mochi')}</span>
            <span class="welcome__tile" style="--rc:var(--r2)">${petSvg('biscuit')}</span>
          </div>
        </div>
        <div class="welcome__copy">
          <h1 class="wordmark wordmark--lg" data-autofocus>Pawtopia</h1>
          <p class="welcome__story">Our animal neighbors need a little room to get along. Solve their puzzles and give them a happy home.</p>
        </div>
        <div class="welcome__actions">
          <button class="btn btn--block btn--lg" data-act="start">Meet the neighbors</button>
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
        app.router.go({ screen: 'home' });
      }
    });
  },
};
