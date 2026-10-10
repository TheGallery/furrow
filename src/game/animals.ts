import { FIELD, SCALE } from './constants';
import { EXT } from './machines';
import type { Rig, Season } from './types';
import { type Vehicle, insideBarn } from './vehicle';

// Animals round the barn: sheep in a paddock below the barn (lambs in spring), hens among the bales
// above it (chicks in spring), a farm dog that paces the machine from the top verge, and a flock that
// walks out to winter on the field. They only ever watch the machine and step out of its way; nothing
// here touches it, and nothing settles where auto-steer makes its headland turns.

export type Rand = () => number;
export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/**
 * The ground auto-steer's three-point turns sweep at each end of the field, machine and implement
 * together (tests/animals.test.ts measures them). It runs the full height of the farm, so nothing
 * stops here; animals only pass through when the machine is well away.
 */
export const TURN_BANDS = [
  { x0: FIELD.x - 210, x1: FIELD.x + 68 },
  { x0: FIELD.x + FIELD.w - 68, x1: FIELD.x + FIELD.w + 210 },
] as const;

/** The sheep paddock under the barn: west of the turn band, clear of the bale and hedge on its left, above the band under the field. */
export const PEN: Box = { x: 108, y: 726, w: 84, h: 118 };
/** The gate, in the pen's east fence: hinged at the top, latching at the bottom. */
export const GATE = { x: PEN.x + PEN.w, y0: PEN.y + 66, y1: PEN.y + 100 } as const;
/** The trough in the pen's bottom-left corner; nobody stands on it. */
export const TROUGH: Box = { x: PEN.x + 8, y: PEN.y + PEN.h - 20, w: 24, h: 11 };
/** Where the flock grazes through the winter: the middle of the field, well inside both ends. */
export const WINTER_FIELD: Box = { x: 980, y: 300, w: 440, h: 400 };
/** The hens' corner above the barn, among the bales, below the season pill. */
export const YARD: Box = { x: 110, y: 160, w: 80, h: 102 };
/** The top verge the dog walks: above the hedge-side lane, between the two turn bands. */
export const VERGE = { y: 118, x0: TURN_BANDS[0].x1 + 16, x1: TURN_BANDS[1].x0 - 16 } as const;
/** Where a dog on the verge may step aside to: up to the hedge or out onto the edge of the field, never into a turn band. */
const VERGE_ROOM: Box = { x: VERGE.x0, y: 92, w: VERGE.x1 - VERGE.x0, h: 120 };
/** The dog's spot by the bales, and the two ends of its way between the yard and the verge. */
export const HOME: Pt = { x: 172, y: 256 };
export const YARD_GATE: Pt = { x: 184, y: 166 };
export const VERGE_GATE: Pt = { x: VERGE.x0, y: VERGE.y };

/** A point on the flock's walk; `guard` waits there until the machine is well clear of the next three stretches, across the turn band. */
interface Waypoint extends Pt { guard?: boolean }
/** Out of the gate, along the bottom verge and up onto the field; home is the same way back. */
const ROUTE_OUT: readonly Waypoint[] = [
  { x: GATE.x - 14, y: (GATE.y0 + GATE.y1) / 2, guard: true },
  { x: GATE.x + 16, y: (GATE.y0 + GATE.y1) / 2 },
  { x: GATE.x + 40, y: 848 },
  { x: VERGE.x0 + 10, y: 850 },
  { x: 1000, y: 850 },
  { x: 1010, y: WINTER_FIELD.y + WINTER_FIELD.h - 10 },
];
/** Where a sheep on the walk may step aside to: anywhere but into the band under the field. */
const ROUTE_ROOM: Box = { x: 0, y: FIELD.y, w: FIELD.x + FIELD.w, h: 856 - FIELD.y };
const ROUTE_HOME: readonly Waypoint[] = [
  { x: 1010, y: WINTER_FIELD.y + WINTER_FIELD.h - 10 },
  { x: 1000, y: 850 },
  { x: VERGE.x0 + 10, y: 850, guard: true },
  { x: GATE.x + 40, y: 848 },
  { x: GATE.x + 16, y: (GATE.y0 + GATE.y1) / 2 },
  { x: GATE.x - 14, y: (GATE.y0 + GATE.y1) / 2 },
];

