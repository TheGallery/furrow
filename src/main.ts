import { Ambience } from './audio';
import { drawAnimals } from './draw/animals';
import { barnFloor, barnRoof } from './draw/barn';
import { drawFlyingBirds, drawGroundBirds } from './draw/birds';
import { SoilLayer, drawField, drawLaneLines, drawRoute, drawSnow, renderBackground } from './draw/field';
import { drawRig } from './draw/machines';
import { drawBlown, drawCloudShadows } from './draw/wind';
import { type Ctx, ease } from './draw/palette';
import { type Carousel, ease as easeCarousel, select, settled, shortest, turn } from './game/carousel';
import { BARN, DOOR_X, DOOR_Y, FIELD, H, RIG_W, SCALE, W, WORK_HALF, ZOOM } from './game/constants';
import { PACES, PACE_LABELS, type Pilot, autoSteer, laneHold, paceStep, pilotFrom, routeAhead, subSteps } from './game/driving';
import { CROPS, createField, grow, summarize, workStrip } from './game/field';
import { EXT, type MachineItem, machinesFor, nextUp, parkX, rigMid, statusLine, workOffset } from './game/machines';
import { SAVE_KEY, decodeSnapshot, encodeSnapshot } from './game/save';
import { seasonClock } from './game/almanac';
import { chirpPan, createBirds, updateBirds } from './game/birds';
import { createAnimals, updateAnimals } from './game/animals';
import { seasonAt, seasonBlend } from './game/season';
import { SETTINGS_KEY, type Settings, decodeSettings, encodeSettings } from './game/settings';
import type { Crop, Job, Rig } from './game/types';
import { type Control, controlFor } from './game/input';
import { MAX_SPEED, type Vehicle, insideBarn, step } from './game/vehicle';
import { STRAIGHT, type Wheels, rolled, turnWheels } from './game/wheels';
import { createWind, gustAt, stepWind } from './game/wind';
import { BarnMenu } from './ui/barnMenu';
import { DashboardCluster, TOGGLES, type Toggle } from './ui/drivingCard';
import { FieldCard } from './ui/fieldCard';
import { SeasonPill } from './ui/seasonPill';

type Mode = 'drive' | 'parking' | 'spin' | 'menu' | 'leaving';
interface Pose { x: number; y: number; a: number }

const MUTE_KEY = 'furrow.muted';
const HINT_KEY = 'furrow.hinted';
const SLOT = 120;                 // carousel spacing on the barn floor
const PARK_MS = 1600, SPIN_MS = 1700, ROLL_SPEED = 36;

const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};

// ---------------- state ----------------
const g = {
  elapsed: 0,
  crop: 'wheat' as Crop,
  field: createField(),
  harvestCells: 0,
  year: 1,
  rig: 'cultivate' as Rig,
  job: 'cultivate' as Job,
  lastJob: 'cultivate' as Job,
  v: { x: DOOR_X + 130, y: DOOR_Y, a: 0, speed: 0 } as Vehicle,
  wheels: STRAIGHT as Wheels,
  mode: 'drive' as Mode,
  modeT: 0,
  from: null as Pose | null,
  to: null as Pose | null,
  items: machinesFor('wheat') as MachineItem[],
  car: { n: 4, sel: 0, scroll: 0 } as Carousel,
  pendingPick: false,
  next: null as Job | null,
  status: '',
  door: 0,
  roof: 1,
  spin: 0,
  outing: 0,
  still: 0,
  driven: 0,
  growAcc: 0,
  lastWork: null as { x: number; y: number } | null,
  pilot: null as Pilot | null,
  lanesAlpha: 0.35,
  menuAcc: 0,
  cardAcc: 1000,   // so the field card and season pill paint on the first frame
  clock: 0,
  wind: createWind(),
  birds: createBirds(),
};

const saved = decodeSnapshot(store.get(SAVE_KEY));
if (saved) {
  g.elapsed = saved.elapsed; g.crop = saved.crop; g.field = saved.field; g.year = seasonAt(saved.elapsed).year;
  g.harvestCells = saved.harvested * 60;
  g.rig = saved.machine.rig; g.job = saved.machine.job; g.lastJob = saved.machine.job;
  g.v = { x: saved.machine.x, y: saved.machine.y, a: saved.machine.a, speed: 0 };
  g.items = machinesFor(g.crop);
}
// the sheep, hens and dog round the barn; the flock starts out on the field when the game opens in winter
const animals = createAnimals(seasonAt(g.elapsed).season);

