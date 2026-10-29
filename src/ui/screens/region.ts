/**
 * A regional sanctuary: its scene at the stage it has grown to, its animals, what the next stage brings, and its own
 * decorations. Opening a region and growing it are never sold; solving puzzles while it's the one you're building is
 * what grows it. The animals greet you when you arrive (a bigger hello right after a solve that helped).
 */

import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { afterDecorChange } from '../../app/events';
import { COMPANIONS, COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { decorOf, type DecorId } from '../../meta/catalogs/decor';
import { SANCTUARY_BY_ID, type RegionId } from '../../meta/catalogs/sanctuaries';
import { isShown, owns, setShown, shownDecorIds } from '../../meta/sanctuary';
import { activeRegion, isComplete, isOpen, nextStage, regionChat, setActive, stageOf } from '../../meta/world';
import { localDateKey } from '../../game/dates';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { regionScene } from '../art/regions';
import { decorIcon, SCENE_VIEWBOX } from '../art/sanctuary';
import { greetAll, startSceneLife, type SceneLife } from '../components/sceneLife';
import { toast } from '../components/sheet';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Route, ScreenDef } from '../router';
import { friendPortrait, isEvening, showFriendSheet } from './sanctuary';
import { coinPill } from './home';

export const regionScreen: ScreenDef = {
  tab: 'world',
  title: 'Sanctuary',
  mount(root, scope, route: Route) {
    if (route.screen !== 'region') return;
    const id: RegionId = route.id;
    const def = SANCTUARY_BY_ID[id];
    const friendsHere = COMPANIONS.filter((c) => c.sanctuary === id);
    // Which stage just appeared (coming from a solve that reached it), to pop it in.
    const freshStage = route.fresh ?? 0;
    const today = localDateKey();
    const firstVisitToday = app.save.world.visited[id] !== today;
    if (isOpen(app.save, id)) {
      app.save.world.visited[id] = today;
      app.persist();
    }
    track('region_open', { region: id, stage: stageOf(app.save, id) });

    const el = h(`<div class="sanctuary region" style="--accent:${def.accent}"></div>`);
    root.appendChild(el);

    let life: SceneLife | null = null;
    scope.onDispose(() => life?.dispose());
    scope.on(document, 'visibilitychange', () => life?.setLive(!document.hidden));

    function progressCard(): string {
      const save = app.save;
      const level = save.journey.nextLevel;
      if (!isOpen(save, id)) {
        const cleared = level - 1;
        const pct = Math.round((cleared / def.opensAfterLevel) * 100);
        return `<section class="card region-progress" aria-labelledby="rp-title">
          <h2 id="rp-title">${ICON.lock}Opens after level ${def.opensAfterLevel}</h2>
          <p class="muted">${esc(def.blurb)}</p>
          <div class="progress world-progress" role="progressbar" aria-label="Levels until it opens" aria-valuemin="0" aria-valuemax="${def.opensAfterLevel}" aria-valuenow="${cleared}"><span style="width:${pct}%"></span></div>
          <p class="world-focus__count">${plural(def.opensAfterLevel - cleared, 'level')} to go</p>
          <button class="btn btn--block" data-act="play">Play level ${level}</button>
        </section>`;
      }
      if (isComplete(save, id))
        return `<section class="card region-progress is-complete" aria-labelledby="rp-title">
          <h2 id="rp-title">${ICON.sparkle}Thriving</h2>
          <p class="muted">${esc(def.stages[def.stages.length - 1].change)}. Every friend here has a home. Thank you!</p>
        </section>`;
      const next = nextStage(save, id)!;
      const building = activeRegion(save) === id;
      const pct = Math.round(((next.have - next.from) / (next.need - next.from)) * 100);
      const steps = def.stages
        .slice(1)
        .map((st, i) => `<li class="${stageOf(save, id) >= i + 1 ? 'is-done' : i + 1 === next.index ? 'is-next' : ''}"><span class="region-steps__dot" aria-hidden="true">${stageOf(save, id) >= i + 1 ? ICON.check : i + 1}</span><span>${esc(st.name)}</span></li>`)
        .join('');
      return `<section class="card region-progress" aria-labelledby="rp-title">
        <div class="region-progress__head"><h2 id="rp-title">Stage ${stageOf(save, id)} of 4</h2>${building ? `<span class="chip chip--brand">${ICON.sprout}Building now</span>` : ''}</div>
        <ol class="region-steps" aria-label="Stages">${steps}</ol>
        <p class="muted">Next, <b>${esc(next.stage.name.toLowerCase())}</b>: ${esc(next.stage.change)}.</p>
        <div class="progress world-progress" role="progressbar" aria-label="Progress to ${esc(next.stage.name)}" aria-valuemin="${next.from}" aria-valuemax="${next.need}" aria-valuenow="${next.have}"><span style="width:${pct}%"></span></div>
        <p class="world-focus__count"><span class="num">${next.need - next.have}</span> more ${next.need - next.have === 1 ? 'puzzle' : 'puzzles'}${building ? '' : ' while you build here'}</p>
        ${
          building
            ? `<button class="btn btn--block" data-act="play">Play level ${level}</button><p class="muted region-progress__note">Journey, Daily and Zen puzzles all count.</p>`
            : `<button class="btn btn--block" data-act="build">${ICON.sprout}Build here</button><p class="muted region-progress__note">You build one sanctuary at a time. Progress elsewhere is kept.</p>`
        }
      </section>`;
    }

    function render(): void {
      const save = app.save;
      const open = isOpen(save, id);
      const stage = stageOf(save, id);
      const welcomed = friendsHere.filter((c) => save.inventory.companions[c.id]).map((c) => c.id);
      const decor = shownDecorIds(save, id);
      const ownedDecor = decorOf(id).filter((d) => owns(save, d.id));
      const chat = open ? regionChat(save, id) : null;
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back to the World map">${ICON.back}</button>
          <h1 data-autofocus>${esc(def.name)}</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <p class="muted region__place">${ICON.pin}${esc(def.place)}</p>
        <figure class="sanctuary__scene card is-live ${open ? '' : 'is-locked'}">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(stage, welcomed))}">${regionScene(id, { stage: open ? stage : 0, companions: welcomed, decor, evening: isEvening() }, `rg-${id}`)}</svg>
        </figure>
        ${chat ? `<p class="sanctuary__chat">${ICON.heart}<span>${esc(chat)}</span></p>` : ''}
        ${progressCard()}
        <section aria-labelledby="animals-title">
          <div class="section-head"><h2 id="animals-title">Animals</h2><span class="muted num">${welcomed.length} of ${friendsHere.length}</span></div>
          <ul class="resident-row resident-row--friends">
            ${friendsHere
              .map((c) => {
                const has = welcomed.includes(c.id);
                return `<li><button class="resident" data-friend-card="${c.id}" aria-label="${esc(has ? `${c.name} the ${c.kind.toLowerCase()}, ${c.trait}` : `A ${c.kind.toLowerCase()}, arrives at stage ${c.stage}`)}">
                  ${friendPortrait(c.id, !has)}
                  <span class="resident__name">${has ? esc(c.name) : `Stage ${c.stage}`}</span>
                </button></li>`;
              })
              .join('')}
          </ul>
        </section>
        <section aria-labelledby="rdecor-title">
          <div class="section-head"><h2 id="rdecor-title">Decorations</h2><span class="muted num">${ownedDecor.length} of ${decorOf(id).length}</span></div>
          ${
            ownedDecor.length
              ? `<div class="rows">${ownedDecor
                  .map(
                    (d) => `<button class="row decor-row" role="switch" aria-checked="${isShown(save, d.id)}" data-toggle="${d.id}">
                      <span class="decor-row__icon">${decorIcon(d.id)}</span>
                      <span class="row__label">${esc(d.name)}<small>${isShown(save, d.id) ? 'Out in the sanctuary' : 'Tucked away'}</small></span>
                      <span class="switch" aria-hidden="true"></span>
                    </button>`,
                  )
                  .join('')}</div>`
              : `<p class="empty">${open ? `Decorations for the ${esc(def.name.replace(/ Sanctuary$/, ''))} are in the Shop.` : 'Its decorations can be bought once it opens.'}</p>`
          }
          <button class="btn btn--secondary btn--block" data-act="shop">${ICON.bag}${esc(def.name.replace(/ Sanctuary$/, ''))} decorations</button>
        </section>`;
      life?.dispose();
      const svg = el.querySelector('.sanctuary__scene svg');
      life = svg ? startSceneLife(svg, `region-${id}`) : null;
    }
    render();

    // Arrival: a new stage grows in, then everyone says hello (a bigger hello on the first visit of the day, or right
    // after a solve that helped this place).
    if (isOpen(app.save, id) && life) {
      const svg = el.querySelector('.sanctuary__scene svg');
      if (freshStage && svg && !app.reducedMotion) for (const g of svg.querySelectorAll(`.sp-stage[data-stage="${freshStage}"]`)) g.classList.add('is-new');
      greetAll(life, (fn, ms) => scope.timeout(fn, ms), route.fresh !== undefined || firstVisitToday);
    }

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const fig = t.closest('.sanctuary__scene .sanctuary__pet') as HTMLElement | null;
      if (fig) {
        life?.tap(fig);
        return;
      }
      const friendBtn = t.closest('[data-friend-card]') as HTMLElement | null;
      if (friendBtn) {
        const cid = friendBtn.dataset.friendCard as CompanionId;
        let fed = false;
        let patted = false;
        showFriendSheet(scope, cid, {
          onFed: () => (fed = true),
          onPat: () => (patted = true),
          // React in the scene once the card is out of the way.
          onClose: () => {
            if (fed || patted) scope.timeout(() => life?.play(`friend:${cid}`, fed ? 'greet' : 'love'), 220);
          },
        });
        return;
      }
      const tog = t.closest('[data-toggle]') as HTMLElement | null;
      if (tog) {
        const d = tog.dataset.toggle as DecorId;
        setShown(app.save, d, !isShown(app.save, d));
        afterDecorChange();
        app.persist();
        render();
        (el.querySelector(`[data-toggle="${d}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const a = t.closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      switch (a.dataset.act) {
        case 'back':
          app.router.go({ screen: 'world' });
          break;
        case 'play':
          playMode({ kind: 'level', level: app.save.journey.nextLevel });
          break;
        case 'build':
          if (setActive(app.save, id)) {
            app.persist();
            sfx('coin');
            track('region_build', { region: id });
            toast(`Now building the ${def.name}. Every puzzle you solve helps it grow.`);
            render();
          }
          break;
        case 'shop':
          app.router.go({ screen: 'shop', sanctuary: id });
          break;
      }
    });

    function sceneLabel(stage: number, welcomed: CompanionId[]): string {
      const who = welcomed.map((c) => `${COMPANION_BY_ID[c].name} the ${COMPANION_BY_ID[c].kind.toLowerCase()}`);
      const where = stage ? def.stages[stage].name : 'Wild land, waiting for its first friend';
      return `The ${def.name}. ${where}.${who.length ? ` ${who.join(', ')} ${who.length === 1 ? 'lives' : 'live'} here.` : ''}`;
    }
  },
};
