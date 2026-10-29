/**
 * The Harmony Sanctuary: the illustrated garden with every owned decoration and welcomed resident, the resident row,
 * and the decorations you own (show / hide). New residents are introduced here, and after the very first board the
 * player picks one of two free starter gifts.
 */

import { app } from '../../app/app';
import { startGame } from '../../app/gameFlow';
import { DECOR, DECOR_BY_ID, STARTER_DECOR, decorHome, decorOf, type DecorId } from '../../meta/catalogs/decor';
import { PET_BY_ID, PETS, type PetId } from '../../meta/catalogs/pets';
import { chooseStarter, isShown, owns, sanctuaryChat, setShown, shownDecorIds } from '../../meta/sanctuary';
import { bindFriendPanel, friendPanelMarkup, type FeedEvents } from '../components/feedPanel';
import { unlockedCompanions, unlockedPets } from '../../meta/rewards';
import { COMPANIONS, COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { SANCTUARY_BY_ID } from '../../meta/catalogs/sanctuaries';
import { companionSvg } from '../art/companions';
import { startSceneLife, type SceneLife } from '../components/sceneLife';
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

const HARMONY_FRIENDS = COMPANIONS.filter((c) => c.sanctuary === 'harmony');

export function shownDecor(): DecorId[] {
  return shownDecorIds(app.save);
}

/** Local evening (7 pm to 6 am): a dusk wash and fireflies. */
export function isEvening(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 19 || h < 6;
}

/** The sanctuary picture for the current save (used here, live, and on Home, still). */
export function sceneMarkup(id: string): string {
  return sanctuaryScene({ decor: shownDecor(), pets: unlockedPets(app.save), companions: unlockedCompanions(app.save), evening: isEvening() }, id);
}

/** Portrait for a wildlife friend, matching resident portraits. */
export function friendPortrait(id: CompanionId, locked = false): string {
  return `<span class="portrait${locked ? ' is-locked' : ''}" style="--tint:${COMPANION_BY_ID[id].tint}">${companionSvg(id, locked ? 'idle' : 'happy')}</span>`;
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

    // ---------------------------------------------------------------- ambient life (D24)
    let life: SceneLife | null = null;
    scope.onDispose(() => life?.dispose());
    scope.on(document, 'visibilitychange', () => life?.setLive(!document.hidden));

    function wireLife(): void {
      life?.dispose();
      const svg = el.querySelector('.sanctuary__scene svg');
      life = svg ? startSceneLife(svg, 'sanct') : null;
    }

    function render(): void {
      const save = app.save;
      const pets = unlockedPets(save);
      const friends = unlockedCompanions(save);
      const ownedDecor = DECOR.filter((d) => decorHome(d) === 'harmony' && owns(save, d.id));
      const chat = sanctuaryChat(save);
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back to Home">${ICON.back}</button>
          <h1 data-autofocus>Sanctuary</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <figure class="sanctuary__scene card is-live">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(pets, ownedDecor.length))}">${sceneMarkup('sanct')}</svg>
        </figure>
        ${chat ? `<p class="sanctuary__chat">${ICON.heart}<span>${esc(chat)}</span></p>` : ''}
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
        <section aria-labelledby="friends-title">
          <div class="section-head"><h2 id="friends-title">Wildlife friends</h2><span class="muted num">${friends.filter((f) => COMPANION_BY_ID[f].sanctuary === 'harmony').length} of ${HARMONY_FRIENDS.length}</span></div>
          <ul class="resident-row resident-row--friends">
            ${HARMONY_FRIENDS.map((c) => {
              const has = friends.includes(c.id);
              return `<li><button class="resident" data-friend-card="${c.id}" aria-label="${esc(has ? `${c.name} the ${c.kind.toLowerCase()}, ${c.trait}` : `A ${c.kind.toLowerCase()}, arrives at level ${c.unlockLevel}`)}">
                ${friendPortrait(c.id, !has)}
                <span class="resident__name">${has ? esc(c.name) : `Lv ${c.unlockLevel}`}</span>
              </button></li>`;
            }).join('')}
          </ul>
        </section>
        <section aria-labelledby="decor-title">
          <div class="section-head"><h2 id="decor-title">Decorations</h2><span class="muted num">${ownedDecor.length} of ${decorOf('harmony').length}</span></div>
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
      wireLife();
    }
    render();

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      // A tap on someone in the garden: a small happy reaction (a heart; face only under reduced motion).
      const fig = t.closest('.sanctuary__scene .sanctuary__pet') as HTMLElement | null;
      if (fig) {
        life?.tap(fig);
        return;
      }
      const friendBtn = t.closest('[data-friend-card]') as HTMLElement | null;
      if (friendBtn) {
        showFriendSheet(scope, friendBtn.dataset.friendCard as CompanionId);
        return;
      }
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
      else if (a.act === 'shop') app.router.go({ screen: 'shop', sanctuary: 'harmony' });
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

/** When a friend who hasn't arrived yet will come. */
export function arrivalText(id: CompanionId): string {
  const c = COMPANION_BY_ID[id];
  if (c.unlockLevel !== undefined) return `Arrives when you first clear level ${c.unlockLevel}.`;
  const def = SANCTUARY_BY_ID[c.sanctuary];
  const st = def.stages[c.stage ?? 1];
  return `Arrives when the ${def.name} reaches stage ${c.stage}: ${st ? st.name.toLowerCase() : 'its next stage'}. Solve puzzles while you build it.`;
}

/** A wildlife friend's card, with the once-a-day pat and feeding. */
export function showFriendSheet(scope: Scope, id: CompanionId, ev: FeedEvents = {}): void {
  const c = COMPANION_BY_ID[id];
  const owned = !!app.save.inventory.companions[id];
  const sh = openSheet(scope, {
    title: owned ? `${c.name} the ${c.kind.toLowerCase()}` : `A ${c.kind.toLowerCase()} (arriving soon)`,
    className: 'pet-sheet',
    body: `
      <div class="pet-sheet__hero">${friendPortrait(id, !owned)}</div>
      <p class="pet-sheet__trait">${esc(owned ? c.trait : c.sanctuary === 'harmony' ? 'Someone is watching the garden from the hedge.' : `Someone is waiting for a home in the ${SANCTUARY_BY_ID[c.sanctuary].place}.`)}</p>
      <p class="sheet__lead">${esc(owned ? c.bio : arrivalText(id))}</p>
      ${
        owned
          ? `<dl class="pet-sheet__facts">
              <div><dt>Lives</dt><dd>${esc(habitatLabel(id))}</dd></div>
              <div><dt>Kind</dt><dd>${esc(c.kind)} · Wildlife friend</dd></div>
            </dl>
            ${friendPanelMarkup(id, c.name)}
            <p class="muted">Pats and food are just for fun. They make friends happy and change nothing in your puzzles.</p>`
          : ''
      }`,
  });
  if (owned) bindFriendPanel(sh.scope, sh.el, id, c.name, ev);
}

function habitatLabel(id: CompanionId): string {
  const c = COMPANION_BY_ID[id];
  if (c.sanctuary !== 'harmony') return `${SANCTUARY_BY_ID[c.sanctuary].name}, ${SANCTUARY_BY_ID[c.sanctuary].place}`;
  return c.habitat === 'woodland' ? 'By the woodland log' : 'In the blossom tree (when it is out)';
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
