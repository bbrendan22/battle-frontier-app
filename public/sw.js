const CACHE_PREFIX = 'battle-frontier-';
const CACHE_NAME = `${CACHE_PREFIX}v1.35.0`;
const ROOT = new URL('./', self.location.href);

const coreUrls = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
].map(path => new URL(path, ROOT).href);

const spriteUrls = [];
for (const variant of ['normal', 'shiny']) {
  for (let dex = 1; dex <= 386; dex += 1) {
    spriteUrls.push(new URL(`./sprites/emerald/${variant}/${String(dex).padStart(3, '0')}.png`, ROOT).href);
  }
}

async function cacheOne(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response.clone());
  } catch (_) {
    // A single missing/nonessential file must not prevent installation.
  }
}

async function cacheInBatches(cache, urls, batchSize = 40) {
  for (let i = 0; i < urls.length; i += batchSize) {
    await Promise.all(urls.slice(i, i + batchSize).map(url => cacheOne(cache, url)));
  }
}

async function precacheBuiltAssets(cache) {
  try {
    const indexUrl = new URL('./index.html', ROOT).href;
    const response = await fetch(indexUrl, { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put(indexUrl, response);
    await cache.put(new URL('./', ROOT).href, new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }));

    const assetMatches = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map(match => match[1])
      .filter(value => !value.startsWith('data:') && !value.startsWith('http:') && !value.startsWith('https:'))
      .map(value => new URL(value, indexUrl).href)
      .filter(url => url.startsWith(ROOT.href));
    await cacheInBatches(cache, [...new Set(assetMatches)], 20);
  } catch (_) {
    // Runtime caching will fill anything we could not pre-cache.
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cacheInBatches(cache, coreUrls, 20);
    await precacheBuiltAssets(cache);
    await cacheInBatches(cache, spriteUrls, 40);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(new URL('./index.html', ROOT).href, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match(request))
          || (await cache.match(new URL('./index.html', ROOT).href))
          || (await cache.match(new URL('./', ROOT).href));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
