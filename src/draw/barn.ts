// The approved red barn with the carousel inside (review option D, roll-up door).
import { BARN, DOOR_X, DOOR_Y, FIELD, LANE_H } from '../game/constants';
import { type Ctx, P, ease, rnd, rr } from './palette';

const R = LANE_H / 2;
const XL = FIELD.x - 70;
const laneY = (l: number) => FIELD.y + l * LANE_H + LANE_H / 2;

type Pts = { x: number; y: number }[];
const line = (p: Pts, x: number, y: number) => { const a = p[p.length - 1], k = Math.max(1, Math.ceil(Math.hypot(x - a.x, y - a.y) / 3)); for (let i = 1; i <= k; i++) p.push({ x: a.x + (x - a.x) * i / k, y: a.y + (y - a.y) * i / k }); };
const arc = (p: Pts, cx: number, cy: number, a0: number, a1: number) => { const k = Math.max(4, Math.ceil(Math.abs(a1 - a0) * R / 3)); for (let i = 1; i <= k; i++) { const th = a0 + (a1 - a0) * i / k; p.push({ x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) }); } };

/** Worn tyre tracks from the door to the top of the field, and back from the bottom. */
function tracks(): Pts[] {
  const out: Pts = [{ x: DOOR_X, y: DOOR_Y }];
  line(out, DOOR_X + 30, DOOR_Y); arc(out, DOOR_X + 30, DOOR_Y - R, Math.PI / 2, 0); line(out, DOOR_X + 30 + R, laneY(0) + R); arc(out, DOOR_X + 30 + 2 * R, laneY(0) + R, Math.PI, 1.5 * Math.PI);
  const home: Pts = [{ x: XL, y: laneY(5) }];
  arc(home, XL, laneY(5) - R, Math.PI / 2, Math.PI); line(home, XL - R, DOOR_Y + R); arc(home, XL - 2 * R, DOOR_Y + R, 0, -Math.PI / 2); line(home, DOOR_X, DOOR_Y);
  return [out, home];
}

function bale(b: Ctx, x: number, y: number) {
  b.fillStyle = P.shadow; rr(b, x - 15, y - 7, 34, 22, 9); b.fill();
  b.fillStyle = P.wheat; rr(b, x - 17, y - 11, 34, 22, 9); b.fill();
  b.strokeStyle = 'rgba(150,120,50,0.35)'; b.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) { b.beginPath(); b.moveTo(x + i * 8, y - 10); b.lineTo(x + i * 8, y + 10); b.stroke(); }
}

/** Tracks, the gravel apron, the barn's shadow and hay bales: everything that never moves. */
export function barnGround(b: Ctx): void {
  b.strokeStyle = 'rgba(150,125,85,0.10)'; b.lineWidth = 8; b.lineCap = 'round';
  for (const p of tracks()) for (const o of [-22, 22]) {
    b.beginPath();
    for (let i = 0; i < p.length; i += 2) {
      const j0 = Math.max(0, i - 2), j1 = Math.min(p.length - 1, i + 2), a = Math.atan2(p[j1].y - p[j0].y, p[j1].x - p[j0].x);
      const x = p[i].x - Math.sin(a) * o, y = p[i].y + Math.cos(a) * o;
      if (i) b.lineTo(x, y); else b.moveTo(x, y);
    }
    b.stroke();
  }
  b.lineCap = 'butt';
  b.fillStyle = '#e8dfc6'; rr(b, DOOR_X - 6, 298, 80, 144, 18); b.fill();
  for (let i = 0; i < 70; i++) { b.fillStyle = `rgba(150,130,100,${0.18 + rnd(i + 700) * 0.15})`; b.beginPath(); b.arc(DOOR_X + rnd(i + 900) * 70, 304 + rnd(i + 950) * 132, 1.3, 0, Math.PI * 2); b.fill(); }
  b.save(); b.shadowColor = 'rgba(70,55,35,0.28)'; b.shadowBlur = 16; b.shadowOffsetX = 5; b.shadowOffsetY = 8;
  b.fillStyle = '#b9a98a'; rr(b, BARN.x, BARN.y, BARN.w, BARN.h, 6); b.fill(); b.restore();
  bale(b, 150, 112); bale(b, 192, 106); bale(b, 60, 624);
}

