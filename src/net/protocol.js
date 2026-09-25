import { heroById, HEROES } from '../heroes/index.js';
import { modeById } from '../modes/index.js';

// ============================================================
// СЕТЕВОЙ ПРОТОКОЛ — общий для сервера (server/) и игры.
// Транспорт — WebSocket, сообщения — JSON { t: тип, ... }.
//
// Игра → сервер
//   create { name, hero, ducks }       создать комнату (режим — потом, в лобби; по умолчанию 1 на 1)
//   join   { code, name, hero, ducks }  войти по коду
//   mode   { mode }                    создатель выбирает режим в лобби: duel | teams | ffa
//   hero   { hero }                    сменить своего героя в лобби (и между боями)
//   team   { team }                    перейти в команду (2 на 2: blue | red)
//   start                              создатель комнаты начинает бой (пустые места — боты)
//   in     { s, mx, mz, ad?, a?, u? }   команда бойца (encodeCmd), s — номер по порядку
//   leave                              выйти из комнаты
//   ping   { c }                       замер пинга (ответ: pong { c })
//
// Сервер → игра
//   lobby  { code, mode, you, host, slots: [{ name, hero } | null] }   комната до боя и после
//   start  { mode, you, host, roster: [{ name, hero, bot }] }          бой начался; you — твоё место
//   s      { tm, ack, f: [бойцы], ev: [события], sc?, pk? }            снимок 30 раз в секунду
//   end    { winners, reason, res: [{ win, place, topKills, delta }] } итог по героям, delta — утки
//   left   { name }                    игрок вышел из боя — дальше за него играет бот
//   err    { msg }                     ошибка (нет комнаты, занята…)
//
// ducks — утки игрока: по ним сервер выбирает силу ботов в комнате.
// Сервер авторитетный: бой считает он. Игра считает свою копию только для
// картинки (анимации, снаряды, эффекты), а ХП, смерти и счёт берёт из снимков.
// ============================================================

export const TICK = 30;                 // шагов симуляции на сервере в секунду
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без 0/O и 1/I
export const NAME_MAX = 16;

// режимы, в которые можно играть по сети (правила — те же файлы src/modes/*)
export const ONLINE_MODES = ['duel', 'teams', 'ffa'];
export const onlineModeId = (id) => (ONLINE_MODES.includes(id) ? id : 'duel');
export const slotsOf = (modeId) => modeById(modeId).slots ?? 2;
export const teamOfSlot = (modeId, i) => modeById(modeId).teamOf?.(i) ?? String(i);

const r3 = (v) => Math.round(v * 1000) / 1000;

export const validHero = (id) => (HEROES.some((h) => h.id === id) ? id : HEROES[0].id);

// ---------- команда бойца ----------
// { moveX, moveZ, aimDir, attack?, ult? } ↔ { mx, mz, ad, a, u }
// attack / ult: 0 — без направления (автоприцел), [x, z] — направление или точка
const vec = (v) => (v ? [r3(v.x), r3(v.z)] : 0);
const unvec = (a) => (Array.isArray(a) && a.length === 2 && a.every(Number.isFinite) ? { x: a[0], z: a[1] } : null);

export function encodeCmd(cmd, seq) {
  const m = { t: 'in', s: seq, mx: r3(cmd.moveX || 0), mz: r3(cmd.moveZ || 0) };
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

// ---------- состояние бойца в снимке ----------
// Для героев — всё; для бутылок и прохожих — только позиция, ХП и жив ли.
export function encodeFighter(f, fighters) {
  const o = {
    x: r3(f.pos.x), z: r3(f.pos.z), fa: r3(f.facing),
    hp: f.hp, al: f.alive ? 1 : 0,
    rs: Number.isFinite(f.respawnIn) ? r3(f.respawnIn) : -1,
  };
  if (f.lift) o.l = r3(f.lift);
  if (f.grabbedBy) o.g = fighters.indexOf(f.grabbedBy);
  const keys = Object.keys(f.effects);
  if (keys.length) {
    o.e = {};
    for (const k of keys) o.e[k] = { ...f.effects[k], t: r3(f.effects[k].t) };
  }
  if (f.kit) {
    o.k = f.kills;
    o.m = [r3(f.cmd?.moveX ?? 0), r3(f.cmd?.moveZ ?? 0)];   // чем сейчас управляют бойцом — для анимации у других
    if (f.cmd?.aimDir) o.ad = vec(f.cmd.aimDir);
  }
  return o;
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
