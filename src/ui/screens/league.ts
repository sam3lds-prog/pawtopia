/**
 * League (Paw Cup). With `featureFlags.onlineLeagues` off — the only state that exists until the verified backend is
 * built — this screen is honest practice: the real five weekly boards with the real rules (no hints, no revives, two
 * attempts, best counts), scores computed by the same replay verifier, kept on this device and never ranked against
 * anyone. The division preview shows only the player. No made-up names, ranks or live counts anywhere.
 */

import { app } from '../../app/app';
import { playMode, resumeGame, savedFor, startGame } from '../../app/gameFlow';
import { featureFlags } from '../../config/featureFlags';
import { CUP_ATTEMPTS_PER_BOARD, cupWeek, PAR_SECONDS, type CupBoardSpec } from '../../competitions/cup';
import { attemptsFor, attemptsLeft, bestAttempt, previousWeekKey, weekSummary } from '../../competitions/localCup';
import { LEAGUE_RULES, TIER_INFO, TIERS, type LeagueTier } from '../../competitions/leagueRules';
import { ACCURACY_POINTS, BASE_POINTS, TIME_POINTS } from '../../competitions/scoring';
import { dailySpec } from '../../engine/levels';
import { addDaysKey, fmtClock, formatDuration, localDateKey, utcWeekBounds, utcWeekKey } from '../../game/dates';
import { liveStreak } from '../../meta/progression';
import { track } from '../../services/analytics';
import { openSheet, toast } from '../components/sheet';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';
import { coinPill } from './home';

type Tab = 'week' | 'daily' | 'friends';
let lastTab: Tab = 'week';

