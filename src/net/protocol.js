import { ARENA } from '../game/arena.js';
import { heroById, HEROES } from '../heroes/index.js';
import duel from '../modes/duel.js';

// ============================================================
// СЕТЕВОЙ ПРОТОКОЛ — общий для сервера (server/) и игры.
// Транспорт — WebSocket, сообщения — JSON { t: тип, ... }.
//
// Игра → сервер
//   create { name, hero }            создать комнату (ответ: room { code })
//   join   { code, name, hero }      войти по коду
//   in     { s, mx, mz, ad?, a?, u? } команда бойца (encodeCmd), s — номер по порядку
//   again                            «Ещё раз» после конца матча
//   leave                            выйти из комнаты
//   ping   { c }                     замер пинга (ответ: pong { c })
//
// Сервер → игра
//   room   { code }                  комната создана, ждём друга
//   start  { you, players: [{ name, hero }] }   бой начался; you — твой номер (0 — юг, 1 — север)
//   s      { tm, ack, f: [бойцы], ev: [события], sc: [счёт] }   снимок 30 раз в секунду
//   end    { winners, reason }       матч окончен
//   again  { n }                     сколько игроков нажали «Ещё раз»
//   left                             соперник вышел
//   err    { msg }                   ошибка (нет комнаты, занята…)
//
// Сервер авторитетный: бой считает он. Игра считает свою копию только для
// картинки (анимации, снаряды, эффекты), а ХП, смерти и счёт берёт из снимков.
// ============================================================

export const TICK = 30;                 // шагов симуляции на сервере в секунду
export const TEAMS = ['blue', 'red'];
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без 0/O и 1/I
export const NAME_MAX = 16;

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
export function encodeFighter(f, fighters) {
  const effects = {};
  for (const k in f.effects) effects[k] = { ...f.effects[k], t: r3(f.effects[k].t) };
  return {
    x: r3(f.pos.x), z: r3(f.pos.z), fa: r3(f.facing),
    hp: f.hp, al: f.alive ? 1 : 0,
    rs: Number.isFinite(f.respawnIn) ? r3(f.respawnIn) : -1,
    k: f.kills, l: r3(f.lift),
    g: f.grabbedBy ? fighters.indexOf(f.grabbedBy) : -1,
    e: effects,
    m: [r3(f.cmd?.moveX ?? 0), r3(f.cmd?.moveZ ?? 0)],   // чем сейчас управляет игрок — для анимации у соперника
    ad: vec(f.cmd?.aimDir),
  };
}

// ---------- режим «1 на 1 с другом» ----------
// Те же правила, что у дуэли (src/modes/duel.js), но оба бойца — люди.
// players: [{ name, hero }]; you — номер своего игрока на этом устройстве (на сервере — нет)
const spawnOf = (slot) => (slot === 0
  ? { x: 0, z: ARENA.halfL - 3, facing: Math.PI }
  : { x: 0, z: -ARENA.halfL + 3, facing: 0 });

export function createOnlineMode({ players, you = null }) {
  const onServer = you === null;
  return {
    ...duel,
    id: 'online',
    name: 'С другом',
    setup(match) {
      players.forEach((p, i) => {
        const mine = i === you;
        match.addHero(validHero(p.hero), {
          name: p.name || heroById(p.hero).name,
          team: TEAMS[i],
          control: mine ? 'local' : 'remote',
          side: onServer ? 'enemy' : mine ? 'self' : 'enemy',
          spawn: spawnOf(i),
        });
      });
      match.state = { kills: { blue: 0, red: 0 } };
    },
    // на устройстве счёт и конец матча приходят с сервера
    onDeath: onServer ? duel.onDeath : () => {},
  };
}
