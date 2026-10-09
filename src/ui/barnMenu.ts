import { CROPS } from '../game/field';
import { CROP_INFO, type MachineItem, isQuiet } from '../game/machines';
import type { Crop, Job, Season } from '../game/types';

const SDOT: Record<Season, string> = { spring: '#9ec48c', summer: '#e8c35c', autumn: '#e59a4a', winter: '#b9c6cf' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

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
    stage.append(this.el);
    this.arrows = [[-1, '▲', 22], [1, '▼', 79.5]].map(([d, sym, top]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-arrow'; b.textContent = String(sym);
      b.setAttribute('aria-label', d === 1 ? 'Turn the carousel down' : 'Turn the carousel up');
      b.style.top = `${top}%`;
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
    const m = v.items[v.sel];
    const pills = (it: MachineItem) =>
      (it.job === v.next ? '<span class="pill next">Next up</span>' : '') +
      (it.job === v.lastJob ? '<span class="pill back">Just back</span>' : '') +
      `<span class="pill ssn${it.season === v.season ? ' now' : ''}">${cap(it.season)} job</span>`;
    this.el.innerHTML = `
      <div class="mh"><span class="sdot" style="background:${SDOT[v.season]}"></span><b>${cap(v.season)}</b><span class="mc">· ${CROP_INFO[v.crop].name}</span></div>
      <p class="mstat">${v.status}</p>
      <div class="cur"><b>${m.name}</b><span class="job">${m.verb}</span><div class="pills">${pills(m)}</div></div>
      <div class="chips">${v.items.map((it, i) => `<button type="button" class="chip${i === v.sel ? ' sel' : ''}${isQuiet(it, v.season, v.next) ? ' quiet' : ''}" data-i="${i}"><i></i>${it.name}${it.job === v.next ? '<span class="pill next">Next up</span>' : ''}</button>`).join('')}</div>
      <div class="crops" role="group" aria-label="Crop for the field">${CROPS.map((c) => `<button type="button" data-crop="${c}" aria-pressed="${c === v.crop}">${CROP_INFO[c].name}</button>`).join('')}</div>
      <div class="row"><button type="button" class="turn" data-d="-1" aria-label="Turn the carousel up">▲</button><button type="button" class="turn" data-d="1" aria-label="Turn the carousel down">▼</button><button type="button" class="go">Drive out</button></div>
      <p class="hint">↑ ↓ turn the carousel · ← → crop · Enter drives out</p>`;
    this.el.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => b.addEventListener('click', () => this.on.select(Number(b.dataset.i))));
    this.el.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach((b) => b.addEventListener('click', () => this.on.crop(b.dataset.crop as Crop)));
    this.el.querySelectorAll<HTMLButtonElement>('.turn').forEach((b) => b.addEventListener('click', () => this.on.turn(Number(b.dataset.d))));
    this.el.querySelector<HTMLButtonElement>('.go')!.addEventListener('click', () => this.on.driveOut());
  }
}
