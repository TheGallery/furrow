import { CELL, COLS, FIELD, ROWS, WORLD_W } from './constants';
import { CELLS, type Field, SEEDED, workCell } from './field';
import type { Season } from './types';

// Soft showers: now and then, never in winter (which keeps its snow), a light shower drifts over
// the farm from the left. It rains under a soft band that builds, passes and moves on, and the
// puddles on the verges fill and slowly dry. Where it rains on the field it waters what is sown,
// exactly as the sprayer would. Showers are rare and short, and nothing here touches the machine.

export type Rand = () => number;

/** The shower passing now: the middle of its band (world x), how far it has got and how fast it drifts. */
export interface Shower { x: number; speed: number; age: number; life: number }

export interface Showers {
  shower: Shower | null;
  /** ms until the next shower, counted only while none is passing. */
  wait: number;
  /** How full each of PUDDLES is, 0..1. */
  puddles: number[];
  /** ms since the field was last watered. */
  soak: number;
}

/** How far either side of its middle the rain falls, in world units. */
export const REACH = 380;
/** It rains about this hard (0..1) before it waters what is sown; see soakAt. */
export const WET = 0.5;
/** How far either side of WET a cell's soaking point can lie, so the soaked ground has a soft, wavy edge. */
export const WET_SPREAD = 0.3;
/** A shower takes this long to build, and this long to fade as it moves on. */
export const BUILD_MS = 6000, FADE_MS = 8000;
const LIFE: [number, number] = [26_000, 36_000];
const SPEED: [number, number] = [24, 34];
/** The first shower comes after this long, then a long dry spell between showers. */
const FIRST_WAIT: [number, number] = [150_000, 240_000];
export const DRY_SPELL: [number, number] = [300_000, 540_000];
/** A full puddle dries in this long once the rain has passed. */
export const DRY_MS = 45_000;
/** How often the rain soaks the field: the same beat the crops grow on. */
const SOAK_MS = 250;

/**
 * Where water gathers: hollows on the top verge between the hedge and the field, and one in the
 * corner above the barn. None is in a headland turn band, on the bottom lane or under the HUD.
 */
export const PUDDLES = [
  { x: 520, y: 116, rx: 15, ry: 5 },
  { x: 890, y: 124, rx: 11, ry: 4 },
  { x: 1180, y: 114, rx: 13, ry: 5 },
  { x: 1440, y: 122, rx: 10, ry: 4 },
  { x: 150, y: 182, rx: 12, ry: 4.5 },
] as const;

const between = (rand: Rand, [a, b]: [number, number]) => a + rand() * (b - a);

export function createShowers(rand: Rand = Math.random): Showers {
  return { shower: null, wait: between(rand, FIRST_WAIT), puddles: PUDDLES.map(() => 0), soak: 0 };
}

/** How hard the shower is raining at its heart, 0..1: it builds, holds, then fades as it moves on. */
export function strength(sh: Shower | null): number {
  if (!sh) return 0;
  return Math.max(0, Math.min(1, sh.age / BUILD_MS, (sh.life - sh.age) / FADE_MS));
}

/** How hard it is raining at world x, 0..1: soft at the edges of the band, nothing beyond it. */
export function rainAt(s: Showers, x: number): number {
  const sh = s.shower;
  if (!sh) return 0;
  const d = (x - sh.x) / REACH;
  return d * d >= 1 ? 0 : strength(sh) * (1 - d * d) ** 2;
}

/**
 * How hard it must rain on field cell i to water it: about WET, wandering down the rows so the
 * edge of a soaked stretch is soft and wavy rather than ruled.
 */
export function soakAt(i: number): number {
  const r = Math.floor(i / COLS);
  return WET + WET_SPREAD * (0.55 * Math.sin(r * 0.09) + 0.45 * Math.sin(r * 0.037 + 1.7));
}

/** The columns of the field it may be raining on hard enough to water, or null. */
function wetColumns(s: Showers): [number, number] | null {
  const sh = s.shower, k = strength(sh), least = WET - WET_SPREAD;
  if (!sh || k < least) return null;
  const half = REACH * Math.sqrt(1 - Math.sqrt(least / k));
  const c0 = Math.max(0, Math.ceil((sh.x - half - FIELD.x) / CELL - 0.5)), c1 = Math.min(COLS - 1, Math.floor((sh.x + half - FIELD.x) / CELL - 0.5));
  return c0 <= c1 ? [c0, c1] : null;
}

/**
 * Move the weather on by dt ms. Returns the field cells the rain has just watered: where it
 * rains hard enough (soakAt) a sown cell turns watered, exactly as the sprayer's pass would leave it,
 * and nothing else in the field changes.
 */
export function stepShowers(s: Showers, f: Field, dt: number, season: Season, rand: Rand = Math.random): number[] {
  if (!s.shower) {
    // no showers in winter; the dry spell waits for spring
    if (season !== 'winter' && (s.wait -= dt) <= 0) {
      s.shower = { x: between(rand, [0, WORLD_W * 0.55]), speed: between(rand, SPEED), age: 0, life: between(rand, LIFE) };
      s.wait = between(rand, DRY_SPELL);
    }
  } else {
    const sh = s.shower;
    // winter coming in mid-shower lets it fade out from where it is, never stop dead
    if (season === 'winter' && sh.life - sh.age > FADE_MS * strength(sh)) sh.life = sh.age + FADE_MS * strength(sh);
    sh.age += dt; sh.x += (sh.speed * dt) / 1000;
    if (sh.age >= sh.life) s.shower = null;
  }

  PUDDLES.forEach((p, i) => { s.puddles[i] = Math.max(s.puddles[i] - dt / DRY_MS, Math.min(1, rainAt(s, p.x) * 1.4)); });

  const changed: number[] = [];
  s.soak += dt;
  if (s.soak < SOAK_MS) return changed;
  s.soak = 0;
  const cols = wetColumns(s);
  if (!cols) return changed;
  for (let c = cols[0]; c <= cols[1]; c++) {
    const rain = rainAt(s, FIELD.x + (c + 0.5) * CELL);
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      // the crop only matters to the harvester; watering is the same for every crop
      if (i < CELLS && f.soil[i] === SEEDED && rain >= soakAt(i) && workCell(f, i, 'water', 'wheat').changed) changed.push(i);
    }
  }
  return changed;
}

/** Where the shower is heard from, -1 left to 1 right. */
export function rainPan(s: Showers): number {
  return s.shower ? Math.max(-1, Math.min(1, (s.shower.x - WORLD_W / 2) / (WORLD_W / 2))) : 0;
}
