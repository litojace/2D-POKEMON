/// <reference lib="webworker" />
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  matchPrecache,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
// The shell the game starts with, installed ahead of time (vite.config.ts
// lists it). No API, OAuth or Socket.IO traffic is ever cached.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

/**
 * Optional content, cached the first time it is used: scripts loaded later
 * (the Farm, Plaza and Bistro, the shop preview) and the raid art that is not
 * precached (splash pictures, thumbnails, portraits, illustrated arenas).
 * Their file names carry a content hash, so a cached copy never goes stale;
 * keeping the scripts also lets a page opened before a deploy still load its
 * own version's worlds afterwards. Each cache keeps its newest entries.
 */
const OPTIONAL = [
  {
    cache: "arena-chunks-v1",
    test: /^\/assets\/[^/]+\.js$/,
    type: "javascript",
    max: 40,
  },
  {
    cache: "arena-art-v1",
    test: /^\/assets\/[^/]+\.webp$/,
    type: "image/",
    max: 48,
  },
] as const;
async function trim(name: string, max: number) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  // Oldest first (a cache lists entries in the order they were added).
  for (const request of keys.slice(0, Math.max(0, keys.length - max)))
    await cache.delete(request);
}
for (const kind of OPTIONAL)
  registerRoute(
    ({ url, request, sameOrigin }) =>
      sameOrigin && request.method === "GET" && kind.test.test(url.pathname),
    async ({ request, event }) => {
      const cache = await caches.open(kind.cache);
      const hit = await cache.match(request);
      if (hit) return hit;
      // Offline with nothing cached: the page's own error handling applies
      // (a world shows "Try again", artwork falls back).
      const response = await fetch(request);
      if (
        response.status === 200 &&
        response.type === "basic" &&
        (response.headers.get("content-type") ?? "").includes(kind.type)
      )
        event.waitUntil(
          cache
            .put(request, response.clone())
            .then(() => trim(kind.cache, kind.max))
            .catch(() => {}),
        );
      return response;
    },
  );
self.addEventListener("activate", (event) => {
  // Optional caches from older versions of this policy.
  const current = new Set<string>(OPTIONAL.map((kind) => kind.cache));
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => /^arena-(chunks|art)-/.test(name) && !current.has(name),
            )
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        return (await matchPrecache("/offline.html")) ?? Response.error();
      }
    },
    {
      allowlist: [/^\/$/, /^\/index\.html$/],
      denylist: [/^\/api(?:\/|$)/, /^\/socket\.io(?:\/|$)/, /^\/auth(?:\/|$)/],
    },
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