// ---------------- canvas & layers ----------------
const stage = document.getElementById('stage')!;
const cv = document.getElementById('field') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const bg = document.createElement('canvas');
const bgx = bg.getContext('2d')!;
const soil = new SoilLayer();
soil.paintAll(g.field);
let scale = 1, bgKey = '';

function resize(): void {
  const s = Math.min(2, Math.max(1, (stage.clientWidth * (window.devicePixelRatio || 1)) / W));
  if (Math.abs(s - scale) < 0.01 && cv.width === Math.round(W * s) && bg.width === cv.width) return;
  scale = s;
  for (const c of [cv, bg]) { c.width = Math.round(W * s); c.height = Math.round(H * s); }
  bgKey = '';
}
window.addEventListener('resize', resize);
resize();

// ---------------- sound ----------------
const audio = new Ambience(store.get(MUTE_KEY) === '1');
audio.chirpPan = () => chirpPan(g.birds, season());
const muteBtn = document.getElementById('mute') as HTMLButtonElement;
const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>';
function paintMute(): void {
  muteBtn.innerHTML = audio.muted ? ICON_OFF : ICON_ON;
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  muteBtn.title = audio.muted ? 'Sound off' : 'Sound on';
}
muteBtn.addEventListener('click', () => { audio.start(); audio.setMuted(!audio.muted); store.set(MUTE_KEY, audio.muted ? '1' : '0'); paintMute(); muteBtn.blur(); });
paintMute();

// The stage takes the keyboard on load. When the browser keeps keys elsewhere (the tab opened
// in the background, or focus left in the address bar), the hint says to click the field first.
stage.focus({ preventScroll: true });
const hint = document.getElementById('hint')!;
const DRIVE_HINT = hint.textContent ?? '';
let hinted = !!store.get(HINT_KEY);
function paintHint(): void {
  const away = !document.hasFocus();
  hint.textContent = away ? 'Click the field, then drive with the arrow keys' : DRIVE_HINT;
  hint.classList.toggle('gone', hinted && !away);
}
function hideHint(): void { if (!hinted) { hinted = true; store.set(HINT_KEY, '1'); paintHint(); } }
window.addEventListener('focus', paintHint);
window.addEventListener('blur', paintHint);
paintHint();

// ---------------- driving settings ----------------
const settings: Settings = decodeSettings(store.get(SETTINGS_KEY));
const toast = document.createElement('div');
toast.className = 'hint-card gone'; toast.setAttribute('role', 'status');
stage.append(toast);
let toastT = 0;
/** A short card at the top naming a change made with a key; the first-run hint steps aside meanwhile. */
function say(text: string): void { toast.textContent = text; toast.classList.remove('gone'); hint.classList.add('gone'); toastT = 1600; }
function setSettings(next: Partial<Settings>): void {
  Object.assign(settings, next);
  store.set(SETTINGS_KEY, encodeSettings(settings));
  g.pilot = null;
  cluster.render(settings);
}
function setPace(i: number): void { setSettings({ pace: paceStep(i, 0) }); say(`Pace ${PACE_LABELS[settings.pace]}`); }
function setToggle(t: Toggle, on: boolean): void { setSettings({ [t]: on }); say(`${TOGGLES.find((x) => x.key === t)!.name} ${on ? 'on' : 'off'}`); }
// the dashboard cluster gives the keyboard back to the field after a click
const cluster = new DashboardCluster(stage, {
  pace: (i) => { setPace(i); stage.focus({ preventScroll: true }); },
  toggle: (t, on) => { setToggle(t, on); stage.focus({ preventScroll: true }); },
});
cluster.render(settings);
const seasonPill = new SeasonPill(stage);
// what is planted; folding it leaves the driving plan alone
const fieldCard = new FieldCard(stage, (fieldFolded) => {
  settings.fieldFolded = fieldFolded; store.set(SETTINGS_KEY, encodeSettings(settings));
  fieldCard.setFolded(fieldFolded); stage.focus({ preventScroll: true });
});
fieldCard.setFolded(settings.fieldFolded);
fieldCard.render(g.field, g.elapsed);

