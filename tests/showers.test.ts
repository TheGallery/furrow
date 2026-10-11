import { describe, expect, it } from 'vitest';
import { CELL, COLS, FIELD, ROWS } from '../src/game/constants';
import { CELLS, CULTIVATED, type Field, RAW, SEEDED, STUBBLE, WATERED, createField, workCell } from '../src/game/field';
import { BUILD_MS, DRY_MS, DRY_SPELL, FADE_MS, PUDDLES, REACH, type Showers, WET, WET_SPREAD, createShowers, rainAt, rainPan, soakAt, stepShowers, strength } from '../src/game/showers';
import { TURN_BANDS, inTurnBand } from '../src/game/wildlife';
import type { Season } from '../src/game/types';

// a repeatable stand-in for Math.random
function seeded(seed = 1): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function run(s: Showers, f: Field, ms: number, season: Season, rand = seeded()): number[] {
  const changed: number[] = [];
  for (let t = 0; t < ms; t += 16) changed.push(...stepShowers(s, f, 16, season, rand));
  return changed;
}

/** A shower parked over world x at full strength, ready to rain, with no other due for a long while. */
function over(x: number): Showers {
  const s = createShowers(seeded());
  s.wait = 1e9;
  s.shower = { x, speed: 0, age: BUILD_MS, life: 60_000 };
  return s;
}

const colX = (c: number) => FIELD.x + (c + 0.5) * CELL;

describe('when showers come', () => {
  it('are rare: none at first, then only now and then, with long dry spells between', () => {
    const s = createShowers(seeded()), f = createField(), rand = seeded(3);
    run(s, f, 120_000, 'spring', rand);
    expect(s.shower).toBeNull();
    let showers = 0, was = false;
    for (let t = 0; t < 40 * 60_000; t += 16) {
      stepShowers(s, f, 16, 'summer', rand);
      if (s.shower && !was) showers++;
      was = !!s.shower;
    }
    expect(showers).toBeGreaterThanOrEqual(3);
    expect(showers).toBeLessThanOrEqual(40 / (DRY_SPELL[0] / 60_000) + 1);
  });

  it('never start in winter, which keeps its snow', () => {
    const s = createShowers(seeded());
    run(s, createField(), 30 * 60_000, 'winter');
    expect(s.shower).toBeNull();
  });

  it('are short and soft: they build, hold, then fade as they move on', () => {
    const s = createShowers(seeded()), f = createField(), rand = seeded();
    s.wait = 0;
    stepShowers(s, f, 16, 'autumn', rand);
    const sh = s.shower!;
    expect(sh).not.toBeNull();
    expect(sh.life).toBeLessThanOrEqual(40_000);
    expect(strength(sh)).toBeLessThan(0.01);
    const x0 = sh.x;
    let most = 0, steps = 0;
    while (s.shower) { stepShowers(s, f, 16, 'autumn', rand); most = Math.max(most, strength(s.shower)); steps++; }
    expect(most).toBe(1);
    expect(steps * 16).toBeLessThanOrEqual(40_000);
    // it drifts on to the right while it rains
    expect(sh.x).toBeGreaterThan(x0 + 400);
  });

  it('fade out gently, not stop dead, when winter comes in mid-shower', () => {
    const s = over(800);
    stepShowers(s, createField(), 16, 'winter');
    expect(strength(s.shower)).toBeGreaterThan(0.95);
    run(s, createField(), FADE_MS / 2, 'winter');
    expect(strength(s.shower)).toBeGreaterThan(0.3);
    expect(strength(s.shower)).toBeLessThan(0.7);
    run(s, createField(), FADE_MS / 2 + 100, 'winter');
    expect(s.shower).toBeNull();
  });
});

describe('the rain', () => {
  it('falls hardest in the middle of the band and not at all beyond it', () => {
    const s = over(800);
    expect(rainAt(s, 800)).toBe(1);
    expect(rainAt(s, 800 + REACH / 2)).toBeGreaterThan(0.3);
    expect(rainAt(s, 800 + REACH / 2)).toBeLessThan(1);
    expect(rainAt(s, 800 - REACH)).toBe(0);
    expect(rainAt(s, 800 + REACH + 50)).toBe(0);
    expect(rainAt(createShowers(), 800)).toBe(0);
  });

  it('is heard from where it falls', () => {
    expect(rainPan(over(0))).toBeLessThan(-0.9);
    expect(rainPan(over(5000))).toBe(1);
    expect(rainPan(createShowers())).toBe(0);
  });

  it('fills the puddles where it falls, and they dry slowly after', () => {
    const p = PUDDLES[0], s = over(p.x), f = createField();
    run(s, f, 1000, 'spring');
    expect(s.puddles[0]).toBe(1);
    expect(s.puddles[3]).toBe(0);
    s.shower = null;
    run(s, f, DRY_MS / 2, 'spring');
    expect(s.puddles[0]).toBeGreaterThan(0.4);
    expect(s.puddles[0]).toBeLessThan(0.6);
    run(s, f, DRY_MS, 'spring');
    expect(s.puddles[0]).toBe(0);
  });

  it('leaves puddles out of the headland turn bands', () => {
    for (const p of PUDDLES) for (const dx of [-p.rx, p.rx]) expect(inTurnBand(p.x + dx, p.y)).toBe(false);
    expect(TURN_BANDS).toHaveLength(2);
  });
});

