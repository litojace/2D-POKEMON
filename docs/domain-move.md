# Moving the game to play.elementarenausa.com

Owner's decision (25 Nov 2026): the game moves from `parena.litojace.com` to
**`play.elementarenausa.com`**. The introduction website takes the apex
`elementarenausa.com` (`www` redirects there; the website session builds it
from `apps/site`). The old address keeps serving the same game during the
move, with a banner offering the new one; a redirect (keeping the path and
query, so `?room=`, `?auth=` and old QR codes still work) comes later, when
the owner decides.

Status and progress notes are at the end. Every production step below needs
the owner's go-ahead once, on the exact list (CLAUDE.md, "Still ask the owner
first").

## What was checked (25 Nov, read-only)

- **Render:** the Static Site `2D-POKEMON` (`srv-dbhs7suc6qcc73eprc0g`,
  `twod-pokemon.onrender.com`) has one custom domain, `parena.litojace.com`
  (verified), no redirect/rewrite rules and no custom headers. The web service
  `element-arena` has no custom domain, `CLIENT_ORIGIN=https://parena.litojace.com`.
- **Cloudflare:** zone `elementarenausa.com` is active with no records yet.
  Zone `litojace.com`: `parena` is a CNAME to `element-arena-np34.onrender.com`,
  DNS only (grey). It works because Render routes by host name, but the
  documented target for a Static Site is its own `twod-pokemon.onrender.com`.
  Both zones: SSL/TLS mode Full, no redirect rules, no CAA records.
- **Render redirect rules can't do the old-domain redirect:** they match the
  path only (not the host), so a rule would also fire on the new domain, and
  they never apply where a file exists (`/` is `index.html`). So the redirect
  is a Cloudflare **Single Redirect** in the `litojace.com` zone instead,
  which needs the `parena` record to be proxied (orange).
- **Sign-in uses the implicit flow** (supabase-js `createClient`, no PKCE), so
  tokens come back in the `#fragment`. Browsers keep the fragment across a
  redirect, and no code verifier is stored per origin, so an old email link
  that lands on `parena…` and is redirected still signs in on `play.…`.
- **Installed web app (PWA):** its service worker fetches page navigations
  from the network (`sw.ts`, `NavigationRoute` with `fetch`), so an old home
  screen icon would follow a redirect (step 11) to the new address. It then opens outside
  the installed app's scope (Safari/Chrome shows the browser bar), so players
  should add the game to the home screen again.
- **Sign in with Apple (web)** goes through Supabase: the Apple Services ID's
  domain and return URL are `<project>.supabase.co` (docs/accounts-setup.md),
  not the game's domain. No Apple change is needed for the web. Supabase sends
  players back to the `redirectTo` the game asks for, which must be allowed in
  Supabase's Redirect URLs.
- **Email addresses** (`privacy@litojace.com`, `noreply@mail.litojace.com`)
  stay: mail runs through Cloudflare Email Routing and Resend on
  `litojace.com`, which this move doesn't touch.

## Order of the move

Each step can be undone on its own; "Undo" says how.

1. **Render: add `play.elementarenausa.com` to the Static Site**, beside
   `parena.litojace.com` (both serve the game).
   Undo: remove the custom domain.
2. **Cloudflare (`elementarenausa.com`): `CNAME play → twod-pokemon.onrender.com`,
   DNS only (grey).** Render checks the record and issues its certificate
   (usually minutes). Grey keeps Render's own certificate and cache in charge,
   as `parena` is today. Undo: delete the record.
3. **Check** `curl -I https://play.elementarenausa.com/` (200, Render's
   certificate), `/sw.js`, `/manifest.webmanifest`, `/privacy.html`,
   `/support.html`, `/email-confirmed`.
4. **Render web service `element-arena`: `CLIENT_ORIGIN=https://play.elementarenausa.com,https://parena.litojace.com`**
   (the server already takes a comma list, `api-cors.ts`). This redeploys the
   game server: matches in progress finish first (drain, docs/server-updates.md).
   Undo: set it back to `https://parena.litojace.com`.
5. **Supabase → Authentication → URL Configuration** (owner, in the dashboard):
   - Site URL: `https://play.elementarenausa.com`
   - Redirect URLs, add: `https://play.elementarenausa.com/**`,
     `https://elementarenausa.com/**` (the website's account area, later), and
     keep `https://parena.litojace.com/**` for 30 days so links already sent
     still pass.
   - Authentication → Emails → Templates: paste the updated
     `supabase/templates/confirm-signup.html` and `reset-password.html` (their
     logo, banner and footer links now use the new address).
     Undo: Site URL back to `https://parena.litojace.com`.
6. **Merge the code PR** (render.yaml's `VITE_SITE_URL`, the share link's
   default, invite and test examples, email templates, privacy page wording,
   docs). FULL lane (render.yaml).
7. **Render Static Site: `VITE_SITE_URL=https://play.elementarenausa.com`**,
   then redeploy. From this build, email confirmations, password resets, email
   changes and Apple sign-in return to the new address, and the share
   card's QR code points there (until the website session points `SHARE_SITE`
   at `https://elementarenausa.com`). Undo: set it back and redeploy.