/** The barn floor: planks, carousel rails and the turntable in front of the door. */
export function barnFloor(ctx: Ctx, turntable: number): void {
  const { x, y, w, h } = BARN;
  ctx.fillStyle = '#dcc39b'; rr(ctx, x, y, w, h, 5); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 5); ctx.clip();
  ctx.strokeStyle = 'rgba(120,90,55,0.13)'; ctx.lineWidth = 1; for (let yy = y + 16; yy < y + h; yy += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(120,90,55,0.08)'; for (let i = 0; i < 40; i++) { const yy = y + 16 * Math.floor(rnd(i + 300) * h / 16), xx = x + rnd(i + 400) * w; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 16); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(111,117,120,0.5)'; ctx.lineWidth = 2; for (const rx of [x + 12, x + w - 22]) { ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx, y + h); ctx.stroke(); }
  const cx = 128; ctx.fillStyle = '#cdb184'; ctx.beginPath(); ctx.arc(cx, DOOR_Y, 74, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,55,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.translate(cx, DOOR_Y); ctx.rotate(turntable); ctx.strokeStyle = 'rgba(120,90,55,0.18)'; ctx.lineWidth = 1.2; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(72, 0); ctx.stroke(); } ctx.restore();
  ctx.restore();
}

/** Cupola with a pyramid cap, optionally topped by a slowly swaying weathervane. */
function cupola(ctx: Ctx, cx: number, cy: number, t: number, vane: boolean) {
  const s = 16;
  ctx.fillStyle = P.shadow; rr(ctx, cx - s + 3, cy - s + 5, 2 * s, 2 * s, 3); ctx.fill();
  const faces: [string, [number, number], [number, number]][] = [['#e58571', [-s, -s], [s, -s]], ['#b3564b', [s, s], [-s, s]], ['#d9705f', [-s, s], [-s, -s]], ['#c8634f', [s, -s], [s, s]]];
  for (const [c, a, b] of faces) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx + a[0], cy + a[1]); ctx.lineTo(cx + b[0], cy + b[1]); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = '#f1e7d4'; ctx.lineWidth = 2; ctx.strokeRect(cx - s, cy - s, 2 * s, 2 * s);
  if (!vane) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.7 + Math.sin(t / 4200) * 0.18);
  ctx.strokeStyle = '#4a4440'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
  ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(9, -4); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill(); ctx.fillRect(-15, -4, 4, 8); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Roll-up door on the east wall: the curtain winds into the drum above the doorway. */
function rollDoor(ctx: Ctx, wx: number, door: number) {
  const o = ease(door);
  ctx.fillStyle = `rgba(62,44,32,${0.5 * o})`; ctx.fillRect(wx - 6, 318, 6, 104);
  if (o < 0.99) {
    ctx.fillStyle = `rgba(196,200,201,${1 - o})`; ctx.fillRect(wx - 6, 318, 6, 104);
    ctx.strokeStyle = `rgba(111,117,120,${0.6 * (1 - o)})`; ctx.lineWidth = 1;
    for (let yy = 322 + o * 8; yy < 420; yy += 8) { ctx.beginPath(); ctx.moveTo(wx - 6, yy); ctx.lineTo(wx, yy); ctx.stroke(); }
  }
  const dr = 4 + 3 * o, dg = ctx.createLinearGradient(wx, 0, wx + 2 * dr, 0);
  dg.addColorStop(0, '#8b9194'); dg.addColorStop(0.5, '#d2d6d7'); dg.addColorStop(1, '#7c8285');
  ctx.fillStyle = P.shadow; rr(ctx, wx + 2, 316, 2 * dr, 110, dr); ctx.fill();
  ctx.fillStyle = dg; rr(ctx, wx, 313, 2 * dr, 110, dr); ctx.fill();
}

/**
 * The red gable roof (ridge north–south, two cupolas) at opacity `roof`, which fades to
 * see-through while a machine is inside; the walls and door are always drawn.
 */
export function barnRoof(ctx: Ctx, roof: number, door: number, t: number): void {
  const { x, y, w, h } = BARN, rx = x + w / 2;
  if (roof > 0.01) {
    ctx.save(); ctx.globalAlpha = roof;
    ctx.fillStyle = '#c4604f'; rr(ctx, x, y, w, h, 5); ctx.fill();                         // east slope
    ctx.save(); rr(ctx, x, y, w, h, 5); ctx.clip();
    ctx.fillStyle = '#de7a67'; ctx.fillRect(x, y, rx - x, h);                               // west slope, lit
    ctx.lineWidth = 1;
    for (let xx = x + 11; xx < x + w; xx += 11) { if (Math.abs(xx - rx) < 6) continue; ctx.strokeStyle = xx < rx ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#f1e7d4'; ctx.fillRect(rx - 4, y, 8, h); ctx.fillRect(x, y, w, 5); ctx.fillRect(x, y + h - 5, w, 5);
    cupola(ctx, rx, y + 112, t, true); cupola(ctx, rx, y + h - 112, t, false);
    ctx.restore();
  }
  ctx.strokeStyle = '#f1e7d4'; ctx.lineWidth = 5; rr(ctx, x + 2.5, y + 2.5, w - 5, h - 5, 4); ctx.stroke();
  rollDoor(ctx, x + w, door);
}
