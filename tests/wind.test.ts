import { describe, expect, it } from 'vitest';
import { BARN, WORLD_H, WORLD_W } from '../src/game/constants';
import { MAX_BITS, type Wind, bitAlpha, bitKind, createWind, gustAt, stepWind } from '../src/game/wind';
import type { Season } from '../src/game/types';

// a repeatable stand-in for Math.random
function seeded(seed = 1): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function run(w: Wind, ms: number, season: Season, rand = seeded()): void {
  for (let t = 0; t < ms; t += 16) stepWind(w, 16, season, rand);
}

describe('cloud shadows', () => {
  it('drift slowly across the farm and come back round from the left', () => {
    const w = createWind(seeded());
    const x0 = w.clouds.map((c) => c.x);
    stepWind(w, 1000, 'summer', seeded());
    w.clouds.forEach((c, i) => { expect(c.x - x0[i]).toBeGreaterThan(0); expect(c.x - x0[i]).toBeLessThan(30); });
    w.clouds[0].x = WORLD_W + 99;
    stepWind(w, 100, 'summer', seeded());
    expect(w.clouds[0].x).toBeLessThan(0);
    expect(w.clouds[0].y).toBeLessThan(WORLD_H);
  });

  it('keep the same number of shadows for good', () => {
    const w = createWind(seeded());
    run(w, 5 * 60 * 1000, 'autumn');
    expect(w.clouds).toHaveLength(3);
    for (const c of w.clouds) expect(c.x).toBeLessThanOrEqual(WORLD_W + 100);
  });
});

describe('gusts', () => {
  it('set out every few seconds and blow right across the world', () => {
    const w = createWind(seeded());
    expect(gustAt(w, 500)).toBe(0);
    run(w, 1600, 'spring');
    expect(w.gusts).toHaveLength(1);
    const front = w.gusts[0].front;
    expect(gustAt(w, front)).toBeGreaterThan(0.5);
    expect(gustAt(w, front + 900)).toBeLessThan(0.01);
    run(w, 60 * 1000, 'spring');
    expect(w.gusts.length).toBeGreaterThan(0);
    expect(w.gusts.length).toBeLessThanOrEqual(3);
    for (const g of w.gusts) expect(g.front).toBeLessThan(WORLD_W + 300);
  });

  it('never blow harder than 1', () => {
    const w = createWind(seeded());
    w.gusts = [{ front: 500, speed: 0, strength: 1 }, { front: 520, speed: 0, strength: 1 }];
    expect(gustAt(w, 510)).toBe(1);
  });
});

describe('petals, seed fluff and leaves', () => {
  it('match the season, and bare winter hedges let nothing go', () => {
    expect(bitKind('spring')).toBe('petal');
    expect(bitKind('summer')).toBe('fluff');
    expect(bitKind('autumn')).toBe('leaf');
    expect(bitKind('winter')).toBeNull();
    for (const s of ['spring', 'summer', 'autumn'] as const) {
      const w = createWind(seeded());
      run(w, 30 * 1000, s);
      expect(w.bits.length).toBeGreaterThan(0);
      expect(w.bits.every((b) => b.kind === bitKind(s))).toBe(true);
    }
    const w = createWind(seeded());
    run(w, 30 * 1000, 'winter');
    expect(w.bits).toHaveLength(0);
  });

  it('only lift while a gust is blowing', () => {
    const w = createWind(seeded());
    w.nextGust = 1e9;
    run(w, 20 * 1000, 'spring');
    expect(w.bits).toHaveLength(0);
  });

  it('stay few, off the barn roof, and fade out before they go', () => {
    const w = createWind(seeded(7));
    const rand = seeded(7);
    let most = 0;
    for (let t = 0; t < 120 * 1000; t += 16) {
      stepWind(w, 16, 'autumn', rand);
      most = Math.max(most, w.bits.length);
      expect(w.bits.length).toBeLessThanOrEqual(MAX_BITS);
      for (const b of w.bits) if (b.age < 20) expect(b.x < BARN.x + BARN.w && b.y > BARN.y && b.y < BARN.y + BARN.h).toBe(false);
    }
    expect(most).toBeGreaterThan(5);
    const b = { x: 0, y: 0, vx: 0, vy: 0, spin: 0, turn: 0, kind: 'leaf' as const, age: 0, life: 8000, seed: 0, tint: 0 };
    expect(bitAlpha({ ...b, age: 0 })).toBe(0);
    expect(bitAlpha({ ...b, age: b.life / 2 })).toBe(1);
    expect(bitAlpha({ ...b, age: b.life })).toBe(0);
    run(w, 15 * 1000, 'winter');
    expect(w.bits).toHaveLength(0);
  });
});