/** A machine this close (from its body) moves an animal on, as does one coming its way (see inTheWay). */
export const SHEEP_SHY = 70;
export const HEN_SHY = 55;
export const DOG_SHY = 60;
/** Half the way the machine sweeps (its implement is a lane wide), and an animal's own half width. */
export const PATH_HALF = 44;
const BODY = 9;
/** An animal reads the machine's path this far ahead of its front, and further by how far it goes in three seconds at twice the pace. */
const AHEAD = 60, AHEAD_S = 6;
/** A machine at least this far from the turn band, plus how far it goes in five seconds at twice the pace, lets an animal cross. */
const CLEAR = 150, LOOK_S = 10;
const EWES = 4, LAMBS = 2, HENS = 5, CHICKS = 4;
const WALK = 7, ROUTE_WALK = 12, ASIDE = 30, TROT = 42, LOPE = 80;

export interface Sheep {
  x: number; y: number; a: number;
  tx: number; ty: number;
  state: 'graze' | 'walk' | 'lie' | 'route';
  timer: number;
  speed: number;
  /** 0..1: how far the head is down in the grass. */
  graze: number;
  seed: number;
  lamb: boolean;
  /** A lamb's mother, by index. */
  mum: number;
  /** A lamb's skip: 0..1 off the ground, and how long is left of it. */
  hop: number; hopT: number;
  /** On the walk: the next waypoint, and how long until this one sets off. */
  leg: number; delay: number;
}

export interface Hen {
  x: number; y: number; a: number;
  tx: number; ty: number;
  moving: boolean;
  timer: number;
  speed: number;
  peck: number;
  /** 0..1: wings out after a fright. */
  flap: number;
  seed: number;
  brown: boolean;
}

export interface Chick { x: number; y: number; a: number; peck: number; seed: number }

export type DogPose = 'stand' | 'trot' | 'lie' | 'curl';
export interface Dog {
  x: number; y: number; a: number;
  pose: DogPose;
  /** The head's turn from the body, toward the machine. */
  head: number;
  /** 0..1 how hard the tail wags. */
  wag: number;
  /** How long it has stood still. */
  still: number;
  /** Set while crossing between the yard and the verge. */
  cross: Pt | null;
}

export interface Animals {
  t: number;
  sheep: Sheep[];
  /** Where the flock is: in the pen, walking out, on the field for the winter, or walking home. */
  flock: 'pen' | 'out' | 'field' | 'home';
  hens: Hen[];
  chicks: Chick[];
  dog: Dog;
}

export interface AnimalScene {
  season: Season;
  v: Vehicle;
  rig: Rig;
  /** True while the player has the machine (not parking, in the barn or rolling out). */
  driving: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a);

/** Somewhere inside a box, `m` in from its edges; in the pen, never on the trough. */
export function inside(r: Box, rand: Rand, m = 12): Pt {
  for (let i = 0; ; i++) {
    const p = { x: between(rand, r.x + m, r.x + r.w - m), y: between(rand, r.y + m, r.y + r.h - m) };
    if (r !== PEN || i > 20 || !onTrough(p)) return p;
  }
}
const onTrough = (p: Pt) => p.x < TROUGH.x + TROUGH.w + 10 && p.y > TROUGH.y - 10;
const keepIn = (r: Box, p: Pt, m: number): Pt => ({ x: clamp(p.x, r.x + m, r.x + r.w - m), y: clamp(p.y, r.y + m, r.y + r.h - m) });

/** Where a sheep may be after a step from `p` toward `q`: through the pen's fence only by way of the open gate. */
function fence(open: boolean, p: Pt, q: Pt): Pt {
  const was = inPen(p), now = inPen(q);
  if (was === now) return q;
  if (open && q.y > GATE.y0 + 6 && q.y < GATE.y1 - 6 && Math.max(p.x, q.x) > GATE.x - 10) return q;
  return was ? keepIn(PEN, q, 8) : p;
}
const inPen = (p: Pt) => p.x > PEN.x && p.x < PEN.x + PEN.w && p.y > PEN.y && p.y < PEN.y + PEN.h;

/** True when x lies in one of the turn bands. */
export const inTurnBand = (x: number): boolean => TURN_BANDS.some((b) => x > b.x0 && x < b.x1);

