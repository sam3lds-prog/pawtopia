/** Temporary screens for tabs that later sprints fill in. */

import { h } from '../dom';
import type { ScreenDef, TabId } from '../router';

function simple(tab: TabId | null, title: string, text: string): ScreenDef {
  return {
    tab,
    title,
    mount(root) {
      root.appendChild(h(`<div><header class="screen-head"><h1 data-autofocus>${title}</h1></header><p class="empty">${text}</p></div>`));
    },
  };
}

export const petsPlaceholder = simple('pets', 'Pets', 'Your residents will live here.');
export const leaguePlaceholder = simple('league', 'League', 'Paw Cup is on its way.');
export const shopPlaceholder = simple('shop', 'Shop', 'Decorations and keepsakes are on their way.');
export const sanctuaryPlaceholder = simple('home', 'Sanctuary', 'The sanctuary is being built.');
