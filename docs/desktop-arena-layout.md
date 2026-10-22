# Desktop arena space

Desktop battles now give the court the available viewport height. Account
navigation folds into the existing Menu button during combat, and health panels
and the skill dock sit inside the court. The footer keeps keyboard hints and a
direct Settings button. Opening Menu still exposes profile, coins, admin tools
when applicable, and all existing navigation without resizing the court.

Raid battles previously reserved an invisible 156 px generic HUD row and a
separate skill-dock row. Those reservations are removed on desktop. The boss bar
is centred above the fight, party health is in the upper-left corner, and team
signals are on the right. Boss-specific controls follow the measured boss HUD
height, including the extra health bars for Storm Twins.

At a 1280 × 720 viewport, measured in the production battle UI:

| Mode | Previous court | Updated court |
| ---- | -------------- | ------------- |
| PvP  | 1097 × 617 px  | 1180 × 664 px |
| Raid | 642 × 361 px   | 1180 × 664 px |

The complete court retains its 16:9 proportions and existing camera/input
mapping. Gameplay, combat rules, networking and touch layout are unchanged.

Validation includes desktop viewports of 1024 × 600, 1280 × 720, 1920 × 1080
and 2560 × 1080, plus 844 × 390 touch checks. Review covers duel, teams, FFA,
practice controls, four-player raids, long player names, daily-raid badges,
Somnara calls, Prismatail controls, Storm Twins targeting, and opening/closing
navigation and settings without moving the court.