8. **Check on the new address:** sign up (email arrives, link signs in),
   sign in, forgot password (link opens the reset form), change email, Sign in
   with Apple, guest play, invite link `?room=` joins the room, the socket
   connects (a match starts), install as an app (Chrome's install prompt,
   iPhone Add to Home Screen), privacy and support pages.
9. **The old address keeps serving the same game** (root and coordinator
   sessions, 25 Nov): installs on `parena.litojace.com` keep their sign-in,
   settings and push. From step 7's build, the game shows a light banner
   there (`domain-move.ts`, through `announcements.ts`): "Element Arena moved
   to play.elementarenausa.com…" with **Open** and **Later**; never in a
   battle, and back every three days until they move. Old links, email links
   and QR codes keep working because the old address is still live.
   Optionally, set the `parena` record's target to `twod-pokemon.onrender.com`
   (DNS only), the Static Site's own name, as the documented target.
10. **iPhone app** (owner, on the Mac): set `VITE_SITE_URL=https://play.elementarenausa.com`
    in `apps/client/.env.ios`, build and upload a new TestFlight build
    (docs/ios-app.md). Builds already installed keep working: their privacy
    and support links and email links point at `parena…`, which redirects.
    App Store Connect: privacy policy URL and support URL to the new address
    (store listing, owner).
11. **Later, when the owner decides (for example before the App Store
    launch): redirect the old address.** Players on it are signed out once
    there, so it waits until most have moved.
    - Set the `parena` record to **Proxied** (orange), target
      `twod-pokemon.onrender.com`.
    - Cloudflare Single Redirect in the `litojace.com` zone: Request URL
      `http*://parena.litojace.com/*` → `https://play.elementarenausa.com/${2}`,
      preserve query string **on**, **302** for the first week, then **301**
      (browsers keep a 301, so it waits until we're sure).
    - Check: `curl -I "https://parena.litojace.com/?room=AB12CD"` → `302`,
      `location: https://play.elementarenausa.com/?room=AB12CD`; the same for
      `/?auth=reset-password`, `/email-confirmed`, `/privacy.html`.
    - Undo: turn the rule off and set `parena` back to DNS only. Render keeps
      the custom domain, so the old address serves the game again.
    - Render's own redirect rules can't do this (they match the path, not
      the host, and never apply where a file exists, like `/`).
      Keep the redirect and the `parena` record for good afterwards (old QR
      codes live on in saved pictures). Supabase's `parena` Redirect URL and
      `CLIENT_ORIGIN`'s `parena` entry go 30 days after the redirect starts.

## What players notice

- **Web players sign in once more when they move** (not before: the old
  address keeps serving). A new address has empty storage, so the saved
  session (`parena-auth`) stays behind on the old address. Guests on the
  web start over unless they added an email (a guest's progress is tied to the
  device's anonymous account). The banner on the old address says so.
- **Home screen icons:** the old icon keeps opening the game on the old
  address, with the banner. Add the game to the home screen again from the
  new address. (After the redirect in step 11, the old icon opens the new
  address in the browser.)
- **iPhone app players:** nothing changes (the app has its own storage).

## Shared sign-in with the website (later, the website session)

After the website runs at `elementarenausa.com`, the website session moves the
game's session storage to a cookie on `.elementarenausa.com` so Play opens
the game signed in (`apps/site/ACCOUNTS.md` on `site/landing-page`). That
change is in `apps/client/src/accounts.ts` and belongs to the website session;
this move doesn't touch how the session is stored.

## Progress

- 25 Nov, ~3:50 PM PT: plan written, checks above done, draft PR #481.
- 25 Nov, ~4:10 PM PT: no redirect at first (root/coordinator sessions);
  banner on the old address added. Waiting for the owner's go-ahead on the
  production list.
- 25 Nov, ~3:56 PM PT: the owner approved steps 1–8 (redirect postponed),
  plus removing `SUPABASE_DB_URL` from the Static Site (its build doesn't
  use it) and `Cache-Control: no-cache` on `/sw.js`. This session's
  permission check blocked the first Render write, because the approval was
  given in the root session; the owner was asked to confirm here or do the
  steps by hand.
- 25 Nov, ~4:05 PM PT: **on hold before step 1** (coordinator, from the
  shared sign-in security review). The cookie storage ignores a session
  already in localStorage on `play.`, so `play.` goes live only once the
  website session's cookie PR carries a one-time move into the cookie, or
  lands first. Steps 4 (Site URL) and 7 wait too; adding Redirect URLs and
  `CLIENT_ORIGIN` early is harmless.
- 25 Nov, ~4:10 PM PT: **hold lifted.** The cookie PR (#484) reads the
  cookie first and falls back to the origin's own local/session storage,
  then moves the session into the cookie on the next write (checked in
  `packages/shared/src/session-cookie.ts` on the PR). A session made on
  `play.` before #484 lands is kept. This holds only while #484 keeps that
  fallback. Waiting for the owner to confirm in this session (or do steps
  1–3 by hand).
