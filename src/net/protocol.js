import { heroById, HEROES } from '../heroes/index.js';
import { modeById } from '../modes/index.js';

// ============================================================
// СЕТЕВОЙ ПРОТОКОЛ — общий для сервера (server/) и игры.
// Транспорт — WebSocket, сообщения — JSON { t: тип, ... }.
//
// Игра → сервер
//   create { name, hero, ducks, pv }   создать комнату (режим — потом, в лобби; по умолчанию 1 на 1)
//   join   { code, name, hero, ducks, pv } войти по коду (pv — версия протокола игры)
//   mode   { mode }                    создатель выбирает режим в лобби: duel | teams | ffa
//   hero   { hero }                    сменить своего героя в лобби (и между боями)
//   team   { team }                    перейти в команду (2 на 2: blue | red)
//   start                              создатель комнаты начинает бой (пустые места — боты)
//   in     { s, k, mx, mz, ad?, a?, u? } команда бойца (encodeCmd), s — номер по порядку,
//                                      k — последний полученный снимок; шлётся при изменении (до 20 раз/с), но не реже 10 раз/с
//   leave                              выйти из комнаты
//   ping   { c }                       замер пинга (ответ: pong { c })
//
// Сервер → игра
//   hello  { pv }                      сразу после подключения: версия протокола сервера
//   lobby  { code, mode, you, host, slots: [{ name, hero } | null] }   комната до боя и после
//   start  { mode, you, host, roster: [{ name, hero, bot }] }          бой начался; you — твоё место
//   [1, n, tm, ack, [изменения бойцов], [события], extra?]            снимок 15 раз в секунду (массив, не объект):
//          n — номер снимка, tm — время сервера в мс, ack — последняя применённая команда игрока,
//          изменения — [номер, маска, ...поля] (packFighter/diffFighter), extra — { sc?, pk? } при изменениях
//   end    { winners, reason, res: [{ win, place, topKills, delta }] } итог по героям, delta — утки
//   left   { name }                    игрок вышел из боя — дальше за него играет бот
//   err    { msg, code? }              ошибка (нет комнаты, занята…); code 'version' — игра устарела
//
// ducks — утки игрока: по ним сервер выбирает силу ботов в комнате.
// Сервер авторитетный: бой считает он. Игра считает свою копию только для
// картинки (анимации, снаряды, эффекты), а ХП, смерти и счёт берёт из снимков.
// ============================================================

// Версия протокола: меняется, когда игра и сервер перестают понимать друг друга
// (формат снимков, сообщения). Сервер называет свою в hello, игра — в create/join.
//   1 — полные снимки-объекты 30 раз/с; 2 — компактные изменения 15 раз/с, hello.
export const PROTOCOL = 2;

export const TICK = 30;                 // шагов симуляции на сервере в секунду
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без 0/O и 1/I
export const NAME_MAX = 16;

// режимы, в которые можно играть по сети (правила — те же файлы src/modes/*)
export const ONLINE_MODES = ['duel', 'teams', 'ffa'];
export const onlineModeId = (id) => (ONLINE_MODES.includes(id) ? id : 'duel');
export const slotsOf = (modeId) => modeById(modeId).slots ?? 2;
export const teamOfSlot = (modeId, i) => modeById(modeId).teamOf?.(i) ?? String(i);


export const validHero = (id) => (HEROES.some((h) => h.id === id) ? id : HEROES[0].id);

// ---------- команда бойца ----------
// { moveX, moveZ, aimDir, attack?, ult? } ↔ { mx, mz, ad, a, u }
// attack / ult: 0 — без направления (автоприцел), [x, z] — направление или точка
const vec = (v) => (v ? [Math.round(v.x * 100) / 100, Math.round(v.z * 100) / 100] : 0);
const unvec = (a) => (Array.isArray(a) && a.length === 2 && a.every(Number.isFinite) ? { x: a[0], z: a[1] } : null);

// k — номер последнего снимка, который дошёл до игрока: по нему сервер не шлёт
// новые снимки в забитый канал (см. server/index.js)
export function encodeCmd(cmd, seq, lastSnap = 0) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const m = { t: 'in', s: seq, k: lastSnap, mx: r2(cmd.moveX || 0), mz: r2(cmd.moveZ || 0) };
  if (cmd.aimDir) m.ad = vec(cmd.aimDir);
  if (cmd.attack !== undefined) m.a = vec(cmd.attack);
  if (cmd.ult !== undefined) m.u = vec(cmd.ult);
  return m;
}

// разбор с проверкой: от клиента может прийти что угодно
export function decodeCmd(m) {
  let mx = Number(m.mx) || 0, mz = Number(m.mz) || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const cmd = { moveX: mx, moveZ: mz, aimDir: unvec(m.ad) };
  if ('a' in m) cmd.attack = unvec(m.a);
  if ('u' in m) cmd.ult = unvec(m.u);
  return cmd;
}

