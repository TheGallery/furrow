import { PACES, PACE_LABELS } from '../game/driving';
import type { Settings } from '../game/settings';
import { MAX_SPEED } from '../game/vehicle';

export type Toggle = 'lanes' | 'hold' | 'auto';

/** The guide switches, their names and the key that flips each one anywhere in the game. */
export const TOGGLES: { key: Toggle; name: string; short: string; letter: string }[] = [
  { key: 'lanes', name: 'Lane lines', short: 'lines', letter: 'L' },
  { key: 'hold', name: 'Lane hold', short: 'hold', letter: 'H' },
  { key: 'auto', name: 'Auto-steer', short: 'auto-steer', letter: 'A' },
];

export interface ClusterHandlers {
  pace(i: number): void;
  toggle(t: Toggle, on: boolean): void;
}

/**
 * Bottom-right dashboard cluster: speed dial with needle, one-click gear-gate pace lever,
 * and guide light toggles. Stays visible in the barn; the needle rests at zero there.
 */
export class DashboardCluster {
  private readonly el: HTMLElement;
  private readonly limitArc: SVGCircleElement;
  private readonly needle: HTMLElement;
  private readonly paceLabel: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly radios: HTMLButtonElement[];
  private settings: Settings | null = null;

  constructor(stage: HTMLElement, private readonly on: ClusterHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'menu dashboard-cluster';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Driving');
    // Radios are ordered 2× / 1½× / 1× top-to-bottom, but data-pace keeps the real index.
    this.el.innerHTML = `
      <div class="dc-dial" aria-hidden="true">
        <svg viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="29" fill="none" stroke="#ece5d4" stroke-width="5" stroke-linecap="round" stroke-dasharray="121.5 182.2" transform="rotate(150 36 36)" />
          <circle class="dc-arc" cx="36" cy="36" r="29" fill="none" stroke="#6f9a6a" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 182.2" transform="rotate(150 36 36)" />
        </svg>
        <div class="dc-needle"></div>
        <div class="dc-hub"></div>
        <b class="dc-pace-label">1×</b>
      </div>
      <div class="dc-gate" role="radiogroup" aria-label="Pace">
        <div class="dc-track"><div class="dc-knob"></div></div>
        <div class="dc-radios">
          <button type="button" role="radio" data-pace="2" aria-checked="false">2×</button>
          <button type="button" role="radio" data-pace="1" aria-checked="false">1½×</button>
          <button type="button" role="radio" data-pace="0" aria-checked="false">1×</button>
        </div>
      </div>
      <span class="dc-divider" aria-hidden="true"></span>
      <div class="dc-guides">
        ${TOGGLES.map((t) => `<button type="button" class="dc-guide" role="switch" aria-checked="false" data-toggle="${t.key}" aria-keyshortcuts="${t.letter}"><i class="dc-lamp"></i><span>${t.name}</span><kbd aria-hidden="true">${t.letter}</kbd></button>`).join('')}
      </div>`;
    this.limitArc = this.el.querySelector('.dc-arc')!;
    this.needle = this.el.querySelector('.dc-needle')!;
    this.paceLabel = this.el.querySelector('.dc-pace-label')!;
    this.knob = this.el.querySelector('.dc-knob')!;
    this.radios = Array.from(this.el.querySelectorAll<HTMLButtonElement>('[data-pace]'));
    this.radios.forEach((b) => b.addEventListener('click', () => this.on.pace(Number(b.dataset.pace))));
    this.el.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => b.addEventListener('click', () =>
      this.on.toggle(b.dataset.toggle as Toggle, b.getAttribute('aria-checked') !== 'true')));
    stage.append(this.el);
  }

  render(s: Settings): void {
    this.settings = s;
    const pace = s.pace;
    this.radios.forEach((b) => {
      const checked = Number(b.dataset.pace) === pace;
      b.setAttribute('aria-checked', String(checked));
    });
    this.knob.style.top = `${100 - pace * 50}%`;
    const limit = 121.5 * (PACES[pace] / 2);
    this.limitArc.setAttribute('stroke-dasharray', `${limit} 182.2`);
    this.paceLabel.textContent = PACE_LABELS[pace];
    this.el.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => {
      b.setAttribute('aria-checked', String(s[b.dataset.toggle as Toggle]));
    });
  }

  updateSpeed(speed: number): void {
    const pace = this.settings?.pace ?? 0;
    const actualSpeed = Math.abs(speed) * PACES[pace];
    const angle = -120 + 240 * (actualSpeed / (MAX_SPEED * 2));
    this.needle.style.transform = `rotate(${Math.max(-120, Math.min(120, angle))}deg)`;
  }
}
