/** The player's currencies as compact pills: Paw Coins alone, or all three (Paw Coins, video tokens, gems). */

import { app } from '../../app/app';
import { itemBalance } from '../../meta/items';
import { ICON } from '../icons';

export function coinPill(): string {
  return `<span class="coin-pill" data-coins aria-label="${app.coins()} Paw Coins">${ICON.coin}<span>${app.coins()}</span></span>`;
}

export function walletPills(): string {
  const coins = app.coins();
  const tokens = itemBalance(app.save, 'vtoken');
  const gems = itemBalance(app.save, 'gem');
  return `<span class="wallet" role="group" aria-label="${coins} Paw Coins, ${tokens} video tokens, ${gems} gems">
    <span class="coin-pill wallet__pill" data-coins>${ICON.coin}<span class="num">${coins}</span></span>
    <span class="coin-pill wallet__pill wallet__pill--small">${ICON.videoToken}<span class="num">${tokens}</span></span>
    <span class="coin-pill wallet__pill wallet__pill--small">${ICON.gem}<span class="num">${gems}</span></span>
  </span>`;
}
