import { describe, expect, it } from 'vitest';
import { BARN, CELL, COLS, DOOR_BOTTOM, DOOR_TOP, DOOR_X, DOOR_Y, FIELD, LANES, LANE_H, ROWS, WORLD_H, WORLD_W, ZOOM } from '../src/game/constants';
import { BOUNDS, insideBarn } from '../src/game/vehicle';

describe('layout at the configured zoom', () => {
  it('draws the farm at three-quarter size, so the field holds eight approved lanes', () => {
    expect(ZOOM).toBe(0.75);
    expect(LANES).toBe(8);
    expect(FIELD.h).toBeCloseTo(LANES * LANE_H);
  });

  it('keeps the soil grid two screen pixels a cell and covering the field', () => {
    expect(CELL * ZOOM).toBeCloseTo(2);
    expect(COLS * CELL).toBeCloseTo(FIELD.w);
    expect(ROWS * CELL).toBeLessThanOrEqual(FIELD.h + 1e-6);
    expect(FIELD.h - ROWS * CELL).toBeLessThan(CELL);
  });

  it('puts the barn on the left with its door facing the middle of the field', () => {
    expect(DOOR_X).toBe(BARN.x + BARN.w);
    expect(DOOR_X).toBeLessThan(FIELD.x);
    expect(Math.abs(DOOR_Y - (FIELD.y + FIELD.h / 2))).toBeLessThanOrEqual(0.5);
    expect(DOOR_TOP).toBeGreaterThan(BARN.y);
    expect(DOOR_BOTTOM).toBeLessThan(BARN.y + BARN.h);
    expect(insideBarn(DOOR_X - 1, DOOR_Y)).toBe(true);
  });

  it('fits the field, barn and driving bounds inside the view', () => {
    for (const [x, y] of [[FIELD.x, FIELD.y], [FIELD.x + FIELD.w, FIELD.y + FIELD.h], [BARN.x, BARN.y], [BARN.x + BARN.w, BARN.y + BARN.h]]) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(WORLD_W);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(WORLD_H);
    }
    expect(BOUNDS.x0).toBeLessThan(BARN.x + 20);
    expect(BOUNDS.x1).toBeGreaterThan(FIELD.x + FIELD.w);
    expect(BOUNDS.y1).toBeGreaterThan(FIELD.y + FIELD.h);
  });
});