export function tierEmblem(tier: LeagueTier, size = 56): string {
  const c = TIER_INFO[tier].color;
  const rank = TIERS.indexOf(tier);
  const leaves = Array.from({ length: rank + 1 }, (_, i) => {
    const a = -150 + i * 18;
    const b = -30 - i * 18;
    return `<ellipse cx="32" cy="10" rx="2.6" ry="5" transform="rotate(${a} 32 32)" fill="${c}" opacity="0.9"/><ellipse cx="32" cy="10" rx="2.6" ry="5" transform="rotate(${b} 32 32)" fill="${c}" opacity="0.9"/>`;
  }).join('');
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    ${leaves}
    <circle cx="32" cy="32" r="18" fill="#fff" stroke="${c}" stroke-width="3"/>
    <g fill="${c}"><ellipse cx="32" cy="36.5" rx="5.6" ry="4.6"/><ellipse cx="25" cy="30.5" rx="2.3" ry="3"/><ellipse cx="29.2" cy="25.6" rx="2.3" ry="3.1"/><ellipse cx="34.8" cy="25.6" rx="2.3" ry="3.1"/><ellipse cx="39" cy="30.5" rx="2.3" ry="3"/></g>
  </svg>`;
}

export const leagueScreen: ScreenDef = {
  tab: 'league',
  title: 'League',
  mount(root, scope) {
    track('league_open', { online: featureFlags.onlineLeagues });
    const el = h(`<div class="league"></div>`);
    root.appendChild(el);
    const tier: LeagueTier = 'seedling';
    // Attempts left open in an earlier week are over (they keep their used attempt and score 0).
    const thisWeek = utcWeekKey();
    const stale = Object.keys(app.save.cup.open).filter((k) => !k.startsWith(`C${thisWeek}-`));
    if (stale.length) {
      for (const k of stale) delete app.save.cup.open[k];
      app.persist();
    }

    function boardRow(b: CupBoardSpec): string {
      const best = bestAttempt(app.save, b.weekKey, b.index);
      const used = attemptsFor(app.save, b.weekKey, b.index).length;
      const left = attemptsLeft(app.save, b.weekKey, b.index);
      const resumable = !!savedFor({ kind: 'cup', weekKey: b.weekKey, index: b.index });
      const dots = Array.from({ length: CUP_ATTEMPTS_PER_BOARD }, (_, i) => `<i class="${i < used ? 'is-used' : ''}"></i>`).join('');
      const action = resumable
        ? `<button class="btn btn--small" data-resume="${b.index}">Resume</button>`
        : left > 0
          ? `<button class="btn btn--small ${best ? 'btn--secondary' : ''}" data-board="${b.index}">${used ? 'Try again' : 'Play'}</button>`
          : `<span class="muted cup-board__done">Done</span>`;
      return `<li class="cup-board card">
        <span class="cup-board__num">${b.index + 1}</span>
        <span class="cup-board__info">
          <b>${esc(b.label)}</b>
          <span class="muted">${b.size}×${b.size} · par ${fmtClock(b.parSeconds)}</span>
          <span class="cup-board__meta"><span class="attempt-dots" aria-label="${plural(left, 'attempt')} left">${dots}</span>${best ? `<span class="cup-board__best num">${best.score} pts${best.mistakes === 0 ? ' · clean' : ''}</span>` : ''}</span>
        </span>
        ${action}
      </li>`;
    }

    function weekTab(): string {
      const week = cupWeek();
      const sum = weekSummary(app.save);
      const prev = weekSummary(app.save, previousWeekKey());
      const delta = prev.total ? sum.total - prev.total : null;
      return `
        <ol class="cup-boards" aria-label="This week's boards">${week.map(boardRow).join('')}</ol>
        <button class="btn btn--quiet" data-act="how">${ICON.help}How scoring works</button>
        <section class="card you-card" aria-labelledby="you-h">
          <h3 id="you-h">You this week</h3>
          <div class="stats">
            <div class="stat"><div class="stat__v num">${sum.total}</div><div class="stat__k">practice points</div></div>
            <div class="stat"><div class="stat__v num">${sum.boardsCleared}/5</div><div class="stat__k">boards cleared</div></div>
            <div class="stat"><div class="stat__v num">${sum.cleanClears}</div><div class="stat__k">clean clears</div></div>
          </div>
          ${delta !== null ? `<p class="you-card__delta ${delta >= 0 ? 'is-up' : ''}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last week (${prev.total})</p>` : `<p class="muted">Next week you'll see how you compare with yourself.</p>`}
          ${sum.cleanClears === 5 ? `<p class="chip chip--gold">${ICON.sparkle}Clean Sweep</p>` : ''}
        </section>
        <section class="card division" aria-labelledby="div-h">
          <div class="division__head"><h3 id="div-h">Your division</h3><span class="chip chip--preview">Preview</span></div>
          <ol class="division__list">
            <li class="division__row is-you"><span class="num">–</span><span class="division__name">You</span><span class="num">${sum.total}</span></li>
          </ol>
          <p class="muted division__empty">When online leagues open, about ${LEAGUE_RULES.cohortTarget} real players at your level will share this table. The top ${LEAGUE_RULES.promote} move up each week. We will never fill it with made-up players.</p>
        </section>
        <section class="card tiers" aria-labelledby="tiers-h">
          <h3 id="tiers-h">League tiers</h3>
          <ol class="tier-ladder">
            ${TIERS.map((t) => `<li class="${t === tier ? 'is-current' : ''}">${tierEmblem(t, 40)}<span>${esc(TIER_INFO[t].name)}</span></li>`).join('')}
          </ol>
          <p class="muted">Everyone starts in Seedling. Moving up is by points only. Nobody moves down for skipping a week.</p>
        </section>`;
    }

    function dailyTab(): string {
      const today = localDateKey();
      const streak = liveStreak(app.save, today);
      const days = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i - 6));
      return `
        <section class="card">
          <h3>Daily Cozy Puzzle</h3>
          <p class="muted">The same board for everyone each day. It's yours to enjoy offline; Daily Dash rankings arrive with online leagues.</p>
          <div class="stats">
            <div class="stat"><div class="stat__v num">${streak}</div><div class="stat__k">day streak</div></div>
            <div class="stat"><div class="stat__v num">${app.save.daily.bestStreak}</div><div class="stat__k">best streak</div></div>
            <div class="stat"><div class="stat__v num">${Object.keys(app.save.daily.done).length}</div><div class="stat__k">dailies solved</div></div>
          </div>
        </section>
        <ol class="daily-history">
          ${days
            .reverse()
            .map((k) => {
              const d = app.save.daily.done[k];
              const label = new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              return `<li class="row"><span class="row__label">${esc(label)}${k === today ? '<small>Today</small>' : ''}</span>${d ? `<span class="num">${fmtClock(d.seconds)}${d.mistakes === 0 ? ` <span class="chip chip--brand">${ICON.check}clean</span>` : ''}</span>` : k === today ? `<button class="btn btn--small" data-act="daily">Play</button>` : '<span class="muted">—</span>'}</li>`;
            })
            .join('')}
        </ol>`;
    }

    function friendsTab(): string {
      return `<section class="card empty-card">
        <span class="empty-card__icon">${ICON.users}</span>
        <h3>Friend challenges are on the way</h3>
        <p class="muted">You'll be able to invite a friend with a code and both solve the same board in your own time. Nothing about you is shared unless you choose to.</p>
      </section>`;
    }

    function render(): void {
      const ends = utcWeekBounds().end.getTime() - Date.now();
      el.innerHTML = `
        <header class="screen-head">
          <h1 data-autofocus>Paw Cup</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <section class="league-hero card">
          ${tierEmblem(tier, 64)}
          <div class="league-hero__body">
            <b>${esc(TIER_INFO[tier].name)} · ${esc(utcWeekKey().replace('-W', ' week '))}</b>
            <span class="muted">Five boards, all week. New boards in ${formatDuration(ends)}.</span>
          </div>
        </section>
        ${
          featureFlags.onlineLeagues
            ? ''
            : `<p class="notice">${ICON.info}<span>Online leagues aren't live yet. Practice the real weekly boards with the real rules. Your scores stay on this device and aren't ranked against anyone.</span></p>`
        }
        <div class="segmented" role="tablist" aria-label="League views">
          <button role="tab" data-tab="week" aria-selected="${lastTab === 'week'}">This week</button>
          <button role="tab" data-tab="daily" aria-selected="${lastTab === 'daily'}">Daily</button>
          <button role="tab" data-tab="friends" aria-selected="${lastTab === 'friends'}">Friends</button>
        </div>
        <div class="league__body">${lastTab === 'week' ? weekTab() : lastTab === 'daily' ? dailyTab() : friendsTab()}</div>`;
    }
    render();

    if (!app.save.onboarding.seenLeagueIntro) {
      app.save.onboarding.seenLeagueIntro = true;
      app.persist();
      showIntro(scope);
    }

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest('[data-tab]') as HTMLElement | null;
      if (tab) {
        lastTab = tab.dataset.tab as Tab;
        render();
        (el.querySelector(`[data-tab="${lastTab}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const res = t.closest('[data-resume]') as HTMLElement | null;
      if (res) {
        const spec = cupWeek()[Number(res.dataset.resume)];
        if (!resumeGame(savedFor({ kind: 'cup', weekKey: spec.weekKey, index: spec.index }))) {
          toast("That attempt couldn't be restored, so it counts as used.");
          render();
        }
        return;
      }
      const b = t.closest('[data-board]') as HTMLElement | null;
      if (b) {
        confirmAttempt(scope, Number(b.dataset.board));
        return;
      }
      const a = actionOf(e);
      if (a?.act === 'how') showScoring(scope);
      else if (a?.act === 'daily') playMode({ kind: 'daily', dateKey: dailySpec().dateKey });
    });
  },
};

