// The neighbours' lane and its passers-by, top-down in the game's style: flat pastel fills and soft
// offset shadows. Each passer-by faces +x with its origin at its middle, in world units.
import { LANE, SCALE, WORLD_W } from '../game/constants';
import { LANE_MID, type Lane, type Passer, laneOffset } from '../game/lane';
import type { Season } from '../game/types';
import type { Wheels } from '../game/wheels';
import { bale } from './barn';
import { tractor, trailer } from './machines';
import { type Ctx, P, mix, rnd, rr } from './palette';

const C = {
  lane: '#e5dbc2', laneEdge: '#d2c4a3', snow: '#f1f2f1',
  blue: '#7d9cc6', van: '#ece6d8', vanStripe: '#82b3aa', glass: 'rgba(235,245,250,0.85)',
  wool: '#f7f3ea', woolShade: '#e3d9c6', face: '#5b5550', dog: '#3f3b38', dogWhite: '#f6f1e6',
  skin: '#e9c9a6', bale: '#9b9085',
} as const;
const JACKETS = ['#d9705f', '#6f9a6a', '#7d8fa8', '#c79a5a'];
const TAU = Math.PI * 2;

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, TAU); ctx.fill();
}

/** The lane itself, drawn once into the background: a pale track, its wheel ruts and a grass strip down the middle. */
export function laneGround(b: Ctx, snow: number): void {
  const { y, h } = LANE;
  b.fillStyle = P.shadow; rr(b, -20, y + 3, WORLD_W + 40, h, 26); b.fill();
  b.fillStyle = mix(C.lane, C.snow, snow * 0.6); rr(b, -20, y, WORLD_W + 40, h, 26); b.fill();
  b.strokeStyle = C.laneEdge; b.lineWidth = 2; b.stroke();
  b.lineCap = 'round';
  b.strokeStyle = `rgba(160,190,140,${0.4 * (1 - snow)})`; b.lineWidth = 9;
  b.beginPath(); for (let x = -20; x <= WORLD_W + 20; x += 20) { const yy = LANE_MID + Math.sin(x * 0.013) * 2; if (x > -20) b.lineTo(x, yy); else b.moveTo(x, yy); } b.stroke();
  b.strokeStyle = 'rgba(150,125,85,0.10)'; b.lineWidth = 8;
  b.beginPath(); for (const o of [-22, 22]) { b.moveTo(-20, LANE_MID + o); b.lineTo(WORLD_W + 20, LANE_MID + o); } b.stroke();
  b.lineCap = 'butt';
  for (let i = 0; i < 90; i++) { b.fillStyle = `rgba(150,130,100,${0.15 + rnd(i + 300) * 0.15})`; b.beginPath(); b.arc(rnd(i + 900) * WORLD_W, y + 6 + rnd(i + 950) * (h - 12), 1.3, 0, TAU); b.fill(); }
}

function van(ctx: Ctx): void {
  ctx.fillStyle = P.shadow; rr(ctx, -16, -6.5, 36, 19, 6); ctx.fill();
  ctx.fillStyle = C.van; rr(ctx, -18, -9, 36, 18, 6); ctx.fill();
  ctx.fillStyle = C.vanStripe; ctx.fillRect(-16, -9, 26, 2.2); ctx.fillRect(-16, 6.8, 26, 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, -14, -6, 20, 12, 4); ctx.fill();
  ctx.fillStyle = C.glass; rr(ctx, 9, -7, 5.5, 14, 2.5); ctx.fill();
  ctx.fillStyle = C.van; ctx.fillRect(11, -10.6, 2.4, 1.8); ctx.fillRect(11, 8.8, 2.4, 1.8);   // mirrors
}

