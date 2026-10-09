import { CELL, COLS, FIELD, ROWS } from './constants';
import type { Crop, Job, Season } from './types';

export const RAW = 0;
export const CULTIVATED = 1;
export const SEEDED = 2;
export const WATERED = 3;
export const STUBBLE = 5;

export const CROPS: readonly Crop[] = ['wheat', 'carrot', 'pumpkin'];
/** Growth at which a crop is ready to harvest. */
export const RIPE = 0.85;
/** Unwatered seed only sprouts this far. */
export const SPROUT_MAX = 0.2;
export const SPROUT_MS = 60 * 1000;
/** Watered crops go from seed to fully grown in this long (never in winter). */
export const GROW_MS = 5 * 60 * 1000;

export interface Field {
  soil: Uint8Array;
  growth: Float32Array;
  /** Index into CROPS of what was sown in each cell. */
  crop: Uint8Array;
}

export const CELLS = COLS * ROWS;

export function createField(): Field {
  return { soil: new Uint8Array(CELLS), growth: new Float32Array(CELLS), crop: new Uint8Array(CELLS) };
}

export function cellAt(x: number, y: number): number {
  const c = Math.floor((x - FIELD.x) / CELL), r = Math.floor((y - FIELD.y) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return r * COLS + c;
}

/** Apply one implement pass to one cell. Returns whether the cell changed and whether it was harvested. */
export function workCell(f: Field, i: number, job: Job, crop: Crop): { changed: boolean; harvested: boolean } {
  const s = f.soil[i];
  switch (job) {
    case 'cultivate':
      // only bare ground: the cultivator never ploughs up a growing crop
      if (s === RAW || s === STUBBLE) { f.soil[i] = CULTIVATED; f.growth[i] = 0; return { changed: true, harvested: false }; }
      return { changed: false, harvested: false };
    case 'plant':
      if (s === CULTIVATED) { f.soil[i] = SEEDED; f.crop[i] = CROPS.indexOf(crop); f.growth[i] = 0; return { changed: true, harvested: false }; }
      return { changed: false, harvested: false };
    case 'water':
      if (s === SEEDED) { f.soil[i] = WATERED; return { changed: true, harvested: false }; }
      return { changed: false, harvested: false };
    case 'harvest':
      // each harvester only lifts its own crop, and only once it is ripe
      if ((s === SEEDED || s === WATERED) && f.crop[i] === CROPS.indexOf(crop) && f.growth[i] >= RIPE) {
        f.soil[i] = STUBBLE; f.growth[i] = 0; return { changed: true, harvested: true };
      }
      return { changed: false, harvested: false };
  }
}

/**
 * Work the strip under an implement: a line `halfWidth` either side of (x, y),
 * square to the heading `a`. Returns the changed cell indices and how many were harvested.
 */
export function workStrip(f: Field, x: number, y: number, a: number, halfWidth: number, job: Job, crop: Crop): { changed: number[]; harvested: number } {
  const nx = -Math.sin(a), ny = Math.cos(a), changed: number[] = [];
  let harvested = 0;
  for (let t = -halfWidth; t <= halfWidth; t += CELL / 2) {
    const i = cellAt(x + nx * t, y + ny * t);
    if (i < 0) continue;
    const r = workCell(f, i, job, crop);
    if (r.changed) changed.push(i);
    if (r.harvested) harvested++;
  }
  return { changed, harvested };
}

/** Let crops grow for dt milliseconds. Nothing grows in winter, and nothing ever dies. */
export function grow(f: Field, dt: number, season: Season): void {
  if (season === 'winter' || dt <= 0) return;
  const sprout = (dt / SPROUT_MS) * SPROUT_MAX, full = dt / GROW_MS;
  for (let i = 0; i < CELLS; i++) {
    const s = f.soil[i];
    if (s === WATERED) f.growth[i] = Math.min(1, f.growth[i] + full);
    else if (s === SEEDED && f.growth[i] < SPROUT_MAX) f.growth[i] = Math.min(SPROUT_MAX, f.growth[i] + sprout);
  }
}

/** Share of the field another crop's ripe cells must cover before the barn mentions them. */
export const OTHER_RIPE = 0.05;

export interface FieldSummary {
  /** Bare ground (raw or stubble) as a fraction of the field. */
  bare: number;
  cultivated: number;
  /** Sown but not yet watered. */
  dry: number;
  watered: number;
  /** Ripe cells of the given crop. */
  ripe: number;
  /** Another crop with ripe cells still standing, which only its own harvester can lift. */
  otherRipe: Crop | null;
}

export function summarize(f: Field, crop: Crop): FieldSummary {
  const ci = CROPS.indexOf(crop);
  let bare = 0, cultivated = 0, dry = 0, watered = 0;
  const ripeBy = CROPS.map(() => 0);
  for (let i = 0; i < CELLS; i++) {
    const s = f.soil[i];
    if (s === RAW || s === STUBBLE) bare++;
    else if (s === CULTIVATED) cultivated++;
    else {
      if (s === SEEDED) dry++; else watered++;
      if (f.growth[i] >= RIPE && f.crop[i] < CROPS.length) ripeBy[f.crop[i]]++;
    }
  }
  let other = -1;
  ripeBy.forEach((n, k) => { if (k !== ci && n >= OTHER_RIPE * CELLS && (other < 0 || n > ripeBy[other])) other = k; });
  return {
    bare: bare / CELLS, cultivated: cultivated / CELLS, dry: dry / CELLS, watered: watered / CELLS, ripe: ripeBy[ci] / CELLS,
    otherRipe: other < 0 ? null : CROPS[other],
  };
}
