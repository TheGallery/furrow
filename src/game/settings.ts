import { PACES } from './driving';

export const SETTINGS_KEY = 'furrow.settings';

/** Driving settings the player chooses; remembered in the browser like the mute choice. */
export interface Settings {
  /** Index into PACES. */
  pace: number;
  lanes: boolean;
  hold: boolean;
  auto: boolean;
}

export const DEFAULT_SETTINGS: Settings = { pace: 0, lanes: true, hold: true, auto: false };

export function decodeSettings(text: string | null): Settings {
  let d: unknown;
  try { d = JSON.parse(text ?? ''); } catch { return { ...DEFAULT_SETTINGS }; }
  if (!d || typeof d !== 'object') return { ...DEFAULT_SETTINGS };
  const o = d as Record<string, unknown>;
  const flag = (k: 'lanes' | 'hold' | 'auto') => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_SETTINGS[k]);
  const pace = Number.isInteger(o.pace) && (o.pace as number) >= 0 && (o.pace as number) < PACES.length ? (o.pace as number) : DEFAULT_SETTINGS.pace;
  return { pace, lanes: flag('lanes'), hold: flag('hold'), auto: flag('auto') };
}

export const encodeSettings = (s: Settings): string => JSON.stringify(s);