/** Where the rig's centre line comes nearest (x, y): from the front of the machine to the back of the implement. */
function nearestOnRig(v: Vehicle, rig: Rig, x: number, y: number): Pt {
  const [r0, r1] = EXT[rig], c = Math.cos(v.a), s = Math.sin(v.a);
  const ax = v.x + c * r0 * SCALE, ay = v.y + s * r0 * SCALE, dx = c * (r1 - r0) * SCALE, dy = s * (r1 - r0) * SCALE;
  const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return { x: ax + dx * k, y: ay + dy * k };
}

/** How far (x, y) is from the machine and its implement, roughly: the distance to its centre line, less its half width. */
export function machineDist(v: Vehicle, rig: Rig, x: number, y: number): number {
  const p = nearestOnRig(v, rig, x, y);
  return Math.hypot(x - p.x, y - p.y) - 30;
}

/** How far (x, y) lies to the side of the machine's heading line, and how far ahead of its middle along the way it is going. */
function relative(v: Vehicle, x: number, y: number): { across: number; along: number } {
  const c = Math.cos(v.a), s = Math.sin(v.a), dx = x - v.x, dy = y - v.y;
  return { across: -dx * s + dy * c, along: (dx * c + dy * s) * (v.speed < 0 ? -1 : 1) };
}

/** True when the machine is close to (x, y), or coming this way on a path that runs over it. */
export function inTheWay(v: Vehicle, rig: Rig, x: number, y: number, shy: number): boolean {
  if (machineDist(v, rig, x, y) < shy) return true;
  if (Math.abs(v.speed) < 1) return false;
  const { across, along } = relative(v, x, y), front = (v.speed < 0 ? -EXT[rig][0] : EXT[rig][1]) * SCALE;
  return Math.abs(across) < PATH_HALF + BODY && along > 0 && along < front + AHEAD + Math.abs(v.speed) * AHEAD_S;
}

/**
 * Where to step to, out of the machine's way: square to its heading, on the side the animal is
 * already on (never across in front of it), well clear of its path; inside `room` when that leaves
 * enough clearance.
 */
export function stepAside(v: Vehicle, p: Pt, room: Box | null): Pt {
  const { across } = relative(v, p.x, p.y), side = across < 0 ? -1 : 1, k = side * (PATH_HALF + BODY + 22) - across;
  const q = { x: p.x - Math.sin(v.a) * k, y: p.y + Math.cos(v.a) * k };
  if (!room) return q;
  const r = keepIn(room, q, 4);
  return Math.abs(relative(v, r.x, r.y).across) >= PATH_HALF + BODY ? r : q;
}

/**
 * True when an animal may cross the turn band from `a` to `b`: the machine is in the barn, or well
 * away from the whole crossing, further the faster it is going.
 */
export function clearToCross(s: AnimalScene, a: Pt, b: Pt): boolean {
  if (insideBarn(s.v.x, s.v.y)) return true;
  const need = CLEAR + Math.abs(s.v.speed) * LOOK_S;
  for (let k = 0; k <= 10; k++) {
    if (machineDist(s.v, s.rig, a.x + ((b.x - a.x) * k) / 10, a.y + ((b.y - a.y) * k) / 10) < need) return false;
  }
  return true;
}

/** Walk toward (tx, ty), turning smoothly; true once within `near` of it. */
function walk(c: { x: number; y: number; a: number }, tx: number, ty: number, speed: number, dt: number, turn = 5, near = 1.5): boolean {
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < near) return true;
  const want = Math.atan2(ty - c.y, tx - c.x);
  c.a += wrapA(want - c.a) * Math.min(1, (turn * dt) / 1000);
  const step = Math.min(d, (speed * dt) / 1000) * Math.max(0.25, Math.cos(wrapA(want - c.a)));
  c.x += Math.cos(c.a) * step; c.y += Math.sin(c.a) * step;
  return false;
}

