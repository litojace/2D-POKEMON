# The iPhone app

The App Store version of Element Arena is the same client as the website,
inside a native shell made with [Capacitor](https://capacitorjs.com/) 8. The
game's pages are built into the app (not loaded from the website), and the
app talks to the same game server on Render and the same Supabase project.

> **Not built yet.** The Xcode project was generated and edited on Linux,
> where Xcode can't run. The project file parses, and every step up to
> `cap sync` has been run, but nothing has been compiled or run on an
> iPhone. Expect the first build on a Mac to need small fixes.

## What's where

| Path                                        | What it is                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/client/capacitor.config.ts`           | App name, bundle ID (`com.litojace.elementarena`), dark background, no page bounce.                                         |
| `apps/client/ios/`                          | The Xcode project. Commit changes to it; `ios/App/App/public` (the built game) and the generated config copies are ignored. |
| `apps/client/ios/App/App/AppleSignIn.swift` | Native Sign in with Apple (a small plugin inside the app) and the view controller that registers it.                        |
| `apps/client/ios/App/App/App.entitlements`  | The Sign in with Apple capability.                                                                                          |
| `apps/client/ios/App/App/Info.plist`        | Landscape only, status bar hidden, "no special encryption" (export compliance).                                             |
| `apps/client/src/native.ts`                 | Everything in the client that knows it's in the app.                                                                        |
| `apps/server/src/apple.ts`                  | Trading Apple's sign-in code for a refresh token, and revoking it.                                                          |
| `supabase/migrations/111_apple_tokens.sql`  | Where the server keeps those tokens.                                                                                        |
| `scripts/check-native-env.mjs`              | Stops the build if the app's settings are missing.                                                                          |
| `scripts/generate-icons.py ios`             | Draws the app icon (1024 × 1024) and launch screen from the game's emblem.                                                  |

The app is **iPhone only** for now (no iPad build): iPads can still run it
in iPhone mode. Supporting iPad means testing its window sizes first.

## What's different in the app

- **Landscape only**, set by the app itself, so iPhone players never see the
  "turn your phone sideways" cover the website needs (Safari can't lock
  rotation; an app can).
- **No service worker, update banner or "Want fullscreen?"**: the App Store
  delivers updates.
- **Coming back from the background reconnects at once.** iOS pauses an app
  soon after you switch away, which drops its game connection.
- **Sign in with Apple** opens Apple's own sheet. Email, password and guest
  play work as on the website.
- Email links (confirm your email, reset your password) open the **website**
  in Safari. The player then logs in to the app with their email and password.

## One-time setup

You need the [Sign in with Apple setup](accounts-setup.md#sign-in-with-apple-optional-off-by-default)
for the website first (App ID, Services ID, key, Supabase provider). Then:

1. **Bundle ID.** In [Identifiers](https://developer.apple.com/account/resources/identifiers/list),
   the App ID must be the bundle ID in `capacitor.config.ts`
   (`com.litojace.elementarena`) with **Sign in with Apple** ticked. If you
   registered a different one, change `appId` in `capacitor.config.ts` and
   `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project (Signing & Capabilities)
   before the first upload. It can't change after release.
2. **Supabase.** In **Authentication → Sign In / Providers → Apple**, add the
   bundle ID to **Client IDs** after the Services ID, separated by a comma:
   `com.litojace.elementarena.web,com.litojace.elementarena`. Tokens from
   the app are issued to the bundle ID, and Supabase refuses ones for a
   client it doesn't list.
3. **Database.** Run migrations 109, 110 and 111 in Supabase's SQL Editor.
4. **Game server (Render, web service).** Add:
   - `APPLE_TEAM_ID`: your Team ID;
   - `APPLE_KEY_ID`: the Key ID of your Sign in with Apple key;
   - `APPLE_PRIVATE_KEY`: the text of that key's `.p8` file (paste it whole;
     Render keeps the line breaks);
   - `APPLE_APP_BUNDLE_ID`: `com.litojace.elementarena`;
   - `SUPABASE_SERVICE_ROLE_KEY`, if it isn't there yet (raids already use it).
     Keep these on the web service only, never in the repository or the
     static site. Without them the app still signs in with Apple; deleting an
     account then can't revoke Apple's token, and the player is told how to
     remove the app in their Apple Account settings instead.
5. **Allowed origins.** Nothing to do: the server always accepts the app's
   origin (`capacitor://localhost`) next to `CLIENT_ORIGIN`. `CLIENT_ORIGIN`
   now also takes several sites separated by commas.

## Building on a Mac

You need a Mac with **Xcode 26** (App Store uploads must be built with the
iOS 26 SDK) and Node 22.

1. `npm ci --include=dev`
2. Create `apps/client/.env.ios` (git ignores it) with the website's public
   values and the full server address:

   ```
   VITE_SERVER_URL=https://element-arena-np34.onrender.com
   VITE_SITE_URL=https://parena.litojace.com
   VITE_SUPABASE_URL=https://YOUR_GAME_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your anon key
   VITE_APPLE_SIGN_IN=on
   ```

   Only the public anon key goes here, never the service-role key: the app
   is a file anyone can unpack.

3. `npm run ios:build` checks those settings, builds the game in "ios" mode
   and copies it into the Xcode project (`cap sync ios`). Run it again after
   every change to the game.
4. `npm run ios:open` opens Xcode. In the **App** target, **Signing &
   Capabilities**: pick your Team, check that **Sign in with Apple** is
   listed (it comes from `App.entitlements`), and let Xcode manage signing.
5. Plug in an iPhone and press **Run**. Check: sign up, log in, guest play,
   Sign in with Apple, a bot match, a two-phone match, the Plaza, switching
   away and back mid-match, and deleting an account made with Apple.

## TestFlight and the App Store

1. In [App Store Connect](https://appstoreconnect.apple.com/), create the
   app with the same bundle ID.
2. In Xcode, set the version (Marketing Version) and build number, choose
   **Any iOS Device**, then **Product → Archive → Distribute App → App
   Store Connect**. The build shows up in TestFlight after processing.
3. Fill in the listing:
   - **Privacy:** the privacy policy URL, `https://parena.litojace.com/privacy.html` (`apps/client/public/privacy.html`; the game links to it from the menu and the sign-in panel), and the privacy
     answers: email address and user ID (accounts), gameplay content
     (matches, progress), and performance data (`arena-perf` logs frame
     rates, device memory and cores, not linked to the player).
   - **Age rating** questionnaire: choose **13+**. The game asks for a
     birth month and year before anyone makes an account and refuses
     under-13s (`apps/client/src/age-gate.ts`), and the privacy policy says
     it isn't for children under 13. Also: cartoon fighting; players see
     each other's names and emotes (no chat); blocking and reporting exist.
   - **App Review notes:** a demo account (email and password), and that
     _Battle an AI bot_ plays a full match alone. The game server must be
     awake and healthy while Apple reviews.
   - Screenshots from a 6.9-inch iPhone, in landscape.
4. Submit for review.

## Account deletion and Apple

When a player signs in with Apple in the app, the app hands Apple's
one-time authorization code to the server (`POST /api/account/apple`). The
server trades it with Apple for a refresh token, checks that Apple's answer
names the same Apple account the player is signed in with, and keeps the
token (migration 111). When the player deletes their account, the server
revokes the token with Apple first, then deletes the account. If Apple
refuses, the account is deleted anyway, as Apple asks.

Players who signed in with Apple **on the website** have no kept token (the
website's sign-in goes through Supabase's page), so deleting their account
can't revoke it; they're told how to remove the app in their Apple Account
settings. Signing in once in the iPhone app keeps a token for them too.
