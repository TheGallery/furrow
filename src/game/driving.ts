import { FIELD, LANES, LANE_H } from './constants';
import type { Controls, Vehicle } from './vehicle';

/** Pace steps; the slowest is the original speed. Faster paces run the machine's own clock faster. */
export const PACES = [1, 1.5, 2] as const;
export const PACE_LABELS = ['1×', '1½×', '2×'] as const;

export const paceStep = (i: number, d: number): number => Math.min(PACES.length - 1, Math.max(0, i + d));

/** Longest single step of machine time; a slow frame or a fast pace is split into steps no longer than this. */
export const SUB_STEP = 1 / 60;
/** Splits `ds` seconds of machine time into `n` equal steps of `h` seconds, each at most SUB_STEP. */
export function subSteps(ds: number): { n: number; h: number } {
  const n = Math.max(1, Math.ceil(ds / SUB_STEP - 1e-9));
  return { n, h: ds / n };
}

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
  /** -1 while working along the lane; otherwise which part of the headland turn it is on. */
  leg: number;
  /** How far along that part it has got, in path points. */
  idx: number;
  /** Set once the machine is on the field; until then the yard and the barn are the player's. */
  engaged: boolean;
}

/** Start auto-steer from wherever the machine is: its nearest lane, the way it faces. */
export function pilotFrom(v: Vehicle): Pilot {
  const lane = nearestLane(v.y);
  return { lane, dir: Math.cos(v.a) >= 0 ? 1 : -1, step: lane === LANES - 1 ? -1 : 1, leg: -1, idx: 0, engaged: nearField(v.x, v.y, 0) };
}

/** One stretch of a headland turn: points every 2 units, driven forward or backing up. */
export interface Leg { pts: Float32Array; n: number; rev: boolean; vmax: Float32Array }

// The machine's tightest circle (vehicle.ts: at crawling speed it turns about 21.7 wide).
const R = 21.7;
const TOP = 64, BACK_SPEED = 22, TURN_SPEED = 20, CROSS_SPEED = 36, DECEL = 90;

/**
 * Where the tractor stops at the end of a lane heading `dir`, for an implement working `off` along the
 * heading (negative: trailing behind). A trailing implement runs on until it has worked right up to the
 * edge; a front header reaches the edge early, so the machine runs on a little to swing round outside.
 */
export function laneEnd(dir: number, off: number): number {
  const edge = dir > 0 ? FIELD.x + FIELD.w : FIELD.x;
  return edge + dir * (off < 0 ? -off + 1 : 50);
}

function legOf(path: Path, endSpeed: number): Leg {
  const { pts, arcs, rev } = path, n = pts.length / 2, a = Float32Array.from(pts), vmax = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    // crawl round the arcs (the machine's tightest circle), a little quicker across
    const cap = rev ? BACK_SPEED : arcs[i] ? TURN_SPEED : CROSS_SPEED;
    const ds = i === n - 1 ? 0 : Math.hypot(a[2 * i + 2] - a[2 * i], a[2 * i + 3] - a[2 * i + 1]);
    vmax[i] = Math.min(cap, i === n - 1 ? Math.max(endSpeed, 6) : Math.sqrt(vmax[i + 1] ** 2 + 2 * DECEL * ds));
  }
  return { pts: a, n, rev, vmax };
}

/** Lay out a path from a pose: straights and arcs, forward or backing, a point every 2 units. */
class Path {
  pts: number[] = [];
  /** Per point: on an arc. */
  arcs: boolean[] = [true];
  constructor(public x: number, public y: number, public a: number, readonly rev: boolean) { this.pts.push(x, y); }
  straight(d: number): this {
    const n = Math.ceil(d / 2), s = this.rev ? -1 : 1;
    for (let i = 0; i < n; i++) { this.x += (s * Math.cos(this.a) * d) / n; this.y += (s * Math.sin(this.a) * d) / n; this.pts.push(this.x, this.y); this.arcs.push(i > n - 6); }
    return this;
  }
  arc(da: number): this {
    const n = Math.ceil((Math.abs(da) * R) / 2), s = this.rev ? -1 : 1, ds = (Math.abs(da) * R) / n;
    for (let i = 0; i < n; i++) { const am = this.a + da / n / 2; this.a += da / n; this.x += s * Math.cos(am) * ds; this.y += s * Math.sin(am) * ds; this.pts.push(this.x, this.y); this.arcs.push(true); }
    return this;
  }
}

const turns = new Map<string, Leg[]>();
/**
 * The three-point turn at the end of a lane, into the next one. A trailing implement backs round a
 * quarter turn first, pulls across a lane and swings into the row; a front header swings out first,
 * pulls across and backs into the row, so it comes onto the field straight.
 */
export function turnLegs(lane: number, dir: number, step: number, off: number): Leg[] {
  const key = `${lane},${dir},${step},${off}`, hit = turns.get(key);
  if (hit) return hit;
  const x = laneEnd(dir, off), y = laneY(lane), a = dir > 0 ? 0 : Math.PI, q = (step * dir * Math.PI) / 2;
  let legs: Leg[];
  if (off < 0) {
    const back = new Path(x, y, a, true).arc(q);
    const cross = new Path(back.x, back.y, back.a, false).straight(LANE_H).arc(q);
    legs = [legOf(back, 0), legOf(cross, TURN_SPEED)];
  } else {
    const cross = new Path(x, y, a, false).arc(q).straight(LANE_H);
    const back = new Path(cross.x, cross.y, cross.a, true).arc(q);
    legs = [legOf(cross, 0), legOf(back, 0)];
  }
  turns.set(key, legs);
  return legs;
}