// ---------------- the barn ----------------
const menu = new BarnMenu(stage, {
  turn: (d) => { if (g.mode === 'menu') { g.car = turn(g.car, d); refreshMenu(); } },
  select: (i) => { if (g.mode === 'menu') { if (i === g.car.sel) pick(); else { g.car = select(g.car, i); refreshMenu(); } } },
  crop: (c) => setCrop(c),
  driveOut: () => pick(),
});

const season = () => seasonAt(g.elapsed).season;
const itemIndex = (job: Job) => Math.max(0, g.items.findIndex((m) => m.job === job));

function refreshMenu(): void {
  const s = season(), sum = summarize(g.field, g.crop);
  g.next = nextUp(s, sum);
  g.status = statusLine(s, sum, g.crop);
  menu.render({ season: s, crop: g.crop, status: g.status, items: g.items, sel: g.car.sel, next: g.next, lastJob: g.lastJob });
}

function setCrop(c: Crop): void {
  if (g.mode !== 'menu' || c === g.crop) return;
  g.crop = c; g.items = machinesFor(c);
  refreshMenu();
}

function startParking(): void {
  g.mode = 'parking'; g.modeT = 0; g.lastJob = g.job;
  g.items = machinesFor(g.crop);
  g.car = { n: g.items.length, sel: itemIndex(g.job), scroll: itemIndex(g.job) };
  g.from = { x: g.v.x, y: g.v.y, a: g.v.a };
  g.to = { x: parkX(g.rig) + 2 * rigMid(g.rig), y: DOOR_Y, a: Math.PI };
  g.v.speed = 0; g.pilot = null; held.clear(); hideHint();
}

function openMenu(): void {
  g.mode = 'menu'; g.modeT = 0; g.pendingPick = false; g.outing = 0;
  g.v = { x: parkX(g.rig), y: DOOR_Y, a: 0, speed: 0 }; g.wheels = STRAIGHT;
  refreshMenu(); menu.open(); fieldCard.tuck(true);
}

function pick(): void {
  if (g.mode !== 'menu') return;
  if (!settled(g.car)) { g.pendingPick = true; return; }
  const m = g.items[g.car.sel];
  g.rig = m.rig; g.job = m.job; g.outing = 0;
  menu.close(); fieldCard.tuck(false);
  g.mode = 'leaving'; g.modeT = 0;
  g.from = { x: parkX(m.rig), y: DOOR_Y, a: 0 };
  g.to = { x: DOOR_X + 24 - EXT[m.rig][0] * SCALE, y: DOOR_Y, a: 0 };
  g.v = { ...g.from, speed: 0 };
  held.clear(); save();
  stage.focus({ preventScroll: true });
}

// ---------------- input ----------------
const held = new Set<Control>();
window.addEventListener('keydown', (e) => {
  audio.start();
  const onButton = e.target instanceof HTMLButtonElement;
  const k = controlFor(e.key, e.code);
  const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
  if (plain && (e.key === '-' || e.key === '=' || e.key === '+')) { e.preventDefault(); setPace(paceStep(settings.pace, e.key === '-' ? -1 : 1)); return; }
  const toggle = plain && TOGGLES.find((t) => t.letter === e.key.toUpperCase());
  if (toggle) { e.preventDefault(); if (!e.repeat) setToggle(toggle.key, !settings[toggle.key]); return; }
  if (g.mode === 'menu') {
    if (k === 'up') { e.preventDefault(); g.car = turn(g.car, -1); refreshMenu(); }
    else if (k === 'down') { e.preventDefault(); g.car = turn(g.car, 1); refreshMenu(); }
    else if (k === 'left' || k === 'right') { e.preventDefault(); const i = CROPS.indexOf(g.crop) + (k === 'left' ? -1 : 1); setCrop(CROPS[(i + CROPS.length) % CROPS.length]); }
    else if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); pick(); }
    return;
  }
  if (k) { e.preventDefault(); held.add(k); }
});
window.addEventListener('keyup', (e) => { const k = controlFor(e.key, e.code); if (k) held.delete(k); });
window.addEventListener('blur', () => held.clear());
window.addEventListener('pointerdown', (e) => {
  audio.start();
  // a click anywhere on the farm gives it the keyboard, unless a button wants it
  if (!(e.target instanceof HTMLButtonElement)) stage.focus({ preventScroll: true });
});

