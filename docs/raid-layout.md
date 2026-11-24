# Raid choices and mobile arena visibility

Rite cards put their buff figures inside the illustrated payoff: damage reduction
on the ward shield, shared ultimate charge beside the allies, bonus damage inside
the exposed core, and healing inside a heart. A short trigger remains below the
name. Helping Paws and Fireproof show both bonuses next to the relevant symbols;
Grounded and Lucid show their actual mechanics instead of invented percentages.
Numbers remain readable HTML over vector artwork, including short phone layouts.
There is no separate, repeated stat-description badge. All twelve retain their
important conditions and the full reference retains the authoritative game rules.

The complete shared rule text remains in hover/accessibility labels and the separate
**Rite details** reference. Opening it never picks a rite; covered choices become
inert. The reference keeps its scroll area separate from its close control and the
live countdown. It stays open through timer updates and supports Escape to close.
Normal selection is still a single click or tap.

Mobile raid battles fit the complete 1600 × 900 arena below the HUD. The boss bar
and team status occupy a separate natural layout row. Target status and two cue
lines reserve space so warnings do not move the court during a gesture. Very short
Safari viewports use a more compact HUD. Prismatail, Somnara and Storm Twins mechanic
controls sit beside the HUD, retaining their existing buttons and held gestures.
Briefings, rite choices and results still use the full safe viewport.

[All twelve buff emblems](raid-rite-buffs.webp) · [Mobile rites](raid-rites-mobile.webp) · [Desktop rites](raid-rites-desktop.webp) · [Full effect reference](raid-rite-details-mobile.webp) · [Mobile boss arena](raid-arena-mobile.webp)

Validation checks all twelve rites at desktop, tablet landscape and two phone
heights. It checks all seven boss cameras against every arena corner, separates
the HUD and mechanic buttons from the court, and checks that targeted warnings do
not resize the canvas. An active raid is resized through Safari's shorter visible
viewport. Chromium and WebKit also recheck the three-step briefings and their start
buttons. Camera projection and raid overlay unit checks, TypeScript, the production
client build and PWA verification cover the related runtime paths.

The pictogram checks cover all twelve effects, drawing bounds and SVG parsing,
short triggers, exact buff values, readable stat sizes and emblem containment,
opening/closing details without a selection,
unchanged open state during live countdown updates, native finger scrolling on a
short phone, and exactly one request when a choice is selected.
