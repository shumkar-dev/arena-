// ============================================================
// ЗВУК — процедурный, через Web Audio: никаких файлов, всё синтезируется.
// Звуки собираются слоями: низкий удар (синус с быстрым падением высоты, как
// бочка у барабана) + шум через фильтры (тело, свист, треск) + лёгкая
// реверберация (свёртка со сгенерированным хвостом) + перегруз для взрывов.
// Браузер разрешает звук только после касания, поэтому контекст создаётся
// в unlock() по первому нажатию. Выключенный звук запоминается на устройстве.
//
// Три канала с отдельной громкостью (настройки): звуки (эти, процедурные),
// голоса (voice.js — реплики героев) и музыка (music.js). Кнопка звука
// выключает всё сразу.
// ============================================================

const STORE_KEY = 'arena.muted';
const MASTER = 0.8;

let ctx = null;
let master = null;     // сухой сигнал
let reverb = null;     // вход реверберации
let noiseBuf = null;
let drive = null;      // кривая мягкого перегруза
let muted = false;
let volume = 0.8;       // 0..1, громкость звуков — из настроек
let mainOut = null;     // общий выход всех каналов: 0 — звук выключен
const buses = {};       // voice, music — входы каналов голосов и музыки
const busVolume = { voice: 0.9, music: 0.5 };
const unlockers = [];   // кому сообщить, что звук разрешён (музыке)
try { muted = localStorage.getItem(STORE_KEY) === '1'; } catch { /* приватный режим — звук включён */ }

const lastPlayed = new Map();   // имя → время, чтобы одинаковые звуки не сливались в кашу
const loops = new Map();        // имя → { stop() }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  // общий выход: компрессор держит громкие взрывы поверх ударов
  mainOut = ctx.createGain();
  mainOut.gain.value = muted ? 0 : 1;
  mainOut.connect(ctx.destination);
  for (const name of ['voice', 'music']) {
    buses[name] = ctx.createGain();
    buses[name].gain.value = busVolume[name];
    buses[name].connect(mainOut);
  }

  const out = ctx.createGain();
  out.gain.value = MASTER * volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  out.connect(comp).connect(mainOut);
  master = ctx.createGain();
  master.connect(out);
  master.out = out;

  // реверберация: стерео-хвост 1,4 с из затухающего шума, верха гаснут быстрее
  const len = Math.floor(ctx.sampleRate * 1.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.9 - t * 0.75);   // чем дальше, тем глуше
      d[i] = lp * Math.pow(1 - t, 3);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  reverb = ctx.createGain();
  reverb.connect(conv).connect(wet).connect(out);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  drive = new Float32Array(1024);
  for (let i = 0; i < drive.length; i++) {
    const x = (i / (drive.length - 1)) * 2 - 1;
    drive[i] = Math.tanh(x * 2.5);
  }
  return ctx;
}

// ---------------- кирпичики ----------------

// подключить узел к выходу: сухой сигнал + доля rev в реверберацию, при drive — через перегруз
function route(node, { rev = 0.12, distort = false } = {}) {
  let src = node;
  if (distort) {
    const ws = ctx.createWaveShaper();
    ws.curve = drive;
    ws.oversample = '2x';
    src.connect(ws);
    src = ws;
  }
  src.connect(master);
  if (rev > 0) {
    const s = ctx.createGain();
    s.gain.value = rev;
    src.connect(s).connect(reverb);
  }
}

