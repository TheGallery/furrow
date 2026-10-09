import { BARN, DOOR_BOTTOM, DOOR_TOP, DOOR_X, WORLD_H, WORLD_W } from './constants';

export interface Vehicle {
  x: number;
  y: number;
  /** Heading in radians, 0 = east. */
  a: number;
  /** Pixels per second; negative when reversing. */
  speed: number;
}

export interface Controls {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// World units per second. At ZOOM 0.5 the top speed is 32 screen px/s, gentler on screen
// than the original 46, and about half a minute to drive one lane of the field.
export const MAX_SPEED = 64;
export const REVERSE_SPEED = 22;
// Quick enough that a short tap visibly moves the machine, still calm at the top.
const ACCEL = 84;
const BRAKE = 126;
const COAST = 56;
// Radians per second: turns about as tightly, for the machine's size, as before.
const TURN_RATE = 1.15;
// Share of full steering kept at a standstill, so Left/Right always answer.
const STANDING_GRIP = 0.4;

export const BOUNDS = { x0: 30, x1: WORLD_W - 30, y0: 96, y1: WORLD_H - 24 };

/** Speed and heading after dt seconds of input. Steering is slower at a standstill but never dead. */
export function drive(v: Vehicle, c: Controls, dt: number): Vehicle {
  let target = 0;
  if (c.up && !c.down) target = MAX_SPEED;
  else if (c.down && !c.up) target = v.speed > 1 ? 0 : -REVERSE_SPEED;
  const opposing = target !== 0 && v.speed !== 0 && Math.sign(target) !== Math.sign(v.speed);
  const rate = c.down && v.speed > 0 ? BRAKE : target === 0 ? COAST : opposing ? BRAKE : ACCEL;
  const speed = v.speed + Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));
  const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  const grip = Math.max(STANDING_GRIP, Math.min(1, Math.abs(speed) / 25)) * (speed < 0 ? -1 : 1);
  const a = v.a + steer * TURN_RATE * grip * dt;
  return { x: v.x + Math.cos(a) * speed * dt, y: v.y + Math.sin(a) * speed * dt, a, speed };
}

export function insideBarn(x: number, y: number): boolean {
  return x >= BARN.x && x <= BARN.x + BARN.w && y >= BARN.y && y <= BARN.y + BARN.h;
}

/** The barn walls are solid; the only way in or out is through the door. */
export function moveAllowed(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  if (insideBarn(from.x, from.y) === insideBarn(to.x, to.y)) return true;
  const y = (from.y + to.y) / 2, x = (from.x + to.x) / 2;
  return x > DOOR_X - 30 && y > DOOR_TOP + 14 && y < DOOR_BOTTOM - 14;
}

/** One step of player driving: steer, then keep to the farm and out of the barn walls. */
export function step(v: Vehicle, c: Controls, dt: number): Vehicle {
  const n = drive(v, c, dt);
  if (!moveAllowed(v, n)) return { ...v, speed: 0 };
  const x = Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, n.x)), y = Math.min(BOUNDS.y1, Math.max(BOUNDS.y0, n.y));
  return { ...n, x, y, speed: x !== n.x || y !== n.y ? n.speed * 0.5 : n.speed };
}
