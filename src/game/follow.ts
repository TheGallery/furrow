// What can be followed: every creature, bird, passer-by and the machine, as a plain point with a hit
// shape, a name and how close to frame it. It only reads the game's own objects and changes none of
// them. A followed thing is found again each frame by `ref`: the creature's own object (sheep, hens,
// birds, the hare, the fox and passers-by are moved in place), or a name for the machine and the
// swallows, whose positions are worked out afresh every frame.
import { type Animals, TURN_BANDS, henIndoors } from './animals';
import { type Birds, swallows } from './birds';
import { type Cam, MAX_ZOOM } from './camera';
import { SCALE, W, WORLD_W, ZOOM } from './constants';
import { LANE_MID, type Lane, type PasserKind, laneOffset } from './lane';
import { EXT } from './machines';
import type { Rig, Season } from './types';
import type { Vehicle } from './vehicle';
import type { Wildlife } from './wildlife';

export type Kind = 'machine' | 'dog' | 'ewe' | 'lamb' | 'hen' | 'chick' | 'gull' | 'rook' | 'sparrow' | 'robin' | 'swallow' | 'hare' | 'fox' | 'passer';

export interface Target {
  ref: object | string;
  kind: Kind;
  /** "the dog", "a gull", "your cultivator". */
  name: string;
  /** What it is up to: "pacing you along the verge". */
  doing: string;
  x: number; y: number; a: number;
  /** Hit shape: a capsule `r` wide from `back` behind (x, y) to `front` ahead along the heading; a circle when both are 0. */
  r: number; back: number; front: number;
  /** How close to frame it, as a zoom: small things closer. */
  zoom: number;
  /** Quick in the air: follow the middle of its loops, not every swerve. */
  quick: boolean;
}

/** The farm as following sees it, this frame. */
export interface FarmNow {
  v: Vehicle; rig: Rig;
  /** The machine's name in the barn, e.g. "Cultivator". */
  machine: string;
  working: boolean;
  animals: Animals; birds: Birds; wild: Wildlife; lane: Lane;
  season: Season;
  blend: { from: Season; to: Season; k: number };
  /** 0 by day, 1 through the night. */
  dark: number;
}

const PASSER: Record<PasserKind, { name: string; doing: string; back: number; front: number; r: number; zoom: number }> = {
  bales: { name: "the neighbour's tractor", doing: 'taking bales along the lane', back: 156, front: 70, r: 24, zoom: 1.9 },
  pumpkins: { name: "the neighbour's tractor", doing: 'carting pumpkins', back: 144, front: 70, r: 24, zoom: 1.9 },
  feed: { name: "the neighbour's tractor", doing: 'taking feed out', back: 39, front: 90, r: 24, zoom: 2 },
  van: { name: 'a van', doing: 'passing on the lane', back: 47, front: 48, r: 25, zoom: 2.2 },
  bike: { name: 'a cyclist', doing: 'riding along the lane', back: 17, front: 17, r: 9, zoom: 2.6 },
  walker: { name: 'a walker and a dog', doing: 'out for a walk', back: 0, front: 0, r: 22, zoom: 2.6 },
  flock: { name: 'a flock on the move', doing: 'sheep moved along the lane', back: 190, front: 14, r: 26, zoom: 1.9 },
};

const circle = (r: number) => ({ r, back: 0, front: 0 });
const weight = (b: FarmNow['blend'], s: Season) => (b.from === s ? 1 - b.k : 0) + (b.to === s ? b.k : 0);

function dogDoing(a: Animals): string {
  const d = a.dog, onVerge = d.x > (TURN_BANDS[0].x0 + TURN_BANDS[0].x1) / 2;
  if (d.pose === 'curl') return 'curled up by the bales';
  if (d.cross) return 'crossing the yard';
  if (onVerge) return d.pose === 'trot' ? 'pacing you along the verge' : d.pose === 'lie' ? 'lying on the verge, watching you' : 'watching you from the verge';
  return d.pose === 'trot' ? 'trotting about the yard' : d.pose === 'lie' ? 'lying by the bales' : 'standing by the bales';
}

