import { machineDist } from './birds';
import { FIELD, LANE, SCALE, WORLD_W } from './constants';
import type { Rig, Season } from './types';
import type { Vehicle } from './vehicle';

// The neighbours' lane along the bottom of the farm: now and then someone passes by. A tractor with
// bales or pumpkins, a van, a cyclist, a walker with a dog who waves when you work nearby, a flock
// moved along with a dog. One at a time, with long empty spells. They only ever look at the machine:
// when it noses onto the lane they slow and wait for it, and carry on once it has gone.

export type Rand = () => number;
export type PasserKind = 'bales' | 'van' | 'bike' | 'walker' | 'flock' | 'feed' | 'pumpkins';

export interface Passer {
  kind: PasserKind;
  /** Where along the lane, in world units; it enters and leaves beyond the world's edges. */
  x: number;
  /** +1 heading east, -1 west. */
  dir: number;
  /** World units per second at its own pace. */
  speed: number;
  /** World units per second just now: below `speed` while it waits for the machine. */
  v: number;
  /** How far its tyres have rolled, in machine units (src/game/wheels). */
  roll: number;
  /** 0..1: how far up the walker's hand is. */
  wave: number;
  /** Picks its colours. */
  seed: number;
}

export interface Lane {
  passers: Passer[];
  /** ms until the next one sets off, once the lane is empty. */
  wait: number;
}

/** Who passes by in each season, and how often, as weights. */
export const SPAWN: Record<Season, readonly (readonly [PasserKind, number])[]> = {
  spring: [['walker', 3], ['bike', 2], ['van', 2], ['flock', 1.2]],
  summer: [['bales', 3], ['bike', 2], ['van', 2], ['walker', 2]],
  autumn: [['pumpkins', 3], ['van', 2], ['walker', 2], ['flock', 1]],
  winter: [['feed', 3], ['walker', 2], ['van', 1]],
};
export const SPEED: Record<PasserKind, number> = { bales: 34, van: 48, bike: 26, walker: 11, flock: 10, feed: 30, pumpkins: 32 };
/** The quiet spell between one passer-by leaving and the next setting off, in ms. */
export const QUIET: readonly [number, number] = [8000, 20000];
/** Where passers-by set off and turn back from: beyond the world's edges, behind the corner cards. */
export const OFF = 260;
const ENTER = 160;
/** A machine this close along the lane, low on the field, gets a wave. */
export const WAVE_DIST = 260;
const WAVE_FROM = FIELD.y + FIELD.h * 0.55;
/** How far each passer-by reaches ahead of its middle, in world units. */
export const FRONT: Record<PasserKind, number> = { bales: 70, van: 48, bike: 15, walker: 12, flock: 14, feed: 90, pumpkins: 70 };
/** It waits while the machine is this close to the stretch of lane just ahead of it. */
export const GIVE_WAY = 22;
const LOOK = 36;

export const LANE_MID = LANE.y + LANE.h / 2;

const between = (rand: Rand, [a, b]: readonly [number, number]) => a + rand() * (b - a);

export function createLane(rand: Rand = Math.random): Lane {
  return { passers: [], wait: between(rand, [3000, 8000]) };
}

/** A season's passer-by, picked by weight. */
export function pickKind(season: Season, rand: Rand = Math.random): PasserKind {
  const list = SPAWN[season];
  let r = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[list.length - 1][0];
}

/** How far across the lane a passer-by keeps: vehicles keep to the left, people on foot or bike to the verge. */
export function laneOffset(p: Passer): number {
  return (p.kind === 'walker' || p.kind === 'bike' ? 24 : 9) * -p.dir;
}

/** True while the machine stands on the lane in the passer-by's way, from its middle to just ahead of it. */
export function inTheWay(p: Passer, v: Readonly<Vehicle>, rig: Rig): boolean {
  const y = LANE_MID + laneOffset(p);
  for (const ahead of [0, FRONT[p.kind], FRONT[p.kind] + LOOK]) if (machineDist(v, rig, p.x + p.dir * ahead, y) < GIVE_WAY) return true;
  return false;
}

/** Move the lane on by dt ms. `v` and `rig` are the player's machine, only ever looked at. */
export function stepLane(l: Lane, dt: number, season: Season, v: Readonly<Vehicle>, rig: Rig, rand: Rand = Math.random): void {
  const s = dt / 1000;
  if (!l.passers.length && (l.wait -= dt) <= 0) {
    const kind = pickKind(season, rand), dir = rand() < 0.5 ? 1 : -1;
    l.passers.push({ kind, x: dir > 0 ? -ENTER : WORLD_W + ENTER, dir, speed: SPEED[kind], v: SPEED[kind], roll: 0, wave: 0, seed: rand() });
  }
  for (const p of l.passers) {
    // ease to a stop for the machine, and back up to its own pace once the way is clear
    const want = inTheWay(p, v, rig) ? 0 : p.speed;
    p.v += Math.sign(want - p.v) * Math.min(Math.abs(want - p.v), p.speed * 2 * s);
    p.x += p.dir * p.v * s; p.roll += (p.v * s) / SCALE;
    const near = Math.abs(p.x - v.x) < WAVE_DIST && v.y > WAVE_FROM;
    p.wave += ((near ? 1 : 0) - p.wave) * Math.min(1, dt / 500);
  }
  const before = l.passers.length;
  l.passers = l.passers.filter((p) => p.x > -OFF && p.x < WORLD_W + OFF);
  if (before && !l.passers.length) l.wait = between(rand, QUIET);
}
