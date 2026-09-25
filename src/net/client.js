// ============================================================
// СВЯЗЬ С ИГРОВЫМ СЕРВЕРОМ (WebSocket). Протокол — src/net/protocol.js.
// Адрес: ?ws=… в адресе страницы → VITE_ARENA_WS при сборке → сервер игры.
// ============================================================

import { PROTOCOL } from './protocol.js';

const params = new URLSearchParams(location.search);
export const SERVER_URL = params.get('ws') || import.meta.env.VITE_ARENA_WS || 'wss://vsadniki.duckdns.org/arena-ws';

export function createNet(url = SERVER_URL) {
  const handlers = new Map();          // тип сообщения → Set(функций)
  let ws = null;
  let pingTimer = 0;
  let helloTimer = 0;
  const pings = [];

  const emit = (type, msg) => { for (const fn of handlers.get(type) ?? []) fn(msg); };
  const setIssue = (issue) => {
    if (issue === net.versionIssue) return;
    net.versionIssue = issue;
    emit('version', issue);
  };

  const net = {
    status: 'idle',     // idle | connecting | open | closed
    ping: null,         // мс туда-обратно: сколько идёт сообщение до сервера и ответ обратно (медиана 5 замеров)
    lastSnap: 0,        // номер последнего полученного снимка — уходит серверу в командах
    // версии не совпали: 'client' — устарела игра (обновить), 'server' — сервер ещё старый
    versionIssue: null,

    /** Подписка на сообщения сервера и на 'open' / 'close' / 'ping'. Вернёт отписку. */
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },

    connect() {
      if (ws && (net.status === 'open' || net.status === 'connecting')) return;
      net.status = 'connecting';
      ws = new WebSocket(url);
      ws.onopen = () => {
        net.status = 'open';
        // сервер старой версии не присылает hello — через 4 с считаем, что он устарел
        clearTimeout(helloTimer);
        helloTimer = setTimeout(() => setIssue('server'), 4000);
        pings.length = 0;
        net.lastSnap = 0;
        emit('open');
        const ping = () => net.send({ t: 'ping', c: performance.now() });
        ping();
        pingTimer = setInterval(ping, 1000);
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        // снимок боя — массив [1, номер, …] (компактный формат, см. protocol.js)
        if (Array.isArray(m)) {
          if (m[0] === 1) { net.lastSnap = m[1]; emit('s', m); }
          return;
        }
        if (m.t === 'pong') {
          // честный пинг: сообщение идёт в общей очереди со снимками, так что забитый канал видно
          pings.push(performance.now() - m.c);
          if (pings.length > 5) pings.shift();
          net.ping = Math.round([...pings].sort((a, b) => a - b)[pings.length >> 1]);
          emit('ping', net.ping);
          return;
        }
        if (m.t === 'hello') {
          clearTimeout(helloTimer);
          setIssue(m.pv === PROTOCOL ? null : m.pv > PROTOCOL ? 'client' : 'server');
          return;
        }
        if (m.t === 'err' && m.code === 'version') setIssue('client');
        if (m.t === 'start') net.lastSnap = 0;   // у нового боя снимки считаются заново
        emit(m.t, m);
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        clearTimeout(helloTimer);
        const was = net.status;
        net.status = 'closed';
        ws = null;
        emit('close', { was });
      };
    },

    send(msg) {
      if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
    },

    // отправить, как только появится связь
    whenOpen(msg) {
      if (net.status === 'open') { net.send(msg); return; }
      const off = net.on('open', () => { off(); net.send(msg); });
      net.connect();
    },

    create(name, hero, ducks) { net.whenOpen({ t: 'create', name, hero, ducks, pv: PROTOCOL }); },
    join(code, name, hero, ducks) { net.whenOpen({ t: 'join', code, name, hero, ducks, pv: PROTOCOL }); },
    mode(mode) { net.send({ t: 'mode', mode }); },
    hero(hero) { net.send({ t: 'hero', hero }); },
    team(team) { net.send({ t: 'team', team }); },
    start() { net.send({ t: 'start' }); },
    leave() { net.send({ t: 'leave' }); },

    close() {
      clearInterval(pingTimer);
      ws?.close();
      ws = null;
      net.status = 'idle';
    },
  };
  return net;
}
