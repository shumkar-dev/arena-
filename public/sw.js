// Офлайн-кэш игры.
//   • страница и version.json — всегда из сети, мимо HTTP-кэша (иначе телефон держит старую
//     версию); без сети — из кэша;
//   • ассеты со слепком в имени (JS, CSS), звуки и картинки — сначала кэш.
// Регистрируется как sw.js?v=<версия>: у каждой версии свой кэш, старые удаляются.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `arena-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const fresh = (req) => fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('/version.json')) {
    e.respondWith(
      fresh(req)
        .then((res) => {
          if (res.ok && req.mode === 'navigate') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // 206 (кусок музыки) кэш не принимает — кладём только полные ответы
      if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
