/** Food and treat icons (24×24, colored, drawn in code). Decorative; cards carry the names. */

import { FOOD_BY_ID, type FoodId } from '../../meta/catalogs/foods';

const OUT = 'rgba(40,52,52,0.35)';

function shape(id: FoodId): string {
  const { a, b, shape } = FOOD_BY_ID[id].art;
  switch (shape) {
    case 'kibble':
      return `<path d="M3.5 13.5h17c0 3.9-3.8 6.6-8.5 6.6s-8.5-2.7-8.5-6.6Z" fill="#E8DCC7" stroke="${OUT}" stroke-width=".8"/>
        ${[
          [8, 11],
          [12, 9.6],
          [16, 11],
          [10, 13],
          [14, 12.8],
        ]
          .map(([x, y]) => `<path d="M${x} ${y - 2.2}l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="${a}" stroke="${b}" stroke-width=".5"/>`)
          .join('')}`;
    case 'fish':
      return `<path d="M3.5 12c2.5-4 8-5 12-2l3.5-2.5v9L15.5 14c-4 3-9.5 2-12-2Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <circle cx="7.5" cy="11.2" r="1" fill="#2F2A27"/><path d="M11 9.5c.8 1.5.8 3.5 0 5" stroke="#fff" stroke-width=".9" fill="none" opacity=".7"/>`;
    case 'berries':
      return `<circle cx="8.5" cy="13.5" r="3.4" fill="${a}"/><circle cx="14" cy="15" r="3.6" fill="${b}"/><circle cx="12.6" cy="9.4" r="3" fill="${a}"/>
        <circle cx="13.2" cy="14" r=".7" fill="#fff" opacity=".7"/><circle cx="7.6" cy="12.6" r=".6" fill="#fff" opacity=".7"/>
        <path d="M12.6 6.4c.5-1.6 1.8-2.4 3.4-2.4" stroke="#5E9C5A" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    case 'leaf':
      return `<path d="M5 18C5 10 10 5 19.5 4.5 19 13.5 14 19 6.5 19Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M6 18c3.5-4.5 7-8 11-11" stroke="${b}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    case 'fruit':
      return `<path d="M3.5 13.5h17c0 3.9-3.8 6.6-8.5 6.6s-8.5-2.7-8.5-6.6Z" fill="#F4EEE2" stroke="${OUT}" stroke-width=".8"/>
        <path d="M6 12.5c1-3 4-4.5 6-3.5-1.5 1-2.5 2.5-3 4Z" fill="${a}" stroke="#C9A12E" stroke-width=".7"/>
        <circle cx="13.6" cy="11.4" r="2.6" fill="${b}"/><path d="M15.5 13.4c.4-2.2 2-3.4 3.6-3.2-.2 1.6-1.4 3-3.6 3.2Z" fill="#8CCB7A"/>`;
    case 'sprig':
      return `<path d="M12 21V5" stroke="${b}" stroke-width="1.4" stroke-linecap="round"/>
        ${[7, 10.5, 14]
          .map((y, i) => `<ellipse cx="${i % 2 ? 15.5 : 8.5}" cy="${y}" rx="3.6" ry="2" fill="${a}" stroke="${b}" stroke-width=".8" transform="rotate(${i % 2 ? -25 : 25} ${i % 2 ? 15.5 : 8.5} ${y})"/>`)
          .join('')}
        <ellipse cx="15.5" cy="17.5" rx="3.6" ry="2" fill="${a}" stroke="${b}" stroke-width=".8" transform="rotate(-25 15.5 17.5)"/>`;
    case 'bamboo':
      return `<rect x="7" y="4" width="4" height="17" rx="2" fill="${a}" stroke="${b}" stroke-width="1"/><rect x="13" y="7" width="4" height="14" rx="2" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M7 10h4M7 15h4M13 12h4M13 17h4" stroke="${b}" stroke-width="1"/><path d="M11 6c2-1.5 4-1.6 6-.8-1.6 1.4-3.6 1.6-6 .8Z" fill="#8CC25A"/>`;
    case 'cake':
      return `<path d="M4 13h16v6.2c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M4 13c1.6 1.8 3 1.8 4 0 1 1.8 2.4 1.8 4 0 1.6 1.8 3 1.8 4 0 1 1.8 2.4 1.8 4 0V11c0-1.4-1.1-2.5-2.5-2.5h-11C5.1 8.5 4 9.6 4 11Z" fill="#FFF3D9" stroke="${b}" stroke-width=".9"/>
        <path d="M9.5 8.5c0-2.4 2.5-2.4 2.5-4.5 0 2.1 2.5 2.1 2.5 4.5" fill="#F0A33A"/><circle cx="12" cy="3.4" r="1.1" fill="#F6D27A"/>`;
    case 'cone':
      return `<path d="M7 11h10l-5 10Z" fill="#E2B577" stroke="#B9864A" stroke-width="1"/><path d="M8.5 13.5l5.5 3M10.5 12.2l4.5 2.6M9 16l3 1.6" stroke="#C9955A" stroke-width=".7"/>
        <circle cx="10" cy="9.2" r="3.4" fill="${a}"/><circle cx="14.2" cy="9" r="3.2" fill="${b}"/><circle cx="12.2" cy="6" r="2.8" fill="#FFF3F6"/>
        <circle cx="12.6" cy="4" r=".9" fill="#E5546C"/>`;
    case 'cookie':
      return `<circle cx="12" cy="12" r="8.6" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M12 6.6l1.4 2.9 3.2.4-2.3 2.2.6 3.2L12 13.8l-2.9 1.5.6-3.2-2.3-2.2 3.2-.4Z" fill="#F6C24E" stroke="#C98A2E" stroke-width=".7"/>
        <g fill="#B98A5A"><circle cx="7.6" cy="15.6" r=".8"/><circle cx="16" cy="16.4" r=".8"/><circle cx="8" cy="9" r=".7"/></g>`;
  }
}

export function foodIcon(id: FoodId): string {
  return `<svg class="food-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape(id)}</svg>`;
}
