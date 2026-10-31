/**
 * Bottom navigation (D36): Journey | World | Challenges | Shop. Journey is where you play (the next level, Daily, Zen,
 * the level path); World is what the puzzles build; Challenges holds the Paw Cup and the leaderboard. Hidden during
 * focused play. A tab is a fresh start: tapping one forgets the trail Back was retracing.
 */

import { app } from '../../app/app';
import { unseenSanctuaries } from '../../meta/world';
import { h } from '../dom';
import { ICON } from '../icons';
import type { Router, TabId } from '../router';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'journey', label: 'Journey', icon: ICON.play },
  { id: 'world', label: 'World', icon: ICON.globe },
  { id: 'challenges', label: 'Challenges', icon: ICON.trophy },
  { id: 'shop', label: 'Shop', icon: ICON.bag },
];

export function mountNav(router: Router): void {
  const nav = h(`
    <nav class="nav" aria-label="Main">
      <div class="nav__inner">
        ${TABS.map((t) => `<button class="nav__item" data-tab="${t.id}">${t.icon}<span>${t.label}</span><span class="nav__dot" aria-hidden="true"></span></button>`).join('')}
      </div>
    </nav>`);
  document.body.appendChild(nav);
  nav.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!b) return;
    const tab = b.dataset.tab as TabId;
    // The tab you're on, tapped again: back to its own screen (from a sanctuary to the World map, say), scrolled to the top.
    router.reset({ screen: tab });
  });
  const world = nav.querySelector<HTMLElement>('[data-tab="world"]')!;
  /** A small dot on World while a sanctuary holds news the player hasn't visited. */
  const syncNews = () => {
    const n = unseenSanctuaries(app.save).length;
    world.classList.toggle('has-news', n > 0);
    world.setAttribute('aria-label', n ? `World, ${n === 1 ? 'something new' : `${n} new things`} to see` : 'World');
  };
  router.onChange((_route, def) => {
    document.body.dataset.nav = def.tab ? 'on' : 'off';
    for (const b of nav.querySelectorAll<HTMLElement>('[data-tab]')) {
      if (b.dataset.tab === def.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    document.title = def.title === 'Pawtopia' ? 'Pawtopia' : `${def.title} · Pawtopia`;
    syncNews();
  });
  app.onChange(syncNews);
  syncNews();
}
