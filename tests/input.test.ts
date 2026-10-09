import { describe, expect, it } from 'vitest';
import { controlFor } from '../src/game/input';

describe('arrow keys', () => {
  it('maps the standard key names', () => {
    expect(controlFor('ArrowUp', 'ArrowUp')).toBe('up');
    expect(controlFor('ArrowDown', 'ArrowDown')).toBe('down');
    expect(controlFor('ArrowLeft', 'ArrowLeft')).toBe('left');
    expect(controlFor('ArrowRight', 'ArrowRight')).toBe('right');
  });

  it('accepts legacy key names and falls back to the physical key', () => {
    expect(controlFor('Up', '')).toBe('up');
    expect(controlFor('Left', '')).toBe('left');
    expect(controlFor('Unidentified', 'ArrowRight')).toBe('right');
    expect(controlFor('', 'ArrowDown')).toBe('down');
  });

  it('ignores other keys', () => {
    expect(controlFor('a', 'KeyA')).toBeNull();
    expect(controlFor('Enter', 'Enter')).toBeNull();
  });
});
