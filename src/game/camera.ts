// The camera over the farm: where the view looks and how close. `x, y` is the middle of the view in
// world units; `zoom` 1 is the whole farm, as the game has always shown it, and 2 shows half as much,
// twice as large. Pure numbers, no DOM.
import { H, W, WORLD_H, WORLD_W, ZOOM } from './constants';

export interface Cam { x: number; y: number; zoom: number }

/** The whole farm, as the game has always shown it. */
export const HOME: Readonly<Cam> = { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
export const MAX_ZOOM = 4;

/** View pixels per world unit. */
export const pxPerUnit = (c: Cam): number => ZOOM * c.zoom;

/** Keep the view on the farm: never past its edges, never wider than the whole farm, never closer than MAX_ZOOM. */
export function clampCam(c: Cam): Cam {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom)), k = ZOOM * zoom, hw = W / k / 2, hh = H / k / 2;
  return { zoom, x: Math.min(WORLD_W - hw, Math.max(hw, c.x)), y: Math.min(WORLD_H - hh, Math.max(hh, c.y)) };
}

/** A point in the view (view pixels, 0..W by 0..H) on the farm, and back. */
export function toWorld(c: Cam, vx: number, vy: number): { x: number; y: number } {
  const k = pxPerUnit(c);
  return { x: c.x + (vx - W / 2) / k, y: c.y + (vy - H / 2) / k };
}
export function toView(c: Cam, x: number, y: number): { x: number; y: number } {
  const k = pxPerUnit(c);
  return { x: W / 2 + (x - c.x) * k, y: H / 2 + (y - c.y) * k };
}

/** The canvas transform that draws world units through the camera; `scale` is device pixels per view pixel. */
export function worldTransform(c: Cam, scale: number): [number, number, number, number, number, number] {
  const k = scale * pxPerUnit(c);
  return [k, 0, 0, k, (scale * W) / 2 - c.x * k, (scale * H) / 2 - c.y * k];
}

/**
 * A camera on its way somewhere: it eases out, eases in and never overshoots (a critically damped
 * spring, as in Unity's SmoothDamp), on the middle and on the log of the zoom, so zooming in and out
 * feel alike. The goal may move every frame; the camera simply keeps gliding after it.
 */
export interface Glide { cam: Cam; vx: number; vy: number; vz: number }
export const glideFrom = (cam: Readonly<Cam>): Glide => ({ cam: { ...cam }, vx: 0, vy: 0, vz: 0 });

function damp(cur: number, goal: number, vel: number, time: number, dt: number): [number, number] {
  const w = 2 / Math.max(0.0001, time), x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const d = cur - goal, t = (vel + w * d) * dt;
  return [goal + (d + t) * e, (vel - w * t) * e];
}

/** One frame (dt in seconds) of gliding toward `goal`; `pan` and `zoomTime` are about how long the glide takes, in seconds. */
export function glide(g: Glide, goal: Readonly<Cam>, dt: number, pan = 0.55, zoomTime = pan): void {
  [g.cam.x, g.vx] = damp(g.cam.x, goal.x, g.vx, pan, dt);
  [g.cam.y, g.vy] = damp(g.cam.y, goal.y, g.vy, pan, dt);
  let z: number;
  [z, g.vz] = damp(Math.log(g.cam.zoom), Math.log(goal.zoom), g.vz, zoomTime, dt);
  g.cam.zoom = Math.exp(z);
}

/** True once the glide has as good as arrived: within half a world unit, and a fifth of a percent of the zoom. */
export const arrived = (g: Glide, goal: Readonly<Cam>): boolean =>
  Math.abs(g.cam.x - goal.x) < 0.5 && Math.abs(g.cam.y - goal.y) < 0.5 && Math.abs(g.cam.zoom / goal.zoom - 1) < 0.002;