function cyclist(ctx: Ctx, t: number, jacket: string): void {
  ctx.fillStyle = P.shadow; oval(ctx, 1.5, 3, 7.5, 3.4);
  ctx.strokeStyle = P.tyre; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6.5, 0); ctx.stroke();
  ctx.fillStyle = P.tyre; oval(ctx, -5.5, 0, 3.2, 0.7); oval(ctx, 5.5, 0, 3.2, 0.7);
  ctx.strokeStyle = P.steelDark; ctx.beginPath(); ctx.moveTo(4.5, -2.6); ctx.lineTo(4.5, 2.6); ctx.stroke();   // handlebars
  const pedal = Math.sin(t / 160) * 1.1;
  ctx.fillStyle = C.face; oval(ctx, 0.5 + pedal, -1.6, 1.4, 0.7); oval(ctx, 0.5 - pedal, 1.6, 1.4, 0.7);
  ctx.fillStyle = jacket; oval(ctx, -0.6, 0, 2.3, 3.4);
  ctx.strokeStyle = jacket; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(4.2, -2.4); ctx.moveTo(0, 2.6); ctx.lineTo(4.2, 2.4); ctx.stroke();
  ctx.fillStyle = '#f0ece2'; oval(ctx, 0.8, 0, 1.8, 1.6);   // helmet
}

/** Someone on foot, from above; `wave` (0..1) raises a hand. */
function walker(ctx: Ctx, t: number, jacket: string, hat: string, wave: number): void {
  const sw = Math.sin(t / 260);
  ctx.fillStyle = P.shadow; oval(ctx, 1.2, 2.4, 3, 4.2);
  ctx.fillStyle = jacket; oval(ctx, sw * 1.2, -4, 1.3, 1); oval(ctx, -sw * 1.2, 4, 1.3, 1);
  if (wave > 0.02) {
    // an arm up and out to the side, the hand going to and fro
    const hx = 1.6 + Math.sin(t / 120) * 0.9 * wave, hy = -3.2 - wave * 3.6;
    ctx.strokeStyle = jacket; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(hx, hy); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = C.skin; oval(ctx, hx, hy, 1.1, 1.1);
  }
  ctx.fillStyle = jacket; oval(ctx, 0, 0, 2.3, 4);
  ctx.fillStyle = hat; oval(ctx, 0.4, 0, 2, 2);
}

/** A trotting dog from above: coat, a white collar and blaze, the tail wagging. */
function dog(ctx: Ctx, t: number, coat: string, white: string, wag: number): void {
  const bob = Math.sin(t / 85) * 0.35;
  ctx.fillStyle = P.shadow; oval(ctx, 2, 3.5, 12, 5.2);
  ctx.save(); ctx.translate(-10, 0); ctx.rotate(Math.sin(t / 170) * 0.55 * wag);
  ctx.fillStyle = coat; oval(ctx, -5, 0, 6.2, 2.1);
  ctx.fillStyle = white; oval(ctx, -10.2, 0, 2, 1.6);
  ctx.restore();
  ctx.fillStyle = coat; rr(ctx, -11, -4.6 + bob, 21, 9.2, 4.6); ctx.fill();
  ctx.fillStyle = white; oval(ctx, 8, 0, 3.2, 4.4);
  ctx.save(); ctx.translate(11, 0);
  ctx.fillStyle = coat; oval(ctx, 2.6, 0, 4.2, 3.6);
  ctx.beginPath(); ctx.moveTo(-0.2, -1.4); ctx.lineTo(0.8, -4.6); ctx.lineTo(2.6, -2.4); ctx.moveTo(-0.2, 1.4); ctx.lineTo(0.8, 4.6); ctx.lineTo(2.6, 2.4); ctx.fill();
  ctx.fillStyle = white; oval(ctx, 3.8, 0, 2.6, 0.9); oval(ctx, 6.2, 0, 1.7, 1.4);
  ctx.fillStyle = '#2a2725'; oval(ctx, 7.7, 0, 0.7, 0.6);
  ctx.restore();
}

