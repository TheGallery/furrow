import { describe, expect, it } from 'vitest';
import { CELL, FIELD } from '../src/game/constants';
import {
  CULTIVATED, GROW_MS, RAW, RIPE, SEEDED, SPROUT_MAX, SPROUT_MS, STUBBLE, WATERED,
  cellAt, createField, grow, summarize, workCell, workStrip,
} from '../src/game/field';

describe('soil state transitions', () => {
  it('runs the year: cultivate, sow, water, grow, harvest', () => {
    const f = createField();
    expect(workCell(f, 0, 'plant', 'wheat').changed).toBe(false);
    expect(workCell(f, 0, 'cultivate', 'wheat')).toEqual({ changed: true, harvested: false });
    expect(f.soil[0]).toBe(CULTIVATED);
    workCell(f, 0, 'plant', 'carrot');
    expect(f.soil[0]).toBe(SEEDED);
    expect(f.crop[0]).toBe(1);
    workCell(f, 0, 'water', 'carrot');
    expect(f.soil[0]).toBe(WATERED);
    expect(workCell(f, 0, 'harvest', 'carrot').changed).toBe(false); // not ripe yet
    f.growth[0] = RIPE;
    expect(workCell(f, 0, 'harvest', 'wheat').changed).toBe(false); // wrong harvester
    expect(workCell(f, 0, 'harvest', 'carrot')).toEqual({ changed: true, harvested: true });
    expect(f.soil[0]).toBe(STUBBLE);
    expect(workCell(f, 0, 'cultivate', 'wheat').changed).toBe(true);
  });

  it('never ploughs up a growing crop', () => {
    const f = createField();
    f.soil[3] = WATERED; f.growth[3] = 0.5;
    expect(workCell(f, 3, 'cultivate', 'wheat').changed).toBe(false);
    expect(f.growth[3]).toBe(0.5);
  });

  it('works a strip square to the heading under the implement', () => {
    const f = createField();
    // edges kept off cell boundaries, so the count does not hang on float rounding
    const { changed } = workStrip(f, FIELD.x + 100, FIELD.y + 100, 0, 21, 'cultivate', 'wheat');
    expect(changed.length).toBe(Math.floor(121 / CELL) - Math.floor(79 / CELL) + 1);
    expect(f.soil[cellAt(FIELD.x + 100, FIELD.y + 90)]).toBe(CULTIVATED);
    expect(f.soil[cellAt(FIELD.x + 100 + CELL, FIELD.y + 100)]).toBe(RAW);
    expect(cellAt(FIELD.x - 1, FIELD.y)).toBe(-1);
    expect(workStrip(f, 10, 10, 0, 20, 'cultivate', 'wheat').changed).toEqual([]);
  });
});

describe('growth', () => {
  it('sprouts unwatered seed only a little, grows watered crops to full, never in winter', () => {
    const f = createField();
    f.soil[0] = SEEDED; f.soil[1] = WATERED; f.soil[2] = CULTIVATED;
    grow(f, SPROUT_MS * 3, 'spring');
    expect(f.growth[0]).toBeCloseTo(SPROUT_MAX);
    expect(f.growth[1]).toBeCloseTo((SPROUT_MS * 3) / GROW_MS);
    expect(f.growth[2]).toBe(0);
    const before = f.growth[1];
    grow(f, GROW_MS, 'winter');
    expect(f.growth[1]).toBe(before);
    grow(f, GROW_MS, 'summer');
    expect(f.growth[1]).toBe(1);
  });

  it('summarizes the field for the barn', () => {
    const f = createField();
    const n = f.soil.length;
    for (let i = 0; i < n / 2; i++) f.soil[i] = CULTIVATED;
    f.soil[0] = WATERED; f.growth[0] = 1; f.crop[0] = 2;
    const s = summarize(f, 'pumpkin');
    expect(s.bare).toBeCloseTo(0.5);
    expect(s.cultivated).toBeCloseTo(0.5 - 1 / n);
    expect(s.ripe).toBeCloseTo(1 / n);
    expect(summarize(f, 'wheat').ripe).toBe(0);
  });
});
