// The weather overhead: soft cloud shadows drifting across the farm, and gusts that blow petals,
// seed fluff or leaves off the hedges. Nothing here touches the field or the machine.
import { BARN, LANE, WORLD_H, WORLD_W } from './constants';
import type { Season } from './types';

export type Rand = () => number;

/** A cloud's shadow on the ground, in world units; `shape` picks one of the soft sprites. */
export interface Cloud { x: number; y: number; shape: number; size: number }
/** A breath of wind rolling left to right across the world; `front` is its leading edge. */
export interface Gust { front: number; speed: number; strength: number }
export type BitKind = 'petal' | 'fluff' | 'leaf';
/** One petal, seed or leaf in the air. `age` and `life` are in ms. */
export interface Bit { x: number; y: number; vx: number; vy: number; spin: number; turn: number; kind: BitKind; age: number; life: number; seed: number; tint: number }

export interface Wind {
  clouds: Cloud[];
  gusts: Gust[];
  bits: Bit[];
  /** ms until the next gust sets off. */
  nextGust: number;
  /** ms of wind so far, for the bits' gentle flutter. */
  t: number;
}

// A cloud sprite covers CLOUD_W × CLOUD_H world units at size 1.
export const CLOUD_W = 440, CLOUD_H = 300, CLOUD_SHAPES = 3;
const CLOUD_VX = 15, CLOUD_VY = 4;
const GUST_FROM = -300, GUST_TO = WORLD_W + 300;
const GUST_EVERY: [number, number] = [5000, 9000];
/** Fewer than this many bits are ever in the air at once. */
export const MAX_BITS = 26;
const BIT_RATE = 1 / 160;   // new bits per ms while a gust is blowing
const TOP_HEDGE: [number, number] = [30, 80];
const SIDE_HEDGE: [number, number] = [20, 110];

const between = (rand: Rand, [a, b]: [number, number]) => a + rand() * (b - a);

/** What the hedges give up to the wind this season; winter's bare hedges give nothing. */
export function bitKind(season: Season): BitKind | null {
  return season === 'spring' ? 'petal' : season === 'summer' ? 'fluff' : season === 'autumn' ? 'leaf' : null;
}

export function createWind(rand: Rand = Math.random): Wind {
  const clouds = [0, 1, 2].map((i) => ({ x: [200, 900, -500][i], y: [120, 460, 300][i], shape: i, size: 1.5 + rand() * 0.3 }));
  return { clouds, gusts: [], bits: [], nextGust: 1500, t: 0 };
}

/** How hard the wind blows at world x, 0..1: a soft bump that travels with each gust. */
export function gustAt(w: Wind, x: number): number {
  let s = 0;
  for (const g of w.gusts) { const d = (x - g.front) / 200; s += g.strength * Math.exp(-d * d); }
  return Math.min(1, s);
}

/** Move the weather on by dt ms. Bits only lift off the hedges while a gust is blowing. */
export function stepWind(w: Wind, dt: number, season: Season, rand: Rand = Math.random): void {
  const s = dt / 1000;
  w.t += dt;
  for (const c of w.clouds) {
    c.x += CLOUD_VX * s; c.y += CLOUD_VY * s;
    // once a shadow has drifted off the right, a new one comes in from the left
    if (c.x > WORLD_W + 100) { c.size = 1.5 + rand() * 0.3; c.x = -CLOUD_W * c.size - rand() * 300; c.y = -200 + rand() * (WORLD_H - 100); }
  }

  if ((w.nextGust -= dt) <= 0) {
    w.gusts.push({ front: GUST_FROM, speed: 150 + rand() * 40, strength: 0.7 + rand() * 0.3 });
    w.nextGust = between(rand, GUST_EVERY);
  }
  for (const g of w.gusts) g.front += g.speed * s;
  w.gusts = w.gusts.filter((g) => g.front < GUST_TO);

  const kind = bitKind(season), gust = w.gusts.find((g) => g.front > 0 && g.front < WORLD_W);
  if (kind && gust && w.bits.length < MAX_BITS && rand() < dt * BIT_RATE) {
    // off the top hedge just behind the gust, or off the left-hand hedge (above or below the barn) as it sets out
    const top = gust.front > 300 || rand() < 0.6, above = rand() < 0.5;
    w.bits.push({
      x: top ? Math.max(0, gust.front - rand() * 200) : between(rand, SIDE_HEDGE),
      y: top ? between(rand, TOP_HEDGE) : between(rand, above ? [140, BARN.y - 34] : [BARN.y + BARN.h + 34, LANE.y - 20]),
      vx: 50 + rand() * 35, vy: -6 + rand() * 20,
      spin: rand() * 6, turn: -2 + rand() * 4,
      kind, age: 0, life: 7000 + rand() * 4000, seed: rand() * 9, tint: rand(),
    });
  }
  for (const b of w.bits) {
    // a passing gust hurries them along
    const push = 1 + gustAt(w, b.x);
    b.x += b.vx * push * s;
    b.y += (b.vy + Math.sin(w.t / 420 + b.seed) * 12) * s;
    b.spin += b.turn * push * s;
    b.age += dt;
  }
  w.bits = w.bits.filter((b) => b.age < b.life && b.x < WORLD_W + 40);
}

/** How visible a bit is: it fades in as it lifts and out before it goes. */
export function bitAlpha(b: Bit): number {
  const k = b.age / b.life;
  return Math.max(0, Math.min(1, k * 6, (1 - k) * 4));
}
