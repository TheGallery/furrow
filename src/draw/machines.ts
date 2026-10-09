// Every machine exactly as drawn in the approved mockup: top-down, facing +x,
// origin at the tractor's rear axle.
import type { Rig } from '../game/types';
import { type Ctx, P, rnd, rr } from './palette';

function shadow(ctx: Ctx, x: number, y: number, w: number, h: number) { ctx.fillStyle = P.shadow; rr(ctx, x + 3, y + 5, w, h, 8); ctx.fill(); }

function tractor(ctx: Ctx, t: number, colour: string = P.red) {
  shadow(ctx, -26, -22, 70, 44);
  ctx.fillStyle = P.tyre;
  rr(ctx, -20, -26, 26, 10, 3); ctx.fill(); rr(ctx, -20, 16, 26, 10, 3); ctx.fill();           // rear tyres
  rr(ctx, 26, -20, 16, 7, 2); ctx.fill(); rr(ctx, 26, 13, 16, 7, 2); ctx.fill();               // front tyres
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;                              // tread, rolling
  for (let i = 0; i < 4; i++) { const ox = -18 + ((i * 7 + t * 0.04) % 24); [-21, 21].forEach((yy) => { ctx.beginPath(); ctx.moveTo(ox, yy - 4); ctx.lineTo(ox + 2, yy + 4); ctx.stroke(); }); }
  ctx.fillStyle = colour; rr(ctx, 4, -11, 42, 22, 8); ctx.fill();                                // bonnet
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, 8, -7, 34, 5, 3); ctx.fill();
  ctx.fillStyle = colour; rr(ctx, -18, -17, 26, 34, 7); ctx.fill();                              // cab base
  ctx.fillStyle = P.cab; rr(ctx, -15, -14, 20, 28, 5); ctx.fill();                               // roof/glass
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; rr(ctx, -12, -11, 6, 22, 3); ctx.fill();
  ctx.fillStyle = '#5b5550'; ctx.beginPath(); ctx.arc(30, -6, 2.4, 0, Math.PI * 2); ctx.fill();   // exhaust
  for (let i = 0; i < 3; i++) { const k = ((t / 1600) + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(30 - k * 26, -6 - k * 6, 2.5 + k * 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = P.steelDark; ctx.fillRect(-26, -3, 8, 6);                                      // hitch
}

function cultivator(ctx: Ctx, t: number, w: number) {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-36, -3, 12, 6);
  shadow(ctx, -60, -w / 2, 26, w);
  ctx.fillStyle = P.yellow; rr(ctx, -40, -w / 2, 6, w, 3); ctx.fill(); rr(ctx, -58, -w / 2, 6, w, 3); ctx.fill();
  ctx.fillStyle = P.steel;
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const y = -w / 2 + 6 + i * (w - 12) / 8 + (row ? 5 : 0), x = row ? -60 : -42, wob = Math.sin(t / 120 + i + row) * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y + wob, x - 10, y + 2 + wob); ctx.lineWidth = 2.2; ctx.strokeStyle = P.steel; ctx.stroke();
  }
}

