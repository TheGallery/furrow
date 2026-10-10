import { describe, expect, it } from 'vitest';
import {
  type AnimalScene, type Animals, type Box, GATE, HOME, PATH_HALF, PEN, TURN_BANDS, VERGE, VERGE_GATE, WINTER_FIELD, YARD, YARD_GATE,
  clearToCross, createAnimals, gateOpen, henIndoors, inTheWay, inTurnBand, machineDist, stepAside, updateAnimals,
} from '../src/game/animals';
import { BARN, DOOR_X, DOOR_Y, FIELD, LANES, SCALE } from '../src/game/constants';
import { autoSteer, laneY, pilotFrom, subSteps, turnLegs } from '../src/game/driving';
import { EXT, parkX, workOffset } from '../src/game/machines';
import type { Rig, Season } from '../src/game/types';
import { MAX_SPEED, type Vehicle, step } from '../src/game/vehicle';

/** A small seeded generator, so every run sees the same animals. */
function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const DT = 1000 / 60;
const RIGS = Object.keys(EXT) as Rig[];
/** The machine parked in the barn, out of everyone's way. */
const PARKED: Vehicle = { x: parkX('cultivate'), y: DOOR_Y, a: 0, speed: 0 };
const inBox = (r: Box, p: { x: number; y: number }, m = 0) => p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;
const ewes = (a: Animals) => a.sheep.filter((s) => !s.lamb);

function wait(a: Animals, s: AnimalScene, ms: number, rand: () => number): void {
  for (let t = 0; t < ms; t += DT) updateAnimals(a, s, DT, rand);
}

/** Every corner of the machine and its implement along each of auto-steer's headland turns, for every rig. */
function turnFootprint(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const rig of RIGS) {
    const off = workOffset(rig), [r0, r1] = EXT[rig];
    for (let lane = 0; lane < LANES; lane++) for (const dir of [-1, 1]) for (const stepTo of [-1, 1]) {
      if (lane + stepTo < 0 || lane + stepTo >= LANES) continue;
      for (const L of turnLegs(lane, dir, stepTo, off)) for (let i = 0; i < L.n - 1; i++) {
        const x = L.pts[2 * i], y = L.pts[2 * i + 1];
        const a = Math.atan2(L.pts[2 * i + 3] - y, L.pts[2 * i + 2] - x) + (L.rev ? Math.PI : 0);
        for (let r = r0; r <= r1; r += 4) for (const side of [-1, 0, 1]) {
          out.push({ x: x + Math.cos(a) * r * SCALE - Math.sin(a) * PATH_HALF * side, y: y + Math.sin(a) * r * SCALE + Math.cos(a) * PATH_HALF * side });
        }
      }
    }
  }
  return out;
}

/**
 * The game's loop for a machine with ↑ held and auto-steer on, working every lane from the top-left,
 * with the animals watching. `look` sees each step.
 */
function autoRun(a: Animals, season: Season, rig: Rig, rand: () => number, look: (v: Vehicle) => void): void {
  const off = workOffset(rig);
  let v: Vehicle = { x: FIELD.x - 30 - Math.max(0, off), y: laneY(0), a: 0, speed: 0 }, p = pilotFrom(v);
  const { n, h } = subSteps(1 / 60);
  for (let t = 0; t < 420 && !(p.lane === LANES - 1 && p.leg < 0 && p.dir < 0 && v.x < FIELD.x + 200); t += 1 / 60) {
    for (let k = 0; k < n; k++) {
      // ↑ held: auto-steer drives every key once it is on the field (main.ts)
      const c = { up: true, down: false, left: false, right: false }, s = autoSteer(v, p, off);
      p = s.pilot;
      if (p.engaged) { c.up = s.up; c.down = s.down; c.left = s.left; c.right = s.right; }
      v = step(v, c, h);
    }
    updateAnimals(a, { season, v, rig, driving: true }, DT, rand);
    look(v);
  }
}