/** A sheep from above: a cloud of fleece (thinner once shorn) and a dark face; `hop` lifts it a little. */
function sheep(ctx: Ctx, t: number, seed: number, wool: number, hop: number): void {
  ctx.fillStyle = P.shadow; oval(ctx, 2 + hop * 4, 3.5 + hop * 6, 11.5, 8);
  ctx.save(); ctx.scale(1 + hop * 0.12, 1 + hop * 0.12);
  const w = 0.62 + 0.38 * wool;
  ctx.save(); ctx.rotate(Math.sin(t / 2300 + seed) * 0.12);
  ctx.fillStyle = C.face; oval(ctx, 8.8, -3.1, 2.2, 1, -0.5); oval(ctx, 8.8, 3.1, 2.2, 1, 0.5); oval(ctx, 11.4, 0, 4.2, 3);
  ctx.restore();
  ctx.fillStyle = C.woolShade; oval(ctx, 0, 0.7, 10.6 * w + 0.8, 7.3 * w + 0.8);
  ctx.fillStyle = C.wool; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, x = Math.cos(a) * 7 * w, y = Math.sin(a) * 4.5 * w, r = 3.5 * w + rnd(seed + k) * 0.8; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ctx.ellipse(0, 0, 8.6 * w, 5.6 * w, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; oval(ctx, -1.5, -1.9, 5 * w, 2.4 * w);
  ctx.restore();
}

/** The neighbour's flat trailer of bales, hitched at the tractor's origin like the game's trailer. */
function baleTrailer(ctx: Ctx): void {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-40, -3, 16, 6);
  ctx.fillStyle = P.shadow; rr(ctx, -101, -20, 64, 44, 6); ctx.fill();
  ctx.fillStyle = P.tyre; rr(ctx, -78, -24, 18, 6, 2); ctx.fill(); rr(ctx, -78, 18, 18, 6, 2); ctx.fill();
  ctx.fillStyle = C.bale; rr(ctx, -104, -22, 64, 44, 5); ctx.fill();
  for (let i = 0; i < 4; i++) small(ctx, -88 + (i % 2) * 33, -10 + Math.floor(i / 2) * 20, 0.82);
}

function small(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); bale(ctx, 0, 0); ctx.restore();
}

// the flock's places behind the leading sheep, and each one's own little step
const FLOCK = Array.from({ length: 9 }, (_, i) => ({ dx: -i * 14 - rnd(i) * 10, dy: (rnd(i + 3) - 0.5) * 32, ph: rnd(i + 5) * 6 }));

function passer(ctx: Ctx, p: Passer, season: Season, t: number): void {
  const wh: Wheels = { steer: 0, roll: p.roll }, jacket = JACKETS[Math.floor(p.seed * JACKETS.length)];
  ctx.save(); ctx.translate(p.x, LANE_MID + laneOffset(p)); ctx.rotate(p.dir > 0 ? 0 : Math.PI);
  switch (p.kind) {
    case 'bales': ctx.scale(SCALE, SCALE); baleTrailer(ctx); tractor(ctx, t, wh, C.blue); break;
    case 'pumpkins': ctx.scale(SCALE, SCALE); trailer(ctx, 0.9, p.roll); tractor(ctx, t, wh, C.blue); break;
    case 'feed': ctx.scale(SCALE, SCALE); tractor(ctx, t, wh, C.blue); small(ctx, 60, 0, 0.7); break;   // a bale on the loader
    case 'van': ctx.scale(2.6, 2.6); van(ctx); break;
    case 'bike': ctx.scale(2.2, 2.2); cyclist(ctx, t, jacket); break;
    case 'walker': {
      const winter = season === 'winter';
      ctx.save(); ctx.translate(2, 19); ctx.scale(0.85, 0.85); dog(ctx, t, '#b0855a', '#f2e6d2', 1); ctx.restore();
      ctx.strokeStyle = 'rgba(90,80,70,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(1, 8); ctx.lineTo(13, 19); ctx.stroke();   // the lead
      ctx.scale(2.2, 2.2); walker(ctx, t, winter ? '#7d8fa8' : '#9bb08a', winter ? '#d9705f' : '#e8dcc0', p.wave);
      break;
    }
    case 'flock':
      for (const f of FLOCK) { ctx.save(); ctx.translate(f.dx, f.dy); sheep(ctx, t, f.ph, season === 'spring' ? 1 : 0.7, Math.max(0, Math.sin(t / 300 + f.ph)) * 0.15); ctx.restore(); }
      ctx.save(); ctx.translate(-150, 18); dog(ctx, t, C.dog, C.dogWhite, 0.6); ctx.restore();
      ctx.save(); ctx.translate(-178, -6); ctx.scale(2.2, 2.2); walker(ctx, t, '#9bb08a', '#7a6a55', p.wave); ctx.restore();
      break;
  }
  ctx.restore();
}

/** Whoever is passing along the lane. */
export function drawLane(ctx: Ctx, l: Lane, season: Season, t: number): void {
  for (const p of l.passers) passer(ctx, p, season, t);
}
