# Static frontend and Render cold starts

The free Render Web Service serves both Express and the built game by default.
Render's own cold-start response arrives before our HTML and cannot be restyled
by application code. A separate Static Site serves our HTML/assets immediately;
the startup crystal animation then waits for the existing backend to wake.

## Render configuration

Create a **Static Site**, connected to the same repository and `main` branch:

- Root directory: empty (repository root)
- Build command: `npm ci --include=dev && npm run build`
- Publish directory: `apps/client/dist`
- `NODE_VERSION=22.16.0`
- `VITE_SERVER_URL=https://element-arena-np34.onrender.com` (the existing backend)
- `VITE_SITE_URL=https://parena.litojace.com`
- Copy the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.

Keep service-role keys, access tokens and other server secrets on the Web Service.
The frontend only uses the public Supabase URL/anon key.

On the **Web Service**, set `CLIENT_ORIGIN` to the exact frontend origin:
`https://twod-pokemon.onrender.com` for testing, then
`https://parena.litojace.com` after moving the custom domain. No trailing slash.
API CORS and Socket.IO use this origin; authenticated requests still require the
user's bearer token. Same-origin requests to the existing server continue working.

Before moving the custom domain, check the static URL: signed-in return, login,
signup, guest, friends and game connection. Email/OAuth redirects still target
`VITE_SITE_URL`; check those on the final domain, and retain the production domain
in Supabase's allowed redirect URLs. If testing those flows at the temporary URL,
use it for `VITE_SITE_URL` and allow it in Supabase, then restore production.

Move `parena.litojace.com` from the Web Service to the Static Site, following
Render's custom-domain/DNS instructions. Keep the backend `.onrender.com` URL in
`VITE_SERVER_URL`; do not point it back at the static domain. Keep the Web Service
running for API/gameplay. Set Static Site cache headers for `/sw.js`,
`/index.html` and `/manifest.webmanifest` to `Cache-Control: no-cache`, so installed
clients can discover updates. Under **Redirects/Rewrites**, add these three
**Rewrite** rules (each destination is `/index.html`):

| Source             | Destination   | Action  |
| ------------------ | ------------- | ------- |
| `/email-confirmed` | `/index.html` | Rewrite |
| `/reset-password`  | `/index.html` | Rewrite |
| `/auth/callback`   | `/index.html` | Rewrite |

These serve the app at the auth callback paths while preserving the URL for
Supabase. Do not add a blanket `/*` SPA rewrite: missing JS must return 404,
not HTML. Verify the three callback paths return the app on the final domain.

## Startup behavior

The initial `/api/health` probe is shared by authentication and the socket. The
client requires a successful JSON response with `ok: true`: Render's HTML wait
page, gateway failures and network errors are retried. Each request has an
8-second timeout, retries are 2 seconds apart, and the whole wait is bounded at
2 minutes. The retry button starts a fresh wait and reloads the profile.

The crystal animation appears only after 250 ms, avoiding flashes on warm
servers. Offline status recovers automatically during the wait. The motion is
disabled under `prefers-reduced-motion`. Profiles and socket connections wait for
readiness; authenticated mutations are never automatically replayed.

The gold connection bar is an estimate, since Render does not expose boot
percentages. It advances smoothly toward 92% while waiting, pauses when offline
or timed out, and resets on retry. Only a successful health response fills it
completely; the finished bar remains briefly before the overlay closes. No
estimated numerical percentage is presented as measured loading progress.

Success is reused for 60 seconds and rechecked on later auth transitions. There
is no periodic keep-alive and ordinary gameplay/API actions do not show this
startup overlay. This improves the waiting experience; it does not remove Render's
cold-start delay.

## Validation

- `tests/unit/server-startup.test.ts`: shared probes, cold start/network retry,
  bounded hung requests, offline recovery, idle-tab auth, no keep-alive timers.
- `tests/integration/api-cors.test.ts`: health, preflight, authenticated API,
  error responses, untrusted origins and unchanged same-origin access.
- `tests/visual/server-startup.spec.ts`: real client waiting before its profile,
  desktop/phone/short phone layouts, automatic entry and reduced motion.
