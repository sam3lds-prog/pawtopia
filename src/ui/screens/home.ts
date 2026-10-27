/** Home: the sanctuary at the top, one primary action (continue), then the daily and two smaller cards. */

import { app } from '../../app/app';
import { playMode, resumableMode, resumeGame, startGame } from '../../app/gameFlow';
import { localDateKey } from '../../game/dates';
import { modeTitle, puzzleFor, sizeFor } from '../../game/puzzles';
import { displayDifficulty } from '../../game/grading';
import { chapterOf } from '../../meta/chapters';
import { liveStreak } from '../../meta/progression';
import { sceneMarkup } from './sanctuary';
import { openSheet } from '../components/sheet';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { claimMission, missionStates } from '../../meta/missions';
import { nextPetMilestone } from '../../meta/rewards';
import { addDaysKey, localWeekStart } from '../../game/dates';
import { sfx } from '../../services/audio';
import { track } from '../../services/analytics';
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

/** Monday–Sunday strip of this week's dailies. Missing a day never removes anything you've earned. */
function weekStrip(): string {
  const today = localDateKey();
  const start = localWeekStart(today);
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cozy = Object.values(app.save.daily.cozyDays);
  const days = names.map((n, i) => {
    const k = addDaysKey(start, i);
    const done = !!app.save.daily.done[k];
    const saved = cozy.includes(k);
    const cls = done ? 'is-done' : saved ? 'is-cozy' : k === today ? 'is-today' : k > today ? 'is-future' : '';
    const label = `${new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}: ${done ? 'daily solved' : saved ? 'kept by a Cozy Day' : k > today ? 'upcoming' : k === today ? 'today' : 'missed'}`;
    return `<li class="${cls}" aria-label="${label}"><span aria-hidden="true">${n}</span></li>`;
  });
  return `<ol class="week-strip" aria-label="This week's daily puzzles">${days.join('')}</ol>`;
}

