import { SEASON_DOT } from '../draw/palette';
import type { Season } from '../game/types';

/**
 * The season pill, top left above the field: a ring that fills through the season, the season and
 * what the machine is doing, when the next season comes, and this year's harvest.
 */
export class SeasonPill {
  private readonly el: HTMLElement;
  private readonly ring: SVGCircleElement;
  private readonly seasonEl: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly divider: HTMLElement;
  private readonly countEl: HTMLElement;
  private lastKey = '';
  private lastRing = '';

  constructor(stage: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'season-pill';
    this.el.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#ece5d4" stroke-width="4" />
        <circle cx="12" cy="12" r="9" fill="none" stroke="${SEASON_DOT.autumn}" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 56.55" transform="rotate(-90 12 12)" />
      </svg>
      <b class="sp-season"></b><span class="sp-sep">·</span><b class="sp-label"></b><span class="sp-clock"></span>
      <span class="sp-div" aria-hidden="true" hidden></span><span class="sp-count" hidden></span>`;
    this.ring = this.el.querySelector('svg circle:nth-child(2)') as SVGCircleElement;
    this.seasonEl = this.el.querySelector('.sp-season')!;
    this.labelEl = this.el.querySelector('.sp-label')!;
    this.clockEl = this.el.querySelector('.sp-clock')!;
    this.divider = this.el.querySelector('.sp-div')!;
    this.countEl = this.el.querySelector('.sp-count')!;
    stage.append(this.el);
  }

  render(season: Season, label: string, harvested: number, clock: { k: number; text: string }): void {
    const dash = (Math.max(0.05, clock.k) * 56.55).toFixed(1), ring = `${SEASON_DOT[season]} ${dash}`;
    if (ring !== this.lastRing) {
      this.lastRing = ring;
      this.ring.setAttribute('stroke', SEASON_DOT[season]);
      this.ring.setAttribute('stroke-dasharray', `${dash} 56.55`);
    }
    // the words only change every few seconds; leave the DOM alone in between
    const key = `${season}|${label}|${harvested}|${clock.text}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.seasonEl.textContent = season[0].toUpperCase() + season.slice(1);
    this.labelEl.textContent = label;
    this.clockEl.textContent = `· ${clock.text}`;
    this.divider.hidden = this.countEl.hidden = harvested === 0;
    this.countEl.textContent = `${harvested} harvested`;
  }
}
