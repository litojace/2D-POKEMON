/**
 * The battle kit: what only a battle draws with (skill effects, bosses and
 * their arenas, fighter rigs, the raid HUD). It loads with Phaser, in its
 * own file (phaser-runtime.ts `kit`), not with the game's first screen:
 * the menus need none of it, and it was two fifths of the startup script.
 *
 * main.ts reaches these as `kit.<name>`. A battle module that main.ts (or a
 * menu) imports directly goes back into the startup script with everything
 * it imports: add its exports here instead
 * (tests/unit/startup-bundle.test.ts, scripts/verify-pwa.mjs).
 */
export { battleCurves } from "./battle-curves";
export { generateGraphicsTexture } from "./graphics-bake";
export { queueBossSpellArt } from "./boss-spell-flipbook";
export { queueBossArt, retainBossArt } from "./boss-painted-rig";
export { addBattleText } from "./battle-text";
export { watchRendererLifecycle } from "./renderer-lifecycle";
export { clearWithCameraBackdrop } from "./camera-clear";
export { drawArcade } from "./arcade-art";
export { renderRaidUI, renderRaidWatchHud, drawRaidArena } from "./raid-ui";
export {
  queueFighterAssets,
  createFighterVisual,
  fighterTextureKeys,
} from "./animation/pipeline";
export { loadRigTextures } from "./animation/rig-textures";
export {
  bossLookOf,
  prewarmBossAtlas,
  syncBossPrepaint,
} from "./boss-vector-prewarm";
export { rigArtHealth } from "./rig-health";
export { prewarmRaidArena } from "./raid-arena-prewarm";
export { PillarRig, prewarmPillars } from "./raid-grumble-pillars-rig";
export { IMPACT_RADIUS } from "./raid-grumble-pillars";
export { prewarmTerrace } from "./raid-emberwing-terrace-rig";
export { setRaidMapLow } from "./raid-map-atlas";
export { prewarmLagoon } from "./raid-tidewyrm-art";
export { noteCloudDeckEvent, prewarmCloudDeck } from "./raid-somnara-art";
export { isMirrorTurnImpact } from "./raid-prismatail-atrium";
export { paintArenaFloor, scaledPainter } from "./arena-floor";
export {
  drawChannel,
  drawProjectile,
  drawWindup,
  drawZone,
  playBeam,
  playCast,
  playHit,
  playImpact,
  playRewindDive,
} from "./skill-effects";
export { installGraphicsRenderer } from "./graphics-render";
export { drawLeafStorm, plateFx } from "./skill-fx-nature";
export { drawSiphon } from "./skill-fx-water";
export { drawLiveWire } from "./skill-fx-electric";
export { drawPreview, previewShape } from "./skill-preview";
export { prepareSurfaceTextures, surfaceBurst } from "./court-surface-fx";
export { fxFor } from "./fx-engine";
export {
  SpireCourtRig,
  hasSpireSummitArena,
  isSpireFloorId,
  isSpireSummitFloorId,
  nextSpireCourtView,
  paintSpireFloorId,
  prewarmSpireCourt,
  spireCourtView,
  spireFloorId,
  spireSummitArt,
  spireSummitFloorId,
  spireSummitFloorOf,
} from "./spire-court-rig";
export { spireFloorTint } from "./spire-court-art";
export {
  isIllustratedRaidFloor,
  paintIllustratedRaidFloor,
} from "./raid-arena-art";
export { RAID_WORLDS, WORLD, WORLD_DENSITY, paintRaidWorld } from "./world-art";
export {
  courtBlockFrame,
  courtBlocks,
  isCourt,
  paintCourtBlock,
  paintCourtFloor,
  paintCourtStands,
  paintCourtApron,
  COURT_APRON,
  SHIFTING_BLOCK,
  STANDS,
} from "./arena-courts";
