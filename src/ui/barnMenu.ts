import { SEASON_DOT } from '../draw/palette';
import { BARN, DOOR_X, DOOR_Y, H, W, ZOOM } from '../game/constants';
import { CROPS } from '../game/field';
import { CROP_INFO, type MachineItem, isQuiet } from '../game/machines';
import type { Crop, Job, Season } from '../game/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// world position → percent of the view, for placing DOM over the canvas
const pctX = (x: number) => `${((x * ZOOM) / W) * 100}%`;
const pctY = (y: number) => `${((y * ZOOM) / H) * 100}%`;

export interface MenuView {
  season: Season;
  crop: Crop;
  status: string;
  items: MachineItem[];
  sel: number;
  next: Job | null;
  lastJob: Job;
}

export interface MenuHandlers {
  turn(d: number): void;
  select(i: number): void;
  crop(c: Crop): void;
  driveOut(): void;
}

/** The small label beside the barn door, plus the carousel arrows inside the barn. */
export class BarnMenu {
  private readonly el: HTMLElement;
  private readonly arrows: HTMLButtonElement[];
  private key = '';

  constructor(stage: HTMLElement, private readonly on: MenuHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'menu barn-label';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'The barn');
    this.el.style.left = pctX(DOOR_X + 14 / ZOOM);
    this.el.style.top = pctY(DOOR_Y);
    stage.append(this.el);
    this.arrows = [[-1, '▲', BARN.y + 12], [1, '▼', BARN.y + BARN.h - 12]].map(([d, sym, y]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-arrow'; b.textContent = String(sym);
      b.setAttribute('aria-label', d === 1 ? 'Turn the carousel down' : 'Turn the carousel up');
      b.style.left = pctX(BARN.x + 114); b.style.top = pctY(Number(y));
      b.addEventListener('click', () => on.turn(Number(d)));
      stage.append(b);
      return b;
    });
  }

  open(): void { this.el.classList.add('open'); this.arrows.forEach((b) => b.classList.add('open')); }
  close(): void { this.el.classList.remove('open'); this.arrows.forEach((b) => b.classList.remove('open')); }

  render(v: MenuView): void {
    const key = JSON.stringify([v.season, v.crop, v.status, v.sel, v.next, v.lastJob]);
    if (key === this.key) return;
    this.key = key;
    const list = v.items.map((it, i) => {
      const sel = i === v.sel;
      const quiet = isQuiet(it, v.season, v.next) && !sel;
      const pills = sel
        ? (it.job === v.next ? '<span class="pill next">Next up</span>' : '') +
          (it.job === v.lastJob ? '<span class="pill back">Just back</span>' : '') +
          `<span class="pill ssn${it.season === v.season ? ' now' : ''}">${cap(it.season)} job</span>`
        : '';
      const inner = sel
        ? `<div class="sel-row"><i></i><b>${it.name}</b><span class="verb">${it.verb}</span></div><div class="sel-pills">${pills}</div>`
        : `<i></i>${it.name}`;
      return `<button type="button" class="barn-item${sel ? ' sel' : ''}${quiet ? ' quiet' : ''}" data-i="${i}">${inner}</button>`;
    }).join('');
    this.el.innerHTML = `
      <div class="mh"><span class="sdot" style="background:${SEASON_DOT[v.season]}"></span><b>${cap(v.season)}</b><span class="mc">· ${CROP_INFO[v.crop].name}</span></div>
      <p class="mstat">${v.status}</p>
      <div class="barn-list">${list}</div>
      <div class="crops" role="group" aria-label="Crop for the field">${CROPS.map((c) => `<button type="button" data-crop="${c}" aria-pressed="${c === v.crop}">${CROP_INFO[c].name}</button>`).join('')}</div>
      <button type="button" class="go">Drive out <kbd>Enter</kbd></button>
      <p class="hint">↑ ↓ machine · ← → crop</p>`;
    this.el.querySelectorAll<HTMLButtonElement>('.barn-item').forEach((b) => b.addEventListener('click', () => this.on.select(Number(b.dataset.i))));
    this.el.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach((b) => b.addEventListener('click', () => this.on.crop(b.dataset.crop as Crop)));
    this.el.querySelector<HTMLButtonElement>('.go')!.addEventListener('click', () => this.on.driveOut());
  }
}
