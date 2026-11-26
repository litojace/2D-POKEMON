# Website accounts and one-tap Play: proposal

Status: **decided** (owner, 25 Nov 3:35 PM PT): `elementarenausa.com` is
bought; the website is at the apex, the game at `play.elementarenausa.com`,
and one Supabase session cookie on `.elementarenausa.com` gives one-tap Play.
The code is on branch `site/landing-page`; the production changes wait for
the owner's approval of the exact list (section "Production changes" in the
PR).

What was checked:

- `tests/unit/session-cookie.test.ts`: chunking, sign-out clears every
  chunk, Remember me, torn values, which hosts share.
- Real Chromium, both hostnames mapped to a local HTTPS server: a session
  written on `elementarenausa.com` reads back on `play.elementarenausa.com`;
  signing out on one signs out the other; an unrelated site sees no cookie.
- supabase-js (auth-js `_autoRefreshTokenTick` → `__loadSession`) reads the
  session from storage before each refresh, so a website tab and a game tab
  always refresh with the newest token; two refreshes at the same moment
  fall inside Supabase's refresh-token reuse interval (10 s by default:
  keep it).
- The cookie travels with every request to our hosts. A session is a few
  KB (2-3 chunks), well under header limits. Never log Cookie headers if an
  API ever moves under this domain.

The owner asked for: an account area on the website (sign in, change email,
change password), and a Play button that opens the game already signed in.

## If the owner buys `elementarenausa.com` (being considered, 25 Nov)

A separate session would move the game to the new domain, with
`parena.litojace.com` redirecting. That move signs every web player out once
anyway (a new origin has empty storage), so it is the moment to choose the
layout:

| Address                    | What                               |
| -------------------------- | ---------------------------------- |
| `elementarenausa.com`      | the website (`www` redirects here) |
| `play.elementarenausa.com` | the game                           |

**One-tap Play: one session cookie for `.elementarenausa.com`.** Both sites
store the Supabase session in a cookie scoped to the domain (Secure,
SameSite=Lax, split into chunks under the 4 KB limit), so signing in on
either signs you in on both, and Play is a plain link. On this domain the
cookie only reaches our own two sites, which removes the objection to option
B below. Rules that keep it safe:

- Never point a subdomain of `elementarenausa.com` at a third-party or
  user-content host (that host would receive the session). Email sending
  records (Resend, MX) are fine: they are not web hosts.
- Both sites send a strict Content Security Policy and
  `frame-ancestors 'none'`; the website loads no third-party scripts.
