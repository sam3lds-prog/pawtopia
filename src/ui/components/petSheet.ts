/** Resident detail sheet and portrait helpers, shared by the Pets tab and the sanctuary. */

import { app } from '../../app/app';
import { PET_BY_ID, type PetId } from '../../meta/catalogs/pets';
import { petSvg } from '../art/pets';
import type { FaceMood } from '../animation/faceMachine';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet } from './sheet';
import { patFriend, pattedToday } from '../../meta/sanctuary';

/** Soft region pastel behind each resident's portrait. */
export const PET_TINT: Record<PetId, string> = { mochi: 'var(--r5)', pip: 'var(--r2)', clover: 'var(--r1)', biscuit: 'var(--r3)', nori: 'var(--r0)', peanut: 'var(--r4)' };

export function portrait(id: PetId, mood: FaceMood = 'idle', locked = false): string {
  return `<span class="portrait${locked ? ' is-locked' : ''}" style="--tint:${PET_TINT[id]}">${petSvg(id, { mood })}</span>`;
}

export function movedInDate(id: PetId): string | null {
  const at = app.save.inventory.pets[id]?.unlockedAt;
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function showPetSheet(scope: Scope, id: PetId, opts: { onChange?: () => void; showVisit?: boolean } = {}): void {
  const p = PET_BY_ID[id];
  const owned = !!app.save.inventory.pets[id];
  const fav = !!app.save.inventory.favorites[id];
  const date = movedInDate(id);
  const patted = pattedToday(app.save, id);
  const sh = openSheet(scope, {
    title: owned ? p.name : `${p.name} (arriving soon)`,
    className: 'pet-sheet',
    body: `
      <div class="pet-sheet__hero">${portrait(id, owned ? 'happy' : 'idle', !owned)}</div>
      <p class="pet-sheet__trait">${esc(p.trait)}</p>
      ${owned ? `<p class="sheet__lead">${esc(p.bio)}</p>` : `<p class="sheet__lead">${esc(p.name)} moves in when you first clear level ${p.unlockLevel}.</p>`}
      ${
        owned
          ? `<div class="pet-sheet__faces" aria-label="Expressions">
              ${(['idle', 'curious', 'happy', 'proud', 'sleepy'] as const).map((m) => `<span class="pet-sheet__face" title="${m}">${petSvg(id, { mood: m })}</span>`).join('')}
            </div>
            <dl class="pet-sheet__facts">
              <div><dt>Signature</dt><dd>${esc(p.signature)}</dd></div>
              <div><dt>Moved in</dt><dd>${esc(date ?? 'Today')}</dd></div>
              <div><dt>Kind</dt><dd>${p.species === 'cat' ? 'Cat' : 'Dog'} · ${p.rarity === 'founding' ? 'Founding resident' : p.rarity === 'rare' ? 'Rare neighbor' : 'Neighbor'}</dd></div>
              <div><dt>Affection</dt><dd><span class="affection" data-affection>${ICON.heart}<span class="num">${app.save.sanctuary.affection[id] ?? 0}</span></span></dd></div>
            </dl>`
          : ''
      }
      <div class="sheet__actions">
        ${owned ? `<button class="btn btn--secondary btn--block" data-act="pat" ${patted ? 'disabled' : ''}>${ICON.heart}${patted ? 'Patted today' : `Give ${esc(p.name)} a pat`}</button>` : ''}
        ${owned ? `<button class="btn btn--quiet btn--block" data-act="fav" aria-pressed="${fav}">${fav ? ICON.heart : ICON.heartOff}<span>${fav ? 'Favorite' : 'Add to favorites'}</span></button>` : ''}
        ${owned && opts.showVisit !== false ? `<button class="btn btn--quiet" data-act="visit">See ${esc(p.name)} in the sanctuary</button>` : ''}
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    if (t.dataset.act === 'pat') {
      if ((t as HTMLButtonElement).disabled || !patFriend(app.save, id)) return;
      app.persist();
      (t as HTMLButtonElement).disabled = true;
      t.innerHTML = `${ICON.heart}Patted today`;
      const a = sh.el.querySelector('[data-affection] .num');
      if (a) a.textContent = String(app.save.sanctuary.affection[id] ?? 0);
      return;
    }
    if (t.dataset.act === 'fav') {
      const now = !app.save.inventory.favorites[id];
      if (now) app.save.inventory.favorites[id] = true;
      else delete app.save.inventory.favorites[id];
      app.persist();
      t.setAttribute('aria-pressed', String(now));
      t.innerHTML = `${now ? ICON.heart : ICON.heartOff}<span>${now ? 'Favorite' : 'Add to favorites'}</span>`;
      opts.onChange?.();
    } else if (t.dataset.act === 'visit') {
      sh.close();
      app.router.go({ screen: 'sanctuary' });
    }
  });
}
