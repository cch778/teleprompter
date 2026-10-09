/* 提词器 Service Worker：部署到 HTTP(S) 后提供真离线能力。
   策略：HTML 走 network-first（保证代码更新即时生效，断网回退缓存），
   图标等静态资源 cache-first。缓存名带版本号，激活时清掉旧版本。 */
var CACHE = 'teleprompter-v2';
var ASSETS = ['./', './index.html', './icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.headers.get('range')) return;                    // 视频/媒体范围请求不接手

  var isHtml = (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isHtml) {
    /* network-first：在线拿到最新版顺手更新缓存；离线回退 */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
  } else {
    /* 静态资源 cache-first，后台悄悄刷新 */
    e.respondWith(
      caches.match(req).then(function (hit) {
        var refresh = fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return hit; });
        return hit || refresh;
      })
    );
  }
});
