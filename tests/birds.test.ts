import { describe, expect, it } from 'vitest';
import { type BirdScene, type Birds, FLOCK, HEDGE_SHY, LANDING, LIFT_DIST, PERCHES, STAY_MS, SWALLOWS, chirpPan, createBirds, machineDist, swallows, trailPoint, updateBirds } from '../src/game/birds';
import { FIELD, LANE, SCALE } from '../src/game/constants';
import { workOffset } from '../src/game/machines';
import type { Season } from '../src/game/types';
import { MAX_SPEED, type Vehicle } from '../src/game/vehicle';

/** A small seeded generator, so every run sees the same birds. */
function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const DT = 1000 / 60;
const LANE_Y = FIELD.y + 3.5 * (FIELD.h / 8);

/** A cultivator driving east along a lane, from `x`, for `ms`; returns where it got to. */
function work(b: Birds, season: Season, x: number, ms: number, rand: () => number): Vehicle {
  const v: Vehicle = { x, y: LANE_Y, a: 0, speed: MAX_SPEED };
  const off = workOffset('cultivate');
  for (let t = 0; t < ms; t += DT) {
    v.x += (MAX_SPEED * DT) / 1000;
    const tines = { x: v.x + off, y: v.y };
    const working = tines.x > FIELD.x && tines.x < FIELD.x + FIELD.w;
    updateBirds(b, { season, working, tines, v, rig: 'cultivate' }, DT, rand);
  }
  return v;
}

function wait(b: Birds, s: Omit<BirdScene, 'working'>, ms: number, rand: () => number): void {
  for (let t = 0; t < ms; t += DT) updateBirds(b, { ...s, working: false }, DT, rand);
}

const onGround = (b: Birds) => b.flock.filter((f) => f.state === 'ground');

describe('birds following the work', () => {
  it('gather on the worked strip behind the implement: gulls in spring, rooks in autumn', () => {
    for (const [season, kind] of [['spring', 'gull'], ['autumn', 'rook'], ['winter', 'gull']] as const) {
      const rand = seeded(7), b = createBirds(rand);
      work(b, season, FIELD.x + 120, 16000, rand);
      const staying = b.flock.filter((f) => f.state !== 'leave');
      expect(staying.length).toBe(FLOCK[season]);
      expect(staying.filter((f) => f.kind === kind).length).toBeGreaterThan(staying.length / 2);
      expect(onGround(b).length).toBeGreaterThan(0);
    }
  });

  it('leave the summer to the swallows', () => {
    const rand = seeded(3), b = createBirds(rand);
    work(b, 'summer', FIELD.x + 120, 20000, rand);
    expect(b.flock.length).toBe(0);
  });

  it('only ever land inside the field, clear of the headland turn bands', () => {
    const rand = seeded(11), b = createBirds(rand);
    // across the whole lane and out past the far edge, where auto-steer turns
    work(b, 'spring', FIELD.x + 60, ((FIELD.w + 200) / MAX_SPEED) * 1000, rand);
    expect(onGround(b).length).toBeGreaterThan(0);
    for (const f of b.flock) if (f.state !== 'leave') {
      expect(f.tx).toBeGreaterThanOrEqual(LANDING.x0); expect(f.tx).toBeLessThanOrEqual(LANDING.x1);
      expect(f.ty).toBeGreaterThanOrEqual(LANDING.y0); expect(f.ty).toBeLessThanOrEqual(LANDING.y1);
    }
    expect(LANDING.x0).toBeGreaterThan(FIELD.x);
    expect(LANDING.x1).toBeLessThan(FIELD.x + FIELD.w);
  });

  it('lift when the machine comes back past, and settle away from it', () => {
    const rand = seeded(5), b = createBirds(rand);
    work(b, 'spring', FIELD.x + 120, 16000, rand);
    const bird = onGround(b)[0];
    expect(bird).toBeDefined();
    // the machine comes back the other way, straight over the bird
    const v: Vehicle = { x: bird.x - 30, y: bird.y, a: Math.PI, speed: MAX_SPEED };
    expect(machineDist(v, 'cultivate', bird.x, bird.y)).toBeLessThan(LIFT_DIST);
    updateBirds(b, { season: 'spring', working: true, tines: { x: v.x - workOffset('cultivate'), y: v.y }, v, rig: 'cultivate' }, DT, rand);
    expect(bird.state).toBe('fly');
    expect(machineDist(v, 'cultivate', bird.tx, bird.ty)).toBeGreaterThan(LIFT_DIST);
  });

  it('stay through a headland turn, then drift off once the work has stopped a while', () => {
    const rand = seeded(9), b = createBirds(rand);
    const v = work(b, 'spring', FIELD.x + 120, 16000, rand);
    const scene = { season: 'spring' as const, tines: { x: v.x, y: v.y }, v, rig: 'cultivate' as const };
    wait(b, scene, STAY_MS - 2000, rand);
    expect(b.flock.filter((f) => f.state !== 'leave').length).toBe(FLOCK.spring);
    wait(b, scene, 40000, rand);
    expect(b.flock.length).toBe(0);
  });

  it('forget old work, so they never come back to a strip worked long ago', () => {
    const rand = seeded(2), b = createBirds(rand);
    work(b, 'spring', FIELD.x + 120, 5000, rand);
    expect(b.trail.length).toBeGreaterThan(0);
    wait(b, { season: 'spring', tines: { x: 0, y: 0 }, v: { x: 0, y: 0, a: 0, speed: 0 }, rig: 'cultivate' }, 30000, rand);
    expect(b.trail.length).toBe(0);
    expect(trailPoint(b, 0, Infinity, rand)).toBeNull();
  });

  it('never change the machine they follow', () => {
    const rand = seeded(4), b = createBirds(rand);
    const v: Vehicle = { x: FIELD.x + 300, y: LANE_Y, a: 0.2, speed: 40 };
    const before = { ...v };
    for (let i = 0; i < 600; i++) updateBirds(b, { season: 'spring', working: true, tines: { x: v.x - 96, y: v.y }, v, rig: 'cultivate' }, DT, rand);
    expect(v).toEqual(before);
  });
});

