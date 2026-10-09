import { CELLS, CROPS, type Field } from './field';
import type { Crop, Job, Rig } from './types';

export const SAVE_KEY = 'furrow.save.v1';

export interface Snapshot {
  /** Game time in ms since the first spring. */
  elapsed: number;
  crop: Crop;
  field: Field;
  machine: { x: number; y: number; a: number; rig: Rig; job: Job };
  /** True when saved while in the barn; the game reopens the barn menu. */
  inBarn: boolean;
  harvested: number;
}

const RIGS: readonly Rig[] = ['cultivate', 'drill-hopper', 'drill-precision', 'drill-few', 'spray', 'combine', 'roots', 'trailer'];
const JOBS: readonly Job[] = ['cultivate', 'plant', 'water', 'harvest'];

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(text: unknown, length: number): Uint8Array | null {
  if (typeof text !== 'string') return null;
  try {
    const s = atob(text);
    if (s.length !== length) return null;
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function encodeSnapshot(s: Snapshot): string {
  const growth = new Uint8Array(CELLS);
  for (let i = 0; i < CELLS; i++) growth[i] = Math.round(Math.min(1, Math.max(0, s.field.growth[i])) * 255);
  return JSON.stringify({
    v: 1, elapsed: Math.round(s.elapsed), crop: s.crop, machine: s.machine, inBarn: s.inBarn, harvested: s.harvested,
    soil: toB64(s.field.soil), growth: toB64(growth), cellCrop: toB64(s.field.crop),
  });
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parse a save; anything unexpected gives null so the game simply starts fresh. */
export function decodeSnapshot(text: string | null): Snapshot | null {
  if (!text) return null;
  let d: Record<string, unknown>;
  try { d = JSON.parse(text); } catch { return null; }
  if (!d || d.v !== 1 || !num(d.elapsed) || d.elapsed < 0 || !CROPS.includes(d.crop as Crop) || !num(d.harvested)) return null;
  const m = d.machine as Record<string, unknown> | undefined;
  if (!m || !num(m.x) || !num(m.y) || !num(m.a) || !RIGS.includes(m.rig as Rig) || !JOBS.includes(m.job as Job)) return null;
  const soil = fromB64(d.soil, CELLS), g = fromB64(d.growth, CELLS), crop = fromB64(d.cellCrop, CELLS);
  if (!soil || !g || !crop) return null;
  const growth = new Float32Array(CELLS);
  for (let i = 0; i < CELLS; i++) growth[i] = g[i] / 255;
  return {
    elapsed: d.elapsed, crop: d.crop as Crop, harvested: Math.max(0, Math.floor(d.harvested)), inBarn: d.inBarn === true,
    machine: { x: m.x, y: m.y, a: m.a, rig: m.rig as Rig, job: m.job as Job },
    field: { soil, growth, crop },
  };
}
