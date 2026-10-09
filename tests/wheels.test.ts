import { describe, expect, it } from 'vitest';
import { MAX_SPEED, drive } from '../src/game/vehicle';
import { MAX_STEER, STRAIGHT, rolled, steerToward, treadOffset, turnWheels } from '../src/game/wheels';

const none = { up: false, down: false, left: false, right: false };

describe('steered wheels', () => {
  it('turn with the steering, eased and held to a gentle lock', () => {
    const first = steerToward(0, 1, 1 / 60);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(MAX_STEER);
    let a = 0;
    for (let i = 0; i < 120; i++) a = steerToward(a, 1, 1 / 60);
    expect(a).toBeCloseTo(MAX_STEER);
    expect(MAX_STEER).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) a = steerToward(a, -1, 1 / 60);
    expect(a).toBeCloseTo(-MAX_STEER);
  });

  it('come back straight once the steering is let go', () => {
    let a = MAX_STEER;
    for (let i = 0; i < 60; i++) a = steerToward(a, 0, 1 / 60);
    expect(a).toBe(0);
  });

  it('never overshoot the lock, even on a long frame', () => {
    expect(steerToward(0, 1, 5)).toBe(MAX_STEER);
    expect(steerToward(0, -3, 5)).toBe(-MAX_STEER);
  });
});

describe('tread', () => {
  it('rolls forward driving forward, backward reversing, and not at all standing still', () => {
    const at = { x: 100, y: 100, a: 0.6, speed: 0 };
    const fwd = drive({ ...at, speed: MAX_SPEED }, { ...none, up: true }, 1 / 60);
    const back = drive({ ...at, speed: -20 }, { ...none, down: true }, 1 / 60);
    const still = drive(at, none, 1 / 60);
    expect(rolled(at, fwd, fwd.a)).toBeGreaterThan(0);
    expect(rolled(at, back, back.a)).toBeLessThan(0);
    expect(rolled(at, still, still.a)).toBe(0);
  });

  it('keeps the distance rolled and stops when the machine does', () => {
    let w = STRAIGHT;
    w = turnWheels(w, 0, 5, 1 / 60);
    w = turnWheels(w, 0, 5, 1 / 60);
    expect(w.roll).toBe(10);
    const parked = turnWheels(w, 0, 0, 1 / 60);
    expect(parked.roll).toBe(10);
    expect(turnWheels(w, 0, -4, 1 / 60).roll).toBe(6);
  });

  it('wraps the pattern into one period in either direction', () => {
    expect(treadOffset(7, 6)).toBeCloseTo(1);
    expect(treadOffset(-1, 6)).toBeCloseTo(5);
    expect(treadOffset(-12, 6)).toBeCloseTo(0);
    for (const r of [-100.5, -3, 0, 2.5, 99]) {
      const o = treadOffset(r, 16);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(16);
    }
  });
});