export const homeScreen: ScreenDef = {
  tab: 'home',
  title: 'Pawtopia',
  mount(root, scope) {
    const save = app.save;
    const level = save.journey.nextLevel;
    const chapter = chapterOf(level);
    const resumeMode = resumableMode();
    const todayKey = localDateKey();
    const daily = { dateKey: todayKey, size: sizeFor({ kind: 'daily', dateKey: todayKey }) };
    const dailyDone = !!save.daily.done[daily.dateKey];
    const streak = liveStreak(save, localDateKey());
    const weekday = WEEKDAY[new Date().getDay()];
    const nextPet = nextPetMilestone(save);

    const continueTitle = resumeMode ? `Resume ${modeTitle(resumeMode).toLowerCase().replace(/^level/, 'level')}` : `Play level ${level}`;
    const thumbMode = resumeMode ?? { kind: 'level' as const, level };
    // A resumable board keeps the spec it was issued under (an old 9×9 save still shows as 9×9).
    const thumbSpec = resumeMode ? (save.lastSession?.specVersion ?? 1) : undefined;
    const thumbSize = sizeFor(thumbMode, thumbSpec);

    const el = h(`
      <div class="home">
        <header class="home-head">
          <h1 class="wordmark" data-autofocus>Pawtopia</h1>
          <div class="screen-head__end">
            ${coinPill()}
            <button class="icon-btn" data-act="journal" aria-label="Journal: stats and badges">${ICON.star}</button>
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
            <p class="muted" data-board-desc>${thumbSize}×${thumbSize} board${resumeMode ? ', saved where you left it' : ''}</p>
            ${nextPet && !resumeMode ? `<p class="continue__next">${ICON.paw}${nextPet.level === level ? 'A new resident arrives when you solve this one' : `Next resident at level ${nextPet.level}`}</p>` : ''}
          </div>
          <div class="continue__thumb" data-thumb style="--n:${thumbSize}"></div>
          <button class="btn btn--block continue__go" data-act="continue">${esc(continueTitle)}</button>
          ${resumeMode && resumeMode.kind !== 'level' ? `<button class="btn btn--quiet" data-act="journey">Play level ${level} instead</button>` : ''}
        </section>

        <div class="daily-block">
        <button class="card card--tap daily-card ${dailyDone ? 'is-done' : ''}" data-act="daily">
          <span class="card__icon card__icon--coral">${dailyDone ? ICON.check : ICON.calendar}</span>
          <span class="card__body">
            <span class="card__title">Daily Cozy Puzzle</span>
            <span class="card__sub">${dailyDone ? `Done for today. Back tomorrow for a new board.` : `${weekday}'s ${daily.size}×${daily.size}, the same board for everyone`}</span>
          </span>
          ${streak > 0 ? `<span class="daily-card__streak" aria-label="${plural(streak, 'day')} streak">${ICON.flame}<b class="num">${streak}</b></span>` : ''}
        </button>
          ${weekStrip()}
        </div>

        <section class="missions card" aria-labelledby="missions-title" data-missions></section>

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
        const p = puzzleFor(thumbMode, thumbSpec);
        const slot = el.querySelector('[data-thumb]');
        if (slot) slot.innerHTML = miniBoard(p.regions);
        const desc = el.querySelector('[data-board-desc]');
        const tier = displayDifficulty(p);
        if (desc) desc.textContent = `${thumbSize}×${thumbSize} · ${tier.charAt(0).toUpperCase()}${tier.slice(1)}${resumeMode ? ', saved where you left it' : ''}`;
      } catch {
        /* thumbnail is decorative */
      }
    }, 30);

    const missionsEl = el.querySelector('[data-missions]') as HTMLElement;
    function renderMissions(): void {
      const ms = missionStates(app.save);
      const left = ms.filter((m) => !m.weekly && !m.claimed).length;
      missionsEl.innerHTML = `
        <div class="missions__head"><h2 id="missions-title">Today's errands</h2><span class="muted">${left ? `${left} to go` : 'All done for today'}</span></div>
        <ul class="missions__list">
          ${ms
            .map(
              (m) => `<li class="mission ${m.claimed ? 'is-claimed' : m.done ? 'is-done' : ''}">
                <span class="mission__check" aria-hidden="true">${m.claimed || m.done ? ICON.check : ''}</span>
                <span class="mission__body"><span class="mission__title">${esc(m.def.title)}${m.weekly ? ' <span class="chip">This week</span>' : ''}</span>
                ${m.def.target > 1 && !m.done ? `<span class="muted num">${m.progress} of ${m.def.target}</span>` : ''}</span>
                ${
                  m.claimed
                    ? `<span class="mission__reward is-claimed">${ICON.coin}<span class="num">${m.def.coins}</span></span>`
                    : m.done
                      ? `<button class="btn btn--small" data-claim="${esc(m.key)}">Claim ${ICON.coin}<span class="num">${m.def.coins}</span></button>`
                      : `<span class="mission__reward">${ICON.coin}<span class="num">${m.def.coins}</span></span>`
                }
              </li>`,
            )
            .join('')}
        </ul>`;
    }
    renderMissions();

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
      const claim = (e.target as HTMLElement).closest('[data-claim]') as HTMLElement | null;
      if (claim) {
        const coins = claimMission(app.save, claim.dataset.claim!);
        if (coins) {
          app.persist();
          sfx('coin');
          track('mission_claimed', { coins });
          renderMissions();
          const pill = el.querySelector('[data-coins]');
          if (pill) pill.outerHTML = coinPill();
          toast(`+${coins} Paw Coins`);
        }
        return;
      }
      const a = actionOf(e);
      if (!a) return;
      switch (a.act) {
        case 'continue':
          if (resumeMode) {
            if (!resumeGame()) {
              toast("That saved board couldn't be restored, so it starts fresh.");
              startGame(resumeMode);
            }
          } else playMode({ kind: 'level', level });
          break;
        case 'journey':
          playMode({ kind: 'level', level });
          break;
        case 'daily':
          if (dailyDone) toast(`Today's board is done. A new one arrives tomorrow.`);
          else playMode({ kind: 'daily', dateKey: daily.dateKey });
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
        case 'journal':
          app.router.go({ screen: 'profile' });
          break;
      }
    });
  },
};