describe('where the animals live', () => {
  const foot = turnFootprint();

  it('names turn bands that hold every headland turn auto-steer makes', () => {
    expect(foot.filter((p) => (p.x < FIELD.x || p.x > FIELD.x + FIELD.w) && !inTurnBand(p.x))).toEqual([]);
  });

  it('keeps the pen, the yard, the dog\'s spots and the winter field clear of the turns', () => {
    for (const box of [PEN, YARD, WINTER_FIELD]) expect(foot.filter((p) => inBox(box, p, 4))).toEqual([]);
    for (const box of [PEN, YARD]) expect(inTurnBand(box.x) || inTurnBand(box.x + box.w)).toBe(false);
    for (const p of [HOME, YARD_GATE, VERGE_GATE, { x: VERGE.x1, y: VERGE.y }]) expect(inTurnBand(p.x)).toBe(false);
    expect(foot.filter((p) => p.y < VERGE.y + 12 && p.x > VERGE.x0 - 12 && p.x < VERGE.x1 + 12)).toEqual([]);
  });

  it('tucks the pen under the barn and above the band under the field', () => {
    expect(PEN.y).toBeGreaterThan(BARN.y + BARN.h);
    expect(PEN.x + PEN.w).toBeLessThan(DOOR_X);
    expect(PEN.y + PEN.h).toBeLessThan(FIELD.y + FIELD.h + 10);
    expect(GATE.x).toBe(PEN.x + PEN.w);
    expect(YARD.y + YARD.h).toBeLessThan(BARN.y);
  });

  it('starts the flock in the pen, or out on the field in winter', () => {
    const rand = seeded(2);
    const spring = createAnimals('spring', rand), winter = createAnimals('winter', rand);
    expect(spring.flock).toBe('pen');
    expect(spring.sheep.every((s) => inBox(PEN, s))).toBe(true);
    expect(gateOpen(spring)).toBe(false);
    expect(winter.flock).toBe('field');
    expect(winter.sheep.every((s) => inBox(WINTER_FIELD, s))).toBe(true);
    expect(gateOpen(winter)).toBe(true);
  });
});

describe('sheep', () => {
  it('graze in the pen all summer, the lambs close by their mothers', () => {
    const rand = seeded(3), a = createAnimals('spring', rand), scene = { season: 'spring' as Season, v: PARKED, rig: 'cultivate' as Rig, driving: false };
    for (let i = 0; i < 6; i++) {
      wait(a, scene, 30000, rand);
      expect(a.sheep.every((s) => inBox(PEN, s))).toBe(true);
      for (const l of a.sheep.filter((s) => s.lamb)) expect(Math.hypot(l.x - a.sheep[l.mum].x, l.y - a.sheep[l.mum].y)).toBeLessThan(40);
    }
    expect(a.flock).toBe('pen');
  });

  it('walk out to the field for the winter and come home in the spring', () => {
    const rand = seeded(4), a = createAnimals('autumn', rand), parked = { v: PARKED, rig: 'cultivate' as Rig, driving: false };
    wait(a, { ...parked, season: 'winter' }, 2000, rand);
    expect(a.flock).toBe('out');
    expect(gateOpen(a)).toBe(true);
    wait(a, { ...parked, season: 'winter' }, 150000, rand);
    expect(a.flock).toBe('field');
    expect(ewes(a).every((s) => inBox(WINTER_FIELD, s))).toBe(true);
    wait(a, { ...parked, season: 'spring' }, 150000, rand);
    expect(a.flock).toBe('pen');
    expect(gateOpen(a)).toBe(false);
    expect(a.sheep.every((s) => inBox(PEN, s))).toBe(true);
  });

  it('wait at the gate while the machine is at the turn, and go once it has gone', () => {
    const rand = seeded(5), a = createAnimals('winter', rand);
    a.flock = 'pen';
    for (const s of a.sheep) { s.x = PEN.x + 30; s.y = PEN.y + 40; }
    const turning: Vehicle = { x: FIELD.x - 90, y: laneY(LANES - 1), a: Math.PI, speed: 0 };
    wait(a, { season: 'winter', v: turning, rig: 'cultivate', driving: true }, 60000, rand);
    expect(a.flock).toBe('out');
    expect(ewes(a).every((s) => inBox(PEN, s, 2))).toBe(true);
    const far: Vehicle = { x: FIELD.x + FIELD.w - 200, y: laneY(2), a: 0, speed: 0 };
    wait(a, { season: 'winter', v: far, rig: 'cultivate', driving: true }, 20000, rand);
    expect(ewes(a).some((s) => s.x > PEN.x + PEN.w + 40)).toBe(true);
  });

  it('step aside only as far as the pen\'s rails, and settle again once the machine has gone', () => {
    const rand = seeded(8), a = createAnimals('spring', rand), e = ewes(a)[0];
    e.x = PEN.x + PEN.w / 2; e.y = PEN.y + 12; e.state = 'graze'; e.timer = 1e9;
    const passing: Vehicle = { x: PEN.x + PEN.w + 40, y: e.y + 10, a: Math.PI, speed: 0 };
    expect(inTheWay(passing, 'cultivate', e.x, e.y, 70)).toBe(true);
    expect(inBox(PEN, stepAside(passing, e, PEN))).toBe(false);
    updateAnimals(a, { season: 'spring', v: passing, rig: 'cultivate', driving: true }, DT, rand);
    expect(e.state).toBe('walk');
    expect(inBox(PEN, { x: e.tx, y: e.ty }, -8)).toBe(true);
    wait(a, { season: 'spring', v: PARKED, rig: 'cultivate', driving: false }, 10000, rand);
    expect(e.state).not.toBe('walk');
  });

  it('step out of auto-steer\'s way long before it reaches them, and never sit at the turns', () => {
    for (const rig of ['cultivate', 'combine'] as Rig[]) {
      const rand = seeded(6), a = createAnimals('winter', rand);
      let closest = Infinity;
      autoRun(a, 'winter', rig, rand, (v) => {
        for (const s of a.sheep) {
          closest = Math.min(closest, machineDist(v, rig, s.x, s.y));
          if (s.state === 'graze' || s.state === 'lie') expect(inTurnBand(s.x)).toBe(false);
        }
      });
      // the distance is to the rig's centre line, less 30: past 14 a sheep is clear of the implement's edge
      expect(closest).toBeGreaterThan(PATH_HALF - 30);
    }
  });
});

