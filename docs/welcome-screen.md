# Static plaza welcome

The signed-out screen uses one cohesive night-time painting of Elemental Plaza:
turquoise fountain, warm lanterns, wet limestone and distant arena arches.
One seated Voltkit is painted into the foreground beside the fountain.
The left third carries the artwork; the upper-left sky leaves room for the
brand, and the quiet right side keeps the account form readable.

There are no separate champions, campfire layers, motes, background drift or
welcome Phaser renderer. Loading indicators and account controls retain their
normal behaviour. The town and battle animation renderers are unaffected.

Responsive WebP exports use the same illustration: 1024 pixels wide for smaller
screens and the original 1672 pixels for desktop/high-density displays. They
remain still under normal and reduced-motion preferences. Landscape phones
keep an internally scrolling account card within the viewport and safe areas.

`tests/visual/welcome.spec.ts` checks 1440×900, 1280×720, 844×390 and 568×320,
actual image loading, stillness, no welcome canvas/animation requests,
login/signup/recovery navigation, reachable submit buttons and page overflow.

Actual screenshots: [desktop](welcome-plaza-desktop.webp),
[landscape phone](welcome-plaza-phone.webp).
