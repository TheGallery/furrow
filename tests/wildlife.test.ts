import { describe, expect, it } from 'vitest';
import { DOOR_X, DOOR_Y, FIELD, LANE, WORLD_W } from '../src/game/constants';
import type { Season } from '../src/game/types';
import type { Vehicle } from '../src/game/vehicle';
import {
  FOX_SHY, FOX_SWAY, FOX_Y, HARE_HALF, HARE_SHY, MAX_PRINTS, OLD_TRACKS, PRINT_MS, type Print, SPOTS, type WildScene, type Wildlife,
  createWildlife, inTurnBand, machineDist, onSnowyGrass, printFade, stepWildlife, visiting,
} from '../src/game/wildlife';

// a repeatable stand-in for Math.random
function seeded(seed = 1): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** Parked in the yard by the barn door, out of everybody's way. */
const parked: Vehicle = { x: DOOR_X + 130, y: DOOR_Y, a: 0, speed: 0 };
const scene = (season: Season, v: Vehicle = parked): WildScene => ({ season, v, rig: 'cultivate' });

function run(w: Wildlife, ms: number, sc: WildScene | ((t: number) => WildScene), rand = seeded(), each?: (w: Wildlife) => void): void {
  for (let t = 0; t < ms; t += 16) { stepWildlife(w, typeof sc === 'function' ? sc(t) : sc, 16, rand); each?.(w); }
}

/** Runs until somebody comes out. */
function untilVisit(w: Wildlife, sc: WildScene, rand: () => number, ms = 120_000): void {
  for (let t = 0; t < ms && !visiting(w); t += 16) stepWildlife(w, sc, 16, rand);
}

// a hare settles within a step of the spot it picked
const onSpot = (x: number, y: number) => SPOTS.some((g) => x >= g.x0 - 2 && x <= g.x1 + 2 && y >= g.y0 - 2 && y <= g.y1 + 2);

describe('visits', () => {
  it('come now and then, with long quiet spells, one at a time', () => {
    const w = createWildlife(seeded());
    let visits = 0, was = false, quiet = 0, shortest = Infinity, both = false;
    run(w, 20 * 60 * 1000, scene('autumn'), seeded(3), (w) => {
      const now = visiting(w);
      if (now && !was) { visits++; if (visits > 1) shortest = Math.min(shortest, quiet); }
      quiet = now ? 0 : quiet + 16;
      if (w.hares.length && w.fox) both = true;
      was = now;
    });
    expect(both).toBe(false);
    expect(visits).toBeGreaterThan(8);
    expect(visits).toBeLessThan(40);
    expect(shortest).toBeGreaterThanOrEqual(22_000);
  });

  it('are seldom in winter, when the tracks tell of them instead', () => {
    const count = (season: Season) => {
      const w = createWildlife(seeded());
      let visits = 0, was = false;
      run(w, 30 * 60 * 1000, scene(season), seeded(3), (w) => { if (visiting(w) && !was) visits++; was = visiting(w); });
      return visits;
    };
    expect(count('winter')).toBeLessThan(count('autumn') * 0.8);
  });

  it('the first comes within a quarter of a minute or so', () => {
    const w = createWildlife(seeded());
    run(w, 7000, scene('summer'), seeded());
    expect(visiting(w)).toBe(false);
    run(w, 8000, scene('summer'), seeded());
    expect(visiting(w)).toBe(true);
  });

  it('never move the machine', () => {
    const w = createWildlife(seeded()), v = { ...parked };
    run(w, 3 * 60 * 1000, scene('spring', v));
    expect(v).toEqual(parked);
  });
});

