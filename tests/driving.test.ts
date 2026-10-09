import { describe, expect, it } from 'vitest';
import { CELL, COLS, DOOR_X, FIELD, LANES, ROWS, WORK_HALF } from '../src/game/constants';
import { PACES, autoSteer, laneEnd, laneHold, laneY, nearestLane, paceStep, pilotFrom, routeAhead, turnLegs } from '../src/game/driving';
import { RAW, createField, workStrip } from '../src/game/field';
import { workOffset } from '../src/game/machines';
import { DEFAULT_SETTINGS, decodeSettings, encodeSettings } from '../src/game/settings';
import { BOUNDS, type Vehicle, drive, step } from '../src/game/vehicle';

const none = { up: false, down: false, left: false, right: false };
const up = { ...none, up: true };

describe('pace', () => {
  it('starts at today\'s speed and steps up to twice as fast', () => {
    expect(PACES[0]).toBe(1);
    expect(PACES[PACES.length - 1]).toBe(2);
    expect(paceStep(0, -1)).toBe(0);
    expect(paceStep(0, 1)).toBe(1);
    expect(paceStep(PACES.length - 1, 1)).toBe(PACES.length - 1);
  });

  it('covers ground in proportion to the pace', () => {
    const run = (k: number) => { let v: Vehicle = { x: FIELD.x + 10, y: laneY(2), a: 0, speed: 0 }; for (let i = 0; i < 120; i++) v = drive(v, up, (1 / 60) * k); return v.x - FIELD.x - 10; };
    expect(run(PACES[2]) / run(PACES[0])).toBeGreaterThan(1.9);
  });
});

describe('lane hold', () => {
  it('straightens and settles the machine onto the middle of its lane', () => {
    let v: Vehicle = { x: FIELD.x + 40, y: laneY(3) + 20, a: 0.15, speed: 40 };
    for (let i = 0; i < 60 * 8; i++) v = laneHold(step(v, up, 1 / 60), up, 1 / 60);
    expect(Math.abs(v.y - laneY(3))).toBeLessThan(3);
    expect(Math.abs(v.a)).toBeLessThan(0.02);
  });

  it('works heading west too', () => {
    let v: Vehicle = { x: FIELD.x + FIELD.w - 40, y: laneY(1) - 18, a: Math.PI, speed: 40 };
    for (let i = 0; i < 60 * 8; i++) v = laneHold(step(v, up, 1 / 60), up, 1 / 60);
    expect(Math.abs(v.y - laneY(1))).toBeLessThan(3);
  });

  it('leaves the machine alone while steering, at a standstill, or on a deliberate diagonal', () => {
    const v: Vehicle = { x: FIELD.x + 40, y: laneY(3) + 20, a: 0.1, speed: 40 };
    expect(laneHold(v, { ...up, left: true }, 0.1)).toBe(v);
    expect(laneHold({ ...v, speed: 0 }, none, 0.1)).toEqual({ ...v, speed: 0 });
    expect(laneHold({ ...v, a: 0.8 }, up, 0.1).a).toBe(0.8);
  });
});

// The game's own loop for one machine with ↑ held and auto-steer on (main.ts), headless.
export function pass(off: number, lanes = LANES, hold = true) {
  const f = createField();
  let v: Vehicle = { x: FIELD.x - 30 - Math.max(0, off), y: laneY(0), a: 0, speed: 0 }, p = pilotFrom(v), last: { x: number; y: number } | null = null;
  let done = 0, turns = 0, backing = 0, t = 0;
  while (done < lanes && t < 600) {
    t += 1 / 60;
    const s = autoSteer(v, p, off), before = p.lane, leg = p.leg;
    p = s.pilot;
    if (leg < 0 && p.leg === 0) turns++;
    if (p.lane !== before) done++;
    const c = { up: p.engaged ? s.up : true, down: s.down, left: s.left, right: s.right };
    v = step(v, c, 1 / 60);
    if (hold) v = laneHold(v, c, 1 / 60);
    if (v.speed < -1) backing += 1 / 60;
    const ix = v.x + Math.cos(v.a) * off, iy = v.y + Math.sin(v.a) * off;
    if (v.speed > 1 && ix > FIELD.x && ix < FIELD.x + FIELD.w && iy > FIELD.y && iy < FIELD.y + FIELD.h) {
      const p0 = last && Math.hypot(ix - last.x, iy - last.y) < 12 ? last : { x: ix, y: iy }, n = Math.max(1, Math.ceil(Math.hypot(ix - p0.x, iy - p0.y)));
      for (let k = 1; k <= n; k++) workStrip(f, p0.x + ((ix - p0.x) * k) / n, p0.y + ((iy - p0.y) * k) / n, v.a, WORK_HALF, 'cultivate', 'wheat');
      last = { x: ix, y: iy };
    } else last = null;
    // the last lane only needs to reach its far end
    if (done === lanes - 1 && p.leg >= 0) done++;
  }
  return { f, v, p, t, turns, backing };
}

