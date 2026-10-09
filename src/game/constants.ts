// Logical canvas size; the canvas is scaled to fit the window.
export const W = 1280;
export const H = 720;

// The one continuous field. Soil state is kept on a fine grid the player never sees.
export const FIELD = { x: 400, y: 110, w: 780, h: 520, r: 46 } as const;
export const CELL = 4;
export const COLS = FIELD.w / CELL;
export const ROWS = FIELD.h / CELL;

// Machines are drawn at this scale; implements cover about one approved "lane".
export const SCALE = 1.5;
export const LANE_H = FIELD.h / 6;
export const IMPLEMENT_WIDTH = LANE_H * 0.92;
export const RIG_W = IMPLEMENT_WIDTH / SCALE;

// The red barn on the left, its roll-up door facing the field.
export const BARN = { x: 14, y: 146, w: 226, h: 448 } as const;
export const DOOR_X = BARN.x + BARN.w;
export const DOOR_Y = 370;
export const DOOR_TOP = 318;
export const DOOR_BOTTOM = 422;

export const SEASON_MS = 5 * 60 * 1000;
