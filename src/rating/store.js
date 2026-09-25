import { BOT_NAMES } from '../game/bot.js';
import { clampDucks } from './ranks.js';

// ============================================================
// РЕЙТИНГ — где лежат утки.
// На устройстве (localStorage): id игрока, его утки, утки знакомых ботов и
// очередь ещё не отправленных изменений. Если заданы ключи Supabase
// (VITE_SUPABASE_URL и ключ VITE_SUPABASE_ANON_KEY — publishable sb_publishable_… или старый anon),
// изменения уходят в общую таблицу
// arena_rating (схема — docs/supabase.sql), оттуда же читается таблица рейтинга.
// Без сети и без ключей всё работает на устройстве, очередь отправится позже.
//
// Боты — постоянные «игроки» с именами из BOT_NAMES: у каждого свои утки,
// в матчах они получают награду по тем же правилам и стоят в той же таблице.
// ============================================================

const KEY = 'arena.rating';
// адрес проекта: https://<id>.supabase.co — лишний хвост /rest/v1/ (его часто копируют из
// настроек API) убираем, иначе запросы уйдут на /rest/v1/rest/v1/… и получат 404
const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
export const online = !!(URL_ && KEY_);

// последняя ошибка связи с таблицей — показывается на экране рейтинга
export let lastError = '';

export const botId = (name) => `bot:${name}`;

// стартовые утки ботов: от Новичков до пары Императоров, у каждого своё число
const hash = (str) => { let h = 7; for (const c of str) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
const BOT_SEED = Object.fromEntries(BOT_NAMES.map((n, i) => {
  const k = i / (BOT_NAMES.length - 1);
  return [botId(n), Math.round(1550 * k * k + (hash(n) % 25))];
}));

const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* пусто */ }
  return { id: s.id ?? uid(), ducks: s.ducks ?? 0, bots: s.bots ?? {}, pending: s.pending ?? [] };
}
const state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* не сохранилось */ } };
save();

export const playerId = () => state.id;
export const playerDucks = () => state.ducks;
export const botDucks = (name) => state.bots[botId(name)] ?? BOT_SEED[botId(name)] ?? 0;

/**
 * Имена ботов для матча — соперники примерно твоего уровня:
 * случайные из тех, у кого число уток ближе всего к твоему.
 */
