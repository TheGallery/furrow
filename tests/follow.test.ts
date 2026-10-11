import { describe, expect, it } from 'vitest';
import { createAnimals, updateAnimals } from '../src/game/animals';
import { createBirds } from '../src/game/birds';
import { DOOR_X, DOOR_Y, W, ZOOM } from '../src/game/constants';
import {
  type FarmNow, GONE_MS, type Kind, type Target, find, framing, goneHome, pickAt, shapeDist, startFollowing, stepFollowing, targets,
} from '../src/game/follow';
import { createLane, type Passer } from '../src/game/lane';
import type { Season } from '../src/game/types';
import { createWildlife, type Hare } from '../src/game/wildlife';

/** A small seeded generator, so every run sees the same farm. */
function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const DT = 1000 / 60;

function farm(season: Season, over: Partial<FarmNow> = {}): FarmNow {
  const rand = seeded(7);
  return {
    v: { x: DOOR_X + 130, y: DOOR_Y, a: 0, speed: 0 }, rig: 'cultivate', machine: 'Cultivator', working: false,
    animals: createAnimals(season, rand), birds: createBirds(rand), wild: createWildlife(rand), lane: createLane(rand),
    season, blend: { from: season, to: season, k: 0 }, dark: 0, ...over,
  };
}

const count = (ts: Target[], kind: Kind) => ts.filter((t) => t.kind === kind).length;

/** A plain target for picking and framing, a circle unless told otherwise. */
const thing = (o: Partial<Target>): Target => ({ ref: {}, kind: 'hen', name: 'a hen', doing: 'pecking', x: 0, y: 0, a: 0, r: 7, back: 0, front: 0, zoom: 3.2, quick: false, ...o });

describe('what can be followed', () => {
  it('is what is drawn: the machine and the dog always, lambs and chicks in spring, swallows on summer days', () => {
    const spring = targets(farm('spring'));
    expect(count(spring, 'machine')).toBe(1);
    expect(count(spring, 'dog')).toBe(1);
    expect(count(spring, 'ewe')).toBe(4);
    expect(count(spring, 'lamb')).toBe(2);
    expect(count(spring, 'chick')).toBe(4);
    expect(count(spring, 'swallow')).toBe(0);

    const summer = targets(farm('summer'));
    expect(count(summer, 'lamb')).toBe(0);
    expect(count(summer, 'chick')).toBe(0);
    expect(count(summer, 'swallow')).toBe(4);
    // the swallows go to roost as the light goes
    expect(count(targets(farm('summer', { dark: 1 })), 'swallow')).toBe(0);

    // in winter only three hens stay out; the rest are indoors
    expect(count(targets(farm('winter')), 'hen')).toBe(3);
    expect(count(spring, 'hen')).toBe(5);
  });

  it('names things the way the chip says them', () => {
    const ts = targets(farm('spring', { working: true }));
    expect(ts.find((t) => t.kind === 'machine')!.name).toBe('your cultivator');
    expect(ts.find((t) => t.kind === 'machine')!.doing).toBe('at work');
    expect(ts.find((t) => t.kind === 'dog')!.name).toBe('the dog');
  });

  it('finds the same creature again frame after frame, however it moves', () => {
    const f = farm('spring'), rand = seeded(3);
    const first = targets(f), dog = first.find((t) => t.kind === 'dog')!, ewe = first.find((t) => t.kind === 'ewe')!;
    for (let t = 0; t < 3000; t += DT) updateAnimals(f.animals, { season: 'spring', v: f.v, rig: f.rig, driving: true, night: 0 }, DT, rand);
    // the machine's pose is replaced every step, so it is found by name
    const later = targets({ ...f, v: { ...f.v, x: f.v.x + 40 } });
    expect(find(later, dog.ref)).not.toBeNull();
    expect(find(later, ewe.ref)?.kind).toBe('ewe');
    expect(find(later, 'machine')!.x).toBe(f.v.x + 40);
    expect(targets(farm('summer')).filter((t) => t.kind === 'swallow').map((t) => t.ref)).toEqual(['swallow:0', 'swallow:1', 'swallow:2', 'swallow:3']);
  });

  it('leaves out a hare gone home and passers-by off the end of the lane', () => {
    const f = farm('spring');
    const hare = (state: Hare['state'], x: number): Hare => ({ x, y: 120, a: 0, state, tx: x, ty: 120, home: 'top', spot: 0, timer: 0, sits: 0, phase: 0, ears: 1, dist: 0 });
    const passer = (x: number): Passer => ({ kind: 'van', x, dir: 1, speed: 48, v: 48, roll: 0, wave: 0, seed: 0 });
    f.wild.hares.push(hare('sit', 600), hare('gone', 700));
    f.lane.passers.push(passer(500), passer(-300));
    const ts = targets(f);
    expect(ts.filter((t) => t.kind === 'hare').map((t) => t.x)).toEqual([600]);
    expect(ts.filter((t) => t.kind === 'passer').map((t) => t.name)).toEqual(['a van']);
  });
});

