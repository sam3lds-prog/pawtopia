import type { SanctuaryId } from './sanctuaries';

/**
 * Sanctuary food and treats. Each sanctuary has its own (the Farm's hay, apples and corn; D35), bought with Paw Coins
 * (everyday food) or video tokens (special treats), kept in the pantry, and given to animals from their cards. Feeding only adds affection and makes the
 * animal happy; it never changes puzzles, rankings or anything that can be won.
 *
 * Every animal has favorites (shown on the food card); a favorite counts double. Special treats are loved by everyone.
 */

export type FoodId =
  | 'hay'
  | 'carrots'
  | 'corn'
  | 'apples'
  | 'kibble'
  | 'fishbites'
  | 'berries'
  | 'greens'
  | 'fruit'
  | 'eucalyptus'
  | 'bamboo'
  | 'acacia'
  | 'honeycake'
  | 'snowcone'
  | 'starcookie';

/** What kind of animal it is, for food favorites. Residents are `cat` / `dog`; companions use their own kind. */
export type AnimalKind =
  | 'cat'
  | 'dog'
  | 'fox'
  | 'redpanda'
  | 'koala'
  | 'kangaroo'
  | 'wombat'
  | 'elephant'
  | 'giraffe'
  | 'meerkat'
  | 'polarbear'
  | 'seal'
  | 'owl'
  | 'sloth'
  | 'capybara'
  | 'toucan'
  | 'sheep'
  | 'pig'
  | 'cow'
  | 'goat'
  | 'chicken'
  | 'horse'
  | 'rabbit';

export interface FoodDefinition {
  id: FoodId;
  name: string;
  blurb: string;
  /** Where it is sold (each sanctuary has its own treats); special treats are sold everywhere. */
  sanctuary: SanctuaryId | 'all';
  /** Exactly one price: Paw Coins or video tokens. */
  coins?: number;
  tokens?: number;
  /** Kinds that love it. `all` for special treats. */
  favorites: AnimalKind[] | 'all';
  /** Affection it gives (doubled for a favorite, except special treats which are already generous). */
  affection: number;
  /** Colors for the drawn icon. */
  art: {
    a: string;
    b: string;
    shape: 'kibble' | 'fish' | 'berries' | 'leaf' | 'fruit' | 'sprig' | 'bamboo' | 'cake' | 'cone' | 'cookie' | 'hay' | 'carrot' | 'corn' | 'apple';
  };
}

