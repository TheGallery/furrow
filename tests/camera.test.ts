import { describe, expect, it } from 'vitest';
import { type Cam, HOME, MAX_ZOOM, arrived, clampCam, glide, glideFrom, toView, toWorld, worldTransform } from '../src/game/camera';
import { H, W, WORLD_H, WORLD_W, ZOOM } from '../src/game/constants';

const FRAME = 1 / 60;

/** Frames of gliding from one camera to another until it has arrived. */
function framesBetween(from: Cam, to: Cam): number {
  const g = glideFrom(from);
  let n = 0;
  while (!arrived(g, to) && n < 2000) { glide(g, to, FRAME); n++; }
  return n;
}

describe('the camera', () => {
  it('at home draws the whole farm exactly as the fixed view always has', () => {
    for (const scale of [1, 1.5, 2]) {
      const [a, b, c, d, e, f] = worldTransform(HOME, scale);
      expect([a, b, c, d]).toEqual([scale * ZOOM, 0, 0, scale * ZOOM]);
      expect(e).toBeCloseTo(0, 9);
      expect(f).toBeCloseTo(0, 9);
    }
    // and a click lands where main.ts has always put it
    const p = toWorld(HOME, 320, 540);
    expect(p.x).toBeCloseTo(320 / ZOOM);
    expect(p.y).toBeCloseTo(540 / ZOOM);
  });

  it('maps the view to the farm and back at any zoom', () => {
    for (const cam of [HOME, { x: 500, y: 300, zoom: 2.8 }, { x: 1200, y: 700, zoom: MAX_ZOOM }]) {
      for (const [vx, vy] of [[0, 0], [W / 2, H / 2], [W, H], [97, 613]]) {
        const w = toWorld(cam, vx, vy), v = toView(cam, w.x, w.y);
        expect(v.x).toBeCloseTo(vx);
        expect(v.y).toBeCloseTo(vy);
      }
      // the middle of the view is what the camera looks at, and a view pixel is ZOOM × zoom of a world unit
      const mid = toWorld(cam, W / 2, H / 2), one = toWorld(cam, W / 2 + 1, H / 2);
      expect(mid.x).toBeCloseTo(cam.x);
      expect(mid.y).toBeCloseTo(cam.y);
      expect(1 / (one.x - mid.x)).toBeCloseTo(ZOOM * cam.zoom);
    }
  });

  it('keeps the view on the farm, between the whole farm and MAX_ZOOM', () => {
    for (const c of [{ x: -500, y: -500, zoom: 3 }, { x: 5000, y: 5000, zoom: 2 }, { x: 10, y: 900, zoom: 0.5 }, { x: 800, y: 400, zoom: 9 }]) {
      const k = clampCam(c), a = toWorld(k, 0, 0), b = toWorld(k, W, H);
      expect(k.zoom).toBeGreaterThanOrEqual(1);
      expect(k.zoom).toBeLessThanOrEqual(MAX_ZOOM);
      expect(a.x).toBeGreaterThanOrEqual(-1e-9);
      expect(a.y).toBeGreaterThanOrEqual(-1e-9);
      expect(b.x).toBeLessThanOrEqual(WORLD_W + 1e-9);
      expect(b.y).toBeLessThanOrEqual(WORLD_H + 1e-9);
    }
    expect(clampCam(HOME).zoom).toBe(1);
    // a view already on the farm is left alone
    expect(clampCam({ x: 600, y: 400, zoom: 2.8 })).toEqual({ x: 600, y: 400, zoom: 2.8 });
  });

  it('glides in eased, never past the goal, and arrives within a few seconds', () => {
    const g = glideFrom(HOME), goal = { x: 520, y: 150, zoom: 2.8 };
    let t = 0, x = g.cam.x, y = g.cam.y, zoom = g.cam.zoom;
    const start = { x, y, zoom };
    while (!arrived(g, goal)) {
      glide(g, goal, FRAME); t += FRAME;
      // every step goes toward the goal and never beyond it
      expect(g.cam.x).toBeLessThanOrEqual(x + 1e-9);
      expect(g.cam.x).toBeGreaterThanOrEqual(goal.x - 1e-9);
      expect(g.cam.y).toBeLessThanOrEqual(y + 1e-9);
      expect(g.cam.y).toBeGreaterThanOrEqual(goal.y - 1e-9);
      expect(g.cam.zoom).toBeGreaterThanOrEqual(zoom - 1e-12);
      expect(g.cam.zoom).toBeLessThanOrEqual(goal.zoom + 1e-9);
      ({ x, y, zoom } = g.cam);
      // most of the way there after a second
      if (Math.abs(t - 1) < FRAME / 2) expect((start.x - g.cam.x) / (start.x - goal.x)).toBeGreaterThan(0.85);
    }
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(3);
  });

  it('zooms out as smoothly as it zooms in', () => {
    const near = { ...HOME, zoom: 2.8 };
    expect(Math.abs(framesBetween(HOME, near) - framesBetween(near, HOME))).toBeLessThanOrEqual(1);
  });

  it('starting from where it is going leaves it there exactly', () => {
    const g = glideFrom(HOME);
    for (let i = 0; i < 120; i++) glide(g, HOME, FRAME);
    expect(g.cam).toEqual(HOME);
  });
});
