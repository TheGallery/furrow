import { BARN, FIELD, SCALE, WORK_HALF, WORLD_W } from './constants';
import { EXT } from './machines';
import type { Rig, Season } from './types';
import type { Vehicle } from './vehicle';

// Birds that follow the work: gulls (rooks in autumn) settle on the freshly worked strip behind the
// implement and lift when the machine comes back past; swallows loop over the summer crop; small
// birds hop along the hedge tops. They only ever watch the machine; nothing here touches it.

export type BirdKind = 'gull' | 'rook' | 'swallow' | 'sparrow' | 'robin';
export type Rand = () => number;

/** What every bird has for drawing: where it is, its heading, its height above the ground and its wingbeat. */
export interface Flier { x: number; y: number; a: number; h: number; flap: number }

export interface Follower extends Flier {
  kind: 'gull' | 'rook';
  state: 'arrive' | 'ground' | 'fly' | 'leave';
  /** A flight from (sx, sy) to (tx, ty), k = 0..1 along it; on the ground, (tx, ty) is where it walks. */
  sx: number; sy: number; tx: number; ty: number; k: number;
  peck: number;
  timer: number;
  seed: number;
}

export interface Percher extends Flier {
  kind: 'sparrow' | 'robin';
  flying: boolean;
  sx: number; sy: number; tx: number; ty: number; k: number;
  timer: number;
  seed: number;
}

export interface Birds {
  t: number;
  /** Where the implement worked lately: x, y, time triples, oldest first. */
  trail: number[];
  trailAcc: number;
  flock: Follower[];
  /** How long the machine has not been working. */
  idle: number;
  spawn: number;
  hedge: Percher[];
  /** The middle of the swallows' loops: over the machine while it works, else over the field. */
  swallows: { x: number; y: number };
}

export interface BirdScene {
  season: Season;
  working: boolean;
  /** Where the implement meets the ground. */
  tines: { x: number; y: number };
  v: Vehicle;
  rig: Rig;
}

/** How many gulls or rooks come to the work in each season; swallows have the summer. */
export const FLOCK: Record<Season, number> = { spring: 9, summer: 0, autumn: 7, winter: 4 };
/** How long the flock stays once the work stops, through a headland turn or a pause. */
export const STAY_MS = 12000;
const TRAIL_MS = 25000, TRAIL_STEP = 120;
/** A machine this close (from its body) lifts a bird off the ground. */
export const LIFT_DIST = 42;
/** A machine this close sends a hedge bird to another perch. */
export const HEDGE_SHY = 150;
export const SWALLOWS = 4;
const SWALLOW_H = 14;

/** Where birds may land on the field: inside its edges, so never in the headland turn bands beyond them. */
export const LANDING = { x0: FIELD.x + 24, x1: FIELD.x + FIELD.w - 24, y0: FIELD.y + 18, y1: FIELD.y + FIELD.h - 18 } as const;

/**
 * The hedge tops a small bird can sit on: the top hedge (above the machine's reach) and the hedge by
 * the barn, laid out as renderBackground lays them. The right-hand hedge sits in the turn band, so not there.
 */
export const PERCHES: readonly { x: number; y: number }[] = (() => {
  const rnd = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < Math.ceil(WORLD_W / 50); i++) out.push({ x: 36 + i * 50, y: 40 + Math.sin(i * 1.7) * 6 });
  for (let i = 0; i < 12; i++) {
    const y = 160 + i * 60;
    if (y < BARN.y - 34 || y > BARN.y + BARN.h + 34) out.push({ x: 40 + rnd(i + 4) * 60, y: y - 6 });
  }
  return out;
})();

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a);
const inLanding = (p: { x: number; y: number }) => ({ x: clamp(p.x, LANDING.x0, LANDING.x1), y: clamp(p.y, LANDING.y0, LANDING.y1) });

export function createBirds(rand: Rand = Math.random): Birds {
  const hedge: Percher[] = [];
  for (let i = 0; i < 6; i++) {
    const p = PERCHES[(i * 7 + 3) % PERCHES.length];
    hedge.push({ kind: 'sparrow', x: p.x, y: p.y, a: between(rand, -3, 3), h: 0, flap: 0, flying: false, sx: p.x, sy: p.y, tx: p.x, ty: p.y, k: 0, timer: between(rand, 3000, 9000), seed: i });
  }
  return { t: 0, trail: [], trailAcc: 0, flock: [], idle: STAY_MS, spawn: 0, hedge, swallows: { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2 } };
}

/** How far (x, y) is from the machine and its implement, roughly: the distance to its centre line, less its half width. */
export function machineDist(v: Vehicle, rig: Rig, x: number, y: number): number {
  const [r0, r1] = EXT[rig], c = Math.cos(v.a), s = Math.sin(v.a);
  const ax = v.x + c * r0 * SCALE, ay = v.y + s * r0 * SCALE, dx = c * (r1 - r0) * SCALE, dy = s * (r1 - r0) * SCALE;
  const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - ax - dx * k, y - ay - dy * k) - 30;
}

