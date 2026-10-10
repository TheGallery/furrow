import { describe, expect, it } from 'vitest';
import { FIELD, LANE, LANES, WORLD_H, WORLD_W } from '../src/game/constants';
import { laneY, turnLegs } from '../src/game/driving';
import { workOffset } from '../src/game/machines';
import { LANE_MID, type Lane, OFF, type Passer, type PasserKind, QUIET, SPAWN, SPEED, WAVE_DIST, createLane, inTheWay, laneOffset, pickKind, stepLane } from '../src/game/lane';
import type { Rig, Season } from '../src/game/types';
import { BOUNDS, type Vehicle } from '../src/game/vehicle';

// a repeatable stand-in for Math.random
function seeded(seed = 1): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const away: Vehicle = { x: FIELD.x + 200, y: FIELD.y + 80, a: 0, speed: 40 };
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const RIGS: Rig[] = ['cultivate', 'drill-hopper', 'drill-precision', 'drill-few', 'spray', 'combine', 'roots', 'trailer'];
const KINDS = Object.keys(SPEED) as PasserKind[];
const passer = (kind: PasserKind, x: number, dir: number): Passer => ({ kind, x, dir, speed: SPEED[kind], v: SPEED[kind], roll: 0, wave: 0, seed: 0 });

function run(l: Lane, ms: number, season: Season, v: Vehicle = away, rand = seeded(), each?: () => void, rig: Rig = 'cultivate'): void {
  for (let t = 0; t < ms; t += 16) { stepLane(l, 16, season, v, rig, rand); each?.(); }
}

describe('the lane', () => {
  it('runs along the bottom of the farm, below the field and out of the machine’s reach', () => {
    expect(LANE.y).toBeGreaterThan(FIELD.y + FIELD.h);
    expect(LANE.y + LANE.h).toBeLessThan(WORLD_H);
    expect(BOUNDS.y1).toBeGreaterThan(FIELD.y + FIELD.h);
    expect(BOUNDS.y1).toBeLessThan(LANE.y);
  });

  it('keeps every passer-by on the lane: vehicles to the left, people to the verge', () => {
    for (const kind of ['van', 'walker', 'bike', 'flock'] as const) for (const dir of [1, -1]) {
      const y = LANE_MID + laneOffset(passer(kind, 0, dir));
      expect(y).toBeGreaterThan(LANE.y + 8);
      expect(y).toBeLessThan(LANE.y + LANE.h - 8);
    }
    // heading east (y grows downwards) keeps to the north side of the lane
    expect(laneOffset(passer('van', 0, 1))).toBeLessThan(0);
  });
});

