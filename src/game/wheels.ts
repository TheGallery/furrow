// What the tyres show: how far the steered wheels are turned and how far the tread has rolled.

export interface Wheels {
  /** Steered-wheel angle in radians; positive turns toward the machine's right. */
  steer: number;
  /** Tread rolled so far, in drawing units; grows driving forward, shrinks reversing. */
  roll: number;
}

export const STRAIGHT: Wheels = { steer: 0, roll: 0 };

// A gentle lock, reached (and released) in about a fifth of a second.
export const MAX_STEER = 0.38;
const STEER_RATE = 2;

/** Ease the steered wheels toward `input` (-1 left, 0 straight, +1 right) over dt seconds. */
export function steerToward(angle: number, input: number, dt: number): number {
  const target = Math.max(-1, Math.min(1, input)) * MAX_STEER, step = STEER_RATE * dt;
  return angle + Math.max(-step, Math.min(step, target - angle));
}

/** Signed distance moved along the heading `a`: positive driving forward, negative reversing. */
export function rolled(from: { x: number; y: number }, to: { x: number; y: number }, a: number): number {
  return (to.x - from.x) * Math.cos(a) + (to.y - from.y) * Math.sin(a);
}

/** Turn the wheels for one frame: `input` steering, `distance` rolled in drawing units. */
export function turnWheels(w: Wheels, input: number, distance: number, dt: number): Wheels {
  return { steer: steerToward(w.steer, input, dt), roll: w.roll + distance };
}

/** Where a tread pattern repeating every `period` sits after rolling `roll`: always in [0, period). */
export function treadOffset(roll: number, period: number): number {
  const o = roll % period;
  return o < 0 ? o + period : o;
}