describe('hens', () => {
  it('stay among the bales, with chicks trailing a mother, and only three out in the winter', () => {
    const rand = seeded(7), a = createAnimals('spring', rand), scene = { v: PARKED, rig: 'cultivate' as Rig, driving: false };
    wait(a, { ...scene, season: 'spring' }, 120000, rand);
    expect(a.hens.every((h) => inBox(YARD, h, 1))).toBe(true);
    for (const [i, c] of a.chicks.entries()) {
      const lead = i ? a.chicks[i - 1] : a.hens[0];
      expect(Math.hypot(c.x - lead.x, c.y - lead.y)).toBeLessThan(20);
    }
    expect(a.hens.filter((_, i) => !henIndoors('winter', i))).toHaveLength(3);
    expect(a.hens.filter((_, i) => !henIndoors('summer', i))).toHaveLength(a.hens.length);
  });

  it('scatter from a machine driven into the yard', () => {
    const rand = seeded(8), a = createAnimals('summer', rand);
    const h = a.hens[0], v: Vehicle = { x: h.x - 300, y: h.y, a: 0, speed: 30 };
    let closest = Infinity;
    for (let t = 0; t < 14000; t += DT) {
      v.x += (30 * DT) / 1000;
      updateAnimals(a, { season: 'summer', v, rig: 'cultivate', driving: true }, DT, rand);
      closest = Math.min(closest, machineDist(v, 'cultivate', h.x, h.y));
    }
    expect(closest).toBeGreaterThan(PATH_HALF - 30);
  });
});

