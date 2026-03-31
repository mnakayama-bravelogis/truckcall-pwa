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

  e.waitUntil((async () => {
    // OS通知を表示（常に1回のみ）
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'truckcall',
      renotify: true,
      requireInteraction: true,
    });

    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientList.length > 0) {
      // アプリが開いている → postMessageで即時反映（cacheは使わない）
      clientList.forEach(c => c.postMessage({ type: 'push', title, body }));
    } else {
      // アプリがバックグラウンド → cacheに保存（復帰時に読み取る）
      const cache = await caches.open('truckcall-push');
      await cache.put('/pending', new Response(JSON.stringify({ title, body, time })));
    }
  })());
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
