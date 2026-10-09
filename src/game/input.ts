export type Control = 'up' | 'down' | 'left' | 'right';

const BY_KEY: Record<string, Control> = {
  ArrowUp: 'up', Up: 'up',
  ArrowDown: 'down', Down: 'down',
  ArrowLeft: 'left', Left: 'left',
  ArrowRight: 'right', Right: 'right',
};

/**
 * The control an arrow key drives. Reads `key` first and falls back to the physical `code`,
 * so older browsers ("Up") and keyboard layouts that remap `key` still steer.
 */
export function controlFor(key: string, code: string): Control | null {
  return BY_KEY[key] ?? BY_KEY[code] ?? null;
}