describe('the dog', () => {
  it('trots out to the verge and paces the machine along it, a little behind', () => {
    const rand = seeded(9), a = createAnimals('summer', rand);
    const v: Vehicle = { x: FIELD.x + 700, y: laneY(3), a: 0, speed: 0 };
    wait(a, { season: 'summer', v, rig: 'cultivate', driving: true }, 30000, rand);
    expect(a.dog.y).toBeCloseTo(VERGE.y, 0);
    expect(Math.abs(a.dog.x - (v.x - 40))).toBeLessThan(75);
    for (let t = 0; t < 12000; t += DT) { v.x += (MAX_SPEED * DT) / 1000 / 2; updateAnimals(a, { season: 'summer', v, rig: 'cultivate', driving: true }, DT, rand); }
    expect(Math.abs(a.dog.x - (v.x - 40))).toBeLessThan(75);
    expect(a.dog.x).toBeLessThanOrEqual(VERGE.x1);
  });

  it('goes home to the bales when the machine does, and curls up there in the winter', () => {
    const rand = seeded(10), a = createAnimals('autumn', rand);
    wait(a, { season: 'autumn', v: { x: FIELD.x + 600, y: laneY(1), a: 0, speed: 0 }, rig: 'cultivate', driving: true }, 30000, rand);
    expect(a.dog.x).toBeGreaterThan(VERGE.x0 - 1);
    wait(a, { season: 'autumn', v: PARKED, rig: 'cultivate', driving: false }, 30000, rand);
    expect(Math.hypot(a.dog.x - HOME.x, a.dog.y - HOME.y)).toBeLessThan(3);
    wait(a, { season: 'winter', v: { x: FIELD.x + 600, y: laneY(1), a: 0, speed: 0 }, rig: 'cultivate', driving: true }, 5000, rand);
    expect(a.dog.pose).toBe('curl');
  });

  it('crosses the turn band only when the machine is well away, and never stops in it', () => {
    for (const season of ['spring', 'autumn'] as Season[]) {
      const rand = seeded(11), a = createAnimals(season, rand);
      let crossed = false, closest = Infinity;
      autoRun(a, season, 'cultivate', rand, (v) => {
        if (inTurnBand(a.dog.x)) { crossed = true; expect(a.dog.pose).toBe('trot'); }
        closest = Math.min(closest, machineDist(v, 'cultivate', a.dog.x, a.dog.y));
      });
      expect(crossed).toBe(true);
      expect(closest).toBeGreaterThan(40);
    }
  });
});

describe('keeping out of the way', () => {
  const v: Vehicle = { x: 800, y: 400, a: 0, speed: MAX_SPEED };

  it('reads a machine coming along its path from well ahead, but not one going away', () => {
    expect(inTheWay(v, 'cultivate', 1100, 410, 60)).toBe(true);
    expect(inTheWay(v, 'cultivate', 1100, 400 + PATH_HALF + 20, 60)).toBe(false);
    expect(inTheWay(v, 'cultivate', 500, 400, 60)).toBe(false);
    expect(inTheWay({ ...v, speed: 0 }, 'cultivate', 1100, 410, 60)).toBe(false);
  });

  it('steps aside square to the machine, on its own side, clear of the path', () => {
    const p = stepAside(v, { x: 1000, y: 405 }, null), q = stepAside(v, { x: 1000, y: 395 }, null);
    expect(p.x).toBeCloseTo(1000); expect(p.y - 400).toBeGreaterThan(PATH_HALF + 9);
    expect(400 - q.y).toBeGreaterThan(PATH_HALF + 9);
    // a box that leaves no room on that side is overstepped rather than crossing the machine's path
    expect(stepAside(v, { x: 1000, y: 405 }, { x: 900, y: 380, w: 200, h: 40 }).y).toBeGreaterThan(400 + PATH_HALF);
  });

  it('only lets an animal cross when the machine is in the barn or well away', () => {
    const scene = (veh: Vehicle): AnimalScene => ({ season: 'summer', v: veh, rig: 'cultivate', driving: true });
    expect(clearToCross(scene(PARKED), YARD_GATE, VERGE_GATE)).toBe(true);
    expect(clearToCross(scene({ x: FIELD.x - 80, y: laneY(0), a: Math.PI, speed: 0 }), YARD_GATE, VERGE_GATE)).toBe(false);
    expect(clearToCross(scene({ x: FIELD.x + 900, y: laneY(6), a: 0, speed: 0 }), YARD_GATE, VERGE_GATE)).toBe(true);
    // the same place at full speed toward the corner is too close
    expect(clearToCross(scene({ x: FIELD.x + 500, y: laneY(0), a: Math.PI, speed: MAX_SPEED }), YARD_GATE, VERGE_GATE)).toBe(false);
  });

  it('keeps every turn band clear of the places animals settle', () => {
    expect(TURN_BANDS[0].x1).toBeLessThan(VERGE.x0);
    expect(TURN_BANDS[1].x0).toBeGreaterThan(VERGE.x1);
    expect(TURN_BANDS[0].x0).toBeGreaterThan(PEN.x + PEN.w);
  });
});
