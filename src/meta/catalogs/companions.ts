/**
 * Sanctuary companions: wildlife friends who live in the garden. They are deliberately a separate model from the
 * cat and dog residents (`PetId` / `PetSpecies`): they never appear on a puzzle board, never touch the solver's two
 * species, and give no gameplay advantage. Like residents, each arrives at a fixed Journey milestone (never random,
 * never purchasable), and the unlock is back-dated for players already past it.
 *
 * Only companions whose art is finished are listed here. Planned later: capybara, otter, axolotl, owl.
 */

import type { AnimalKind } from './foods';

export type CompanionId = 'ember' | 'maple';
export type Habitat = 'woodland' | 'treetop';

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  /** What kind of animal, for the card ("Fox"). */
  kind: string;
  /** Kind for food favorites. */
  animal: AnimalKind;
  trait: string;
  bio: string;
  habitat: Habitat;
  /** Journey level whose first clear welcomes this companion. */
  unlockLevel: number;
  /** Portrait tint (a region pastel). */
  tint: string;
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: 'ember',
    name: 'Ember',
    kind: 'Fox',
    animal: 'fox',
    trait: 'Shy at first, then your shadow',
    bio: 'A little fox who watched the garden from the hedge for weeks before trotting in. Ember curls up by the woodland log and keeps one ear on every puzzle you solve.',
    habitat: 'woodland',
    unlockLevel: 30,
    tint: 'var(--r3)',
  },
  {
    id: 'maple',
    name: 'Maple',
    kind: 'Red panda',
    animal: 'redpanda',
    trait: 'Sleepy, sunny and a little bit nosy',
    bio: 'Maple climbed into the blossom tree for a nap and decided to stay. From up there Maple can see every board you play, and approves of most of them.',
    habitat: 'treetop',
    unlockLevel: 45,
    tint: 'var(--r1)',
  },
] as const;

export const COMPANION_BY_ID: Record<CompanionId, CompanionDefinition> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c])) as Record<
  CompanionId,
  CompanionDefinition
>;

export function isCompanionId(x: unknown): x is CompanionId {
  return typeof x === 'string' && x in COMPANION_BY_ID;
}
