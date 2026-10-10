import type { Season } from './game/types';

/**
 * Soft ambience made in the browser: wind, the odd bird, and a quiet engine hum
 * that follows the machine's speed. Nothing plays until the first key or click.
 */
export class Ambience {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private engine!: GainNode;
  private engineOsc: OscillatorNode[] = [];
  private birdIn = 3;
  private gust = 0;
  private swelling = false;
  muted: boolean;
  /** Where the next chirp comes from (-1 left to 1 right), so it sounds where a bird is; null for anywhere. */
  chirpPan: (() => number | null) | null = null;

  constructor(muted: boolean) { this.muted = muted; }

  /** Call from a user gesture; safe to call repeatedly. */
  start(): void {
    if (this.ac) { void this.ac.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ac = new Ctor();
    this.ac = ac;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ac.destination);

    // wind: looping brown noise through a slowly wandering low-pass
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
    this.windFilter = ac.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 420; this.windFilter.Q.value = 0.4;
    this.wind = ac.createGain(); this.wind.gain.value = 0.05;
    noise.connect(this.windFilter).connect(this.wind).connect(this.master); noise.start();

    // engine: two soft low oscillators under a low-pass, silent until the machine moves
    const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 220;
    this.engine = ac.createGain(); this.engine.gain.value = 0;
    ef.connect(this.engine).connect(this.master);
    for (const [type, f] of [['sawtooth', 48], ['triangle', 97]] as const) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(ef); o.start(); this.engineOsc.push(o); }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ac) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ac.currentTime, 0.3);
  }

  /**
   * `engine` is 0..1 (the machine's speed share); `gust` 0..1 is the wind the farm can see; `dt` in seconds.
   * `quiet` is true after dusk, when the birds have gone to roost and no longer chirp.
   */
  update(dt: number, engine: number, season: Season, gust = 0, quiet = false): void {
    const ac = this.ac;
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    this.engine.gain.setTargetAtTime(engine > 0.01 ? 0.01 + engine * 0.028 : 0, now, 0.4);
    this.engineOsc.forEach((o, i) => o.frequency.setTargetAtTime((i ? 97 : 48) * (1 + engine * 0.25), now, 0.5));
    this.gust -= dt;
    // a gust you can see crossing the farm swells the wind a little as it passes
    if (gust > 0.3 && !this.swelling) { this.swelling = true; this.wind.gain.setTargetAtTime(season === 'winter' ? 0.1 : 0.07, now, 1.2); }
    else if (gust < 0.15 && this.swelling) { this.swelling = false; this.gust = 0; }
    if (this.gust <= 0 && !this.swelling) {
      this.gust = 2 + Math.random() * 3;
      this.wind.gain.setTargetAtTime((season === 'winter' ? 0.07 : 0.04) + Math.random() * 0.03, now, 1.5);
      this.windFilter.frequency.setTargetAtTime(320 + Math.random() * 260, now, 1.5);
    }
    if (season === 'winter' || quiet) return;
    this.birdIn -= dt;
    if (this.birdIn <= 0) {
      this.birdIn = (season === 'spring' ? 3 : 6) + Math.random() * 7;
      this.chirp(now);
    }
  }

  private chirp(at: number): void {
    const ac = this.ac!, pan = ac.createStereoPanner(), notes = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1400;
    pan.pan.value = this.chirpPan?.() ?? Math.random() * 1.6 - 0.8; pan.connect(this.master);
    for (let i = 0; i < notes; i++) {
      const t = at + i * (0.12 + Math.random() * 0.06), o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), t);
      o.frequency.exponentialRampToValueAtTime(base * (Math.random() < 0.5 ? 1.3 : 0.8), t + 0.09);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.1);
      o.connect(g).connect(pan); o.start(t); o.stop(t + 0.12);
    }
  }
}