/** The animals as they are at the start of a season: in winter the flock is already out on the field. */
export function createAnimals(season: Season, rand: Rand = Math.random): Animals {
  const winter = season === 'winter', sheep: Sheep[] = [];
  for (let i = 0; i < EWES + LAMBS; i++) {
    const lamb = i >= EWES, p = inside(winter ? WINTER_FIELD : PEN, rand, 14);
    sheep.push({ ...p, a: between(rand, -3, 3), tx: p.x, ty: p.y, state: 'graze', timer: between(rand, 500, 6000), speed: WALK, graze: 0.6, seed: i * 7.3, lamb, mum: lamb ? (i - EWES) * 2 : -1, hop: 0, hopT: 0, leg: 0, delay: 0 });
  }
  const hens: Hen[] = [];
  for (let i = 0; i < HENS; i++) {
    const p = inside(YARD, rand, 10);
    hens.push({ ...p, a: between(rand, -3, 3), tx: p.x, ty: p.y, moving: false, timer: between(rand, 500, 4000), speed: 9, peck: 0, flap: 0, seed: i * 3.1, brown: i % 2 === 1 });
  }
  const chicks: Chick[] = [];
  for (let i = 0; i < CHICKS; i++) chicks.push({ x: hens[0].x - 6 * (i + 1), y: hens[0].y, a: 0, peck: 0, seed: i * 1.7 });
  return { t: 0, sheep, flock: winter ? 'field' : 'pen', hens, chicks, dog: { ...HOME, a: -0.5, pose: winter ? 'curl' : 'lie', head: 0, wag: 0.3, still: 0, cross: null } };
}

/** True while hens beyond the first three stay in the warm. */
export const henIndoors = (season: Season, i: number): boolean => season === 'winter' && i > 2;

export function updateAnimals(a: Animals, s: AnimalScene, dt: number, rand: Rand = Math.random): void {
  a.t += dt;
  updateFlock(a, s, dt, rand);
  updateHens(a, s, dt, rand);
  updateDog(a, s, dt);
}

