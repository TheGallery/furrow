import { describe, expect, it } from 'vitest';
import { FIELD, LANES } from '../src/game/constants';
import { PACES, autoSteer, laneHold, laneY, nearestLane, paceStep, pilotFrom } from '../src/game/driving';
import { DEFAULT_SETTINGS, decodeSettings, encodeSettings } from '../src/game/settings';
import { type Vehicle, drive, step } from '../src/game/vehicle';

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

describe('auto-steer', () => {
  it('follows a lane to the headland and turns into the next one', () => {
    let v: Vehicle = { x: FIELD.x + 20, y: laneY(0) + 10, a: 0, speed: 0 };
    let p = pilotFrom(v);
    expect(p.lane).toBe(0);
    let turned = false;
    for (let i = 0; i < 60 * 90 && !turned; i++) {
      const s = autoSteer(v, p); p = s.pilot;
      v = step(v, { ...up, left: s.left, right: s.right }, 1 / 60);
      if (p.lane === 1 && !p.turning && v.x < FIELD.x + FIELD.w - 200) turned = true;
    }
    expect(turned).toBe(true);
    expect(p.dir).toBe(-1);
    expect(Math.cos(v.a)).toBeLessThan(-0.9);
    expect(nearestLane(v.y)).toBe(1);
  });

  it('leaves the yard and the way to the barn to the player until the machine is on the field', () => {
    const off = { x: FIELD.x - 40, y: laneY(3) + 30, a: Math.PI, speed: 40 };
    const s = autoSteer(off, pilotFrom(off));
    expect(s.left || s.right).toBe(false);
    const on = autoSteer({ ...off, x: FIELD.x + 30, a: 0.5 }, s.pilot);
    expect(on.left || on.right).toBe(true);
    expect(on.pilot.engaged).toBe(true);
  });

  it('works back up the field after the last lane', () => {
    const p = { lane: LANES - 1, dir: 1, step: 1, turning: false, engaged: true };
    const s = autoSteer({ x: FIELD.x + FIELD.w + 30, y: laneY(LANES - 1), a: 0, speed: 40 }, p);
    expect(s.pilot.lane).toBe(LANES - 2);
    expect(s.pilot.step).toBe(-1);
  });
});

describe('settings', () => {
  it('round-trips and falls back to the defaults for missing or damaged values', () => {
    const s = { pace: 2, lanes: false, hold: true, auto: true, folded: true };
    expect(decodeSettings(encodeSettings(s))).toEqual(s);
    expect(decodeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(decodeSettings('{"pace":7,"lanes":"yes","auto":true}')).toEqual({ ...DEFAULT_SETTINGS, auto: true });
  });

  it('starts with lane lines and lane hold on, auto-steer off and the card open', () => {
    expect(DEFAULT_SETTINGS).toEqual({ pace: 0, lanes: true, hold: true, auto: false, folded: false });
  });
});