/** A point on the worked strip, worked between `young` and `old` ms ago, somewhere across its width. */
export function trailPoint(b: Birds, young: number, old: number, rand: Rand = Math.random): { x: number; y: number } | null {
  const fits: number[] = [];
  for (let i = 0; i < b.trail.length; i += 3) { const age = b.t - b.trail[i + 2]; if (age > young && age < old) fits.push(i); }
  if (!fits.length) return null;
  const i = fits[Math.floor(rand() * fits.length)], side = (rand() - 0.5) * 1.6 * WORK_HALF;
  // across the strip, square to the way the machine was going there
  const j = i + 3 < b.trail.length ? i + 3 : Math.max(0, i - 3), dir = j > i ? 1 : -1;
  const dx = (b.trail[j] - b.trail[i]) * dir, dy = (b.trail[j + 1] - b.trail[i + 1]) * dir, d = Math.hypot(dx, dy) || 1;
  return inLanding({ x: b.trail[i] - (dy / d) * side, y: b.trail[i + 1] + (dx / d) * side });
}

function fly(b: Follower | Percher, tx: number, ty: number): void {
  b.sx = b.x; b.sy = b.y; b.tx = tx; b.ty = ty; b.k = 0;
}

/** Walk toward (tx, ty), turning smoothly. */
function walk(c: Flier, tx: number, ty: number, speed: number, dt: number): void {
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < 1.5) return;
  const want = Math.atan2(ty - c.y, tx - c.x);
  c.a += wrapA(want - c.a) * Math.min(1, (4 * dt) / 1000);
  const step = Math.min(d, (speed * dt) / 1000) * Math.max(0.25, Math.cos(wrapA(want - c.a)));
  c.x += Math.cos(c.a) * step; c.y += Math.sin(c.a) * step;
}

