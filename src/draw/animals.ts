// The animals round the barn, top-down in the game's style: flat pastel fills, soft offset shadows,
// rounded shapes. Each faces +x with its origin at the body's middle, in world units.
import { type Animals, type DogPose, GATE, PEN, TROUGH, gateOpen, henIndoors } from '../game/animals';
import type { Season } from '../game/types';
import type { Blend } from './field';
import { type Ctx, P, rnd, rr } from './palette';

const TAU = Math.PI * 2;
const C = {
  wool: '#f7f3ea', woolShade: '#e3d9c6', face: '#5b5550', lamb: '#fcfaf5',
  fence: '#ccb28a', post: '#a98a63', trough: '#a9bcc6',
  hen: '#fbf7ee', henBrown: '#cf9a6a', henTail: '#e4d9c4', henTailBrown: '#a8744a', comb: '#d9705f', chick: '#f3d86e',
  dog: '#3f3b38', dogWhite: '#f6f1e6',
} as const;

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0): void {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), a, 0, TAU); ctx.fill();
}
function shade(ctx: Ctx, rx: number, ry: number, dx = 2, dy = 3.5): void { ctx.fillStyle = P.shadow; oval(ctx, dx, dy, rx, ry); }

interface SheepLook { t: number; seed: number; graze: number; wool: number; snow: number; lamb: boolean; lying: boolean; hop: number }

/** A sheep from above: a cloud of fleece, and a dark face that dips while it grazes. */
function sheep(ctx: Ctx, o: SheepLook): void {
  const lift = o.hop;
  ctx.save(); if (o.lamb) ctx.scale(0.6, 0.6);
  shade(ctx, 11.5, 8, 2 + lift * 4, 3.5 + lift * 6);
  if (lift) ctx.scale(1 + lift * 0.12, 1 + lift * 0.12);
  const w = 0.62 + 0.38 * o.wool;
  // the head first, so the fleece overlaps the neck
  const hx = (o.lying ? 8.5 : 10) + o.graze * 2.4, ha = o.lying ? 0.55 : Math.sin(o.t / 2300 + o.seed) * 0.12, hs = 1 - o.graze * 0.12;
  ctx.save(); ctx.rotate(ha);
  ctx.fillStyle = C.face;
  oval(ctx, hx - 1.2, -3.1 * hs, 2.2, 1, -0.5); oval(ctx, hx - 1.2, 3.1 * hs, 2.2, 1, 0.5);
  oval(ctx, hx + 1.4, 0, 4.2 * hs, 3 * hs);
  ctx.restore();
  ctx.fillStyle = C.woolShade; oval(ctx, 0, 0.7, 10.6 * w + 0.8, 7.3 * w + 0.8);
  ctx.fillStyle = o.lamb ? C.lamb : C.wool;
  if (o.wool > 0.45) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, x = Math.cos(a) * 7 * w, y = Math.sin(a) * 4.5 * w, r = 3.5 * w + rnd(o.seed + k) * 0.8; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.ellipse(0, 0, 8.6 * w, 5.6 * w, 0, 0, TAU); ctx.fill();
  } else oval(ctx, 0, 0, 10 * w, 6.4 * w);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; oval(ctx, -1.5, -1.9, 5 * w, 2.4 * w);
  if (o.snow > 0.01) { ctx.fillStyle = `rgba(255,255,255,${0.92 * o.snow})`; oval(ctx, -1, -0.4, 6.4 * w, 3.8 * w); }
  ctx.restore();
}

