# Original creature overhaul and asset guide

## Result and scope

Element Arena now has eight original playable identities and a new elemental emblem, replacing the previous roster artwork, names and playable branding. Selection uses eight compact themed cards, element filtering, larger previews, health/speed/basic statistics and all four skills with descriptions, icons and cooldowns.

This is an implementation in the existing Phaser/Socket.IO application. The first fighter, Voltkit, was built and checked in the animation lab before extending the designs. The four established roles retain their numerical combat values. The four additions use the authoritative server simulation. Accounts, rooms, arena dimensions, collision radius, camera, dash/jump rules, mobile input and PWA installation remain in place.

The written art direction guided the initial articulated pass. The user later supplied the Element Arena Creature Showcase, which became the reference for rendered selection portraits. Connected tools support bitmap generation, SVG/code-native drawing and asset processing; no modeling/rigged-3D pipeline was available. Original articulated shaded vectors were chosen for visual consistency. **These are not production-quality pre-rendered 3D character animations.**

## Architecture and modified files

- `packages/shared/src/index.ts`: eight canonical IDs, definitions, forty unique abilities, legacy ID mapping, concealment status, network validation and snapshot normalization.
- `apps/server/src/simulation.ts`: concealment activation and reveal on casting/damage. All movement, damage, statuses and cooldowns are computed on the server.
- `apps/client/src/creature-design.ts`: original anatomy, gradients, highlights, directional features and independently drawn parts. No imported creature likenesses or whole-character mirroring.
- `apps/client/src/fighter-art.ts`: SVG portrait adapter shared with selection and the legacy texture entry point.
- `apps/client/src/animation/assets.ts`: cropped, reusable layered textures with pivots for all four directions.
- `apps/client/src/animation/controller.ts` and `rig.ts`: priority/deduplication and independent limb/feature poses, blinking, movement, attacks, skills, dash, airborne/landing, recoil, collapse, victory and wave.
- `apps/client/src/animation/asset-schema.ts`, `pack-config.ts`, `pipeline.ts`: validated asset manifests and reusable loading/playback for layered art, PNG sequences, sheets and atlases. Scenes call the factory through one `FighterVisual` interface.
- `apps/client/src/fighter-selection.ts`, `main.ts`, `style.css`: compact roster/filter/details, asset-backed portraits, original branding and integrated rendering.
- `apps/client/src/element-effects.ts`, `ability-icons.ts`: eight elemental glyph families and explicit artwork for thirty-two skills, plus basic/universal actions.
- `apps/client/public/assets/fighters/{id}/`: SVG portrait, selection art and animation metadata for every fighter.
- `scripts/export-fighters.ts`, `generate-icons.py`: reproducible original assets and install icons. Client HTML, account/install/offline UI and manifest names updated.
- Tests cover definitions, migration, asset validation, art keys, selection, all eight practice fighters, combat and animation state handling. Preview pages remain development-only.

## Completed fighter implementations and gameplay prototypes

| Fighter   | Visual identity                                                                                                         | Combat identity and four skills                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Voltkit   | Charcoal/yellow segmented electric creature; rounded antenna terminals, four articulated limbs and a charged cable tail | Ranged speedster: Arc Pulse, Charge Orb, Livewire Field, Overcharge     |
| Cindrake  | Rounded salamander, warm shaded body, toe pads, curling tail and independent glowing flame crest                        | Burst damage: Crest Flare, Ember Ring, Ember Rush, Solar Bloom          |
| Tidefin   | Sleek aquatic body, broad flowing side fins, flippers and a waterlike tail                                              | Agile assassin: Tidal Blade, Slipstream, Mirror Current, Riptide Volley |
| Auralynx  | Floating faceted crystal, glowing core and orbiting shards; no animal feet                                              | Melee/counter: Prism Shot, Shard Combination, Prism Guard, Nova Ray     |
| Thornback | Sturdy leaf-shell tortoise, vines and a flower                                                                          | Defensive tank: Bramble Seed, Verdant Guard, Root Garden, Wild Bloom    |
| Frostfang | Fluffy pale arctic creature with crystal whiskers                                                                       | Control: Ice Lance, Snow Drift, Cold Front, Crystal Blizzard            |
| Duskveil  | Floating hooded spirit, violet eyes and articulated cloak/hands                                                         | Stealth assassin: Cloak Rend, Shadow Veil, Hollow Echo, Eclipse         |
| Terradon  | Compact faceted stone golem, heavy fists and orange mineral joints                                                      | Bruiser: Faultline, Mineral Guard, Boulder Charge, Seismic Crown        |

