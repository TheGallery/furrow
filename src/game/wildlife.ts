import { BARN, DOOR_X, DOOR_Y, FIELD, SCALE, WORLD_H, WORLD_W } from './constants';
import { EXT } from './machines';
import type { Rig, Season } from './types';
import type { Vehicle } from './vehicle';

// Wildlife at the edges: now and then a hare comes out onto the verge or the edge of the field and
// sits until the machine gets near, then lopes back the way it came (in spring two may box); or a fox trots the top verge.
// In winter they leave tracks across the snowy grass. One visit at a time, with long quiet spells
// between; they only ever watch the machine, and nothing here touches it.

export type Rand = () => number;

export interface Hare {
  x: number; y: number; a: number;
  state: 'in' | 'sit' | 'box' | 'run' | 'gone';
  /** Where it is going: its spot on the verge, a little shuffle, or back into cover. */
  tx: number; ty: number;
  /** Which way home is: up into the top hedge, or down off the bottom of the farm. */
  home: 'top' | 'bottom';
  /** The stretch of ground it sits out on, an index into SPOTS. */
  spot: number;
  timer: number;
  /** How many more times it shuffles along before it goes home of its own accord. */
  sits: number;
  /** The bounding gait, for drawing; `ears` is 1 pricked up, 0 laid flat. */
  phase: number; ears: number;
  /** Ground covered since the last print. */
  dist: number;
}

export interface Fox {
  x: number; y: number; a: number;
  /** 1 trotting right, -1 left. */
  dir: number;
  /** Where along the verge it stops to look about; once it has, `stopped` is set. */
  stopX: number; stopped: boolean;
  /** ms left looking about; 0 while trotting. */
  pause: number;
  /** Turned back once already, because the machine came near. */
  shy: boolean;
  head: number;
  dist: number;
}

/** A footprint in the snow; `side` puts a fox's prints left and right of its line. */
export interface Print { x: number; y: number; a: number; kind: 'hare' | 'fox'; side: number; age: number }

export interface Wildlife {
  t: number;
  hares: Hare[];
  fox: Fox | null;
  /** ms until the next visit, counted only while nobody is out. */
  wait: number;
  prints: Print[];
}

export interface WildScene { season: Season; v: Vehicle; rig: Rig }

/** The first visit comes after this long, then the quiet spell between visits. */
const FIRST_WAIT: [number, number] = [8000, 14000];
export const QUIET: [number, number] = [22000, 45000];
/** A machine this close (from its body) sends a hare home, or turns the fox back. */
export const HARE_SHY = 180, FOX_SHY = 150;
/** A hare only comes out this far from the machine. */
const SIT_CLEAR = 420;
const HARE_WALK = 34, HARE_RUN = 92, FOX_TROT = 28, FOX_HURRY = 44;
const SIT_MS: [number, number] = [9000, 16000];
const BOX_MS: [number, number] = [4500, 7000];
/** Prints fade over this long, and no more than this many lie in the snow at once. */
export const PRINT_MS = 90_000, MAX_PRINTS = 360;
const HARE_BOUND = 22, FOX_STEP = 8;

/**
 * Where an auto-steer headland turn can run: a band beyond each end of the field, as deep as the
 * three-point turn swings out (driving.ts), as tall as the field. Nothing settles in either.
 */
export const TURN_BANDS = [
  { x0: FIELD.x - 180, x1: FIELD.x, y0: FIELD.y - 30, y1: FIELD.y + FIELD.h + 30 },
  { x0: FIELD.x + FIELD.w, x1: WORLD_W, y0: FIELD.y - 30, y1: FIELD.y + FIELD.h + 30 },
] as const;
export const inTurnBand = (x: number, y: number): boolean => TURN_BANDS.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

/**
 * Where a hare sits out: on the top verge between the hedge and the field, on the grass under the
 * field, or just inside either long edge of the field, in the young crop or the stubble. All stop
 * short of the turn bands, and the grass under the field stops short of the dashboard at the bottom
 * right, so a hare never sits behind it. `home` is the way it goes back into cover.
 */