/** A hen: tail, body, a red comb and a beak that bobs forward as she pecks; puffed up in the cold. */
function hen(ctx: Ctx, t: number, peck: number, brown: boolean, flap: number, puff: number): void {
  shade(ctx, 5, 3.4, 1.5, 2.6);
  if (flap > 0.01) {
    ctx.fillStyle = brown ? '#b98559' : '#ebe4d6';
    const s = Math.sin(t / 45) * 0.6 * flap;
    oval(ctx, -0.5, -4.2 - 1.2 * flap, 3.6, 1.8, -0.5 - s); oval(ctx, -0.5, 4.2 + 1.2 * flap, 3.6, 1.8, 0.5 + s);
  }
  ctx.fillStyle = brown ? C.henTailBrown : C.henTail; oval(ctx, -5, 0, 2.6, 2.1);
  ctx.fillStyle = brown ? C.henBrown : C.hen; oval(ctx, 0, 0, 5.2 * (1 + puff * 0.12), 3.8 * (1 + puff * 0.2));
  const hx = 4.4 + peck * 2;
  oval(ctx, hx, 0, 2.1, 2.1);
  ctx.fillStyle = C.comb; oval(ctx, hx - 0.3, 0, 1.5, 0.75);
  ctx.fillStyle = P.yellow; ctx.beginPath(); ctx.moveTo(hx + 1.6, -0.7); ctx.lineTo(hx + 3.2, 0); ctx.lineTo(hx + 1.6, 0.7); ctx.fill();
}

function chick(ctx: Ctx, peck: number): void {
  shade(ctx, 1.8, 1.4, 0.8, 1.3);
  ctx.fillStyle = C.chick; oval(ctx, 0, 0, 1.9, 1.7); oval(ctx, 1.6 + peck * 0.6, 0, 1.1, 1.1);
  ctx.fillStyle = '#e0a84a'; oval(ctx, 2.8 + peck * 0.6, 0, 0.6, 0.35);
}

/** A collie from above: black coat, white collar, blaze and tail tip. */
function dog(ctx: Ctx, t: number, pose: DogPose, wag: number, head: number): void {
  if (pose === 'curl') {
    shade(ctx, 8.5, 7.5, 1.5, 3);
    ctx.fillStyle = C.dog; oval(ctx, 0, 0, 8.2, 7.4);
    ctx.fillStyle = C.dogWhite; oval(ctx, 1.5, 5.4, 4, 1.8, 0.25);
    ctx.fillStyle = C.dog; oval(ctx, 4.2, -1.8, 3.6, 3.1);
    ctx.fillStyle = C.dogWhite; oval(ctx, 5.4, -1.4, 2, 0.8, 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; oval(ctx, -2, -2.5, 4, 2.2);
    return;
  }
  const lie = pose === 'lie', bob = pose === 'trot' ? Math.sin(t / 85) * 0.35 : 0;
  shade(ctx, 12, lie ? 6.2 : 5.2);
  ctx.save(); ctx.translate(-10, 0); ctx.rotate(Math.sin(t / 170) * 0.55 * wag + (lie ? 0.5 : 0));
  ctx.fillStyle = C.dog; oval(ctx, -5, 0, 6.2, 2.1);
  ctx.fillStyle = C.dogWhite; oval(ctx, -10.2, 0, 2, 1.6);
  ctx.restore();
  ctx.fillStyle = C.dog; rr(ctx, -11, lie ? -5.6 : -4.6 + bob, 21, lie ? 11.2 : 9.2, lie ? 5.6 : 4.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; oval(ctx, -2, -2, 6, 1.6);
  ctx.fillStyle = C.dogWhite; oval(ctx, 8, 0, 3.2, lie ? 5 : 4.4);
  if (lie) { oval(ctx, 14.5, -2.3, 2.3, 1.3); oval(ctx, 14.5, 2.3, 2.3, 1.3); }
  ctx.save(); ctx.translate(lie ? 12 : 11, 0); ctx.rotate(head);
  ctx.fillStyle = C.dog; oval(ctx, 2.6, 0, 4.2, 3.6);
  ctx.beginPath(); ctx.moveTo(-0.2, -1.4); ctx.lineTo(0.8, -4.6); ctx.lineTo(2.6, -2.4); ctx.moveTo(-0.2, 1.4); ctx.lineTo(0.8, 4.6); ctx.lineTo(2.6, 2.4); ctx.fill();
  ctx.fillStyle = C.dogWhite; oval(ctx, 3.8, 0, 2.6, 0.9); oval(ctx, 6.2, 0, 1.7, 1.4);
  ctx.fillStyle = '#2a2725'; oval(ctx, 7.7, 0, 0.7, 0.6);
  ctx.restore();
}

/** The paddock's post-and-rail fence and trough, drawn once into the background; the gate is drawn each frame. */
export function drawPen(b: Ctx): void {
  const { x, y, w, h } = PEN;
  // round from the gate's latch post, past the trough corner and back to its hinge post
  const rail = (dx: number, dy: number, colour: string, lw: number) => {
    b.strokeStyle = colour; b.lineWidth = lw; b.lineCap = 'round';
    b.beginPath();
    b.moveTo(x + w + dx, GATE.y1 + dy); b.lineTo(x + w + dx, y + h + dy); b.lineTo(x + dx, y + h + dy); b.lineTo(x + dx, y + dy); b.lineTo(x + w + dx, y + dy); b.lineTo(x + w + dx, GATE.y0 + dy);
    b.stroke();
  };
  rail(2, 3, P.shadow, 4); rail(0, 0, C.fence, 2.6);
  b.lineCap = 'butt';
  b.fillStyle = C.post;
  const post = (px: number, py: number, r = 2.6) => { b.beginPath(); b.arc(px, py, r, 0, TAU); b.fill(); };
  for (let i = 0; i <= 4; i++) { post(x + (i * w) / 4, y); post(x + (i * w) / 4, y + h); }
  for (let i = 1; i < 5; i++) post(x, y + (i * h) / 5);
  post(x + w, y + h * 0.3);
  post(x + w, GATE.y0, 2.8); post(x + w, GATE.y1, 2.8);
  const { x: tx, y: ty, w: tw, h: th } = TROUGH;
  b.fillStyle = P.shadow; rr(b, tx + 2, ty + 3, tw, th, 4); b.fill();
  b.fillStyle = C.trough; rr(b, tx, ty, tw, th, 4); b.fill();
  b.fillStyle = 'rgba(160,200,225,0.8)'; rr(b, tx + 2, ty + 2, tw - 4, th - 4, 3); b.fill();
}

const weight = (blend: Blend, s: Season) => (blend.from === s ? 1 - blend.k : 0) + (blend.to === s ? blend.k : 0);

function at(ctx: Ctx, x: number, y: number, a: number, draw: () => void): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); draw(); ctx.restore();
}