The table describes the articulated gameplay prototypes. The later showcase-inspired portraits have richer rendered quadruped anatomy and are used in selection. This creates a visible art-fidelity difference until matching directional animation packs are supplied. All gameplay prototypes have independently moving parts appropriate to their anatomy. Levitation complements articulated shard/hand motion for Auralynx/Duskveil. Heavy creatures use slower steps; fins/crest/antennae/whiskers/leaves move independently. Celebrations differ by fighter. Wave is implemented in the animation component and lab; no online emote packet/UI was added.

Each fighter has initial procedural poses for all requested states, with a priority controller and short pose blending. Some limbs share shapes across directions. The initial directional projection and procedural casting poses are not a substitute for artist-authored directional frame sequences.

## Combat changes and migration

Voltkit/Cindrake/Tidefin/Auralynx preserve previous health, speed, basic attack values, skill damage, cooldowns, range, recovery and collision rules. Their new names/visuals do not change their combat mappings. Existing ability IDs stay stable.

The new fighters introduce additional shared definitions using existing projectile, area, rush, clone/haste, shield/counter and crowd-control mechanisms. The only new ability category/status is Shadow Veil concealment. It lasts two seconds and breaks when casting another action or taking actual damage. Enemies see a faint presentation and mobile auto-aim does not acquire the concealed target; area damage can reveal it. Snapshots still transmit positions, so this is not a server visibility/anti-cheat system. Damage and expiry remain authoritative.

Legacy fighter IDs are accepted through validation and normalized to their replacements. Invalid IDs/object-prototype keys are rejected. Wire snapshots normalize legacy fighter IDs. Ship client/server together: in-memory rooms and sessions reset on deployment. Stats/title accounts remain unchanged.

## Asset import pipeline

Each folder is `apps/client/public/assets/fighters/{fighterId}/`. Its `animations.json` declares `schemaVersion: 1`, `kind`, `portrait`, `selection`, and an honest `artStatus`. Current packs use `kind: "layered"` for generated articulated gameplay layers, with `portrait-showcase-v1.webp` for static rendered portrait/selection art. SVG prototypes remain available alongside them.

Three raster import modes are supported:

- **frames:** `files` maps frame names to transparent PNG/WebP files. Animation frames are those names.
- **sheet:** `image`, `frameWidth`, `frameHeight`; animation frames are numeric sheet indexes.
- **atlas:** `image`, `data`; animation frames are names from a Phaser JSON atlas.

For example, a sprite sheet:

```json
{
  "schemaVersion": 1,
  "kind": "sheet",
  "portrait": "portrait.png",
  "selection": "selection.png",
  "artStatus": "Artist-authored directional animation",
  "image": "gameplay.png",
  "frameWidth": 128,
  "frameHeight": 128,
  "animations": {
    "idle-down": { "frames": [0, 1, 2, 3], "fps": 8, "loop": true },
    "idle-up": { "frames": [4, 5, 6, 7], "fps": 8, "loop": true },
    "idle-left": { "frames": [8, 9, 10, 11], "fps": 8, "loop": true },
    "idle-right": { "frames": [12, 13, 14, 15], "fps": 8, "loop": true }
  }
}
```

Use animation names `idle`, `blink`, `walk`, `run`, `basic`, `skill0` through `skill3`, `dash`, `jump`, `land`, `hurt`, `defeat`, `victory`, `wave`, followed by `-up`, `-down`, `-left`, `-right`. Four directional idle definitions are required. Missing optional states use that direction's idle without crashing. Import full state sets to replace all procedural poses.

Metadata restricts frame rates to 1-60 FPS and validates paths, animation keys, frame types, sheet dimensions, and named frame references. The loader checks actual texture/frame existence before registering Phaser animation keys. Sources are loaded once; repeated snapshots do not restart the current frame animation. Nonessential frame animation pauses under reduced motion. Gameplay is never attached to animation-completion callbacks.

