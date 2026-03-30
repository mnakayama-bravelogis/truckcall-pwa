self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 古いキャッシュを全削除
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// fetchハンドラーなし（キャッシュ不使用）

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
      return clients.openWindow('/truckcall-pwa/');
    })
  );
});