describe('the hare', () => {
  it('sits out on a verge or the edge of the field, clear of the turn bands, far from the machine', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      const rand = seeded(7), w = createWildlife(rand), where = new Set<number>();
      let sat = 0;
      run(w, 15 * 60 * 1000, scene(season), rand, (w) => {
        for (const h of w.hares) if (h.state === 'sit' || h.state === 'box') {
          sat++; where.add(h.spot);
          expect(onSpot(h.x, h.y)).toBe(true);
          expect(inTurnBand(h.x, h.y)).toBe(false);
          expect(machineDist(parked, 'cultivate', h.x, h.y)).toBeGreaterThan(HARE_SHY);
        }
      });
      expect(sat).toBeGreaterThan(0);
      if (season !== 'winter') expect(where.size).toBeGreaterThan(1);
    }
  });

  it('lopes off home when the machine comes near, and is gone before it arrives', () => {
    const rand = seeded(2), w = createWildlife(rand);
    let found = false;
    for (let tries = 0; tries < 40 && !found; tries++) {
      untilVisit(w, scene('summer'), rand);
      run(w, 6000, scene('summer'), rand);
      found = w.hares.length === 1 && w.hares[0].state === 'sit';
      if (!found) run(w, 60_000, scene('summer'), rand);
    }
    expect(found).toBe(true);
    const h = w.hares[0], home = h.home;
    // the machine drives up along the verge toward it; its front is 69 ahead of its middle
    const v = { x: h.x - (HARE_SHY + 30 + 69 + 60), y: h.y, a: 0, speed: 40 };
    stepWildlife(w, scene('summer', v), 16, rand);
    expect(h.state).toBe('sit');
    v.x += 120;
    stepWildlife(w, scene('summer', v), 16, rand);
    expect(h.state).toBe('run');
    run(w, 3000, scene('summer', v), rand);
    expect(w.hares).toHaveLength(0);
    expect(home === 'top' || home === 'bottom').toBe(true);
  });

  it('every visit ends of its own accord within a minute and a half', () => {
    const rand = seeded(5), w = createWildlife(rand);
    let visits = 0;
    for (let i = 0; i < 12; i++) {
      untilVisit(w, scene('summer'), rand);
      expect(visiting(w)).toBe(true);
      visits++;
      for (let t = 0; t < 90_000 && visiting(w); t += 16) stepWildlife(w, scene('summer'), 16, rand);
      expect(visiting(w)).toBe(false);
    }
    expect(visits).toBe(12);
  });

  it('only boxes in spring, as a pair facing each other', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      const rand = seeded(11), w = createWildlife(rand);
      let pairs = 0, boxed = 0;
      run(w, 30 * 60 * 1000, scene(season), rand, (w) => {
        if (w.hares.length > 2) throw new Error('more than a pair');
        if (w.hares.length === 2) pairs++;
        if (w.hares.some((h) => h.state === 'box')) boxed++;
      });
      if (season === 'spring') { expect(pairs).toBeGreaterThan(0); expect(boxed).toBeGreaterThan(0); }
      else { expect(pairs).toBe(0); expect(boxed).toBe(0); }
    }
  });
});

describe('the fox', () => {
  function foxOut(season: Season, seed: number): { w: Wildlife; rand: () => number } {
    // step until a fox has just come out
    const rand = seeded(seed), w = createWildlife(rand);
    for (let t = 0; t < 60 * 60 * 1000 && !w.fox; t += 16) stepWildlife(w, scene(season), 16, rand);
    expect(w.fox).not.toBeNull();
    return { w, rand };
  }

  it('trots the top verge from one side to the other, stopping once to look about', () => {
    const { w, rand } = foxOut('autumn', 4);
    const f = w.fox!, dir = f.dir;
    let stops = 0, paused = false;
    while (w.fox) {
      stepWildlife(w, scene('autumn'), 16, rand);
      if (!w.fox) break;
      expect(Math.abs(w.fox.y - FOX_Y)).toBeLessThanOrEqual(FOX_SWAY + 1e-9);
      if (w.fox.pause > 0 && !paused) { stops++; expect(inTurnBand(w.fox.x, w.fox.y)).toBe(false); }
      paused = w.fox.pause > 0;
    }
    expect(stops).toBe(1);
    expect(f.dir).toBe(dir);
    expect(dir > 0 ? f.x > WORLD_W : f.x < 0).toBe(true);
  });

  it('turns back the way it came when the machine is on the verge ahead', () => {
    const { w, rand } = foxOut('winter', 6);
    const f = w.fox!, dir = f.dir;
    run(w, 4000, scene('winter'), rand);
    // the machine waits on the verge a little ahead of the fox
    const v = { x: f.x + dir * (FOX_SHY + 80), y: FOX_Y, a: 0, speed: 0 };
    for (let i = 0; i < 2000 && w.fox; i++) {
      stepWildlife(w, scene('winter', v), 16, rand);
      expect(machineDist(v, 'cultivate', f.x, f.y)).toBeGreaterThan(FOX_SHY - 30);
    }
    expect(f.dir).toBe(-dir);
  });
});

