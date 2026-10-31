/**
 * The Farm or a regional sanctuary: its scene at the stage it has grown to, its animals and who is coming home next,
 * what the next stage brings, and its own decorations. Opening a sanctuary and growing it are never sold; solving
 * puzzles while it's the one you're building is what grows it, and while you build here your boards show the animal
 * on its way (D35). The animals greet you when you arrive (a bigger hello right after a solve that helped).
 */

import { app } from '../../app/app';
import { buildHereMessage, playMode } from '../../app/gameFlow';
import { afterDecorChange } from '../../app/events';
import { COMPANIONS, COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { decorOf, type DecorId } from '../../meta/catalogs/decor';
import { SANCTUARY_BY_ID, type RegionId } from '../../meta/catalogs/sanctuaries';
import { isShown, owns, setShown, shownDecorIds } from '../../meta/sanctuary';
import { activeSanctuary, arrivalProgress, isComplete, isOpen, markSeen, nextStage, regionChat, setActive, stageOf } from '../../meta/world';
import { animalInfo, isHome, nextArrivalIn, type AnimalId } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import { localDateKey } from '../../game/dates';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { regionScene } from '../art/regions';
import { decorIcon, SCENE_VIEWBOX } from '../art/sanctuary';
import { greetAll, startSceneLife, type SceneLife } from '../components/sceneLife';
import { animalName, startSceneActivities, type ActivityRunner } from '../components/activities';
import { mountTrickTray } from '../components/tricks';
import { createScene3D } from '../components/scene3d';
import { trickBadge } from '../art/tricks';
import { toast } from '../components/sheet';
import { dismissSceneCue, sceneCue, sceneCueMarkup, type SceneCue } from '../components/sceneCues';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Route, ScreenDef } from '../router';
import { friendPortrait, isEvening, offerStarterGift, showFriendSheet } from './sanctuary';
import { coinPill } from '../components/wallet';

