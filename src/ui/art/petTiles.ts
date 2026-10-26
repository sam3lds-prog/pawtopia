/**
 * Which resident appears on a board tile. A tile only ever shows a pet after a correct placement (or as the
 * fading ghost of a wrong one), and the choice depends only on the tile's REGION, the board seed and the
 * player's unlocked roster — never on the solution — so a pet's identity can't hint at anything.
 */

import { CAT, type Puzzle, type Species } from '../../engine/types';
import { FOUNDING, PETS, type PetId, type PetSpecies } from '../../meta/catalogs/pets';
import type { SaveV2 } from '../../services/storage';
import { foundingSvg } from './pets';

export type Roster = Record<PetSpecies, PetId[]>;

/** Founding pets plus every unlocked pet, per species, in catalog order. */
export function rosterFor(save: Pick<SaveV2, 'inventory'>): Roster {
  const owned = save.inventory.pets;
  const pick = (sp: PetSpecies) => {
    const ids = PETS.filter((p) => p.species === sp && (p.id === FOUNDING[sp] || owned[p.id])).map((p) => p.id);
    return ids.length ? ids : [FOUNDING[sp]];
  };
  return { cat: pick('cat'), dog: pick('dog') };
}

export function tilePetId(puzzle: Pick<Puzzle, 'regions' | 'seed'>, r: number, c: number, species: Species, roster: Roster): PetId {
  const list = roster[species === CAT ? 'cat' : 'dog'];
  const region = puzzle.regions[r][c];
  return list[(region + (puzzle.seed % 7)) % list.length];
}

/** Static art for the Cat / Dog tool buttons and rules diagrams. */
export function toolPetSvg(species: Species): string {
  return foundingSvg(species);
}