describe('machine distance', () => {
  it('measures from the rig, front to back, not just its middle', () => {
    const v: Vehicle = { x: 800, y: 400, a: 0, speed: 0 };
    expect(machineDist(v, 'cultivate', 800, 400)).toBeLessThan(0);
    expect(machineDist(v, 'cultivate', 800 - 60 * SCALE, 400)).toBeLessThan(0);   // over the cultivator behind
    expect(machineDist(v, 'cultivate', 800, 400 + 100)).toBeCloseTo(70);
  });
});

describe('hedge birds', () => {
  it('sit on hedge tops beyond the machine’s reach and the turn bands', () => {
    for (const p of PERCHES) {
      const above = p.y < FIELD.y - 40, byTheBarn = p.x < FIELD.x - 200;
      expect(above || byTheBarn).toBe(true);
      expect(p.y).toBeLessThan(LANE.y - 18);
    }
  });

  it('hop to another perch when the machine comes near', () => {
    const rand = seeded(6), b = createBirds(rand), p = b.hedge[0];
    const v: Vehicle = { x: p.x, y: p.y + 60, a: 0, speed: 20 };
    expect(machineDist(v, 'cultivate', p.x, p.y)).toBeLessThan(HEDGE_SHY);
    updateBirds(b, { season: 'spring', working: false, tines: { x: v.x, y: v.y }, v, rig: 'cultivate' }, DT, rand);
    expect(p.flying).toBe(true);
    expect(machineDist(v, 'cultivate', p.tx, p.ty)).toBeGreaterThan(150);
  });

  it('have a robin among the sparrows in winter', () => {
    const rand = seeded(8), b = createBirds(rand), far: Vehicle = { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, a: 0, speed: 0 };
    const scene = { tines: { x: far.x, y: far.y }, v: far, rig: 'cultivate' as const };
    wait(b, { ...scene, season: 'autumn' }, 100, rand);
    expect(b.hedge.every((p) => p.kind === 'sparrow')).toBe(true);
    wait(b, { ...scene, season: 'winter' }, 100, rand);
    expect(b.hedge.filter((p) => p.kind === 'robin').length).toBe(1);
  });
});

describe('swallows', () => {
  it('loop over the field, drifting after the machine while it works', () => {
    const rand = seeded(1), b = createBirds(rand);
    const start = { ...b.swallows };
    work(b, 'summer', FIELD.x + 120, 8000, rand);
    expect(b.swallows.x).toBeLessThan(start.x);
    const all = swallows(b);
    expect(all.length).toBe(SWALLOWS);
    for (const s of all) {
      expect(Math.hypot(s.x - b.swallows.x, s.y - b.swallows.y)).toBeLessThan(260);
      expect(Number.isFinite(s.a)).toBe(true);
    }
  });
});

describe('chirps', () => {
  it('sound from where a bird is, inside the panner’s gentle range', () => {
    const rand = seeded(12), b = createBirds(rand);
    for (let i = 0; i < 50; i++) {
      const pan = chirpPan(b, 'spring', rand)!;
      expect(pan).toBeGreaterThanOrEqual(-0.8); expect(pan).toBeLessThanOrEqual(0.8);
    }
    b.hedge = [];
    expect(chirpPan(b, 'spring', rand)).toBeNull();
  });
});
