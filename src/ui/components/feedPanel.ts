/**
 * The friendship panel on a resident's or wildlife friend's card: friendship level, today's pat, and feeding from the
 * pantry. Cosmetic only (D27).
 */

import { app } from '../../app/app';
import { FOODS, FOOD_BY_ID, isFavorite, type FoodId } from '../../meta/catalogs/foods';
import { animalKindOf, feedAnimal, foodCount, fedToday, FOOD_AFFECTION_PER_DAY, friendship } from '../../meta/feeding';
import { patFriend, pattedToday } from '../../meta/sanctuary';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { foodIcon } from '../art/foods';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { toast } from './sheet';

export interface FeedEvents {
  /** The animal just ate (for a happy reaction in the garden). */
  onFed?: (food: FoodId, favorite: boolean) => void;
  onPat?: () => void;
}

export function friendPanelMarkup(animal: string, name: string): string {
  const aff = app.save.sanctuary.affection[animal] ?? 0;
  const f = friendship(aff);
  const pct = f.next === null ? 100 : Math.round(((aff - f.from) / (f.next - f.from)) * 100);
  const kind = animalKindOf(animal);
  const owned = FOODS.filter((x) => foodCount(app.save, x.id) > 0);
  const full = fedToday(app.save, animal) >= FOOD_AFFECTION_PER_DAY;
  const patted = pattedToday(app.save, animal);
  return `<div class="friend-panel" data-friend-panel="${esc(animal)}">
    <div class="friend-panel__level">
      <span class="affection">${ICON.heart}<span class="num">${aff}</span></span>
      <span class="friend-panel__name"><b>${esc(f.name)}</b>${f.next !== null ? `<small>${f.next - aff} hearts to the next level</small>` : '<small>As close as can be</small>'}</span>
    </div>
    <span class="rank-bar" role="progressbar" aria-label="${esc(name)} friendship" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
    <button class="btn btn--secondary btn--block" data-act="pat" ${patted ? 'disabled' : ''}>${ICON.heart}${patted ? 'Patted today' : `Give ${esc(name)} a pat`}</button>
    <div class="friend-panel__feed">
      <b class="friend-panel__title">Feed ${esc(name)}</b>
      ${
        full
          ? `<p class="muted">${esc(name)} has had plenty today. Come back tomorrow.</p>`
          : owned.length
            ? `<ul class="feed-row">${owned
                .map((x) => {
                  const fav = kind ? isFavorite(x, kind) : false;
                  return `<li><button class="feed-btn ${fav ? 'is-fav' : ''}" data-feed="${x.id}" aria-label="${esc(`Give ${x.name}${fav ? ', a favorite' : ''}. ${foodCount(app.save, x.id)} left`)}">${foodIcon(x.id)}<span class="num">${foodCount(app.save, x.id)}</span>${fav ? `<i class="feed-btn__fav" aria-hidden="true">${ICON.star}</i>` : ''}</button></li>`;
                })
                .join('')}</ul>`
            : `<p class="muted">Your pantry is empty. Food and special treats are in the Shop.</p>`
      }
    </div>
  </div>`;
}

/** Wires pat and feed buttons inside a sheet. Re-renders the panel in place after each action. */
export function bindFriendPanel(scope: Scope, root: HTMLElement, animal: string, name: string, ev: FeedEvents = {}): void {
  const rerender = () => {
    const p = root.querySelector('[data-friend-panel]');
    if (p) p.outerHTML = friendPanelMarkup(animal, name);
  };
  scope.on(root, 'click', (e) => {
    const t = e.target as HTMLElement;
    const pat = t.closest('[data-act="pat"]') as HTMLButtonElement | null;
    if (pat && !pat.disabled) {
      if (patFriend(app.save, animal)) {
        app.persist();
        sfx('coin');
        haptic('tap');
        ev.onPat?.();
        rerender();
      }
      return;
    }
    const fb = t.closest('[data-feed]') as HTMLElement | null;
    if (!fb) return;
    const food = fb.dataset.feed as FoodId;
    const r = feedAnimal(app.save, animal, food);
    if (r.ok) {
      app.persist();
      sfx('unit');
      haptic('success');
      track('animal_fed', { food, favorite: r.favorite });
      toast(`${name} ${r.favorite ? 'loved' : 'enjoyed'} the ${FOOD_BY_ID[food].name}! +${r.gained}`, ICON.heart);
      ev.onFed?.(food, r.favorite);
    } else toast(r.reason === 'full' ? `${name} has had plenty today.` : 'None left in your pantry.');
    rerender();
  });
}
