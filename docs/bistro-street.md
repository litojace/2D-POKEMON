# The Bistro's street: how the town around the restaurant is built

Code: `apps/client/src/bistro/` — `bistro-town.ts` (map, people, bus),
`bistro-city.ts` (buildings), `bistro-props.ts` (street furniture, trees,
which props are baked), `bistro-vehicles.ts`, `bistro-water.ts`,
`bistro-depth.ts`, `bistro-pics.ts`, `bistro-scenery.ts` (putting it together).

## One scale

A grid unit is about a metre on the ground and 55 world px of height. A
creature stands about 75 px tall. A car is 2.5 units long and 66 px tall
(about a creature), a van 2.9 and 92 px, the bus 5.2 units and 122 px. A
lane is 2.1 units wide, a shop's ground floor 118 px (its door 88), an
upper storey 84. New things are measured against these
(`tests/unit/bistro-scenery.test.ts` checks the vehicles).

## The camera

No horizon: the ground runs to every edge and the camera never leaves the
dressed town (`SCENE_MARGIN` around the room's bounds). Zooming out stops a
little past the fit (0.92×). Anything the camera can reach must be dressed.

## What is drawn over what

Every standing thing has a footprint box. Things that overlap on screen are
ordered by a plane between their boxes, then the list is sorted
topologically (`bistro-depth.ts`), as isometric engines do. Sorting by one
number per thing (x + y) is wrong for long things like the bus.

A prop is baked with the ground only if nothing moving can ever stand behind
it: `coversMovers()` checks every prop against samples of every path,
lane and seat, and the rest are drawn every frame from cached pictures.
Buildings must always be bakeable (a unit test fails otherwise): place rows
so the road does not run behind them. Nothing tall stands in front of the
bistro hiding it (`hidesRoom()`).

## Water

The baked street has a hole where the canal's water shows; the water is
drawn under it every frame (`bistro-water.ts`), so bridges and banks cover
it correctly. Ducks keep clear of the bridges.