/** Share of the soil you can see (the field has rounded corners) that is still unworked. */
export function missed(f: ReturnType<typeof createField>): number {
  let seen = 0, raw = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL, R = FIELD.r;
    const cx = Math.min(Math.max(x, R), FIELD.w - R), cy = Math.min(Math.max(y, R), FIELD.h - R);
    if (Math.hypot(x - cx, y - cy) > R) continue;
    seen++; if (f.soil[r * COLS + c] === RAW) raw++;
  }
  return raw / seen;
}

describe('auto-steer', () => {
  it('works the whole field in one pass, with no empty patches at the lane ends or between lanes', () => {
    const r = pass(workOffset('cultivate'));
    expect(missed(r.f)).toBe(0);
    // a three-point turn, backing up, at every lane end
    expect(r.turns).toBe(LANES);
    expect(r.backing).toBeGreaterThan(LANES - 1);
  });

  it('leaves nothing behind with a lifter or a front header either', () => {
    expect(missed(pass(workOffset('roots')).f)).toBe(0);
    expect(missed(pass(workOffset('combine')).f)).toBe(0);
  });

  it('backs round inside the farm and clear of the barn', () => {
    for (const off of [workOffset('cultivate'), workOffset('combine')]) for (const dir of [1, -1]) for (const stepDir of [1, -1]) {
      const legs = turnLegs(3, dir, stepDir, off);
      for (const L of legs) for (let i = 0; i < L.n; i++) {
        expect(L.pts[2 * i]).toBeLessThan(BOUNDS.x1);
        expect(L.pts[2 * i]).toBeGreaterThan(DOOR_X + 40);
      }
      // it ends a lane further on, facing back the way it came
      const end = legs[legs.length - 1].pts;
      expect(end[end.length - 1]).toBeCloseTo(laneY(3 + stepDir), 0);
    }
  });

  it('turns into the next lane and works back the other way', () => {
    const r = pass(workOffset('cultivate'), 2);
    expect(r.p.lane).toBe(1);
    expect(r.p.dir).toBe(-1);
    expect(nearestLane(r.v.y)).toBe(1);
  });

  it('leaves the yard and the way to the barn to the player until the machine is on the field', () => {
    const off = { x: FIELD.x - 40, y: laneY(3) + 30, a: Math.PI, speed: 40 };
    const s = autoSteer(off, pilotFrom(off), workOffset('cultivate'));
    expect(s.left || s.right || s.up || s.down).toBe(false);
    const on = autoSteer({ ...off, x: FIELD.x + 30, a: 0.5 }, s.pilot, workOffset('cultivate'));
    expect(on.left || on.right).toBe(true);
    expect(on.pilot.engaged).toBe(true);
  });

  it('works back up the field after the last lane', () => {
    const p = { lane: LANES - 1, dir: 1, step: 1, leg: -1, idx: 0, engaged: true };
    const s = autoSteer({ x: laneEnd(1, workOffset('cultivate')), y: laneY(LANES - 1), a: 0, speed: 0 }, p, workOffset('cultivate'));
    expect(s.pilot.leg).toBe(0);
    expect(s.pilot.step).toBe(-1);
  });

  it('draws the way ahead: this lane, the turn (backing up in it) and the next lane', () => {
    const v = { x: FIELD.x + 200, y: laneY(2), a: 0, speed: 40 };
    const route = routeAhead(v, { ...pilotFrom(v), engaged: true }, workOffset('cultivate'));
    expect(route.map((r) => r.rev)).toEqual([false, true, false, false]);
    const next = route[route.length - 1].pts;
    expect(next[1]).toBeCloseTo(laneY(3));
  });
});

describe('settings', () => {
  it('round-trips and falls back to the defaults for missing or damaged values', () => {
    const s = { pace: 2, lanes: false, hold: true, auto: true, folded: true, fieldFolded: true };
    expect(decodeSettings(encodeSettings(s))).toEqual(s);
    expect(decodeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings('{"pace":7,"lanes":"yes","auto":true}')).toEqual({ ...DEFAULT_SETTINGS, auto: true });
  });

  it('starts with lane lines and lane hold on, auto-steer off and both cards open', () => {
    expect(DEFAULT_SETTINGS).toEqual({ pace: 0, lanes: true, hold: true, auto: false, folded: false, fieldFolded: false });
  });
});