/** The gate, the sheep, the hens and the dog, on the ground under the machine. */
export function drawAnimals(ctx: Ctx, a: Animals, blend: Blend, season: Season): void {
  const t = a.t;
  // the gate: shut, or swung out while the flock is away or on its way
  const { x: gx, y0, y1 } = GATE, open = gateOpen(a), len = y1 - y0;
  ctx.strokeStyle = C.fence; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(open ? gx + len * 0.9 : gx, open ? y0 - len * 0.4 : y1); ctx.stroke();
  ctx.lineCap = 'butt';

  const spring = weight(blend, 'spring'), snow = weight(blend, 'winter');
  // full fleece through the winter and spring, shorn for the summer, growing back in the autumn
  const wool = spring + weight(blend, 'summer') * 0.25 + weight(blend, 'autumn') * 0.7 + snow;
  for (const s of a.sheep) {
    if (s.lamb && spring < 0.05) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.lamb) ctx.globalAlpha = spring;
    sheep(ctx, { t, seed: s.seed, graze: s.graze, wool: s.lamb ? 1 : wool, snow: s.lamb ? 0 : snow, lamb: s.lamb, lying: s.state === 'lie', hop: s.hop });
    ctx.restore();
  }

  if (spring > 0.05) { ctx.globalAlpha = spring; for (const c of a.chicks) at(ctx, c.x, c.y, c.a, () => chick(ctx, c.peck)); ctx.globalAlpha = 1; }
  // fluffed up against the cold, and when roosting for the night
  const puff = season === 'winter' || a.roost ? 1 : 0;
  a.hens.forEach((h, i) => { if (!henIndoors(season, i)) at(ctx, h.x, h.y, h.a, () => hen(ctx, t, h.peck, h.brown, h.flap, puff)); });

  const g = a.dog;
  at(ctx, g.x, g.y, g.a, () => dog(ctx, t, g.pose, g.wag, g.head));
}
