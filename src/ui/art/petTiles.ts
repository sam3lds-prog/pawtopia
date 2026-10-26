/** Pet art for board tiles. Sprint 1 uses the v1 glyphs; Sprint 2 replaces this with rigged faces. */

import { CAT, type Species } from '../../engine/types';
import { CAT_SVG, DOG_SVG } from '../../game/icons';

export function tilePet(species: Species): HTMLElement {
  const span = document.createElement('span');
  span.innerHTML = species === CAT ? CAT_SVG : DOG_SVG;
  return span;
}

export function toolPetSvg(species: Species): string {
  return species === CAT ? CAT_SVG : DOG_SVG;
}
