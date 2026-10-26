/**
 * Region → palette assignment. Adjacent regions get the most different hues available, so two soft
 * pastels never sit side by side looking alike. Deterministic for a given board.
 */

/** Approximate hue of each palette slot (see tokens.css --r0 … --r8). */
export const PALETTE_HUES = [258, 140, 26, 196, 348, 48, 84, 170, 225];
export const PALETTE_NAMES = ['lavender', 'mint', 'apricot', 'sky', 'blush', 'butter', 'sage', 'sea glass', 'periwinkle'];

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export function regionAdjacency(regions: number[][]): Set<number>[] {
  const n = regions.length;
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const a = regions[r][c];
      if (c + 1 < n && regions[r][c + 1] !== a) {
        adj[a].add(regions[r][c + 1]);
        adj[regions[r][c + 1]].add(a);
      }
      if (r + 1 < n && regions[r + 1][c] !== a) {
        adj[a].add(regions[r + 1][c]);
        adj[regions[r + 1][c]].add(a);
      }
    }
  return adj;
}

/** Returns palette index for each region id. */
export function assignRegionColors(regions: number[][]): number[] {
  const n = regions.length;
  const adj = regionAdjacency(regions);
  const order = [...Array(n).keys()].sort((a, b) => adj[b].size - adj[a].size || a - b);
  const pool = [...Array(Math.min(n, PALETTE_HUES.length)).keys()];
  // Boards bigger than the palette would reuse colors; sizes here are ≤ 9.
  while (pool.length < n) pool.push(pool.length % PALETTE_HUES.length);
  const color = new Array<number>(n).fill(-1);
  const used = new Set<number>();
  for (const reg of order) {
    let best = -1;
    let bestScore = -1;
    for (const p of pool) {
      if (used.has(p) && used.size < pool.length) continue;
      let score = 360;
      for (const nb of adj[reg]) if (color[nb] >= 0) score = Math.min(score, hueDist(PALETTE_HUES[p], PALETTE_HUES[color[nb]]));
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    color[reg] = best;
    used.add(best);
  }
  return color;
}
