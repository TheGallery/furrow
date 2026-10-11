// The marks for following, over the world in world units: a soft cream ring round what is under the
// pointer, and a brighter one that widens and fades when something is picked.
import type { Target } from '../game/follow';
import type { Ctx } from './palette';

/** A cream ring round a target's hit shape, with a darker halo so it reads on pale ground; `px` is one view pixel in world units. */
export function drawRing(ctx: Ctx, t: Target, px: number, alpha: number, grow = 0): void {
  const R = t.r + (5 + grow) * px, c = Math.cos(t.a), s = Math.sin(t.a);
  ctx.beginPath();
  if (t.back + t.front > 0) {
    const ax = t.x - c * t.back, ay = t.y - s * t.back, bx = t.x + c * t.front, by = t.y + s * t.front;
    ctx.arc(bx, by, R, t.a - Math.PI / 2, t.a + Math.PI / 2); ctx.arc(ax, ay, R, t.a + Math.PI / 2, t.a + (3 * Math.PI) / 2); ctx.closePath();
  } else ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.lineWidth = 4.5 * px; ctx.strokeStyle = `rgba(59,64,56,${0.3 * alpha})`; ctx.stroke();
  ctx.lineWidth = 2 * px; ctx.strokeStyle = `rgba(255,250,236,${0.95 * alpha})`; ctx.stroke();
}

/** What is under the pointer gets a steady ring; something just picked gets one that widens and fades over `PICK_MS`. */
export const PICK_MS = 900;
export function drawFollowMarks(ctx: Ctx, px: number, hover: Target | null, picked: Target | null, sincePick: number): void {
  if (picked && sincePick < PICK_MS) drawRing(ctx, picked, px, Math.min(1, (PICK_MS - sincePick) / 400), (sincePick / PICK_MS) * 10);
  if (hover && hover.ref !== picked?.ref) drawRing(ctx, hover, px, 1);
}
