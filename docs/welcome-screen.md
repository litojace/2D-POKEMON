# Animated welcome camp

The signed-out screen places the eight updated champion illustrations around a
campfire, using a separate empty landscape rather than baked-in characters.
One transparent Phaser canvas animates the actual game rigs, capped at 30 fps
and 1.5 pixel density. The front row uses the new back illustrations.

Complete SVG figures provide an immediate fallback while the renderer loads.
They breathe as whole figures, avoiding separated cutout joints. Auth forms
retain their existing selectors, tabs, keyboard behavior and submit actions.

The renderer pauses when hidden, is disposed on navigation, and sleeps after
one frame when reduced motion is requested. Landscape phones keep the artwork
beside an internally scrolling auth card. Safe-area padding protects controls.

`tests/visual/welcome.spec.ts` checks desktop and 844×390 / 568×320 layouts,
login/signup/recovery navigation, reduced-motion stability and canvas disposal.

Actual screenshots: [desktop](welcome-camp-desktop.png),
[landscape phone](welcome-camp-phone.png).
