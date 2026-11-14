# Raid boss splash art

The approved seven-poster set uses hand-painted fantasy art with each boss's
current identity and its own arena:

- Cragmuff (`grumblecrag`): cracked stone coliseum, amber crystals and impact dust.
- Tidelotl (`tidewyrm`): turquoise lagoon, submerged masonry and pink coral.
- Inkpurr (`gloomshade`): lantern courtyard, wet living ink and shadow hands.
- Snoozaku (`somnara`): lavender marble Cloud Deck, gold star inlays and dream runes.
- Prismell (`prismatail`): sunlit crystal atrium, opalescent shell and prism mirrors.
- Lumiwick (`emberwing`): volcanic terrace, three braziers and luminous paper ribbons.
- Storm Twins (`storm-twins`): rain-soaked conductor arena, gold/cyan lightning and four pylons.

Each boss has three WebP files in `apps/client/src/art/raid-splash/`, named by
its stable storage ID: the 1536×1024 landscape hero, 600×900 portrait and
320×213 thumbnail. `raid-splash-art.ts` maps them to the existing raid IDs.

`BOSS_FRAMES` in `screens/raid-hall-view.ts` supplies the body and face focal
points for the approved illustrations, including the zoom used on phones.
The portraits and thumbnails are cut by `docs/ui-remodel/tools/boss-art.py`
from a box around the whole creature (tails, ribbons, gills, hats) and its
face's x: the whole boss always fits, and within the room left over the cut
slides so the face sits as near the middle as it can. Where the painting runs
out, a soft filled strip sits under the card's name. The exact
boxes are in the commit that added them; `boss-portraits.sh` is the older
centre-strip cut and trims wide bosses.

The illustrations contain no UI or text. Original generation PNGs remain in
the chat's image artifacts; the repository contains optimized WebP exports.
See [boss-identity-refresh.md](boss-identity-refresh.md) for the identity map,
retired assets, migration and the two combat rigs still awaiting replacement.
