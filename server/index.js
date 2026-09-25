import http from 'node:http';
import * as THREE from 'three';
import { WebSocketServer } from 'ws';
import { createMatch } from '../src/game/match.js';
import { setMap } from '../src/game/arena.js';
import { mapById } from '../src/maps/index.js';
import {
  TICK, TEAMS, CODE_ALPHABET, NAME_MAX,
  validHero, decodeCmd, encodeFighter, createOnlineMode,
} from '../src/net/protocol.js';

// ============================================================
// ИГРОВОЙ СЕРВЕР «Всадников Арены» — комнаты «1 на 1 с другом».
// Авторитетный: бой считает сервер тем же кодом, что и игра (src/game/match.js),
// игроки шлют только команды. 30 раз в секунду — шаг боя и снимок игрокам.
// Протокол — src/net/protocol.js.
// ============================================================

const PORT = Number(process.env.PORT) || 3001;
const DT = 1 / TICK;
const ROOM_WAIT_MAX = 15 * 60;        // пустая комната живёт 15 минут
const STOP_AFTER_END = 3;             // после конца матча ещё 3 с считаем (добегают анимации)
const MAX_MSGS_PER_SEC = 150;
const LAG_MS = Number(process.env.LAG_MS) || 0;   // для проверки: искусственная задержка в каждую сторону

// у всех комнат одна карта — дорога (режим 1 на 1)
setMap(mapById('road'));

// на сервере ничего не рисуется: сцена-заглушка и эффекты-пустышки
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });

const rooms = new Map();
const log = (...a) => console.log(new Date().toISOString(), ...a);

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
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

function createRoom(code) {
  const room = {
    code,
    players: [],          // { ws, name, hero, input, again }
    match: null,
    scene: null,
    controllers: null,
    endT: 0,
    idle: 0,

    start() {
      room.scene = new THREE.Group();
      const mode = createOnlineMode({ players: room.players.map((p) => ({ name: p.name, hero: p.hero })) });
      room.match = createMatch({ scene: room.scene, fx: noop, mode });
      mode.setup(room.match, {});
      room.controllers = new Map();
      room.match.fighters.forEach((f, i) => {
        const p = room.players[i];
        p.input = createRemoteInput();
        p.again = false;
        room.controllers.set(f, p.input.controller);
      });
      room.endT = 0;
      room.players.forEach((p, i) => send(p.ws, {
        t: 'start', you: i, players: room.players.map((q) => ({ name: q.name, hero: q.hero })),
      }));
      log(`room ${code}: start`, room.players.map((p) => `${p.name}/${p.hero}`).join(' vs '));
    },

    tick() {
      const m = room.match;
      if (!m) { room.idle += DT; return; }
      if (m.result && (room.endT += DT) > STOP_AFTER_END) return;

      m.step(DT, room.controllers);
      const fighters = m.fighters;

      // события для игроков: урон, лечение, реплики, удары и ульты (для анимации у соперника)
      const ev = [];
      for (const e of m.events) {
        if (e.type === 'damage') ev.push(['d', fighters.indexOf(e.target), e.amount, e.kind]);
        else if (e.type === 'heal') ev.push(['h', fighters.indexOf(e.target), e.amount]);
        else if (e.type === 'say') ev.push(['say', fighters.indexOf(e.f), e.text]);
      }
      m.events.length = 0;
      fighters.forEach((f, i) => {
        if (f.cmd?.attack !== undefined) ev.push(['a', i, f.cmd.attack ? [f.cmd.attack.x, f.cmd.attack.z] : 0]);
        if (f.cmd?.ult !== undefined) ev.push(['u', i, f.cmd.ult ? [f.cmd.ult.x, f.cmd.ult.z] : 0]);
      });

      const base = {
        t: 's',
        tm: Math.round(m.world.time * 1000) / 1000,
        f: fighters.map((f) => encodeFighter(f, fighters)),
        ev,
        sc: TEAMS.map((t) => m.state.kills[t]),
      };
      for (const p of room.players) send(p.ws, { ...base, ack: p.input.ack });

      if (m.result && room.endT === 0) {
        room.endT = DT;
        for (const p of room.players) send(p.ws, { t: 'end', winners: m.result.winners, reason: m.result.reason ?? '' });
        log(`room ${code}: end ${m.result.reason ?? ''}`);
      }
    },

    remove(ws) {
      const i = room.players.findIndex((p) => p.ws === ws);
      if (i < 0) return;
      ws.room = null;
      room.players.splice(i, 1);
      for (const p of room.players) send(p.ws, { t: 'left' });
      room.close();
    },

    close() {
      room.match?.dispose();
      room.match = null;
      for (const p of room.players) p.ws.room = null;
      rooms.delete(code);
      log(`room ${code}: closed`);
    },
  };
  return room;
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Игрок';

function onMessage(ws, msg) {
  const room = ws.room;
  switch (msg.t) {
    case 'in': {
      const p = room?.players.find((q) => q.ws === ws);
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
      const r = createRoom(newCode());
      rooms.set(r.code, r);
      r.players.push({ ws, name: cleanName(msg.name), hero: validHero(msg.hero) });
      ws.room = r;
      send(ws, { t: 'room', code: r.code });
      log(`room ${r.code}: created`);
      return;
    }
    case 'join': {
      const code = String(msg.code ?? '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) { send(ws, { t: 'err', msg: 'Комната не найдена. Проверь код.' }); return; }
      if (r.players.length >= 2) { send(ws, { t: 'err', msg: 'В этой комнате уже идёт бой.' }); return; }
      if (room && room !== r) room.remove(ws);
      r.players.push({ ws, name: cleanName(msg.name), hero: validHero(msg.hero) });
      ws.room = r;
      r.start();
      return;
    }
    case 'again': {
      const p = room?.players.find((q) => q.ws === ws);
      if (!p || !room.match?.result) return;
      p.again = true;
      const n = room.players.filter((q) => q.again).length;
      if (n === room.players.length && n === 2) room.start();
      else for (const q of room.players) send(q.ws, { t: 'again', n });
      return;
    }
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
    room.tick();
    if (!room.match && room.idle > ROOM_WAIT_MAX) {
      for (const p of room.players) send(p.ws, { t: 'err', msg: 'Комната закрыта: друг так и не пришёл.' });
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
