import { describe, expect, it } from 'vitest';
import { aboutTime, cropStage, growingTime, plantings, seasonClock } from '../src/game/almanac';
import { CELL, COLS, LANE_H, ROWS, SEASON_MS } from '../src/game/constants';
import { CROPS, CULTIVATED, type Field, GROW_MS, RIPE, SEEDED, WATERED, createField } from '../src/game/field';
import type { Crop } from '../src/game/types';

function sow(f: Field, l0: number, l1: number, soil: number, crop: Crop, growth: number): void {
  const r0 = Math.floor((l0 * LANE_H) / CELL), r1 = Math.min(ROWS, Math.floor((l1 * LANE_H) / CELL));
  for (let r = r0; r < r1; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; f.soil[i] = soil; f.crop[i] = CROPS.indexOf(crop); f.growth[i] = growth; }
}

describe('season clock', () => {
  it('names the next season and rounds the time left softly, never in seconds', () => {
    expect(seasonClock(SEASON_MS * 0.4)).toMatchObject({ season: 'spring', next: 'summer', text: 'summer in about 3 min' });
    expect(seasonClock(SEASON_MS * 3.9).text).toBe('spring in under a minute');
    expect(aboutTime(70_000)).toBe('about a minute');
  });

  it('counts winter as a pause when working out when a crop will be ripe', () => {
    expect(growingTime(SEASON_MS * 2.5, SEASON_MS * 0.25)).toBeCloseTo(SEASON_MS * 0.25, -2);
    // half an autumn left, then all of winter, then a quarter of spring
    expect(growingTime(SEASON_MS * 2.5, SEASON_MS * 0.75)).toBeCloseTo(SEASON_MS * 1.75, -2);
  });
});

describe('what is planted', () => {
  it('lists each crop with its share of the field, largest first, after a crop switch', () => {
    const f = createField();
    sow(f, 0, 4, WATERED, 'wheat', 0.4);
    sow(f, 4, 6, SEEDED, 'carrot', 0.1);
    sow(f, 6, 7, CULTIVATED, 'wheat', 0);
    const p = plantings(f);
    expect(p.crops.map((c) => c.crop)).toEqual(['wheat', 'carrot']);
    expect(p.crops[0].share).toBeCloseTo(0.5, 1);
    expect(p.crops[1].share).toBeCloseTo(0.25, 1);
    expect(p.ready).toBeCloseTo(0.125, 1);
    expect(p.bare).toBeCloseTo(0.125, 1);
  });

  it('gives each crop a calm stage and time to ripe', () => {
    const base = { crop: 'wheat' as Crop, share: 0.5, watered: 1, ripe: 0 };
    expect(cropStage({ ...base, growth: 0.1 }, 0)).toMatchObject({ name: 'Sprouting' });
    const growing = cropStage({ ...base, growth: RIPE - 2 * 60_000 / GROW_MS }, 0);
    expect(growing).toMatchObject({ name: 'Growing', note: 'ripe in about 2 min' });
    expect(cropStage({ ...base, growth: 0.1, watered: 0 }, 0)).toMatchObject({ name: 'Sown', note: 'needs water to grow on' });
    expect(cropStage({ ...base, growth: 0.5, watered: 0.6 }, 0).note).toMatch(/some still needs water$/);
    expect(cropStage({ ...base, growth: 0.9, ripe: 1 }, 0)).toMatchObject({ name: 'Ripe', k: 1 });
    expect(cropStage({ ...base, growth: 0.5 }, SEASON_MS * 3.2)).toMatchObject({ name: 'Resting' });
  });
});
