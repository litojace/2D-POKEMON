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
- `VITE_SITE_URL=https://play.elementarenausa.com`
- Copy the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.

Keep service-role keys, access tokens and other server secrets on the Web Service.
The frontend only uses the public Supabase URL/anon key.

On the **Web Service**, set `CLIENT_ORIGIN` to the exact frontend origin:
`https://twod-pokemon.onrender.com` for testing, then
`https://play.elementarenausa.com` (plus `https://parena.litojace.com` while it
still redirects: `CLIENT_ORIGIN` takes a comma-separated list). No trailing slash.
The game's address moved on 25 Nov 2026: [domain-move.md](domain-move.md).
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
clients can discover updates.

New auth emails return to `/?auth=…` on the site root. Links in older emails
still point at `/email-confirmed`, `/reset-password` and `/auth/callback`; the
client build copies `index.html` to `<path>.html` for each of them (Render serves
it for both `/<path>` and `/<path>/`; see `apps/client/vite.config.ts`), so the Static Site serves the
app there with **no Redirects/Rewrites rule**, and `scripts/verify-pwa.mjs`
checks the copies exist. Do not add a blanket `/*` SPA rewrite: missing JS must
return 404, not HTML. Verify the three callback paths return the app on the
final domain.

## Build filter

A commit to `main` that changes only docs, tests, the website or CI is not
built or deployed: it saves Render's build minutes and doesn't restart the
server (players would be disconnected and reconnect). Both services that build
the game skip these paths:

```
docs/**
tests/**
apps/site/**
.github/**
**/*.md
```

Nothing the build or the running game reads is in them: a build with all of
them deleted is byte for byte the same (checked 27 Nov 2026), and
`tests/unit/render-build-filter.test.ts` fails if build or server code starts
pointing at one. A commit that also changes any other file deploys as before.
A skipped commit shows in the service's Events as "commit ignored", and the
live page's `<meta name="arena-build">` keeps the last commit that deployed.

Where each filter lives:

- **Server (`element-arena`)**: `buildFilter` in `render.yaml`, applied by the
  Blueprint's sync. Keep the field there: a sync without it removes the filter.
- **Game Static Site (`2D-POKEMON`)**: it is not in `render.yaml`, so its
  filter is in Render's settings: Dashboard → 2D-POKEMON → Settings → Build &
  Deploy → Build Filters → Ignored Paths. Or by API: read it with
  `GET https://api.render.com/v1/services/srv-dbhs7suc6qcc73eprc0g`
  (`buildFilter`), change it with `PATCH` on the same URL and the body
  `{"buildFilter": {"paths": [], "ignoredPaths": [...]}}`.
- The website (`element-arena-site`) needs none: its root directory
  `apps/site` already limits it.

Change the two lists together, and the test's list with them. Never add a
path the build reads (the code, `scripts/`, `supabase/`, `package*.json`):
its change would then never reach players.

## Security headers

Since the shared sign-in (#484), the game and the website keep one session
cookie that scripts can read, so a script injected into the game could reach
both. The game's Static Site sends these headers on `/*` (Render → Static
Site → Redirects/Headers). The source of truth is
`apps/client/security-headers.json`; `tests/unit/security-headers.test.ts`
fails when an inline script changes without its hash, when the client calls a
host the policy doesn't allow, or when this list drifts from the file.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-ZUfnpofFS03gzg2lFnuIR/yasY6fcPLurwCbYKKB6Mo=' 'sha256-ypk5TKIXlesdkcgbABUY+mPA5yJZjnntiSzwtP8U6og=' 'sha256-00y+Y3WQbP67KpsHbqQw6oClsDR/TzTa/BTdg1vUNyk='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://element-arena-np34.onrender.com; font-src 'self'; connect-src 'self' https://zrmbdtvuriiikvwcvqfj.supabase.co https://element-arena-np34.onrender.com wss://element-arena-np34.onrender.com; media-src 'self' data: blob:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- **Inline scripts** in `index.html` (three small boot scripts) are allowed
  by their SHA-256 hash, never by `'unsafe-inline'`. Change one and the test
  prints the new hash to put in the JSON file and in Render.
- **Styles** keep `'unsafe-inline'`: the game sets inline styles from code
  everywhere, and style injection can't run script.
- **Hosts:** the game server (`VITE_SERVER_URL`, https and wss for the
  socket, images for portraits and avatar photos) and the Supabase project
  (https; the client uses no realtime socket). `data:` and `blob:` images are
  canvas exports, the share card, the QR code and fighter art. No eval, no
  workers besides the service worker, no WASM.
- **Rollout (done 25 Nov):** Report-Only from 6:15 PM PT; enforcing
  `Content-Security-Policy` from 6:43 PM PT, after clean passes (zero
  violations) through boot, guest sign-in, Shop, share card, Plaza and a bot
  match on `play.` and on `parena.`. **Rollback:** in Render, rename the
  header back to `Content-Security-Policy-Report-Only` (same value): the
  game stops enforcing within seconds and violations still show in the
  console.
- The iPhone app loads the game from its own files (`capacitor://localhost`),
  so these headers don't apply there.
- **Live check:** `node scripts/check-live-headers.mjs` compares what
  `https://play.elementarenausa.com` serves (`/` and `/privacy.html`) with
  the file, and checks that the served page's inline scripts are allowed by
  the CSP it is served with (`--require-enforcing` refuses Report-Only;
  `NODE_USE_ENV_PROXY=1` behind a proxy). The **Live headers** workflow runs
  it after each push to main that can change them (retrying 20 minutes while
  Render deploys) and every day, and opens the issue "Live game headers
  differ from the repo" on a mismatch (closed when it matches again).
- **Changing an inline script in `index.html`** means updating its hash in
  `security-headers.json` and in Render in the same rollout: put the new
  `Content-Security-Policy` value in Render before the deploy that ships the
  script, or the CSP blocks it for players.

## Startup behavior

The initial `/api/health` probe is shared by authentication and the socket. The
client requires a successful JSON response with `ok: true`: Render's HTML wait
page, gateway failures and network errors are retried. Each request has an
8-second timeout, retries are 2 seconds apart, and the whole wait is bounded at
2 minutes. The retry button starts a fresh wait and reloads the profile.

The startup scene appears only after 250 ms, avoiding flashes on warm
servers. Offline status recovers automatically during the wait. The motion is
disabled under `prefers-reduced-motion`. Profiles and socket connections wait for
readiness; authenticated mutations are never automatically replayed.

The loading screen uses approved concept H, **Starforged Sigil**: a still navy
starfield, a transparent gold-and-cyan compass crest, a gently floating emblem,
soft aura/orbit light and six drifting sparks. Three smooth, differently tilted
SVG orbits stay centered on the crystal and float with it; their unbroken paths
pulse softly without flattening or shifting the loops. The stacked ELEMENT / ARENA logo
is real centered text with balanced tracking. The crest fits between the logo
and footer at each viewport height; short phones also have a compact retry row.
Both WebP plates use content-hashed Vite URLs and are included in PWA precaching.
Unavailable artwork does not block the connection or hide the retry controls.

The gold connection bar is an estimate, since Render does not expose boot
percentages. It advances steadily from 8% to 92% over one minute of active waiting,
then holds if the server takes longer. It pauses when offline or timed out and
resets on retry. Only a successful health response fills it
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
