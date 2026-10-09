import { describe, expect, it } from 'vitest';
import { CULTIVATED, WATERED, createField } from '../src/game/field';
import { BOUNDS } from '../src/game/vehicle';
import { decodeSnapshot, encodeSnapshot, type Snapshot } from '../src/game/save';

describe('save and load', () => {
  it('round-trips the field, the season clock and the machine', () => {
    const field = createField();
    field.soil[10] = CULTIVATED;
    field.soil[11] = WATERED; field.growth[11] = 0.42; field.crop[11] = 2;
    const snap: Snapshot = {
      elapsed: 123456, crop: 'pumpkin', field, inBarn: true, harvested: 7,
      machine: { x: 300.5, y: 370, a: Math.PI, rig: 'trailer', job: 'harvest' },
    };
    const back = decodeSnapshot(encodeSnapshot(snap));
    expect(back).not.toBeNull();
    expect(back!.elapsed).toBe(123456);
    expect(back!.crop).toBe('pumpkin');
    expect(back!.inBarn).toBe(true);
    expect(back!.harvested).toBe(7);
    expect(back!.machine).toEqual(snap.machine);
    expect(Array.from(back!.field.soil)).toEqual(Array.from(field.soil));
    expect(Array.from(back!.field.crop)).toEqual(Array.from(field.crop));
    expect(back!.field.growth[11]).toBeCloseTo(0.42, 2);
  });

  it('starts fresh from a save made at the old, larger scale', () => {
    const text = encodeSnapshot({ elapsed: 1, crop: 'wheat', field: createField(), inBarn: false, harvested: 0, machine: { x: 300, y: 370, a: 0, rig: 'cultivate', job: 'cultivate' } });
    expect(decodeSnapshot(text)).not.toBeNull();
    expect(decodeSnapshot(JSON.stringify({ ...JSON.parse(text), v: 1 }))).toBeNull();
  });

  it('ignores missing or damaged saves', () => {
    expect(decodeSnapshot(null)).toBeNull();
    expect(decodeSnapshot('not json')).toBeNull();
    expect(decodeSnapshot('{"v":2}')).toBeNull();
    const ok = JSON.parse(encodeSnapshot({ elapsed: 0, crop: 'wheat', field: createField(), inBarn: false, harvested: 0, machine: { x: 1, y: 2, a: 0, rig: 'cultivate', job: 'cultivate' } }));
    expect(decodeSnapshot(JSON.stringify({ ...ok, soil: 'AAAA' }))).toBeNull();
    expect(decodeSnapshot(JSON.stringify({ ...ok, crop: 'turnip' }))).toBeNull();
  });

  it('rejects out-of-range cells and keeps the machine on screen', () => {
    const base = (): Snapshot => ({ elapsed: 0, crop: 'wheat', field: createField(), inBarn: false, harvested: 0, machine: { x: 5000, y: -300, a: 0, rig: 'cultivate', job: 'cultivate' } });
    const back = decodeSnapshot(encodeSnapshot(base()));
    expect(back!.machine.x).toBe(BOUNDS.x1);
    expect(back!.machine.y).toBe(BOUNDS.y0);
    const badSoil = base(); badSoil.field.soil[3] = 4;
    expect(decodeSnapshot(encodeSnapshot(badSoil))).toBeNull();
    const badCrop = base(); badCrop.field.crop[3] = 3;
    expect(decodeSnapshot(encodeSnapshot(badCrop))).toBeNull();
  });
});
