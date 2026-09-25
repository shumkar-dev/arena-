import { sound } from './sound.js';

// ============================================================
// ГОЛОСА ГЕРОЕВ — реплики из файлов public/voices/<голос>_<событие>.mp3.
// <голос> — hero.voice или id героя (у Гаргашмеля — garga).
// События: select, start, attack, ult, hurt, kill, death, win.
// Нет файла (как у Шабы) — просто тишина.
//
// Реплики не накладываются: пока звучит одна, новую пропускаем. Только более
// важная перебивает менее важную (победа и смерть важнее удара).
// ============================================================

export const VOICE_EVENTS = ['select', 'start', 'attack', 'ult', 'hurt', 'kill', 'death', 'win'];
const PRIORITY = { attack: 1, hurt: 2, select: 3, start: 3, ult: 4, kill: 5, death: 6, win: 7 };
const BASE = `${import.meta.env.BASE_URL}voices/`;

export const voiceOf = (hero) => hero?.voice ?? hero?.id ?? '';

const cache = new Map();     // 'garga_ult' → Promise<AudioBuffer | null>
let current = null;          // { src, pr, end }

function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);   // старый Safari — только через колбэки
    p?.then?.(resolve, reject);
  });
}

function load(key) {
  if (cache.has(key)) return cache.get(key);
  const ctx = sound.context();
  if (!ctx) return Promise.resolve(null);      // звук ещё не разрешён — загрузим в следующий раз
  const p = fetch(`${BASE}${key}.mp3`)
    // нет файла — 404 (или страница-заглушка вместо звука): молчим
    .then((r) => (r.ok && /audio|mpeg|octet/.test(r.headers.get('content-type') ?? '') ? r.arrayBuffer() : null))
    .then((data) => (data ? decode(ctx, data) : null))
    .catch(() => null);
  cache.set(key, p);
  return p;
}

export const voice = {
  /** Заранее загрузить все реплики героя (выбор героя, начало матча). */
  preload(hero) {
    const v = voiceOf(hero);
    if (v) for (const ev of VOICE_EVENTS) load(`${v}_${ev}`);
  },

  /** Сказать реплику героя. */
  play(hero, ev) {
    const v = voiceOf(hero);
    const ctx = sound.context();
    if (!v || !ctx || sound.muted) return;
    const pr = PRIORITY[ev] ?? 1;
    const busy = () => current && current.end > ctx.currentTime;
    if (busy() && pr <= current.pr) return;
    load(`${v}_${ev}`).then((buf) => {
      const bus = sound.bus('voice');
      if (!buf || !bus) return;
      if (busy()) {
        if (pr <= current.pr) return;
        try { current.src.stop(); } catch { /* уже закончилась */ }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(bus);
      src.start();
      current = { src, pr, end: ctx.currentTime + buf.duration };
    });
  },

  stop() {
    try { current?.src.stop(); } catch { /* уже закончилась */ }
    current = null;
  },
};
