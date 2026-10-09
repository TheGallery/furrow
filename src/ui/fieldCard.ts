import { type Planting, cropStage, plantings } from '../game/almanac';
import type { Field } from '../game/field';
import { CROP_INFO } from '../game/machines';
import type { Crop } from '../game/types';

const SWATCH: Record<Crop, string> = { wheat: '#e2c46a', carrot: '#e8915a', pumpkin: '#c9772e' };
const pct = (x: number) => `${Math.round(x * 100)} %`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * The folding field card beside the driving card: what is planted, how much of the field each crop
 * covers, its stage and when it will be ripe. Folded, one line names the main crop and its stage.
 */
export class FieldCard {
  private readonly el: HTMLElement;
  private readonly head: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly sum: HTMLElement;
  private folded = false;
  /** Folded for a barn visit, like the driving card; a header click still opens it. */
  private tucked = false;
  private peek = false;
  private last = '';

  constructor(stage: HTMLElement, private readonly onFold: (folded: boolean) => void) {
    this.el = document.createElement('div');
    this.el.className = 'menu field-card';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Field');
    this.el.innerHTML = `
      <div class="fc-body" id="fc-body" aria-live="polite"></div>
      <button type="button" class="dc-head" aria-controls="fc-body"><b>Field</b><span class="dc-sum"></span><span class="dc-fold" aria-hidden="true">▾</span></button>`;
    this.head = this.el.querySelector('.dc-head')!;
    this.body = this.el.querySelector('.fc-body')!;
    this.sum = this.el.querySelector('.dc-sum')!;
    this.head.addEventListener('click', () => {
      if (this.tucked && !this.peek && this.el.classList.contains('folded')) { this.peek = true; this.paintFold(); }
      else this.onFold(!this.el.classList.contains('folded'));
    });
    stage.append(this.el);
  }

  setFolded(folded: boolean): void { this.folded = folded; this.paintFold(); }

  tuck(on: boolean): void { this.tucked = on; this.peek = false; this.paintFold(); }

  private paintFold(): void {
    const folded = this.folded || (this.tucked && !this.peek);
    this.el.classList.toggle('folded', folded);
    this.head.setAttribute('aria-expanded', String(!folded));
  }

  /** Repaint from the field; cheap to call often, it only touches the page when the words change. */
  render(f: Field, elapsed: number): void {
    const { crops, bare, ready } = plantings(f);
    const rows = crops.map((p) => ({ p, st: cropStage(p, elapsed) }));
    const rest = [ready >= 0.005 ? `ready for seed ${pct(ready)}` : '', bare >= 0.005 ? `bare ${pct(bare)}` : ''].filter(Boolean).join(' · ');
    const row = ({ p, st }: { p: Planting; st: ReturnType<typeof cropStage> }) => `
      <div class="fc-crop"><span class="fc-sw" style="background:${SWATCH[p.crop]}"></span><b>${CROP_INFO[p.crop].name}</b><span class="fc-share">${pct(p.share)} of the field</span><span class="fc-stage s-${st.name.toLowerCase()}">${st.name}</span></div>
      <div class="fc-bar"><i style="width:${(st.k * 100).toFixed(0)}%;background:${SWATCH[p.crop]}"></i></div>
      <div class="fc-note">${st.note}</div>`;
    const html = `${rows.length ? rows.map(row).join('') : '<div class="fc-note">Nothing planted yet</div>'}${rest ? `<div class="fc-rest">${cap(rest)}</div>` : ''}`;
    if (html !== this.last) { this.body.innerHTML = html; this.last = html; }
    const first = rows[0];
    this.sum.textContent = first ? [`${CROP_INFO[first.p.crop].name.toLowerCase()} ${first.st.name.toLowerCase()}`, rows.length > 1 ? `+${rows.length - 1}` : ''].filter(Boolean).join(' · ') : 'nothing planted';
  }
}
