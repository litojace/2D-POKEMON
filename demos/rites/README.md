# Rites choice screen: design demos

Every image is from a real raid in the visual harness (Prismell, chapter 2,
3 raiders, 12 s left). `compare-<size>.png` puts the four side by side: top
left current, top right A, bottom left B, bottom right C.
`compare-states-844x390.png` shows each look with one rite picked (left) and
Rite details open (right).

Sizes: 844×390 and 667×375 phones, 1440×900 desktop, 956×440 iPhone with the
Dynamic Island insets (59 px each side, 21 px at the bottom).

- **current**: the card in the middle of the screen, as on main.
- **A · Centre stage**: the countdown's layout. Title and a big seconds number at the top, the six rites in a 3×2 grid in the middle, the arena showing all round.
- **B · Hand of cards**: the middle of the arena stays clear. Title top left, big number top right, the six rites in one row of cards along the bottom.
- **C · Side rail**: the big number and the title stacked on the left over the arena, the rites in a column of rows on the darker right side.

All three fill the whole screen past the notch, under a see-through shade
(no blur), with big bold type and no card around them. The rites, buttons,
details and team list are the same as today. To try one live, open the game
with `?rites=a`, `?rites=b` or `?rites=c`.

## A, second round (`a-v2/`)

After the owner's notes on A:

- The buff figures sit beside the rite's picture instead of on top of it,
  each with its unit (−25% / damage · 3s; Helping Paws shows both figures).
- The arena turns grey under the shade, as the PvP countdown's arena looks.
- The tiles are taller and fill the middle. Where the screen has room
  (956×440 and up) each also shows the rite's full effect.
- Rite details puts the six rites in columns instead of long lines.
- Hover only on devices with a mouse: a tap on a phone no longer leaves a
  tile highlighted.

## A, third round (`a-v3/`)

The owner meant the countdown's navy shade, not a grey arena: the grey
filter is gone, and A uses exactly the countdown's shade (the same radial
navy gradient as `#arena-overlay.is-countdown`). Everything else is as in
round two.

## A, fourth round (`a-v4/`)

The middle of the map looked uncovered because no shade was drawn at all:
the overlay's base rule set a transparent background and, being more
specific, beat every look's shade (in all earlier demo images, A, B and C
alike; round two only looked darker because of the grey filter). Fixed, and
A's shade is now one even navy over the whole screen (65%, the countdown's
edge strength) rather than the countdown's lighter middle. The demo spec
now checks the overlay's colour and that it covers the screen.
