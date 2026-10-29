/**
 * The 20 sanctuary animals as soft toys (D34): plain data, read by `toy.ts` to build each model from rounded parts.
 * Sizes are in units of the figure scale H the 2D art uses (a resident is H = 46 scene units), with the ground at
 * y = 0, x to the animal's left-to-right as you look at it, and z toward you. Colors come from the 2D palettes so each
 * animal is recognisably itself.
 */

import { PET_BY_ID, type PetId } from '../meta/catalogs/pets';
import type { CompanionId } from '../meta/catalogs/companions';

export type BodyKind = 'sit' | 'upright' | 'big' | 'tall' | 'bird' | 'seal';
export type EarKind = 'pointed' | 'round' | 'tufted' | 'floppy' | 'folded' | 'button' | 'disc' | 'fluffy' | 'tall' | 'small' | 'giant' | 'none';
export type SnoutKind = 'cat' | 'dog' | 'fox' | 'round' | 'koala' | 'beak' | 'bigbeak' | 'trunk' | 'flat' | 'none';
export type TailKind = 'cat' | 'dog' | 'fox' | 'panda' | 'kangaroo' | 'stub' | 'bird' | 'none';
export type EyeStyle = 'dot' | 'iris' | 'owl' | 'side';
export type MouthKind = 'cat' | 'dog' | 'simple' | 'none';
export type Marking = 'tabby' | 'mask' | 'patch' | 'redpanda' | 'meerkat' | 'sloth' | 'owl' | 'none';
export type Extra = 'ossicones' | 'spots' | 'whiskers' | 'chestfluff' | 'mane' | 'claws' | 'lilypad' | 'flippers';

export interface ToySpec {
  id: string;
  body: BodyKind;
  fur: string;
  shade: string;
  /** Belly, muzzle and paw pads. */
  light: string;
  /** Nose, eye rims, ear tips. */
  dark: string;
  /** Inner ears. */
  inner: string;
  /** Head size (width, height, depth) as a fraction of H. */
  head: [number, number, number];
  ears: { kind: EarKind; size: number; color?: string; tip?: string; spread?: number };
  snout: { kind: SnoutKind; color: string; nose: string; size: number };
  eyes: { style: EyeStyle; color: string; iris?: string; size: number; spacing: number; y: number };
  mouth: MouthKind;
  tail: { kind: TailKind; color: string; tip?: string; ring?: string };
  marking: Marking;
  markColor?: string;
  cheek: string;
  brow?: string;
  /** Legs and paws, when they differ from the fur. */
  paws?: string;
  extras?: Extra[];
  /** How the animal sits in its scene: turned a little to one side (radians, + = to its left). */
  turn?: number;
}

const INK = '#2F2A27';

function pet(id: PetId, ears: EarKind, extra: Partial<ToySpec> = {}): ToySpec {
  const P = PET_BY_ID[id];
  const p = P.palette;
  const cat = P.species === 'cat';
  return {
    id,
    body: 'sit',
    fur: p.fur,
    shade: p.shade,
    light: p.muzzle,
    dark: p.nose,
    inner: p.innerEar,
    head: cat ? [0.74, 0.62, 0.62] : [0.76, 0.64, 0.64],
    ears: { kind: ears, size: 1, color: p.ear },
    snout: { kind: cat ? 'cat' : 'dog', color: p.muzzle, nose: p.nose, size: cat ? 0.9 : 1.05 },
    eyes: { style: p.iris ? 'iris' : 'dot', color: p.eye, iris: p.iris, size: 1, spacing: 0.3, y: 0.02 },
    mouth: cat ? 'cat' : 'dog',
    tail: { kind: cat ? 'cat' : 'dog', color: cat ? p.fur : p.shade },
    marking: P.markings === 'tabby' ? 'tabby' : P.markings === 'mask' ? 'mask' : P.markings === 'patch' ? 'patch' : 'none',
    markColor: p.shade,
    cheek: p.cheek,
    brow: p.brow,
    extras: cat ? ['whiskers'] : [],
    ...extra,
  };
}

