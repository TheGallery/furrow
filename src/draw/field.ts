import { BARN, CELL, COLS, FIELD, H, LANE, LANES, LANE_H, ROWS, W, WORLD_H, WORLD_W, ZOOM } from '../game/constants';
import { CROPS, CULTIVATED, type Field, RAW, SEEDED, STUBBLE, WATERED } from '../game/field';
import type { Crop, Season } from '../game/types';
import { drawPen } from './animals';
import { barnGround } from './barn';
import { laneGround } from './lane';
import { type Ctx, P, mix, rnd, rr } from './palette';
import { drawOldTracks } from './wildlife';

export interface Blend { from: Season; to: Season; k: number }

/** Grass, hedges, the barn's yard, the sheep pen and the bare field body, in world units. Redrawn only when the season colours change. */
export function renderBackground(b: Ctx, blend: Blend): void {
  const { from, to, k } = blend;
  const wt = (s: Season) => (from === s ? 1 - k : 0) + (to === s ? k : 0);
  b.fillStyle = mix(P.grass[from], P.grass[to], k); b.fillRect(0, 0, WORLD_W, WORLD_H);
  const hedge = mix(P.hedge[from], P.hedge[to], k), snow = wt('winter'), bloom = wt('spring');
  // `cap` sizes the snow and blossom to a smaller hedge
  const blob = (x: number, y: number, r: number, i: number, caps: boolean, cap = 1) => {
    b.fillStyle = hedge; b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    if (caps && snow > 0) { b.fillStyle = `rgba(251,252,253,${snow})`; b.beginPath(); b.ellipse(x, y - 12 * cap, 16 * cap, 6 * cap, 0, 0, Math.PI * 2); b.fill(); }
    if (caps && bloom > 0 && i % 2) { b.fillStyle = `rgba(244,210,220,${bloom})`; b.beginPath(); b.arc(x - 8 * cap, y - 8 * cap, 4, 0, Math.PI * 2); b.fill(); }
  };
  for (let i = 0; i < Math.ceil(WORLD_W / 50); i++) blob(30 + i * 50, 52 + Math.sin(i * 1.7) * 6, 24 + rnd(i) * 8, i, true);
  // the side hedges stop short of the lane
  for (let i = 0; i < Math.ceil((WORLD_H - 200) / 60); i++) {
    const x = 40 + rnd(i + 4) * 60, y = 160 + i * 60;
    if ((y < BARN.y - 34 || y > BARN.y + BARN.h + 34) && y + 18 < LANE.y) blob(x, y, 18, i, false);
    if (y + 38 < LANE.y) blob(WORLD_W - 26 - rnd(i + 4) * 24, y + 20, 18, i, false);
  }
  // the neighbours' lane along the bottom, and the hedge beyond it
  laneGround(b, snow);
  for (let i = 0, x = -10; x < WORLD_W + 30; i++, x += 36 + rnd(i + 20) * 10) blob(x, WORLD_H - 4 + Math.sin(i * 1.7) * 3, 15 + rnd(i + 40) * 4, i, true, 0.65);
  barnGround(b);
  drawOldTracks(b, snow);
  drawPen(b);
  b.save(); b.shadowColor = 'rgba(70,55,35,0.22)'; b.shadowBlur = 18; b.shadowOffsetY = 4;
  b.fillStyle = P.soil; rr(b, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r); b.fill(); b.restore();
  b.save(); rr(b, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r); b.clip();
  for (let i = 0; i < Math.round(900 / ZOOM / ZOOM); i++) { b.fillStyle = `rgba(110,80,50,${0.06 + rnd(i) * 0.06})`; b.fillRect(FIELD.x + rnd(i) * FIELD.w, FIELD.y + rnd(i + 3000) * FIELD.h, 2, 2); }
  b.restore();
}

// The approved texture: seven soft lines per lane-width, wavier on freshly cultivated ground.
// Drawn once over the whole field so worked patches share one seamless pattern.
function textureCanvas(amp: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FIELD.w; c.height = FIELD.h;
  const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(80,55,30,0.22)'; x.lineWidth = 1.4;
  for (let l = 0; l < LANES; l++) for (let k = 1; k < 8; k++) {
    const yy = l * LANE_H + (k * LANE_H) / 8 + Math.sin(k) * 1.5;
    x.beginPath();
    for (let px = 0; px <= FIELD.w; px += 2) { const y = yy + Math.sin(px * 0.18 + k) * amp; if (px) x.lineTo(px, y); else x.moveTo(px, y); }
    x.stroke();
  }
  return c;
}

