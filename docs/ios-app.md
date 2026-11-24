# The iOS app (iPhone and iPad)

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
| `apps/client/ios/App/App/Info.plist`        | Landscape only, full screen on iPad, status bar hidden, "no special encryption" (export compliance).                        |
| `apps/client/src/native.ts`                 | Everything in the client that knows it's in the app.                                                                        |
| `apps/server/src/apple.ts`                  | Trading Apple's sign-in code for a refresh token, and revoking it.                                                          |
| `supabase/migrations/111_apple_tokens.sql`  | Where the server keeps those tokens.                                                                                        |
| `scripts/check-native-env.mjs`              | Stops the build if the app's settings are missing.                                                                          |
| `node scripts/generate-icons.mjs`           | Draws the app icon (default, dark and tinted), launch screen and PWA icons from `scripts/app-icon.svg`.                     |

The app runs on **iPhone and iPad** (`TARGETED_DEVICE_FAMILY = "1,2"` in
the Xcode project, since 24 Nov 2026). See [iPad](#ipad) below.

## What's different in the app

- **Landscape only**, set by the app itself, so iPhone players never see the
  "turn your phone sideways" cover the website needs (Safari can't lock
  rotation; an app can).
- **No service worker, update banner or "Want fullscreen?"**: the App Store
  delivers updates. The app never asks the web view for full screen either
  (`isInstalled()` in `orientation.ts` counts the app as installed, and the
  battle's full-screen button is hidden): Capacitor turns on WebKit's element
  full screen, and a match start used to show iOS's "capacitor://localhost is
  in full screen" banner and an X over the game.
- **Edge swipes need a second swipe.** In a match, a thumb near an edge
  shouldn't leave the game: the first swipe from an edge goes to the game,
  and a second opens Home, the app switcher or Control Center
  (`ArenaViewController`'s `preferredScreenEdgesDeferringSystemGestures`).
  The home bar stays on screen: when it auto-hides
  (`prefersHomeIndicatorAutoHidden`), iOS drops the deferral for the bottom
  edge and any touch brings the bar back, so one swipe up during a match went
  straight Home. Capacitor's SystemBars plugin owns that property and turns
  it on with `plugins.SystemBars.hidden`, so leave that option out of
  `capacitor.config.ts`; the status bar is hidden by Info.plist and
  `StatusBar.hide()` instead.
- **No zoom anywhere.** Two quick taps in the Plaza zoomed the whole game
  in (owner, 19 Nov 2026): the website locks zoom only in touch battles, and
  Capacitor turns off pinch but not WebKit's double-tap zoom. The app keeps
  the viewport at `maximum-scale=1, user-scalable=no` for good
  (`lockAppZoom` in `zoom-guard.ts`); iOS's own Zoom accessibility setting
  still works.
- **The screen never locks while the game is open** (`SceneDelegate`):
  briefings, waiting and watching can go a while without a touch, and a
  locked phone drops its game connection.
- **Haptics:** hits tap the Taptic Engine (`@capacitor/haptics`). iPhones have no web vibration, so the website
  can't do this on iPhone.
- **Coming back from the background reconnects at once.** iOS pauses an app
  soon after you switch away, which drops its game connection.
- **Sign in with Apple** opens Apple's own sheet. Email, password and guest
  play work as on the website.
- Email links (confirm your email, reset your password) open the **website**
  in Safari. The player then logs in to the app with their email and password.
- **Settings → App icon** switches the Home Screen icon between the default
  (Pyranda vs Glacelle) and three alternates; iOS confirms the change with its
  own alert. It takes the place of **Settings → Display**, since the app is
  always full screen.

### iPad

On an iPad the app fills the whole screen, in landscape, like on an iPhone.
The game itself already handled iPads in Safari (a larger pixel budget for
the big iPads in `render-budget.ts`, the turn-sideways cover, the screen
pin); `tests/visual/ipad-app-screens.spec.ts` checks the Lobby, Shop,
Fighters and Plaza at the four iPad screen sizes (1024 × 768 iPad mini and
9.7", 1180 × 820 iPad Air, 1194 × 834 iPad Pro 11", 1366 × 1024 iPad Pro 13").

- **Full screen, no Split View or Stage Manager windows.** `Info.plist`
  sets `UIRequiresFullScreen`: an iPad app that supports fewer than all four
  orientations must opt out of iPad multitasking, or App Store validation
  refuses the upload, and the game is landscape only (a fighter's arena
  doesn't fit a portrait window). Apple deprecated the key in iPadOS 26
  ([TN3192](https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key)):
  it still works for apps built with the iOS 26 SDK (Xcode 26), but from
  the iOS 27 SDK the system resizes the app's window anyway. Before
  building with Xcode 27, decide how the app handles a resizable window;
  the game already lays out at any landscape size and covers a portrait one
  with "turn sideways" (`#rotate-gate`). Never add
  `UIRequiresFullScreenIgnoredStartingWithVersion`: it switches the key off
  early. `tests/unit/ios-ipad.test.ts` checks these settings.
- **No haptics** on iPads (they have no Taptic Engine): the haptics plugin
  does nothing there.
- The app icons are single 1024 px "universal" images, so Xcode makes the
  iPad sizes too.

### Alternate app icons

Each alternate is an icon set in `Assets.xcassets` (`AppIcon-Pyranda`,
`AppIcon-SplitFace`, `AppIcon-StareDown`), drawn from `scripts/app-icons/`
by `node scripts/generate-icons.mjs` with dark and tinted versions, as
Apple asks of alternates too. `ios/App/App/AppIcon.swift` switches the icon
(`setAlternateIconName`), and `apps/client/src/app-icon-setting.ts` draws
the picker.

To add one: draw its SVG in `scripts/app-icons/`, then add its set name in
three places: `ALTERNATES` in the generator, `APP_ICONS` in
`app-icon-setting.ts`, and the **Alternate App Icon Sets** build setting
(`ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`, Debug and Release) in the
Xcode project. `tests/unit/app-icons.test.ts` fails until all three agree.
The same icons can be tested on the App Store with
[product page optimization](https://developer.apple.com/app-store/product-page-optimization/),
which only offers icons built into the app.

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
3. **Database.** Nothing to do: migrations 109, 110 and 111 already ran on
   production (they are in `supabase/applied-baseline.txt`), and later ones
   run on their own with each push to `main` ([auto-migrations.md](auto-migrations.md)).
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
5. Plug in an iPhone, unlock it and tap **Trust**. The first time, turn on
   **Settings → Privacy & Security → Developer Mode** on the iPhone (it
   restarts). Choose the iPhone in Xcode's device menu and press **Run**.
   Check: sign up, log in, guest play,
   Sign in with Apple, a bot match, a two-phone match, the Plaza, switching
   away and back mid-match, and deleting an account made with Apple.
6. **On an iPad**, the same way: plug it in (USB-C or Lightning), unlock it
   and tap **Trust**; the first time, turn on **Settings → Privacy &
   Security → Developer Mode** on the iPad (it restarts). Choose the iPad in
   Xcode's device menu and press **Run**. Or, without an iPad, choose an
   iPad simulator (iPad mini, iPad Air, iPad Pro 13") in the same menu.
   Check:
   - the game fills the screen in landscape, with no black bars and no
     iPhone-sized window in the middle;
   - turning the iPad over (landscape left and right) turns the game, and
     holding it upright keeps the game sideways;
   - the Lobby, Shop, Fighters, Raids and the Plaza fit, with nothing cut
     off at the edges or under the camera;
   - a bot match plays with touch controls (and, if you have one, with a
     Magic Keyboard or trackpad attached);
   - Sign in with Apple opens Apple's sheet over the game;
   - Settings → App icon changes the Home Screen icon;
   - swiping up from the bottom during a match needs a second swipe to go
     Home, and there is no Split View or Slide Over window from the dock.

## TestFlight and the App Store

1. In [App Store Connect](https://appstoreconnect.apple.com/), create the
   app with the same bundle ID.
2. In Xcode, set the version (Marketing Version) and build number, choose
   **Any iOS Device**, then **Product → Archive → Distribute App → App
   Store Connect**. The build shows up in TestFlight after processing.
   The project starts at version 1.0, build 1, which is right for the first
   upload. Every later upload needs a higher build number (App target →
   **General** → Identity), even for the same version: App Store Connect
   refuses a build number it has seen.
3. Fill in the listing:
   - **Privacy:** the privacy policy URL, `https://parena.litojace.com/privacy.html` (`apps/client/public/privacy.html`; the game links to it from the menu and the sign-in panel), and the privacy
     answers: email address and user ID (accounts), gameplay content
     (matches, progress), and performance data (`arena-perf` logs frame
     rates, device memory and cores without the account; `arena-load` logs
     load times with it, so answer "linked").
   - **Age rating** questionnaire: choose **13+**. The game asks for a
     birth month and year before anyone makes an account and refuses
     under-13s (`apps/client/src/age-gate.ts`), and the privacy policy says
     it isn't for children under 13. Also: cartoon fighting. **Messaging and
     Chat: yes** (party, room and nearby chat, and messages between friends;
     text filtered on the server, links and contact details refused; quick
     chat only with strangers and for guests; report from a message, block,
     mute, chat off with the gear in the chat; docs/chat-plan.md).
     User-generated content: chat only. Party, room and nearby chat aren't
     stored; messages between friends are (the last 200 per pair, deleted
     with either account). Social media: no (no feed). Apple lists Messaging
     and Chat under 4+, so the rating stays 13+ from the age gate. App
     Privacy: add "Other User Content", **collected** (friends' messages are
     stored on our server), **linked to the user** (they carry account IDs),
     purpose App Functionality, not used for tracking.
   - **App Review notes:** a demo account (email and password), and that
     _Battle an AI bot_ plays a full match alone. The game server must be
     awake and healthy while Apple reviews.
   - **Support URL:** `https://parena.litojace.com/support.html`
     (`apps/client/public/support.html`). App Store Connect requires one.
   - **Pricing:** Free. The app has no in-app purchases: selling coins was
     looked at and put off until there are more players
     ([iap-research.md](iap-research.md)). Free apps need no Paid Apps
     Agreement, tax or banking forms.
   - Screenshots in landscape, made by the script in
     [app-store-screenshots.md](app-store-screenshots.md). App Store Connect
     shows which iPhone sizes it requires. Since the app runs on iPad, it
     also requires **iPad screenshots** (the 13" iPad size, 2752 × 2064 in
     landscape); the script makes iPhone sizes only for now.
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
settings. Signing in once in the iOS app keeps a token for them too.
