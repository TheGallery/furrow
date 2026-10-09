import { PACE_LABELS } from '../game/driving';
import type { Settings } from '../game/settings';

export type Toggle = 'lanes' | 'hold' | 'auto';

/** The guide switches, their names and the key that flips each one anywhere in the game. */
export const TOGGLES: { key: Toggle; name: string; short: string; letter: string }[] = [
  { key: 'lanes', name: 'Lane lines', short: 'lines', letter: 'L' },
  { key: 'hold', name: 'Lane hold', short: 'hold', letter: 'H' },
  { key: 'auto', name: 'Auto-steer', short: 'auto-steer', letter: 'A' },
];

export interface CardHandlers {
  pace(i: number): void;
  toggle(t: Toggle, on: boolean): void;
  fold(folded: boolean): void;
}

/**
 * The folding driving card in the bottom-left corner: pace and the three guide switches.
 * Folded, its one line still shows the pace and which guides are on.
 */
export class DrivingCard {
  private readonly el: HTMLElement;
  private readonly head: HTMLButtonElement;
  private readonly sum: HTMLElement;
  private settings: Settings | null = null;
  /** Folded for a barn visit, so the carousel and the label have room; a header click still opens it. */
  private tucked = false;
  private peek = false;

  constructor(stage: HTMLElement, on: CardHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'menu driving-card';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Driving');
    this.el.innerHTML = `
      <div class="dc-body" id="dc-body">
        <div class="dc-row"><b>Pace</b><div class="dc-pace" role="group" aria-label="Pace">${PACE_LABELS.map((l, i) => `<button type="button" data-pace="${i}">${l}</button>`).join('')}</div></div>
        ${TOGGLES.map((t) => `<label class="dc-sw"><span>${t.name}</span><kbd>${t.letter}</kbd><input type="checkbox" role="switch" data-toggle="${t.key}"></label>`).join('')}
        <p class="dc-foot"><kbd>−</kbd> <kbd>=</kbd> pace · remembered next time</p>
      </div>
      <button type="button" class="dc-head" aria-controls="dc-body"><b>Driving</b><span class="dc-sum"></span><span class="dc-fold" aria-hidden="true">▾</span></button>`;
    this.head = this.el.querySelector('.dc-head')!;
    this.sum = this.el.querySelector('.dc-sum')!;
    this.head.addEventListener('click', () => {
      if (this.tucked && !this.peek && this.el.classList.contains('folded')) { this.peek = true; if (this.settings) this.render(this.settings); }
      else on.fold(!this.el.classList.contains('folded'));
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((b) => b.addEventListener('click', () => on.pace(Number(b.dataset.pace))));
    this.el.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((i) => i.addEventListener('change', () => on.toggle(i.dataset.toggle as Toggle, i.checked)));
    stage.append(this.el);
  }

  tuck(on: boolean): void {
    this.tucked = on; this.peek = false;
    if (this.settings) this.render(this.settings);
  }

  render(s: Settings): void {
    this.settings = s;
    const folded = s.folded || (this.tucked && !this.peek);
    this.el.classList.toggle('folded', folded);
    this.head.setAttribute('aria-expanded', String(!folded));
    this.el.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.pace) === s.pace)));
    this.el.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((i) => { i.checked = s[i.dataset.toggle as Toggle]; });
    this.sum.textContent = [PACE_LABELS[s.pace], ...TOGGLES.filter((t) => s[t.key]).map((t) => t.short)].join(' · ');
  }
}
