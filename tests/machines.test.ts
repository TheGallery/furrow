import { describe, expect, it } from 'vitest';
import { ease, select, settled, shortest, turn, wrap } from '../src/game/carousel';
import type { FieldSummary } from '../src/game/field';
import { isQuiet, machinesFor, nextUp, statusLine } from '../src/game/machines';

const field = (o: Partial<FieldSummary>): FieldSummary => ({ bare: 0, cultivated: 0, dry: 0, watered: 0, ripe: 0, ...o });

describe('barn machines', () => {
  it('holds each crop its own planter and harvester', () => {
    expect(machinesFor('wheat').map((m) => m.rig)).toEqual(['cultivate', 'drill-hopper', 'spray', 'combine']);
    expect(machinesFor('carrot').map((m) => m.rig)).toEqual(['cultivate', 'drill-precision', 'spray', 'roots']);
    expect(machinesFor('pumpkin').map((m) => m.rig)).toEqual(['cultivate', 'drill-few', 'spray', 'trailer']);
  });

  it('marks next up from the season and the field', () => {
    expect(nextUp('winter', field({ ripe: 1 }))).toBeNull();
    expect(nextUp('spring', field({ bare: 1 }))).toBe('cultivate');
    expect(nextUp('spring', field({ bare: 0.3, cultivated: 0.7 }))).toBe('plant');
    expect(nextUp('summer', field({ dry: 0.9 }))).toBe('water');
    expect(nextUp('autumn', field({ watered: 1, ripe: 0.6 }))).toBe('harvest');
    expect(nextUp('summer', field({ watered: 1 }))).toBeNull();
    expect(nextUp('autumn', field({ bare: 0.2, watered: 0.8 }))).toBe('cultivate');
  });

  it('dims out-of-season machines unless they are next up, and explains the field', () => {
    const [cultivator, , sprayer] = machinesFor('wheat');
    expect(isQuiet(cultivator, 'spring', null)).toBe(false);
    expect(isQuiet(sprayer, 'spring', null)).toBe(true);
    expect(isQuiet(sprayer, 'spring', 'water')).toBe(false);
    expect(statusLine('winter', field({}), 'wheat')).toMatch(/Nothing needs doing/);
    expect(statusLine('autumn', field({ ripe: 0.5 }), 'carrot')).toBe('The carrots are ready to lift.');
  });
});

describe('carousel', () => {
  it('wraps around both ways and eases to the selection', () => {
    expect(wrap(-1, 4)).toBe(3);
    expect(shortest(0, 3, 4)).toBe(-1);
    expect(shortest(3, 0, 4)).toBe(1);
    let c = { n: 4, sel: 0, scroll: 0 };
    c = turn(c, -1);
    expect(c.sel).toBe(3);
    expect(settled(c)).toBe(false);
    for (let i = 0; i < 60; i++) c = ease(c, 16);
    expect(settled(c)).toBe(true);
    expect(select(c, 6).sel).toBe(2);
  });
});
