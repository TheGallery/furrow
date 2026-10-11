import type { Target } from '../game/follow';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A name in bold, then what it is up to, quieter. */
function named(name: string, doing: string): [HTMLElement, HTMLElement] {
  const b = document.createElement('b'), span = document.createElement('span');
  b.textContent = name; span.textContent = doing;
  return [b, span];
}

/**
 * Following, on screen. A chip at the top middle, where the hint card sits, says what is followed,
 * with Esc and a × to come back; it also says when the thing has gone, or that steering by hand
 * brought the whole farm back. A name tag sits over whatever is under the pointer, and a hidden live
 * region tells screen readers what changed.
 */
export class FollowView {
  private readonly chip: HTMLElement;
  private readonly chipText: HTMLElement;
  private readonly tag: HTMLElement;
  private readonly live: HTMLElement;
  private chipKey = '';
  private tagKey = '';

  constructor(stage: HTMLElement, onClose: () => void) {
    this.chip = document.createElement('div');
    this.chip.className = 'follow-chip gone';
    this.chip.innerHTML = '<span class="fw-text"></span><kbd>Esc</kbd><button type="button" class="fw-x" aria-label="Stop following">×</button>';
    this.chipText = this.chip.querySelector('.fw-text')!;
    this.chip.querySelector('button')!.addEventListener('click', () => { onClose(); stage.focus({ preventScroll: true }); });
    this.tag = document.createElement('div');
    this.tag.className = 'follow-tag'; this.tag.hidden = true; this.tag.setAttribute('aria-hidden', 'true');
    this.live = document.createElement('div');
    this.live.className = 'sr-only'; this.live.setAttribute('role', 'status');
    stage.append(this.chip, this.tag, this.live);
  }

  /** "Following the dog · pacing you along the verge", with Esc and ×. */
  following(t: Target): void {
    this.paintChip(`f:${t.name}:${t.doing}`, true, () => this.chipText.replaceChildren('Following ', ...named(t.name, ` · ${t.doing}`)));
  }

  /** A plain line in the chip: the thing has gone (still with Esc and ×), or a note on its own. */
  note(text: string, close: boolean): void {
    this.paintChip(`n:${text}:${close}`, close, () => { this.chipText.textContent = text; });
  }

  hideChip(): void {
    if (this.chipKey === '') return;
    this.chipKey = ''; this.chip.classList.add('gone');
  }

  /** The name tag over a thing under the pointer, at (x, y) in view pixels of a W × H view. */
  showTag(t: Target, x: number, y: number, w: number, h: number): void {
    const key = `${t.name}:${t.doing}`;
    if (key !== this.tagKey) { this.tagKey = key; this.tag.replaceChildren(...named(cap(t.name), ` ${t.doing}`)); }
    this.tag.hidden = false;
    this.tag.style.left = `${(x / w) * 100}%`; this.tag.style.top = `${(y / h) * 100}%`;
  }

  hideTag(): void { this.tag.hidden = true; }

  /** Tell screen readers what changed. */
  announce(text: string): void { this.live.textContent = text; }

  private paintChip(key: string, close: boolean, fill: () => void): void {
    if (key === this.chipKey) return;
    this.chipKey = key; fill();
    this.chip.classList.toggle('bare', !close);
    this.chip.classList.remove('gone');
  }
}
