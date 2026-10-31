/**
 * How to play (D35), for whichever rule the board uses, drawn with the board's own animals. Three short rules, each with
 * a tiny diagram, and the controls in one line. Kept short on purpose.
 */

import { app } from '../../app/app';
import type { Rule } from '../../engine/types';
import { playsSolo } from '../../game/modes';
import type { AnimalId } from '../../meta/animals';
import { pluralNoun, withArticle } from '../../meta/animals';
import { castFor, castWord, type Cast } from '../../meta/cast';
import { animalSvg } from '../art/animals';
import { openSheet } from '../components/sheet';
import { capitalize, esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';

type Tile = 'a' | 'b' | 'x' | '';

function diagram(cells: Tile[], regions: number[], verdict: 'ok' | 'no' | null, a: AnimalId, b: AnimalId | undefined): string {
  const tiles = cells
    .map(
      (v, i) =>
        `<i style="--rc:var(--r${regions[i]})">${v === 'a' ? animalSvg(a) : v === 'b' && b ? animalSvg(b) : v === 'x' ? `<span class="rule-fig__x">${ICON.mark}</span>` : ''}</i>`,
    )
    .join('');
  const mark = verdict === 'ok' ? `<b class="rule-fig__ok">${ICON.check}</b>` : verdict === 'no' ? `<b class="rule-fig__no">${ICON.close}</b>` : '';
  return `<div class="rule-fig" aria-hidden="true"><div class="rule-fig__grid">${tiles}</div>${mark}</div>`;
}

export interface RulesOptions {
  rule: Rule;
  cast: Cast;
  /** Level 21's bridge: the same two-animal rules, framed as what changes from here, before the guided lesson. */
  bridge?: boolean;
}

/** The controls, in one sentence, for the scheme in Settings. */
export function controlsLine(rule: Rule, animalWord: string): string {
  const what = rule === 'solo' ? withArticle(animalWord) : 'the animal you picked below the board';
  switch (app.settings.controls) {
    case 'classic':
      return `<b>Tap</b> a tile once to mark it ✕, again to place ${esc(what)}, and once more to clear it.`;
    case 'tap':
      return `<b>Tap</b> a tile to mark it ✕. <b>Double-tap</b> to place ${esc(what)}. No quick double tap? Settings → Controls.`;
    default:
      return `<b>Tap</b> a tile to place ${esc(what)}. The <b>✕</b> tool marks tiles empty (drag across a few); <b>Erase</b> takes a tile back.`;
  }
}

/** The rule the player is on now (one animal until the two-animal lesson), with the animals their boards show. */
export function currentRules(): RulesOptions {
  const rule: Rule = playsSolo(app.save.journey.nextLevel) ? 'solo' : 'pair';
  return { rule, cast: castFor(app.save, rule, 1) };
}

export function showRules(scope: Scope, onClose?: () => void, o: RulesOptions = currentRules()): void {
  const { rule, cast, bridge } = o;
  const a = cast.a;
  const b = cast.b ?? (cast.a === 'truffle' ? 'cotton' : 'truffle');
  const wa = castWord(cast, 'a');
  const wb = cast.b ? castWord(cast, 'b') : 'piglet';
  const items =
    rule === 'solo'
      ? `
        <li>
          ${diagram(['a', '', '', '', '', '', '', '', ''], [0, 0, 0, 1, 1, 1, 3, 3, 3], null, a, undefined)}
          <p><b>One ${esc(wa)}</b> in every row, every column, and every color.</p>
        </li>
        <li>
          ${diagram(['a', '', '', '', '', 'a', '', '', ''], [1, 1, 4, 1, 4, 4, 1, 4, 4], 'ok', a, undefined)}
          ${diagram(['a', '', '', '', 'a', '', '', '', ''], [4, 4, 1, 4, 1, 1, 4, 1, 1], 'no', a, undefined)}
          <p>${esc(capitalize(pluralNoun(wa)))} never <b>touch</b>, not even at a corner.</p>
        </li>`
      : `
        <li>
          ${diagram(['a', '', 'b', '', '', '', '', '', ''], [0, 0, 0, 1, 1, 1, 3, 3, 3], null, a, b)}
          <p><b>One ${esc(wa)} and one ${esc(wb)}</b> in every row, every column, and every color.</p>
        </li>
        <li>
          ${diagram(['a', '', '', '', 'b', '', '', '', ''], [1, 1, 1, 1, 1, 1, 1, 1, 1], 'ok', a, b)}
          ${diagram(['a', 'b', '', '', '', '', '', '', ''], [4, 4, 4, 4, 4, 4, 4, 4, 4], 'no', a, b)}
          <p>${esc(capitalize(withArticle(wa)))} and ${esc(withArticle(wb))} never sit <b>side by side</b>. Diagonal neighbors are fine.</p>
        </li>`;
  const sh = openSheet(scope, {
    title: bridge ? 'A second animal joins' : 'How to play',
    onClose,
    className: bridge ? 'rules-bridge' : '',
    body: `
      ${bridge ? `<p class="sheet__lead">From here every board has two animals. Twenty levels of ${esc(pluralNoun(wa))} taught you the lines; the same logic finds both.</p>` : ''}
      <ol class="rules">
        ${items}
        <li>
          <span class="rules__icon">${ICON.mark}</span>
          <p>${controlsLine(rule, wa)} A wrong guess costs a heart. Every board has one answer you can reach by logic alone.</p>
        </li>
      </ol>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">${bridge ? 'Show me' : 'Got it'}</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="ok"]')) sh.close();
  });
}
