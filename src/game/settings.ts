import { PACES } from './driving';

export const SETTINGS_KEY = 'furrow.settings';
/** Saves before this version wrote `fieldFolded:false` on every change, not as the player's choice. */
const SETTINGS_VERSION = 2;

/** Driving settings the player chooses; remembered in the browser like the mute choice. */
export interface Settings {
  /** Index into PACES. */
  pace: number;
  lanes: boolean;
  hold: boolean;
  auto: boolean;
  /** The field card folded to one line. */
  fieldFolded: boolean;
}

export const DEFAULT_SETTINGS: Settings = { pace: 0, lanes: true, hold: true, auto: false, fieldFolded: true };

export function decodeSettings(text: string | null): Settings {
  let d: unknown;
  try { d = JSON.parse(text ?? ''); } catch { return { ...DEFAULT_SETTINGS }; }
  if (!d || typeof d !== 'object') return { ...DEFAULT_SETTINGS };
  const o = d as Record<string, unknown>;
  // older saves also carry the driving card's `folded` flag; the dashboard never folds, so it is dropped
  const flag = (k: 'lanes' | 'hold' | 'auto' | 'fieldFolded') => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_SETTINGS[k]);
  // older saves start with the field card folded once; its saved state was never the player's choice
  const fieldFolded = o.v === SETTINGS_VERSION ? flag('fieldFolded') : DEFAULT_SETTINGS.fieldFolded;
  const pace = Number.isInteger(o.pace) && (o.pace as number) >= 0 && (o.pace as number) < PACES.length ? (o.pace as number) : DEFAULT_SETTINGS.pace;
  return { pace, lanes: flag('lanes'), hold: flag('hold'), auto: flag('auto'), fieldFolded };
}

export const encodeSettings = (s: Settings): string => JSON.stringify({ v: SETTINGS_VERSION, ...s });
