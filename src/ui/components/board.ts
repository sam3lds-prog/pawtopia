/**
 * The puzzle board. Builds cells once, then updates only the cells whose content changed.
 * Input: pointer (tap + drag-to-mark), keyboard (arrow keys with a roving tab stop), screen readers
 * (every cell is a labeled button). Feedback classes only touch a cell's overlay, never the pet art.
 */

import { CAT, DOG, EMPTY, type Puzzle, type Species } from '../../engine/types';
import { MARK, type CellState } from '../../game/session';
import { ICON } from '../icons';
import { Scope } from '../router';
import { PALETTE_NAMES, assignRegionColors } from './regionColors';

export interface BoardView {
  cells: CellState[][];
  givenMask: boolean[][];
  dead: boolean[][] | null;
}

export interface BoardHandlers {
  /** Pointer down / keyboard activate on a cell. Return a drag mode to keep painting while the finger moves. */
  onPress(r: number, c: number): 'mark' | 'unmark' | null;
  onDrag?(r: number, c: number, mode: 'mark' | 'unmark'): void;
  onKey?(r: number, c: number, key: string): boolean;
}

export type PetFactory = (r: number, c: number, species: Species) => HTMLElement;

export interface BoardOptions {
  pannable: boolean;
  pet: PetFactory;
  /** Called when a pet element leaves the board (cleared / undone) so its animator can stop. */
  onPetRemoved?: (r: number, c: number) => void;
  /** The animal's name on a tile, for screen-reader labels. */
  petName?: (r: number, c: number) => string | null;
  /** What each of the board's animals is called ("sheep"); defaults to cat and dog. */
  speciesName?: (species: Species) => string;
}

const SPECIES_NAME: Record<number, string> = { [CAT]: 'cat', [DOG]: 'dog' };

export class Board {
  readonly el: HTMLElement;
  readonly n: number;
  private readonly cellEls: HTMLButtonElement[][];
  private readonly shown: Array<Array<string>>;
  private readonly petEls = new Map<string, HTMLElement>();
  private readonly colorOf: number[];
  private focusR = 0;
  private focusC = 0;
  private drag: { id: number; mode: 'mark' | 'unmark'; last: string } | null = null;

  constructor(
    private readonly puzzle: Puzzle,
    private readonly scope: Scope,
    private readonly handlers: BoardHandlers,
    private readonly opts: BoardOptions,
  ) {
    const n = (this.n = puzzle.size);
    this.colorOf = assignRegionColors(puzzle.regions);
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', `Puzzle board, ${n} by ${n}`);
    this.el.style.setProperty('--n', String(n));
    if (opts.pannable) this.el.classList.add('is-pannable');
    this.cellEls = [];
    this.shown = [];
    for (let r = 0; r < n; r++) {
      const row: HTMLButtonElement[] = [];
      this.shown.push(new Array(n).fill(''));
      for (let c = 0; c < n; c++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        const reg = puzzle.regions[r][c];
        const pal = this.colorOf[reg];
        b.classList.add(`p${pal}`);
        b.style.setProperty('--rc', `var(--r${pal})`);
        b.dataset.r = String(r);
        b.dataset.c = String(c);
        b.setAttribute('role', 'gridcell');
        b.tabIndex = r === 0 && c === 0 ? 0 : -1;
        this.el.appendChild(b);
        row.push(b);
      }
      this.cellEls.push(row);
    }
    this.el.appendChild(this.linesSvg());
    this.bindInput();
  }

  regionName(reg: number): string {
    return PALETTE_NAMES[this.colorOf[reg]] ?? `region ${reg + 1}`;
  }

  cell(r: number, c: number): HTMLButtonElement {
    return this.cellEls[r][c];
  }

  petAt(r: number, c: number): HTMLElement | undefined {
    return this.petEls.get(`${r},${c}`);
  }

