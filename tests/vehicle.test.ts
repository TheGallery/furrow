import { describe, expect, it } from 'vitest';
import { DOOR_X, DOOR_Y } from '../src/game/constants';
import { MAX_SPEED, drive, moveAllowed, step } from '../src/game/vehicle';

const none = { up: false, down: false, left: false, right: false };

describe('driving', () => {
  it('eases up to a calm top speed and coasts to a stop', () => {
    let v = { x: 600, y: 300, a: 0, speed: 0 };
    for (let i = 0; i < 300; i++) v = drive(v, { ...none, up: true }, 1 / 60);
    expect(v.speed).toBeCloseTo(MAX_SPEED);
    expect(v.x).toBeGreaterThan(600);
    for (let i = 0; i < 300; i++) v = drive(v, none, 1 / 60);
    expect(v.speed).toBe(0);
  });

  it('steers gently at a standstill and fully once moving', () => {
    const standing = drive({ x: 0, y: 0, a: 0, speed: 0 }, { ...none, left: true }, 1).a;
    const moving = drive({ x: 0, y: 0, a: 0, speed: MAX_SPEED }, { ...none, up: true, left: true }, 1).a;
    expect(standing).toBeLessThan(0);
    expect(drive({ x: 0, y: 0, a: 0, speed: 0 }, { ...none, right: true }, 1).a).toBeGreaterThan(0);
    expect(moving).toBeLessThan(standing);
  });

  // Regression: an operator pressing the arrow keys saw no movement. A tap moved the
  // machine under 1 px and Left/Right did nothing from a standstill.
  it('answers a short tap from a standstill with visible movement', () => {
    let v = { x: 600, y: 300, a: 0, speed: 0 };
    for (let i = 0; i < 15; i++) v = drive(v, { ...none, up: true }, 1 / 60);
    for (let i = 0; i < 120; i++) v = drive(v, none, 1 / 60);
    expect(v.x - 600).toBeGreaterThanOrEqual(2);
  });

  it('covers good ground in the first second of holding Up', () => {
    let v = { x: 600, y: 300, a: 0, speed: 0 };
    for (let i = 0; i < 60; i++) v = drive(v, { ...none, up: true }, 1 / 60);
    expect(v.x - 600).toBeGreaterThanOrEqual(20);
  });

  it('enters the barn only through the door', () => {
    expect(moveAllowed({ x: DOOR_X + 2, y: DOOR_Y }, { x: DOOR_X - 2, y: DOOR_Y })).toBe(true);
    expect(moveAllowed({ x: DOOR_X + 2, y: 200 }, { x: DOOR_X - 2, y: 200 })).toBe(false);
    const blocked = step({ x: DOOR_X + 1, y: 200, a: Math.PI, speed: 40 }, { ...none, up: true }, 0.1);
    expect(blocked.speed).toBe(0);
    expect(blocked.x).toBe(DOOR_X + 1);
  });
});
