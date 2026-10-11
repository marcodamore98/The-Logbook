import { MS } from '../ms';

/** The voice-recording player inside a note: the real waveform, play/pause, position and speed. */

const BARS = 48;
const waves = new Map<string, number[]>();
const svg = (d: string, size = 20) => `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" aria-hidden="true" fill="currentColor"><path d="${d}"/></svg>`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SPEEDS = [1, 1.25, 1.5, 2];

/** Downsamples loudness samples to BARS values between 0.08 and 1. */
export function toWave(samples: number[]): number[] {
  if (!samples.length) return [];
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const from = Math.floor((i * samples.length) / BARS);
    const to = Math.max(from + 1, Math.floor(((i + 1) * samples.length) / BARS));
    out.push(Math.max(...samples.slice(from, to)));
  }
  const max = Math.max(...out) || 1;
  return out.map((v) => Math.round(Math.max(0.08, v / max) * 100) / 100);
}

/** Waveform of a short recording, decoded from the file (long ones would take too much memory). */
async function decodeWave(url: string): Promise<number[] | null> {
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    if (buf.byteLength > 4 * 1024 * 1024) return null;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    void ctx.close();
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / (BARS * 8)));
    const samples: number[] = [];
    for (let i = 0; i < data.length; i += step) {
      let sum = 0;
      const end = Math.min(data.length, i + step);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      samples.push(Math.sqrt(sum / (end - i)));
    }
    return toWave(samples);
  } catch {
    return null;
  }
}

/** A calm made-up shape when the real one can't be read (very long file, or not reachable). */
function fallbackWave(id: string): number[] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) | 0;
    return Math.round((0.3 + 0.45 * Math.abs(Math.sin(i / 3)) + 0.25 * ((h >>> 16) % 100) / 100) * 100) / 100;
  });
}

/** Builds (once) the player of an `.n-audio` block; it is never saved in the note (see stripPlayers). */
export function attachPlayer(box: HTMLElement, audio: HTMLAudioElement, opts: { id: string; sec?: number; wave?: number[] }) {
  if (box.querySelector('.n-player')) return;
  const p = document.createElement('div');
  p.className = 'n-player';
  p.contentEditable = 'false';
  p.innerHTML = `<div class="np-wave" role="slider" aria-label="Posizione nella registrazione" tabindex="0">${'<i></i>'.repeat(BARS)}</div><div class="np-row"><button type="button" class="np-play" aria-label="Riproduci">${svg(MS['play_arrow-fill'])}</button><span class="np-time">0:00</span><span class="np-grow"></span><button type="button" class="np-speed" aria-label="Velocità">1×</button></div>`;
  box.appendChild(p);
  const bars = [...p.querySelectorAll<HTMLElement>('.np-wave i')];
  const play = p.querySelector<HTMLButtonElement>('.np-play')!;
  const time = p.querySelector<HTMLElement>('.np-time')!;
  const speed = p.querySelector<HTMLButtonElement>('.np-speed')!;
  const wave = p.querySelector<HTMLElement>('.np-wave')!;
  const draw = (w: number[]) => bars.forEach((b, i) => (b.style.height = `${Math.round((w[i] ?? 0.1) * 100)}%`));
  const known = opts.wave?.length ? opts.wave : waves.get(opts.id);
  draw(known ?? fallbackWave(opts.id));
  const total = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : opts.sec ?? 0);
  const tick = () => {
    const t = audio.currentTime;
    const d = total();
    time.textContent = `${mmss(t)} / ${d ? mmss(d) : '–:––'}`;
    const k = d ? (t / d) * BARS : 0;
    bars.forEach((b, i) => b.classList.toggle('on', i < k));
    wave.setAttribute('aria-valuenow', String(Math.round(t)));
  };
  tick();
  const sync = () => {
    play.innerHTML = svg(audio.paused ? MS['play_arrow-fill'] : MS.pause);
    play.setAttribute('aria-label', audio.paused ? 'Riproduci' : 'Pausa');
  };
  const keep = (e: Event) => e.preventDefault();
  [play, speed, wave].forEach((el) => el.addEventListener('pointerdown', keep));
  play.addEventListener('click', (e) => {
    e.stopPropagation();
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  });
  speed.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length];
    audio.playbackRate = next;
    speed.textContent = `${String(next).replace('.', ',')}×`;
  });
  wave.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = wave.getBoundingClientRect();
    const d = total();
    if (d) audio.currentTime = Math.min(d, Math.max(0, ((e.clientX - r.left) / r.width) * d));
    tick();
  });
  ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((ev) => audio.addEventListener(ev, tick));
  ['play', 'pause', 'ended'].forEach((ev) => audio.addEventListener(ev, sync));
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    tick();
  });
  // The real shape, when the recording didn't come with it.
  if (!known) {
    const go = () => {
      const url = audio.getAttribute('src');
      if (!url) return;
      void decodeWave(url).then((w) => {
        if (!w) return;
        waves.set(opts.id, w);
        draw(w);
      });
    };
    if (audio.getAttribute('src')) go();
    else new MutationObserver((_, obs) => (obs.disconnect(), go())).observe(audio, { attributes: true, attributeFilter: ['src'] });
  }
}

/** The page as it is saved: without the players and the shown file sizes. */
export function stripPlayers(c: HTMLElement) {
  c.querySelectorAll('.n-player, .n-size').forEach((x) => x.remove());
}