describe('the shower waters what is sown', () => {
  it('turns sown cells under it watered, exactly as the sprayer would', () => {
    const f = createField(), sprayed = createField();
    for (let i = 0; i < CELLS; i++) {
      const soil = [RAW, CULTIVATED, SEEDED, WATERED, STUBBLE][i % 5];
      for (const g of [f, sprayed]) { g.soil[i] = soil; g.growth[i] = (i % 7) / 7; g.crop[i] = i % 3; }
    }
    const s = over(FIELD.x + FIELD.w / 2);
    const changed = run(s, f, 1000, 'summer');
    expect(changed.length).toBeGreaterThan(0);
    for (const i of changed) expect(sprayed.soil[i]).toBe(SEEDED);
    for (const i of changed) workCell(sprayed, i, 'water', 'pumpkin');
    // the soil turned just as the sprayer's pass would; growth and what was sown are untouched
    expect(f.soil).toEqual(sprayed.soil);
    expect(f.growth).toEqual(sprayed.growth);
    expect(f.crop).toEqual(sprayed.crop);
  });

  it('waters only where it is raining hard enough, with a soft edge', () => {
    const f = createField();
    f.soil.fill(SEEDED);
    const mid = FIELD.x + FIELD.w / 2, s = over(mid);
    run(s, f, 1000, 'spring');
    for (let i = 0; i < CELLS; i++) expect(f.soil[i] === WATERED).toBe(rainAt(s, colX(i % COLS)) >= soakAt(i));
    // every row is soaked under the heart of the shower, and none far from it
    for (let r = 0; r < ROWS; r++) {
      expect(f.soil[r * COLS + Math.round((mid - FIELD.x) / CELL)]).toBe(WATERED);
      expect(f.soil[r * COLS]).toBe(SEEDED);
    }
    // the edge wanders from row to row instead of running straight down the field
    const edge = (r: number) => { let c = Math.round((mid - FIELD.x) / CELL); while (f.soil[r * COLS + c + 1] === WATERED) c++; return c; };
    const edges = new Set(Array.from({ length: ROWS }, (_, r) => edge(r)));
    expect(edges.size).toBeGreaterThan(10);
  });

  it('soaks each cell at about the same rain, never only at a downpour', () => {
    for (let i = 0; i < CELLS; i += 97) {
      expect(soakAt(i)).toBeGreaterThanOrEqual(WET - WET_SPREAD);
      expect(soakAt(i)).toBeLessThanOrEqual(WET + WET_SPREAD);
    }
  });

  it('waters nothing while it is only spitting', () => {
    const f = createField();
    f.soil.fill(SEEDED);
    const s = over(FIELD.x + FIELD.w / 2);
    s.shower!.age = BUILD_MS * (WET - WET_SPREAD - 0.1);
    expect(run(s, f, 500, 'spring')).toHaveLength(0);
    expect(f.soil.every((v) => v === SEEDED)).toBe(true);
  });

  it('waters seed sown while the rain is still falling', () => {
    const f = createField(), s = over(FIELD.x + FIELD.w / 2), i = Math.floor(ROWS / 2) * COLS + Math.round(FIELD.w / 2 / CELL);
    run(s, f, 1000, 'summer');
    expect(f.soil[i]).toBe(RAW);
    f.soil[i] = SEEDED;
    expect(run(s, f, 300, 'summer')).toEqual([i]);
    expect(f.soil[i]).toBe(WATERED);
  });

  it('passing right over the field waters what it rains on, and nothing it misses', () => {
    const f = createField();
    f.soil.fill(SEEDED);
    const s = createShowers(seeded(5));
    s.shower = { x: FIELD.x - REACH, speed: 30, age: 0, life: 30_000 };
    run(s, f, 31_000, 'spring');
    expect(s.shower).toBeNull();
    const row = Math.floor(ROWS / 2) * COLS, wet = (c: number) => f.soil[row + c] === WATERED;
    // it never watered the far side of the field, which it faded before reaching
    expect(wet(COLS - 1)).toBe(false);
    const watered = Array.from({ length: COLS }, (_, c) => wet(c));
    expect(watered.filter(Boolean).length).toBeGreaterThan(COLS / 4);
    // one soaked stretch, no gaps where the band moved on between soaks
    expect(watered.lastIndexOf(true) - watered.indexOf(true) + 1).toBe(watered.filter(Boolean).length);
    expect(f.soil.filter((v) => v === WATERED).length).toBeGreaterThan(CELLS / 4);
  });
});
