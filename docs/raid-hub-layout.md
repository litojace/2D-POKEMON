# Raid Hub layout

Boss pages use independent navigation, details and actions inside the menu frame.
On desktop and landscape screens the boss list is a scrollable rail to the left;
in narrow portrait browser windows it becomes a horizontal strip. The selected
boss remains visible after a selection or tab change. Keyboard focus returns to
the chosen boss, and tab buttons keep their own focus after re-rendering.

Overview presents the approved text-free poster beside the boss identity and six
practice buttons. The full illustration is contained, including on short phones.
Ordinary landscape screens use two columns of skills; short screens use three
columns and omit the small hints while retaining the complete practice instruction
in each button's accessible name. Every skill keeps at least a 44px touch target.

The optional Raid guide contains the introduction, three phases and champion
tricks, without repeating the introduction above the guide. Rewards has its own
compact boss heading. Entry actions stay in a separate footer; locked bosses show
their unlock requirement there and have padlock badges in navigation.

Only boss pages use this frame arrangement. Opening another menu removes the raid
navigation class and restores the shared dialog layout. The game's landscape
requirement for touch play is unchanged; portrait checks cover narrow desktop
browser windows rather than bypassing the rotation prompt.

Boss/tab changes preserve the connected roster navigation, its keyed buttons,
decoded avatar image nodes, focus and scroll position. The dialog builds new
content off-screen and patches selection attributes rather than clearing the
live rail. Only the initial Hub opening reveals the selected boss, by scrolling
the rail itself; selecting a visible boss never scrolls the dialog/page. The
roster has no scroll snapping, avoiding extra movement after selection.

The scroll regression covers repeated last-row selections, rewards/overview
tabs, vertical and horizontal rails, normal/short phones, desktop and returning
to Settings. It verifies node identity, no rail detachment, stable scroll/geometry
and correct selected/focused boss.