Portrait/selection raster files become visible in the roster independently of the gameplay mode, so a layered game rig can retain its animation while using rendered selection art. Preserve transparent gutters, consistent feet/origin placement and canvas dimensions; the initial raster adapter uses a 92px display box with preserved aspect ratio and a bottom-biased origin. Per-pack pivot/size customization and event-synchronized frame notifies are future extensions. Elemental projectile/zone feedback continues through the common effect utilities. Optional artist sound/effect assets can be stored in the folder, but automatic custom sound/effect pack playback is not implemented.

## Portrait generation

The eight static portraits were generated using the built-in image tool, guided by the supplied showcase and the Voltkit style reference. Files are `apps/client/public/assets/fighters/{id}/portrait-showcase-v1.webp`. They retain alpha, use lossless WebP encoding, and are loaded lazily in selection. The exact prompt set and tool provenance are in [portrait-generation.md](portrait-generation.md). Native generated PNGs remain in the Codex generated-images directory. No portrait was stretched or bounced to impersonate a combat animation.

## Artwork still required

For production soft-3D quality, supply a consistent render/illustration pack per fighter: four-direction silhouettes and anatomy; idle/blink/expression frames; walk/run cycles; attack anticipation/strike/recovery; four skill sequences; dash; takeoff/airborne/landing; recoil/collapse; victory/wave. Include portraits, selection poses, tightly packed atlas PNG+JSON, licensing/source information and aligned pivots.

The rendered selection portraits and the hand-authored articulated gameplay vectors are separate asset tiers. Static AI-generated portraits are not used as fake combat animation. The vector gradients and articulated parts are an integrated first pass; consistent directional frames matching the showcase remain an artwork requirement. AI-generated static selection portraits were created with the built-in image tool from the showcase reference. No 3D models, skeletons, consistent pre-rendered animation frame sets or studio-quality magic texture atlases were generated. No connected tool can guarantee consistent multi-frame 3D creatures from a single reference here.

## Future fighters

1. Add a canonical ID and centralized `Character`/ability definitions; keep IDs globally unique.
2. Update ID validation/migration and tests. Add any genuinely new mechanic to the server simulation and verify counterplay there.
3. Add a vector design/palette or supply a validated asset folder/manifest. Extend the explicit ability icons and elemental effects when needed.
4. Test all states/directions in the lab, then authoritative practice, PvP, reconnect and actual mobile devices.
5. Build/typecheck/test and verify PWA precache. Shared static fighter assets are cacheable; auth/API/session state is not cached.

## Run and validation

```
npm install
npm run dev
npm run typecheck
npm test
npm run build
node scripts/verify-pwa.mjs
```

The dev lab is `/animation-preview.html`; mobile previews are `/touch-preview.html` and `/mobile-layout-preview.html`. Supabase is required for authenticated matches, using the existing account setup documentation. Regular players can practice; admin management remains restricted. Desktop remains WASD, LMB basic, 1/2/3 skills, R ultimate, RMB dash and Space jump.

Automated checks cover all eight definitions, forty ability IDs, the original numerical mappings, legacy IDs, schema/import metadata, unique art/directions, selection/filtering, new server statuses/counterplay, thirty-two icons, state priorities/deduplication, practice, damage, reconnect and database authorization. Browser checks exercise original fighter renders, selection/filtering, directions/states, reduced motion and import smoke fixtures for all three raster modes. The temporary import fixtures are removed before delivery.

Not manually verified: authenticated two-human/two-device visual PvP, physical Android/iPhone rendering and touch latency, current install/update flows on real mobile browsers, and competitive balance. Automated sockets verify multiplayer simulation, but do not replace those manual visual/device checks.

## Voltkit presentation pilot (October 12)
Voltkit now uses portrait-showcase-v1.webp in both selection and gameplay. PortraitFighterVisual supplies breathing, travel cadence, dash lean/trails, cast anticipation and electrical cues, hit reactions, landing compression and victory motion. Existing controller priorities, event deduplication, authoritative movement/jump and reduced-motion preferences are preserved. Other fighters retain their vector rigs.

This is an interim single-image presentation rig. It does not provide articulated limbs, blinking, real 3D, or directional turnaround art. The source image stays in its authored three-quarter view; no mirroring is used. Frames/sheet/atlas packs automatically replace this fallback when authored artwork arrives. Validate final size and readability on real mobile devices and in a two-player match before expanding to the remaining roster.
