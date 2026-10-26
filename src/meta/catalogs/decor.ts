/**
 * Sanctuary decorations: 15 alpha items. Each has a fixed home in the scene (no freeform placement, so items can't
 * overlap or end up in invalid combinations). Items are bought with free Paw Coins, chosen as the starter gift, or
 * given for finishing a chapter. Cosmetic only.
 */

export type DecorId =
  | 'cushion'
  | 'lamp'
  | 'bowls'
  | 'blanket'
  | 'fern'
  | 'basket'
  | 'rug'
  | 'toys'
  | 'perch'
  | 'windowbox'
  | 'path'
  | 'fence'
  | 'fountain'
  | 'tree'
  | 'bridge';

export type DecorUnlock = { kind: 'shop' } | { kind: 'chapter'; chapter: number };

export interface DecorDefinition {
  id: DecorId;
  name: string;
  blurb: string;
  /** Paw Coins in the shop. Chapter gifts have no price. */
  cost: number | null;
  unlock: DecorUnlock;
  /** One of the two starter gifts offered after the first board. */
  starter?: boolean;
  /** Draw order in the scene (back to front). */
  layer: number;
  season: 'any' | 'spring' | 'autumn';
}

export const DECOR: readonly DecorDefinition[] = [
  { id: 'path', name: 'Paw-Print Path', blurb: 'Stepping stones from the cottage door, each with a little paw.', cost: 180, unlock: { kind: 'shop' }, layer: 1, season: 'any' },
  { id: 'fence', name: 'Flower Fence', blurb: 'A low picket fence with climbing sweet peas.', cost: 160, unlock: { kind: 'shop' }, layer: 2, season: 'spring' },
  { id: 'tree', name: 'Blossom Tree', blurb: 'A cherry tree for shade and petals. A gift for finishing Willow Lane.', cost: null, unlock: { kind: 'chapter', chapter: 2 }, layer: 2, season: 'spring' },
  { id: 'windowbox', name: 'Window Box', blurb: 'Bright geraniums under the cottage window.', cost: 150, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  { id: 'lamp', name: 'Paper Lamp', blurb: 'A warm paper lantern on a post, for cozy evenings.', cost: 60, unlock: { kind: 'shop' }, starter: true, layer: 3, season: 'any' },
  { id: 'fountain', name: 'Stone Fountain', blurb: 'A gentle fountain for thirsty neighbors. A gift for finishing Meadow Gate.', cost: null, unlock: { kind: 'chapter', chapter: 1 }, layer: 3, season: 'any' },
  { id: 'perch', name: 'Cat Perch', blurb: 'A tall scratching tower with a lookout at the top.', cost: 220, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'fern', name: 'Potted Fern', blurb: 'A leafy fern in a terracotta pot by the door.', cost: 80, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'rug', name: 'Woven Rug', blurb: 'A striped outdoor rug, warm from the sun.', cost: 110, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'bridge', name: 'Little Bridge', blurb: 'A curved wooden bridge over the brook. A gift for finishing Lantern Hill.', cost: null, unlock: { kind: 'chapter', chapter: 3 }, layer: 5, season: 'any' },
  { id: 'blanket', name: 'Picnic Blanket', blurb: 'A checked blanket for long lazy afternoons.', cost: 90, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'cushion', name: 'Plump Cushion', blurb: 'The softest seat in the garden.', cost: 60, unlock: { kind: 'shop' }, starter: true, layer: 6, season: 'any' },
  { id: 'bowls', name: 'Twin Bowls', blurb: 'One bowl for a cat, one for a dog. Everyone gets their own.', cost: 60, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'basket', name: 'Napping Basket', blurb: 'A deep wicker basket with a fleece lining.', cost: 120, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'toys', name: 'Toy Basket', blurb: 'Balls, a rope and one very loved squeaky carrot.', cost: 140, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
] as const;

export const DECOR_BY_ID: Record<DecorId, DecorDefinition> = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<DecorId, DecorDefinition>;

export const STARTER_DECOR: DecorId[] = DECOR.filter((d) => d.starter).map((d) => d.id);

export function isDecorId(x: unknown): x is DecorId {
  return typeof x === 'string' && x in DECOR_BY_ID;
}

/** The decoration gifted for finishing chapter `chapter` (1-based), if any. */
export function chapterGift(chapter: number): DecorDefinition | null {
  return DECOR.find((d) => d.unlock.kind === 'chapter' && d.unlock.chapter === chapter) ?? null;
}