export const SPOTS = [
  { x0: FIELD.x + 40, x1: FIELD.x + FIELD.w - 40, y0: 102, y1: 134, home: 'top' },
  { x0: FIELD.x + 60, x1: FIELD.x + FIELD.w - 60, y0: FIELD.y + 14, y1: FIELD.y + 50, home: 'top' },
  { x0: FIELD.x + 60, x1: FIELD.x + FIELD.w - 60, y0: FIELD.y + FIELD.h - 50, y1: FIELD.y + FIELD.h - 14, home: 'bottom' },
  { x0: FIELD.x + 40, x1: 1240, y0: FIELD.y + FIELD.h + 16, y1: FIELD.y + FIELD.h + 70, home: 'bottom' },
] as const;
type Spot = (typeof SPOTS)[number];
/** The fox's line along the top verge, and how far it strays either side of it. */
export const FOX_Y = 118, FOX_SWAY = 6;
const TOP_COVER = 44, BOTTOM_COVER = WORLD_H + 30;

const between = (rand: Rand, [a, b]: [number, number]) => a + rand() * (b - a);
/** The quiet spell before the next visit; in winter the animals keep in more, and their tracks tell of them. */
const quiet = (season: Season, rand: Rand) => between(rand, QUIET) * (season === 'winter' ? 2 : 1);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far (x, y) is from the player's machine and implement, measured from its body, roughly. */
export function machineDist(v: Vehicle, rig: Rig, x: number, y: number): number {
  const [r0, r1] = EXT[rig], c = Math.cos(v.a), s = Math.sin(v.a);
  const ax = v.x + c * r0 * SCALE, ay = v.y + s * r0 * SCALE, dx = c * (r1 - r0) * SCALE, dy = s * (r1 - r0) * SCALE;
  const k = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - dx * k, y - ay - dy * k) - 30;
}

/** Snow lies on the grass but never on the field's soil; nor in the barn or on its gravel apron. */
export function onSnowyGrass(x: number, y: number): boolean {
  if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) return false;
  if (x > FIELD.x - 4 && x < FIELD.x + FIELD.w + 4 && y > FIELD.y - 4 && y < FIELD.y + FIELD.h + 4) return false;
  if (x > BARN.x - 4 && x < BARN.x + BARN.w + 4 && y > BARN.y - 4 && y < BARN.y + BARN.h + 4) return false;
  return !(x > DOOR_X - 8 && x < DOOR_X + 76 && y > DOOR_Y - 74 && y < DOOR_Y + 74);
}

export function createWildlife(rand: Rand = Math.random): Wildlife {
  return { t: 0, hares: [], fox: null, wait: between(rand, FIRST_WAIT), prints: [] };
}

/** Somebody is out: a hare (or a boxing pair) or the fox, never both. */
export const visiting = (w: Wildlife): boolean => w.hares.length > 0 || w.fox !== null;

/** Walk toward (tx, ty), turning smoothly; true once there. */
function walk(c: { x: number; y: number; a: number }, tx: number, ty: number, speed: number, dt: number): boolean {
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < 1.5) return true;
  const want = Math.atan2(ty - c.y, tx - c.x);
  c.a += wrapA(want - c.a) * Math.min(1, (5 * dt) / 1000);
  const step = Math.min(d, (speed * dt) / 1000) * Math.max(0.25, Math.cos(wrapA(want - c.a)));
  c.x += Math.cos(c.a) * step; c.y += Math.sin(c.a) * step;
  return false;
}

function spawnHares(w: Wildlife, sc: WildScene, rand: Rand): void {
  // the spot on either verge farthest from the machine, out of a handful
  let best = { x: 0, y: 0, spot: 0 }, bd = -Infinity;
  for (let i = 0; i < 12; i++) {
    const spot = i % SPOTS.length, g: Spot = SPOTS[spot];
    const x = between(rand, [g.x0, g.x1 - 30]), y = between(rand, [g.y0, g.y1]), d = machineDist(sc.v, sc.rig, x, y);
    if (d > bd) { bd = d; best = { x, y, spot }; }
  }
  const home = SPOTS[best.spot].home;
  if (bd < SIT_CLEAR) return;   // the machine is everywhere; try again in a while
  const boxing = sc.season === 'spring' && rand() < 0.4;
  for (let i = 0; i < (boxing ? 2 : 1); i++) {
    const tx = best.x + i * 24, ty = best.y, sy = home === 'top' ? TOP_COVER + 16 : BOTTOM_COVER;
    w.hares.push({ x: tx + between(rand, [-30, 30]), y: sy, a: home === 'top' ? Math.PI / 2 : -Math.PI / 2, state: 'in', tx, ty, home, spot: best.spot, timer: boxing ? between(rand, BOX_MS) : 0, sits: 1 + Math.floor(rand() * 3), phase: 0, ears: 1, dist: 0 });
  }
}

