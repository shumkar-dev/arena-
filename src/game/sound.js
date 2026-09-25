// ============================================================
// ЗВУК — процедурный, через Web Audio: никаких файлов, всё синтезируется.
// Браузер разрешает звук только после касания, поэтому контекст создаётся
// в unlock() по первому нажатию. Выключенный звук запоминается на устройстве.
// ============================================================

const STORE_KEY = 'arena.muted';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(STORE_KEY) === '1'; } catch { /* приватный режим — звук включён */ }

const lastPlayed = new Map();   // имя → время, чтобы одинаковые звуки не сливались в кашу
const loops = new Map();        // имя → { stop() }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.7;
  // компрессор, чтобы взрывы поверх ударов не хрипели
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// ---------------- кирпичики ----------------

// тон: волна type, частота f0 → f1 за dur, огибающая с атакой att
function tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.3, att = 0.005, delay = 0, vibrato = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 18;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// шум через фильтр filter с частотой f0 → f1 за dur
function noise({ filter = 'lowpass', f0, f1 = f0, q = 1, dur, gain = 0.3, att = 0.003, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = filter;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

// ---------------- звуки игры ----------------

const SOUNDS = {
  punch() {                         // удар кулаком / щупальцем в цель
    noise({ f0: 1400, f1: 250, dur: 0.1, gain: 0.55 });
    tone({ f0: 150, f1: 55, dur: 0.13, gain: 0.6 });
  },
  swing() {                         // удар мимо — только свист воздуха
    noise({ filter: 'bandpass', f0: 1800, f1: 600, q: 1.5, dur: 0.14, gain: 0.25, att: 0.03 });
  },
  whip() {                          // хлёст щупальца
    noise({ filter: 'bandpass', f0: 2400, f1: 500, q: 2, dur: 0.16, gain: 0.3, att: 0.02 });
    noise({ filter: 'highpass', f0: 3500, dur: 0.035, gain: 0.35, delay: 0.1 });
  },
  grab() {                          // захват Шабы
    tone({ type: 'triangle', f0: 110, f1: 70, dur: 0.3, gain: 0.45 });
    noise({ f0: 700, f1: 200, dur: 0.2, gain: 0.35 });
  },
  throw() {                         // бросок сметаны
    noise({ filter: 'bandpass', f0: 900, f1: 350, q: 1.2, dur: 0.14, gain: 0.25, att: 0.02 });
  },
  splat() {                         // шлепок сметаны
    noise({ f0: 1000, f1: 180, dur: 0.2, gain: 0.5 });
    tone({ f0: 240, f1: 90, dur: 0.12, gain: 0.3 });
  },
  boing() {                         // замедление
    tone({ f0: 320, f1: 140, dur: 0.35, gain: 0.3, vibrato: 25 });
  },
  shot() {                          // выстрел изюминкой
    tone({ type: 'square', f0: 950, f1: 280, dur: 0.09, gain: 0.12 });
    noise({ filter: 'highpass', f0: 2500, dur: 0.04, gain: 0.15 });
  },
  impact() {                        // попадание снаряда
    noise({ f0: 1800, f1: 400, dur: 0.07, gain: 0.4 });
    tone({ f0: 200, f1: 90, dur: 0.07, gain: 0.3 });
  },
  explosion({ size = 1 } = {}) {    // взрыв: большой — ульта Гаргашмеля, малый — изюминка
    noise({ f0: 1600 * size, f1: 60, dur: 0.45 + 0.4 * size, gain: 0.5 + 0.4 * size, att: 0.005 });
    tone({ f0: 90, f1: 28, dur: 0.35 + 0.35 * size, gain: 0.5 + 0.35 * size });
  },
  bee() {                           // шмель пикирует
    tone({ type: 'sawtooth', f0: 170, f1: 260, dur: 0.22, gain: 0.18, vibrato: 30 });
  },
  frenzy() {                        // ускорение атаки Гаргашмеля
    tone({ type: 'square', f0: 260, f1: 900, dur: 0.22, gain: 0.12 });
    tone({ type: 'square', f0: 390, f1: 1350, dur: 0.22, gain: 0.08, delay: 0.05 });
  },
  ultShaba() {                      // чёрный баран: блеяние и топот
    tone({ type: 'sawtooth', f0: 420, f1: 330, dur: 0.45, gain: 0.2, vibrato: 40 });
    for (let i = 0; i < 4; i++) tone({ f0: 90, f1: 50, dur: 0.08, gain: 0.45, delay: 0.1 + i * 0.11 });
  },
  ultIzyum() {                      // Изюм пикирует на землю
    noise({ filter: 'bandpass', f0: 2500, f1: 300, q: 1, dur: 0.35, gain: 0.35, att: 0.05 });
    tone({ f0: 120, f1: 45, dur: 0.25, gain: 0.6, delay: 0.25 });
  },
  sprayStart() {                    // сметанамёт: хлопок и шипящая струя (петля до sprayStop)
    tone({ f0: 180, f1: 70, dur: 0.15, gain: 0.4 });
    startLoop('spray', () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 650; flt.Q.value = 0.9;
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 9; lg.gain.value = 180;
      lfo.connect(lg).connect(flt.frequency);
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + 0.08);
      src.connect(flt).connect(g).connect(master);
      src.start(); lfo.start();
      return () => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        src.stop(t + 0.25); lfo.stop(t + 0.25);
      };
    });
  },
  sprayStop() { stopLoop('spray'); },
  noTarget() {                      // ульта не нашла цель
    tone({ type: 'square', f0: 220, dur: 0.07, gain: 0.1 });
    tone({ type: 'square', f0: 180, dur: 0.09, gain: 0.1, delay: 0.09 });
  },
  hurt() {                          // по тебе попали
    tone({ type: 'triangle', f0: 260, f1: 130, dur: 0.14, gain: 0.3 });
  },
  death() {                         // боец выбыл
    tone({ type: 'triangle', f0: 440, f1: 90, dur: 0.7, gain: 0.35 });
    noise({ f0: 600, f1: 80, dur: 0.4, gain: 0.3, delay: 0.1 });
  },
  respawn() {                       // возрождение: восходящее арпеджио
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, gain: 0.2, delay: i * 0.07 }));
  },
};

function startLoop(name, make) {
  stopLoop(name);
  loops.set(name, { stop: make() });
}
function stopLoop(name) {
  loops.get(name)?.stop();
  loops.delete(name);
}

export const sound = {
  // вызвать по первому касанию — браузер разрешит звук
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  },
  play(name, opts) {
    if (muted || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    if (now - (lastPlayed.get(name) ?? -1) < 0.03) return;
    lastPlayed.set(name, now);
    SOUNDS[name](opts);
  },
  stopAll() { for (const k of [...loops.keys()]) stopLoop(k); },
  get muted() { return muted; },
  setMuted(v) {
    muted = v;
    try { localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch { /* не сохранилось — не страшно */ }
    if (v) sound.stopAll();
    if (master) master.gain.setTargetAtTime(v ? 0 : 0.7, ctx.currentTime, 0.02);
  },
};
