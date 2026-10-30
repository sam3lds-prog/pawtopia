/**
 * Which animals a board shows (D35). Purely cosmetic: the engine only knows a "first animal" (stored as CAT) and, on
 * two-animal boards, a "second animal" (DOG). The board shows the animal you're bringing home to the sanctuary you're
 * building; a two-animal board pairs it with one who already lives there (a different kind when possible, so the two
 * are easy to tell apart). Once everyone is home, boards show the sanctuary's animals in turn.
 *
 * A board keeps its cast for its whole life (it is saved with the board), so a resumed board looks the same.
 */

import { hashString } from '../engine/rng';
import type { Rule } from '../engine/types';
import type { SaveV2 } from '../services/storage';
import { SANCTUARY_BY_ID, type SanctuaryId } from './catalogs/sanctuaries';
import { allHomeAnimals, animalInfo, animalsOf, homeAnimals, isAnimalId, nextArrivalIn, type AnimalId } from './animals';
import { activeSanctuary } from './world';

export interface Cast {
  /** The board's first animal (CAT cells). */
  a: AnimalId;
  /** The second animal (DOG cells), on two-animal boards. */
  b?: AnimalId;
  /** The sanctuary the board is for. */
  sanctuary: SanctuaryId;
}

type CastSave = Pick<SaveV2, 'journey' | 'world' | 'inventory'>;

function pick<T>(list: T[], seed: number, salt: string): T {
  return list[hashString(`${seed}:${salt}`) % list.length];
}

export function castFor(save: CastSave, rule: Rule, seed: number): Cast {
  const where: SanctuaryId = activeSanctuary(save) ?? 'farm';
  const home = homeAnimals(save, where);
  const next = nextArrivalIn(save, where)?.id ?? null;
  const a = next ?? (home.length ? pick(home, seed, 'a') : animalsOf(where)[0]);
  if (rule === 'solo') return { a, sanctuary: where };
  const kind = (id: AnimalId) => animalInfo(id).animal;
  const partner = (pool: AnimalId[]): AnimalId | null => {
    const others = pool.filter((id) => id !== a);
    const different = others.filter((id) => kind(id) !== kind(a));
    return different.length ? pick(different, seed, 'b') : others.length ? pick(others, seed, 'b') : null;
  };
  const b =
    partner(home) ??
    partner(allHomeAnimals(save)) ??
    // Nobody is home anywhere yet: the next one in line (or the Farm's first friends) keep it company.
    animalsOf(where).find((id) => id !== a && kind(id) !== kind(a)) ??
    (a === 'cotton' ? 'truffle' : 'cotton');
  return { a, b, sanctuary: where };
}

/** A saved cast, if it is still a valid cast for this rule. */
export function parseCast(x: unknown, rule: Rule): Cast | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!isAnimalId(o.a) || !(typeof o.sanctuary === 'string' && o.sanctuary in SANCTUARY_BY_ID)) return null;
  if (rule === 'pair' && (!isAnimalId(o.b) || o.b === o.a)) return null;
  return { a: o.a, ...(rule === 'pair' ? { b: o.b as AnimalId } : {}), sanctuary: o.sanctuary as SanctuaryId };
}

/** The name a board uses for one of its animals in coaching and hints: the kind, or the name when both are one kind. */
export function castWord(cast: Cast, which: 'a' | 'b'): string {
  const id = which === 'a' ? cast.a : (cast.b ?? cast.a);
  const me = animalInfo(id);
  if (!cast.b) return me.noun;
  const other = animalInfo(which === 'a' ? cast.b : cast.a);
  return me.noun === other.noun ? me.name : me.noun;
}
