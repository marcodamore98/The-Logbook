// Small sound kit shared by the rest timer and the set checkmarks (Web Audio, no files).

let ctx: AudioContext | null = null;

/** Call from a tap handler at least once so the browser allows sound later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio available */
  }
}

function tone(freq: number, ms: number, when = 0, vol = 0.25, type: OscillatorType = 'sine') {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.05);
}

/** Set completed: a warm rising "yes" (two notes). */
export function chime() {
  tone(659, 140, 0, 0.22); // E5
  tone(988, 260, 0.11, 0.22); // B5
  navigator.vibrate?.(25);
}

/** 3-2-1 countdown tick. */
export function tick() {
  tone(880, 110, 0, 0.28);
  navigator.vibrate?.(40);
}

/** Rest over: a longer, higher double beep. */
export function restOver() {
  tone(1175, 180, 0, 0.3);
  tone(1568, 420, 0.2, 0.3);
  navigator.vibrate?.([200, 100, 300]);
}