export interface Steer extends Controls { pilot: Pilot }

/**
 * Auto-steer: work along the lane until the implement reaches the far edge, then make a three-point
 * turn into the next lane. At the last lane it works back the other way. It drives every key: the
 * caller decides whether it may use the throttle. `off` is where the implement works along the heading.
 */
export function autoSteer(v: Vehicle, p: Pilot, off: number): Steer {
  const none = { up: false, down: false, left: false, right: false };
  // auto-steer takes over only once the machine is on the field; it then also makes the headland turns
  const engaged = p.engaged || nearField(v.x, v.y, 0);
  if (!engaged) return { ...none, pilot: p };
  const { lane, dir } = p;
  let { step, leg, idx } = p;
  const c = { ...none };
  let tx: number, ty: number, want: number, rev = false;
  if (leg < 0) {
    const end = laneEnd(dir, off), left = dir * (end - v.x);
    if (left <= 1) {
      if (lane + step < 0 || lane + step >= LANES) step = -step;
      leg = 0; idx = 0;
      return autoSteer(v, { lane, dir, step, leg, idx, engaged }, off);
    }
    // ease to a stop at the end of the lane, or to a crawl when the turn starts forward
    const endSpeed = off < 0 ? 0 : TURN_SPEED;
    want = Math.min(TOP, Math.max(8, Math.sqrt(endSpeed ** 2 + 2 * DECEL * left)));
    const look = Math.max(8, Math.min(left, 30 + 0.3 * Math.abs(v.speed)));
    tx = v.x + dir * look; ty = laneY(lane);
  } else {
    const legs = turnLegs(lane, dir, step, off), L = legs[leg], { pts, n } = L;
    rev = L.rev;
    let best = idx, bd = Infinity;
    for (let i = idx; i < Math.min(n, idx + 40); i++) { const d = (pts[2 * i] - v.x) ** 2 + (pts[2 * i + 1] - v.y) ** 2; if (d < bd) { bd = d; best = i; } }
    idx = best;
    // at the end once level with the last point, measured along the way the path runs there
    const ex = pts[2 * n - 2], ey = pts[2 * n - 1], tx0 = ex - pts[2 * n - 4], ty0 = ey - pts[2 * n - 3];
    const atEnd = idx >= n - 10 && (v.x - ex) * tx0 + (v.y - ey) * ty0 > -2 * Math.hypot(tx0, ty0);
    // a change of gear next (the lane after the turn is driven forward) waits for the machine to stop
    const cusp = leg + 1 >= legs.length ? rev : legs[leg + 1].rev !== rev;
    if (atEnd && (!cusp || Math.abs(v.speed) < 8)) {
      if (leg + 1 < legs.length) return autoSteer(v, { lane, dir, step, leg: leg + 1, idx: 0, engaged }, off);
      // into the next lane, working back the other way
      return autoSteer(v, { lane: lane + step, dir: -dir, step, leg: -1, idx: 0, engaged }, off);
    }
    const j = Math.min(n - 1, idx + Math.round((6 + 0.35 * Math.abs(v.speed)) / 2));
    tx = pts[2 * j]; ty = pts[2 * j + 1]; want = L.vmax[idx];
  }
  const pilot = { lane, dir, step, leg, idx, engaged };
  // steer towards the point ahead; backing up, the steering works the other way round
  const d = wrap(Math.atan2(ty - v.y, tx - v.x) - v.a - (rev ? Math.PI : 0));
  if (Math.hypot(tx - v.x, ty - v.y) > 0.8 && Math.abs(d) > 0.02) { if ((d > 0) !== rev) c.right = true; else c.left = true; }
  const sp = rev ? -v.speed : v.speed;
  // the throttle: ↑ goes forward and ↓ backs up, so backing they swap
  const faster = sp < want - 1, slower = sp > want + 3;
  c.up = rev ? slower : faster;
  c.down = rev ? faster : slower;
  return { ...c, pilot };
}

/** The way ahead for drawing: the rest of this lane, the turn, and the next lane. */
export function routeAhead(v: Vehicle, p: Pilot, off: number): { pts: Float32Array; rev: boolean }[] {
  const out: { pts: Float32Array; rev: boolean }[] = [];
  const { lane, dir } = p;
  let { step } = p;
  if (p.leg < 0) {
    out.push({ pts: Float32Array.from([v.x, laneY(lane), laneEnd(dir, off), laneY(lane)]), rev: false });
    if (lane + step < 0 || lane + step >= LANES) step = -step;
  }
  const legs = turnLegs(lane, dir, step, off);
  legs.forEach((L, k) => {
    if (p.leg >= 0 && k < p.leg) return;
    out.push({ pts: p.leg === k ? L.pts.slice(2 * p.idx) : L.pts, rev: L.rev });
  });
  const last = legs[legs.length - 1].pts, y = laneY(lane + step);
  out.push({ pts: Float32Array.from([last[last.length - 2], y, laneEnd(-dir, off), y]), rev: false });
  return out;
}
