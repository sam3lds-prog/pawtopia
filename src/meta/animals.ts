/**
 * Every animal in one place (D35): the six cat and dog residents (`PetId`) and every other friend (`CompanionId`).
 * The two catalogs keep their own shapes (residents have personality rigs; friends have kinds and habitats); this is
 * the common view the world, the boards and the cards use: who an animal is, where it lives, whether it's home yet,
 * and who arrives next.
 */

import type { SaveV2 } from '../services/storage';
import { COMPANION_BY_ID, isCompanionId, type CompanionId } from './catalogs/companions';
import type { AnimalKind } from './catalogs/foods';
import { PET_BY_ID, isPetId, type PetId } from './catalogs/pets';
import { SANCTUARY_BY_ID, arrivalOf, homeOf, type AnimalId, type Arrival, type SanctuaryId } from './catalogs/sanctuaries';

export type { AnimalId } from './catalogs/sanctuaries';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  /** What kind of animal, capitalized for cards ("Goat kid"). */
  kind: string;
  /** The kind as a plain noun for sentences ("goat kid"). */
  noun: string;
  /** For food favorites. */
  animal: AnimalKind;
  trait: string;
  bio: string;
  sanctuary: SanctuaryId;
  /** A cat or dog resident (with a personality face rig). */
  resident: boolean;
}

export function isAnimalId(x: unknown): x is AnimalId {
  return isPetId(x) || isCompanionId(x);
}

export function animalInfo(id: AnimalId): AnimalInfo {
  if (isPetId(id)) {
    const p = PET_BY_ID[id];
    const kind = p.species === 'cat' ? 'Cat' : 'Dog';
    return { id, name: p.name, kind, noun: kind.toLowerCase(), animal: p.species, trait: p.trait, bio: p.bio, sanctuary: 'harmony', resident: true };
  }
  const c = COMPANION_BY_ID[id as CompanionId];
  return { id, name: c.name, kind: c.kind, noun: c.kind.toLowerCase(), animal: c.animal, trait: c.trait, bio: c.bio, sanctuary: c.sanctuary, resident: false };
}

/** "sheep", "piglets", "calves", "ponies", "foxes": the plural of an animal noun. */
export function pluralNoun(noun: string): string {
  if (/sheep$/i.test(noun)) return noun;
  if (/calf$/i.test(noun)) return noun.replace(/calf$/i, 'calves');
  if (/[^aeiou]y$/i.test(noun)) return noun.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(noun)) return noun + 'es';
  return noun + 's';
}

/** "a sheep", "an elephant calf". */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

export function isHome(save: Pick<SaveV2, 'inventory'>, id: AnimalId): boolean {
  return isPetId(id) ? !!save.inventory.pets[id] : !!save.inventory.companions[id as CompanionId];
}

/** When the animal moved in (ISO), or null. */
export function homeSince(save: Pick<SaveV2, 'inventory'>, id: AnimalId): string | null {
  const e = isPetId(id) ? save.inventory.pets[id] : save.inventory.companions[id as CompanionId];
  return e?.unlockedAt ?? null;
}

/** Records an arrival. Idempotent: returns false when the animal was already home. */
export function welcomeAnimal(save: Pick<SaveV2, 'inventory'>, id: AnimalId, now = new Date()): boolean {
  if (isHome(save, id)) return false;
  if (isPetId(id)) save.inventory.pets[id as PetId] = { unlockedAt: now.toISOString() };
  else save.inventory.companions[id as CompanionId] = { unlockedAt: now.toISOString() };
  return true;
}

/** A sanctuary's animals in arrival order. */
export function animalsOf(sanctuary: SanctuaryId): AnimalId[] {
  return SANCTUARY_BY_ID[sanctuary].arrivals.map((a) => a.id);
}

/** Animals already living in a sanctuary, in arrival order. */
export function homeAnimals(save: Pick<SaveV2, 'inventory'>, sanctuary: SanctuaryId): AnimalId[] {
  return animalsOf(sanctuary).filter((id) => isHome(save, id));
}

/** Every animal that has moved in anywhere, sanctuary by sanctuary. */
export function allHomeAnimals(save: Pick<SaveV2, 'inventory'>): AnimalId[] {
  return (Object.keys(SANCTUARY_BY_ID) as SanctuaryId[]).flatMap((s) => homeAnimals(save, s));
}

/** The next animal still to arrive in a sanctuary (the one boards show while you build it), or null when all are home. */
export function nextArrivalIn(save: Pick<SaveV2, 'inventory'>, sanctuary: SanctuaryId): Arrival | null {
  return SANCTUARY_BY_ID[sanctuary].arrivals.find((a) => !isHome(save, a.id)) ?? null;
}

export { arrivalOf, homeOf };
