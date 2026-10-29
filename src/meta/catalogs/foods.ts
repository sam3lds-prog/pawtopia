/**
 * Sanctuary food and treats. Bought with Paw Coins (everyday food) or video tokens (special treats), kept in the
 * pantry, and given to residents and wildlife friends from their cards. Feeding only adds affection and makes the
 * animal happy; it never changes puzzles, rankings or anything that can be won.
 *
 * Every animal has favorites (shown on the food card); a favorite counts double. Special treats are loved by everyone.
 */

export type FoodId =
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
  | 'toucan';

export interface FoodDefinition {
  id: FoodId;
  name: string;
  blurb: string;
  /** Exactly one price: Paw Coins or video tokens. */
  coins?: number;
  tokens?: number;
  /** Kinds that love it. `all` for special treats. */
  favorites: AnimalKind[] | 'all';
  /** Affection it gives (doubled for a favorite, except special treats which are already generous). */
  affection: number;
  /** Colors for the drawn icon. */
  art: { a: string; b: string; shape: 'kibble' | 'fish' | 'berries' | 'leaf' | 'fruit' | 'sprig' | 'bamboo' | 'cake' | 'cone' | 'cookie' };
}

export const FOODS: readonly FoodDefinition[] = [
  { id: 'kibble', name: 'Crunchy Kibble', blurb: 'Little stars of oven-baked crunch.', coins: 12, favorites: ['dog'], affection: 1, art: { a: '#C98A4E', b: '#A86A32', shape: 'kibble' } },
  { id: 'fishbites', name: 'Fish Bites', blurb: 'Tiny fish-shaped nibbles, still smelling of the sea.', coins: 12, favorites: ['cat', 'seal', 'polarbear', 'owl'], affection: 1, art: { a: '#8FC3E6', b: '#5C95BF', shape: 'fish' } },
  { id: 'berries', name: 'Berry Mix', blurb: 'Blueberries, raspberries and one cheeky strawberry.', coins: 15, favorites: ['fox', 'redpanda', 'toucan'], affection: 1, art: { a: '#6E78D8', b: '#E5546C', shape: 'berries' } },
  { id: 'greens', name: 'Garden Greens', blurb: 'Crisp lettuce, clover and dandelion leaves.', coins: 15, favorites: ['capybara', 'sloth', 'kangaroo', 'wombat'], affection: 1, art: { a: '#7DC07A', b: '#4E9A55', shape: 'leaf' } },
  { id: 'fruit', name: 'Fruit Platter', blurb: 'Banana, mango and melon, cut into friendly pieces.', coins: 20, favorites: ['elephant', 'toucan', 'meerkat'], affection: 1, art: { a: '#F5C84E', b: '#F08A4B', shape: 'fruit' } },
  { id: 'eucalyptus', name: 'Eucalyptus Sprigs', blurb: 'Fresh, minty leaves. A koala would cross a continent for these.', coins: 20, favorites: ['koala'], affection: 1, art: { a: '#9CC7B5', b: '#5E9C86', shape: 'sprig' } },
  { id: 'bamboo', name: 'Bamboo Shoots', blurb: 'Tender green shoots, snapped this morning.', coins: 20, favorites: ['redpanda'], affection: 1, art: { a: '#A5D16C', b: '#6F9E3A', shape: 'bamboo' } },
  { id: 'acacia', name: 'Acacia Leaves', blurb: 'From the very top of the tree, where giraffes like them.', coins: 20, favorites: ['giraffe', 'elephant'], affection: 1, art: { a: '#B8CF6A', b: '#7E9A3C', shape: 'leaf' } },
  { id: 'honeycake', name: 'Honey Cake', blurb: 'A special treat. Everyone in every sanctuary loves it.', tokens: 2, favorites: 'all', affection: 3, art: { a: '#F2C46D', b: '#C98A2E', shape: 'cake' } },
  { id: 'snowcone', name: 'Berry Snow Cone', blurb: 'A special treat, crunchy and cold. Polar friends adore it, so does everyone else.', tokens: 2, favorites: 'all', affection: 3, art: { a: '#F4A3C0', b: '#9DD6F0', shape: 'cone' } },
  { id: 'starcookie', name: 'Starlight Cookie', blurb: 'A special treat with a sugar star on top, for the best friends.', tokens: 3, favorites: 'all', affection: 4, art: { a: '#F6E0A8', b: '#E6A33A', shape: 'cookie' } },
] as const;

export const FOOD_BY_ID: Record<FoodId, FoodDefinition> = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<FoodId, FoodDefinition>;

export function isFoodId(x: unknown): x is FoodId {
  return typeof x === 'string' && x in FOOD_BY_ID;
}

export function isFavorite(food: FoodDefinition, kind: AnimalKind): boolean {
  return food.favorites === 'all' || food.favorites.includes(kind);
}