/** The worked-soil layer, painted cell by cell only where the soil changes. */
export class SoilLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: Ctx;
  private readonly wavy: CanvasPattern;
  private readonly flat: CanvasPattern;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = FIELD.w; this.canvas.height = FIELD.h;
    this.ctx = this.canvas.getContext('2d')!;
    this.wavy = this.ctx.createPattern(textureCanvas(1.6), 'no-repeat')!;
    this.flat = this.ctx.createPattern(textureCanvas(0.4), 'no-repeat')!;
  }

  paintAll(f: Field): void {
    this.ctx.clearRect(0, 0, FIELD.w, FIELD.h);
    for (let i = 0; i < f.soil.length; i++) if (f.soil[i] !== RAW) this.paint(f, i);
  }

  /** A soft disc a little wider than the cell, so worked ground has smooth edges, not squares. */
  paint(f: Field, i: number): void {
    const c = this.ctx, s = f.soil[i];
    if (s === RAW) return;
    const x = (i % COLS) * CELL + CELL / 2, y = Math.floor(i / COLS) * CELL + CELL / 2;
    c.beginPath(); c.arc(x, y, CELL * 0.95, 0, Math.PI * 2);
    c.fillStyle = s === STUBBLE ? P.stubble : s >= WATERED ? P.soilDark : P.soilWorked; c.fill();
    c.fillStyle = s === CULTIVATED ? this.wavy : this.flat; c.fill();
  }
}

interface Site { x: number; y: number; seed: number; cell: number }

// Plant positions per crop, laid out like the approved rows but over the whole field.
const SITES: Record<Crop, Site[]> = { wheat: [], carrot: [], pumpkin: [] };
for (const crop of CROPS) {
  const rows = crop === 'wheat' ? 7 : crop === 'carrot' ? 5 : 2, step = crop === 'pumpkin' ? 46 : crop === 'carrot' ? 14 : 8;
  for (let l = 0; l < LANES; l++) for (let r = 0; r < rows; r++) {
    const y = FIELD.y + l * LANE_H + (r + 0.5) * LANE_H / rows;
    for (let x = FIELD.x + 8 + (r % 2) * step / 2; x < FIELD.x + FIELD.w - 6; x += step) {
      const col = Math.floor((x - FIELD.x) / CELL), row = Math.floor((y - FIELD.y) / CELL);
      if (row >= ROWS) continue;
      SITES[crop].push({ x: x + (rnd(x + r) - 0.5) * 2, y, seed: x, cell: row * COLS + col });
    }
  }
}

/**
 * Adds each item's shapes to a path and paints it (fill or stroke) every few hundred items:
 * one huge path of overlapping shapes rasterises far slower than several smaller ones.
 */
function batched<T>(ctx: Ctx, items: T[], add: (item: T) => void, paint: () => void): void {
  ctx.beginPath();
  items.forEach((it, n) => { add(it); if (n % 300 === 299) { paint(); ctx.beginPath(); } });
  paint();
}

