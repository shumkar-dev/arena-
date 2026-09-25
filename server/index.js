import http from 'node:http';
import * as THREE from 'three';
import { WebSocketServer } from 'ws';
import { createMatch } from '../src/game/match.js';
import { setMap } from '../src/game/arena.js';
import { mapById } from '../src/maps/index.js';
import { createBotController } from '../src/game/controllers.js';
import { BOT_NAMES } from '../src/game/bot.js';
import { matchParticipants } from '../src/game/results.js';
import { HEROES } from '../src/heroes/index.js';
import { modeById } from '../src/modes/index.js';
import { rewardFor, botSkill } from '../src/rating/ranks.js';
import {
  TICK, CODE_ALPHABET, NAME_MAX,
  validHero, decodeCmd, encodeFighter, encodePickups, createOnlineMode,
  onlineModeId, slotsOf, teamOfSlot,
} from '../src/net/protocol.js';

// ============================================================
// ИГРОВОЙ СЕРВЕР «Всадников Арены» — комнаты по коду: 1 на 1, 2 на 2, каждый сам за себя.
// Авторитетный: бой считает сервер тем же кодом, что и игра (src/game/match.js,
// src/modes/*): бутылки, сигареты, аптечки, прохожие, боты на свободных местах.
// Игроки шлют только команды. 30 раз в секунду — шаг боя и снимок игрокам.
// Итог матча и утки каждому герою тоже считает сервер. Протокол — src/net/protocol.js.
// ============================================================

const PORT = Number(process.env.PORT) || 3001;
const DT = 1 / TICK;
const ROOM_IDLE_MAX = 20 * 60;        // комната без боя живёт 20 минут
const STOP_AFTER_END = 3;             // после конца матча ещё 3 с считаем (добегают анимации), потом — снова лобби
const MAX_MSGS_PER_SEC = 150;
const LAG_MS = Number(process.env.LAG_MS) || 0;   // для проверки: искусственная задержка в каждую сторону

// на сервере ничего не рисуется: сцена-заглушка и эффекты-пустышки
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });

const rooms = new Map();
const log = (...a) => console.log(new Date().toISOString(), ...a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += pick(CODE_ALPHABET);
    if (!rooms.has(c)) return c;
  }
}

const sendNow = (ws, data) => { if (ws.readyState === 1) ws.send(data); };
const send = (ws, msg) => {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
  if (LAG_MS) setTimeout(() => sendNow(ws, data), LAG_MS); else sendNow(ws, data);
};

// команды одного игрока: движение и прицел — последнее присланное,
// удары и ульты — очередью, чтобы ни одно нажатие не потерялось
function createRemoteInput() {
  const inp = { move: { moveX: 0, moveZ: 0, aimDir: null }, attacks: [], ults: [], seq: 0, ack: 0 };
  inp.controller = {
    command() {
      const cmd = { ...inp.move };
      if (inp.attacks.length) cmd.attack = inp.attacks.shift();
      if (inp.ults.length) cmd.ult = inp.ults.shift();
      inp.ack = inp.seq;
      return cmd;
    },
  };
  return inp;
}