describe('picking', () => {
  it('measures to a capsule along the heading, or a circle', () => {
    const capsule = thing({ x: 100, y: 100, a: 0, r: 10, back: 30, front: 20 });
    expect(shapeDist(capsule, 100, 100)).toBeCloseTo(-10);
    expect(shapeDist(capsule, 80, 125)).toBeCloseTo(15);          // beside its back half
    expect(shapeDist(capsule, 150, 100)).toBeCloseTo(20);         // ahead of its front end
    expect(shapeDist(thing({ x: 0, y: 0, r: 5 }), 3, 4)).toBeCloseTo(0);
  });

  it('takes the smallest thing under the pointer, then the nearest within reach', () => {
    const machine = thing({ ref: 'machine', kind: 'machine', x: 100, y: 100, r: 36, back: 60, front: 70 });
    const gull = thing({ kind: 'gull', x: 150, y: 100, r: 7 });
    const hen = thing({ x: 400, y: 100, r: 7 });
    const ts = [machine, gull, hen];
    // the gull stands on the machine's shape, and is the one clicked
    expect(pickAt(ts, 151, 100, 10)).toBe(gull);
    expect(pickAt(ts, 80, 100, 10)).toBe(machine);
    // just off the hen, within reach; and nothing at all out in the open
    expect(pickAt(ts, 400, 112, 10)).toBe(hen);
    expect(pickAt(ts, 400, 130, 10)).toBeNull();
  });
});

describe('following', () => {
  it('looks a little ahead of a moving thing, never more than a sixth of the view', () => {
    const at = (x: number) => thing({ ref: 'dog', kind: 'dog', x, y: 300, zoom: 2.8 });
    let x = 500;
    const f = startFollowing(at(x));
    for (let t = 0; t < 2000; t += DT) { x += (80 * DT) / 1000; stepFollowing(f, [at(x)], DT); }
    const cam = framing(f, at(x)), most = W / (ZOOM * 2.8) / 6;
    expect(cam.zoom).toBe(2.8);
    expect(cam.x - x).toBeCloseTo(40, 0);                         // half a second at 80 units/s
    expect(cam.y).toBeCloseTo(300);

    // a bolting hare is still kept in view: the lead stops at a sixth of the view
    for (let t = 0; t < 1000; t += DT) { x += (1000 * DT) / 1000; stepFollowing(f, [at(x)], DT); }
    expect(framing(f, at(x)).x - x).toBeCloseTo(most);
  });

  it('follows a swallow by the middle of its loops, not every swerve', () => {
    const at = (t: number) => thing({ ref: 'swallow:0', kind: 'swallow', x: 800 + Math.sin(t / 300) * 120, y: 400 + Math.cos(t / 300) * 60, quick: true, zoom: 2.2 });
    const f = startFollowing(at(0));
    for (let t = 0; t < 8000; t += DT) stepFollowing(f, [at(t)], DT);
    const cam = framing(f, at(8000));
    expect(Math.abs(cam.x - 800)).toBeLessThan(40);
    expect(Math.abs(cam.y - 400)).toBeLessThan(25);
  });

  it('says when the thing has gone, and lets go after a moment unless it comes back', () => {
    const hare = thing({ kind: 'hare', name: 'a hare', x: 600, y: 120 });
    const f = startFollowing(hare);
    expect(stepFollowing(f, [hare], DT)).toBe(hare);
    expect(stepFollowing(f, [], DT)).toBeNull();
    expect(f.gone?.text).toBe('The hare has gone back into cover');
    expect(goneHome(f)).toBe(false);
    // back within the moment: still followed
    stepFollowing(f, [hare], DT);
    expect(f.gone).toBeNull();
    for (let t = 0; t < GONE_MS - DT; t += DT) stepFollowing(f, [], DT);
    expect(goneHome(f)).toBe(false);
    stepFollowing(f, [], 2 * DT);
    expect(goneHome(f)).toBe(true);
  });
});