function updateFlock(a: Animals, s: AnimalScene, dt: number, rand: Rand): void {
  const winter = s.season === 'winter';
  // out of the gate one by one when winter comes, and home the same way in spring
  if ((winter && a.flock === 'pen') || (!winter && a.flock === 'field')) {
    a.flock = winter ? 'out' : 'home';
    let k = 0;
    for (const e of a.sheep) if (!e.lamb) { e.state = 'route'; e.leg = 0; e.delay = k++ * 1400 + between(rand, 0, 400); }
  }
  const route = a.flock === 'out' ? ROUTE_OUT : ROUTE_HOME, area = a.flock === 'field' || a.flock === 'out' ? WINTER_FIELD : PEN;
  const was = a.sheep.map((e) => ({ x: e.x, y: e.y }));
  for (const e of a.sheep) {
    if (e.lamb) continue;
    e.timer -= dt;
    if (inTheWay(s.v, s.rig, e.x, e.y, SHEEP_SHY)) {
      // step aside, well out of the machine's way, and settle there; on the walk, carry on once it has passed
      const q = stepAside(s.v, e, e.state === 'route' ? ROUTE_ROOM : area);
      e.graze = 0;
      if (e.state === 'route') { walk(e, q.x, q.y, ASIDE, dt, 6); continue; }
      e.state = 'walk'; e.timer = 0; e.tx = q.x; e.ty = q.y; e.speed = ASIDE;
    }
    if (e.state === 'route') {
      e.graze += (0 - e.graze) * Math.min(1, dt / 250);
      e.delay -= dt;
      if (e.delay > 0) continue;
      if (e.leg < route.length) {
        const w = route[e.leg];
        // close is enough on the way, so the flock never jostles for one spot
        if (walk(e, w.x, w.y, ROUTE_WALK, dt, 4, 10) && (!w.guard || [0, 1, 2].every((k) => clearToCross(s, route[e.leg + k], route[e.leg + k + 1])))) e.leg++;
      } else {
        // the last stretch: somewhere to graze not far in, then it is home
        if (e.leg === route.length) { const p = inside(area, rand, 16), w = route[route.length - 1]; e.tx = w.x + (p.x - w.x) * 0.4; e.ty = w.y + (p.y - w.y) * 0.4; e.leg++; }
        if (walk(e, e.tx, e.ty, WALK + 2, dt, 4)) { e.state = 'graze'; e.timer = between(rand, 3000, 8000); }
      }
      continue;
    }
    if (e.state === 'graze') {
      const look = Math.sin(a.t / 2900 + e.seed * 3) > 0.82;
      e.graze += ((look ? 0 : 0.8 + 0.2 * Math.sin(a.t / 700 + e.seed)) - e.graze) * Math.min(1, dt / 300);
      if (e.timer < 0) {
        const r = rand();
        if (r < 0.5) { const p = inside(area, rand, 14); e.tx = p.x; e.ty = p.y; e.state = 'walk'; e.speed = between(rand, WALK - 1, WALK + 1); }
        else if (r < (s.season === 'summer' ? 0.86 : 0.66)) { e.state = 'lie'; e.timer = between(rand, 12000, 26000); }
        else e.timer = between(rand, 3000, 8000);
      }
    } else if (e.state === 'walk') {
      e.graze += (0 - e.graze) * Math.min(1, dt / 250);
      if (walk(e, e.tx, e.ty, e.speed, dt, 3)) { e.state = 'graze'; e.timer = between(rand, 4000, 11000); }
    } else {
      e.graze = 0;
      if (e.timer < 0) { e.state = 'graze'; e.timer = between(rand, 3000, 7000); }
    }
  }
  if ((a.flock === 'out' || a.flock === 'home') && a.sheep.every((e) => e.lamb || e.state !== 'route')) a.flock = a.flock === 'out' ? 'field' : 'pen';

  // lambs keep to their mothers, with a skip now and then
  for (const l of a.sheep) {
    if (!l.lamb) continue;
    const m = a.sheep[l.mum], side = l.seed % 2 > 1 ? 1 : -1;
    const tx = m.x + Math.cos(m.a + Math.PI - 0.8 * side) * 15, ty = m.y + Math.sin(m.a + Math.PI - 0.8 * side) * 15;
    const far = Math.hypot(tx - l.x, ty - l.y);
    if (far > 4) walk(l, tx, ty, far > 30 ? 24 : 10, dt, 6);
    l.graze = far > 4 ? 0 : 0.6;
    l.state = m.state === 'lie' && far < 6 ? 'lie' : 'graze';
    if (l.hopT <= 0 && rand() < dt / 7000) l.hopT = 420;
    if (l.hopT > 0) { l.hopT -= dt; l.hop = Math.sin(Math.PI * (1 - Math.max(0, l.hopT) / 420)); } else l.hop = 0;
  }

  // a little room between them, and in the paddock the fence holds them
  for (let i = 0; i < a.sheep.length; i++) for (let j = i + 1; j < a.sheep.length; j++) {
    const p = a.sheep[i], q = a.sheep[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, min = p.lamb || q.lamb ? 11 : 19;
    if (d < min) { const k = ((min - d) / d) * 0.25; p.x -= dx * k; p.y -= dy * k; q.x += dx * k; q.y += dy * k; }
  }
  a.sheep.forEach((e, i) => {
    // the fence: in or out only through the open gate, though a lamb left on the wrong side slips under the rails to its mother
    const slip = e.lamb && inPen(e) === inPen(a.sheep[e.mum]);
    const p = a.flock === 'pen' ? keepIn(PEN, e, 8) : slip ? e : fence(gateOpen(a), was[i], e);
    e.x = p.x; e.y = p.y;
  });
}

function updateHens(a: Animals, s: AnimalScene, dt: number, rand: Rand): void {
  const winter = s.season === 'winter';
  a.hens.forEach((h, i) => {
    if (henIndoors(s.season, i)) return;
    h.timer -= dt; h.flap = Math.max(0, h.flap - dt / 700);
    if (inTheWay(s.v, s.rig, h.x, h.y, HEN_SHY)) {
      const p = stepAside(s.v, h, YARD);
      h.tx = p.x; h.ty = p.y; h.moving = true; h.speed = 28; h.flap = 1;
    }
    if (h.moving) {
      h.peck = 0;
      if (walk(h, h.tx, h.ty, h.speed, dt, 8)) { h.moving = false; h.timer = between(rand, 1500, 5000); }
    } else {
      h.peck += ((Math.sin(a.t / 95 + h.seed * 4) > 0.55 ? 1 : 0) - h.peck) * Math.min(1, dt / 60);
      if (h.timer < 0) {
        // in winter they keep close by the bales; otherwise mostly a short scratch about
        const p = winter ? { x: between(rand, 126, 186), y: between(rand, 238, 258) }
          : rand() < 0.7 ? keepIn(YARD, { x: h.x + between(rand, -50, 50), y: h.y + between(rand, -30, 30) }, 4) : inside(YARD, rand, 4);
        h.tx = p.x; h.ty = p.y; h.moving = true; h.speed = between(rand, 7, 11);
      }
    }
  });
  // the chicks trail the first hen in a line
  a.chicks.forEach((c, i) => {
    const lead = i === 0 ? a.hens[0] : a.chicks[i - 1];
    const tx = lead.x - Math.cos(lead.a) * 6, ty = lead.y - Math.sin(lead.a) * 6, far = Math.hypot(tx - c.x, ty - c.y);
    if (far > 1.5) walk(c, tx, ty, Math.min(40, far * 4), dt, 9);
    c.peck = far < 2 && Math.sin(a.t / 80 + c.seed * 5) > 0.4 ? 1 : 0;
  });
}

/** True while the machine is out on the field or close by it, so the dog has something to watch. */
const atWork = (s: AnimalScene) => s.driving && s.v.x > FIELD.x - 150 && s.v.x < FIELD.x + FIELD.w + 150 && s.v.y > FIELD.y - 60 && s.v.y < FIELD.y + FIELD.h + 60;

function updateDog(a: Animals, s: AnimalScene, dt: number): void {
  const g = a.dog, v = s.v, winter = s.season === 'winter';
  const onVerge = g.x > (TURN_BANDS[0].x0 + TURN_BANDS[0].x1) / 2, out = !winter && atWork(s);
  const at = (p: Pt) => Math.hypot(p.x - g.x, p.y - g.y) < 3;
  let goal: Pt | null, speed = TROT;
  if (g.cross) {
    // across the turn band in one go, never stopping there
    goal = g.cross; speed = LOPE;
  } else if (out && !onVerge) {
    goal = YARD_GATE;
    if (at(YARD_GATE) && clearToCross(s, YARD_GATE, VERGE_GATE)) g.cross = goal = VERGE_GATE;
  } else if (!out && onVerge) {
    goal = VERGE_GATE;
    if (at(VERGE_GATE) && clearToCross(s, VERGE_GATE, YARD_GATE)) g.cross = goal = YARD_GATE;
  } else if (out) {
    // pace the machine from the verge, a little behind it; once lying down it lets the machine get ahead a way first
    const x = clamp(v.x - Math.cos(v.a) * 40, VERGE.x0, VERGE.x1);
    goal = g.pose === 'lie' && Math.abs(g.x - x) < 70 ? null : { x, y: VERGE.y };
    // left behind, it lopes to catch up
    speed = Math.min(LOPE, TROT + Math.abs(x - g.x) * 0.25);
  } else goal = HOME;

  // a machine coming along the verge or into the yard sends it off out of the way
  if (!g.cross && inTheWay(v, s.rig, g.x, g.y, DOG_SHY)) { goal = stepAside(v, g, onVerge ? VERGE_ROOM : YARD); speed = TROT * 1.5; }

  let moving = false;
  if (goal) {
    if (walk(g, goal.x, goal.y, speed, dt, 6)) { if (g.cross && at(g.cross)) g.cross = null; }
    else moving = Math.hypot(goal.x - g.x, goal.y - g.y) > (goal === HOME ? 2 : 6);
  }
  g.still = moving ? 0 : g.still + dt;
  g.pose = moving ? 'trot' : winter && at(HOME) ? 'curl' : g.still > 900 ? 'lie' : 'stand';
  if (!moving && g.pose !== 'curl') {
    // settled: the body along the verge, the head turned toward the machine
    const toM = Math.atan2(v.y - g.y, v.x - g.x), body = onVerge ? (Math.cos(toM) > 0 ? 0 : Math.PI) : -0.5;
    g.a += wrapA(body - g.a) * Math.min(1, dt / 600);
    g.head += (clamp(wrapA(toM - g.a), -0.8, 0.8) - g.head) * Math.min(1, dt / 400);
  } else g.head += (0 - g.head) * Math.min(1, dt / 300);
  g.wag += ((out && Math.hypot(v.x - g.x, v.y - g.y) < 260 ? 1 : 0.25) - g.wag) * Math.min(1, dt / 800);
}

/** The gate stands open while the flock is out or on its way. */
export const gateOpen = (a: Animals): boolean => a.flock !== 'pen';