function createRoom(code, modeId) {
  const n = slotsOf(modeId);
  const room = {
    code,
    modeId,
    slots: Array(n).fill(null),   // игроки по местам: { ws, name, hero, ducks, input } | null — место бота
    host: null,                   // ws создателя (уйдёт — хозяином станет следующий)
    phase: 'lobby',               // lobby | play
    match: null,
    map: null,
    controllers: null,
    heroes: null,                 // герои матча по местам
    endT: 0,
    idle: 0,

    humans() { return room.slots.filter(Boolean); },
    slotOf(ws) { return room.slots.findIndex((p) => p?.ws === ws); },

    sendLobby() {
      const host = room.slotOf(room.host);
      const slots = room.slots.map((p) => p && { name: p.name, hero: p.hero });
      for (const p of room.humans()) {
        send(p.ws, { t: 'lobby', code, mode: modeId, you: room.slotOf(p.ws), host, slots });
      }
    },

    // новое место: в 2 на 2 — в команду, где людей меньше
    add(player) {
      const free = room.slots.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) return false;
      const count = (team) => room.slots.filter((p, i) => p && teamOfSlot(modeId, i) === team).length;
      free.sort((a, b) => count(teamOfSlot(modeId, a)) - count(teamOfSlot(modeId, b)) || a - b);
      room.slots[free[0]] = player;
      player.ws.room = room;
      if (!room.host) room.host = player.ws;
      return true;
    },

    setTeam(ws, team) {
      const from = room.slotOf(ws);
      if (from < 0 || room.phase !== 'lobby' || teamOfSlot(modeId, from) === team) return;
      const to = room.slots.findIndex((p, i) => !p && teamOfSlot(modeId, i) === team);
      if (to < 0) return;
      room.slots[to] = room.slots[from];
      room.slots[from] = null;
      room.sendLobby();
    },

    start() {
      const base = modeById(modeId);
      room.map = mapById(base.map);
      setMap(room.map);
      const humanNames = room.humans().map((p) => p.name);
      const botPool = BOT_NAMES.filter((b) => !humanNames.includes(b));
      const roster = room.slots.map((p) => {
        if (p) return { name: p.name, hero: p.hero, bot: false };
        const name = botPool.splice(Math.floor(Math.random() * botPool.length), 1)[0] ?? 'Бот';
        return { name, hero: pick(HEROES).id, bot: true };
      });
      const mode = createOnlineMode({ modeId, roster });
      room.match?.dispose();
      room.match = createMatch({ scene: new THREE.Group(), fx: noop, mode });
      mode.setup(room.match, {});

      // сила ботов — по средним уткам людей в комнате (как в обычной игре — по званию)
      const ducks = room.humans().map((p) => p.ducks);
      room.skill = botSkill(ducks.reduce((a, b) => a + b, 0) / Math.max(1, ducks.length));
      room.heroes = room.match.fighters.filter((f) => f.kit);
      room.controllers = new Map();
      room.heroes.forEach((f, i) => {
        const p = room.slots[i];
        if (p) {
          p.input = createRemoteInput();
          room.controllers.set(f, p.input.controller);
        } else {
          room.controllers.set(f, createBotController(f, { skill: room.skill }));
        }
      });
      room.roster = roster;
      room.phase = 'play';
      room.endT = 0;
      room.idle = 0;
      const host = room.slotOf(room.host);
      for (const p of room.humans()) send(p.ws, { t: 'start', mode: modeId, you: room.slotOf(p.ws), host, roster });
      log(`room ${code}: start ${modeId}`, roster.map((r) => `${r.bot ? '🤖' : ''}${r.name}/${r.hero}`).join(', '));
    },

    tick() {
      if (room.phase !== 'play') { room.idle += DT; return; }
      const m = room.match;
      if (m.result && (room.endT += DT) > STOP_AFTER_END) { room.toLobby(); return; }

      setMap(room.map);   // карта — общая на процесс, у каждой комнаты своя
      m.step(DT, room.controllers);
      const fighters = m.fighters;

      // события для игроков: урон, лечение, реплики, удары и ульты (для анимации у остальных)
      const ev = [];
      for (const e of m.events) {
        if (e.type === 'damage') ev.push(['d', fighters.indexOf(e.target), e.amount, e.kind]);
        else if (e.type === 'heal') ev.push(['h', fighters.indexOf(e.target), e.amount]);
        else if (e.type === 'say') ev.push(['say', fighters.indexOf(e.f), e.text]);
      }
      m.events.length = 0;
      fighters.forEach((f, i) => {
        if (!f.kit) return;
        if (f.cmd?.attack !== undefined) ev.push(['a', i, f.cmd.attack ? [f.cmd.attack.x, f.cmd.attack.z] : 0]);
        if (f.cmd?.ult !== undefined) ev.push(['u', i, f.cmd.ult ? [f.cmd.ult.x, f.cmd.ult.z] : 0]);
      });

      const snap = {
        t: 's',
        tm: Math.round(m.world.time * 1000) / 1000,
        f: fighters.map((f) => encodeFighter(f, fighters)),
        ev,
      };
      if (m.state.kills) snap.sc = m.state.kills;
      if (m.world.pickups.spots.length) snap.pk = encodePickups(m.world.pickups.spots);
      for (const p of room.humans()) send(p.ws, { ...snap, ack: p.input?.ack ?? 0 });

      if (m.result && room.endT === 0) {
        room.endT = DT;
        const base = modeById(modeId);
        const res = matchParticipants(m, m.result).map(({ win, place, topKills }) => ({
          win, place, topKills, delta: rewardFor({ modeId: base.id, win, place, topKills }),
        }));
        for (const p of room.humans()) send(p.ws, { t: 'end', winners: m.result.winners, reason: m.result.reason ?? '', res });
        log(`room ${code}: end ${m.result.reason ?? ''}`);
      }
    },

    toLobby() {
      room.match?.dispose();
      room.match = null;
      room.controllers = null;
      room.heroes = null;
      room.phase = 'lobby';
      room.idle = 0;
      for (const p of room.humans()) p.input = null;
      room.sendLobby();
    },

    remove(ws) {
      const i = room.slotOf(ws);
      ws.room = null;
      if (i < 0) return;
      const p = room.slots[i];
      room.slots[i] = null;
      if (room.host === ws) room.host = room.humans()[0]?.ws ?? null;
      if (!room.humans().length) { room.close(); return; }
      if (room.phase === 'play') {
        // вышел посреди боя — его героем дальше играет бот
        const f = room.heroes[i];
        room.controllers.set(f, createBotController(f, { skill: room.skill }));
        room.roster[i] = { ...room.roster[i], bot: true };
        for (const q of room.humans()) send(q.ws, { t: 'left', name: p.name });
      } else {
        room.sendLobby();
      }
    },

    close() {
      room.match?.dispose();
      room.match = null;
      for (const p of room.humans()) p.ws.room = null;
      rooms.delete(code);
      log(`room ${code}: closed`);
    },
  };
  return room;
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Игрок';
const cleanDucks = (d) => Math.max(0, Math.min(5000, Math.round(Number(d) || 0)));
const newPlayer = (ws, msg) => ({ ws, name: cleanName(msg.name), hero: validHero(msg.hero), ducks: cleanDucks(msg.ducks), input: null });

