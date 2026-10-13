# Mobile controls and PWA

Element Arena remains one Phaser client and one Socket.IO server. Mobile and desktop use the same server-authoritative combat rules and existing protocol. Mobile aim continues to follow the opponent.

## Mobile HUD

On touch devices, gameplay uses a viewport-sized arena with a fixed joystick at the lower left and a curved combat cluster at the lower right. The primary Attack button is largest. Skill order and artwork are unchanged; Dash and Jump have separate accents. Controls respect display safe areas, resize on rotation and viewport changes, and maintain at least 44-pixel button diameters. At narrow sizes, preferred sizes are constrained to fit safely. Portrait play remains available with a landscape suggestion.

Open **Settings → Mobile Controls**, or **Mobile controls ⚙**, to adjust joystick size, combat button size, and opacity. **Reset mobile layout** restores defaults. Settings are stored on the device. The joystick is fixed; floating and drag-to-edit layouts are intentionally not implemented.

DOM Pointer Events provide independent multi-finger capture for the DOM HUD. Phaser handles the arena and desktop controls. Cancellation, lost capture, blur, page hiding, orientation changes, and viewport resizing reset held touch input. Visibility and focus changes also send one neutral input packet through the existing protocol; normal input still runs at 30 Hz. No extra touch-move network stream is introduced.

## Installation

Deploy first over HTTPS. Installation is optional.

- **Android Chrome:** open `https://parena.litojace.com`, tap **Install app** when available, or use the browser menu → Install app / Add to Home screen.
- **iPhone / iPad Safari:** open the same address, use Share → Add to Home Screen → Add. Open the new icon for standalone play.
- **Desktop:** use Install app or the browser's install control when supported.

The manifest requests standalone landscape display. Fullscreen and orientation lock are requested only from user interaction and only where supported. iOS can ignore orientation/fullscreen requests; rotate manually and use the Home Screen app. Normal browser play remains supported.

## Caching and updates

`vite-plugin-pwa` builds an explicit Workbox precache of hashed JavaScript/CSS, public icons, the offline page, and manifest. The HTML game entry is fetched from the network. If a root navigation fails after a successful initial installation, the cached offline page explains that live matches need internet. First visits without any connection cannot install or populate caches.

No API responses, authentication tokens, Socket.IO traffic, match snapshots, or dynamic state are cached by the service worker. Existing Supabase/session storage behavior is unchanged. Preview HTML files are development-only and are not included in the production build.

A new worker waits for user approval. The update control stays unavailable during briefing, countdown, play, intermission, or a disconnect pause. Same-origin tab heartbeats also prevent updates while another tab reports an active match. Worker activation never automatically reloads a match: reloading is a separate guarded action outside the match. Tab heartbeats expire after two minutes to recover from crashed tabs. If storage is unavailable, current-tab protection still applies.

## Deployment

1. Use Node 22+ and `npm ci --include=dev`.
2. Run `npm run build`, `npm run typecheck`, and `npm test`.
3. Deploy the complete `apps/client/dist` directory with the existing server; run `npm run start`. The current Render configuration already uses this build/start flow.
4. Keep the existing Supabase variables and callback URLs configured for the HTTPS domain. Keep one server instance under the existing room architecture.
5. Serve `/sw.js`, `/manifest.webmanifest`, HTML, and icons from that same origin. Express sets `no-cache` for the worker, manifest, and entry HTML and the manifest MIME type. If Cloudflare rules cache everything, exclude these files, `/api/*`, and `/socket.io/*`; purge previously cached entry HTML once after deployment.
6. Confirm the manifest and icons load, install on each target device, play a match, and test a second deployment's update flow after the match.

Vite development mode deliberately does not register a worker. To test the built PWA locally, run the production server on localhost after building. Localhost is accepted as a secure context; a phone's plain HTTP LAN address is not sufficient for PWA installation. Use the deployed HTTPS domain for real-device tests.

## Validation and limits

