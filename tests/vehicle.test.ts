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

  it('only steers while moving', () => {
    expect(drive({ x: 0, y: 0, a: 0, speed: 0 }, { ...none, left: true }, 1).a).toBe(0);
    expect(drive({ x: 0, y: 0, a: 0, speed: MAX_SPEED }, { ...none, up: true, left: true }, 1).a).toBeLessThan(0);
  });

  it('enters the barn only through the door', () => {
    expect(moveAllowed({ x: DOOR_X + 2, y: DOOR_Y }, { x: DOOR_X - 2, y: DOOR_Y })).toBe(true);
    expect(moveAllowed({ x: DOOR_X + 2, y: 200 }, { x: DOOR_X - 2, y: 200 })).toBe(false);
    const blocked = step({ x: DOOR_X + 1, y: 200, a: Math.PI, speed: 40 }, { ...none, up: true }, 0.1);
    expect(blocked.speed).toBe(0);
    expect(blocked.x).toBe(DOOR_X + 1);
  });
});