function onMessage(ws, msg) {
  const room = ws.room;
  switch (msg.t) {
    case 'in': {
      const p = room?.slots[room.slotOf(ws)];
      if (!p?.input || !Number.isFinite(msg.s) || msg.s <= p.input.seq) return;
      const cmd = decodeCmd(msg);
      p.input.seq = msg.s;
      p.input.move = { moveX: cmd.moveX, moveZ: cmd.moveZ, aimDir: cmd.aimDir };
      if ('attack' in cmd && p.input.attacks.length < 4) p.input.attacks.push(cmd.attack);
      if ('ult' in cmd && p.input.ults.length < 2) p.input.ults.push(cmd.ult);
      return;
    }
    case 'ping':
      send(ws, { t: 'pong', c: msg.c });
      return;
    case 'create': {
      if (room) room.remove(ws);
      const r = createRoom(newCode(), onlineModeId(msg.mode));
      rooms.set(r.code, r);
      r.add(newPlayer(ws, msg));
      r.sendLobby();
      log(`room ${r.code}: created (${r.modeId})`);
      return;
    }
    case 'join': {
      const code = String(msg.code ?? '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) { send(ws, { t: 'err', msg: 'Комната не найдена. Проверь код.' }); return; }
      if (r === room) { r.sendLobby(); return; }
      if (r.phase === 'play') { send(ws, { t: 'err', msg: 'В этой комнате идёт бой — зайди, когда он закончится.' }); return; }
      if (!r.slots.includes(null)) { send(ws, { t: 'err', msg: 'В комнате нет свободных мест.' }); return; }
      if (room) room.remove(ws);
      r.add(newPlayer(ws, msg));
      r.sendLobby();
      return;
    }
    case 'team':
      if (msg.team === 'blue' || msg.team === 'red') room?.setTeam(ws, msg.team);
      return;
    case 'start':
      if (room && room.host === ws && room.phase === 'lobby') room.start();
      return;
    case 'leave':
      room?.remove(ws);
      return;
    default:
  }
}

// ---------- HTTP (проверка «жив ли») + WebSocket на любом пути (/arena-ws) ----------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(`arena server ok, rooms: ${rooms.size}\n`);
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.room = null;
  let msgs = 0, windowStart = Date.now();
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; msgs = 0; }
    if (++msgs > MAX_MSGS_PER_SEC) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (LAG_MS) setTimeout(() => onMessage(ws, msg), LAG_MS); else onMessage(ws, msg);
  });
  ws.on('close', () => ws.room?.remove(ws));
});

// шаг всех комнат
setInterval(() => {
  for (const room of rooms.values()) {
    try {
      room.tick();
    } catch (e) {
      log(`room ${room.code}: error`, e);
      for (const p of room.humans()) send(p.ws, { t: 'err', msg: 'Ошибка на сервере, бой прерван.' });
      room.toLobby();
    }
    if (room.phase === 'lobby' && room.idle > ROOM_IDLE_MAX) {
      for (const p of room.humans()) send(p.ws, { t: 'err', msg: 'Комната закрыта: долго никто не играл.' });
      room.close();
    }
  }
}, 1000 / TICK);

// обрыв связи без закрытия сокета
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => log(`arena server listening on :${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('bye'); process.exit(0); });