describe('tracks in the snow', () => {
  it('are left only in winter, only on the snowy grass, never on the field', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      const rand = seeded(9), w = createWildlife(rand);
      let most = 0;
      run(w, 10 * 60 * 1000, scene(season), rand, (w) => {
        most = Math.max(most, w.prints.length);
        expect(w.prints.length).toBeLessThanOrEqual(MAX_PRINTS);
      });
      if (season !== 'winter') expect(most).toBe(0);
      else {
        expect(most).toBeGreaterThan(10);
        for (const p of w.prints) expect(onSnowyGrass(p.x, p.y)).toBe(true);
      }
    }
  });

  it('fade away over a minute and a half', () => {
    const rand = seeded(9), w = createWildlife(rand);
    run(w, 6 * 60 * 1000, scene('winter'), rand);
    expect(w.prints.every((p) => p.age < PRINT_MS)).toBe(true);
    expect(w.prints.every((p) => printFade(p) > 0 && printFade(p) <= 1)).toBe(true);
    // the snow melts away in spring and no new prints are laid
    run(w, PRINT_MS + 100, scene('spring'), rand);
    expect(w.prints).toHaveLength(0);
  });

  it('last night\'s tracks lie only on the snowy grass', () => {
    expect(OLD_TRACKS.length).toBeGreaterThan(100);
    for (const p of OLD_TRACKS) expect(onSnowyGrass(p.x, p.y)).toBe(true);
  });

  it('snow lies on the grass but not the field, the barn or its apron', () => {
    expect(onSnowyGrass(FIELD.x + 200, FIELD.y + 200)).toBe(false);
    expect(onSnowyGrass(DOOR_X + 30, DOOR_Y)).toBe(false);
    expect(onSnowyGrass(100, DOOR_Y)).toBe(false);
    expect(onSnowyGrass(FIELD.x + 200, 120)).toBe(true);
    expect(onSnowyGrass(FIELD.x + 200, FIELD.y + FIELD.h + 40)).toBe(true);
  });

  it('nor in the hedges along the top and down either side', () => {
    expect(onSnowyGrass(FIELD.x + 200, 60)).toBe(false);
    expect(onSnowyGrass(60, 200)).toBe(false);
    expect(onSnowyGrass(WORLD_W - 30, 400)).toBe(false);
    expect(onSnowyGrass(FIELD.x + FIELD.w + 30, 400)).toBe(true);
  });

  it('a fox puts its prints left and right of its line in turn', () => {
    const rand = seeded(9), w = createWildlife(rand);
    let steps = 0, last: Print | undefined;
    run(w, 30 * 60 * 1000, scene('winter'), rand, (w) => {
      const p = w.prints[w.prints.length - 1];
      if (!p || p === last || p.kind !== 'fox') return;
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 20) { expect(p.side).toBe(-last.side); steps++; }
      last = p;
    });
    expect(steps).toBeGreaterThan(10);
  });
});

describe('the turn bands', () => {
  it('cover both ends of the field and none of the hare\'s spots', () => {
    expect(inTurnBand(FIELD.x - 60, FIELD.y + 200)).toBe(true);
    expect(inTurnBand(FIELD.x + FIELD.w + 60, FIELD.y + 200)).toBe(true);
    for (const g of SPOTS) for (const x of [g.x0, g.x1]) for (const y of [g.y0, g.y1]) expect(inTurnBand(x, y)).toBe(false);
  });
});

describe('the neighbours\' lane', () => {
  it('has no hare sitting on it, so passers-by never drive over one', () => {
    for (const g of SPOTS) {
      expect(g.y0).toBeLessThanOrEqual(g.y1);
      const clear = g.y1 + HARE_HALF < LANE.y || g.y0 - HARE_HALF > LANE.y + LANE.h;
      expect(clear).toBe(true);
    }
  });

  it('only ever has a hare on it in passing, never sat down there', () => {
    // the machine up at the top of the field, so the hares come out down by the lane
    const rand = seeded(9), w = createWildlife(rand), sc = scene('summer', { x: FIELD.x + FIELD.w / 2, y: FIELD.y + 40, a: 0, speed: 0 });
    let byTheLane = 0;
    for (let t = 0; t < 30 * 60 * 1000; t += 50) {
      stepWildlife(w, sc, 50, rand);
      for (const h of w.hares) if (h.state === 'sit' || h.state === 'box') {
        expect(h.y + HARE_HALF).toBeLessThan(LANE.y);
        if (h.y > FIELD.y + FIELD.h) byTheLane++;
      }
    }
    // the strip of grass beside the lane is still one of its spots
    expect(byTheLane).toBeGreaterThan(0);
  });
});