  /** Grid lines + region dividers as one crisp overlay. */
  private linesSvg(): SVGSVGElement {
    const n = this.n;
    const R = this.puzzle.regions;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'board__lines');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    let grid = '';
    let div = '';
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (c + 1 < n) {
          const seg = `M${c + 1} ${r}V${r + 1}`;
          if (R[r][c] !== R[r][c + 1]) div += seg;
          else grid += seg;
        }
        if (r + 1 < n) {
          const seg = `M${c} ${r + 1}H${c + 1}`;
          if (R[r][c] !== R[r + 1][c]) div += seg;
          else grid += seg;
        }
      }
    const g = document.createElementNS(ns, 'path');
    g.setAttribute('class', 'grid');
    g.setAttribute('d', grid);
    g.setAttribute('vector-effect', 'non-scaling-stroke');
    const d = document.createElementNS(ns, 'path');
    d.setAttribute('class', 'div');
    d.setAttribute('d', div);
    d.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(g, d);
    return svg;
  }

  /** Sizes cells to fit the stage. 9×9 on a 320px phone still fits; `pannable` keeps ≥44px cells. */
  fit(stage: HTMLElement): void {
    this.fitBox(stage, stage.clientWidth, stage.clientHeight);
  }

  /** Sizes cells to fit a `width × height` box; `stage` gets the scroll class when the large board overflows. */
  fitBox(stage: HTMLElement, width: number, height: number): void {
    const n = this.n;
    const w = width - 8;
    const hgt = height - 8;
    let cell = Math.floor(Math.min(w / n, hgt > 120 ? hgt / n : w / n, 76));
    if (this.opts.pannable) cell = Math.max(cell, 46);
    cell = Math.max(cell, 26);
    this.el.style.setProperty('--cell', `${cell}px`);
    stage.classList.toggle('is-scroll', this.opts.pannable && cell * n > w);
  }

  render(v: BoardView): void {
    const n = this.n;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const val = v.cells[r][c];
        const given = v.givenMask[r][c];
        const dead = !!v.dead && v.dead[r][c] && val === EMPTY;
        const key = `${val}|${given ? 1 : 0}|${dead ? 1 : 0}`;
        if (this.shown[r][c] === key) continue;
        const prevVal = this.shown[r][c].split('|')[0];
        this.shown[r][c] = key;
        const el = this.cellEls[r][c];
        el.classList.toggle('is-given', given);
        const petKey = `${r},${c}`;
        const isPet = val === CAT || val === DOG;
        if (String(val) !== prevVal || !isPet) {
          if (this.petEls.has(petKey)) {
            this.petEls.delete(petKey);
            this.opts.onPetRemoved?.(r, c);
          }
          // A mistake's fading ghost and strike outlive the re-render (a double tap empties its own ✕ just before the
          // wrong animal appears, so the cell's content changes in the same beat).
          const transient = [...el.querySelectorAll<HTMLElement>('.cell__ghost, .cell__strike')];
          el.replaceChildren(...transient);
          if (isPet) {
            const pet = this.opts.pet(r, c, val as Species);
            pet.classList.add('cell__pet');
            this.petEls.set(petKey, pet);
            el.appendChild(pet);
          } else if (val === MARK) {
            el.insertAdjacentHTML('beforeend', `<span class="cell__mark">${ICON.mark}</span>`);
          } else if (dead) {
            el.insertAdjacentHTML('beforeend', '<span class="cell__dot"></span>');
          }
          if (given) el.insertAdjacentHTML('beforeend', `<span class="cell__lock">${ICON.lock}</span>`);
        }
        el.setAttribute('aria-label', this.label(r, c, val, given, dead));
      }
  }

  private label(r: number, c: number, val: CellState, given: boolean, dead: boolean): string {
    const where = `Row ${r + 1}, column ${c + 1}, ${this.regionName(this.puzzle.regions[r][c])}`;
    if (val === CAT || val === DOG) {
      const name = this.opts.petName?.(r, c);
      const kind = this.opts.speciesName?.(val as Species) ?? SPECIES_NAME[val];
      return `${where}: ${kind}${name && name.toLowerCase() !== kind.toLowerCase() ? `, ${name}` : ''}${given ? ', already home' : ''}`;
    }
    if (val === MARK) return `${where}: marked empty`;
    return `${where}: empty${dead ? ', no animal can go here' : ''}`;
  }

  /** Adds a class to cells for `ms`, then removes it. Cancelled with the screen. */
  flash(cells: Array<[number, number]>, cls: string, ms: number): void {
    for (const [r, c] of cells) {
      const el = this.cellEls[r][c];
      el.classList.remove(cls);
      void el.offsetWidth; // restart the overlay animation
      el.classList.add(cls);
    }
    this.scope.timeout(() => {
      for (const [r, c] of cells) this.cellEls[r][c].classList.remove(cls);
    }, ms);
  }

  /**
   * Shows the attempted (wrong) pet faintly with a brief strike across it, then fades both. Opacity only — the art
   * never moves, and the cell keeps whatever it held before (empty or the player's ✕): a wrong Cat never becomes an
   * ✕, and nothing hints at what the tile really holds.
   */
  ghost(r: number, c: number, petEl: HTMLElement, ms: number): void {
    const el = this.cellEls[r][c];
    petEl.classList.add('cell__ghost');
    petEl.style.setProperty('--miss-ms', `${ms}ms`);
    const strike = document.createElement('span');
    strike.className = 'cell__strike';
    strike.setAttribute('aria-hidden', 'true');
    strike.style.setProperty('--miss-ms', `${ms}ms`);
    el.append(petEl, strike);
    this.scope.timeout(() => {
      petEl.remove();
      strike.remove();
    }, ms);
  }

  setHint(focus: Array<[number, number]>, target: [number, number] | null): void {
    for (const row of this.cellEls)
      for (const el of row) {
        el.classList.remove('is-focus', 'is-target');
      }
    for (const [r, c] of focus) this.cellEls[r][c].classList.add('is-focus');
    if (target) this.cellEls[target[0]][target[1]].classList.add('is-target');
  }

  clearHint(): void {
    this.setHint([], null);
  }

  /** Tutorial: a pulsing ring on the one tile the coach is talking about (overlay only). */
  setGuide(target: [number, number] | null): void {
    for (const row of this.cellEls) for (const el of row) el.classList.remove('is-guide');
    if (target) this.cellEls[target[0]][target[1]].classList.add('is-guide');
  }

  focusCell(r: number, c: number): void {
    this.cellEls[this.focusR][this.focusC].tabIndex = -1;
    this.focusR = r;
    this.focusC = c;
    const el = this.cellEls[r][c];
    el.tabIndex = 0;
    el.focus();
  }

  private cellFromPoint(x: number, y: number): [number, number] | null {
    const el = document.elementFromPoint(x, y)?.closest?.('.cell') as HTMLElement | null;
    if (!el || !this.el.contains(el)) return null;
    return [Number(el.dataset.r), Number(el.dataset.c)];
  }

  private bindInput(): void {
    const s = this.scope;
    if (!this.opts.pannable) {
      s.on(this.el, 'pointerdown', (e: PointerEvent) => {
        if (e.button !== 0 || this.drag) return;
        const cell = this.cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        e.preventDefault();
        const [r, c] = cell;
        this.setRoving(r, c);
        const mode = this.handlers.onPress(r, c);
        if (mode && this.handlers.onDrag) {
          this.drag = { id: e.pointerId, mode, last: `${r},${c}` };
          try {
            this.el.setPointerCapture(e.pointerId);
          } catch {
            /* capture unsupported */
          }
        }
      });
      s.on(this.el, 'pointermove', (e: PointerEvent) => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const cell = this.cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        const key = `${cell[0]},${cell[1]}`;
        if (key === this.drag.last) return;
        this.drag.last = key;
        this.handlers.onDrag?.(cell[0], cell[1], this.drag.mode);
      });
      const end = (e: PointerEvent) => {
        if (this.drag && e.pointerId === this.drag.id) this.drag = null;
      };
      s.on(this.el, 'pointerup', end);
      s.on(this.el, 'pointercancel', end);
      s.on(this.el, 'lostpointercapture', end);
    }
    // Clicks: keyboard activation (detail 0) always; pointer taps only in pannable mode,
    // where acting on pointerdown would fire at the start of every pan.
    s.on(this.el, 'click', (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('.cell') as HTMLElement | null;
      if (!el) return;
      if (e.detail !== 0 && !this.opts.pannable) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      this.setRoving(r, c);
      this.handlers.onPress(r, c);
    });
    s.on(this.el, 'keydown', (e: KeyboardEvent) => {
      const el = (e.target as HTMLElement).closest('.cell') as HTMLElement | null;
      if (!el) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const mv = moves[e.key];
      if (mv) {
        e.preventDefault();
        const nr = Math.max(0, Math.min(this.n - 1, r + mv[0]));
        const nc = Math.max(0, Math.min(this.n - 1, c + mv[1]));
        this.focusCell(nr, nc);
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        this.focusCell(r, e.key === 'Home' ? 0 : this.n - 1);
        return;
      }
      // A held key acts once: auto-repeat must not place, cycle or spend anything again.
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (this.handlers.onKey?.(r, c, e.key)) e.preventDefault();
    });
  }

  private setRoving(r: number, c: number): void {
    this.cellEls[this.focusR][this.focusC].tabIndex = -1;
    this.focusR = r;
    this.focusC = c;
    this.cellEls[r][c].tabIndex = 0;
  }
}

/** Tiny static thumbnail of a board's regions (no pets, no answer). */
export function miniBoard(regions: number[][]): string {
  const n = regions.length;
  const colors = assignRegionColors(regions);
  let cells = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells += `<i style="--rc:var(--r${colors[regions[r][c]]})"></i>`;
  return `<div class="mini-board" style="--n:${n}" aria-hidden="true">${cells}</div>`;
}
