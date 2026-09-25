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

  const emit = (type, msg) => { for (const fn of handlers.get(type) ?? []) fn(msg); };

  const net = {
    status: 'idle',     // idle | connecting | open | closed
    ping: null,         // мс туда-обратно

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
        emit('open');
        const ping = () => net.send({ t: 'ping', c: performance.now() });
        ping();
        pingTimer = setInterval(ping, 2000);
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'pong') { net.ping = Math.round(performance.now() - m.c); emit('ping', net.ping); return; }
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
