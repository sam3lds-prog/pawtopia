/** Home: the sanctuary at the top, one primary action (continue), then the daily and two smaller cards. */

import { app } from '../../app/app';
import { resumableMode, resumeGame, startGame } from '../../app/gameFlow';
import { dailySpec } from '../../engine/levels';
import { localDateKey } from '../../game/dates';
import { modeTitle, puzzleFor, sizeFor } from '../../game/puzzles';
import { chapterOf } from '../../meta/chapters';
import { liveStreak } from '../../meta/progression';
import { sceneMarkup } from './sanctuary';
import { openSheet } from '../components/sheet';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { miniBoard } from '../components/board';
import { toast } from '../components/sheet';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { showSettings } from './settings';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function coinPill(): string {
  return `<span class="coin-pill" data-coins aria-label="${app.coins()} Paw Coins">${ICON.coin}<span>${app.coins()}</span></span>`;
}

export const homeScreen: ScreenDef = {
  tab: 'home',
  title: 'Pawtopia',
  mount(root, scope) {
    const save = app.save;
    const level = save.journey.nextLevel;
    const chapter = chapterOf(level);
    const resumeMode = resumableMode();
    const daily = dailySpec();
    const dailyDone = !!save.daily.done[daily.dateKey];
    const streak = liveStreak(save, localDateKey());
    const weekday = WEEKDAY[new Date().getDay()];

    const continueTitle = resumeMode ? `Resume ${modeTitle(resumeMode).toLowerCase().replace(/^level/, 'level')}` : `Play level ${level}`;
    const thumbMode = resumeMode ?? { kind: 'level' as const, level };
    const thumbSize = sizeFor(thumbMode);

    const el = h(`
      <div class="home">
        <header class="home-head">
          <h1 class="wordmark" data-autofocus>Pawtopia</h1>
          <div class="screen-head__end">
            ${coinPill()}
            <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
          </div>
        </header>

        <button class="scene-card" data-act="sanctuary" aria-label="Visit the Harmony Sanctuary">
          <svg class="scene-card__art" viewBox="0 52 360 216" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sceneMarkup('home')}</svg>
          <span class="scene-card__label">Harmony Sanctuary</span>
        </button>

        <section class="continue card" aria-labelledby="continue-title">
          <div class="continue__info">
            <p class="continue__eyebrow">${resumeMode ? 'Board in progress' : esc(`Chapter ${chapter.index + 1}: ${chapter.name}`)}</p>
            <h2 id="continue-title">${esc(resumeMode ? modeTitle(resumeMode) : `Level ${level}`)}</h2>
            <p class="muted">${thumbSize}×${thumbSize} board${resumeMode ? ', saved where you left it' : ''}</p>
          </div>
          <div class="continue__thumb" data-thumb style="--n:${thumbSize}"></div>
          <button class="btn btn--block continue__go" data-act="continue">${esc(continueTitle)}</button>
          ${resumeMode && resumeMode.kind !== 'level' ? `<button class="btn btn--quiet" data-act="journey">Play level ${level} instead</button>` : ''}
        </section>

        <button class="card card--tap daily-card ${dailyDone ? 'is-done' : ''}" data-act="daily">
          <span class="card__icon card__icon--coral">${dailyDone ? ICON.check : ICON.calendar}</span>
          <span class="card__body">
            <span class="card__title">Daily Cozy Puzzle</span>
            <span class="card__sub">${dailyDone ? `Done for today. Back tomorrow for a new board.` : `${weekday}'s ${daily.size}×${daily.size}, the same board for everyone`}</span>
          </span>
          ${streak > 0 ? `<span class="daily-card__streak" aria-label="${plural(streak, 'day')} streak">${ICON.flame}<b class="num">${streak}</b></span>` : ''}
        </button>

        <div class="duo">
          <button class="card card--tap mini-card" data-act="zen">
            <span class="card__icon">${ICON.leaf}</span>
            <span class="card__title">Zen Garden</span>
            <span class="card__sub">No clock, no hearts</span>
          </button>
          <button class="card card--tap mini-card" data-act="league">
            <span class="card__icon card__icon--gold">${ICON.trophy}</span>
            <span class="card__title">Paw Cup</span>
            <span class="card__sub">Five boards this week</span>
          </button>
        </div>
      </div>`);
    root.appendChild(el);

    // The thumbnail needs the board's regions; build it after first paint so the screen appears instantly.
    scope.timeout(() => {
      try {
        const p = puzzleFor(thumbMode);
        const slot = el.querySelector('[data-thumb]');
        if (slot) slot.innerHTML = miniBoard(p.regions);
      } catch {
        /* thumbnail is decorative */
      }
    }, 30);

    // Players coming from v1: say what their earlier progress turned into, once.
    const gift = app.upgradeGift;
    if (gift) {
      app.upgradeGift = null;
      const gs = openSheet(scope, {
        title: 'Welcome to Pawtopia',
        center: true,
        body: `<p class="sheet__lead">Cats vs Dogs has grown into Pawtopia. Every level you solved is still solved, and it earned you a head start:</p>
          <div class="win-rewards">
            ${gift.coins ? `<div class="reward-coins"><span class="reward-coins__amt">${ICON.coin}<b class="num">+${gift.coins}</b></span><span class="muted">Paw Coins for ${plural(Object.keys(app.save.journey.clears).length, 'solved level')}</span></div>` : ''}
            ${gift.pets.length ? `<p><b>${gift.pets.length} residents</b> moved into your sanctuary.</p>` : ''}
            ${gift.decor.length ? `<p>Chapter gifts: ${esc(gift.decor.map((d) => DECOR_BY_ID[d].name).join(', '))}.</p>` : ''}
          </div>
          <div class="sheet__actions"><button class="btn btn--block" data-act="see">See the sanctuary</button><button class="btn btn--quiet" data-act="later">Later</button></div>`,
      });
      gs.scope.on(gs.el, 'click', (e) => {
        const a = actionOf(e);
        if (!a) return;
        gs.close();
        if (a.act === 'see') app.router.go({ screen: 'sanctuary', welcome: gift.pets });
      });
    }

    scope.on(el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      switch (a.act) {
        case 'continue':
          if (resumeMode) {
            if (!resumeGame()) {
              toast("That saved board couldn't be restored, so it starts fresh.");
              startGame(resumeMode);
            }
          } else startGame({ kind: 'level', level });
          break;
        case 'journey':
          startGame({ kind: 'level', level });
          break;
        case 'daily':
          if (dailyDone) toast(`Today's board is done. A new one arrives tomorrow.`);
          else startGame({ kind: 'daily', dateKey: daily.dateKey });
          break;
        case 'zen':
          app.router.go({ screen: 'play' });
          break;
        case 'league':
          app.router.go({ screen: 'league' });
          break;
        case 'sanctuary':
          app.router.go({ screen: 'sanctuary' });
          break;
        case 'settings':
          showSettings(scope, { onClose: () => app.router.refresh() });
          break;
      }
    });
  },
};