cv.addEventListener('click', (e) => {
  if (g.mode !== 'menu') return;
  const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * W) / r.width / ZOOM, y = ((e.clientY - r.top) * H) / r.height / ZOOM;
  if (!insideBarn(x, y)) return;
  let best = -1, bd = 1e9;
  g.items.forEach((_, i) => { const d = Math.abs(DOOR_Y + shortest(g.car.scroll, i, g.car.n) * SLOT - y); if (d < bd) { bd = d; best = i; } });
  if (best < 0 || bd > 60) return;
  if (best === g.car.sel) pick(); else { g.car = select(g.car, best); refreshMenu(); }
});

// ---------------- saving ----------------
function save(): void {
  const at = g.mode === 'leaving' ? g.to! : g.v;
  store.set(SAVE_KEY, encodeSnapshot({
    elapsed: g.elapsed, crop: g.crop, field: g.field, harvested: Math.floor(g.harvestCells / 60),
    inBarn: g.mode === 'parking' || g.mode === 'spin' || g.mode === 'menu',
    machine: { x: at.x, y: at.y, a: at.a, rig: g.rig, job: g.job },
  }));
}
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

if (saved?.inBarn) {
  g.items = machinesFor(g.crop);
  g.car = { n: g.items.length, sel: itemIndex(g.job), scroll: itemIndex(g.job) };
  g.roof = 0.1;
  openMenu();
}

// ---------------- the loop ----------------
function lerpPose(a: Pose, b: Pose, k: number): Pose {
  let da = b.a - a.a; da = Math.atan2(Math.sin(da), Math.cos(da));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: a.a + da * k };
}