export const PET_TOYS: Record<PetId, ToySpec> = {
  mochi: pet('mochi', 'round'),
  pip: pet('pip', 'pointed', { markColor: '#D9843F' }),
  clover: pet('clover', 'tufted', { markColor: '#3D414A' }),
  biscuit: pet('biscuit', 'floppy'),
  nori: pet('nori', 'folded', { markColor: '#5D6C82' }),
  peanut: pet('peanut', 'button'),
};

export const FRIEND_TOYS: Record<CompanionId, ToySpec> = {
  ember: {
    id: 'ember',
    body: 'sit',
    fur: '#E8884A',
    shade: '#D2733A',
    light: '#FFF3E2',
    dark: '#5B3A2E',
    inner: '#F4B07C',
    head: [0.78, 0.6, 0.62],
    ears: { kind: 'pointed', size: 1.35, color: '#E8884A', tip: '#5B3A2E' },
    snout: { kind: 'fox', color: '#FFF3E2', nose: INK, size: 1.05 },
    eyes: { style: 'dot', color: INK, size: 0.95, spacing: 0.3, y: 0.04 },
    mouth: 'simple',
    tail: { kind: 'fox', color: '#E8884A', tip: '#FFF3E2' },
    marking: 'none',
    cheek: '#F09C98',
    paws: '#5B3A2E',
    extras: ['chestfluff'],
  },
  maple: {
    id: 'maple',
    body: 'sit',
    fur: '#C65A31',
    shade: '#A94A26',
    light: '#FFF6EA',
    dark: '#4A2A22',
    inner: '#4A2A22',
    head: [0.78, 0.62, 0.62],
    ears: { kind: 'disc', size: 0.95, color: '#C65A31', tip: '#FFF6EA' },
    snout: { kind: 'round', color: '#FFF6EA', nose: INK, size: 0.9 },
    eyes: { style: 'dot', color: INK, size: 0.95, spacing: 0.29, y: 0.04 },
    mouth: 'simple',
    tail: { kind: 'panda', color: '#C65A31', ring: '#EBA96E' },
    marking: 'redpanda',
    markColor: '#FFF6EA',
    cheek: '#F09C98',
    paws: '#4A2A22',
  },
  gumnut: {
    id: 'gumnut',
    body: 'sit',
    fur: '#A6ADB4',
    shade: '#8F979F',
    light: '#EEF0F2',
    dark: '#3D3A3C',
    inner: '#EEF0F2',
    head: [0.8, 0.66, 0.62],
    ears: { kind: 'fluffy', size: 1.15, color: '#A6ADB4', tip: '#EEF0F2' },
    snout: { kind: 'koala', color: '#3D3A3C', nose: '#3D3A3C', size: 1 },
    eyes: { style: 'dot', color: INK, size: 0.85, spacing: 0.27, y: 0.06 },
    mouth: 'simple',
    tail: { kind: 'none', color: '#A6ADB4' },
    marking: 'none',
    cheek: '#F09C98',
    extras: ['claws'],
  },
  skipper: {
    id: 'skipper',
    body: 'upright',
    fur: '#C98B5A',
    shade: '#B0764A',
    light: '#F3DCC3',
    dark: '#3A2E28',
    inner: '#E9B8A0',
    head: [0.62, 0.58, 0.6],
    ears: { kind: 'tall', size: 1.1, color: '#C98B5A' },
    snout: { kind: 'dog', color: '#F3DCC3', nose: '#3A2E28', size: 0.95 },
    eyes: { style: 'dot', color: INK, size: 0.95, spacing: 0.25, y: 0.06 },
    mouth: 'simple',
    tail: { kind: 'kangaroo', color: '#C98B5A' },
    marking: 'none',
    cheek: '#F09C98',
  },
  dozer: {
    id: 'dozer',
    body: 'big',
    fur: '#8C7461',
    shade: '#7A6352',
    light: '#BBA690',
    dark: '#4A3B32',
    inner: '#A68D77',
    head: [0.78, 0.6, 0.64],
    ears: { kind: 'small', size: 0.9, color: '#8C7461' },
    snout: { kind: 'round', color: '#A68D77', nose: '#4A3B32', size: 1.15 },
    eyes: { style: 'dot', color: INK, size: 0.8, spacing: 0.27, y: 0.07 },
    mouth: 'simple',
    tail: { kind: 'none', color: '#8C7461' },
    marking: 'none',
    cheek: '#E9A39A',
    extras: ['claws'],
  },
  zuri: {
    id: 'zuri',
    body: 'tall',
    fur: '#F2C766',
    shade: '#E2B250',
    light: '#F8E2AE',
    dark: '#8A5A2B',
    inner: '#F8E2AE',
    head: [0.56, 0.5, 0.56],
    ears: { kind: 'small', size: 1.1, color: '#F2C766' },
    snout: { kind: 'round', color: '#F8E2AE', nose: '#8A5A2B', size: 1.1 },
    eyes: { style: 'dot', color: INK, size: 0.9, spacing: 0.27, y: 0.08 },
    mouth: 'simple',
    tail: { kind: 'stub', color: '#F2C766', tip: '#8A5A2B' },
    marking: 'none',
    markColor: '#D99A45',
    cheek: '#F09C98',
    extras: ['ossicones', 'spots'],
  },
  sunny: {
    id: 'sunny',
    body: 'upright',
    fur: '#D8B98C',
    shade: '#C4A273',
    light: '#F3E4CA',
    dark: '#6B5440',
    inner: '#6B5440',
    head: [0.56, 0.54, 0.56],
    ears: { kind: 'small', size: 0.8, color: '#6B5440' },
    snout: { kind: 'fox', color: '#F3E4CA', nose: '#3A2E28', size: 0.85 },
    eyes: { style: 'dot', color: INK, size: 0.9, spacing: 0.25, y: 0.06 },
    mouth: 'simple',
    tail: { kind: 'kangaroo', color: '#C49E6D', tip: '#6B5440' },
    marking: 'meerkat',
    markColor: '#6B5440',
    cheek: '#F09C98',
  },
  tembo: {
    id: 'tembo',
    body: 'big',
    fur: '#A9B6C6',
    shade: '#94A3B5',
    light: '#C9D3DE',
    dark: '#59677A',
    inner: '#E9C1C6',
    head: [0.8, 0.66, 0.66],
    ears: { kind: 'giant', size: 1, color: '#A9B6C6', tip: '#E9C1C6' },
    snout: { kind: 'trunk', color: '#A9B6C6', nose: '#94A3B5', size: 1 },
    eyes: { style: 'dot', color: INK, size: 0.85, spacing: 0.3, y: 0.1 },
    mouth: 'none',
    tail: { kind: 'stub', color: '#A9B6C6', tip: '#59677A' },
    marking: 'none',
    cheek: '#E9A3AE',
  },
  luna: {
    id: 'luna',
    body: 'bird',
    fur: '#F7F8FA',
    shade: '#E3E7EC',
    light: '#FFFFFF',
    dark: '#3B3F45',
    inner: '#F7F8FA',
    head: [0.7, 0.6, 0.6],
    ears: { kind: 'none', size: 1 },
    snout: { kind: 'beak', color: '#3B3F45', nose: '#3B3F45', size: 0.8 },
    eyes: { style: 'owl', color: INK, iris: '#F2C230', size: 1.1, spacing: 0.28, y: 0.06 },
    mouth: 'none',
    tail: { kind: 'bird', color: '#E3E7EC' },
    marking: 'owl',
    markColor: '#9AA4AE',
    cheek: '#F3C3C1',
  },
  frost: {
    id: 'frost',
    body: 'big',
    fur: '#F4F1E8',
    shade: '#E2DCCD',
    light: '#FBF9F3',
    dark: '#2F2A27',
    inner: '#E0D8C7',
    head: [0.78, 0.64, 0.64],
    ears: { kind: 'disc', size: 0.75, color: '#F4F1E8', tip: '#E0D8C7' },
    snout: { kind: 'round', color: '#FBF9F3', nose: '#2F2A27', size: 1.15 },
    eyes: { style: 'dot', color: INK, size: 0.85, spacing: 0.28, y: 0.06 },
    mouth: 'simple',
    tail: { kind: 'stub', color: '#F4F1E8' },
    marking: 'none',
    cheek: '#F3B8B4',
  },
  pebble: {
    id: 'pebble',
    body: 'seal',
    fur: '#D3D9DF',
    shade: '#BCC5CE',
    light: '#EEF1F4',
    dark: '#3B3F45',
    inner: '#B5BFC9',
    head: [0.6, 0.54, 0.56],
    ears: { kind: 'none', size: 1 },
    snout: { kind: 'round', color: '#EEF1F4', nose: '#3B3F45', size: 1 },
    eyes: { style: 'dot', color: INK, size: 1.15, spacing: 0.27, y: 0.06 },
    mouth: 'simple',
    tail: { kind: 'none', color: '#B5BFC9' },
    marking: 'none',
    cheek: '#F3C3C1',
    extras: ['whiskers', 'flippers'],
    turn: -0.5,
  },
  rio: {
    id: 'rio',
    body: 'bird',
    fur: '#2B2B30',
    shade: '#1F1F24',
    light: '#FCE7A0',
    dark: '#1A1A1E',
    inner: '#2B2B30',
    head: [0.6, 0.56, 0.58],
    ears: { kind: 'none', size: 1 },
    snout: { kind: 'bigbeak', color: '#F6A23A', nose: '#E8707A', size: 1 },
    eyes: { style: 'side', color: INK, iris: '#6CC3E8', size: 1, spacing: 0.3, y: 0.1 },
    mouth: 'none',
    tail: { kind: 'bird', color: '#2B2B30' },
    marking: 'none',
    cheek: '#2B2B30',
    turn: 0.62,
  },
  mango: {
    id: 'mango',
    body: 'sit',
    fur: '#B59B7C',
    shade: '#9F8668',
    light: '#EADCC4',
    dark: '#5A4636',
    inner: '#5A4636',
    head: [0.74, 0.62, 0.6],
    ears: { kind: 'none', size: 1 },
    snout: { kind: 'flat', color: '#EADCC4', nose: '#5A4636', size: 0.9 },
    eyes: { style: 'dot', color: INK, size: 0.85, spacing: 0.28, y: 0.05 },
    mouth: 'simple',
    tail: { kind: 'none', color: '#B59B7C' },
    marking: 'sloth',
    markColor: '#7A5E45',
    cheek: '#F09C98',
    extras: ['claws'],
  },
  pudding: {
    id: 'pudding',
    body: 'big',
    fur: '#B58A62',
    shade: '#A17752',
    light: '#C99D74',
    dark: '#3A2E28',
    inner: '#9E7452',
    head: [0.68, 0.6, 0.74],
    ears: { kind: 'small', size: 0.75, color: '#9E7452' },
    snout: { kind: 'flat', color: '#9E7452', nose: '#3A2E28', size: 1.2 },
    eyes: { style: 'dot', color: INK, size: 0.75, spacing: 0.26, y: 0.12 },
    mouth: 'simple',
    tail: { kind: 'none', color: '#B58A62' },
    marking: 'none',
    cheek: '#E9A39A',
  },
};

export function toySpec(id: string): ToySpec | null {
  return (PET_TOYS as Record<string, ToySpec>)[id] ?? (FRIEND_TOYS as Record<string, ToySpec>)[id] ?? null;
}

export const ALL_TOY_IDS: readonly string[] = [...Object.keys(PET_TOYS), ...Object.keys(FRIEND_TOYS)];
