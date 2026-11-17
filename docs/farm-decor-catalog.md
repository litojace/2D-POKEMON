# Farm decorations: catalog, groups, paths, seasons and collections

Since `20261117120000_farm_decor_catalog.sql` the farm sells 61
decorations (19 before, 42 new) in eight groups. The list lives in
`FARM_DECOR` (`packages/shared/src/farm.ts`); the database's
`arena_farm_decor_items` is the same list, and
`tests/integration/farm-decor.test.ts` checks that they match.

## Rules

- **Ground.** Each decoration takes a box of ground: `w` is half its width,
  `d` how deep it is behind the point it stands on, plus 4 px in front
  (`decorBox`). Decorations snap to a 10 px grid.
- **Two layers.** Paths and paving (`ground: true`: Stepping Stones, Gravel
  Path, Brick Path) lie flat. A path may overlap other paths, never anything
  standing; everything else keeps apart from every other decoration. Both
  layers keep off the field, the buildings, the pond, the lanes and the
  farm's trees (`DECOR_BLOCKS`). `decorFits` and `arena_farm_decor_fits` are
  the same check; the integration test compares them on 1,400 random spots,
  a third of them paths.
- **Rows.** Fences and the hedge are 50 px wide, so pieces placed 50 px
  apart touch and read as one fence.
- **Drawing order.** Paths are drawn on the ground before the sun's shadows
  and everything standing; standing decorations sort by depth with the
  rest of the farm. A tap while moving picks what stands before a path.
- **Seasonal.** Seasonal decorations are sold only in their season, by the
  server's game day (`arena_today`, Los Angeles). Once bought they are kept:
  put away, they place again at any time. The farm state reports
  `decorSeasons`, the seasons on sale today.

| Season         | On sale (inclusive)                             |
| -------------- | ----------------------------------------------- |
| Halloween      | 1 Oct – 7 Nov                                   |
| Christmas      | 1 Dec – 6 Jan                                   |
| Lunar New Year | 15 Jan – end of February (29 Feb in leap years) |

Lunar New Year falls between 21 Jan and 20 Feb, so the window covers every
year's festival and, except in the latest years (2034: 19 Feb, Lantern
Festival 5 Mar), the Lantern Festival 14 days after it.

- **Collections.** When every piece of a set stands on the farm at once,
  the set's bonus Charm is added (`decorCharm`, `arena_farm_charm`). A
  second copy of a piece adds only its own Charm; putting a piece away ends
  the bonus. Charm still gives +1% farm XP per 2 Charm, up to 25%.

## Prices

New decorations cost **300 to 650 Gold Leaves per Charm**
(`tests/unit/farm-decor-place.test.ts` keeps them there): about 300–450
below level 10, 450–600 above. Existing decorations are unchanged; their
trees cost more per Charm (1,000–1,600), so the new trees are the cheaper
way to Charm at their level. Seasonal decorations unlock early (level 1,
5 and 10) so every player can join an event.

### Fences & paths

| Decoration      | id           | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                                              |
| --------------- | ------------ | ----: | ----: | -----------: | ----: | ------------ | -------------------------------------------------- |
| Stepping Stones | `pathstone`  |   300 |     1 |          300 |     2 | 40×20        | **new**, path (overlaps paths), set: Lantern Walk  |
| Picket Fence    | `picket`     |   300 |     1 |          300 |     3 | 50×10        | **new**, set: Cottage Garden                       |
| Gravel Path     | `pathgravel` |   300 |     1 |          300 |     4 | 60×20        | **new**, path (overlaps paths), set: Picnic Meadow |
| Rail Fence      | `railfence`  |   350 |     1 |          350 |     5 | 50×10        | **new**                                            |
| Garden Gate     | `gate`       |   600 |     1 |          600 |     9 | 50×10        | **new**, set: Cottage Garden                       |
| Brick Path      | `pathbrick`  |   450 |     1 |          450 |    10 | 60×20        | **new**, path (overlaps paths)                     |
| Box Hedge       | `hedge`      | 1,000 |     2 |          500 |    14 | 50×14        | **new**                                            |

### Flowers & plants

| Decoration     | id           | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                        |
| -------------- | ------------ | ----: | ----: | -----------: | ----: | ------------ | ---------------------------- |
| Mossy Rock     | `rock`       |   300 |     1 |          300 |     1 | 52×18        | existing                     |
| Tulip Patch    | `tulips`     |   350 |     1 |          350 |     2 | 40×14        | **new**, set: Cottage Garden |
| Rose Bush      | `bush6`      |   450 |     1 |          450 |     3 | 68×20        | existing                     |
| Potted Daisies | `potdaisy`   |   400 |     1 |          400 |     4 | 24×12        | **new**                      |
| Fern Bush      | `bush7`      |   550 |     1 |          550 |     5 | 68×20        | existing                     |
| Sunflowers     | `sunflowers` |   450 |     1 |          450 |     6 | 40×14        | **new**, set: Picnic Meadow  |
| Flower Bush    | `flowers`    |   650 |     1 |          650 |     7 | 68×20        | existing                     |
| Flower Barrow  | `barrow`     | 1,000 |     2 |          500 |    13 | 52×16        | **new**, set: Cottage Garden |
| Lavender Row   | `lavender`   | 1,100 |     2 |          550 |    15 | 60×14        | **new**                      |
| Flower Planter | `planter`    | 2,250 |     3 |          750 |    16 | 100×18       | existing                     |
| Topiary        | `topiary`    | 1,500 |     3 |          500 |    20 | 32×14        | **new**                      |

