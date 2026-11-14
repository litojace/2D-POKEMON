# Boss identity and splash refresh

The raid's storage IDs stay stable. They are used by clears, run receipts,
daily schedules, rewards and equipped cosmetics. Renaming a creature does
not create a second boss or delete the player's progress.

| Storage ID  | Display name / identity           | Arena          | Splash filename |
| ----------- | --------------------------------- | -------------- | --------------- |
| grumblecrag | Cragmuff, crystal-horned ram      | Raid Coliseum  | grumblecrag     |
| tidewyrm    | Tidelotl, pearl-browed axolotl    | Lagoon         | tidewyrm        |
| gloomshade  | Inkpurr, living ink cat           | Lantern Yard   | gloomshade      |
| somnara     | Snoozaku, sleepy violet tapir     | Cloud Deck     | somnara         |
| prismatail  | Prismell, iridescent-shell snail  | Sun Atrium     | prismatail      |
| emberwing   | Lumiwick, paper sky lantern       | Sky Terrace    | emberwing       |
| storm-twins | Fizz and Crackle, thunder jellies | Conductor Ring | storm-twins     |

Splash filenames use the stable storage IDs above, including `emberwing`
for Lumiwick, `somnara` for Snoozaku and `prismatail` for Prismell.

Each illustration has a 1536×1024 hero, a 320×213 thumbnail and a 600×900
portrait crop in `apps/client/src/art/raid-splash/`. Framing points are in
`screens/raid-hall-view.ts`; regenerate the crops with
`docs/ui-remodel/tools/boss-portraits.sh` after changing a hero.

The former painted combat atlases and unused articulated/directional/whole
source PNGs have been removed, along with their obsolete exporters. Their
history remains in Git. Spell flipbooks, floor artwork, frame metadata and
active procedural renderers are retained because they are still used.

## Combat renderer status

Cragmuff, Tidelotl, Inkpurr, Lumiwick and the Storm Twins use their current
procedural combat rigs. Snoozaku and Prismell's combat rigs still depict
the previous whale and peacock. Their tapir/snail splash art, crests and
roster descriptions are updated here; replacing those two animated rigs
is separate rendering work. Do not remove an active rig before its
replacement is wired into battle, guide sprites and prewarming.

## Database

Migrations 112–115 already rename the four renamed bosses and their titles.
`116_boss_identity_refresh.sql` reconciles roster names and old
boss names in title descriptions after those migrations. It updates
existing rows only, is repeatable, and preserves all boss/reward/title IDs
and ownership links. This refresh does not apply migrations to a live DB.
