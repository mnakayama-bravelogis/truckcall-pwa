const CACHE_NAME = 'truckcall-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// 将来の自前サーバー移行時（Web Push対応）に備えたハンドラ
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'TruckCALL', body: '呼び出しがあります' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'TruckCALL', {
      body: data.message || data.body || '呼び出しがあります',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'truckcall',
      renotify: true,
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
