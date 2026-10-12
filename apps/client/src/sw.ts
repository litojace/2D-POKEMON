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
// Explicit build-time public assets only. No API, OAuth, Socket.IO, or runtime caches.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request);
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
