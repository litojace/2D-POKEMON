# Desktop arena space

Desktop battles now give the court the available viewport height. Account
navigation folds into the existing Menu button during combat. In taller windows,
health panels and the timer sit above the court and skills below it, using the
otherwise empty vertical margins. In short or wide windows they stay inside the
court so its size never has to shrink to accommodate control rows. The footer
keeps keyboard hints and a direct Settings button. Opening Menu still exposes
profile, coins, admin tools
when applicable, and all existing navigation without resizing the court.

Raid battles previously reserved an invisible 156 px generic HUD row and a
separate skill-dock row. Those reservations are removed on desktop. The boss bar
is centred above the fight, party health is in the upper-left corner, and team
signals are on the right. Boss-specific controls follow the measured boss HUD
height, including the extra health bars for Storm Twins.

When the outside layout fits, raid party health forms a compact two-column group
beside the boss health panel above the arena. Boss-specific controls can then use
the freed upper court edge. Placement measures actual wrapped content and updates
on window resizing or HUD height changes. Phaser mouse bounds refresh even when
only the court position changes, keeping aim aligned with the canvas.

At a 1280 × 720 viewport, measured in the production battle UI:

| Mode | Previous court | Updated court |
| ---- | -------------- | ------------- |
| PvP  | 1097 × 617 px  | 1180 × 664 px |
| Raid | 642 × 361 px   | 1180 × 664 px |

The complete court retains its 16:9 proportions and existing camera/input
mapping. Gameplay, combat rules, networking and touch layout are unchanged.
At 1720 × 1200, the practice court remains 1704 × 959 px while the HUD and skills
move completely outside it with a 10 px gap.

Validation includes desktop viewports of 1024 × 600, 1280 × 720, 1920 × 1080
and 2560 × 1080, plus 844 × 390 touch checks. Review covers duel, teams, FFA,
practice controls, four-player raids, long player names, daily-raid badges,
Somnara calls, Prismatail controls, Storm Twins targeting, and opening/closing
navigation and settings without moving the court.

The outside layout is also checked at 1600 × 1200 and 1720 × 1200, with four-player
raids and repeated resizing between inside/outside placement. Court dimensions
remain identical, and mouse coordinates continue to match the canvas after each
position change.
