// The birds, top-down in the game's style: flat pastel fills and soft offset shadows. Each faces +x
// with its origin at the body's middle, in world units.
import { type Birds, type BirdKind, type Flier, swallows } from '../game/birds';
import { type Ctx, P } from './palette';

const C = {
  gull: '#fbfaf6', gullWing: '#c6ced3', tip: '#55504c', rook: '#4d4846', rookWing: '#3d3937', rookTail: '#2f2c2a', rookBeak: '#8d8682',
  swallow: '#4a5574', belly: '#f3ede2', robin: '#9f7f60', breast: '#e8915a', sparrow: '#b49673', sparrowDark: '#8d7356',
} as const;

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0): void {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), a, 0, Math.PI * 2); ctx.fill();
}

/** A bird on the ground or a perch: folded wings, the head bobbing forward as it pecks. */
function standing(ctx: Ctx, kind: BirdKind, peck: number): void {
  if (kind === 'robin' || kind === 'sparrow') {
    ctx.fillStyle = P.shadow; oval(ctx, 1, 1.6, 2.6, 1.8);
    ctx.fillStyle = kind === 'robin' ? C.robin : C.sparrow; oval(ctx, -3, 0, 1.6, 1); oval(ctx, 0, 0, 2.7, 2.2);
    if (kind === 'robin') { ctx.fillStyle = C.breast; oval(ctx, 1.2, 0, 1.5, 1.8); }
    ctx.fillStyle = kind === 'robin' ? C.robin : C.sparrowDark; oval(ctx, 2.1 + peck, 0, 1.4, 1.4);
    return;
  }
  const dark = kind === 'rook';
  ctx.fillStyle = P.shadow; oval(ctx, 1.5, 2.5, 5, 2.8);
  ctx.fillStyle = dark ? C.rook : C.gull; oval(ctx, 0, 0, 5.2, 2.6);
  ctx.fillStyle = dark ? C.rookWing : C.gullWing; oval(ctx, -1.2, 0, 4.6, 2.3);
  ctx.fillStyle = dark ? C.rookTail : C.tip; oval(ctx, -5.2, 0, 2.2, 1.1);
  const hx = 4.4 + peck * 1.6;
  ctx.fillStyle = dark ? C.rook : C.gull; oval(ctx, hx, 0, 1.9, 1.8);
  ctx.fillStyle = dark ? C.rookBeak : P.yellow; ctx.beginPath(); ctx.moveTo(hx + 1.5, -0.6); ctx.lineTo(hx + 3.6, 0); ctx.lineTo(hx + 1.5, 0.6); ctx.fill();
}

/** A bird in flight; `flap` is the wingbeat phase. As a silhouette it is its own shadow. */
function flying(ctx: Ctx, kind: BirdKind, flap: number, silhouette: boolean): void {
  const s = Math.sin(flap);
  const fill = (c: string) => { ctx.fillStyle = silhouette ? P.shadow : c; };
  const wing = (span: number, root: number, back: number, colour: string, tip?: string) => {
    for (const side of [-1, 1]) {
      fill(colour);
      ctx.beginPath(); ctx.moveTo(root, side * 1.2);
      ctx.quadraticCurveTo(root - 1, side * span * 0.7, root - back, side * span);
      ctx.quadraticCurveTo(root - back * 0.55, side * span * 0.45, root - back * 0.7, side * 1.2);
      ctx.closePath(); ctx.fill();
      if (tip && !silhouette) { ctx.fillStyle = tip; oval(ctx, root - back + 0.6, side * (span - 1.2), 1.4, 1.6, side * 0.5); }
    }
  };
  if (kind === 'swallow') {
    wing(10 + 2.5 * s, 1, 6.5, C.swallow);
    fill(C.swallow); ctx.beginPath(); ctx.moveTo(-2.5, -0.7); ctx.lineTo(-9, -2.6); ctx.lineTo(-4.2, 0); ctx.lineTo(-9, 2.6); ctx.lineTo(-2.5, 0.7); ctx.fill();
    oval(ctx, 0, 0, 3.6, 1.3);
    if (!silhouette) { ctx.fillStyle = C.belly; oval(ctx, 0.3, 0, 2, 0.7); }
    fill(C.swallow); oval(ctx, 3.4, 0, 1.4, 1.3);
    return;
  }
  if (kind === 'sparrow' || kind === 'robin') {
    const body = kind === 'robin' ? C.robin : C.sparrow;
    wing(5 + 1.5 * s, 0.5, 2.2, body);
    fill(body); oval(ctx, 0, 0, 2.6, 1.6); oval(ctx, 2.3, 0, 1.3, 1.3);
    if (kind === 'robin' && !silhouette) { ctx.fillStyle = C.breast; oval(ctx, 1.4, 0, 1.2, 1.1); }
    return;
  }
  const dark = kind === 'rook';
  wing(12.5 + 3 * s, 1.5, 4.5, dark ? C.rookWing : C.gullWing, dark ? undefined : C.tip);
  fill(dark ? C.rook : C.gull); oval(ctx, 0, 0, 5, 2.1); oval(ctx, -5.2, 0, 2.3, 1.6); oval(ctx, 4.8, 0, 1.8, 1.7);
  if (!silhouette) { ctx.fillStyle = dark ? C.rookBeak : P.yellow; ctx.beginPath(); ctx.moveTo(6.2, -0.5); ctx.lineTo(8.2, 0); ctx.lineTo(6.2, 0.5); ctx.fill(); }
}

function at(ctx: Ctx, x: number, y: number, a: number, draw: () => void): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); draw(); ctx.restore();
}

/** Birds on the ground and on the hedge tops, drawn under the machine. */
export function drawGroundBirds(ctx: Ctx, b: Birds): void {
  for (const f of b.flock) if (f.state === 'ground') at(ctx, f.x, f.y, f.a, () => standing(ctx, f.kind, f.peck));
  for (const p of b.hedge) if (!p.flying) at(ctx, p.x, p.y, p.a, () => standing(ctx, p.kind, Math.sin(b.t / 300 + p.seed) > 0.8 ? 1 : 0));
}

/** Birds in the air, over everything on the ground; `summer` (0..1) fades the swallows in and out with the season. */
export function drawFlyingBirds(ctx: Ctx, b: Birds, summer: number): void {
  const air: [BirdKind, Flier, number][] = [];
  for (const f of b.flock) if (f.state !== 'ground') air.push([f.kind, f, 1]);
  for (const p of b.hedge) if (p.flying) air.push([p.kind, p, 1]);
  if (summer > 0.05) for (const f of swallows(b)) air.push(['swallow', f, summer]);
  if (!air.length) return;
  // shadows first, cast down and away by the bird's height, then the birds
  for (const [kind, f, alpha] of air) { ctx.globalAlpha = 0.75 * alpha; at(ctx, f.x + f.h * 0.5, f.y + f.h * 0.9, f.a, () => flying(ctx, kind, f.flap, true)); }
  for (const [kind, f, alpha] of air) { ctx.globalAlpha = alpha; at(ctx, f.x, f.y, f.a, () => flying(ctx, kind, f.flap, false)); }
  ctx.globalAlpha = 1;
}