// огибающая громкости: атака att, затем экспоненциальный спад к концу dur
function envelope(g, t, att, dur, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// низкий удар «в грудь»: синус с быстрым падением высоты f0 → f1
function thump({ f0 = 140, f1 = 45, dur = 0.18, gain = 0.8, delay = 0, rev = 0.1, distort = false }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  const g = ctx.createGain();
  envelope(g, t, 0.004, dur, gain);
  o.connect(g);
  route(g, { rev, distort });
  o.start(t); o.stop(t + dur + 0.05);
}

// шум через фильтр: тело удара, свист, треск, шипение
function noise({ filter = 'lowpass', f0, f1 = f0, q = 0.8, dur, gain = 0.4, att = 0.003, delay = 0, rev = 0.12, distort = false }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = filter;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  envelope(g, t, att, dur, gain);
  src.connect(flt).connect(g);
  route(g, { rev, distort });
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

// тон через фильтр нижних частот — мягкий, без «писка»
function tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.2, att = 0.01, delay = 0, lp = 1800, vibrato = 0, vibRate = 7, rev = 0.2 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = vibRate;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = lp;
  const g = ctx.createGain();
  envelope(g, t, att, dur, gain);
  o.connect(flt).connect(g);
  route(g, { rev });
  o.start(t); o.stop(t + dur + 0.05);
}

// ---------------- звуки игры ----------------

const SOUNDS = {
  punch() {                         // тяжёлый глухой удар в цель
    thump({ f0: 150, f1: 42, dur: 0.22, gain: 1.0, rev: 0.12 });
    noise({ f0: 1100, f1: 140, dur: 0.14, gain: 0.55 });                       // тело
    noise({ filter: 'bandpass', f0: 2600, q: 1.2, dur: 0.018, gain: 0.3 });    // щелчок кожи
  },
  swing() {                         // удар мимо — плотный свист воздуха
    noise({ filter: 'bandpass', f0: 1300, f1: 380, q: 0.9, dur: 0.2, att: 0.05, gain: 0.5, rev: 0.08 });
  },
  whip() {                          // хлёст щупальца: свист и влажный щелчок
    noise({ filter: 'bandpass', f0: 1700, f1: 450, q: 1, dur: 0.17, att: 0.03, gain: 0.45, rev: 0.1 });
    noise({ filter: 'bandpass', f0: 2200, q: 1.5, dur: 0.035, gain: 0.28, delay: 0.1, rev: 0.2 });   // щелчок кончика
    thump({ f0: 130, f1: 60, dur: 0.1, gain: 0.35, delay: 0.1 });                                  // вес щупальца
  },
  grab() {                          // захват Шабы: сшибка тел
    thump({ f0: 120, f1: 40, dur: 0.3, gain: 0.95, rev: 0.15 });
    noise({ f0: 700, f1: 110, dur: 0.3, gain: 0.5 });
  },
  throw() {                         // бросок сметаны — мягкий свист
    noise({ filter: 'bandpass', f0: 750, f1: 280, q: 0.8, dur: 0.18, att: 0.04, gain: 0.5, rev: 0.06 });
  },
  splat() {                         // шлепок густой сметаны
    thump({ f0: 190, f1: 60, dur: 0.14, gain: 0.55, rev: 0.12 });
    noise({ f0: 1600, f1: 180, dur: 0.24, gain: 0.55, rev: 0.18 });
    noise({ filter: 'bandpass', f0: 650, f1: 160, q: 7, dur: 0.2, gain: 0.35 });   // чавк
  },
  boing() {                         // замедляющая сметана: шлепок и «вязкое» подвывание
    SOUNDS.splat();
    tone({ f0: 210, f1: 110, dur: 0.45, gain: 0.2, lp: 700, vibrato: 14, vibRate: 9, delay: 0.03 });
  },
  shot() {                          // выстрел изюминкой — пневматический «тхуп»
    thump({ f0: 210, f1: 75, dur: 0.11, gain: 0.7, rev: 0.08 });
    noise({ filter: 'bandpass', f0: 1500, f1: 550, q: 1, dur: 0.09, gain: 0.5, rev: 0.12 });
    noise({ filter: 'highpass', f0: 3200, dur: 0.02, gain: 0.2 });
  },
  impact() {                        // попадание снаряда
    thump({ f0: 170, f1: 55, dur: 0.13, gain: 0.7 });
    noise({ f0: 1300, f1: 200, dur: 0.1, gain: 0.45 });
  },
  explosion({ size = 1 } = {}) {    // низкий бум с перегрузом и хвостом
    thump({ f0: 85, f1: 26, dur: 0.6 + 0.6 * size, gain: 1.0, rev: 0.35, distort: true });
    noise({ f0: 2200 * size + 400, f1: 70, dur: 0.6 + 0.8 * size, gain: 0.55 + 0.35 * size, att: 0.006, rev: 0.45, distort: true });
    noise({ filter: 'highpass', f0: 1400, dur: 0.25 + 0.15 * size, gain: 0.15 + 0.1 * size, delay: 0.05, rev: 0.3 });   // треск обломков
  },
  // шмель летит dur секунд: гудение нарастает по громкости и высоте
  beeFlight({ dur = 0.6 } = {}) {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    // взмахи крыльев — быстрая модуляция громкости
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const wing = ctx.createOscillator(), wg = ctx.createGain();
    wing.frequency.value = 48; wg.gain.value = 0.4;
    wing.connect(wg).connect(am.gain);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = 3;
    flt.frequency.setValueAtTime(700, t);
    flt.frequency.exponentialRampToValueAtTime(2600, t + dur);
    for (const det of [0, 7, -5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(105 + det, t);
      o.frequency.exponentialRampToValueAtTime(185 + det, t + dur);
      o.connect(flt);
      o.start(t); o.stop(t + dur + 0.1);
    }
    flt.connect(am).connect(g);
    route(g, { rev: 0.2 });
    wing.start(t); wing.stop(t + dur + 0.1);
  },
  frenzy() {                        // ускорение Гаргашмеля — утробный рык
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(115, t + 0.35);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 7;
    flt.frequency.setValueAtTime(300, t);
    flt.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
    const g = ctx.createGain(); envelope(g, t, 0.03, 0.4, 0.3);
    o.connect(flt).connect(g);
    route(g, { rev: 0.25, distort: true });
    o.start(t); o.stop(t + 0.45);
    noise({ f0: 900, f1: 300, dur: 0.3, gain: 0.2 });
  },
  ultShaba() {                      // чёрный баран: блеяние через «гласные» фильтры и топот копыт
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(250, t);
    o.frequency.linearRampToValueAtTime(215, t + 0.6);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 7; lg.gain.value = 9;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain(); envelope(g, t, 0.05, 0.65, 0.3);
    for (const [f, q, k] of [[750, 5, 1], [1250, 6, 0.6], [2500, 8, 0.25]]) {
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = k;
      o.connect(b).connect(bg).connect(g);
    }
    route(g, { rev: 0.25 });
    o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
    for (let i = 0; i < 4; i++) thump({ f0: 110, f1: 45, dur: 0.12, gain: 0.7, delay: 0.1 + i * 0.12 });
  },
  ultIzyum() {                      // Изюм пикирует и с глухим ударом приземляется
    noise({ filter: 'bandpass', f0: 2200, f1: 260, q: 0.9, dur: 0.38, att: 0.08, gain: 0.4, rev: 0.15 });
    thump({ f0: 110, f1: 32, dur: 0.4, gain: 1.0, delay: 0.3, rev: 0.3, distort: true });
    noise({ f0: 900, f1: 90, dur: 0.35, gain: 0.45, delay: 0.3, rev: 0.3 });
  },
  sprayStart() {                    // сметанамёт: «пфф» и густое шипение с бульканьем до sprayStop
    thump({ f0: 160, f1: 55, dur: 0.18, gain: 0.7 });
    startLoop('spray', () => {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const hiss = ctx.createBiquadFilter(); hiss.type = 'lowpass'; hiss.frequency.value = 2400;
      const body = ctx.createBiquadFilter(); body.type = 'bandpass'; body.frequency.value = 520; body.Q.value = 1.1;
      const rumble = ctx.createBiquadFilter(); rumble.type = 'lowpass'; rumble.frequency.value = 160;
      // бульканье — модуляция громкости
      const am = ctx.createGain(); am.gain.value = 0.7;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 11; lg.gain.value = 0.3;
      lfo.connect(lg).connect(am.gain);
      const mix = ctx.createGain();
      const hg = ctx.createGain(); hg.gain.value = 0.35;
      const bg = ctx.createGain(); bg.gain.value = 0.8;
      const rg = ctx.createGain(); rg.gain.value = 1.2;
      src.connect(hiss).connect(hg).connect(mix);
      src.connect(body).connect(bg).connect(mix);
      src.connect(rumble).connect(rg).connect(mix);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.1);
      mix.connect(am).connect(g);
      route(g, { rev: 0.15 });
      src.start(t); lfo.start(t);
      return () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        src.stop(now + 0.3); lfo.stop(now + 0.3);
      };
    });
  },
  sprayStop() { stopLoop('spray'); },
  noTarget() {                      // ульта не нашла цель — глухой «пуф»
    noise({ f0: 500, f1: 150, dur: 0.14, gain: 0.3 });
    thump({ f0: 130, f1: 90, dur: 0.12, gain: 0.3 });
  },
  hurt() {                          // по тебе попали
    thump({ f0: 125, f1: 55, dur: 0.16, gain: 0.8 });
    noise({ filter: 'bandpass', f0: 520, q: 1.8, dur: 0.12, gain: 0.3 });
  },
  death() {                         // боец выбыл: тяжёлое падение и затухающий гул
    thump({ f0: 95, f1: 30, dur: 0.6, gain: 1.0, rev: 0.35, distort: true });
    noise({ f0: 900, f1: 90, dur: 0.75, gain: 0.5, rev: 0.4 });
    tone({ type: 'sawtooth', f0: 150, f1: 55, dur: 0.9, gain: 0.14, lp: 500, rev: 0.4, delay: 0.05 });
  },
  pickup() {                        // подобрал предмет: мягкий «вжух» и звон
    noise({ filter: 'bandpass', f0: 600, f1: 2600, q: 2, dur: 0.22, att: 0.05, gain: 0.25, rev: 0.2 });
    tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.3, gain: 0.12, lp: 2500, rev: 0.4, delay: 0.05 });
  },
  glass() {                         // разбилась бутылка: глухой удар, звон осколков, плеск
    thump({ f0: 140, f1: 45, dur: 0.35, gain: 0.9, rev: 0.3 });
    for (let i = 0; i < 6; i++) {
      noise({ filter: 'bandpass', f0: 3000 + i * 700, q: 8, dur: 0.12 + i * 0.03, gain: 0.18, delay: 0.02 + i * 0.045, rev: 0.4 });
    }
    noise({ f0: 900, f1: 200, dur: 0.5, gain: 0.35, delay: 0.08, rev: 0.3 });
  },
  victory() {                       // победа: тёплый восходящий аккорд с хвостом
    [262, 330, 392, 523].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 1.4, att: 0.04, gain: 0.13, lp: 2200, delay: i * 0.09, rev: 0.6 }));
    thump({ f0: 110, f1: 55, dur: 0.4, gain: 0.7, rev: 0.3 });
  },
  defeat() {                        // поражение: нисходящий глухой аккорд
    [311, 247, 196].forEach((f, i) => tone({ type: 'triangle', f0: f, f1: f * 0.94, dur: 1.3, att: 0.05, gain: 0.13, lp: 1200, delay: i * 0.14, rev: 0.6 }));
    thump({ f0: 80, f1: 35, dur: 0.6, gain: 0.8, rev: 0.4 });
  },
  respawn() {                       // возрождение: восходящий шелест и мягкий аккорд
    noise({ filter: 'bandpass', f0: 350, f1: 3200, q: 2.5, dur: 0.55, att: 0.2, gain: 0.3, rev: 0.4 });
    [262, 392, 523].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.8, att: 0.05, gain: 0.1, lp: 1400, delay: 0.15 + i * 0.05, rev: 0.6 }));
  },
};
SOUNDS.bee = SOUNDS.beeFlight;

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
    const done = () => { for (const fn of unlockers) fn(); };
    if (ctx.state === 'suspended') ctx.resume().then(done, () => {});
    else done();
  },
  /** Сообщить, когда браузер разрешит звук (после касания). */
  onUnlock(fn) { unlockers.push(fn); },
  /** Контекст Web Audio, если звук уже разрешён, иначе null. */
  context() { return ctx && ctx.state === 'running' ? ctx : null; },
  /** Вход канала голосов или музыки. */
  bus(name) { return buses[name] ?? null; },
  setBusVolume(name, v) {
    busVolume[name] = Math.max(0, Math.min(1, v));
    buses[name]?.gain.setTargetAtTime(busVolume[name], ctx.currentTime, 0.05);
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
    if (mainOut) mainOut.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.02);
    for (const fn of unlockers) fn();
  },
  get volume() { return volume; },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.out.gain.setTargetAtTime(MASTER * volume, ctx.currentTime, 0.02);
  },
};
