// The approved "Morning Meadow" palette and helpers, unchanged from the mockup.
export const P = {
  grass: { spring: '#b9d6a6', summer: '#a8c99a', autumn: '#cdbf86', winter: '#e6eaec' },
  hedge: { spring: '#9ec48c', summer: '#8fbb7d', autumn: '#c7a46a', winter: '#d5dadf' },
  soil: '#c9a77c', soilWorked: '#b38c63', soilDark: '#94714d', stubble: '#d8c28a',
  shadow: 'rgba(70,55,35,0.20)', red: '#d9705f', redDark: '#b3564b', cab: 'rgba(235,245,250,0.85)',
  tyre: '#4a4440', steel: '#9aa0a3', steelDark: '#6f7578', yellow: '#e8c35c', tank: '#f0ece2',
  leaf: '#6fa45f', leafDark: '#4f8545', carrot: '#e8915a', wheat: '#e2c46a', pumpkin: '#e59a4a', water: 'rgba(160,200,225,0.55)',
} as const;

export type Ctx = CanvasRenderingContext2D;

/** Each season's dot colour, in the season pill and the barn label. */
export const SEASON_DOT = { spring: '#9ec48c', summer: '#e8c35c', autumn: '#e59a4a', winter: '#b9c6cf' } as const;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export const rnd = (i: number): number => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, k: number): string => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
};
export const ease = (k: number): number => k * k * (3 - 2 * k);