function drill(ctx: Ctx, _t: number, w: number, units: 'hopper' | 'precision' | 'few') {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-36, -3, 12, 6);
  shadow(ctx, -66, -w / 2, 32, w);
  if (units === 'hopper') {
    ctx.fillStyle = P.red; rr(ctx, -60, -w / 2 + 2, 22, w - 4, 6); ctx.fill();
    ctx.fillStyle = '#e9dfc4'; rr(ctx, -57, -w / 2 + 6, 16, w - 12, 4); ctx.fill();            // open lid, seed visible
    ctx.fillStyle = '#c9a964'; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.arc(-55 + rnd(i) * 12, -w / 2 + 8 + rnd(i + 50) * (w - 16), 1.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = P.steel; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(-66, -w / 2 + 4 + i * (w - 8) / 11, 2.4, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const n = units === 'few' ? 3 : 6;
    ctx.fillStyle = P.yellow; rr(ctx, -42, -w / 2, 6, w, 3); ctx.fill();
    for (let i = 0; i < n; i++) {
      const y = -w / 2 + (i + 0.5) * w / n;
      ctx.fillStyle = P.red; rr(ctx, -58, y - 6, 16, 12, 4); ctx.fill();
      ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(-50, y, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.tyre; rr(ctx, -66, y - 3, 8, 6, 2); ctx.fill();
    }
  }
}

function sprayer(ctx: Ctx, t: number, w: number, working: boolean) {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-36, -3, 12, 6);
  shadow(ctx, -66, -16, 34, 32);
  ctx.fillStyle = P.tyre; rr(ctx, -56, -20, 16, 6, 2); ctx.fill(); rr(ctx, -56, 14, 16, 6, 2); ctx.fill();
  ctx.fillStyle = P.tank; ctx.beginPath(); ctx.ellipse(-48, 0, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(120,170,200,0.45)'; ctx.beginPath(); ctx.ellipse(-48, 0, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.steelDark; ctx.fillRect(-68, -w / 2, 3, w);                                   // boom
  ctx.strokeStyle = P.steel; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y0 = -w / 2 + i * w / 6; ctx.beginPath(); ctx.moveTo(-68, y0); ctx.lineTo(-62, y0 + w / 12); ctx.lineTo(-68, y0 + w / 6); ctx.stroke(); }
  if (working) for (let i = 0; i < 14; i++) {
    const y = -w / 2 + 4 + i * (w - 8) / 13, k = ((t / 700) + rnd(i)) % 1;
    ctx.fillStyle = `rgba(170,205,230,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(-70 - k * 10, y, 3 + k * 5, 2 + k * 4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function combine(ctx: Ctx, t: number, w: number) {
  shadow(ctx, -50, -24, 110, 48);
  ctx.fillStyle = P.tyre; rr(ctx, 4, -30, 26, 10, 3); ctx.fill(); rr(ctx, 4, 20, 26, 10, 3); ctx.fill(); rr(ctx, -46, -24, 16, 7, 2); ctx.fill(); rr(ctx, -46, 17, 16, 7, 2); ctx.fill();
  ctx.fillStyle = '#7fb069'; rr(ctx, -50, -20, 84, 40, 9); ctx.fill();                         // body (green combine)
  ctx.fillStyle = '#6a9c58'; rr(ctx, -40, -16, 34, 32, 6); ctx.fill();                          // grain tank
  ctx.fillStyle = P.wheat; rr(ctx, -37, -13, 28, 26, 5); ctx.fill();
  ctx.fillStyle = P.cab; rr(ctx, 14, -12, 18, 24, 5); ctx.fill();
  ctx.fillStyle = P.steelDark; ctx.fillRect(-30, -24, 40, 4);                                   // folded unloading auger
  ctx.fillStyle = '#e8d9a8'; rr(ctx, 36, -w / 2, 20, w, 6); ctx.fill();                       // header
  ctx.strokeStyle = '#b8a26a'; ctx.lineWidth = 1.5; for (let i = 0; i < 18; i++) { const y = -w / 2 + 3 + i * (w - 6) / 17; ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(62, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(200,120,90,0.85)'; const ph = (t / 300) % 1;                            // turning reel bats
  for (let i = 0; i < 4; i++) { const x = 40 + ((i / 4 + ph) % 1) * 14; ctx.fillRect(x, -w / 2 + 3, 2.5, w - 6); }
}

function rootHarvester(ctx: Ctx, t: number, w: number) {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-36, -3, 12, 6);
  shadow(ctx, -86, -w / 2, 54, w);
  ctx.fillStyle = P.tyre; rr(ctx, -74, -w / 2 - 4, 20, 7, 2); ctx.fill(); rr(ctx, -74, w / 2 - 3, 20, 7, 2); ctx.fill();
  ctx.fillStyle = P.red; rr(ctx, -84, -w / 2 + 2, 46, w - 4, 7); ctx.fill();                  // body
  ctx.fillStyle = '#7a5a3a'; rr(ctx, -80, -w / 2 + 6, 22, w - 12, 4); ctx.fill();              // bunker with carrots
  ctx.fillStyle = P.carrot; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.ellipse(-77 + rnd(i) * 16, -w / 2 + 9 + rnd(i + 9) * (w - 18), 3, 1.6, rnd(i + 3) * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#d9d2c2'; ctx.fillRect(-56, -4, 18, 8);                                     // elevator
  ctx.strokeStyle = P.steelDark; ctx.lineWidth = 1; const off = (t / 90) % 4; for (let x = -56 + off; x < -38; x += 4) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x, 4); ctx.stroke(); }
  ctx.fillStyle = P.yellow; rr(ctx, -36, w / 2 - 14, 14, 12, 3); ctx.fill();                   // offset lifter share
}

function trailer(ctx: Ctx, _t: number, _w: number, load: number) {
  ctx.fillStyle = P.steelDark; ctx.fillRect(-40, -3, 16, 6);
  shadow(ctx, -96, -22, 58, 44);
  ctx.fillStyle = P.tyre; rr(ctx, -74, -26, 18, 7, 2); ctx.fill(); rr(ctx, -74, 19, 18, 7, 2); ctx.fill();
  ctx.fillStyle = P.redDark; rr(ctx, -96, -22, 58, 44, 6); ctx.fill();
  ctx.fillStyle = '#c99a6a'; rr(ctx, -92, -18, 50, 36, 4); ctx.fill();
  for (let i = 0; i < Math.round(load * 10); i++) { ctx.fillStyle = P.pumpkin; ctx.beginPath(); ctx.ellipse(-86 + (i % 5) * 9.5, -10 + Math.floor(i / 5) * 14, 5, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.leafDark; ctx.fillRect(-86 + (i % 5) * 9.5 - 0.8, -10 + Math.floor(i / 5) * 14 - 5, 1.6, 2.4); }
}

/**
 * Draw a whole rig. `working` turns on the sprayer's mist; `load` fills the pumpkin trailer.
 */
export function drawRig(ctx: Ctx, rig: Rig, t: number, w: number, load = 0, working = false): void {
  switch (rig) {
    case 'cultivate': cultivator(ctx, t, w); tractor(ctx, t); break;
    case 'drill-hopper': drill(ctx, t, w, 'hopper'); tractor(ctx, t); break;
    case 'drill-precision': drill(ctx, t, w, 'precision'); tractor(ctx, t); break;
    case 'drill-few': drill(ctx, t, w, 'few'); tractor(ctx, t); break;
    case 'spray': sprayer(ctx, t, w, working); tractor(ctx, t); break;
    case 'combine': combine(ctx, t, w); break;
    case 'roots': rootHarvester(ctx, t, w); tractor(ctx, t); break;
    case 'trailer': trailer(ctx, t, w, load); tractor(ctx, t); break;
  }
}
