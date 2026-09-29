const CACHE_NAME = 'camera-node-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// インストール時：基本ファイルを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 新しいService Workerを即座にアクティブ化
  self.skipWaiting();
});

// アクティベート時：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチ時：Network First (ネットワーク優先、失敗時にキャッシュ)
self.addEventListener('fetch', (event) => {
  // http/https 以外の通信（ws:// や chrome-extension 等）は対象外
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 正常に取得できた場合、キャッシュを最新化して返す
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // オフライン等の理由でネットワーク通信が失敗した場合、キャッシュから返す
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // キャッシュにも無い場合のフォールバック（HTMLリクエストの場合）
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      })
  );
});
