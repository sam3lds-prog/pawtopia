/**
 * The world map: Natural Earth land outlines (generated once into worldMap.data.ts) on a soft ocean, with a pin for each
 * sanctuary. Pins are placed with the same Natural Earth I projection the outline was drawn with, computed here without
 * d3 (the formula is short; test/unit/world.test.ts checks it against the generator's reference points).
 */

import { WORLD_H, WORLD_LAND, WORLD_PROJECTION, WORLD_W } from './worldMap.data';

export { WORLD_H, WORLD_W };

/** Natural Earth I (Šavrič et al.), the same polynomial d3-geo uses. lon/lat in degrees → map units. */
export function projectLonLat(lon: number, lat: number): [number, number] {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const p2 = p * p;
  const p4 = p2 * p2;
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [WORLD_PROJECTION.tx + WORLD_PROJECTION.scale * x, WORLD_PROJECTION.ty - WORLD_PROJECTION.scale * y];
}

/** Harmony Isle, Pawtopia's own island (fictional), drawn where its pin sits in the Pacific. */
function harmonyIsle(lon: number, lat: number): string {
  const [x, y] = projectLonLat(lon, lat);
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M-17 4 C-16 -6 -6 -9 2 -8 C11 -9 18 -3 16 4 C12 10 -10 11 -17 4 Z" fill="var(--map-land)" stroke="var(--map-coast)" stroke-width="1.2"/><circle cx="-6" cy="-2" r="3.2" fill="#a6cf9f"/><circle cx="4" cy="-3" r="3.8" fill="#93c08e"/></g>`;
}

/** The map's backdrop: ocean, a soft graticule and the land. Pins are HTML buttons laid over it (see the World screen). */
export function worldMapSvg(home?: { lon: number; lat: number }): string {
  const lines: string[] = [];
  for (let lat = -40; lat <= 80; lat += 20) {
    const pts: string[] = [];
    for (let lon = -180; lon <= 180; lon += 10) {
      const [x, y] = projectLonLat(lon, lat);
      pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
    }
    lines.push(`<polyline points="${pts.join(' ')}"/>`);
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    const pts: string[] = [];
    for (let lat = -58; lat <= 84; lat += 6) {
      const [x, y] = projectLonLat(lon, lat);
      pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
    }
    lines.push(`<polyline points="${pts.join(' ')}"/>`);
  }
  return `<svg class="world-map__svg" viewBox="0 0 ${WORLD_W} ${WORLD_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <rect width="${WORLD_W}" height="${WORLD_H}" rx="26" fill="var(--map-sea)"/>
    <g fill="none" stroke="var(--map-grid)" stroke-width="1">${lines.join('')}</g>
    <path d="${WORLD_LAND}" fill="var(--map-land)" stroke="var(--map-coast)" stroke-width="1.2" stroke-linejoin="round"/>
    ${home ? harmonyIsle(home.lon, home.lat) : ''}
  </svg>`;
}

/** A pin's position as a percentage of the map box, for laying HTML pins over the SVG. */
export function pinPercent(lon: number, lat: number): { left: number; top: number } {
  const [x, y] = projectLonLat(lon, lat);
  return { left: (x / WORLD_W) * 100, top: (y / WORLD_H) * 100 };
}
