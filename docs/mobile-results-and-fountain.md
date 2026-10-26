# Mobile results and fountain flow review

The fountain now emits water from the open nozzle below the crystal into the top bowl. Water then overflows both rims in broader, denser cascades (16 nozzle jets, 28 upper and 44 lower streams), with travelling highlights, droplets, foam and landing ripples. The stone art, plaza centre and hovering crystal placement are unchanged. All water and crystal movement stops when reduced motion is enabled.

- [Animated fountain](fountain-water.gif)
- [Nozzle and three water levels](fountain-nozzle-flow.webp)
- [Victory in WebKit at 844×390](mobile-victory-webkit.webp)
- [Victory in a 280px-high mobile viewport](mobile-victory-short.webp)

The victory footer was accidentally being placed in the flexible content row when mobile CSS hid the eyebrow above the title. Explicit grid rows now keep all result actions in their own footer while only match details scroll. Native touch swipes and the Return action were exercised at 844×280 and 844×390; all buttons also fit at 1024×500. The same geometry, scrolling and return flow were checked in WebKit.

The white screenshot matches the bare HTML shell shown when the game resources have not loaded, rather than the styled portrait gate. An inline loading/recovery shell now survives missing JS/CSS, keeps the portrait hint hidden until the game stylesheet is present and retries a failed startup once. Persistent failure offers a manual reload. Recovery does not clear login storage and never reloads a running game. Browser checks intentionally fail both the entry module and stylesheet, recover through Reload, and separately verify one automatic retry after an interrupted entry fetch. These checks passed in Chromium and WebKit. The user's intermittent on-device trigger has not been independently reproduced.

Town packet handlers also ignore callbacks after their view closes. The offline Socket.IO stub now honours off/once, so return-to-town tests do not invoke destroyed views.

Validation: typecheck, 73 client tests, 14 focused unit tests, client production build, PWA checks, 7 Chromium browser checks, 3 WebKit recovery checks, and a WebKit results/return audit passed.
