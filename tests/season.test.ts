import { describe, expect, it } from 'vitest';
import { SEASON_MS } from '../src/game/constants';
import { BLEND_MS, YEAR_MS, seasonAt, seasonBlend } from '../src/game/season';

describe('season clock', () => {
  it('starts in spring of year one', () => {
    expect(seasonAt(0)).toEqual({ season: 'spring', progress: 0, year: 1 });
  });

  it('turns every five minutes and wraps into the next year', () => {
    expect(SEASON_MS).toBe(5 * 60 * 1000);
    expect(seasonAt(SEASON_MS).season).toBe('summer');
    expect(seasonAt(2 * SEASON_MS + 1).season).toBe('autumn');
    expect(seasonAt(3 * SEASON_MS).season).toBe('winter');
    expect(seasonAt(YEAR_MS)).toEqual({ season: 'spring', progress: 0, year: 2 });
    expect(seasonAt(SEASON_MS / 2).progress).toBeCloseTo(0.5);
  });

  it('fades colours in from the previous season, but not on the very first spring', () => {
    expect(seasonBlend(0)).toEqual({ from: 'spring', to: 'spring', k: 1 });
    const b = seasonBlend(SEASON_MS + BLEND_MS / 2);
    expect(b.from).toBe('spring');
    expect(b.to).toBe('summer');
    expect(b.k).toBeCloseTo(0.5);
    expect(seasonBlend(YEAR_MS + 1).from).toBe('winter');
    expect(seasonBlend(SEASON_MS + BLEND_MS)).toEqual({ from: 'summer', to: 'summer', k: 1 });
  });
});