function update(dt: number): { label: string; working: boolean } {
  const s = dt / 1000;
  g.elapsed += dt; g.modeT += dt; g.clock += dt;
  const info = seasonAt(g.elapsed);
  if (info.year !== g.year) { g.year = info.year; g.harvestCells = 0; }
  g.growAcc += dt;
  stepWind(g.wind, dt, info.season);
  if (g.growAcc >= 250) { grow(g.field, g.growAcc, info.season); g.growAcc = 0; }
  let label = 'In the barn', working = false, steer = 0;
  const was = { x: g.v.x, y: g.v.y }, wasMode = g.mode;
  const item = g.items.find((m) => m.job === g.job && m.rig === g.rig) ?? machinesFor(g.crop).find((m) => m.rig === g.rig);
  if (g.mode === 'drive') {
    // a faster pace runs the machine's own clock faster: same turning circle, sooner; the frame's
    // machine time runs in short fixed steps, so steering and the worked strip match 60 fps at any pace
    const { n, h } = subSteps(s * PACES[settings.pace]);
    for (let k = 0; k < n; k++) {
      const c = { up: held.has('up'), down: held.has('down'), left: held.has('left'), right: held.has('right') };
      // Auto-steer drives while ↑ is held, gears and all, so it can back round at the headland; let go
      // and it only steers while the machine rolls to a stop, keeping its place for when ↑ comes back.
      // ← → or backing up by hand take over.
      if (!settings.auto || c.left || c.right || (c.down && !c.up)) g.pilot = null;
      else if (c.up || g.v.speed !== 0) {
        const a = autoSteer(g.v, g.pilot ?? pilotFrom(g.v), workOffset(g.rig));
        g.pilot = a.pilot;
        if (a.pilot.engaged) { c.left = a.left; c.right = a.right; if (c.up) { c.up = a.up; c.down = a.down; } }
      }
      steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      g.v = step(g.v, c, h);
      if (settings.hold) g.v = laneHold(g.v, c, h);
      if (Math.abs(g.v.speed) > 1) { g.driven += s / n; if (g.driven > 10) hideHint(); }
      const off = workOffset(g.rig), ix = g.v.x + Math.cos(g.v.a) * off, iy = g.v.y + Math.sin(g.v.a) * off;
      const onField = ix > FIELD.x && ix < FIELD.x + FIELD.w && iy > FIELD.y && iy < FIELD.y + FIELD.h;
      if (g.v.speed > 1 && onField) {
        working = true;
        // sweep from where the implement was last step, so a long step never leaves a gap
        const p0 = g.lastWork && Math.hypot(ix - g.lastWork.x, iy - g.lastWork.y) < 12 ? g.lastWork : { x: ix, y: iy };
        const steps = Math.max(1, Math.ceil(Math.hypot(ix - p0.x, iy - p0.y)));
        for (let j = 1; j <= steps; j++) {
          const r = workStrip(g.field, p0.x + ((ix - p0.x) * j) / steps, p0.y + ((iy - p0.y) * j) / steps, g.v.a, WORK_HALF, g.job, g.crop);
          for (const i of r.changed) soil.paint(g.field, i);
          g.harvestCells += r.harvested; g.outing += r.harvested;
        }
        g.lastWork = { x: ix, y: iy };
      } else g.lastWork = null;
    }
    label = working && item ? item.label : item?.name ?? 'Driving';
    if (insideBarn(g.v.x, g.v.y) && Math.abs(g.v.speed) < 3) { g.still += s; if (g.still > 0.4) startParking(); } else g.still = 0;
  } else if (g.mode === 'parking') {
    g.v = { ...lerpPose(g.from!, g.to!, ease(Math.min(1, g.modeT / PARK_MS))), speed: 0 };
    if (g.modeT >= PARK_MS) { g.mode = 'spin'; g.modeT = 0; }
  } else if (g.mode === 'spin') {
    g.spin = ease(Math.min(1, g.modeT / SPIN_MS));
    if (g.modeT >= SPIN_MS + 250) { g.spin = 0; openMenu(); }
  } else if (g.mode === 'menu') {
    g.menuAcc += dt;
    if (g.menuAcc > 1500) { g.menuAcc = 0; refreshMenu(); }
    if (g.pendingPick && settled(g.car)) { g.pendingPick = false; pick(); }
  } else if (g.mode === 'leaving') {
    label = 'Leaving the barn';
    const dur = ((g.to!.x - g.from!.x) / ROLL_SPEED) * 1000;
    g.v = { ...lerpPose(g.from!, g.to!, ease(Math.min(1, g.modeT / dur))), speed: 0 };
    if (g.modeT >= dur) { g.mode = 'drive'; g.modeT = 0; g.still = 0; }
  }

  // the tyres follow the machine itself: they roll only while it moves, backwards when it reverses
  const rolling = g.mode === wasMode && (g.mode === 'drive' || g.mode === 'parking' || g.mode === 'leaving');
  g.wheels = turnWheels(g.wheels, steer, rolling ? rolled(was, g.v, g.v.a) / SCALE : 0, s);

  g.car = easeCarousel(g.car, dt);
  const near = Math.hypot(g.v.x - DOOR_X, g.v.y - DOOR_Y) < 210;
  const doorOpen = g.mode === 'parking' || g.mode === 'leaving' || (g.mode === 'drive' && near);
  g.door += Math.sign(+doorOpen - g.door) * Math.min(Math.abs(+doorOpen - g.door), dt / 900);
  const inside = g.mode !== 'drive' || (g.v.x < DOOR_X + 10 && g.v.y > BARN.y && g.v.y < BARN.y + BARN.h);
  const roof = inside ? 0.1 : 1;
  g.roof += Math.sign(roof - g.roof) * Math.min(Math.abs(roof - g.roof), dt / 800);
  // lane lines brighten while you drive on the field and settle back when you stop
  const onTheField = g.mode === 'drive' && Math.abs(g.v.speed) > 1 && g.v.x > FIELD.x - 80 && g.v.x < FIELD.x + FIELD.w + 80;
  g.lanesAlpha += ((onTheField ? 1 : 0.35) - g.lanesAlpha) * Math.min(1, dt / 500);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) { toast.classList.add('gone'); paintHint(); } }

  g.cardAcc += dt;
  if (g.cardAcc >= 1000) {
    g.cardAcc = 0;
    fieldCard.render(g.field, g.elapsed);
    seasonPill.render(season(), label, Math.floor(g.harvestCells / 60), seasonClock(g.elapsed));
  }

  const off = workOffset(g.rig);
  updateBirds(g.birds, { season: info.season, working, tines: { x: g.v.x + Math.cos(g.v.a) * off, y: g.v.y + Math.sin(g.v.a) * off }, v: g.v, rig: g.rig }, dt);
  updateAnimals(animals, { season: info.season, v: g.v, rig: g.rig, driving: g.mode === 'drive' }, dt);

  const engine = g.mode === 'drive' ? Math.abs(g.v.speed) / MAX_SPEED : g.mode === 'parking' || g.mode === 'leaving' ? 0.3 : 0;
  audio.update(s, engine, info.season, gustAt(g.wind, g.v.x));
  return { label, working };
}

