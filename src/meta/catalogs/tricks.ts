/**
 * Tricks and emotes for residents and wildlife friends (D33, D34). Tap an animal in a sanctuary and ask it to do one.
 * Tricks are moves (a wave, a backflip); emotes are feelings acted out with the face and the whole body (heart eyes,
 * a fit of giggles, a party). Each kind has free ones; everyday ones cost video tokens (earned only by choosing to
 * watch a reward video); the most animated ones cost gems and can only be bought. Cosmetic only: none of them changes
 * anything in a puzzle, ranking or reward.
 */

export type TrickId =
  | 'wave'
  | 'hop'
  | 'spin'
  | 'bow'
  | 'rollover'
  | 'dance'
  | 'backflip'
  | 'bubble'
  | 'juggle'
  | 'rainbow'
  // Emotes (D34).
  | 'love'
  | 'laugh'
  | 'cheer'
  | 'surprised'
  | 'sleepy'
  | 'shy'
  | 'starstruck'
  | 'party';
export type TrickKind = 'trick' | 'emote';
export type TrickTier = 'free' | 'video' | 'premium';
export type EmoteGlyph = 'paw' | 'bang' | 'swirl' | 'sparkle' | 'note' | 'star' | 'bubble' | 'rainbow' | 'heart' | 'laugh' | 'cheer' | 'zzz' | 'blush' | 'starry' | 'party';

export interface TrickDefinition {
  id: TrickId;
  kind: TrickKind;
  name: string;
  blurb: string;
  tier: TrickTier;
  /** Video tokens (video tier) or gems (premium tier). */
  price: number;
  /** How long it plays, in ms (≤ 3.6 s; see styles/sanctuary-play.css and three/clips.ts). */
  ms: number;
  emote: EmoteGlyph;
}

export const TRICKS: readonly TrickDefinition[] = [
  { id: 'wave', kind: 'trick', name: 'Wave', blurb: 'A friendly wave hello.', tier: 'free', price: 0, ms: 1600, emote: 'paw' },
  { id: 'hop', kind: 'trick', name: 'Hop', blurb: 'Two happy hops.', tier: 'free', price: 0, ms: 1300, emote: 'bang' },
  { id: 'spin', kind: 'trick', name: 'Spin', blurb: 'A twirl on the spot, and another one.', tier: 'video', price: 2, ms: 1700, emote: 'swirl' },
  { id: 'bow', kind: 'trick', name: 'Take a bow', blurb: 'A deep, very proud bow.', tier: 'video', price: 2, ms: 1900, emote: 'sparkle' },
  { id: 'rollover', kind: 'trick', name: 'Roll over', blurb: 'A full roll across the grass.', tier: 'video', price: 3, ms: 1900, emote: 'note' },
  { id: 'dance', kind: 'trick', name: 'Happy dance', blurb: 'A wiggly little dance with music notes.', tier: 'video', price: 3, ms: 2400, emote: 'note' },
  { id: 'backflip', kind: 'trick', name: 'Backflip', blurb: 'A big leap, a full flip and a shower of stars.', tier: 'premium', price: 40, ms: 2200, emote: 'star' },
  { id: 'bubble', kind: 'trick', name: 'Bubble float', blurb: 'Floats up inside a shimmering bubble, then pop!', tier: 'premium', price: 55, ms: 3400, emote: 'bubble' },
  { id: 'juggle', kind: 'trick', name: 'Star juggling', blurb: 'Juggles three little stars, and catches every one.', tier: 'premium', price: 70, ms: 3200, emote: 'star' },
  { id: 'rainbow', kind: 'trick', name: 'Rainbow leap', blurb: 'Leaps over a rainbow that paints itself across the sky.', tier: 'premium', price: 90, ms: 3400, emote: 'rainbow' },
  { id: 'love', kind: 'emote', name: 'Love', blurb: 'Heart eyes, floating hearts and a happy little sway.', tier: 'free', price: 0, ms: 1800, emote: 'heart' },
  { id: 'laugh', kind: 'emote', name: 'Giggle', blurb: 'Giggles so hard it wobbles.', tier: 'free', price: 0, ms: 1800, emote: 'laugh' },
  { id: 'cheer', kind: 'emote', name: 'Cheer', blurb: 'Paws up and two big jumps. Hooray!', tier: 'video', price: 2, ms: 2000, emote: 'cheer' },
  { id: 'surprised', kind: 'emote', name: 'Surprise', blurb: 'Jumps back with big round eyes.', tier: 'video', price: 2, ms: 1600, emote: 'bang' },
  { id: 'sleepy', kind: 'emote', name: 'Sleepy', blurb: 'A huge yawn, a little doze and a nod.', tier: 'video', price: 2, ms: 3000, emote: 'zzz' },
  { id: 'shy', kind: 'emote', name: 'Shy', blurb: 'Looks away, blushing, then peeks back.', tier: 'video', price: 3, ms: 2200, emote: 'blush' },
  { id: 'starstruck', kind: 'emote', name: 'Starstruck', blurb: 'Star eyes and a twirl inside a ring of stars.', tier: 'premium', price: 45, ms: 3000, emote: 'starry' },
  { id: 'party', kind: 'emote', name: 'Party time', blurb: 'A party hat pops on, confetti flies, everybody dance!', tier: 'premium', price: 60, ms: 3400, emote: 'party' },
] as const;

export const TRICK_BY_ID: Record<TrickId, TrickDefinition> = Object.fromEntries(TRICKS.map((t) => [t.id, t])) as Record<TrickId, TrickDefinition>;

export function isTrickId(x: unknown): x is TrickId {
  return typeof x === 'string' && x in TRICK_BY_ID;
}

export const TRICK_LIST: readonly TrickDefinition[] = TRICKS.filter((t) => t.kind === 'trick');
export const EMOTE_LIST: readonly TrickDefinition[] = TRICKS.filter((t) => t.kind === 'emote');

export function trickCurrency(t: TrickDefinition): 'vtoken' | 'gem' | null {
  return t.tier === 'video' ? 'vtoken' : t.tier === 'premium' ? 'gem' : null;
}