function confirmAttempt(scope: Scope, index: number): void {
  const spec = cupWeek()[index];
  const left = attemptsLeft(app.save, spec.weekKey, index);
  const sh = openSheet(scope, {
    title: `Board ${index + 1}: ${spec.label}`,
    body: `<p class="sheet__lead">${spec.size}×${spec.size}, par ${fmtClock(spec.parSeconds)}. Paw Cup rules: no hints, no refills, three hearts. Starting uses one of your ${plural(left, 'remaining attempt')}; your best attempt counts.</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="go" data-autofocus>Start attempt</button><button class="btn btn--quiet" data-act="no">Not now</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    sh.close();
    if (a.act === 'go' && !startGame({ kind: 'cup', weekKey: spec.weekKey, index })) toast('Both attempts for this board are used.');
  });
}

function showScoring(scope: Scope): void {
  const sh = openSheet(scope, {
    title: 'How scoring works',
    body: `
      <p class="sheet__lead">Every finished board earns points. Speed and accuracy add more. Everyone gets the same boards, rules and attempts.</p>
      <dl class="score-card__rows score-card__rows--explain">
        <div><dt>Finishing the board</dt><dd class="num">${BASE_POINTS}</dd></div>
        <div><dt>Speed: ${TIME_POINTS} × par ÷ (par + your time)</dt><dd class="num">up to ${TIME_POINTS}</dd></div>
        <div><dt>No mistakes / one mistake</dt><dd class="num">${ACCURACY_POINTS.clean} / ${ACCURACY_POINTS.oneMistake}</dd></div>
      </dl>
      <p class="muted">Example, par 2:30: solved clean in 1:15 → 900 · in 2:30 → 850 · in 2:30 with one mistake → 775.</p>
      <p class="muted">Pars: easy ${fmtClock(PAR_SECONDS.easy)}, medium ${fmtClock(PAR_SECONDS.medium)}, hard ${fmtClock(PAR_SECONDS.hard)}, expert ${fmtClock(PAR_SECONDS.expert)}. Your weekly total is your best attempt on each of the five boards. Ties go to more clean clears, then less total time.</p>
      <p class="muted">Fair play: no hints, no refills, nothing to buy. In online leagues, your moves are checked by the server and time comes from the server clock.</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Got it</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if (actionOf(e)?.act === 'ok') sh.close();
  });
}

function showIntro(scope: Scope): void {
  const sh = openSheet(scope, {
    title: 'Welcome to the Paw Cup',
    center: true,
    body: `
      <div class="league-intro">${tierEmblem('seedling', 72)}</div>
      <p class="sheet__lead">Each week brings five fixed boards, the same for everyone. You get two attempts on each, and your best one counts. No hints, nothing to buy: just you and the puzzle.</p>
      <p class="muted">Online leagues aren't open yet, so for now your scores are personal practice.</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Let's go</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if (actionOf(e)?.act === 'ok') sh.close();
  });
}
