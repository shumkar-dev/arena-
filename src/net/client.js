// ============================================================
// СВЯЗЬ С ИГРОВЫМ СЕРВЕРОМ (WebSocket). Протокол — src/net/protocol.js.
// Адрес: ?ws=… в адресе страницы → VITE_ARENA_WS при сборке → сервер игры.
// ============================================================

const params = new URLSearchParams(location.search);
export const SERVER_URL = params.get('ws') || import.meta.env.VITE_ARENA_WS || 'wss://vsadniki.duckdns.org/arena-ws';

export function createNet(url = SERVER_URL) {
  const handlers = new Map();          // тип сообщения → Set(функций)
  let ws = null;
  let pingTimer = 0;
  const pings = [];

  const emit = (type, msg) => { for (const fn of handlers.get(type) ?? []) fn(msg); };

  const net = {
    status: 'idle',     // idle | connecting | open | closed
    ping: null,         // мс туда-обратно: сколько идёт сообщение до сервера и ответ обратно (медиана 5 замеров)
    lastSnap: 0,        // номер последнего полученного снимка — уходит серверу в командах

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
        if (m.t === 'start') net.lastSnap = 0;   // у нового боя снимки считаются заново
        emit(m.t, m);
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
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

    create(name, hero, ducks) { net.whenOpen({ t: 'create', name, hero, ducks }); },
    join(code, name, hero, ducks) { net.whenOpen({ t: 'join', code, name, hero, ducks }); },
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