function spawnFox(w: Wildlife, sc: WildScene, rand: Rand): void {
  // in from the side away from the machine
  const dir = sc.v.x > WORLD_W / 2 ? 1 : -1;
  w.fox = { x: dir > 0 ? -40 : WORLD_W + 40, y: FOX_Y + between(rand, [-FOX_SWAY, FOX_SWAY]), a: dir > 0 ? 0 : Math.PI, dir, stopX: between(rand, [FIELD.x + 120, FIELD.x + FIELD.w - 120]), stopped: false, pause: 0, shy: false, head: 0, dist: 0 };
}

function lay(w: Wildlife, p: Omit<Print, 'age'>): void {
  if (!onSnowyGrass(p.x, p.y)) return;
  w.prints.push({ ...p, age: 0 });
  if (w.prints.length > MAX_PRINTS) w.prints.shift();
}

function goHome(h: Hare, rand: Rand): void {
  h.state = 'run';
  h.tx = h.x + between(rand, [-50, 50]); h.ty = h.home === 'top' ? TOP_COVER : BOTTOM_COVER;
}

function stepHares(w: Wildlife, sc: WildScene, dt: number, snow: boolean, rand: Rand): void {
  const pair = w.hares.length === 2;
  for (const h of w.hares) {
    const x0 = h.x, y0 = h.y;
    if (h.state !== 'run' && h.state !== 'gone' && machineDist(sc.v, sc.rig, h.x, h.y) < HARE_SHY) goHome(h, rand);
    if (h.state === 'in') {
      h.phase += dt * 0.012;
      if (walk(h, h.tx, h.ty, HARE_WALK, dt)) {
        h.state = pair && h.timer > 0 ? 'box' : 'sit';
        if (h.state === 'sit') h.timer = between(rand, SIT_MS);
      }
    } else if (h.state === 'sit') {
      // ears up, now and then laid back
      h.ears += ((Math.sin(w.t / 1900 + h.tx) > 0.2 ? 1 : 0.2) - h.ears) * Math.min(1, dt / 500);
      if ((h.timer -= dt) <= 0) {
        if (h.sits-- <= 0) goHome(h, rand);
        else {
          // a few unhurried hops, staying on its stretch of ground
          const g = SPOTS[h.spot];
          h.tx = Math.min(g.x1, Math.max(g.x0, h.x + between(rand, [-30, 30]))); h.ty = Math.min(g.y1, Math.max(g.y0, h.y + between(rand, [-12, 12])));
          h.state = 'in';
        }
      }
    } else if (h.state === 'box') {
      // facing each other up on their hind legs; when one bolts, so does the other
      const o = w.hares.find((x) => x !== h)!;
      h.a = Math.atan2(o.y - h.y, o.x - h.x); h.ears = 1;
      if ((h.timer -= dt) <= 0 || o.state === 'run' || o.state === 'gone') goHome(h, rand);
    } else if (h.state === 'run') {
      h.phase += dt * 0.024;
      if (walk(h, h.tx, h.ty, HARE_RUN, dt)) h.state = 'gone';
    }
    if (snow && (h.state === 'in' || h.state === 'run') && (h.dist += Math.hypot(h.x - x0, h.y - y0)) > HARE_BOUND) {
      h.dist = 0; lay(w, { x: h.x, y: h.y, a: h.a, kind: 'hare', side: 0 });
    }
  }
  if (w.hares.every((h) => h.state === 'gone')) { w.hares = []; w.wait = quiet(sc.season, rand); }
}

