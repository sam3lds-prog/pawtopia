/**
 * Wildlife friends: animals who live in a sanctuary. They are deliberately a separate model from the cat and dog
 * residents (`PetId` / `PetSpecies`): they never appear on a puzzle board, never touch the solver's two species, and
 * give no gameplay advantage. Nothing here is random or for sale.
 *
 *  - Harmony friends (Ember, Maple) arrive at a Journey milestone, back-dated for players already past it.
 *  - Regional friends arrive as their sanctuary grows (a stage reached by solving puzzles while building it).
 */

import type { AnimalKind } from './foods';
import type { SanctuaryId } from './sanctuaries';

export type CompanionId =
  | 'ember'
  | 'maple'
  | 'gumnut'
  | 'skipper'
  | 'dozer'
  | 'zuri'
  | 'sunny'
  | 'tembo'
  | 'luna'
  | 'frost'
  | 'pebble'
  | 'rio'
  | 'mango'
  | 'pudding';
export type Habitat = 'woodland' | 'treetop' | 'ground' | 'water' | 'sky';

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
  sanctuary: SanctuaryId;
  /** Harmony friends: the Journey level whose first clear welcomes them. */
  unlockLevel?: number;
  /** Regional friends: the growth stage of their sanctuary that welcomes them. */
  stage?: number;
  /** Portrait tint. */
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
    sanctuary: 'harmony',
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
    sanctuary: 'harmony',
    unlockLevel: 45,
    tint: 'var(--r1)',
  },
  // Outback
  { id: 'gumnut', name: 'Gumnut', kind: 'Koala', animal: 'koala', trait: 'Sleeps twenty hours, dreams of leaves', bio: 'Gumnut chose the tallest gum tree and has barely moved since. Wakes up for eucalyptus, and for you.', habitat: 'treetop', sanctuary: 'outback', stage: 1, tint: '#E9E2D8' },
  { id: 'skipper', name: 'Skipper', kind: 'Kangaroo', animal: 'kangaroo', trait: 'Bouncy, nosy, always first to say hello', bio: 'Skipper hops a lap of the sanctuary every morning to check that everything is where it was yesterday.', habitat: 'ground', sanctuary: 'outback', stage: 2, tint: '#F3D9C4' },
  { id: 'dozer', name: 'Dozer', kind: 'Wombat', animal: 'wombat', trait: 'Stubborn, round and secretly very soft', bio: 'Dozer dug a burrow under the billabong bank in one afternoon and has been redecorating it ever since.', habitat: 'ground', sanctuary: 'outback', stage: 3, tint: '#E6DCCB' },
  // Savanna
  { id: 'zuri', name: 'Zuri', kind: 'Giraffe', animal: 'giraffe', trait: 'Graceful, curious, sees everything first', bio: 'Zuri can see the whole sanctuary from up there, and likes to tell everyone when you are on your way.', habitat: 'ground', sanctuary: 'savanna', stage: 1, tint: '#F6E3B8' },
  { id: 'sunny', name: 'Sunny', kind: 'Meerkat', animal: 'meerkat', trait: 'On guard duty, all day, every day', bio: 'Sunny stands on the lookout rock and keeps watch. Mostly for snacks.', habitat: 'ground', sanctuary: 'savanna', stage: 2, tint: '#F1DFC2' },
  { id: 'tembo', name: 'Tembo', kind: 'Elephant calf', animal: 'elephant', trait: 'Gentle, clumsy and full of joy', bio: 'Tembo spends the afternoons spraying water at the waterhole and the evenings pretending that was someone else.', habitat: 'water', sanctuary: 'savanna', stage: 3, tint: '#DDE3EA' },
  // Arctic
  { id: 'luna', name: 'Luna', kind: 'Snowy owl', animal: 'owl', trait: 'Quiet, wise, a little dramatic', bio: 'Luna arrived on the first snowdrift and watches the sky for the aurora, which she claims to have invented.', habitat: 'sky', sanctuary: 'arctic', stage: 1, tint: '#E8EEF4' },
  { id: 'frost', name: 'Frost', kind: 'Polar bear cub', animal: 'polarbear', trait: 'Big paws, bigger heart', bio: 'Frost tumbles down the snow den slope a hundred times a day and is never once tired of it.', habitat: 'ground', sanctuary: 'arctic', stage: 2, tint: '#EEF3F7' },
  { id: 'pebble', name: 'Pebble', kind: 'Seal pup', animal: 'seal', trait: 'Sleepy, smiley, a champion napper', bio: 'Pebble naps on the ice edge and wakes only for fish bites and belly rubs.', habitat: 'water', sanctuary: 'arctic', stage: 3, tint: '#DCE6EE' },
  // Amazon
  { id: 'rio', name: 'Rio', kind: 'Toucan', animal: 'toucan', trait: 'Loud, bright and very proud of that beak', bio: 'Rio announces every sunrise, every sunset, and every puzzle you solve, at full volume.', habitat: 'sky', sanctuary: 'amazon', stage: 1, tint: '#FFF0C9' },
  { id: 'mango', name: 'Mango', kind: 'Sloth', animal: 'sloth', trait: 'Takes it slow, and that is the point', bio: 'Mango hangs from the platform rail and moves about a tile a day. Says hello in about an hour.', habitat: 'treetop', sanctuary: 'amazon', stage: 2, tint: '#E8E0CC' },
  { id: 'pudding', name: 'Pudding', kind: 'Capybara', animal: 'capybara', trait: 'Everyone’s calmest friend', bio: 'Pudding sits on a lily pad at the river’s edge, and somehow everyone nearby feels calmer.', habitat: 'water', sanctuary: 'amazon', stage: 3, tint: '#EFDCC4' },
] as const;

export const COMPANION_BY_ID: Record<CompanionId, CompanionDefinition> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c])) as Record<
  CompanionId,
  CompanionDefinition
>;

export function isCompanionId(x: unknown): x is CompanionId {
  return typeof x === 'string' && x in COMPANION_BY_ID;
}

export function companionsOf(sanctuary: SanctuaryId): CompanionDefinition[] {
  return COMPANIONS.filter((c) => c.sanctuary === sanctuary);
}