export const regionScreen: ScreenDef = {
  tab: 'world',
  title: 'Sanctuary',
  mount(root, scope, route: Route) {
    if (route.screen !== 'region') return;
    const id: RegionId = route.id;
    const def = SANCTUARY_BY_ID[id];
    const order = def.arrivals.map((a) => a.id as string);
    const friendsHere = COMPANIONS.filter((c) => c.sanctuary === id).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    // Which stage just appeared (coming from a solve that reached it), to pop it in.
    const freshStage = route.fresh ?? 0;
    const today = localDateKey();
    const firstVisitToday = app.save.world.visited[id] !== today;
    // Whatever happened here since the last visit (the "New" marker) is seen now; newcomers get their hello below.
    const news = markSeen(app.save, id);
    if (isOpen(app.save, id)) {
      app.save.world.visited[id] = today;
      app.persist();
    } else if (news) app.persist();
    track('region_open', { region: id, stage: stageOf(app.save, id) });

    const el = h(`<div class="sanctuary region" style="--accent:${def.accent}"></div>`);
    root.appendChild(el);

    // Tricks: a tray under the scene for the animal you tap (kept across re-renders).
    const trayHost = h(`<div class="trick-tray-slot" hidden></div>`);
    const tricksBtn = () => el.querySelector<HTMLElement>('[data-act="tricks"]');
    const tray = mountTrickTray(scope, trayHost, () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), {
      returnFocus: tricksBtn,
      onToggle: (open) => tricksBtn()?.setAttribute('aria-expanded', String(open)),
    });
    let life: SceneLife | null = null;
    let acts: ActivityRunner | null = null;
    // 3D toys over the drawn scene (D34); kept across re-renders.
    const s3d = createScene3D();
    scope.onDispose(() => {
      life?.dispose();
      acts?.dispose();
      s3d.dispose();
    });
    scope.on(document, 'visibilitychange', () => {
      life?.setLive(!document.hidden);
      acts?.setLive(!document.hidden);
      s3d.setLive(!document.hidden);
    });

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
      const next = nextStage(save, id);
      const coming = arrivalProgress(save, id);
      const building = activeSanctuary(save) === id;
      const total = def.stages.length - 1;
      const steps = def.stages
        .slice(1)
        .map(
          (st, i) =>
            `<li class="${stageOf(save, id) >= i + 1 ? 'is-done' : next && i + 1 === next.index ? 'is-next' : ''}"><span class="region-steps__dot" aria-hidden="true">${stageOf(save, id) >= i + 1 ? ICON.check : i + 1}</span><span>${esc(st.name)}</span></li>`,
        )
        .join('');
      const comingRow = coming
        ? (() => {
            const a = animalInfo(coming.next.id);
            const span = Math.max(1, coming.need - coming.from);
            const pct = Math.round(((coming.have - coming.from) / span) * 100);
            return `<div class="coming-home">
              <span class="coming-home__art portrait is-shy">${animalPortrait(coming.next.id, 'idle')}</span>
              <span class="coming-home__body"><span><b>${esc(a.name)} the ${esc(a.noun)}</b> is coming home${building ? ' and is on your boards' : ''}.</span>
                <span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${coming.from}" aria-valuemax="${coming.need}" aria-valuenow="${coming.have}"><span style="width:${pct}%"></span></span>
                <small class="num">${plural(coming.left, 'more puzzle')}${building ? '' : ' while you build here'}</small></span>
            </div>`;
          })()
        : '';
      const stageLine = next
        ? `<p class="muted">Next stage, <b>${esc(next.stage.name.toLowerCase())}</b>: ${esc(next.stage.change)}. <span class="num">${plural(next.need - next.have, 'puzzle')}</span> to go.</p>`
        : '';
      return `<section class="card region-progress" aria-labelledby="rp-title">
        <div class="region-progress__head"><h2 id="rp-title">Stage ${stageOf(save, id)} of ${total}</h2>${building ? `<span class="chip chip--brand">${ICON.sprout}Building now</span>` : ''}</div>
        ${comingRow}
        <ol class="region-steps" aria-label="Stages">${steps}</ol>
        ${stageLine}
        ${
          building
            ? `<button class="btn btn--block" data-act="play">Play level ${level}</button><p class="muted region-progress__note">Journey, Daily and Zen puzzles all count.</p>`
            : `<button class="btn btn--block" data-act="build">${ICON.sprout}Build here</button><p class="muted region-progress__note">Your next puzzles will help this sanctuary. Progress in your other homes is safe.</p>`
        }
      </section>`;
    }

    function render(): void {
      const save = app.save;
      const open = isOpen(save, id);
      const stage = stageOf(save, id);
      const welcomed = friendsHere.filter((c) => isHome(save, c.id)).map((c) => c.id);
      const nextId = nextArrivalIn(save, id)?.id;
      const decor = shownDecorIds(save, id);
      const ownedDecor = decorOf(id).filter((d) => owns(save, d.id));
      const chat = open ? regionChat(save, id) : null;
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h1 data-autofocus>${esc(def.name)}</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <p class="muted region__place">${ICON.pin}${esc(def.place)}</p>
        <figure class="sanctuary__scene card is-live ${open ? '' : 'is-locked'}">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(stage, welcomed))}">${regionScene(id, { stage: open ? stage : 0, companions: welcomed, decor, evening: isEvening() }, `rg-${id}`)}</svg>
        </figure>
        <div class="sanctuary__under">
          <p class="sanctuary__chat" data-chat ${chat ? '' : 'hidden'}>${ICON.heart}<span>${esc(chat ?? '')}</span></p>
          <button class="scene-tricks" data-act="tricks" aria-controls="${trayHost.id}" aria-expanded="${tray.isOpen}" hidden>${trickBadge('sparkle')}Tricks</button>
        </div>
        <div data-cue-slot></div>
        ${progressCard()}
        <section aria-labelledby="animals-title">
          <div class="section-head"><h2 id="animals-title">Animals</h2><span class="muted num">${welcomed.length} of ${friendsHere.length}</span></div>
          <ul class="resident-row resident-row--friends">
            ${friendsHere
              .map((c) => {
                const has = welcomed.includes(c.id);
                const isNext = !has && c.id === nextId;
                return `<li><button class="resident ${isNext ? 'is-next' : ''}" data-friend-card="${c.id}" aria-label="${esc(has ? `${c.name} the ${c.kind.toLowerCase()}, ${c.trait}` : isNext ? `${c.name} the ${c.kind.toLowerCase()}, coming home next` : `A ${c.kind.toLowerCase()}, arrives later`)}">
                  ${friendPortrait(c.id, !has && !isNext)}
                  <span class="resident__name">${has || isNext ? esc(c.name) : 'Later'}</span>
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
              : `<p class="empty">${open ? `Decorations and treats for the ${esc(def.short)} are in the Shop.` : 'Its decorations can be bought once it opens.'}</p>`
          }
          <button class="btn btn--secondary btn--block" data-act="shop">${ICON.bag}${esc(def.short)} decorations and treats</button>
        </section>`;
      life?.dispose();
      acts?.dispose();
      const svg = el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      life = svg ? startSceneLife(svg, `region-${id}`) : null;
      acts = svg && open ? startSceneActivities(svg, el.querySelector('[data-chat]'), () => app.reducedMotion, animalName) : null;
      // One cue at a time, once: tap an animal; later, use a decoration.
      const slot = el.querySelector('[data-cue-slot]');
      if (slot) slot.innerHTML = sceneCueMarkup(open ? sceneCue(!!svg?.querySelector('.sanctuary__pet'), !!svg?.querySelector('[data-decor].has-act')) : null);
      s3d.attach(open ? el.querySelector<HTMLElement>('.sanctuary__scene') : null, svg);
      const btn = tricksBtn();
      if (btn) btn.hidden = !open || !svg?.querySelector('.sanctuary__pet');
      el.querySelector('.sanctuary__under')?.after(trayHost);
      tray.refresh();
    }
    render();

    // Arrival: a new stage grows in, then everyone says hello (a bigger hello on the first visit of the day, or right
    // after a solve that helped this place).
    if (isOpen(app.save, id) && life) {
      const svg = el.querySelector('.sanctuary__scene svg');
      if (freshStage && svg && !app.reducedMotion) for (const g of svg.querySelectorAll(`.sp-stage[data-stage="${freshStage}"]`)) g.classList.add('is-new');
      greetAll(life, (fn, ms) => scope.timeout(fn, ms), route.fresh !== undefined || firstVisitToday);
    }
    // After the first board: a starter gift for the Farm (if the Pet Garden hasn't offered it already).
    if (isOpen(app.save, id)) offerStarterGift(scope, id, render);
    // Someone came home, just now or while the player was elsewhere: say so, and let them say hello.
    const newcomers = [...new Set([...(route.welcome ?? []), ...((news?.animals ?? []) as AnimalId[])])].filter((w) => isHome(app.save, w));
    if (newcomers.length) {
      const a = animalInfo(newcomers[0]);
      toast(`${a.name} the ${a.noun} came home to the ${def.short}!`, ICON.heart);
      // Straight from the win that brought them (D38): the newcomer settles into place first (≤0.9 s, one time, never
      // under reduced motion), then says hello like any arrival.
      if (route.welcome?.includes(newcomers[0]) && !app.reducedMotion) {
        const fig = el.querySelector(`.sanctuary__scene [data-friend="${newcomers[0]}"]`);
        fig?.classList.add('is-arriving');
        scope.timeout(() => fig?.classList.remove('is-arriving'), 900);
      }
      scope.timeout(() => life?.play(`friend:${newcomers[0]}`, 'greet'), app.reducedMotion ? 0 : 900);
    }

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-act="tricks"]')) {
        if (tray.isOpen) tray.close();
        else tray.openFor(undefined, true);
        return;
      }
      const cueOk = t.closest('[data-act="cue-ok"]') as HTMLElement | null;
      if (cueOk) {
        dismissSceneCue(el, (cueOk.closest('[data-scene-cue]') as HTMLElement).dataset.sceneCue as SceneCue);
        return;
      }
      const fig = t.closest('.sanctuary__scene .sanctuary__pet') as HTMLElement | null;
      if (fig) {
        if (!app.save.onboarding.sceneTapTipSeen) dismissSceneCue(el, 'tap');
        life?.tap(fig);
        tray.open(fig as unknown as SVGGElement);
        return;
      }
      const dec = t.closest('.sanctuary__scene [data-decor].has-act') as HTMLElement | null;
      if (dec) {
        if (!app.save.onboarding.decorTipSeen) dismissSceneCue(el, 'decor');
        if (acts && !acts.busy && !acts.play(dec.dataset.decor!)) {
          const anyone = !!el.querySelector('.sanctuary__scene .sanctuary__pet');
          toast(anyone ? 'Everyone’s busy with a trick. Try again in a moment.' : 'Once an animal lives here, they’ll love this.');
        }
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
          app.router.back({ screen: 'world' });
          break;
        case 'play':
          playMode({ kind: 'level', level: app.save.journey.nextLevel });
          break;
        case 'build':
          if (setActive(app.save, id)) {
            app.persist();
            sfx('coin');
            track('region_build', { region: id });
            toast(buildHereMessage(id));
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
      const where = stage ? def.stages[stage].name : `${def.stages[0]?.name ?? 'Wild land'}, waiting for its first friend`;
      return `The ${def.name}. ${where}.${who.length ? ` ${who.join(', ')} ${who.length === 1 ? 'lives' : 'live'} here.` : ''}`;
    }
  },
};