### Trees

| Decoration     | id        | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                          |
| -------------- | --------- | ----: | ----: | -----------: | ----: | ------------ | ------------------------------ |
| Silver Birch   | `birch`   | 1,800 |     3 |          600 |    18 | 60×22        | **new**, set: Woodland Friends |
| Mint Tree      | `mintree` | 3,000 |     3 |         1000 |    19 | 92×24        | existing                       |
| Bamboo Grove   | `bamboo`  | 1,650 |     3 |          550 |    21 | 48×16        | **new**, set: Water Garden     |
| Pine Tree      | `pine`    | 3,200 |     2 |         1600 |    22 | 68×22        | existing                       |
| Maple Tree     | `autumn`  | 3,600 |     3 |         1200 |    25 | 92×24        | existing, set: Orchard         |
| Cherry Tree    | `cherry`  | 3,900 |     3 |         1300 |    27 | 92×24        | existing, set: Orchard         |
| Palm Tree      | `palm`    | 2,400 |     4 |          600 |    28 | 60×22        | **new**                        |
| Apple Tree     | `apple`   | 4,200 |     4 |         1050 |    30 | 92×24        | existing, set: Orchard         |
| Weeping Willow | `willow`  | 3,000 |     5 |          600 |    34 | 92×24        | **new**, set: Woodland Friends |
| Orange Tree    | `orange`  | 4,800 |     4 |         1200 |    36 | 92×24        | existing, set: Orchard         |

### Furniture

| Decoration     | id          | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                       |
| -------------- | ----------- | ----: | ----: | -----------: | ----: | ------------ | --------------------------- |
| Hay Bale       | `hay`       |   400 |     1 |          400 |     2 | 68×20        | existing, set: Orchard      |
| Mailbox        | `mailbox`   |   500 |     1 |          500 |     4 | 28×12        | existing                    |
| Deck Chair     | `deckchair` |   450 |     1 |          450 |     5 | 32×14        | **new**, set: Picnic Meadow |
| Park Bench     | `bench`     |   700 |     1 |          700 |     6 | 92×16        | existing                    |
| Crates         | `crates`    |   950 |     1 |          950 |     8 | 64×20        | existing                    |
| Picnic Table   | `picnic`    |   900 |     2 |          450 |     9 | 80×20        | **new**, set: Picnic Meadow |
| Patio Umbrella | `parasol`   | 1,000 |     2 |          500 |    11 | 44×16        | **new**, set: Picnic Meadow |
| Garden Swing   | `swing`     | 1,500 |     3 |          500 |    17 | 72×18        | **new**                     |
| Gazebo         | `tower`     | 6,050 |    10 |          605 |    45 | 144×38       | existing                    |
| Guest Cottage  | `plum`      | 8,550 |    12 |          713 |    60 | 176×44       | existing                    |

### Water

| Decoration      | id         | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                        |
| --------------- | ---------- | ----: | ----: | -----------: | ----: | ------------ | ---------------------------- |
| Birdbath        | `birdbath` |   550 |     1 |          550 |     7 | 28×12        | **new**, set: Cottage Garden |
| Lily Pond       | `lilypond` | 1,800 |     3 |          600 |    20 | 92×26        | **new**, set: Water Garden   |
| Little Fountain | `fountain` | 2,400 |     4 |          600 |    24 | 60×20        | **new**, set: Water Garden   |
| Wooden Bridge   | `bridge`   | 1,800 |     3 |          600 |    26 | 72×20        | **new**, set: Water Garden   |

### Lights

| Decoration    | id             | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                      |
| ------------- | -------------- | ----: | ----: | -----------: | ----: | ------------ | -------------------------- |
| Tiki Torch    | `torch`        |   500 |     1 |          500 |     8 | 20×12        | **new**, set: Lantern Walk |
| Paper Lantern | `lantern`      |   900 |     2 |          450 |    10 | 24×12        | **new**, set: Lantern Walk |
| Street Lamp   | `lamp`         | 1,350 |     2 |          675 |    12 | 28×12        | existing                   |
| String Lights | `stringlights` | 1,650 |     3 |          550 |    23 | 80×12        | **new**, set: Lantern Walk |
| Stone Lantern | `stonelantern` | 2,200 |     4 |          550 |    29 | 32×14        | **new**, set: Lantern Walk |

### Statues

