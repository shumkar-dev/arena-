import { sound } from './sound.js';

// ============================================================
// МУЗЫКА — public/music/menu.mp3 в меню и battle.mp3 в бою, по кругу.
// При смене — плавный переход: одна дорожка затихает, другая нарастает.
// Идёт через Web Audio (канал «музыка» в sound.js): так громкость меняется
// и на iPhone, где у <audio> громкость не регулируется.
// Начинает играть после первого касания (раньше браузер не разрешит).
// Громкость — канал «музыка» (тише голосов и звуков, см. sound.js); на нуле — стоп.
// ============================================================

const FILES = { menu: 'menu.mp3', battle: 'battle.mp3' };
const FADE = 1.2;     // с
const BASE = `${import.meta.env.BASE_URL}music/`;

const tracks = {};    // имя → { el, gain, stopTimer }
let wanted = null;

function track(ctx, name) {
  if (tracks[name]) return tracks[name];
  const el = new Audio(`${BASE}${FILES[name]}`);
  el.loop = true;
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  const gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(el).connect(gain).connect(sound.bus('music'));
  tracks[name] = { el, gain, stopTimer: 0 };
  return tracks[name];
}

function apply() {
  const ctx = sound.context();
  if (!ctx || !sound.bus('music')) return;
  const silent = sound.muted || document.hidden || sound.busVolume('music') === 0;
  const now = ctx.currentTime;
  for (const name of Object.keys(FILES)) {
    const on = name === wanted && !silent;
    if (!on && !tracks[name]) continue;
    const t = track(ctx, name);
    clearTimeout(t.stopTimer);
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(on ? 1 : 0, now + FADE);
    if (on) {
      if (t.el.paused) t.el.play().catch(() => {});
    } else {
      // затихла — останавливаем, чтобы не тратить батарею
      t.stopTimer = setTimeout(() => t.el.pause(), FADE * 1000 + 100);
    }
  }
}

sound.onChange(apply);
document.addEventListener('visibilitychange', apply);

export const music = {
  /** 'menu' | 'battle' | null — что должно играть сейчас. */
  play(name) {
    if (name === wanted) return;
    wanted = name;
    apply();
  },
  refresh: apply,
};
