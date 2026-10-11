import { WORLD_H, WORLD_W } from '../game/constants';
import { PUDDLES, REACH, type Showers, rainAt, strength } from '../game/showers';
import { type Ctx, rnd } from './palette';

const STREAKS = 320, SPLASHES = 70, SPLASH_MS = 420;

/** Puddles on the verges, in world units: they spread as they fill, ripple in the rain and shrink as they dry. */
export function drawPuddles(ctx: Ctx, s: Showers, t: number): void {
  PUDDLES.forEach((p, i) => {
    const k = Math.min(1, s.puddles[i]);
    if (k <= 0.01) return;
    const g = 0.4 + 0.6 * k, rain = rainAt(s, p.x);
    ctx.fillStyle = `rgba(120,150,170,${0.45 * k})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx * g, p.ry * g, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.3 * k})`; ctx.beginPath(); ctx.ellipse(p.x - p.rx * 0.3, p.y - p.ry * 0.3, p.rx * 0.35 * g, p.ry * 0.25 * g, 0, 0, Math.PI * 2); ctx.fill();
    if (rain > 0.2) {
      // a ring or two spreading where drops land
      ctx.lineWidth = 0.8;
      for (let j = 0; j < 2; j++) {
        const q = ((t / 700) + rnd(i * 7 + j)) % 1;
        ctx.strokeStyle = `rgba(230,240,248,${0.6 * rain * (1 - q)})`; ctx.beginPath();
        ctx.ellipse(p.x + (rnd(i + j * 3) - 0.5) * p.rx, p.y + (rnd(i + j * 5) - 0.5) * p.ry, 1 + q * 5, 0.5 + q * 2, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });
}

/**
 * The shower overhead, in world units: the light dims a touch under it, and fine rain falls with
 * small splashes on the ground. Thickest in the middle of the band, thinning to nothing at its edges.
 */
export function drawShower(ctx: Ctx, s: Showers, t: number): void {
  const sh = s.shower, k = strength(sh);
  if (!sh || k <= 0.01) return;
  const x0 = sh.x - REACH, x1 = sh.x + REACH;
  ctx.save();
  const shade = ctx.createLinearGradient(x0, 0, x1, 0);
  shade.addColorStop(0, 'rgba(120,135,155,0)'); shade.addColorStop(0.5, `rgba(120,135,155,${0.22 * k})`); shade.addColorStop(1, 'rgba(120,135,155,0)');
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = shade; ctx.fillRect(x0, 0, x1 - x0, WORLD_H);
  ctx.globalCompositeOperation = 'source-over';

  // each streak keeps its own column of air (a hash), falling on a slight slant
  ctx.strokeStyle = 'rgba(214,228,240,0.6)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < STREAKS; i++) {
    const x = x0 + rnd(i) * 2 * REACH;
    if (x < 0 || x > WORLD_W || rnd(i + 0.5) > rainAt(s, x)) continue;
    const sp = 0.85 + rnd(i + 5) * 0.3, y = ((rnd(i + 3) * (WORLD_H + 80) + t * 1.2 * sp) % (WORLD_H + 80)) - 40, sx = x + (y - WORLD_H / 2) * 0.1;
    ctx.moveTo(sx, y); ctx.lineTo(sx + 3, y + 16);
  }
  ctx.stroke();

  // splashes: each lives SPLASH_MS at one spot, then lands somewhere else
  ctx.lineWidth = 0.9;
  for (let i = 0; i < SPLASHES; i++) {
    const age = (t + rnd(i + 11) * SPLASH_MS) / SPLASH_MS, n = Math.floor(age), q = age - n;
    const x = x0 + rnd(i * 31 + n) * 2 * REACH, y = 100 + rnd(i * 17 + n * 3) * (WORLD_H - 140), r = rainAt(s, x);
    if (r < 0.15) continue;
    ctx.strokeStyle = `rgba(214,228,240,${0.7 * r * (1 - q)})`; ctx.beginPath(); ctx.ellipse(x, y, 1 + q * 4, 0.6 + q * 2.4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