export function pickBotNames(n, ducks = state.ducks) {
  const near = [...BOT_NAMES].sort((a, b) => Math.abs(botDucks(a) - ducks) - Math.abs(botDucks(b) - ducks));
  const pool = near.slice(0, Math.max(n + 2, 4));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

/**
 * Записать итог матча.
 * entries: [{ name, isBot, isPlayer, delta }] — все герои матча с их наградой.
 * Вернёт { before, after } уток игрока.
 */
export function applyMatch(entries, playerName) {
  const before = state.ducks;
  for (const e of entries) {
    if (!e.delta && !online) continue;
    if (e.isPlayer) {
      state.pending.push({ id: state.id, name: playerName, isBot: false, base: state.ducks, delta: e.delta });
      state.ducks = clampDucks(state.ducks + e.delta);
    } else if (e.isBot) {
      const id = botId(e.name), cur = botDucks(e.name);
      state.pending.push({ id, name: e.name, isBot: true, base: cur, delta: e.delta });
      state.bots[id] = clampDucks(cur + e.delta);
    }
  }
  if (!online) state.pending = [];
  save();
  flush();
  return { before, after: state.ducks };
}

// ---------- Supabase (REST, без библиотек) ----------

// Новый ключ (sb_publishable_…) — не JWT: его передают только в apikey, а заголовок
// Authorization с ним Supabase отклоняет. Старый anon-ключ (JWT, eyJ…) — в оба заголовка.
const headers = () => ({
  apikey: KEY_,
  ...(KEY_.startsWith('eyJ') ? { Authorization: `Bearer ${KEY_}` } : {}),
  'Content-Type': 'application/json',
});

const fail = async (res) => {
  let msg = '';
  try { const j = await res.json(); msg = j.message || j.msg || j.error || ''; } catch { /* не JSON */ }
  lastError = `Supabase ${res.status}${msg ? `: ${msg}` : ''}`;
  console.warn('[рейтинг]', lastError);
};

// Раз за запуск убедиться, что строка игрока есть в общей таблице (и имя свежее):
// «пустое» изменение на 0 уток с текущим числом как стартовым. Так в таблицу попадают
// и утки, набранные, пока связи с таблицей не было.
let synced = false;
export function syncPlayer(name) {
  if (!online || synced) return flush();
  synced = true;
  if (!state.pending.some((q) => q.id === state.id)) {
    state.pending.push({ id: state.id, name, isBot: false, base: Math.min(state.ducks, 3000), delta: 0 });
    save();
  }
  return flush();
}

let flushing = null;
/** Отправить накопленные изменения. Ошибка сети или настройки — не страшно, попробуем в следующий раз. */
export function flush() {
  if (!online || flushing || !state.pending.length) return flushing ?? Promise.resolve();
  flushing = (async () => {
    try {
      while (state.pending.length) {
        const p = state.pending[0];
        const res = await fetch(`${URL_}/rest/v1/rpc/arena_add_ducks`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_id: p.id, p_name: p.name, p_is_bot: p.isBot, p_base: p.base, p_delta: p.delta }),
        });
        if (!res.ok) {
          await fail(res);
          // 400 — функция отвергла сами данные: такое изменение выбрасываем, чтобы не застрять.
          // 401/403/404 и прочее — ошибка настройки или сервера: очередь храним до исправления.
          if (res.status === 400) { state.pending.shift(); save(); continue; }
          break;
        }
        lastError = '';
        const ducks = Number(await res.json());
        state.pending.shift();
        // сервер знает точное число — берём его (для ботов его меняют и другие игроки)
        if (Number.isFinite(ducks) && !state.pending.some((q) => q.id === p.id)) {
          if (p.isBot) state.bots[p.id] = ducks; else state.ducks = ducks;
        }
        save();
      }
    } catch { lastError = 'Нет связи с Supabase'; }
    flushing = null;
  })();
  return flushing;
}

/**
 * Таблица рейтинга: [{ id, name, ducks, isBot, isMe }] по убыванию уток.
 * Онлайн — общая таблица (боты, которых там ещё нет, берутся с устройства).
 * Вернёт { rows, online } — online: false, если показана только таблица с устройства.
 */
export async function fetchLeaderboard(playerName, limit = 100) {
  const local = () => [
    { id: state.id, name: playerName, ducks: state.ducks, isBot: false },
    ...BOT_NAMES.map((n) => ({ id: botId(n), name: n, ducks: botDucks(n), isBot: true })),
  ];
  let rows = null;
  if (online) {
    try {
      await syncPlayer(playerName);
      const res = await fetch(`${URL_}/rest/v1/arena_rating?select=id,name,ducks,is_bot&order=ducks.desc&limit=${limit}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        rows = data
          .map((r) => ({ id: r.id, name: r.name, ducks: r.ducks, isBot: r.is_bot }))
          .filter((r) => !r.isBot || BOT_SEED[r.id] !== undefined);   // боты не из нынешнего списка не показываем
        for (const r of rows) if (r.isBot) state.bots[r.id] = r.ducks;
        const me = rows.find((r) => r.id === state.id);
        if (me && !state.pending.length) state.ducks = me.ducks;
        save();
        const have = new Set(rows.map((r) => r.id));
        for (const r of local()) if (!have.has(r.id)) rows.push(r);
      } else await fail(res);
    } catch { lastError = 'Нет связи с Supabase'; }
  }
  const ok = !!rows;
  rows = (rows ?? local()).map((r) => (r.id === state.id ? { ...r, name: playerName, ducks: state.ducks } : r));
  rows.sort((a, b) => b.ducks - a.ducks || a.name.localeCompare(b.name));
  return { rows: rows.slice(0, limit).map((r) => ({ ...r, isMe: r.id === state.id })), online: ok };
}
