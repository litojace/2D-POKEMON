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
   - Authentication → Providers → Email: turn on **Secure password change**
     and check **Secure email change** is on (shared sign-in review).
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
11. **Redirect the old address: live since 25 Nov, 8:05 PM PT** (owner's OK
    typed in the domain-move session, "Đồng ý chuyển hướng", after the cost
    was laid out: guests who never added an email lose their progress; old
    icons open the new address in the browser).
    - Cloudflare, zone `litojace.com`, Single Redirect (phase
      `http_request_dynamic_redirect`, ruleset `6417be6a…`, rule
      `30f75514…`): `http.host eq "parena.litojace.com" and not
starts_with(http.request.uri.path, "/.well-known/acme-challenge/")` →
      **302** to `concat("https://play.elementarenausa.com",
http.request.uri.path)`, preserve query string on. The ACME path stays
      on Render so it can renew `parena`'s certificate (needed to undo).
    - The `parena` CNAME (target `element-arena-np34.onrender.com`, unchanged:
      Render routes by host name) is **Proxied** (orange). The universal
      certificate covers `*.litojace.com` (until 6 Jan 2027).
    - **301 on 2 Dec** if nothing goes wrong, with the owner's OK then
      (browsers keep a 301).
    - Checked at 8:06 PM PT: `/?room=TEST` → `302` to
      `play…/?room=TEST`; `http://…/privacy.html?x=1` → `https://play…/privacy.html?x=1`;
      a `#access_token=…` fragment arrives on `play.`; an old Supabase email
      link aimed at `parena` (bad token on purpose) lands on
      `play.…/?auth=email-confirmed` with its error, and the game says the
      link expired; `/.well-known/acme-challenge/…` reaches Render (404).
    - Installed icons: the service worker sends navigations to the network
      (`sw.ts`, `NavigationRoute`), so the old icon gets the redirect, not a
      cached old game. It opens `play.` in the in-app browser bar.
    - Undo: set `parena` back to DNS only (and turn the rule off). Render
      keeps the custom domain, so the old address serves the game again
      within about 5 minutes.
    - Render's own redirect rules can't do this (they match the path, not
      the host, and never apply where a file exists, like `/`).
      Keep the redirect and the `parena` record for good afterwards (old QR
      codes live on in saved pictures). Supabase's `parena` Redirect URL and
      `CLIENT_ORIGIN`'s `parena` entry go 30 days after the redirect starts
      (about 25 Dec, with the owner's OK).

## What players notice

- **Web players sign in once more when they move** (not before: the old
  address keeps serving). A new address has empty storage, so the saved
  session (`parena-auth`) stays behind on the old address. Guests on the
  web start over unless they added an email (a guest's progress is tied to the
  device's anonymous account). The banner on the old address says so.
- **Home screen icons:** since the redirect (step 11) the old icon opens the
  new address in the browser. Add the game to the home screen again from the
  new address.
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
- 25 Nov, ~4:15 PM PT: go-live rule from the shared sign-in review: **`play.`
  serves only builds that include #484** (and #482). So steps 1–2 wait
  until both are merged and the Static Site has deployed them. Before
  go-live the owner also turns on Supabase "Secure password change" and
  confirms "Secure email change" (Authentication → Providers → Email).
- 25 Nov, ~4:15 PM PT: the reviewer dropped the "only with #484" rule
  (website session): #484's `adopt()` moves a session already in
  local/session storage on `play.` into the cookie at startup. `play.` can
  go live before #484. The website (live at `https://elementarenausa.com`)
  points Play at `parena` until then (#485). Waiting for the owner.
- 25 Nov, 4:25 PM PT: owner confirmed here ("đồng ý"). Step 1 done: Render
  custom domain `play.elementarenausa.com` added to the Static Site, verified
  4:26 PM. Step 2 done: Cloudflare `CNAME play → twod-pokemon.onrender.com`,
  DNS only (record id `2abf1a01…`). `https://play.elementarenausa.com/` serves
  the same `index.html` as `parena` (200); `/sw.js`, `/privacy.html`,
  `/support.html`, `/email-confirmed`, `/?room=` 200; a missing script 404.
  Step 3: `CLIENT_ORIGIN=https://play.elementarenausa.com,https://parena.litojace.com`
  set on `element-arena`, deploying.
- 25 Nov, 4:29 PM PT: step 3 done. `element-arena` live with the new
  `CLIENT_ORIGIN`: an API preflight from `https://play.elementarenausa.com`
  and from `https://parena.litojace.com` gets 204 with its own
  `Access-Control-Allow-Origin`; another origin gets 403. The Socket.IO
  handshake from `play.` answers 200. #481 merged with main, out of draft,
  waiting for its full run.
- 25 Nov, ~5:00 PM PT: the owner added the Supabase Redirect URLs
  (`play.` and the apex; `parena` kept) and turned on Secure password change
  / checked Secure email change. Email templates for change email and
  reauthentication merged (#487); the new email banner (the rest-market
  loading painting, the owner's pick) merged (#488).
- 25 Nov, 5:04 PM PT: #481 merged (FULL lane, all green). Step 5 (Static
  Site `VITE_SITE_URL`, removing `SUPABASE_DB_URL`, the `/sw.js` header)
  was blocked by this session's permission check and waits for the owner,
  as do the Supabase Site URL and pasting the four templates.
- 25 Nov, 5:36 PM PT: step 5 done with the owner's OK here: Static Site
  `VITE_SITE_URL=https://play.elementarenausa.com` (redeployed),
  `SUPABASE_DB_URL` removed from the Static Site, `/sw.js` sends
  `Cache-Control: no-cache`. Live browser: `parena` shows the move banner
  (Open → `play.`), `play.` none; the bundle has no `parena` URL.
- 25 Nov, ~6:00 PM PT: the owner set the Supabase Site URL to `play.`, pasted
  the four templates and re-added `https://parena.litojace.com/**`.
  Supabase `verify` redirects: `play.`, the apex and `parena` allowed, other
  hosts fall back to `play.`. Apple authorize still returns through Supabase.
- 25 Nov, 5:44 PM PT, live email test with a test account at
  `mail.litojace.com` (Resend inbound): sign-up email (new template, market
  banner) → link lands on `play.?auth=email-confirmed` signed in; reset
  email → link opens "Choose a new password" on `play.`; reauthentication
  email shows the code (8 digits); change-email email goes to both
  addresses with old → new. Two subjects were still Supabase's defaults
  (reauthentication shows the code in the subject); the owner was asked to
  set them.
- 25 Nov, ~5:55 PM PT: the owner set the Reauthentication subject to one
  without the code. The Change email address subject is still Supabase's
  default ("Confirm your new email address"); ours, "Confirm your new
  Element Arena email", is optional.
- 25 Nov, ~6:05 PM PT: the owner asked (via the coordinator) to delete the
  test account. Deleted through the game's own flow
  (`POST /api/account/delete`, `{"ok":true}`); its password no longer
  signs in, and a check finds no row for it in `auth.users`,
  `auth.identities` or any of the 46 player-keyed `public.arena_*` columns.
- 25 Nov, ~6:08 PM PT: the owner set the Change email address subject to
  "Confirm your new Element Arena email". All four templates now carry our
  subjects.
- 25 Nov, 6:15 PM PT: with the owner's OK here ("đồng ý header"), the game's
  Static Site sends on `/*` (both hosts): HSTS
  `max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, the Permissions-Policy
  and the CSP from `apps/client/security-headers.json` as
  `Content-Security-Policy-Report-Only` (PR #494). Live pass on `play.` as a
  guest (load, guest sign-in, Shop, share card, Plaza, a bot match): the
  only reports were zod's eval probe and its compiler (vendor chunk), which
  #494's jitless mode removes. The guest was then deleted through the game's
  flow (no rows left). Enforcing waits for #494 to deploy and a clean re-run.
- 25 Nov, 6:43 PM PT: with the owner's OK here ("bật CSP"), the enforcing
  `Content-Security-Policy` is live on both hosts (value byte-identical to
  the Report-Only one, which was then removed). Guest passes under
  enforcement on `play.` and `parena.` (load, guest, Shop, share card,
  Plaza, bot match): zero violations; the guests were deleted afterwards (no
  rows left). `node scripts/check-live-headers.mjs --require-enforcing`
  matches on both hosts. On `parena.` the move banner covers the
  Lobby/Plaza tabs until Later or Open is pressed (as designed).
- 25 Nov, ~6:55 PM PT: signed-in pass on `play.` under the enforcing CSP,
  with a throwaway email account (API sign-up, confirmed through the real
  email link): sign-in, profile, friends, chat and a Shop purchase all
  worked. The Apple button went age question → Supabase
  `/auth/v1/authorize?provider=apple` → `appleid.apple.com` with
  `redirect_to` on `play.`. (Apple's page itself doesn't load from the test
  container, whose network blocks Apple, and CSP doesn't govern top-level
  navigation.) The game has no Google button. Zero violations, zero page
  errors. The account was deleted through the game's flow (no rows left in
  `auth` or `public`). The first landing from the confirm link showed
  "Playing on another device" with no other tab open; it was not reproduced
  and is with the session that owns the server's account code.
- 25 Nov, 7:17 PM PT: the earlier passes' "bot match" only reached the
  briefing and disconnected about 8 s later. This run was a guest bot match
  played to the result: briefing, three rounds and the results sheet
  (03:17:02–03:18:04 UTC, 0–3, about 34 s of fighting, skills cast). Zero
  violations, no errors, no disconnect. The guest was deleted afterwards
  (no rows left).
- 25 Nov, 7:20 PM PT: PR #499 merged. The **Live headers** workflow now
  compares the served headers and inline-script hashes with
  `apps/client/security-headers.json` after relevant pushes and daily, and
  opens "Live game headers differ from the repo" on drift.
- 25 Nov, 8:05 PM PT: **`parena` redirects to `play.`** (step 11), with the
  owner's OK here. The cost laid out first, as counts only: 17 email/Apple
  accounts (keep everything, sign in once on `play.`); 15 guests, 5 active
  in 14 days, 1 in 3 days; of the 5, 3 with some progress and 1 with real
  progress (7 Shop items). Checks in step 11. #506 (the move dialog) is on
  hold: nobody loads the game on `parena` now.
