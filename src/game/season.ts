import { SEASON_MS } from './constants';
import type { Season } from './types';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const YEAR_MS = SEASON_MS * SEASONS.length;
/** How long the grass and hedges take to fade into the new season. */
export const BLEND_MS = 8000;

export interface SeasonInfo {
  season: Season;
  /** 0..1 through the current season. */
  progress: number;
  /** 1-based year number. */
  year: number;
}

export function seasonAt(elapsed: number): SeasonInfo {
  const t = Math.max(0, elapsed);
  const n = Math.floor(t / SEASON_MS);
  return { season: SEASONS[n % SEASONS.length], progress: (t % SEASON_MS) / SEASON_MS, year: Math.floor(n / SEASONS.length) + 1 };
}

export function previousSeason(s: Season): Season {
  return SEASONS[(SEASONS.indexOf(s) + SEASONS.length - 1) % SEASONS.length];
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Colours fade from the previous season for the first BLEND_MS of each season. */
export function seasonBlend(elapsed: number): { from: Season; to: Season; k: number } {
  const t = Math.max(0, elapsed);
  const { season } = seasonAt(t);
  const into = t % SEASON_MS;
  if (t >= SEASON_MS && into < BLEND_MS) return { from: previousSeason(season), to: season, k: smooth(into / BLEND_MS) };
  return { from: season, to: season, k: 1 };
}