export function updateBirds(b: Birds, s: BirdScene, dt: number, rand: Rand = Math.random): void {
  b.t += dt;
  const near = (x: number, y: number) => machineDist(s.v, s.rig, x, y);

  // the worked strip, remembered for a while
  b.trailAcc += dt;
  if (s.working && b.trailAcc >= TRAIL_STEP) { b.trailAcc = 0; b.trail.push(s.tines.x, s.tines.y, b.t); }
  let drop = 0;
  while (drop < b.trail.length && b.t - b.trail[drop + 2] > TRAIL_MS) drop += 3;
  if (drop) b.trail.splice(0, drop);

  // --- gulls and rooks: come while there is fresh work, drift off a while after it stops
  b.idle = s.working ? 0 : b.idle + dt;
  const want = b.idle < STAY_MS && b.trail.length ? FLOCK[s.season] : 0;
  const kind = s.season === 'autumn' ? 'rook' : 'gull';
  const staying = b.flock.filter((f) => f.state !== 'leave');
  b.spawn -= dt;
  if (staying.length < want && b.spawn <= 0) {
    const p = trailPoint(b, 1500, 8000, rand);
    if (p) {
      const from = rand() * Math.PI * 2, x = p.x + Math.cos(from) * 320, y = p.y + Math.sin(from) * 320;
      b.flock.push({ kind: rand() < 0.12 ? (kind === 'gull' ? 'rook' : 'gull') : kind, x, y, a: from + Math.PI, h: 60, flap: rand() * 6, state: 'arrive', sx: x, sy: y, tx: p.x, ty: p.y, k: 0, peck: 0, timer: 0, seed: rand() * 9 });
      b.spawn = staying.length < 3 ? between(rand, 250, 600) : between(rand, 900, 2200);
    }
  } else if (staying.length > want && b.spawn <= 0) {
    const f = staying[0];
    f.state = 'leave'; fly(f, f.x + between(rand, -200, 200), -160);
    b.spawn = between(rand, 600, 1400);
  }
  for (const f of b.flock) {
    f.timer -= dt;
    if (f.state === 'ground') {
      f.peck += ((Math.sin(b.t / 140 + f.seed * 3) > 0.5 ? 1 : 0) - f.peck) * Math.min(1, dt / 80);
      if (near(f.x, f.y) < LIFT_DIST) {
        // the machine is coming back past: lift, and settle further back along the strip
        const p = trailPoint(b, 4000, 20000, rand);
        f.state = 'fly';
        if (p && near(p.x, p.y) > 110) fly(f, p.x, p.y);
        else { const q = inLanding({ x: f.x + between(rand, -90, 90), y: f.y + (rand() < 0.5 ? -110 : 110) }); fly(f, q.x, q.y); }
      } else if (f.timer < 0) {
        f.timer = between(rand, 2500, 7000);
        const p = trailPoint(b, 1500, 5000, rand);
        if (p && near(p.x, p.y) > 70 && rand() < 0.5) { f.state = 'fly'; fly(f, p.x, p.y); }
        else { f.tx = clamp(f.x + between(rand, -14, 14), LANDING.x0, LANDING.x1); f.ty = clamp(f.y + between(rand, -10, 10), LANDING.y0, LANDING.y1); }
      }
      if (f.state === 'ground') walk(f, f.tx, f.ty, 7, dt);
    } else {
      f.k = Math.min(1, f.k + (dt * (f.state === 'arrive' ? 70 : 64)) / 1000 / Math.max(20, Math.hypot(f.tx - f.sx, f.ty - f.sy)));
      const e = f.k * f.k * (3 - 2 * f.k), nx = f.sx + (f.tx - f.sx) * e, ny = f.sy + (f.ty - f.sy) * e;
      if (Math.hypot(nx - f.x, ny - f.y) > 0.01) f.a = Math.atan2(ny - f.y, nx - f.x);
      f.x = nx; f.y = ny;
      f.h = f.state === 'leave' ? 20 + f.k * 60 : f.state === 'arrive' ? 60 * (1 - f.k) + Math.sin(Math.PI * f.k) * 10 : Math.sin(Math.PI * f.k) * 26;
      f.flap += dt / (f.h > 8 ? 115 : 70);
      if (f.k >= 1 && f.state !== 'leave') { f.state = 'ground'; f.h = 0; f.timer = between(rand, 1500, 5000); f.tx = f.x; f.ty = f.y; }
    }
  }
  b.flock = b.flock.filter((f) => !(f.state === 'leave' && f.k >= 1));

  // --- small birds along the hedge tops: hop on when the machine comes near, or now and then
  b.hedge.forEach((p, i) => {
    p.kind = s.season === 'winter' && i === 0 ? 'robin' : 'sparrow';
    if (!p.flying) {
      p.timer -= dt;
      if (near(p.x, p.y) < HEDGE_SHY || p.timer < 0) {
        const options = PERCHES.filter((q) => { const d = Math.hypot(q.x - p.x, q.y - p.y); return d > 90 && d < 320 && near(q.x, q.y) > 200; });
        const q = options[Math.floor(rand() * options.length)];
        if (q) { p.flying = true; fly(p, q.x + between(rand, -5, 5), q.y + between(rand, -3, 3)); }
        p.timer = between(rand, 5000, 14000);
      }
      if (rand() < dt / 2500) p.a += between(rand, -1.2, 1.2);
    } else {
      p.k = Math.min(1, p.k + (dt * 85) / 1000 / Math.max(20, Math.hypot(p.tx - p.sx, p.ty - p.sy)));
      const nx = p.sx + (p.tx - p.sx) * p.k, ny = p.sy + (p.ty - p.sy) * p.k;
      if (Math.hypot(nx - p.x, ny - p.y) > 0.01) p.a = Math.atan2(ny - p.y, nx - p.x);
      p.x = nx; p.y = ny; p.h = Math.sin(Math.PI * p.k) * 18; p.flap += dt / 40;
      if (p.k >= 1) { p.flying = false; p.h = 0; }
    }
  });

  // --- the swallows' loops drift after the machine while it works
  const cx = s.working ? clamp(s.v.x, FIELD.x + 120, FIELD.x + FIELD.w - 120) : FIELD.x + FIELD.w / 2;
  const cy = s.working ? clamp(s.v.y, FIELD.y + 80, FIELD.y + FIELD.h - 80) : FIELD.y + FIELD.h / 2;
  const k = Math.min(1, dt / 2500);
  b.swallows.x += (cx - b.swallows.x) * k; b.swallows.y += (cy - b.swallows.y) * k;
}

/** The swallows, each on its own figure-of-eight over the crop. */
export function swallows(b: Birds): Flier[] {
  const out: Flier[] = [], { x: cx, y: cy } = b.swallows, t = b.t;
  const at = (i: number, th: number) => {
    const rx = 170 + 40 * Math.sin(t / 5300 + i), ry = 95 + 25 * Math.cos(t / 4100 + i);
    return { x: cx + Math.cos(th) * rx, y: cy + Math.sin(2 * th) * ry };
  };
  for (let i = 0; i < SWALLOWS; i++) {
    const th = (t / 1000) * (0.5 + i * 0.07) + i * 1.9, p = at(i, th), q = at(i, th + 0.02);
    out.push({ x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x), h: SWALLOW_H, flap: t / 55 + i });
  }
  return out;
}

/** Where a chirp should sound from, -0.8 (left) to 0.8 (right): one of the birds in view, or null when none is. */
export function chirpPan(b: Birds, season: Season, rand: Rand = Math.random): number | null {
  const xs = b.hedge.map((p) => p.x);
  for (const f of b.flock) if (f.state === 'ground') xs.push(f.x);
  if (season === 'summer') xs.push(b.swallows.x);
  if (!xs.length) return null;
  return clamp(xs[Math.floor(rand() * xs.length)] / WORLD_W, 0, 1) * 1.6 - 0.8;
}
