# Fighter animation system

The existing cute SVG portraits remain in `apps/client/src/fighter-art.ts` for the roster. Combat now uses real layered animation, with independently transformed arms, legs, torso, head, eyes and character features. This is an initial procedural rig, not a frame-by-frame sprite-sheet production.

## Files and architecture

- `apps/client/src/animation/assets.ts`: preserves/extracts original facial/features art; authors separate limb/torso, profile/back and rearward-tail drawings. Generates 12 cropped layers in four directions per fighter once during scene preload. No whole-character mirroring.
- `apps/client/src/animation/controller.ts`: Phaser-independent state machine, priority interruption, event deduplication, stable locomotion clock, defeat/respawn and round reset.
- `apps/client/src/animation/rig.ts`: Phaser container, individual limb poses, 35 ms rotation blending, natural blinking, feature movement, one reusable graphics object per fighter for accents/trails. Textures are reused; there are no per-frame textures or animation tweens.
- `apps/client/src/main.ts`: rigs keyed by player ID (including separate clone IDs); velocity/aim presentation, cast events, authoritative health reactions, jumping, victory and hydration/reset/cleanup. Also applies R ultimate/right-click dash and signed-in solo practice.
- `packages/shared/src/index.ts` and `apps/server/src/simulation.ts`: optional `abilityId` on existing cast events identifies basic/skill activation, including unlimited-cooldown practice. No extra animation packets or combat timing changes.
- `apps/client/animation-preview.html`: development-only lab. Excluded from production and PWA precache.
- `apps/server/src/server.ts`: authenticated, unsuspended players can create/resume/configure private solo practice. Admin REST management remains restricted.
- Tests cover FSM timing/priority, deduplication, respawn, emote interruption, every cast identifier, practice permissions/resume, and production preview exclusion. README/account setup/control preview updated.

## Implemented states

All four support idle/breathing, randomized blink every 3-7 seconds, walk/run with alternating feet and arm swings, basic anticipation/strike/recovery, four skill gestures, directional dash/trails, airborne tucked legs, landing compression, hurt recoil, fainting, victory and wave. Locomotion, dash and jump follow current movement state; casts follow server authorization, never delay attacks or modify movement/collision/damage.

| Fighter   | Personality and skills                                                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pikachu   | Ear twitch, tail sway, energetic steps, lightning arm strike, orb gathering, downward Static Field gesture, raised Thunderstorm pose; happy jump/arms and sparks.                                                     |
| Charizard | Slower wing movement, independently flickering tail flame, heavier arm swings; fire-breath head motion, Fire Spin wing gesture, rushing body lean, expanded Inferno pose; triumphant wings and flame-colored accents. |
| Greninja  | Low torso/legs, flowing scarf, agile steps; shuriken throw, Shadow Step knee lift, Water Clone guard, rapid Shuriken Barrage alternating arms; quick spin and ninja landing stance.                                   |
| Lucario   | Calm guard, balanced arms, jab/kick accents; sphere gathering, Bone Rush combination, defensive Counter Stance, Mega Aura Blast gathering during authoritative charge/release; martial flourish then calm stance.     |

Animations use explicit front/back/profile heads. Four-direction fidelity is still stylized: limbs and wings are shared across directions. There are no hand-painted directional attack frames. The wave is available in the component/lab; no new online emote control or packet was added.

## Synchronization and mobile

Each player owns an independent controller, even when both choose the same fighter. Existing event IDs prevent repeated cast restarts; reconnect hydration skips historic casts and resets presentation. Health changes trigger hurt; zero HP overrides poses; respawn clears defeat. Removed players/clones and changed characters destroy their old rigs.

Local movement uses existing prediction; remote positions use the existing interpolation buffer. Cast gestures use current aim; locomotion uses velocity facing. Changing animation never changes server action timing. Cast metadata is optional for compatibility: older events lacking it retain existing combat effects but cannot select the new skill gesture. Deploy client/server together for full casting presentation.

Reduced motion removes breathing/sway, step oscillation, celebrations and extra trails, while retaining meaningful combat poses. Phaser uses its existing background handling; the lab explicitly skips hidden-page updates. The fixed game render buffer and touch controls are preserved. Physical iPhone/Android frame-rate profiling is still needed.

## Run and evaluate

```
npm install
npm run dev
```

Open `http://localhost:5173/animation-preview.html`. Choose any fighter, facing, state and speed. Play/replay restarts a one-shot; the attack/hurt button checks interruption/recovery. Toggle Reduced motion to compare. No account is required in the dev lab. For actual solo combat, configure Supabase, sign in and choose Solo test mode.

Desktop controls: WASD movement, mouse aim, LMB basic, 1/2/3 skills, **R ultimate**, **RMB dash**, Space jump. Shift is not registered. Mobile Dash/Ultimate buttons are unchanged.

## Extend assets later

Add or replace layers in `assets.ts`, preserving pivots and `rigKey(character, facing, part)`. Add a Part/definition/content entry for a new feature; animate it in `rig.ts`. For higher fidelity, author separate front/back/profile legs, arms, wings and expressions, or ship a packed directional texture atlas with anticipation/strike/recovery frames. Preserve the controller and map its states to atlas animation keys, using server events only as visual triggers. Do not attach gameplay damage/cooldown callbacks to animation completion.

Needed for a polished sprite production: unique directional limb silhouettes, wing joints, facial expression frames, authored takeoff/fall/landing poses and complete directional strike sequences. The current real layered movement is functional and visibly improved; it does not replace that artwork.

## Validation

`npm run typecheck`, `npm run build`, `npm test`, and `node scripts/verify-pwa.mjs` are the checks. Browser checks cover the dev lab's fighter selection, directions, states, transitions and reduced motion, with no rendering errors. Automated multiplayer tests exercise authoritative combat and reconnection; account tests verify ordinary practice access and retained admin restrictions.

Authenticated two-device visual combat, real handset performance, and physical mouse/keyboard actions in an authenticated match were not manually exercised in this environment. Those remain manual verification tasks.