function drawMachine(c: Ctx, rig: Rig, p: Pose, t: number, working: boolean, wheels: Wheels = STRAIGHT): void {
  c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(SCALE, SCALE);
  drawRig(c, rig, t, RIG_W, Math.min(1, g.outing / 1500), working, wheels); c.restore();
}

function render(working: boolean): void {
  const t = g.clock, blend = seasonBlend(g.elapsed);
  const key = `${blend.from}>${blend.to}:${blend.k.toFixed(2)}:${scale}`;
  const z = scale * ZOOM;
  if (key !== bgKey) { bgx.setTransform(z, 0, 0, z, 0, 0); renderBackground(bgx, blend); bgKey = key; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(z, 0, 0, z, 0, 0);   // the world, in world units
  drawField(ctx, soil, g.field, t);
  if (settings.lanes) drawLaneLines(ctx, g.lanesAlpha);
  // with the guides on, auto-steer shows the way it will drive
  if (settings.lanes && g.pilot?.engaged && g.mode === 'drive') {
    const off = workOffset(g.rig);
    drawRoute(ctx, routeAhead(g.v, g.pilot, off), { x: g.v.x + Math.cos(g.v.a) * off, y: g.v.y + Math.sin(g.v.a) * off }, g.lanesAlpha);
  }

  drawGroundBirds(ctx, g.birds);
  drawAnimals(ctx, animals, blend, season());

  // inside the barn: floor, turntable and the parked machines on the carousel
  barnFloor(ctx, g.spin * Math.PI);
  const n = g.items.length, spread = SLOT + 34 * Math.sin(Math.PI * g.spin);
  ctx.save(); ctx.beginPath(); ctx.rect(BARN.x, BARN.y, BARN.w, BARN.h); ctx.clip();
  g.items.forEach((m, i) => {
    if (g.mode !== 'menu' && m.job === g.job) return;   // that one is out, or arriving
    const off = shortest(g.car.scroll, i, n) * (g.mode === 'spin' && i !== g.car.sel ? spread : SLOT);
    const alpha = Math.max(0, Math.min(1, (230 - Math.abs(off)) / 60));
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; drawMachine(ctx, m.rig, { x: parkX(m.rig), y: DOOR_Y + off, a: 0 }, t, false); ctx.restore();
  });
  ctx.restore();

  if (g.mode === 'spin') {
    const mid = rigMid(g.rig);
    ctx.save(); ctx.translate(parkX(g.rig) + mid, DOOR_Y); ctx.rotate(Math.PI + g.spin * Math.PI); ctx.translate(-mid, 0); ctx.scale(SCALE, SCALE);
    drawRig(ctx, g.rig, t, RIG_W, Math.min(1, g.outing / 1500), false, g.wheels); ctx.restore();
  } else if (g.mode !== 'menu') drawMachine(ctx, g.rig, g.v, t, working, g.wheels);

  barnRoof(ctx, g.roof, g.door, t);
  // the weather overhead: cloud shadows fall over everything, and the wind carries what the hedges let go
  const winter = (blend.from === 'winter' ? 1 - blend.k : 0) + (blend.to === 'winter' ? blend.k : 0);
  drawCloudShadows(ctx, g.wind, winter);
  drawBlown(ctx, g.wind);
  drawFlyingBirds(ctx, g.birds, (blend.from === 'summer' ? 1 - blend.k : 0) + (blend.to === 'summer' ? blend.k : 0));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);   // weather, in view units
  drawSnow(ctx, t, winter);
  cluster.updateSpeed(g.v.speed);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(50, now - last); last = now;
  const { working } = update(dt);
  render(working);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
