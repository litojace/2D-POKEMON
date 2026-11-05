# Farm social redesign: demo

A clickable, browser-only demo of five social features for the Elemental Farm.
Open [demo.html](demo.html) in a browser (no build, no server). Everything in it
is sample data: friends, prices, co-op points and the invite code. The design
notes in the demo are in Vietnamese.

The farm is drawn with the game's own art (`apps/client/src/farm/farm-gfx.ts`,
`crop-art.ts` and the fighters from `creature-design.ts`), bundled into
`art.js`. On top of it the demo adds a "feel" layer that only needs client
work:

- Everything reacts to a tap: chickens hop and scatter, the cow moos, the dog
  barks and runs over, the sleeping cat wakes, trees shake and drop fruit,
  the pond ripples and the ducks hurry off, the windmill spins up.
- Swipe across ripe crops to harvest a row; the pitch rises with the combo and
  six in a row is a Super Swipe. Produce flies to the barn.
- Sound is synthesized with Web Audio (no files), with a mute button.
- Day, golden hour and night (lamps, lit windows, fireflies, crickets); rain
  waters every crop and ends with a rainbow.
- Gold (×5) and Rainbow (×15) crops glow; level-ups, balloon launches and Cup
  tasks end in confetti. Friends walk over and carry crates, water your crops
  and dance.
- A slow device (under about 38 fps for 2 seconds) drops cloud shadows and
  light shafts; reduced motion drops shake, most confetti and drifting clouds.

Rebuild `art.js` after the art changes with:

```
npx esbuild@0.24.0 docs/farm-social/art-entry.ts --bundle --format=iife --minify --target=es2020 --alias:@arena/shared=./packages/shared/src/index.ts --outfile=docs/farm-social/art.js
```

The current farm already covers solo play (weather and mutations, orders,
giant crops, tools, dogs, decor, async friend visits). The demo adds reasons
for friends to need each other. Only the mechanics are borrowed; names and art
are the game's own.

| Feature                                                                                         | Mechanic it borrows                                         | Builds on                               |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Farm Stall and Valley Paper: sell crops to friends at 0.5×–1.5× the day's market, 10% stall fee | Hay Day roadside shop and newspaper                         | Barn, Gold Leaves (036), Friends (005)  |
| Supply Balloon: six crates; ask friends for the ones you can't grow; helpers earn Helper Stars  | Hay Day boat orders, Clash of Clans donations               | Order board (040), friends' farms (047) |
| Valley Cup: weekly co-op of up to 10, one task at a time, 5-co-op league                        | Hay Day Derby, Township Regatta, Clash of Clans Clan Games  | Monday weeks, missions                  |
| Daily seed gifts, friendship levels, invite rewards (counted at farm Lv 10)                     | Pokémon GO friendship, Animal Crossing gifts                | Friends (005), guard dogs (045, 047)    |
| Live farm visits, Harvest Party (3 crops instead of 2 next to a friend), weekly likes ranking   | Grow a Garden, Stardew Valley co-op, Animal Crossing visits | Plaza's realtime Socket.IO rooms        |

Nothing here is wired to the server. Each feature would need its own
migration and server-side rules (price bands, daily caps, row locks and request
ids, as the farm does today) before it ships.
