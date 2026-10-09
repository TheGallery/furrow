/** The barn carousel: `sel` is the machine facing the door, `scroll` eases toward it and wraps. */
export interface Carousel {
  n: number;
  sel: number;
  scroll: number;
}

export const wrap = (v: number, n: number) => ((v % n) + n) % n;

/** Signed shortest step from `from` to `to` around a ring of n. */
export function shortest(from: number, to: number, n: number): number {
  let d = wrap(to - from, n);
  if (d > n / 2) d -= n;
  return d;
}

export function turn(c: Carousel, d: number): Carousel {
  return { ...c, sel: wrap(c.sel + d, c.n) };
}

export function select(c: Carousel, i: number): Carousel {
  return { ...c, sel: wrap(i, c.n) };
}

/** Ease the visible position toward the selection; `tau` is the easing time constant in ms. */
export function ease(c: Carousel, dt: number, tau = 260): Carousel {
  const d = shortest(c.scroll, c.sel, c.n);
  return { ...c, scroll: wrap(c.scroll + d * Math.min(1, dt / tau), c.n) };
}

export const settled = (c: Carousel) => Math.abs(shortest(c.scroll, c.sel, c.n)) < 0.04;