export const FOODS: readonly FoodDefinition[] = [
  // Meadow Farm
  {
    id: 'hay',
    sanctuary: 'farm',
    name: 'Sweet Hay',
    blurb: 'A soft armful of summer hay that smells like sunshine.',
    coins: 10,
    favorites: ['sheep', 'cow', 'horse', 'goat'],
    affection: 1,
    art: { a: '#EBCB72', b: '#C9A04A', shape: 'hay' },
  },
  {
    id: 'apples',
    sanctuary: 'farm',
    name: 'Apple Slices',
    blurb: 'Crisp red apples from the orchard, cut into crescents.',
    coins: 14,
    favorites: ['horse', 'pig', 'goat'],
    affection: 1,
    art: { a: '#E5546C', b: '#F6E9C8', shape: 'apple' },
  },
  {
    id: 'corn',
    sanctuary: 'farm',
    name: 'Corn Kernels',
    blurb: 'A scoop of golden corn. Every chick in the county comes running.',
    coins: 10,
    favorites: ['chicken', 'pig'],
    affection: 1,
    art: { a: '#F6C84E', b: '#8CC25A', shape: 'corn' },
  },
  // Pet Garden
  {
    id: 'carrots',
    sanctuary: 'harmony',
    name: 'Carrot Bunch',
    blurb: 'Sweet little carrots, still with their feathery tops.',
    coins: 12,
    favorites: ['rabbit', 'horse'],
    affection: 1,
    art: { a: '#F08A3C', b: '#6FAF4E', shape: 'carrot' },
  },
  {
    id: 'kibble',
    sanctuary: 'harmony',
    name: 'Crunchy Kibble',
    blurb: 'Little stars of oven-baked crunch.',
    coins: 12,
    favorites: ['dog'],
    affection: 1,
    art: { a: '#C98A4E', b: '#A86A32', shape: 'kibble' },
  },
  {
    id: 'fishbites',
    sanctuary: 'harmony',
    name: 'Fish Bites',
    blurb: 'Tiny fish-shaped nibbles, still smelling of the sea.',
    coins: 12,
    favorites: ['cat', 'seal', 'polarbear', 'owl'],
    affection: 1,
    art: { a: '#8FC3E6', b: '#5C95BF', shape: 'fish' },
  },
  {
    id: 'berries',
    sanctuary: 'harmony',
    name: 'Berry Mix',
    blurb: 'Blueberries, raspberries and one cheeky strawberry.',
    coins: 15,
    favorites: ['fox', 'redpanda', 'toucan'],
    affection: 1,
    art: { a: '#6E78D8', b: '#E5546C', shape: 'berries' },
  },
  {
    id: 'greens',
    sanctuary: 'amazon',
    name: 'Garden Greens',
    blurb: 'Crisp lettuce, clover and dandelion leaves.',
    coins: 15,
    favorites: ['capybara', 'sloth', 'kangaroo', 'wombat', 'rabbit'],
    affection: 1,
    art: { a: '#7DC07A', b: '#4E9A55', shape: 'leaf' },
  },
  {
    id: 'fruit',
    sanctuary: 'savanna',
    name: 'Fruit Platter',
    blurb: 'Banana, mango and melon, cut into friendly pieces.',
    coins: 20,
    favorites: ['elephant', 'toucan', 'meerkat'],
    affection: 1,
    art: { a: '#F5C84E', b: '#F08A4B', shape: 'fruit' },
  },
  {
    id: 'eucalyptus',
    sanctuary: 'outback',
    name: 'Eucalyptus Sprigs',
    blurb: 'Fresh, minty leaves. A koala would cross a continent for these.',
    coins: 20,
    favorites: ['koala'],
    affection: 1,
    art: { a: '#9CC7B5', b: '#5E9C86', shape: 'sprig' },
  },
  {
    id: 'bamboo',
    sanctuary: 'harmony',
    name: 'Bamboo Shoots',
    blurb: 'Tender green shoots, snapped this morning.',
    coins: 20,
    favorites: ['redpanda'],
    affection: 1,
    art: { a: '#A5D16C', b: '#6F9E3A', shape: 'bamboo' },
  },
  {
    id: 'acacia',
    sanctuary: 'savanna',
    name: 'Acacia Leaves',
    blurb: 'From the very top of the tree, where giraffes like them.',
    coins: 20,
    favorites: ['giraffe', 'elephant'],
    affection: 1,
    art: { a: '#B8CF6A', b: '#7E9A3C', shape: 'leaf' },
  },
  {
    id: 'honeycake',
    sanctuary: 'all',
    name: 'Honey Cake',
    blurb: 'A special treat. Everyone in every sanctuary loves it.',
    tokens: 2,
    favorites: 'all',
    affection: 3,
    art: { a: '#F2C46D', b: '#C98A2E', shape: 'cake' },
  },
  {
    id: 'snowcone',
    sanctuary: 'all',
    name: 'Berry Snow Cone',
    blurb: 'A special treat, crunchy and cold. Polar friends adore it, so does everyone else.',
    tokens: 2,
    favorites: 'all',
    affection: 3,
    art: { a: '#F4A3C0', b: '#9DD6F0', shape: 'cone' },
  },
  {
    id: 'starcookie',
    sanctuary: 'all',
    name: 'Starlight Cookie',
    blurb: 'A special treat with a sugar star on top, for the best friends.',
    tokens: 3,
    favorites: 'all',
    affection: 4,
    art: { a: '#F6E0A8', b: '#E6A33A', shape: 'cookie' },
  },
] as const;

export const FOOD_BY_ID: Record<FoodId, FoodDefinition> = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<FoodId, FoodDefinition>;

export function isFoodId(x: unknown): x is FoodId {
  return typeof x === 'string' && x in FOOD_BY_ID;
}

/** The foods sold in a sanctuary's shop: its own, then the special treats sold everywhere. */
export function foodsOf(sanctuary: SanctuaryId): FoodDefinition[] {
  return FOODS.filter((f) => f.sanctuary === sanctuary || f.sanctuary === 'all');
}

export function isFavorite(food: FoodDefinition, kind: AnimalKind): boolean {
  return food.favorites === 'all' || food.favorites.includes(kind);
}