Automated checks cover existing combat, multiplayer, account/database behavior, joystick dead zones, independent pointer state, cancellations, minimum touch target sizes, non-overlap and bounds across responsive layouts, saved setting validation, and update eligibility. The fixed 1600×900 Phaser render buffer avoids scaling GPU cost with phone device-pixel ratio; textures and portrait objects continue to be reused. Pointer movement uses geometry measured once on activation, and resizing is coalesced into animation frames.

Browser emulation and build-artifact inspection can verify layout and configuration but do not replace hardware testing. Android Chrome, iPhone Safari, installed Android/iOS apps, device-to-device multiplayer, offline navigation after worker installation, and real deployment update behavior still require hands-on verification. No real-device pass is claimed. The Phaser bundle remains large; it is precached below the configured 3 MiB file cap, and first install requires downloading it.

## Checks completed for this implementation

- `npm run typecheck` and `npm run build` pass.
- `npm test`: 66 tests pass, including existing account/database and two-client multiplayer tests.
- `node scripts/verify-pwa.mjs` checks the built manifest, PNG dimensions, static-only precache, file existence, and exclusion of developer previews. It now runs after the build in GitHub Actions.
- Local production HTTP checks passed for entry HTML, service worker, manifest MIME type, icon routes, offline page, and update-sensitive cache headers.
- Browser checks passed for desktop production startup, the install help entry, Mobile Controls settings, persisted opacity after reload, reset to defaults, landscape control layout, and a skill icon activating its action. The offline page was opened directly; a genuine offline navigation was not exercised.
- A Phaser SVG data-URL decoding failure found during production verification was fixed and covered with a regression test. A fresh production page reported no console errors.
- No Android/iOS hardware or installed Home Screen app was available. Real cross-device matches, hardware multitouch, offline navigation, and the complete deployed update lifecycle remain unverified.

## Elemental Coliseum and display cutouts

The interface uses navy, red, white, and yellow, with a stadium court and Poké Ball app icons. Shared CSS safe-area variables protect the lobby header, side content, modal dialogs, game HUD, notices, and home-indicator region. Control sizing uses the available viewport after all four safe insets. The game world and collision geometry stay unchanged.

In development, `/safe-preview.html?safe-top=59&safe-bottom=34` loads the real lobby with simulated portrait insets. `/touch-preview.html?safe-left=59&safe-right=59&safe-bottom=21` simulates landscape cutouts for the HUD. These fixtures are excluded from production. Browser checks verified the portrait brand at y=73 (below the simulated 59px inset), the dialog inside the safe region, and landscape controls with 12px additional spacing beyond the side/bottom insets. This is simulated validation; physical-device testing remains necessary.

## Landscape stadium layout

Landscape play reserves top and bottom spectator bands. Health and round information occupy the upper band; compact fullscreen, control settings, menu, and practice buttons occupy the lower band. The arena is fitted into the region between the joystick and combat gutters, so controls do not cover fighters. The world remains 1600×900 and uses the same collision, movement, and networking rules. Smaller phones consequently show a smaller court. The canvas refreshes when its parent changes size.

Practice settings are collapsed by default in a Practice panel. Open it to change fighters or testing options; input is neutralized while it is open. Close it or press Escape to return to play. Crowd movement uses CSS transforms and stops for reduced motion. Browser simulation verifies the reserved bands and control separation; real-device gameplay remains a necessary final check.

When the usable landscape width is especially narrow, controls switch to a compact two-row group in the lower band, preserving a larger court above them. Skill order, icons, and attack/dash/jump behavior remain the same. Checks cover both horizontal gutter separation and this vertical fallback.

## Full-width landscape court
Landscape touch play overlays the joystick and combat cluster inside the court, with a 58px safe-area-aware HUD strip above it and a centered bottom options dock. Audience bands and side control gutters are hidden in this orientation. The resize-mode Phaser canvas maps the entire 1600x900 authoritative court to the available rectangle; fighter containers compensate for camera axis scaling to keep their artwork proportional. Physics and world coordinates remain unchanged. Desktop and portrait use a uniform fit camera. A ResizeObserver refreshes parent bounds when browser chrome, orientation or layout changes. Responsive previews include notched 852x393 and short 568x320 screens; physical Safari testing remains necessary.
