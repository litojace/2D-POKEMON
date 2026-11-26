# Mobile combat controls

## Layout: the corner (trial from 26 Nov 2026)

The owner asked to play with a mobile-MOBA layout for a while ("B" in the
controls proposal). The basic attack sits in the bottom-right corner;
skills 1–3 sit on one arc round it, from straight left round to straight
up, each keeping one gap to the basic attack and to each other; the
ultimate takes the gap outside skills 1 and 2, Dash the gap outside 2 and
3, and Jump the gap below the ultimate. Each of those keeps that same gap
to both its neighbours. The target button sits at the cluster's right
edge over the basic attack, clear of every button.

Button sizes are unchanged: on an 844×390 viewport skill circles are about
57 CSS px, Basic 87, Ultimate 60, Dash and Jump 50, and the target button
44. Small screens keep 44 px targets (48 for Dash and Jump), and very small
screens keep the compact fallback.

The previous layout (one even ring round the basic attack, Dash and Jump on
its right, approved 16 Nov 2026) is one constant away:
`COMBAT_LAYOUT` in `apps/client/src/mobile-input.ts` (`"ring"`). Measured
on the same phones, the corner moves the thumb about 60 px farther from the
basic attack to Dash, Jump and the ultimate (about 140 px instead of 80)
and covers about the same share of the screen.

## Drag to aim (`apps/client/src/touch-aim.ts`)

- A quick tap on a skill aims at the nearest (or locked) enemy, as before.
  Skills that aim cast when the finger lifts, so a tap fires about a tap's
  length later than before.
- Holding a skill shows a guide on the court: an arrow (or a wedge for a
  strike in front or a fan of shots) of the skill's range, a spot within
  its range, or a ring round the enemy a storm, wire or swap will pick.
  Faint until the finger moves 12 px, then firm.
- Dragging picks the direction; for spots and enemy picks, how far the
  finger goes into the drag circle picks how far.
- Back at the middle of the drag, or over the cancel spot (the target
  button turns into a ✕ while a skill is dragged), lifting cancels.
- Skills that never read the aim (novas, buffs, shields, decoys, and a
  zone that follows the caster) still fire on the press, and below a full
  meter the ultimate button arms EX on the press.
- The server reads the aim when a cast happens, which can be after the
  180 ms skill buffer, a wind-up, or each wave of a storm. The client keeps
  sending the dragged aim that long after the finger lifts (`hold`), and a
  target pick stays on its enemy. The server needs no change: every input
  already carries the aim.

How each skill kind reads the aim comes from the server's cast code;
`tests/unit/touch-aim.test.ts` fails for a kind it does not know, so a new
kind needs its place there.

## Also from the proposal

- The joystick is faint (a third of the HUD opacity) while no thumb is on
  it; the stick still floats to any touch on the left half.
- A button with an enemy standing behind it fades, so the fight shows
  through; it still takes a finger. The buttons' circles are measured once
  per layout, never per frame.
- A skill back from its cooldown flashes once and taps the phone (Settings
  → Vibration turns that off).

## Checks

`tests/unit/combat-layout.test.ts` (corner geometry at four phones and
three button sizes), `tests/unit/touch-aim.test.ts`,
`tests/visual/touch-aim.spec.ts` (tap, drag, cancel, held stick and basic,
the inputs a battle sends, screenshots at 667×375, 844×390 and 852×393),
`tests/visual/mobile-combat-layout.spec.ts` and
`tests/visual/touch-target.spec.ts`.
