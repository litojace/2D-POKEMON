# Recoverable mobile controls and clearer raid briefings

A missed terminal pointer event could leave a joystick or attack finger owned
forever. The next contact could not claim that control. Disabled cooldown buttons,
unavailable pointer capture, and iOS standalone focus restoration made those paths
particularly fragile.

The controls now observe pointer release/cancellation at the window in capture
phase, retain global movement/end handling if native capture fails, and clear all
contacts when a legacy touch-end reports no fingers. A new primary gesture clears
stale ownership before claiming its new finger. Reset releases native captures as
well as the stored state. No inactivity timer interrupts a genuine held drag.

A fresh trusted touch also restores control on a visible iOS standalone page that
still reports no document focus. Blur, hiding, leaving the page or losing control
revokes that permission and clears input. Desktop keyboard focus rules remain in
place. Prismatail's held Look away action has the same release/recovery protections
without cancelling a simultaneously held movement finger.

Each of the seven raid briefings now leads with the fight's goal and three ordered
actions, including a visible success cue. A separate survival line explains the
main hazards. Champion tricks, team signals and the encounter modifier remain in
an optional details section. Solo/team instructions differ where necessary. The
ready action stays outside the native vertical scroller; short phone layouts omit
the miniature diagrams so the instructions have room. Reading expanded details
and scrolling survive ready-state updates.

[Desktop guide](raid-guide-desktop.webp) · [Phone guide](raid-guide-mobile.webp)

Validation includes browser regressions for missing capture, releases outside a
control/over a disabled skill, missed terminal events, repeated gestures, held
movement, simultaneous attack/skill/movement, held Look away, and trusted native
touch after stale focus/menu changes. Chromium checks the actual battle input
packets; WebKit checks control recovery and all seven briefing layouts. The guide
layout is checked at desktop, phone landscape and Safari's short visible viewport.
Unit tests, TypeScript, the production build and PWA verification also run.