/** Everything on the farm that can be followed right now: what is drawn, by the same rules the drawing uses. */
export function targets(f: FarmNow): Target[] {
  const out: Target[] = [], { v, animals: an, birds: b, wild: w } = f;
  const spring = weight(f.blend, 'spring'), summer = weight(f.blend, 'summer');

  out.push({ ref: 'machine', kind: 'machine', name: `your ${f.machine.toLowerCase()}`, doing: f.working ? 'at work' : Math.abs(v.speed) > 1 ? 'on the move' : 'standing',
    x: v.x, y: v.y, a: v.a, r: 36, back: -EXT[f.rig][0] * SCALE, front: EXT[f.rig][1] * SCALE, zoom: 1.8, quick: false });

  const d = an.dog;
  out.push({ ref: d, kind: 'dog', name: 'the dog', doing: dogDoing(an), x: d.x, y: d.y, a: d.a, ...(d.pose === 'curl' ? circle(10) : { r: 7, back: 20, front: 17 }), zoom: 2.8, quick: false });

  for (const s of an.sheep) {
    if (s.lamb && spring < 0.05) continue;
    const doing = s.lamb ? (s.hop > 0 ? 'skipping' : 'keeping close to its mother')
      : s.state === 'route' ? (an.flock === 'out' ? 'walking out to the field' : 'walking home') : s.state === 'lie' ? 'lying down' : s.state === 'walk' ? 'wandering' : 'grazing';
    out.push({ ref: s, kind: s.lamb ? 'lamb' : 'ewe', name: s.lamb ? 'a lamb' : 'a ewe', doing, x: s.x, y: s.y, a: s.a,
      ...(s.lamb ? { r: 6, back: 7, front: 8 } : { r: 9, back: 11, front: 14 }), zoom: s.lamb ? 3 : 2.8, quick: false });
  }
  an.hens.forEach((h, i) => {
    if (henIndoors(f.season, i)) return;
    const doing = an.roost ? 'roosting by the bales' : h.flap > 0.2 ? 'bustling out of the way' : h.moving ? 'scratching about' : 'pecking';
    out.push({ ref: h, kind: 'hen', name: h.brown ? 'a brown hen' : 'a white hen', doing, x: h.x, y: h.y, a: h.a, ...circle(7), zoom: 3.2, quick: false });
  });
  if (spring > 0.05) for (const c of an.chicks) out.push({ ref: c, kind: 'chick', name: 'a chick', doing: 'following the hen', x: c.x, y: c.y, a: c.a, ...circle(3.5), zoom: 3.4, quick: false });

  for (const g of b.flock) {
    const doing = g.state === 'ground' ? 'on the fresh furrow' : g.state === 'arrive' ? 'coming in to land' : g.state === 'leave' ? 'flying off' : 'settling further back';
    out.push({ ref: g, kind: g.kind, name: g.kind === 'gull' ? 'a gull' : 'a rook', doing, x: g.x, y: g.y, a: g.a, ...circle(g.state === 'ground' ? 7 : 12), zoom: 2.8, quick: false });
  }
  for (const p of b.hedge) {
    out.push({ ref: p, kind: p.kind, name: p.kind === 'robin' ? 'the robin' : 'a sparrow', doing: p.flying ? 'hopping to another perch' : 'on the hedge top',
      x: p.x, y: p.y, a: p.a, ...circle(p.flying ? 6 : 4.5), zoom: 3.4, quick: false });
  }
  // the swallows go to roost as the light goes, as the drawing has it
  if (summer * (1 - f.dark) > 0.05) swallows(b).forEach((s, i) => out.push({ ref: `swallow:${i}`, kind: 'swallow', name: 'a swallow', doing: 'looping over the crop', x: s.x, y: s.y, a: s.a, ...circle(9), zoom: 2.2, quick: true }));

  for (const h of w.hares) {
    if (h.state === 'gone') continue;
    const doing = h.state === 'in' ? 'coming out to sit' : h.state === 'sit' ? 'sitting out' : h.state === 'box' ? 'boxing' : 'loping home';
    out.push({ ref: h, kind: 'hare', name: 'a hare', doing, x: h.x, y: h.y, a: h.a, ...(h.state === 'sit' || h.state === 'box' ? circle(8) : { r: 5, back: 9, front: 10 }), zoom: 2.8, quick: false });
  }
  const fx = w.fox;
  if (fx) out.push({ ref: fx, kind: 'fox', name: 'the fox', doing: fx.pause > 0 ? 'stopping to look about' : fx.shy ? 'turning back' : 'trotting along the verge', x: fx.x, y: fx.y, a: fx.a, r: 6, back: 24, front: 17, zoom: 2.6, quick: false });

  for (const p of f.lane.passers) {
    if (p.x < -60 || p.x > WORLD_W + 60) continue;
    const k = PASSER[p.kind], y = LANE_MID + laneOffset(p);
    const doing = p.v < p.speed * 0.4 ? 'waiting for you to pass' : p.kind === 'walker' && p.wave > 0.5 ? 'waving to you' : k.doing;
    // the walker's dog trots a little to one side, so the walker's circle sits between them
    const wx = p.kind === 'walker' ? p.dir : 0, wy = p.kind === 'walker' ? p.dir * 9.5 : 0;
    out.push({ ref: p, kind: 'passer', name: k.name, doing, x: p.x + wx, y: y + wy, a: p.dir > 0 ? 0 : Math.PI, r: k.r, back: k.back, front: k.front, zoom: k.zoom, quick: false });
  }
  return out;
}

