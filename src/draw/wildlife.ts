import { type Hare, OLD_TRACKS, type Print, type Wildlife, printFade } from '../game/wildlife';
import { type Ctx, P, rr } from './palette';

// The hare and the fox from above, in the game's flat pastels with soft offset shadows; each faces
// +x with its origin at the body's middle, in world units. Their prints are soft grey-blue marks.
const C = {
  hare: '#c9a47a', hareDark: '#94714f', hareRim: 'rgba(60,45,30,0.28)', tail: '#f7f1e6', eye: '#3e3936',
  fox: '#dd8b4e', foxDark: '#9a5a33', foxWhite: '#f6efe4', nose: '#2f2a27',
};
const PRINT = [132, 148, 168] as const;

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0): void {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), a, 0, Math.PI * 2); ctx.fill();
}
function shade(ctx: Ctx, rx: number, ry: number, dx = 2, dy = 3.5): void { ctx.fillStyle = P.shadow; oval(ctx, dx, dy, rx, ry); }

function hare(ctx: Ctx, h: Hare, t: number): void {
  if (h.state === 'in' || h.state === 'run') {
    // stretched out mid-bound, shadow dropping away as it lifts
    const k = Math.sin(h.phase), st = 1 + 0.22 * k, lift = Math.max(0, k) * 3;
    shade(ctx, 7.5, 3.6, 2 + lift, 3 + lift * 1.6);
    ctx.fillStyle = C.hareRim; oval(ctx, 0, 0, 7.6 * st + 0.9, 3.7 / Math.sqrt(st) + 0.9);
    ctx.fillStyle = C.hare; oval(ctx, 0, 0, 7.6 * st, 3.7 / Math.sqrt(st));
    ctx.fillStyle = C.hareDark; oval(ctx, 1.5, -1.2, 4.6, 0.9, 0.05); oval(ctx, 1.5, 1.2, 4.6, 0.9, -0.05);
    ctx.fillStyle = C.hare; oval(ctx, 6.6 * st, 0, 3, 2.3);
    ctx.fillStyle = C.tail; oval(ctx, -7.2 * st, 0, 1.4, 1.3);
    return;
  }
  // sitting up: a round back, the head forward, long ears pricked or laid along the back
  shade(ctx, 6.6, 4.8);
  ctx.fillStyle = C.hareRim; oval(ctx, -0.5, 0, 7.4, 5.4); oval(ctx, 4.6, 0, 3.9, 3.4);
  ctx.fillStyle = C.hare; oval(ctx, -0.5, 0, 6.6, 4.6); oval(ctx, 4.6, 0, 3.1, 2.6);
  ctx.fillStyle = C.hareDark; oval(ctx, -1.5, 0, 4.2, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; oval(ctx, -1.5, -1.6, 3.8, 1.6);
  const len = 1.6 + (1 - h.ears) * 3.4, tw = Math.sin(t / 700) * 0.15;
  ctx.fillStyle = C.hare; oval(ctx, 3.6 - len * 0.6, -1.3, len, 0.95, 0.12 + tw); oval(ctx, 3.6 - len * 0.6, 1.3, len, 0.95, -0.12 - tw);
  ctx.fillStyle = C.eye; oval(ctx, 3.6 - len * 1.45, -1.3 - len * 0.16, 0.7, 0.6); oval(ctx, 3.6 - len * 1.45, 1.3 + len * 0.16, 0.7, 0.6);
  ctx.fillStyle = C.tail; oval(ctx, -6.8, 0, 1.4, 1.3);
  if (h.state === 'box') { ctx.fillStyle = C.hareDark; const p = Math.sin(t / 90); oval(ctx, 7.8 + p * 1.2, -1.8, 1.5, 0.9); oval(ctx, 7.8 - p * 1.2, 1.8, 1.5, 0.9); }
}

function fox(ctx: Ctx, trot: number, head: number, t: number): void {
  shade(ctx, 13, 4.6);
  // the brush swings as it trots
  ctx.save(); ctx.translate(-9, 0); ctx.rotate(Math.sin(t / 320) * 0.2 * trot);
  ctx.fillStyle = C.fox; oval(ctx, -6.5, 0, 7.4, 2.9); ctx.fillStyle = C.foxWhite; oval(ctx, -12.4, 0, 2.2, 2);
  ctx.restore();
  ctx.fillStyle = C.fox; rr(ctx, -9.5, -3.7, 19, 7.4, 3.7); ctx.fill();
  ctx.fillStyle = 'rgba(154,90,51,0.28)'; oval(ctx, -1, 0, 7, 1.4);
  ctx.save(); ctx.translate(9.4, 0); ctx.rotate(head);
  ctx.fillStyle = C.fox; oval(ctx, 1.6, 0, 3.3, 3);
  ctx.beginPath(); ctx.moveTo(3.6, -1.8); ctx.lineTo(8, 0); ctx.lineTo(3.6, 1.8); ctx.fill();
  ctx.fillStyle = C.foxWhite; oval(ctx, 4.5, -1.1, 1.6, 0.8); oval(ctx, 4.5, 1.1, 1.6, 0.8);
  ctx.fillStyle = C.nose; oval(ctx, 8, 0, 0.7, 0.6);
  ctx.fillStyle = C.foxDark; ctx.beginPath(); ctx.moveTo(-0.4, -1.6); ctx.lineTo(0.6, -4.4); ctx.lineTo(2.2, -2.2); ctx.moveTo(-0.4, 1.6); ctx.lineTo(0.6, 4.4); ctx.lineTo(2.2, 2.2); ctx.fill();
  ctx.restore();
}

/** Adds one print's shapes to the current path: a hare's two long hind feet ahead of two small fore feet in line; a fox's one neat pad. */
function addPrint(ctx: Ctx, p: Omit<Print, 'age'>): void {
  const c = Math.cos(p.a), s = Math.sin(p.a);
  const dot = (x: number, y: number, rx: number, ry: number) => { ctx.moveTo(x + rx * c, y + rx * s); ctx.ellipse(x, y, rx, ry, p.a, 0, Math.PI * 2); };
  if (p.kind === 'hare') {
    for (const side of [-1, 1]) dot(p.x + c * 4 - s * side * 2.6, p.y + s * 4 + c * side * 2.6, 3.2, 1.3);
    dot(p.x - c * 3, p.y - s * 3, 1.3, 1.3); dot(p.x - c * 7, p.y - s * 7, 1.3, 1.3);
  } else dot(p.x - s * p.side * 1.6, p.y + c * p.side * 1.6, 1.6, 1.2);
}

/** Last night's tracks, painted into the cached background as the snow comes in. */
export function drawOldTracks(b: Ctx, snow: number): void {
  if (snow <= 0.02) return;
  b.fillStyle = `rgba(${PRINT.join(',')},${0.4 * snow})`;
  b.beginPath(); for (const p of OLD_TRACKS) addPrint(b, p); b.fill();
}

const SHADES = 6;
/** Fresh prints in the snow (`snow` is how wintry the scene is, 0..1), then the hare or the fox, in world units. */
export function drawWildlife(ctx: Ctx, w: Wildlife, snow: number): void {
  if (snow > 0.02 && w.prints.length) {
    // a handful of fills, one per shade of fading, however many prints there are
    const groups: Print[][] = Array.from({ length: SHADES }, () => []);
    for (const p of w.prints) groups[Math.min(SHADES - 1, Math.floor(printFade(p) * SHADES))].push(p);
    groups.forEach((g, i) => {
      if (!g.length) return;
      ctx.fillStyle = `rgba(${PRINT.join(',')},${(0.55 * snow * (i + 1)) / SHADES})`;
      ctx.beginPath(); for (const p of g) addPrint(ctx, p); ctx.fill();
    });
  }
  for (const h of w.hares) {
    if (h.state === 'gone') continue;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a); hare(ctx, h, w.t); ctx.restore();
  }
  const f = w.fox;
  if (f) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); fox(ctx, f.pause > 0 ? 0 : 1, f.head, w.t); ctx.restore(); }
}