function stepFox(w: Wildlife, f: Fox, sc: WildScene, dt: number, snow: boolean, rand: Rand): void {
  const x0 = f.x, y0 = f.y;
  // the machine coming near turns it back the way it came, a little quicker
  if (!f.shy && machineDist(sc.v, sc.rig, f.x, f.y) < FOX_SHY) { f.shy = true; f.dir = -f.dir; f.pause = 0; }
  if (f.pause > 0) {
    // stops once along the verge to look about
    f.head = 0.9 * Math.sin(w.t / 700) * f.dir + 0.6 * f.dir;
    f.pause = Math.max(0, f.pause - dt);
  } else {
    f.head *= Math.max(0, 1 - dt / 300);
    if (!f.stopped && !f.shy && f.dir * (f.x - f.stopX) >= 0) { f.stopped = true; f.pause = between(rand, [2800, 4200]); }
    f.a += wrapA((f.dir > 0 ? 0 : Math.PI) - f.a) * Math.min(1, dt / 400);
    const sp = ((f.shy ? FOX_HURRY : FOX_TROT) * dt) / 1000;
    f.x += Math.cos(f.a) * sp;
    f.y = Math.min(FOX_Y + FOX_SWAY, Math.max(FOX_Y - FOX_SWAY, f.y + Math.sin(f.a) * sp + Math.sin(w.t / 900) * 0.04));
  }
  if (snow && (f.dist += Math.hypot(f.x - x0, f.y - y0)) > FOX_STEP) {
    f.dist = 0; lay(w, { x: f.x, y: f.y, a: f.a, kind: 'fox', side: w.prints.length % 2 ? 1 : -1 });
  }
  if (f.x < -60 || f.x > WORLD_W + 60) { w.fox = null; w.wait = quiet(sc.season, rand); }
}

/** Move the wildlife on by dt ms. The fox comes by more often in autumn and winter. */
export function stepWildlife(w: Wildlife, sc: WildScene, dt: number, rand: Rand = Math.random): void {
  w.t += dt;
  const snow = sc.season === 'winter';
  if (!visiting(w) && (w.wait -= dt) <= 0) {
    if (rand() < (sc.season === 'autumn' || snow ? 0.5 : 0.3)) spawnFox(w, sc, rand);
    else spawnHares(w, sc, rand);
    if (!visiting(w)) w.wait = quiet(sc.season, rand);
  }
  if (w.hares.length) stepHares(w, sc, dt, snow, rand);
  if (w.fox) stepFox(w, w.fox, sc, dt, snow, rand);
  for (const p of w.prints) p.age += dt;
  w.prints = w.prints.filter((p) => p.age < PRINT_MS);
}

/** How dark a print still is, 0..1: fresh prints are clear and fade as the snow settles on them. */
export const printFade = (p: Print): number => Math.max(0, 1 - p.age / PRINT_MS);

/**
 * Last night's tracks, already in the snow each winter morning: a hare along the top verge, another
 * down the yard by the barn, and a fox along the far hedge. Only the points on snowy grass are kept.
 */
export const OLD_TRACKS: readonly Omit<Print, 'age'>[] = (() => {
  const out: Omit<Print, 'age'>[] = [];
  const trail = (kind: Print['kind'], pts: [number, number][], gap: number) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s], [x1, y1] = pts[s + 1], a = Math.atan2(y1 - y0, x1 - x0), n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / gap);
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * i) / n + Math.sin(i * 0.7) * 3, y = y0 + ((y1 - y0) * i) / n;
        if (onSnowyGrass(x, y)) out.push({ x, y, a, kind, side: i % 2 ? 1 : -1 });
      }
    }
  };
  trail('hare', [[470, 74], [620, 118], [790, 104], [960, 128], [1120, 96]], HARE_BOUND);
  trail('fox', [[1696, 150], [1620, 260], [1640, 420], [1606, 600], [1650, 760], [1600, 930]], FOX_STEP);
  trail('hare', [[330, 140], [372, 300], [352, 520], [384, 700], [360, 900]], HARE_BOUND);
  return out;
})();