| Decoration            | id       |  Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                          |
| --------------------- | -------- | -----: | ----: | -----------: | ----: | ------------ | ------------------------------ |
| Frog Statue           | `frog`   |    550 |     1 |          550 |     6 | 28×12        | **new**, set: Water Garden     |
| Bunny Statue          | `bunny`  |    900 |     2 |          450 |    12 | 28×12        | **new**, set: Woodland Friends |
| Owl Statue            | `owl`    |  1,100 |     2 |          550 |    16 | 28×14        | **new**, set: Woodland Friends |
| Deer Statue           | `deer`   |  2,400 |     4 |          600 |    32 | 48×16        | **new**, set: Woodland Friends |
| Golden Voltkit Statue | `statue` | 30,000 |    15 |         2000 |    75 | 76×22        | existing                       |

### Seasonal

| Decoration        | id           | Price | Charm | Leaves/Charm | Level | Ground (w×d) | Notes                                             |
| ----------------- | ------------ | ----: | ----: | -----------: | ----: | ------------ | ------------------------------------------------- |
| Jack-o'-Lantern   | `pumpkin`    |   600 |     1 |          600 |     1 | 28×14        | **new**, Halloween only, set: Spooky Night        |
| Red Lantern Post  | `redlantern` |   600 |     1 |          600 |     1 | 24×12        | **new**, Lunar New Year only, set: Lunar New Year |
| Snowman           | `snowman`    |   600 |     1 |          600 |     1 | 36×14        | **new**, Christmas only, set: Winter Holiday      |
| Spooky Tombstone  | `tombstone`  |   900 |     2 |          450 |     5 | 32×12        | **new**, Halloween only, set: Spooky Night        |
| Lucky Cat         | `luckycat`   |   900 |     2 |          450 |     5 | 28×14        | **new**, Lunar New Year only, set: Lunar New Year |
| Gift Pile         | `gifts`      |   900 |     2 |          450 |     5 | 40×14        | **new**, Christmas only, set: Winter Holiday      |
| Witch's Cauldron  | `cauldron`   | 1,500 |     3 |          500 |    10 | 36×14        | **new**, Halloween only, set: Spooky Night        |
| Plum Blossom Tree | `plumtree`   | 1,800 |     3 |          600 |    10 | 60×22        | **new**, Lunar New Year only, set: Lunar New Year |
| Christmas Tree    | `xmastree`   | 1,800 |     3 |          600 |    10 | 60×22        | **new**, Christmas only, set: Winter Holiday      |

## Collections

| Set              | Pieces                                                                   | Bonus Charm |
| ---------------- | ------------------------------------------------------------------------ | ----------: |
| Cottage Garden   | Picket Fence, Garden Gate, Tulip Patch, Birdbath, Flower Barrow          |          +4 |
| Picnic Meadow    | Picnic Table, Patio Umbrella, Deck Chair, Sunflowers, Gravel Path        |          +4 |
| Lantern Walk     | Tiki Torch, Paper Lantern, String Lights, Stone Lantern, Stepping Stones |          +5 |
| Orchard          | Apple Tree, Orange Tree, Cherry Tree, Maple Tree, Hay Bale               |          +5 |
| Water Garden     | Little Fountain, Lily Pond, Wooden Bridge, Frog Statue, Bamboo Grove     |          +6 |
| Woodland Friends | Silver Birch, Weeping Willow, Owl Statue, Bunny Statue, Deer Statue      |          +6 |
| Spooky Night     | Jack-o'-Lantern, Spooky Tombstone, Witch's Cauldron                      |          +3 |
| Lunar New Year   | Red Lantern Post, Lucky Cat, Plum Blossom Tree                           |          +3 |
| Winter Holiday   | Snowman, Gift Pile, Christmas Tree                                       |          +3 |

## Adding a decoration

1. Add it to `FARM_DECOR` (id of lowercase letters and digits: the server
   checks `^[a-z0-9]+$`), with its group, size and price, and to a new
   migration's `arena_farm_decor_items` insert (never edit one that ran).
2. Draw it in `farm-gfx.ts` (`DECO_ART`: `[width, height, anchor x,
anchor y, draw]`, baked once to a 2x canvas), or reuse a sprite or a
   tree.
3. Give it a row in `DECO_LOOK` (`farm-scene.ts`): its soft shadow, how tall
   it stands, whether it casts a sun shadow (`cast`) and its light after
   dark (`light`). Lights (the night's light map and their glow) and cast
   shadows come from that table, not from code per decoration.
4. Run `tests/integration/farm-decor.test.ts`,
   `tests/unit/farm-decor-place.test.ts` and
   `tests/visual/farm-decor-catalog.spec.ts` (every preview must paint).

## Performance

Each decoration is one baked sprite blit plus a stamped soft shadow; only
those near the view are drawn. Sun shadows and glows are not drawn at Low.
`tests/visual/farm-decor-catalog.spec.ts` draws a farm with 60 decorations
and checks the frame costs little more than an empty farm, at Low on a
phone-sized screen and at the default level.