describe('passers-by', () => {
  it('come one at a time, with long quiet spells between them', () => {
    const l = createLane(seeded());
    let most = 0, gaps = 0, wasEmpty = true, emptyFor = 0, shortest = Infinity, seen = 0;
    run(l, 30 * 60 * 1000, 'summer', away, seeded(3), () => {
      most = Math.max(most, l.passers.length);
      const empty = !l.passers.length;
      if (empty) emptyFor += 16;
      if (!empty && wasEmpty) { seen++; if (seen > 1) { gaps++; shortest = Math.min(shortest, emptyFor); } emptyFor = 0; }
      wasEmpty = empty;
    });
    expect(most).toBe(1);
    expect(gaps).toBeGreaterThan(10);
    expect(shortest).toBeGreaterThanOrEqual(QUIET[0] - 16);
  });

  it('set off and leave beyond the world’s edges, so they never pop in or out in view', () => {
    const l = createLane(seeded());
    const rand = seeded(5);
    for (let t = 0; t < 20 * 60 * 1000; t += 16) {
      const before = l.passers.slice();
      stepLane(l, 16, 'spring', away, 'cultivate', rand);
      for (const p of l.passers) if (!before.includes(p)) expect(p.x < 0 || p.x > WORLD_W).toBe(true);
      for (const p of before) if (!l.passers.includes(p)) expect(Math.abs(p.x - WORLD_W / 2)).toBeGreaterThan(WORLD_W / 2 + OFF - 10);
    }
  });

  it('change with the season: bales in summer, pumpkins in autumn, feed in winter', () => {
    for (const s of SEASONS) {
      const rand = seeded(11), kinds = new Set<string>();
      for (let i = 0; i < 400; i++) kinds.add(pickKind(s, rand));
      expect([...kinds].sort()).toEqual(SPAWN[s].map(([k]) => k).sort());
    }
    expect(SPAWN.summer.map(([k]) => k)).toContain('bales');
    expect(SPAWN.autumn.map(([k]) => k)).toContain('pumpkins');
    expect(SPAWN.winter.map(([k]) => k)).toContain('feed');
    for (const s of ['summer', 'winter'] as const) expect(SPAWN[s].map(([k]) => k)).not.toContain('flock');
  });

  it('wave when the machine works low on the field nearby, and stop once it has gone', () => {
    const l = createLane(seeded());
    l.passers.push({ ...passer('walker', 900, 1), speed: 0, v: 0 });
    run(l, 1500, 'spring', { ...away, x: 900 + WAVE_DIST - 40, y: FIELD.y + FIELD.h - 40 });
    expect(l.passers[0].wave).toBeGreaterThan(0.9);
    run(l, 3000, 'spring', away);
    expect(l.passers[0].wave).toBeLessThan(0.05);
    run(l, 1500, 'spring', { ...away, x: 900, y: FIELD.y + 60 });
    expect(l.passers[0].wave).toBeLessThan(0.05);
  });

  it('never touch the machine', () => {
    const l = createLane(seeded()), v = { ...away };
    run(l, 2 * 60 * 1000, 'autumn', v, seeded(2));
    expect(v).toEqual(away);
  });
});

describe('giving way', () => {
  it('slows and waits while the machine noses onto the lane ahead, then goes on at its own pace', () => {
    const l = createLane(seeded());
    l.passers.push(passer('van', 400, 1));
    const parked: Vehicle = { x: 700, y: BOUNDS.y1, a: Math.PI / 2, speed: 0 };
    run(l, 20000, 'summer', parked);
    const p = l.passers[0];
    expect(p.v).toBe(0);
    expect(p.x).toBeLessThan(parked.x);
    expect(inTheWay(p, parked, 'cultivate')).toBe(true);
    run(l, 3000, 'summer', away);
    expect(p.v).toBe(SPEED.van);
    expect(p.x).toBeGreaterThan(parked.x);
  });

  it('never waits for auto-steer working the bottom lane, only beside the turn bands while it swings round', () => {
    const middle = (x: number) => x > FIELD.x && x < FIELD.x + FIELD.w;
    let waits = 0;
    for (const rig of RIGS) for (const dir of [1, -1]) {
      for (let x = FIELD.x + 60; x < FIELD.x + FIELD.w - 60; x += 40) {
        const v: Vehicle = { x, y: laneY(LANES - 1), a: dir > 0 ? 0 : Math.PI, speed: 40 };
        for (const kind of KINDS) for (const pd of [1, -1]) for (const dx of [-120, 0, 120]) expect(inTheWay(passer(kind, x + dx, pd), v, rig)).toBe(false);
      }
      for (const [lane, stepDir] of [[LANES - 2, 1], [LANES - 1, -1]]) for (const L of turnLegs(lane, dir, stepDir, workOffset(rig))) {
        for (let i = 1; i < L.n; i += 4) {
          const a = Math.atan2(L.pts[2 * i + 1] - L.pts[2 * i - 1], L.pts[2 * i] - L.pts[2 * i - 2]) + (L.rev ? Math.PI : 0);
          const v: Vehicle = { x: L.pts[2 * i], y: L.pts[2 * i + 1], a, speed: 20 };
          for (const kind of KINDS) for (const pd of [1, -1]) for (let x = 0; x < WORLD_W; x += 30) {
            const p = passer(kind, x, pd);
            // only ever for a machine out in a turn band, and only near it
            if (inTheWay(p, v, rig)) { waits++; expect(middle(v.x)).toBe(false); expect(Math.abs(x - v.x)).toBeLessThan(320); }
          }
        }
      }
    }
    expect(waits).toBeGreaterThan(0);
  });
});
