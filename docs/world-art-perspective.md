# Shared world art perspective

The fountain now uses the approved higher-view design. World art follows
`packages/shared/src/world-art.ts`: circular surfaces have a depth of 0.65 of
their width, and ambient sunlight, shadow tone and blur come from one definition.
The rings of the plaza remain concentric with the fountain's ground anchor.

| System                                                   | Presentation rule                                                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Town paving, markers, lamps, roaming path                | One ground ellipse, one centre.                                                                                                                                                                                   |
| Fountain                                                 | New higher-view painting; its bottom plinth is the anchor, with the water above it. Bowls, waterfall trajectories and crystal share this placement.                                                               |
| Tower, windmill, well, barrels, bollards, statue plinths | Circular tops use the common ground depth. Sprite baking includes transparent padding so enlarged top faces and footings do not get cut off.                                                                      |
| Town and duel courts                                     | Same sun vector and shadow settings. Raid floors inherit the court painting kit.                                                                                                                                  |
| Raid props and floor decorations                         | Brazier rims, relay caps, prism sources, rune plinths and decorative water ripples use the same projected ground shapes.                                                                                          |
| Fighters and bosses                                      | Upright illustrated actors, sorted at their ground positions. Approved anatomy, skins and animation layers keep their proportions. Organic silhouettes and elongated contact shadows retain their authored shape. |
| Fighter effects                                          | Team/mastery/ultimate rings, elemental battle auras, collection and Awakening auras use the shared ground projection. The fighter-foot offset is shared across town, battle, welcome and previews.                |
| Shop, Wardrobe and fighter selection                     | Reuse the same rig and cosmetic renderers. Projected auras fit below the authored feet inside the preview frame; a soft contact shadow replaces the Shop's outlined platform.                                     |

An oval stadium, a pond, an oblong shadow or a vertical glass panel is not a
circular ground feature: its physical shape remains oval or upright. Combat
warnings and interaction boundaries retain their exact gameplay positions,
radii and outlines. Presentation changes do not alter attack collision, timing,
movement speed or skill ranges.

`tests/unit/world-art.test.ts` checks the shared projection and light, the
fountain anchor, preview aura bounds and battle/collection aura geometry. The
existing unit, art and browser suites cover every court and boss, all eight
champions' illustrated animations, preview layouts and both animated waterfalls.

World-scene review images: [plaza](town-fountain.png),
[tower](world-art-tower.png), [Raid Hall](world-art-raid-hall.png),
[market](world-art-market.png), [PvP court](world-art-court.png), and
[raid](world-art-raid.png).

Future art should use the ground contact point as its origin. Correct an asset's
view angle and anchor rather than shifting one paving ring away from the rest.
