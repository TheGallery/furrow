import { describe, expect, it } from 'vitest';
import { type Animals, HOME, PEN, YARD, createAnimals, roostSpot, updateAnimals } from '../src/game/animals';
import { FLOCK, createBirds, updateBirds } from '../src/game/birds';
import { DOOR_Y, FIELD, LANE_H } from '../src/game/constants';
import { NIGHT_MUL, afterDusk, hourOf, lightAt } from '../src/game/daylight';
import { parkX, workOffset } from '../src/game/machines';
import { MAX_SPEED, type Vehicle } from '../src/game/vehicle';
import { createWildlife, stepWildlife, visiting } from '../src/game/wildlife';

/** A small seeded generator, so every run sees the same animals. */
function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const DT = 1000 / 60;
const PARKED: Vehicle = { x: parkX('cultivate'), y: DOOR_Y, a: 0, speed: 0 };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** What a white pixel comes out as under the light: the multiply, channel by channel, 0..1. */
const lit = (h: number) => { const L = lightAt(h); return rgb(L.tint).map((c) => 1 - L.mul * (1 - c / 255)); };

describe('the light through the day', () => {
  it('reads the hour off the player\'s own clock', () => {
    expect(hourOf(new Date(2026, 9, 10, 0, 0, 0))).toBe(0);
    expect(hourOf(new Date(2026, 9, 10, 18, 30, 0))).toBeCloseTo(18.5);
    expect(hourOf(new Date(2026, 9, 10, 23, 59, 59))).toBeLessThan(24);
  });

  it('is clear through the day, golden in the evening and blue at night', () => {
    expect(lightAt(12).mul).toBeLessThan(0.03);
    expect(lightAt(12).dark).toBe(0);
    expect(lightAt(19).warm).toBeGreaterThan(0.15);
    const [r, , b] = rgb(lightAt(1).tint);
    expect(b).toBeGreaterThan(r);
    expect(lightAt(1).dark).toBe(1);
  });

  it('never gets dark enough to hide the field or the machines', () => {
    for (let h = 0; h < 24; h += 1 / 60) {
      expect(lightAt(h).mul).toBeLessThanOrEqual(NIGHT_MUL + 1e-9);
      for (const c of lit(h)) expect(c).toBeGreaterThan(0.6);
    }
  });

  it('changes gently: no jumps from one minute to the next, round midnight too', () => {
    for (let h = 0; h < 24; h += 1 / 60) {
      const a = lightAt(h), b = lightAt(h + 1 / 60);
      expect(Math.abs(a.mul - b.mul)).toBeLessThan(0.01);
      expect(Math.abs(a.dark - b.dark)).toBeLessThan(0.02);
      lit(h).forEach((c, i) => expect(Math.abs(c - lit(h + 1 / 60)[i])).toBeLessThan(0.01));
    }
    expect(lightAt(24)).toEqual(lightAt(0));
    expect(lightAt(-1)).toEqual(lightAt(23));
  });

  it('settles the farm after dusk and wakes it at dawn', () => {
    expect(afterDusk(lightAt(14).dark)).toBe(false);
    expect(afterDusk(lightAt(18.5).dark)).toBe(false);
    expect(afterDusk(lightAt(21).dark)).toBe(true);
    expect(afterDusk(lightAt(3).dark)).toBe(true);
    expect(afterDusk(lightAt(7.5).dark)).toBe(false);
  });
});

describe('the farm at night', () => {
  const night = lightAt(23).dark;
  const wait = (a: Animals, ms: number, rand: () => number, dark = night) => {
    for (let t = 0; t < ms; t += DT) updateAnimals(a, { season: 'summer', v: PARKED, rig: 'cultivate', driving: false, night: dark }, DT, rand);
  };

  it('the hens roost in a row by the bales, fluffed up and still, and come out again in the morning', () => {
    const rand = seeded(4), a = createAnimals('spring', rand);
    wait(a, 60000, rand);
    expect(a.roost).toBe(true);
    a.hens.forEach((h, i) => { expect(Math.hypot(h.x - roostSpot(i).x, h.y - roostSpot(i).y)).toBeLessThan(3); expect(h.moving).toBe(false); expect(h.peck).toBe(0); });
    const still = a.hens.map((h) => ({ x: h.x, y: h.y }));
    wait(a, 20000, rand);
    a.hens.forEach((h, i) => expect(Math.hypot(h.x - still[i].x, h.y - still[i].y)).toBeLessThan(0.01));
    a.hens.forEach((_, i) => { const p = roostSpot(i); expect(p.x).toBeGreaterThan(YARD.x); expect(p.x).toBeLessThan(YARD.x + YARD.w); expect(p.y).toBeLessThan(YARD.y + YARD.h); });
    wait(a, 30000, rand, 0);
    expect(a.roost).toBe(false);
    expect(a.hens.some((h, i) => Math.hypot(h.x - roostSpot(i).x, h.y - roostSpot(i).y) > 3)).toBe(true);
  });

  it('the sheep lie down in the pen and stay down until morning', () => {
    const rand = seeded(5), a = createAnimals('summer', rand);
    wait(a, 40000, rand);
    for (const s of a.sheep) { expect(s.state).toBe('lie'); expect(s.x).toBeGreaterThan(PEN.x); expect(s.x).toBeLessThan(PEN.x + PEN.w); }
    wait(a, 120000, rand);
    expect(a.sheep.every((s) => s.state === 'lie')).toBe(true);
  });

  it('the dog stays curled up at home rather than going out with the machine', () => {
    const rand = seeded(6), a = createAnimals('summer', rand);
    const v: Vehicle = { x: FIELD.x + 500, y: FIELD.y + LANE_H * 1.5, a: 0, speed: 0 };
    for (let t = 0; t < 30000; t += DT) updateAnimals(a, { season: 'summer', v, rig: 'cultivate', driving: true, night }, DT, rand);
    expect(Math.hypot(a.dog.x - HOME.x, a.dog.y - HOME.y)).toBeLessThan(3);
    expect(a.dog.pose).toBe('curl');
  });

  it('the gulls stay away from the work, and the hedge birds sit tight', () => {
    const rand = seeded(7), b = createBirds(rand), off = workOffset('cultivate');
    const perched = b.hedge.map((p) => ({ x: p.x, y: p.y }));
    const v: Vehicle = { x: FIELD.x + 120, y: FIELD.y + LANE_H * 3.5, a: 0, speed: MAX_SPEED };
    for (let t = 0; t < 20000; t += DT) {
      v.x += (MAX_SPEED * DT) / 1000;
      updateBirds(b, { season: 'spring', working: true, tines: { x: v.x + off, y: v.y }, v, rig: 'cultivate', night }, DT, rand);
    }
    expect(FLOCK.spring).toBeGreaterThan(0);
    expect(b.flock.length).toBe(0);
    // the machine drove the middle of the field, well away from the hedges
    b.hedge.forEach((p, i) => { expect(p.x).toBe(perched[i].x); expect(p.y).toBe(perched[i].y); });
  });

  it('the hare and the fox come by more often after dark', () => {
    const count = (dark: number) => {
      const w = createWildlife(seeded(2)), rand = seeded(9);
      let visits = 0, was = false;
      for (let t = 0; t < 30 * 60 * 1000; t += 16) {
        stepWildlife(w, { season: 'autumn', v: PARKED, rig: 'cultivate', night: dark }, 16, rand);
        if (visiting(w) && !was) visits++;
        was = visiting(w);
      }
      return visits;
    };
    expect(count(1)).toBeGreaterThan(count(0));
  });
});
