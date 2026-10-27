# Raid choices and mobile arena visibility

Rite cards centre the whole icon, name and description as one group. A dedicated
heading keeps the icon and title together on short landscape screens; descriptions
wrap underneath without reserving unused rows or pushing the group off centre.
Desktop keeps the larger icon above the name.

Mobile raid battles fit the complete 1600 × 900 arena below the HUD. The boss bar
and team status occupy a separate natural layout row. Target status and two cue
lines reserve space so warnings do not move the court during a gesture. Very short
Safari viewports use a more compact HUD. Prismatail, Somnara and Storm Twins mechanic
controls sit beside the HUD, retaining their existing buttons and held gestures.
Briefings, rite choices and results still use the full safe viewport.

[Mobile rites](raid-rites-mobile.webp) · [Mobile boss arena](raid-arena-mobile.webp)

Validation checks all twelve rites at desktop, tablet landscape and two phone
heights. It checks all seven boss cameras against every arena corner, separates
the HUD and mechanic buttons from the court, and checks that targeted warnings do
not resize the canvas. An active raid is resized through Safari's shorter visible
viewport. Chromium and WebKit also recheck the three-step briefings and their start
buttons. Camera projection and raid overlay unit checks, TypeScript, the production
client build and PWA verification cover the related runtime paths.
