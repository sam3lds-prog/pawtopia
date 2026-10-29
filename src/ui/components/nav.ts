/** Bottom navigation: Play | Home | World | League | Shop. Hidden during focused play. */

import { h } from '../dom';
import { ICON } from '../icons';
import type { Router, TabId } from '../router';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'play', label: 'Play', icon: ICON.play },
  { id: 'home', label: 'Home', icon: ICON.home },
  { id: 'world', label: 'World', icon: ICON.globe },
  { id: 'league', label: 'League', icon: ICON.trophy },
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
    if (router.route?.screen === tab) return;
    router.go({ screen: tab } as never);
  });
  router.onChange((_route, def) => {
    document.body.dataset.nav = def.tab ? 'on' : 'off';
    for (const b of nav.querySelectorAll<HTMLElement>('[data-tab]')) {
      if (b.dataset.tab === def.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    document.title = def.title === 'Pawtopia' ? 'Pawtopia' : `${def.title} · Pawtopia`;
  });
}
