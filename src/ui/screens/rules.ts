/** How to play: three rules, each with a tiny diagram. Kept short on purpose. */

import { CAT, DOG } from '../../engine/types';
import { toolPetSvg } from '../art/petTiles';
import { openSheet } from '../components/sheet';
import { ICON } from '../icons';
import type { Scope } from '../router';

function diagram(cells: Array<'cat' | 'dog' | ''>, regions: number[], verdict: 'ok' | 'no' | null): string {
  const tiles = cells
    .map((v, i) => `<i style="--rc:var(--r${regions[i]})">${v === 'cat' ? toolPetSvg(CAT) : v === 'dog' ? toolPetSvg(DOG) : ''}</i>`)
    .join('');
  const mark = verdict === 'ok' ? `<b class="rule-fig__ok">${ICON.check}</b>` : verdict === 'no' ? `<b class="rule-fig__no">${ICON.close}</b>` : '';
  return `<div class="rule-fig" aria-hidden="true"><div class="rule-fig__grid">${tiles}</div>${mark}</div>`;
}

export function showRules(scope: Scope, onClose?: () => void): void {
  const sh = openSheet(scope, {
    title: 'How to play',
    onClose,
    body: `
      <ol class="rules">
        <li>
          ${diagram(['cat', '', 'dog', '', '', '', '', '', ''], [0, 0, 0, 1, 1, 1, 3, 3, 3], null)}
          <p><b>One cat and one dog</b> in every row, every column, and every color region.</p>
        </li>
        <li>
          ${diagram(['cat', '', '', '', 'dog', '', '', '', ''], [1, 1, 1, 1, 1, 1, 1, 1, 1], 'ok')}
          ${diagram(['cat', 'dog', '', '', '', '', '', '', ''], [4, 4, 4, 4, 4, 4, 4, 4, 4], 'no')}
          <p>Pets never sit <b>side by side</b>. Diagonal neighbors are fine.</p>
        </li>
        <li>
          <span class="rules__icon">${ICON.lock}</span>
          <p>Locked pets are already home. Mark tiles you've ruled out with <b>Empty</b>. Every board has one answer you can reach by logic alone.</p>
        </li>
      </ol>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Got it</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="ok"]')) sh.close();
  });
}
