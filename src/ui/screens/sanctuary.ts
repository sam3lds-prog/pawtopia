/**
 * The Harmony Sanctuary: the illustrated garden with every owned decoration and welcomed resident, the resident row,
 * and the decorations you own (show / hide). New residents are introduced here, and after the very first board the
 * player picks one of two free starter gifts.
 */

import { app } from '../../app/app';
import { startGame } from '../../app/gameFlow';
import { DECOR, DECOR_BY_ID, STARTER_DECOR, type DecorId } from '../../meta/catalogs/decor';
import { PET_BY_ID, PETS, type PetId } from '../../meta/catalogs/pets';
import { chooseStarter, isShown, owns, setShown } from '../../meta/sanctuary';
import { unlockedPets } from '../../meta/rewards';
import { track } from '../../services/analytics';
import { afterDecorChange, afterSanctuaryVisit } from '../../app/events';
import { sfx } from '../../services/audio';
import { decorIcon, sanctuaryScene, SCENE_VIEWBOX } from '../art/sanctuary';
import { portrait, showPetSheet } from '../components/petSheet';
import { openSheet, toast } from '../components/sheet';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Route, Scope, ScreenDef } from '../router';
import { coinPill } from './home';

export function shownDecor(): DecorId[] {
  return DECOR.filter((d) => isShown(app.save, d.id)).map((d) => d.id);
}

/** The live sanctuary picture for the current save (used here and on Home). */
export function sceneMarkup(id: string): string {
  return sanctuaryScene({ decor: shownDecor(), pets: unlockedPets(app.save) }, id);
}

export const sanctuaryScreen: ScreenDef = {
  tab: 'home',
  title: 'Sanctuary',
  mount(root, scope, route: Route) {
    const welcome = route.screen === 'sanctuary' ? (route.welcome ?? []) : [];
    track('sanctuary_open', { pets: unlockedPets(app.save).length, decor: shownDecor().length });
    app.save.sanctuary.visits++;
    const news = afterSanctuaryVisit();
    app.persist();
    for (const a of news.achievements) toast(`Badge unlocked: ${a.name}`);

    const el = h(`<div class="sanctuary"></div>`);
    root.appendChild(el);

    function render(): void {
      const save = app.save;
      const pets = unlockedPets(save);
      const ownedDecor = DECOR.filter((d) => owns(save, d.id));
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back to Home">${ICON.back}</button>
          <h1 data-autofocus>Sanctuary</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <figure class="sanctuary__scene card">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(pets, ownedDecor.length))}">${sceneMarkup('sanct')}</svg>
        </figure>
        <section aria-labelledby="res-title">
          <div class="section-head"><h2 id="res-title">Residents</h2><span class="muted num">${pets.length} of ${PETS.length}</span></div>
          <ul class="resident-row">
            ${PETS.map((p) => {
              const has = pets.includes(p.id);
              return `<li><button class="resident" data-pet="${p.id}" aria-label="${esc(has ? `${p.name}, ${p.trait}` : `${p.name}, arrives at level ${p.unlockLevel}`)}">
                ${portrait(p.id, 'idle', !has)}
                <span class="resident__name">${has ? esc(p.name) : `Lv ${p.unlockLevel}`}</span>
              </button></li>`;
            }).join('')}
          </ul>
        </section>
        <section aria-labelledby="decor-title">
          <div class="section-head"><h2 id="decor-title">Decorations</h2><span class="muted num">${ownedDecor.length} of ${DECOR.length}</span></div>
          ${
            ownedDecor.length
              ? `<div class="rows">${ownedDecor
                  .map(
                    (d) => `<button class="row decor-row" role="switch" aria-checked="${isShown(save, d.id)}" data-toggle="${d.id}">
                      <span class="decor-row__icon">${decorIcon(d.id)}</span>
                      <span class="row__label">${esc(d.name)}<small>${isShown(save, d.id) ? 'Out in the garden' : 'Tucked away'}</small></span>
                      <span class="switch" aria-hidden="true"></span>
                    </button>`,
                  )
                  .join('')}</div>`
              : `<p class="empty">Decorations you earn or buy appear in the garden.</p>`
          }
          <button class="btn btn--secondary btn--block" data-act="shop">${ICON.bag}Find decorations in the Shop</button>
        </section>`;
    }
    render();

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const petBtn = t.closest('[data-pet]') as HTMLElement | null;
      if (petBtn) {
        showPetSheet(scope, petBtn.dataset.pet as PetId, { showVisit: false });
        return;
      }
      const tog = t.closest('[data-toggle]') as HTMLElement | null;
      if (tog) {
        const id = tog.dataset.toggle as DecorId;
        setShown(app.save, id, !isShown(app.save, id));
        afterDecorChange();
        app.persist();
        render();
        (el.querySelector(`[data-toggle="${id}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'back') app.router.go({ screen: 'home' });
      else if (a.act === 'shop') app.router.go({ screen: 'shop' });
    });

    // First visit after the first board: meet the residents, then pick a starter gift.
    const intro = () => {
      if (app.save.onboarding.tutorialDone && !app.save.onboarding.starterDecorChosen) offerStarter(scope, render);
    };
    if (welcome.length) introduce(scope, welcome, intro);
    else intro();
  },
};

