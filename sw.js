// Service worker: network-first, falls back to cache so the app works offline.
const CACHE = 'podvig-v6';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/store.js', 'js/logic.js', 'js/ui.js', 'js/dates.js', 'js/defaults.js',
  'js/views/home.js', 'js/views/today.js', 'js/views/schedule.js', 'js/views/more.js',
  'js/views/training.js', 'js/views/money.js', 'js/views/faith.js',
  'js/orthodox.js', 'js/prayers.js', 'js/push.js', 'js/data/saints.js', 'js/data/topics-a.js', 'js/data/topics-b.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

// ---- morning notification ----
// The push only wakes the phone; the text was prepared by the app and stored in IndexedDB.
function readMorning() {
  return new Promise((resolve) => {
    const req = indexedDB.open('podvig');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) return resolve(null);
      const get = db.transaction('kv').objectStore('kv').get('morning');
      get.onsuccess = () => resolve(get.result ? get.result.v : null);
      get.onerror = () => resolve(null);
    };
  });
}
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { /* empty push */ }
  e.waitUntil((async () => {
    const all = await readMorning();
    const msg = (all && all[localDate()]) || { title: 'Подвиг', body: 'Добро утро! Отвори приложението, за да видиш днешния план.' };
    await self.registration.showNotification(data.test ? '🔔 ' + msg.title : msg.title, {
      body: msg.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'morning', data: { url: './#/today' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate('./#/today'); return c.focus(); } }
    return self.clients.openWindow('./#/today');
  }));
});