/** Seeds, shoots and ripe crops, the same shapes as the approved mockup, batched per colour. */
function drawPlants(ctx: Ctx, f: Field, t: number): void {
  CROPS.forEach((crop, ci) => {
    const seeds: Site[] = [], live: [Site, number][] = [];
    for (const p of SITES[crop]) {
      const s = f.soil[p.cell];
      if ((s !== SEEDED && s !== WATERED) || f.crop[p.cell] !== ci) continue;
      const g = f.growth[p.cell];
      if (g < 0.25) seeds.push(p); else live.push([p, g]);
    }
    const fill = () => ctx.fill(), stroke = () => ctx.stroke();
    if (seeds.length) { ctx.fillStyle = '#7a5a3a'; batched(ctx, seeds, (p) => { ctx.moveTo(p.x + 1.4, p.y); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); }, fill); }
    if (!live.length) return;
    const sway = (seed: number, g: number) => Math.sin(t / 1100 + seed * 0.05) * 1.2 * g;
    const ripe = live.filter(([, g]) => g > 0.85);
    if (crop === 'wheat') {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = P.leaf; batched(ctx, live.filter(([, g]) => g <= 0.85), ([p, g]) => { ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x + sway(p.seed, g), p.y - (4 + g * 9)); }, stroke);
      ctx.strokeStyle = P.wheat; batched(ctx, ripe, ([p, g]) => { ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x + sway(p.seed, g), p.y - (4 + g * 9)); }, stroke);
      ctx.fillStyle = P.wheat;
      batched(ctx, ripe, ([p, g]) => { const sx = p.x + sway(p.seed, g), hy = p.y - (4 + g * 9); ctx.moveTo(sx + 1.8, hy); ctx.ellipse(sx, hy, 1.8, 3.4, 0, 0, Math.PI * 2); }, fill);
    } else if (crop === 'carrot') {
      ctx.fillStyle = P.leaf;
      batched(ctx, live, ([p, g]) => {
        const sw = sway(p.seed, g);
        for (let i = -1; i <= 1; i++) { const cx = p.x + i * 2.4 + sw, cy = p.y - 3 * g, rot = i * 0.5; ctx.moveTo(cx + 1.6 * Math.cos(rot), cy + 1.6 * Math.sin(rot)); ctx.ellipse(cx, cy, 1.6, 5 * g, rot, 0, Math.PI * 2); }
      }, fill);
      ctx.fillStyle = P.carrot; batched(ctx, ripe, ([p]) => { ctx.moveTo(p.x + 2.6, p.y + 2); ctx.arc(p.x, p.y + 2, 2.6, 0, Math.PI * 2); }, fill);
    } else {
      for (const [p, g] of live) {
        const { x, y } = p, sw = sway(p.seed, g);
        ctx.fillStyle = P.leaf; ctx.beginPath(); ctx.ellipse(x - 8 * g + sw, y - 4, 9 * g, 6 * g, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 8 * g, y + 4, 8 * g, 5 * g, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = P.leafDark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 20 * g, y); ctx.bezierCurveTo(x - 6, y - 10 * g, x + 6, y + 10 * g, x + 20 * g, y); ctx.stroke();
        if (g > 0.7) { const k = (g - 0.7) / 0.3; ctx.fillStyle = P.pumpkin; ctx.beginPath(); ctx.ellipse(x + 4, y + 1, 9 * k + 2, 7 * k + 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
  });
}

export function drawField(ctx: Ctx, soil: SoilLayer, f: Field, t: number): void {
  ctx.save(); rr(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r); ctx.clip();
  ctx.drawImage(soil.canvas, FIELD.x, FIELD.y);
  drawPlants(ctx, f, t);
  ctx.restore();
}

/** Faint dashed lines along the lane edges: a guide for laying passes side by side, never tiles. */
export function drawLaneLines(ctx: Ctx, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save(); rr(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r); ctx.clip();
  ctx.strokeStyle = `rgba(255,250,236,${0.22 * alpha})`; ctx.lineWidth = 2.2; ctx.setLineDash([26, 18]); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let l = 1; l < LANES; l++) { const y = FIELD.y + l * LANE_H; ctx.moveTo(FIELD.x + 10, y); ctx.lineTo(FIELD.x + FIELD.w - 10, y); }
  ctx.stroke(); ctx.restore();
}

/**
 * The way auto-steer will drive next, shown with the lane guides: soft dashes ahead, red where it
 * will back up, and a dot where the implement meets the ground.
 */
export function drawRoute(ctx: Ctx, route: { pts: Float32Array; rev: boolean }[], tines: { x: number; y: number }, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const r of route) {
    ctx.strokeStyle = r.rev ? `rgba(217,112,95,${0.85 * alpha})` : `rgba(255,250,236,${0.6 * alpha})`;
    ctx.setLineDash(r.rev ? [5, 5] : [12, 9]);
    ctx.beginPath();
    for (let i = 0; i < r.pts.length; i += 2) { if (i) ctx.lineTo(r.pts[i], r.pts[i + 1]); else ctx.moveTo(r.pts[i], r.pts[i + 1]); }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.fillStyle = `rgba(255,250,236,${0.9 * alpha})`;
  ctx.beginPath(); ctx.arc(tines.x, tines.y, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Falling snow over the whole view, in view (screen) units. */
export function drawSnow(ctx: Ctx, t: number, amount: number): void {
  if (amount <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${0.9 * amount})`;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) { const k = ((t / 9000) + rnd(i)) % 1, x = rnd(i * 2) * W + Math.sin(t / 1500 + i) * 14, y = k * H; ctx.moveTo(x + 2.4, y); ctx.arc(x, y, 2.4, 0, Math.PI * 2); }
  ctx.fill();
}


