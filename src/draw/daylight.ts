// The light of the hour over the whole farm, in view units: a tint laid on with a multiply, a warm
// evening glow, and at dusk the barn lamp, the machine's lights and fireflies over the summer hedges.
import { DOOR_TOP, DOOR_X, W, H, WORLD_W, ZOOM } from '../game/constants';
import type { Light } from '../game/daylight';
import type { Ctx } from './palette';

/** The lamp over the barn door, in world units. */
export const LAMP = { x: DOOR_X + 4, y: DOOR_TOP - 12 } as const;

// A soft round glow per colour, painted once and stretched to size.
const GLOW = 64;
const glows = new Map<string, HTMLCanvasElement>();
function glowSprite(rgb: string): HTMLCanvasElement {
  let c = glows.get(rgb);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = GLOW;
    const x = c.getContext('2d')!, g = x.createRadialGradient(GLOW / 2, GLOW / 2, 0, GLOW / 2, GLOW / 2, GLOW / 2);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.5, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, GLOW, GLOW);
    glows.set(rgb, c);
  }
  return c;
}

const FLIES = Array.from({ length: 16 }, (_, i) => ({ x: 120 + ((i * 397) % 1500), y: i % 3 ? 70 + (i % 4) * 14 : 860 + (i % 5) * 10, ph: i * 1.7 }));

export interface Lamps {
  /** The machine out on the farm, in world units, and how far ahead of its middle its front is; null while it is in the barn. */
  machine: { x: number; y: number; a: number; front: number } | null;
  /** 0..1: how much of the season is summer, for the fireflies. */
  summer: number;
  /** ms, for the fireflies' slow drift. */
  t: number;
}

/** The lamp fixture over the barn door, drawn into the background; it is unlit by day. */
export function drawLampFixture(b: Ctx): void {
  b.fillStyle = 'rgba(70,55,35,0.25)'; b.fillRect(LAMP.x + 1, LAMP.y + 2, 6, 5);
  b.fillStyle = '#5b5550'; b.fillRect(LAMP.x, LAMP.y, 6, 5);
  b.fillStyle = '#d9d2c2'; b.beginPath(); b.arc(LAMP.x + 3, LAMP.y + 6.5, 2, 0, Math.PI * 2); b.fill();
}

/** The hour's light over everything drawn so far, in view units. */
export function drawDaylight(ctx: Ctx, L: Light, lamps: Lamps): void {
  if (L.mul > 0.004) {
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = L.mul;
    ctx.fillStyle = L.tint; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (L.warm > 0.004) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,190,110,${L.warm})`; ctx.fillRect(0, 0, W, H);
  }
  if (L.dark > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowSprite(rgb), (x - r) * ZOOM, (y - r) * ZOOM, 2 * r * ZOOM, 2 * r * ZOOM);
    };
    // the barn lamp: a pool of light on the apron, and the bulb itself
    glow(LAMP.x + 30, LAMP.y + 40, 110, '255,205,140', 0.5 * L.dark);
    glow(LAMP.x + 3, LAMP.y + 6.5, 8, '255,236,190', L.dark);
    // the machine's lights: two beams ahead, a warm cab
    const m = lamps.machine;
    if (m) {
      const c = Math.cos(m.a), s = Math.sin(m.a);
      glow(m.x + c * (m.front + 70), m.y + s * (m.front + 70), 95, '255,240,205', 0.45 * L.dark);
      glow(m.x + c * (m.front + 150), m.y + s * (m.front + 150), 80, '255,240,205', 0.2 * L.dark);
      glow(m.x, m.y, 34, '255,215,160', 0.35 * L.dark);
    }
    // fireflies over the summer hedges once it is properly dark
    const summer = lamps.summer * Math.max(0, L.dark - 0.4) / 0.6;
    if (summer > 0.02) for (const f of FLIES) {
      const b = Math.max(0, Math.sin(lamps.t / 700 + f.ph * 5)) ** 3;
      if (b < 0.05) continue;
      const x = f.x + Math.sin(lamps.t / 2300 + f.ph) * 18, y = f.y + Math.cos(lamps.t / 1900 + f.ph) * 8;
      glow(Math.min(WORLD_W - 10, x), y, 9, '220,255,140', b * summer);
    }
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}
