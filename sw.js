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
  const data = e.data ? e.data.json() : { title: 'TruckCALL', message: '呼び出しがあります' };
  const title = data.title || 'TruckCALL';
  const body = data.message || data.body || '呼び出しがあります';
  const time = new Date().toISOString();

  e.waitUntil(
    Promise.all([
      // OS通知を表示
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'truckcall',
        renotify: true,
        requireInteraction: true,
      }),
      // CacheAPIに保存（ページ起動時に読み取る）
      caches.open('truckcall-push').then(cache =>
        cache.put('/pending', new Response(JSON.stringify({ title, body, time })))
      ),
      // フォアグラウンドのページにも即時転送
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
        list.forEach(c => c.postMessage({ type: 'push', title, body }))
      ),
    ])
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
