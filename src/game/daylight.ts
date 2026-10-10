// Time of day: the farm's light follows the player's own clock. A soft dawn, clear daylight, a golden
// evening and a moonlit blue night that stays readable; the barn lamp and the machine's lights come
// on at dusk. Nothing here touches the field or the machine, and it sets nothing to do.

/** How the light falls at one hour of the day. */
export interface Light {
  /** The colour laid over the farm with a multiply, `mul` strong (0 by day). */
  tint: string;
  mul: number;
  /** A warm soft-light glow, strongest in the golden evening. */
  warm: number;
  /** 0 by day, 1 through the night: how far the farm has settled, and how bright its lamps are. */
  dark: number;
}

// hour, tint, multiply strength, warm glow, dark
type Key = [number, string, number, number, number];
const KEYS: readonly Key[] = [
  [0, '#6c82c2', 0.56, 0, 1], [4.6, '#6c82c2', 0.56, 0, 1], [5.7, '#c7a8c3', 0.36, 0.08, 0.7], [6.7, '#f1d6c6', 0.16, 0.12, 0.1],
  [8, '#fff4e6', 0.04, 0.04, 0], [16.4, '#fff4e6', 0, 0.02, 0], [18, '#f6cf9e', 0.12, 0.2, 0], [19.2, '#eab48e', 0.22, 0.24, 0.25],
  [20.2, '#b2a2d2', 0.4, 0.06, 0.8], [21.5, '#7188c8', 0.52, 0, 1], [24, '#6c82c2', 0.56, 0, 1],
];
/** The night is never darker than this: the multiply is at most this strong. */
export const NIGHT_MUL = 0.56;
/** Past this much `dark`, the animals and birds keep to their night ways. */
export const SETTLED = 0.5;

/** The hour on the player's clock, 0..24, with minutes and seconds as fractions. */
export const hourOf = (d: Date): number => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, k: number): string => {
  const A = hex(a), B = hex(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
};

/** The light at an hour of the day, eased between the keys above. */
export function lightAt(hour: number): Light {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (KEYS[i + 1][0] < h) i++;
  const [h0, c0, m0, w0, d0] = KEYS[i], [h1, c1, m1, w1, d1] = KEYS[i + 1], k = (h - h0) / (h1 - h0);
  return { tint: mixHex(c0, c1, k), mul: m0 + (m1 - m0) * k, warm: w0 + (w1 - w0) * k, dark: d0 + (d1 - d0) * k };
}

/** True once it is dark enough that the hens roost, the sheep lie down and the gulls stay away. */
export const afterDusk = (dark: number): boolean => dark > SETTLED;