- The cookie is JS-readable (Supabase's browser client must read it), the
  same exposure the game's `localStorage` session has today.
- Game change: `accounts.ts`'s `storage` object becomes a cookie store on
  the new domain only (the iPhone app keeps its own storage); no migration,
  since the move starts everyone fresh. "Remember me" = a persistent cookie,
  otherwise a session cookie.
- Supabase: Site URL `https://play.elementarenausa.com`; Redirect URLs add
  `https://play.elementarenausa.com/**` and `https://elementarenausa.com/**`.
- QR codes (`SHARE_SITE`): `https://elementarenausa.com`.

Same-origin (the game under `elementarenausa.com/play/`) would also work but
moves the game off `/`, which changes its PWA scope and start URL; the cookie
layout keeps the game at the root of its own host.

**If the domain is not bought:** option A below (website on the game's host
at `/home/`, `arena.litojace.com` redirecting there).

## What the game does today (read from the code)

- Supabase Auth in the browser (`apps/client/src/accounts.ts`). The session
  (access token + refresh token) is stored under the key `parena-auth`, in
  `localStorage` when "Remember me" is ticked, otherwise `sessionStorage`.
- Account kinds: email and password; Sign in with Apple (web OAuth, and the
  iPhone app's native token); guests (Supabase anonymous users), who can add
  an email later from their player card.
- Email links (confirm, reset password, email change) come back to
  `VITE_SITE_URL` (`https://parena.litojace.com`) through `/?auth=…`.
- The game server's API takes the login token in a header and uses no
  cookies (`apps/server/src/api-cors.ts`); its CORS list is `CLIENT_ORIGIN`.
  The server already reads `SUPABASE_SERVICE_ROLE_KEY` (raid rewards).
- Browsers keep `localStorage` per origin: a page on another host (for
  example `arena.litojace.com`) can't see the game's session at all.
- DNS (Cloudflare, checked read-only): `litojace.com` and `www` serve a Vercel
  site; `amatyc` and `pet` are other Vercel sites, `mathpath` another Render
  app. The website therefore needs a new subdomain, and anything shared at
  `.litojace.com` level is shared with those sites too.

## Options

### A. Same origin: the website lives on the game's host (recommended)

The website is served by the game's own Static Site at a path, for example
`https://parena.litojace.com/home/`, and a short address
`https://arena.litojace.com` redirects there (QR codes and links use the
short one).

- **Sign-in:** none to hand over. The website's account area uses the same
  Supabase client settings and the same `parena-auth` key, so whoever is
  signed in to the game is signed in on the website, and the reverse. Play is
  a plain link to `/`.
- **Account area:** sign in (email/password, Apple), change email (Supabase
  sends the confirmation link, as the game does today), change password
  (asks for the current password first; Supabase's "secure password change"
  setting can require a recent login). Guests see "Add an email in the game
  to manage your account here"; Apple accounts can set a password too
  (Supabase allows it; to be tested when built).
- **What changes in the game:** the build copies `apps/site` into
  `dist/home/` (not into the precache); the service worker's navigation
  route skips `/home/` (one line in `sw.ts`'s denylist); a test checks both.
  Invite links (`?room=`), email links (`?auth=`), `VITE_SITE_URL`, the PWA's
  scope and the iPhone app stay exactly as they are.
- **Risks:** lowest of the three. No token ever leaves the origin. A bug in
  the website's script runs with the game's origin, so the website keeps no
  third-party scripts (it has none) and a strict Content Security Policy.
- **Cost:** the merge lane is FULL (the build config changes); the website
  deploys with the game (a website edit redeploys the game's static files,
  which is quick and does not restart matches: the game server is separate).

### B. A cookie on `.litojace.com` shared by both hosts (not recommended)

The game and the website would both store the session in a cookie for
`.litojace.com`. Supabase's browser client has to read it, so the cookie
can't be HttpOnly: **every site under litojace.com (the Vercel sites,
mathpath) receives the refresh token with each request and can read it**.
It also means changing how every current player's session is stored, with a
migration for those signed in. Rejected on security.

### C. A one-time code from the game server (if the website must be a separate site)

The website at `arena.litojace.com` has its own Supabase session. Play does:

1. The website asks the game server for a code: `POST /api/handoff` with
   its login token in the header. The server checks the token with
   Supabase and returns a random 256-bit code, valid 60 s, single use,
   kept in memory (one server instance).
2. The browser goes to `https://parena.litojace.com/#handoff=<code>`. A
   fragment is never sent to a server or in a Referer.
3. The game removes the fragment at once and redeems the code
   (`POST /api/handoff/redeem`). The server marks it used, makes a magic-link
   token with the admin API (`generateLink`, nothing is emailed) and returns
   its hash **in the response body**; the game signs in with
   `verifyOtp({ type: "magiclink", token_hash })`, a new session of its own.
   (Copying the refresh token across instead would make two clients share
   one refresh-token family; Supabase's reuse detection then signs both out.)

- If the game already has the same player signed in, it just plays; a
  different player gets "Switch to <name>?"; guests have no handoff (no
  email) and keep their device session.
- **Risks:** a stolen code is a session for 60 s, once. Login CSRF (someone
  makes you redeem their code) is answered by showing the account name with
  "Not you? Sign out". Both endpoints need rate limits. CORS must allow the
  website's origin for these two routes only.
- **Cost:** two new server routes and a game boot change (security review
  before merging), plus the account area. More moving parts than A.

## Production settings the owner changes (A or C)

- **Supabase → Authentication → URL Configuration → Redirect URLs:** add the
  website's address (`https://parena.litojace.com/home/**` for A, or
  `https://arena.litojace.com/**` for C) so password-reset and email-change
  links can return to the account area. The Site URL stays
  `https://parena.litojace.com`.
- **Supabase → Authentication → Providers → Email:** consider turning on
  "Secure password change" (asks for a recent login before a new password).
- **Sign in with Apple:** Supabase's callback is unchanged, so Apple's
  settings should not need edits; to be confirmed when it's built.
- **Cloudflare DNS:** one CNAME for `arena.litojace.com` (to Render). The
  session can add it through the connected Cloudflare account once the owner
  approves.
- **Render:** A adds a redirect host (a tiny Static Site or a Cloudflare
  redirect rule) for `arena.litojace.com`; C adds a new Static Site and the
  website's origin to the game server's `CLIENT_ORIGIN`.
- **Email templates:** unchanged (they already use the redirect address).

## Recommendation

**With `elementarenausa.com`: the shared-cookie layout above. Without it: A.**
For A: It gives one-tap Play and a shared account area with no token moving
between sites, no new server endpoints and no change to how players' sessions
are stored. The cost is that the website is served from the game's host (with
`arena.litojace.com` as its short address) and deploys with the game.

## Security review (25 Nov)

An independent reviewer (a fresh agent given only the code) found no
high-severity issue (no XSS sink, open redirect or CSRF path) and these,
all addressed on `site/shared-signin`:

| Finding                                                                                                                                                      | Fix                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium: another subdomain could plant a same-named cookie (host-only or narrower path) to fix a session, and sign-out couldn't remove it                     | A second cookie under one of our names is treated as tampering: both copies are cleared and the read is signed out. HSTS with `includeSubDomains` on the apex blocks planting over plain HTTP. Test pins it.         |
| Medium: an Apple account could set a password with only the session, turning a stolen session into a lasting login; the password check left a second session | Setting a first password needs a code emailed by Supabase (`reauthenticate`); a password change signs out other sessions. Owner setting recommended: Supabase "Secure password change" and "Secure email change" on. |
| Low/medium: the game kept using its cached token after the website refreshed it, and didn't see a sign-out made on the website                               | The game re-reads the shared session before API calls and every 30 s (`syncSharedSession`).                                                                                                                          |
| Low: a session over the cookie limit was silently not saved                                                                                                  | Capped at two chunks (~6 KB, so request headers stay far under 16 KB); a bigger session stays in the origin's own storage. Tests for an oversized OAuth session and every cut point near the cap.                    |
| Low (speculative): a read in the middle of the other site's write                                                                                            | A checksum in the first chunk; a mismatch reads as signed out for that read, without deleting anything.                                                                                                              |
| Low: implicit-flow login CSRF via `#access_token=` links                                                                                                     | Already true of the game; not changed here. Moving both clients to PKCE breaks email links opened in another browser, so it's a separate decision.                                                                   |
| Info: iPhone Safari keeps script-set cookies 7 days                                                                                                          | The same limit already applied to the game's storage; refreshes extend it.                                                                                                                                           |

Also from the review: the notes moved out of `apps/site/` (served as is) to
`docs/`.
