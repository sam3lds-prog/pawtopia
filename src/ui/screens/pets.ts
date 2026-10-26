/** Pets: the resident collection. Portraits, personalities, who's still on the way, favorites and filters. */

import { app } from '../../app/app';
import { PETS, type PetId } from '../../meta/catalogs/pets';
import { nextPetMilestone, unlockedPets } from '../../meta/rewards';
import { portrait, showPetSheet } from '../components/petSheet';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { coinPill } from './home';

type Filter = 'all' | 'cat' | 'dog' | 'fav';
let lastFilter: Filter = 'all';

export const petsScreen: ScreenDef = {
  tab: 'pets',
  title: 'Pets',
  mount(root, scope) {
    const el = h(`<div class="pets"></div>`);
    root.appendChild(el);

    function render(): void {
      const save = app.save;
      const have = unlockedPets(save);
      const next = nextPetMilestone(save);
      const level = save.journey.nextLevel;
      const list = PETS.filter((p) => (lastFilter === 'all' ? true : lastFilter === 'fav' ? save.inventory.favorites[p.id] : p.species === lastFilter));
      const filters: Array<[Filter, string]> = [
        ['all', 'All'],
        ['cat', 'Cats'],
        ['dog', 'Dogs'],
        ['fav', 'Favorites'],
      ];
      el.innerHTML = `
        <header class="screen-head">
          <h1 data-autofocus>Residents</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <p class="muted pets__count">${have.length} of ${PETS.length} welcomed${next ? ` · next arrival at level ${next.level}` : ' · the whole family is home'}</p>
        ${
          next
            ? `<div class="next-arrival card">
                ${portrait(next.id, 'idle', true)}
                <div class="next-arrival__body">
                  <b>Someone new is on the way</b>
                  <span class="muted">Clear level ${next.level} to welcome them.</span>
                  <div class="progress" role="progressbar" aria-label="Progress to the next resident" aria-valuemin="0" aria-valuemax="${next.level}" aria-valuenow="${Math.min(level - 1, next.level)}"><span style="width:${Math.min(100, ((level - 1) / next.level) * 100)}%"></span></div>
                </div>
              </div>`
            : ''
        }
        <div class="segmented" role="tablist" aria-label="Filter residents">
          ${filters.map(([f, l]) => `<button role="tab" data-filter="${f}" aria-selected="${lastFilter === f}">${l}</button>`).join('')}
        </div>
        ${
          list.length
            ? `<ul class="pet-grid">${list
                .map((p) => {
                  const ownsIt = have.includes(p.id);
                  const fav = !!save.inventory.favorites[p.id];
                  return `<li><button class="pet-card card card--tap ${ownsIt ? '' : 'is-locked'}" data-pet="${p.id}" aria-label="${esc(ownsIt ? `${p.name}, ${p.trait}${fav ? ', favorite' : ''}` : `Locked resident, arrives at level ${p.unlockLevel}`)}">
                    ${fav ? `<span class="pet-card__fav" aria-hidden="true">${ICON.heart}</span>` : ''}
                    ${portrait(p.id, ownsIt ? 'happy' : 'idle', !ownsIt)}
                    <span class="pet-card__name">${ownsIt ? esc(p.name) : '???'}</span>
                    <span class="pet-card__trait">${ownsIt ? esc(p.trait) : `Arrives at level ${p.unlockLevel}`}</span>
                    <span class="chip">${p.species === 'cat' ? 'Cat' : 'Dog'}</span>
                  </button></li>`;
                })
                .join('')}</ul>`
            : `<p class="empty">${lastFilter === 'fav' ? 'Tap a resident and add them to your favorites.' : 'No residents here yet.'}</p>`
        }`;
    }
    render();

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const f = t.closest('[data-filter]') as HTMLElement | null;
      if (f) {
        lastFilter = f.dataset.filter as Filter;
        render();
        (el.querySelector(`[data-filter="${lastFilter}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const card = t.closest('[data-pet]') as HTMLElement | null;
      if (card) showPetSheet(scope, card.dataset.pet as PetId, { onChange: render });
    });
  },
};