// ---------- состояние бойца в снимке: компактно и только изменения ----------
// Боец — массив целых чисел (координаты в сантиметрах, углы в сотых радиана):
//   [x, z, facing, hp, alive, respawnIn×10, lift, grabbedBy, kills, moveX, moveZ, aimAngle, effects]
// effects — строка «имя:секунды[:множитель×100]» через запятую (меняется раз в секунду, не каждый шаг).
// В снимке идёт не всё, а только поля, которые изменились с прошлого снимка этому игроку:
//   [номер бойца, маска изменённых полей, ...значения]. Стоит на месте — не передаётся вовсе.
export const SNAP_RATE = 15;             // снимков в секунду каждому игроку (бой считается 30 раз в секунду)
const NO_AIM = -999;
const FIELD_COUNT = 13;
const q = (v) => Math.round(v * 100);

function packEffects(effects) {
  return Object.keys(effects).sort().map((k) => {
    const e = effects[k];
    return e.mul != null ? `${k}:${Math.ceil(e.t)}:${Math.round(e.mul * 100)}` : `${k}:${Math.ceil(e.t)}`;
  }).join(',');
}

export function packFighter(f, fighters) {
  const kit = !!f.kit;
  return [
    q(f.pos.x), q(f.pos.z), q(f.facing), f.hp, f.alive ? 1 : 0,
    Number.isFinite(f.respawnIn) ? Math.round(f.respawnIn * 10) : -1,
    q(f.lift), f.grabbedBy ? fighters.indexOf(f.grabbedBy) : -1,
    kit ? f.kills : 0,
    kit ? q(f.cmd?.moveX ?? 0) : 0, kit ? q(f.cmd?.moveZ ?? 0) : 0,     // чем управляют бойцом — для анимации у других
    kit && f.cmd?.aimDir ? q(Math.atan2(f.cmd.aimDir.x, f.cmd.aimDir.z)) : NO_AIM,
    packEffects(f.effects),
  ];
}

/** Что изменилось: [маска, ...значения] или null, если ничего. prev = null — всё (первый снимок). */
export function diffFighter(prev, cur) {
  let mask = 0;
  const vals = [];
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (!prev || prev[i] !== cur[i]) { mask |= 1 << i; vals.push(cur[i]); }
  }
  return mask ? [mask, ...vals] : null;
}

/** Применить изменения к сохранённому массиву бойца (на устройстве). */
export function applyFighterDiff(arr, mask, vals) {
  let j = 0;
  for (let i = 0; i < FIELD_COUNT; i++) if (mask & (1 << i)) arr[i] = vals[j++];
  return arr;
}

/** Массив бойца → понятный объект для синхронизации. */
export function unpackFighter(a) {
  const e = {};
  if (a[12]) {
    for (const part of a[12].split(',')) {
      const [k, t, mul] = part.split(':');
      e[k] = mul != null ? { t: Number(t), mul: Number(mul) / 100 } : { t: Number(t) };
    }
  }
  return {
    x: a[0] / 100, z: a[1] / 100, fa: a[2] / 100, hp: a[3], al: a[4],
    rs: a[5] < 0 ? -1 : a[5] / 10, l: a[6] / 100, g: a[7], k: a[8],
    m: [a[9] / 100, a[10] / 100],
    ad: a[11] === NO_AIM ? null : [Math.sin(a[11] / 100), Math.cos(a[11] / 100)],
    e,
  };
}

// предметы на карте: '1' — лежит, '0' — подобран и ждёт появления
export const encodePickups = (spots) => spots.map((s) => (s.active ? '1' : '0')).join('');

// ---------- сетевой режим ----------
// Те же правила, что у обычного режима (src/modes/<id>.js), только состав готовый:
// roster — [{ name, hero, bot }] по местам. you — твоё место на этом устройстве,
// на сервере — null (там у людей control 'remote', у ботов — 'bot').
// На устройстве все, кроме тебя, — 'remote': ими управляют команды с сервера.
export function createOnlineMode({ modeId, roster, you = null }) {
  const base = modeById(onlineModeId(modeId));
  const onServer = you === null;
  return {
    ...base,
    id: `online-${base.id}`,
    baseId: base.id,
    setup(match, opts = {}) {
      base.setup(match, {
        ...opts,
        you,
        roster: roster.map((r, i) => ({
          heroId: validHero(r.hero),
          name: r.name || heroById(r.hero).name,
          control: onServer ? (r.bot ? 'bot' : 'remote') : i === you ? 'local' : 'remote',
        })),
      });
    },
    // на устройстве счёт, выбывания и конец матча решает сервер — здесь только картинка и звук
    onDeath: onServer ? base.onDeath : base.deathFx,
    update: onServer ? base.update : undefined,
  };
}