/** How far (x, y) is from a target's shape, in world units; negative inside it. */
export function shapeDist(t: Target, x: number, y: number): number {
  const c = Math.cos(t.a), s = Math.sin(t.a), ax = t.x - c * t.back, ay = t.y - s * t.back;
  const dx = c * (t.back + t.front), dy = s * (t.back + t.front), L = dx * dx + dy * dy;
  const k = L > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
  return Math.hypot(x - ax - dx * k, y - ay - dy * k) - t.r;
}

/**
 * What a click at (x, y) means: the smallest thing under the pointer, so a gull in front of the machine
 * can be picked; otherwise the nearest thing within `reach` world units; otherwise nothing.
 */
export function pickAt(ts: readonly Target[], x: number, y: number, reach: number): Target | null {
  let best: Target | null = null, bd = Infinity;
  for (const t of ts) {
    const d = shapeDist(t, x, y);
    if (d > reach) continue;
    const score = d <= 0 ? t.r - 1000 : d;
    if (score < bd) { bd = score; best = t; }
  }
  return best;
}

/** The thing with this `ref` this frame, or null once it has gone (the hare into cover, a gull away, a passer-by off the lane). */
export const find = (ts: readonly Target[], ref: unknown): Target | null => ts.find((t) => t.ref === ref) ?? null;

/** What to say when a followed thing has gone out of sight. */
export function goneText(t: Target): string {
  switch (t.kind) {
    case 'hare': return 'The hare has gone back into cover';
    case 'fox': return 'The fox has slipped away';
    case 'gull': case 'rook': return `The ${t.kind} has flown off`;
    case 'swallow': return 'The swallows have gone to roost';
    case 'passer': return 'Gone on down the lane';
    case 'hen': return 'The hen has gone in out of the cold';
    default: return 'Out of sight now';
  }
}

/** How long the view stays on the spot where something went out of sight before it goes home, in ms. */
export const GONE_MS = 1500;

/** Something followed: how it last looked, how fast it is going (smoothed) and, once it has gone, what to say. */
export interface Following {
  ref: Target['ref'];
  last: Target;
  /** Velocity in world units per second, smoothed over about 0.3 s, for the look-ahead. */
  vx: number; vy: number;
  /** The slow middle of where it has been, over about 1.3 s: where to look for a quick flier. */
  mx: number; my: number;
  /** Set while it is out of sight: what to say, and ms left before the view goes home. */
  gone: { text: string; ms: number } | null;
}

export const startFollowing = (t: Target): Following => ({ ref: t.ref, last: t, vx: 0, vy: 0, mx: t.x, my: t.y, gone: null });

/** One frame (dt in ms) of following: find the thing again and track how it moves; null while it is out of sight. */
export function stepFollowing(f: Following, ts: readonly Target[], dt: number): Target | null {
  const t = find(ts, f.ref);
  if (!t) {
    f.gone ??= { text: goneText(f.last), ms: GONE_MS };
    f.gone.ms -= dt;
    return null;
  }
  const s = Math.max(1, dt) / 1000, a = Math.min(1, dt / 300), b = Math.min(1, dt / 1300);
  f.vx += ((t.x - f.last.x) / s - f.vx) * a; f.vy += ((t.y - f.last.y) / s - f.vy) * a;
  f.mx += (t.x - f.mx) * b; f.my += (t.y - f.my) * b;
  f.last = t; f.gone = null;
  return t;
}

/** True once the followed thing has been out of sight long enough for the view to go home. */
export const goneHome = (f: Following): boolean => f.gone !== null && f.gone.ms <= 0;

/** Where to look for a followed thing: about half a second ahead of where it is going, never more than a sixth of the view; for a quick flier, the middle of its loops. */
export function framing(f: Following, t: Target): Cam {
  const zoom = Math.min(MAX_ZOOM, t.zoom);
  if (t.quick) return { x: f.mx, y: f.my, zoom };
  const most = W / (ZOOM * zoom) / 6, lead = (v: number) => Math.max(-most, Math.min(most, v * 0.5));
  return { x: t.x + lead(f.vx), y: t.y + lead(f.vy), zoom };
}
