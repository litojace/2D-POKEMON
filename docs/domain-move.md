# Moving the game to play.elementarenausa.com

Owner's decision (25 Nov 2026): the game moves from `parena.litojace.com` to
**`play.elementarenausa.com`**. The introduction website takes the apex
`elementarenausa.com` (`www` redirects there; the website session builds it
from `apps/site`). The old address redirects to the new one, keeping the path
and query, so invite links (`?room=`), email links (`?auth=`) and QR codes on
saved pictures keep working.

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
  screen icon follows the redirect to the new address. It then opens outside
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
9. **Cloudflare (`litojace.com`): redirect the old address.**
   - Set the `parena` record to **Proxied** (orange) and its target to
     `twod-pokemon.onrender.com`.
   - Add a Single Redirect rule: Request URL `http*://parena.litojace.com/*`
     → `https://play.elementarenausa.com/${2}`, **302** for the first week,
     preserve query string **on**.
   - Check: `curl -I "https://parena.litojace.com/?room=AB12CD"` →
     `302`, `location: https://play.elementarenausa.com/?room=AB12CD`; the same
     for `/?auth=reset-password`, `/email-confirmed`, `/privacy.html`.
   - After a week without problems, change it to **301**. (301 is kept by
     browsers, so it waits until we're sure; 302 can be undone at once.)
     Undo: turn the rule off and set `parena` back to DNS only; Render still has
     the custom domain, so the old address serves the game again.
10. **iPhone app** (owner, on the Mac): set `VITE_SITE_URL=https://play.elementarenausa.com`
    in `apps/client/.env.ios`, build and upload a new TestFlight build
    (docs/ios-app.md). Builds already installed keep working: their privacy
    and support links and email links point at `parena…`, which redirects.
    App Store Connect: privacy policy URL and support URL to the new address
    (store listing, owner).
11. **After 30 days:** remove `https://parena.litojace.com/**` from Supabase's
    Redirect URLs and from `CLIENT_ORIGIN`. Keep the Cloudflare redirect and
    the `parena` record for good (old QR codes live on in saved pictures).

## What players notice

- **Web players sign in once more.** A new address has empty storage, so the
  saved session (`parena-auth`) stays behind on the old address. Guests on the
  web start over unless they added an email (a guest's progress is tied to the
  device's anonymous account). Suggest a short in-game notice before the move:
  "Add an email to keep your guest progress."
- **Home screen icons:** the old icon still opens the game (it redirects), but
  in the browser. Add the game to the home screen again from the new address.
- **iPhone app players:** nothing changes (the app has its own storage).

## Shared sign-in with the website (later, the website session)

After the website runs at `elementarenausa.com`, the website session moves the
game's session storage to a cookie on `.elementarenausa.com` so Play opens
the game signed in (`apps/site/ACCOUNTS.md` on `site/landing-page`). That
change is in `apps/client/src/accounts.ts` and belongs to the website session;
this move doesn't touch how the session is stored.

## Progress

- 25 Nov: plan written, checks above done, code PR opened. Waiting for the
  owner's go-ahead on the production list.
