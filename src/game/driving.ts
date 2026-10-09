import { FIELD, LANES, LANE_H } from './constants';
import type { Controls, Vehicle } from './vehicle';

/** Pace steps; the slowest is the original speed. Faster paces run the machine's own clock faster. */
export const PACES = [1, 1.5, 2] as const;
export const PACE_LABELS = ['1×', '1½×', '2×'] as const;

export const paceStep = (i: number, d: number): number => Math.min(PACES.length - 1, Math.max(0, i + d));

export const laneY = (lane: number): number => FIELD.y + (lane + 0.5) * LANE_H;
export const nearestLane = (y: number): number => Math.min(LANES - 1, Math.max(0, Math.floor((y - FIELD.y) / LANE_H)));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const nearField = (x: number, y: number, m: number) => x > FIELD.x - m && x < FIELD.x + FIELD.w + m && y > FIELD.y - m && y < FIELD.y + FIELD.h + m;

// Lane hold only steps in close to the row direction, so deliberate diagonals and turns are left alone.
const HOLD_ANGLE = 0.42;
const HOLD_RATE = 2.2;
const HOLD_LOOK = 150;

/**
 * Lane hold: while no steering key is down and the machine runs roughly along the rows, ease the
 * heading straight and drift onto the middle of the nearest lane. The player's steering always wins.
 */
export function laneHold(v: Vehicle, c: Controls, dt: number): Vehicle {
  if (c.left || c.right || v.speed < 1 || !nearField(v.x, v.y, 60)) return v;
  const base = Math.abs(wrap(v.a)) < Math.PI / 2 ? 0 : Math.PI;
  const tilt = Math.atan2(laneY(nearestLane(v.y)) - v.y, HOLD_LOOK);
  const d = wrap((base === 0 ? tilt : Math.PI - tilt) - v.a);
  if (Math.abs(d) > HOLD_ANGLE) return v;
  return { ...v, a: v.a + d * Math.min(1, dt * HOLD_RATE) };
}

export interface Pilot {
  lane: number;
  /** +1 heading east along the lane, -1 west. */
  dir: number;
  /** Which way the next lane is: +1 down the field, -1 up. */
  step: number;
  turning: boolean;
  /** Set once the machine is on the field; until then the yard and the barn are the player's. */
  engaged: boolean;
}

/** Start auto-steer from wherever the machine is: its nearest lane, the way it faces. */
export function pilotFrom(v: Vehicle): Pilot {
  const lane = nearestLane(v.y);
  return { lane, dir: Math.cos(v.a) >= 0 ? 1 : -1, step: lane === LANES - 1 ? -1 : 1, turning: false, engaged: nearField(v.x, v.y, 0) };
}

const LOOKAHEAD = 110;
const HEADLAND = 14;

/**
 * Auto-steer: follow the lane, and past the end of the field turn into the next one. At the last
 * lane it works back the other way. Returns the steering to use and the pilot's next state.
 */
export function autoSteer(v: Vehicle, p: Pilot): { left: boolean; right: boolean; pilot: Pilot } {
  // auto-steer takes over only once the machine is on the field; it then also makes the headland turns
  const engaged = p.engaged || nearField(v.x, v.y, 0);
  if (!engaged) return { left: false, right: false, pilot: p };
  let { lane, dir, step, turning } = p;
  const past = dir > 0 ? v.x > FIELD.x + FIELD.w + HEADLAND : v.x < FIELD.x - HEADLAND;
  if (!turning && past) {
    if (lane + step < 0 || lane + step >= LANES) step = -step;
    lane += step; dir = -dir; turning = true;
  }
  const dx = dir * LOOKAHEAD, dy = laneY(lane) - v.y;
  const ang = wrap(Math.atan2(dy, dx) - v.a);
  if (turning && Math.abs(ang) < 0.5) turning = false;
  const pilot = { lane, dir, step, turning, engaged };
  if (Math.abs(ang) < 0.03) return { left: false, right: false, pilot };
  const right = Math.cos(v.a) * dy - Math.sin(v.a) * dx > 0;
  return { left: !right, right, pilot };
}
