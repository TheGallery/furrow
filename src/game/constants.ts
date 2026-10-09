// Logical canvas size (the view); the canvas is scaled to fit the window.
export const W = 1280;
export const H = 720;

// How large the world is drawn: screen pixels per world unit. Machines, implements, the barn,
// plants, lanes and speeds are all in world units, so this one number sets the scale of the
// farm. At 1 the view holds the original six-lane field; at 0.5 everything is drawn half size
// and the same pane holds a field about twice as long and twice as deep.
export const ZOOM = 0.5;
export const WORLD_W = W / ZOOM;
export const WORLD_H = H / ZOOM;

// Machines are drawn at this scale; implements cover about one approved "lane".
export const SCALE = 1.5;
export const LANE_H = 520 / 6;
export const IMPLEMENT_WIDTH = LANE_H * 0.92;
export const RIG_W = IMPLEMENT_WIDTH / SCALE;

// The red barn on the left, its roll-up door facing the middle of the field.
const BARN_W = 226, BARN_H = 448;
export const BARN_X = 14 / ZOOM;
export const DOOR_X = BARN_X + BARN_W;

// The one continuous field, filling the view from the barn's yard to the right-hand hedge.
// Soil state is kept on a fine grid (two screen pixels a cell) the player never sees.
export const CELL = 2 / ZOOM;
export const LANES = Math.round(520 / ZOOM / LANE_H);
const FIELD_X = DOOR_X + 160;
export const FIELD = {
  x: FIELD_X,
  y: 110 / ZOOM,
  w: Math.floor((1180 / ZOOM - FIELD_X) / CELL) * CELL,
  h: LANES * LANE_H,
  r: 46,
} as const;
export const COLS = Math.round(FIELD.w / CELL);
export const ROWS = Math.floor(FIELD.h / CELL);

export const DOOR_Y = Math.round(FIELD.y + FIELD.h / 2);
export const DOOR_TOP = DOOR_Y - 52;
export const DOOR_BOTTOM = DOOR_Y + 52;
export const BARN = { x: BARN_X, y: DOOR_Y - BARN_H / 2, w: BARN_W, h: BARN_H } as const;

export const SEASON_MS = 5 * 60 * 1000;
