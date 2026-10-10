import { CLOUD_H, CLOUD_SHAPES, CLOUD_W, type Wind, bitAlpha } from '../game/wind';
import { type Ctx, rnd } from './palette';

const LEAVES = ['#d9a35a', '#e59a4a', '#c97a4c', '#cdb36a'];
const PETAL = '#f4d2dc', FLUFF = '#fbfaf4';

// Each shadow is a handful of soft discs painted once into its own sprite: opaque in the middle and
// fading at the rim, so where they overlap they read as one body, never as blotches.
let sprites: HTMLCanvasElement[] = [];
function cloudSprite(seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = CLOUD_W; c.height = CLOUD_H;
  const x = c.getContext('2d')!;
  for (let k = 0; k < 7; k++) {
    const cx = 130 + rnd(seed + k) * 180, cy = 120 + rnd(seed + k + 9) * 60, r = 70 + rnd(seed + k + 17) * 40;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgb(62,72,92)'); g.addColorStop(0.45, 'rgb(62,72,92)'); g.addColorStop(1, 'rgba(62,72,92,0)');
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  return c;
}

/** Cloud shadows over the whole farm, in world units; fainter on winter's snow. */
export function drawCloudShadows(ctx: Ctx, w: Wind, winter: number): void {
  if (!sprites.length) sprites = Array.from({ length: CLOUD_SHAPES }, (_, i) => cloudSprite(i * 13 + 2));
  ctx.save(); ctx.globalAlpha = 0.12 - winter * 0.03;
  for (const c of w.clouds) ctx.drawImage(sprites[c.shape % CLOUD_SHAPES], c.x, c.y, CLOUD_W * c.size, CLOUD_H * c.size);
  ctx.restore();
}

/** Petals, seed fluff and leaves on the wind, each with a faint shadow, in world units. */
export function drawBlown(ctx: Ctx, w: Wind): void {
  for (const b of w.bits) {
    const leaf = b.kind === 'leaf';
    ctx.save(); ctx.globalAlpha = bitAlpha(b); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
    ctx.fillStyle = 'rgba(70,55,35,0.14)'; ctx.beginPath(); ctx.ellipse(6, 9, leaf ? 4 : 2.2, leaf ? 2 : 1.3, 0, 0, Math.PI * 2); ctx.fill();
    if (leaf) {
      ctx.fillStyle = LEAVES[Math.floor(b.tint * LEAVES.length)]; ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
    } else if (b.kind === 'petal') {
      ctx.fillStyle = PETAL; ctx.beginPath(); ctx.ellipse(0, 0, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = FLUFF; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath();
      for (let i = 0; i < 6; i++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i) * 3.4, Math.sin(i) * 3.4); }
      ctx.stroke();
    }
    ctx.restore();
  }
}