function sceneLabel(pets: PetId[], decorCount: number): string {
  const names = pets.map((p) => PET_BY_ID[p].name);
  const who = names.length ? `${names.join(', ')} ${names.length === 1 ? 'lives' : 'live'} here` : 'No residents yet';
  return `The Harmony Sanctuary garden. ${who}. ${plural(decorCount, 'decoration')}.`;
}

/** "New residents" sheet. */
export function introduce(scope: Scope, pets: PetId[], then?: () => void): void {
  const sh = openSheet(scope, {
    title: pets.length > 1 ? 'New residents!' : `${PET_BY_ID[pets[0]].name} moved in!`,
    center: true,
    className: 'intro-sheet',
    onClose: () => then?.(),
    body: `
      <div class="intro-pets">
        ${pets
          .map((id) => {
            const p = PET_BY_ID[id];
            return `<div class="intro-pet">${portrait(id, 'happy')}<b>${esc(p.name)}</b><span class="muted">${esc(p.trait)}</span></div>`;
          })
          .join('')}
      </div>
      <p class="sheet__lead">${pets.length > 1 ? 'They found a home in your sanctuary.' : esc(PET_BY_ID[pets[0]].bio)}</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Welcome home</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="ok"]')) sh.close();
  });
}

/** One of two free starter decorations, once. */
function offerStarter(scope: Scope, rerender: () => void): void {
  const sh = openSheet(scope, {
    title: 'Pick a welcome gift',
    center: true,
    dismissible: false,
    className: 'starter-sheet',
    body: `
      <p class="sheet__lead">Choose one for the garden. The other stays in the Shop for later.</p>
      <div class="starter-choices">
        ${STARTER_DECOR.map((id) => {
          const d = DECOR_BY_ID[id];
          return `<button class="starter-choice card card--tap" data-choose="${id}">
            <span class="starter-choice__art">${decorIcon(id)}</span>
            <b>${esc(d.name)}</b><span class="muted">${esc(d.blurb)}</span>
          </button>`;
        }).join('')}
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-choose]') as HTMLElement | null;
    if (!b) return;
    const id = b.dataset.choose as DecorId;
    if (chooseStarter(app.save, id)) {
      afterDecorChange();
      app.persist();
      sfx('coin');
      track('onboarding_step', { step: 'starter_gift', item: id });
      sh.close();
      rerender();
      toast(`${DECOR_BY_ID[id].name} is in the garden.`);
      offerNext(scope);
    }
  });
}

function offerNext(scope: Scope): void {
  const next = app.save.journey.nextLevel;
  const sh = openSheet(scope, {
    title: 'Ready for the next puzzle?',
    body: `<p class="sheet__lead">More neighbors are on their way. Each new resident arrives as you solve the Journey.</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="play">Play level ${next}</button><button class="btn btn--quiet" data-act="stay">Stay in the garden</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    sh.close();
    if (a.act === 'play') startGame({ kind: 'level', level: next });
  });
}
