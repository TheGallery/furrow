import { SEASON_MS } from './constants';
import { CELLS, CROPS, CULTIVATED, type Field, GROW_MS, RAW, RIPE, STUBBLE, WATERED } from './field';
import { SEASONS, seasonAt } from './season';
import type { Crop, Season } from './types';

/** Soft, never ticking: whole minutes, or "under a minute". */
export function aboutTime(ms: number): string {
  if (ms < 40_000) return 'under a minute';
  if (ms < 90_000) return 'about a minute';
  return `about ${Math.round(ms / 60_000)} min`;
}

export interface SeasonClock {
  season: Season;
  next: Season;
  /** 0..1 through the season. */
  k: number;
  /** What the season pill says, e.g. "summer in about 3 min". */
  text: string;
}

export function seasonClock(elapsed: number): SeasonClock {
  const { season, progress } = seasonAt(elapsed), next = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
  return { season, next, k: progress, text: `${next} in ${aboutTime(SEASON_MS * (1 - progress))}` };
}

/** Game time it takes to grow `ms` more, with winter's pause counted in. */
export function growingTime(elapsed: number, ms: number): number {
  let t = Math.max(0, elapsed), left = ms;
  for (let k = 0; k < 12 && left > 0; k++) {
    const { season, progress } = seasonAt(t), rest = SEASON_MS * (1 - progress);
    if (season !== 'winter') { if (left <= rest) return t + left - elapsed; left -= rest; }
    t += rest + 1;
  }
  return t - elapsed;
}

export interface Planting {
  crop: Crop;
  /** Share of the whole field sown with this crop. */
  share: number;
  /** Share of this crop that has been watered. */
  watered: number;
  /** Its typical growth, 0..1. */
  growth: number;
  /** Share of this crop that is ripe. */
  ripe: number;
}

/** What is in the ground, crop by crop and largest first, and how much is bare or ready for seed. */
export function plantings(f: Field): { crops: Planting[]; bare: number; ready: number } {
  const n = CROPS.map(() => 0), wet = CROPS.map(() => 0), ripe = CROPS.map(() => 0), sum = CROPS.map(() => 0);
  let bare = 0, ready = 0;
  for (let i = 0; i < CELLS; i++) {
    const s = f.soil[i];
    if (s === RAW || s === STUBBLE) bare++;
    else if (s === CULTIVATED) ready++;
    else {
      const k = f.crop[i];
      if (k >= CROPS.length) continue;
      n[k]++; sum[k] += f.growth[i];
      if (s === WATERED) wet[k]++;
      if (f.growth[i] >= RIPE) ripe[k]++;
    }
  }
  const crops = CROPS.map((crop, k) => ({ crop, share: n[k] / CELLS, watered: n[k] ? wet[k] / n[k] : 0, growth: n[k] ? sum[k] / n[k] : 0, ripe: n[k] ? ripe[k] / n[k] : 0 }))
    // a few stray cells left over from a crop switch are not worth a row
    .filter((p) => p.share >= 0.005)
    .sort((a, b) => b.share - a.share);
  return { crops, bare: bare / CELLS, ready: ready / CELLS };
}

export type StageName = 'Sown' | 'Sprouting' | 'Growing' | 'Ripe' | 'Resting';
export interface Stage {
  name: StageName;
  /** A short calm note: "ripe in about 2 min", "needs water to grow on". */
  note: string;
  /** 0..1 of the way to ripe. */
  k: number;
}

export function cropStage(p: Planting, elapsed: number): Stage {
  const k = Math.min(1, p.growth / RIPE);
  if (p.ripe >= 0.5) return { name: 'Ripe', note: 'ready to bring in', k: 1 };
  // unwatered seed only sprouts a little (field.ts), so it waits for the sprayer
  if (p.watered < 0.5) return { name: 'Sown', note: 'needs water to grow on', k };
  if (seasonAt(elapsed).season === 'winter') return { name: 'Resting', note: 'grows again in spring', k };
  const dry = p.watered < 0.97 ? ' · some still needs water' : '';
  return { name: p.growth < 0.25 ? 'Sprouting' : 'Growing', note: `ripe in ${aboutTime(growingTime(elapsed, (RIPE - p.growth) * GROW_MS))}${dry}`, k };
}
