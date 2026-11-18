import {
  autoChoosesLow,
  autoLowWhy,
  graphicsSetting,
  lowGraphics,
  setGraphicsSetting,
  type GraphicsSetting,
} from "./graphics-quality";
import { softwareRendering } from "./gpu-check";
import { raidCameraView } from "./raid-camera";
import { BattleQualityGovernor, resetBattleQuality } from "./battle-quality";
import { capGameFrames, screenHz, type FrameCap } from "./frame-cap";
/** The battle's frame cap: it also knows the screen's refresh (reports). */
let battleFrames: FrameCap | undefined;
import {
  BattlePerfMeter,
  BUILD,
  NetMeter,
  PERF_MIN_SECONDS,
  deviceKind,
  loadPhases,
  perfMode,
  setPerfMode,
} from "./battle-perf";
import { correctionCause } from "./networking/correction-cause";
import { PerfOverlay } from "./perf-overlay";
import { syncPerfHud } from "./perf-hud";
import { addCanvasTexture } from "./canvas-texture";
import { setHudText, setHudAttribute, setHudStyle } from "./hud-dom";
import { battleCurves } from "./battle-curves";
import { generateGraphicsTexture } from "./graphics-bake";
import { RoomInvites } from "./room-invites";
import { serverNow } from "./server-clock";
import { PvpSpectator } from "./pvp-spectator";
import {
  carryCurrent,
  newestStep,
  predictFighter,
  serverSteps,
} from "./predict-fighter";
import { startPingBadge } from "./ping-badge";
import { TargetLock, drawTargetReticle, type Targetable } from "./target-lock";
import {
  CastPredictor,
  canBasic,
  canCastSkill,
  canDash,
  type CastAction,
} from "./cast-prediction";
import { queueBossSpellArt } from "./boss-spell-flipbook";
import { queueBossArt, retainBossArt } from "./boss-painted-rig";
import { memoryConstrained, rendererDensity } from "./render-budget";
import { watchRendererLifecycle } from "./renderer-lifecycle";
import {
  groundHeight,
  WORLD_ART,
} from "../../../packages/shared/src/world-art";
import { fitDesktopBattleHud } from "./desktop-battle-layout";
import {
  homeShell,
  lastHomeFighter,
  onHomeFighterRemembered,
  rememberHomeFighter,
  startRoomSection,
  welcomeGate,
  type GateStatus,
} from "./home-screen";
import { setupHomeNavigation } from "./home-navigation";
import {
  openLobby,
  partyLobbyMode,
  type LobbyAction,
  type LobbyHandle,
  type LobbyMode,
} from "./lobby-screen";
// The Farm, the Bistro and the Plaza load when first wanted (hub-worlds.ts).
// Their styles stay in the main stylesheet, in the same place as before.
import type { FarmScreen, FarmScreenOptions } from "./farm/farm-screen";
import { forgetFarms, prefetchFarm } from "./farm/farm-cache";
import "./farm/farm.css";
import type { BistroFriend, BistroHandle } from "./bistro/bistro-scene";
import { clearKeptBistros } from "./bistro/bistro-kept";
import "./bistro/bistro.css";
import { worldLoader, type World } from "./hub-worlds";
import type {
  FarmActResult,
  FarmHere,
  FarmLikeResult,
  FarmTourEntry,
  FarmStall,
  FarmStallResult,
  FarmBalloon,
  FarmBalloonResult,
  FarmHelpList,
  FarmHelpResult,
  FarmGiftResult,
  FarmGiftsState,
  FarmFriend,
  FarmOrderResult,
  FarmState,
  FarmVisit,
  FarmVisitResult,
} from "../../../packages/shared/src/farm";
import {
  saveHubScene,
  savedHubScene,
  sceneAvailable,
  sceneSwitchMarkup,
  type HubScene,
} from "./hub-scene";
import { plazaOutfitKey } from "./plaza/plaza-outfit";
import {
  bossClears,
  pacificDate,
  raidPingLabel,
  isRaider,
} from "../../../packages/shared/src/raid";
import { resultXp } from "./adventure-ui";
import { arcadeWeek, ARCADE_EVENTS } from "../../../packages/shared/src/arcade";
import { drawArcade } from "./arcade-art";
import { stormTarget } from "./storm-twins-controls";
import { raidTargets } from "./raid-targets";
import { prismatailAim } from "./prismatail-controls";
import { dreamRuneKey } from "./somnara-controls";
import { battleMusic } from "./battle-music";
import { setDialogContent } from "./dialog";
import { updateMenuShell } from "./menu-shell";
import { parse, patch } from "./ui/patch";
import {
  roomKicker,
  roomSeatsMarkup,
  roomWatchMarkup,
  type RoomData,
  type RoomMode as RoomKind,
} from "./screens/room-view";
import "./screens/room.css";
import { renderRaidUI, drawRaidArena, raidLookList } from "./raid-ui";
import { illustratedHelp } from "./illustrated-help";
import { buttonIcon, iconLabel, menuIcon } from "./menu-icons";
import type { RaidBossId, RaidSlot } from "../../../packages/shared/src/raid";
import type { RaidTab } from "./screens/raid-hall-view";
import type { SpireTab } from "./screens/spire-view";
import { LobbySelection } from "./lobby-selection";
import { setupBattleDock } from "./battle-dock";
import {
  queueFighterAssets,
  createFighterVisual,
  fighterTextureKeys,
  type FighterVisual,
} from "./animation/pipeline";
import { rigAssets, skinSuffix } from "./animation/assets";
import { loadRigTextures } from "./animation/rig-textures";
import {
  bossLookOf,
  prewarmBossAtlas,
  syncBossPrepaint,
} from "./boss-vector-prewarm";
import {
  addPrepaintedLayers,
  holdFighterPrepaint,
  syncFighterPrepaint,
} from "./fighter-prepaint";
import { prewarmRaidArena } from "./raid-arena-prewarm";
import { PillarRig, prewarmPillars } from "./raid-grumble-pillars-rig";
import { IMPACT_RADIUS } from "./raid-grumble-pillars";
import { prewarmTerrace } from "./raid-emberwing-terrace-rig";
import { setRaidMapLow } from "./raid-map-atlas";
import { prewarmLagoon } from "./raid-tidewyrm-art";
import { noteCloudDeckEvent, prewarmCloudDeck } from "./raid-somnara-art";
import { isMirrorTurnImpact } from "./raid-prismatail-atrium";
import { FighterLoading, neededFighters } from "./animation/fighter-loading";
import {
  setOverlayMarkup,
  LIVE_SECONDS,
  LIVE_COUNTDOWN,
  fillLiveSeconds,
  fillLiveCountdown,
} from "./overlay";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
import { fighterSkillColor, wornArt } from "./skins/skin-art";
import { drawCollectionAura } from "./skins/collection-fx";
import { battleAuraScale } from "./shop-preview-layout";
import { colourPreview } from "./colour-preview";
import { stadiumCrowd } from "./stadium";
import { paintArenaFloor, scaledPainter } from "./arena-floor";
import {
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
import { setupPWA } from "./pwa";
import { PRIVACY_URL, isNativeApp, setupNativeShell } from "./native";
import { appIconCardHTML, bindAppIconCard } from "./app-icon-setting";
import { abilityIcon } from "./ability-icons";
import { TouchControls } from "./touch-controls";
import type Phaser from "phaser";
import { loadPhaser, phaser, whenPhaser } from "./phaser-runtime";
import { installGraphicsRenderer } from "./graphics-render";
import { io } from "socket.io-client";
import {
  CHARACTERS,
  OBSTACLES,
  RING,
  ringRadius,
  CROWN,
  TEAMUP,
  giftFrom,
  RUSH,
  rushGoals,
  EX,
  MUTATORS,
  MUTATOR_IDS,
  MUTATOR_RULES,
  roundsNeeded,
  type MutatorId,
  RULES,
  STATUS_RULES,
  ULT_SLOT,
  ARENAS,
  COMBOS,
  DEBUFFS,
  hazardIn,
  obstaclesAt,
  shiftingRisesIn,
  shiftingUp,
  currentObstacles,
  useObstacles,
  useSpeedScale,
  type ArenaId,
  RITE_BY_ID,
  RITE_RULES,
  kitOf,
  skillReady,
  normalize,
  unpackSnapshot,
  MetaCache,
  type SnapshotMeta,
  type WireSnapshot,
  type Ability,
  type AbilityKind,
  type CharacterId,
  type Fighter,
  type Input,
  type Reply,
  type Snapshot,
  type Zone,
  maxHealth,
  basicInterval,
  MOSS,
  PLATES,
  platesOf,
} from "../../../packages/shared/src/index";
import { AudioManager } from "./audio";
import { bounceFx, plateFx } from "./skill-fx-nature";
import { drawSiphon } from "./skill-fx-water";
import { InterpolationBuffer } from "./networking/interpolation";
import {
  LocalTimeline,
  ShotTimeline,
  leadProjectile,
} from "./networking/timeline-lead";
import { AccountUI } from "./accounts";
import { framedAvatar } from "./portraits";
import { waitForServer, onServerStartupRetry } from "./server-connection";
import "./ui/tokens.css";
import "./style.css";
import "./ui/components.css";
import "./battle-dock.css";
import "./cosmetic-review.css";
import "./collection-frames.css";
import "./journey-frames.css";
import "./boss-frames.css";
import "./signature-frames.css";
import "./mobile-panels.css";
import "./match-badge.css";
import {
  FollowCamera,
  screenToWorld,
  outsideView,
  type CameraView,
} from "./follow-camera";
import { updateNameplate, updateNameplateHealth } from "./player-nameplate";
import { fighterPack } from "./animation/pack-config";
import { fullscreenLandscape } from "./orientation";
import { wireRotateGate } from "./rotate-gate";
import { watchRotation } from "./orientation-settle";
import { watchNotchInsets } from "./notch-insets";
import { watchScrollRows } from "./ui/scroll-rows";
import { watchScreenPin } from "./screen-pin";
import { watchCosmeticPreviews } from "./cosmetic-fx-preview";
import { openHubPanelNow } from "./ui/hub-panel";
import { createGuide } from "./getting-started-screen";
import { createCoach } from "./battle-coach";
import { playerLevel } from "../../../packages/shared/src/journey";
import { openRoster, type RosterScreen } from "./screens/roster";
import { showRewardReveal, takeNewRewards } from "./reward-reveal";
import {
  SKILL_ACTIONS,
  SkillCaster,
  actionFor,
  actionLabel,
  assistAim,
  bindingsKey,
  controlPrefs,
  movementLabel,
  onControlPrefs,
  skillLabels,
  type Action,
} from "./controls";
import { PAD_LABELS, firstPad, readPad, type PadAction } from "./gamepad";
import { drawPreview, previewShape } from "./skill-preview";
import { controlsCapturing, showControlsScreen } from "./controls-screen";
import { watchBattleZoom } from "./zoom-guard";
import { guardTouchHold } from "./touch-hold";
import { KO_FEEL, hitFeel, hitStrength, rumble } from "./game-feel";
import { captureInvite, clearInvite, pendingInvite } from "./invite";
import {
  captureFarmInvite,
  clearFarmInvite,
  farmInviteUrl,
  pendingFarmInvite,
} from "./farm/farm-invite";
import { lockScrollWhileOpen, setScrollLock } from "./scroll-lock";
import { watchMenuMotion } from "./menu-motion";
import {
  MASTERY_TIERS,
  masteryTier,
  progressSchema,
  RANKS,
} from "../../../packages/shared/src/accounts";
import {
  recapMarkup,
  recordsMarkup,
  standingsMarkup,
  type RecordState,
} from "./match-recap";
import {
  matchReportReplySchema,
  partyRoomSchema,
  partyStateSchema,
  inviteDeclinedSchema,
  partyKickedSchema,
  type PartyState,
} from "../../../packages/shared/src/accounts";
import {
  masteryMatches,
  setMastery,
  setWornLook,
  setWornSkins,
} from "./fighter-selection";
import { shareResult } from "./share-card";
import type { PlazaScreen } from "./plaza/plaza-screen";
import "./plaza/plaza.css";
import type { PlazaProgress } from "../../../packages/shared/src/plaza";
import { CHAMPION_SKIN_BY_ID } from "../../../packages/shared/src/shop";
import { prepareSurfaceTextures, surfaceBurst } from "./court-surface-fx";
import { fxFor } from "./fx-engine";
import {
  ECHO_SKILL_COLOR,
  spireEchoTint,
  drawEliteCrown,
  echoShown,
} from "./spire-art";
import {
  SPIRE_PARTY,
  SPIRE_ZONES,
  spireZoneStart,
} from "../../../packages/shared/src/spire";
import { spireCourtWalls } from "../../../packages/shared/src/spire-court";
import {
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
  type SpireCourtView,
} from "./spire-court-rig";
import { spireFloorTint } from "./spire-court-art";
import { loadSpireSeen, spireLobbyCard } from "./spire-nudge";
import { isRaidFloor, paintRaidFloor } from "./raid-floors";
import {
  isIllustratedRaidFloor,
  loadRaidArenaArt,
  type IllustratedRaidFloor,
  paintIllustratedRaidFloor,
  prefetchRaidArena,
} from "./raid-arena-art";
import type { LayerAt } from "./raid-layers";
import {
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
  type CourtId,
} from "./arena-courts";
import { RITE_EFFECTS, riteEffect, riteIcon } from "./rite-icons";
import { ConnectionWatch, dropMessage } from "./connection-loss";
import { watchSceneSwitch } from "./scene-switch-place";
import { mountChat, type ChatFriend, type ChatPlace } from "./chat/chat-ui";
import { pushState, turnPushOff, turnPushOn } from "./chat/push-setup";
import { mountBattleChat } from "./chat/battle-chat";
import {
  CHAT_MODES,
  quickKind,
  quickText,
  type ChatMode,
  type ChatLine,
  type ChatQuick,
} from "../../../packages/shared/src/chat";
import { PLAZA_EMOTES } from "../../../packages/shared/src/plaza";
import "./chat/chat.css";
// Last: the hub's aero glass overrides the panels' own fills.
import "./ui/aero.css";
import "./ui/light-effects.css";
import { syncUiEffects } from "./ui/ui-effects";
import "./ui/phone-fit.css";
const audio = new AudioManager();
audio.start();
const allAbilities = new Map(
  Object.values(CHARACTERS)
    .flatMap((c) => [c.basic, ...c.skills])
    .map((a) => [a.id, a]),
);
/** The fighter colour that owns each move, for element-tinted hit sparks. */
const abilityColor = new Map(
  Object.values(CHARACTERS).flatMap((c) =>
    [c.basic, ...c.skills].map((a) => [a.id, c.color] as const),
  ),
);
const remoteFrames = new InterpolationBuffer();
/** How far ahead of the last snapshot your fighter is drawn (timeline-lead.ts). */
const timeline = new LocalTimeline();
const shotTimeline = new ShotTimeline();
/**
 * Where your own fighter was drawn over the last second or so, to tell
 * whether a hit on you landed where you saw yourself (battle-perf hitsFar).
 */
const drawnSelf: { t: number; x: number; y: number }[] = [];
/**
 * A hit on you: the server hit you at (event.x, event.y) at about the last
 * snapshot's time, which your screen showed a lead ago. How far from there
 * were you drawn then?
 */
function measureHitGap(event: { x: number; y: number }) {
  const now = performance.now(),
    back = now - timeline.lead(now) * 1000;
  let best: (typeof drawnSelf)[number] | undefined;
  for (const d of drawnSelf)
    if (!best || Math.abs(d.t - back) < Math.abs(best.t - back)) best = d;
  if (best && Math.abs(best.t - back) < 100)
    netMeter.hitGap(Math.hypot(best.x - event.x, best.y - event.y));
}
/** Script errors during the match, for its battle-perf report. */
let matchErrors = 0;
addEventListener("error", () => matchErrors++);
addEventListener("unhandledrejection", () => matchErrors++);
/** The lead over a match, for its battle-perf report. */
const leadSeen = { sum: 0, frames: 0 };
/** The last round trip the ping badge measured (ms), for battle-perf. */
let lastPing: number | undefined;
/** Static Glide in progress, per fighter: when it started (server time). */
const gliding = new Map<string, { until: number; start: number }>();
/** Curled-up balls: how far each has spun (it rolls as far as it travels). */
const ballSpins = new Map<string, { spin: number; at: number }>();
function ballSpin(id: string, speed: number, heading: number) {
  const now = performance.now(),
    last = ballSpins.get(id);
  const dt = last ? Math.min(0.1, (now - last.at) / 1000) : 0;
  // A ball about 30 px across turns once per ~95 px rolled.
  const spin = (last?.spin ?? 0) + (speed * dt) / 15;
  ballSpins.set(id, { spin, at: now });
  return { spin, heading };
}
/** Adapts optional battle decoration to the device (Settings → Graphics). */
const battleQuality = new BattleQualityGovernor();
let battleStill: boolean | undefined;
/** The canvas density the battle quality allowed last frame. */
let battleDensity: number | undefined;
/** How smoothly this match runs on this device (battle-perf.ts). */
const battlePerf = new BattlePerfMeter();
/**
 * Moves whose cast effect plays on your press (predicted): it depends only on
 * where you stand and face. The rest wait for the server (see
 * ArenaScene.predictCastEffect).
 */
const PREDICTED_CAST_KINDS = new Set<AbilityKind>([
  "projectile",
  "barrage",
  "melee",
  "cone",
  "clone",
  "counter",
  "barrier",
  "buff",
  "rest",
]);
/** The network side of the same match: round trips, snapshot gaps, corrections. */
const netMeter = new NetMeter();
/** `?perf=1`: the read-out over the battle, and its numbers for tests. */
/** Fighters' names and equipped looks, sent apart from combat snapshots. */
const snapshotMeta = new MetaCache();
let snapshotMetaAsked = "";
/** A snapshot named an appearance revision we never received: ask once. */
function recoverSnapshotMeta(code: string, rev: number) {
  const key = `${code}:${rev}`;
  if (snapshotMetaAsked === key || !connected) return;
  snapshotMetaAsked = key;
  socket
    .timeout(4000)
    .emit(
      "snapshot-meta",
      {},
      (
        error: Error | null,
        reply: Reply & { code?: string; meta?: SnapshotMeta },
      ) => {
        if (!error && reply?.ok && reply.code && reply.meta)
          snapshotMeta.apply(reply.code, reply.meta);
        // Let a later snapshot ask again if this one failed.
        if (error || !reply?.ok) snapshotMetaAsked = "";
      },
    );
}
const lobbySelection = new LobbySelection();
const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
  auth: { accessToken: null },
});
let accountsUI: AccountUI;
/** The server's key for notifications (null: it sends none). */
let pushKey: string | null = null;
/** A friend to open from a tapped notification (sw.ts), once signed in. */
let friendToOpen: { id: string; name: string } | null = (() => {
  const q = new URLSearchParams(location.search);
  const id = q.get("friend");
  if (!id) return null;
  q.delete("friend");
  const name = q.get("name") ?? "";
  q.delete("name");
  const rest = q.toString();
  history.replaceState(
    history.state,
    "",
    location.pathname + (rest ? `?${rest}` : "") + location.hash,
  );
  return { id, name };
})();
navigator.serviceWorker?.addEventListener("message", (event) => {
  const friend =
    (event.data as { type?: string; friend?: unknown } | null)?.type ===
    "open-friend"
      ? (event.data.friend as { id?: unknown; name?: unknown })
      : null;
  if (typeof friend?.id !== "string") return;
  friendToOpen = { id: friend.id, name: String(friend.name ?? "") };
  syncHub();
});
const chat = mountChat({
  send: (channel, body, to) =>
    request("chat-send", { channel, ...body, ...(to ? { to } : {}) }),
  history: async (channel, to) => {
    const reply = (await request("chat-history", {
      channel,
      ...(to ? { to } : {}),
    })) as { lines?: ChatLine[] };
    return Array.isArray(reply.lines) ? reply.lines : [];
  },
  friends: async () => {
    const reply = (await request("chat-friends", {}, true)) as {
      ok: boolean;
      friends?: ChatFriend[];
    };
    return reply.ok && Array.isArray(reply.friends) ? reply.friends : null;
  },
  read: (to) => {
    if (socket.connected) socket.emit("chat-read", { to });
  },
  // Notifications of friends' messages on this device (push-setup.ts). The
  // server's key is fetched when the gear opens, so turning them on asks the
  // browser straight from the tap.
  push: {
    state: async () => {
      const reply = (await request("push-config", {}, true)) as {
        ok: boolean;
        key?: string | null;
      };
      pushKey = reply.ok && typeof reply.key === "string" ? reply.key : null;
      return pushKey ? pushState() : "server-off";
    },
    toggle: (on) =>
      on
        ? pushKey
          ? turnPushOn(pushKey, (event, data) => request(event, data, true))
          : Promise.resolve({
              ok: false,
              error: "Notifications aren't available right now.",
            })
        : turnPushOff((event, data) => request(event, data, true)),
  },
  me: () =>
    accountsUI?.account
      ? { id: accountsUI.account.id, guest: !!accountsUI.account.guest }
      : null,
  block: async (accountId, name) => {
    try {
      const done = await accountsUI.block(accountId, name);
      if (done) toast(`${name} is blocked.`);
      return done;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't block them.");
      return false;
    }
  },
  report: (channel, id, to) =>
    request("chat-report", { channel, id, ...(to ? { to } : {}) }),
  // The chat's gear: on, quick chat only, off (kept on this device).
  setMode: (mode) => {
    try {
      localStorage.setItem(CHAT_MODE_KEY, mode);
    } catch {
      /* No storage: for this visit. */
    }
    void request("chat-mode", { mode });
    chat.setMode(mode);
    syncHub();
  },
});
/** The chat setting: free, quick chat only, or off (kept on this device). */
const CHAT_MODE_KEY = "ea-chat-mode";
function chatMode(): ChatMode {
  try {
    const saved = localStorage.getItem(CHAT_MODE_KEY) as ChatMode | null;
    return saved && CHAT_MODES.includes(saved) ? saved : "free";
  } catch {
    return "free";
  }
}
chat.setMode(chatMode());
/** The server learns the setting on every connection. */
socket.on("connect", () => {
  const mode = chatMode();
  if (mode !== "free") socket.emit("chat-mode", { mode }, () => {});
});
/** Quick chat in a battle (chat/battle-chat.ts). */
const battleChat = mountBattleChat({
  send: (quick) => request("chat-send", { channel: "room", quick }),
  ping: (kind) => void request("raid-ping", { kind }),
  pingLabel: (kind) => raidPingLabel(kind, state?.raid?.boss ?? "grumblecrag"),
});
let authConnectionAttempt = 0;
const connectionWatch = new ConnectionWatch();
document.addEventListener("visibilitychange", () =>
  connectionWatch.visibility(),
);
window.addEventListener("offline", () => connectionWatch.network());
window.addEventListener("online", () => connectionWatch.network());
// Keep a displaced tab paused across reloads. Only an explicit button press
// may reclaim the game; token refresh/focus must not kick the other device.
let replacedAccount = sessionStorage.getItem("arena-session-replaced");
let gameInstance: Phaser.Game | undefined;
let battleResizeObserver: ResizeObserver | undefined;
let raidCameraHudBottom = 0;
let state: Snapshot | undefined,
  myId = "",
  selected: CharacterId = lastHomeFighter(),
  seq = 0,
  local: Fighter | undefined,
  pending: Input[] = [],
  scene: ArenaScene | undefined;
/** Your late inputs the server will fold into one tick (Fighter.owed). */
let owedSteps = 0;
let raidRoomReturn:
  | { code: string; boss: RaidBossId; tab: RaidTab; spire?: SpireTab }
  | undefined;
let accountShown = "";
/** Last known "ultimate ready" state, for the ready sound. */
let ultWasReady = false;
/** EX skills: armed until this time (ms), 0 when not armed. */
let exArmedUntil = 0;
/** An invite is waiting for sign-in: say so once. */
let inviteHinted = true;
/** Render key for menu, lobby and battle state changes. */
let screen = "",
  eventId = 0,
  settingsOpen = false,
  menuOpen = false,
  connected = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
document.querySelector("#app")!.innerHTML =
  `<header class="topbar"><nav class="hub-scenes" id="hub-scenes" role="group" aria-label="Scene" hidden></nav><a class="brand" href="#"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="element-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#element-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span> ELEMENT<span>ARENA</span></a><div class="top-links"><div id="account-nav" class="account-nav"></div><button type="button" class="quiet home-settings" id="home-settings" aria-label="Settings" title="Settings">${menuIcon("settings")}</button><details class="header-menu" id="header-menu"><summary><i class="menu-burger" aria-hidden="true">☰</i><i class="menu-gear" aria-hidden="true">${menuIcon("settings")}</i> <span>Menu</span></summary><div class="header-menu-panel"><button class="quiet" id="help">${menuIcon("help")}<span>How to play</span></button><button class="quiet" id="guide-open">${menuIcon("sparkle")}<span>Getting started</span></button><button class="quiet" id="settings">${menuIcon("settings")}<span>Settings</span></button><button class="quiet" id="leaderboard">${menuIcon("leaderboard")}<span>Leaderboard</span></button><button class="quiet" id="install-app">${menuIcon("fullscreen")}<span>Want fullscreen?</span></button><button class="quiet" id="report-problem">${menuIcon("report")}<span>Report a problem</span></button><button class="quiet" id="privacy-policy">${menuIcon("help")}<span>Privacy policy</span></button><button class="quiet" id="menu-logout">${menuIcon("leave")}<span>Log out</span></button><span class="connection" id="connection">Connecting</span></div></details></div></header><main><section id="menu"></section><section id="battle" hidden>${stadiumCrowd()}<div id="practice-controls" class="practice-controls" hidden></div><div id="hud" class="hud"></div><div class="arena-stage"><div class="arena-frame"><div id="game"></div><div id="arena-overlay"></div><div id="spectate" class="spectate-banner" role="status" hidden></div><span class="map-label">ELEMENTAL COLISEUM <span>01 / CHAMPIONS COURT</span></span></div></div><div id="mobile-controls"></div><div id="abilities" class="ability-bar"></div><div class="battle-footer"><span id="control-hints"></span><span id="network">AUTHORITATIVE ONLINE MATCH</span><button class="quiet" id="battle-menu" aria-label="Battle settings" title="Battle settings (Esc / controller Menu)">${menuIcon("settings")}</button></div></section></main><div id="toast" role="status"></div><dialog id="dialog"></dialog>`;
// Measure wrapped HUDs for phone spacing and desktop boss-specific controls.
let measuredRaidHud: HTMLElement | null = null;
let battleLayoutFrame = 0;
/** Layout writes from a resize callback must wait until the next frame (Safari). */
function scheduleBattleLayout() {
  if (battleLayoutFrame) return;
  battleLayoutFrame = requestAnimationFrame(() => {
    battleLayoutFrame = 0;
    if ($("battle").hidden) return;
    const raidHud = document.getElementById("raid-hud");
    if (raidHud)
      $("battle").style.setProperty(
        "--desktop-raid-hud-height",
        `${Math.ceil(raidHud.getBoundingClientRect().height)}px`,
      );
    const panel = $("hud").getBoundingClientRect();
    const callout = document
      .getElementById("phase-label")
      ?.getBoundingClientRect();
    const height = Math.ceil(
      Math.max(panel.bottom, callout?.bottom ?? panel.bottom) - panel.top,
    );
    $("battle").style.setProperty("--match-hud-height", `${height + 8}px`);
    // Where the PvP badge (and its note) covers the arena, in the arena's
    // own pixels: nameplates stay below it.
    const frame = $("game").parentElement?.getBoundingClientRect();
    if ($("hud").classList.contains("hud-badge") && frame && panel.width) {
      const note =
        callout && callout.height > 0 && !$("phase-label").hidden
          ? callout
          : panel;
      badgeClear = {
        left: Math.min(panel.left, note.left) - frame.left,
        right: Math.max(panel.right, note.right) - frame.left,
        bottom: Math.max(panel.bottom, note.bottom) - frame.top + 4,
      };
    } else badgeClear = null;
    fitRenderer();
  });
}
/** The arena area under the PvP badge (scheduleBattleLayout keeps it). */
let badgeClear: { left: number; right: number; bottom: number } | null = null;
/** A nameplate's size, measured again only when its title changes (the
 * labels move every frame by transform alone). A hidden plate is never
 * measured: it reads as 0, is not cached, and each read forces a layout. */
const nameplateSizes = new WeakMap<
  HTMLElement,
  { title: string; w: number; h: number }
>();
function nameplateSize(label: HTMLElement, title: string) {
  if (label.hidden) return { w: 0, h: 0 };
  let size = nameplateSizes.get(label);
  if (!size || size.title !== title) {
    const w = label.offsetWidth,
      h = label.offsetHeight;
    if (!w || !h) return { w: 0, h: 0 };
    size = { title, w, h };
    nameplateSizes.set(label, size);
  }
  return size;
}
/** A nameplate's box in the arena (x is its middle, placed by its bottom). */
interface PlateBox {
  x: number;
  bottom: number;
  w: number;
  h: number;
}
/** The off-screen arrow, BEARING_SIZE across and placed by its middle. */
const BEARING_SIZE = 24;
const overlapsPlate = (x: number, y: number, plate?: PlateBox) => {
  const half = BEARING_SIZE / 2;
  return (
    !!plate &&
    plate.w > 0 &&
    x + half > plate.x - plate.w / 2 &&
    x - half < plate.x + plate.w / 2 &&
    y + half > plate.bottom - plate.h &&
    y - half < plate.bottom
  );
};
const underBadge = (x: number, y: number) => {
  const half = BEARING_SIZE / 2;
  return (
    !!badgeClear &&
    x + half > badgeClear.left &&
    x - half < badgeClear.right &&
    y - half < badgeClear.bottom
  );
};
/** Where the arrow goes: its spot on the circle, kept out from under the
 * PvP badge (just below it) and off your own name (above the name, or
 * beside it when above would be under the badge). */
function bearingSpot(x: number, y: number, plate?: PlateBox) {
  const half = BEARING_SIZE / 2;
  if (underBadge(x, y)) y = badgeClear!.bottom + half;
  if (plate && overlapsPlate(x, y, plate)) {
    const above = plate.bottom - plate.h - half - 3;
    if (!underBadge(x, above)) y = above;
    else x = plate.x + (x >= plate.x ? 1 : -1) * (plate.w / 2 + half + 3);
  }
  if (underBadge(x, y)) y = badgeClear!.bottom + half;
  return { x, y };
}
/** How high a nameplate's bottom may go: 54 px, or below the badge for a
 * plate that would reach under it. */
function nameplateFloor(label: HTMLElement, title: string, x: number) {
  if (!badgeClear) return 54;
  const { w, h } = nameplateSize(label, title);
  return x + w / 2 > badgeClear.left && x - w / 2 < badgeClear.right
    ? Math.max(54, badgeClear.bottom + h)
    : 54;
}
const battleHudSize = new ResizeObserver(scheduleBattleLayout);

battleHudSize.observe($("hud"));
battleHudSize.observe($("abilities"));
// Touch battles lock zoom (pinch and double tap); menus keep it for accessibility.
watchBattleZoom();
guardTouchHold();
const homeNavigation = setupHomeNavigation($("menu"), () => showSettings());
$("home-settings").onclick = () => showSettings();
$("hub-scenes").onclick = (event) => {
  const button = (event.target as Element).closest<HTMLElement>(
    "[data-hub-scene]",
  );
  if (button) setHubScene(button.dataset.hubScene as HubScene);
};
const headerMenu = $("header-menu") as HTMLDetailsElement;
// A dropdown-to-dialog transition keeps the same page position throughout.
lockScrollWhileOpen($<HTMLDialogElement>("dialog"), headerMenu);
watchMenuMotion($("menu"), $<HTMLDialogElement>("dialog"), headerMenu);
headerMenu.addEventListener("click", (event) => {
  if ((event.target as Element).closest("button")) headerMenu.open = false;
});
// A swipe outside the menu must not unlock the page halfway through the gesture.
document.addEventListener("click", (event) => {
  if (!headerMenu.contains(event.target as Node)) headerMenu.open = false;
});
document.addEventListener(
  "keydown",
  (event) => {
    const practice = $("practice-settings") as HTMLDetailsElement | null;
    if (event.key === "Escape" && practice?.open) {
      practice.open = false;
      practice.querySelector("summary")!.focus();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key === "Escape" && headerMenu.open) {
      headerMenu.open = false;
      headerMenu.querySelector("summary")!.focus();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);

document.addEventListener("pointerdown", (event) => {
  if ((event.target as Element).closest("button")) {
    audio.unlock();
    audio.play("ui");
  }
});
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 4500);
}
/** Ask the server; `quiet`: a background read that never shows a toast. */
function request(
  event: string,
  data: unknown = {},
  quiet = false,
): Promise<Reply> {
  if (!socket.connected) return Promise.resolve({ ok: false });
  const connectionId = socket.id;
  return new Promise((resolve) =>
    socket
      .timeout(5000)
      .emit(event, data, (error: Error | null, reply: Reply) => {
        // Auth switches and genuine reconnects invalidate old requests. Do not
        // report their cancelled acknowledgements as a server failure.
        if (!socket.connected || socket.id !== connectionId)
          return resolve({ ok: false });
        if (error) {
          if (!quiet) toast("Server did not respond. Check your connection.");
          resolve({ ok: false });
        } else {
          if (!reply.ok && reply.error && !quiet) toast(reply.error);
          resolve(reply);
        }
      }),
  );
}
function identity(reply: Reply) {
  if (!reply.ok) return;
  lobbySelection.reset();
  myId = reply.id!;
  seq = 0;
  pending = [];
  owedSteps = 0;
  eventId = 0;
  scene?.hydrateNextSnapshot();
  local = undefined;
  remoteFrames.clear();
  timeline.clear();
  shotTimeline.clear();
  sessionStorage.setItem("arena-token", reply.token!);
}
const touch: TouchControls = new TouchControls(
  $("mobile-controls"),
  () => !!scene?.canControl(),
  (action) => {
    audio.unlock();
    if (scene) Object.assign(scene.actions, action);
  },
  toast,
  () => {
    if (scene)
      scene.actions = { skill: -1, dash: false, jump: false, basic: false };
  },
);
if (touch.available)
  setupBattleDock(
    $("battle"),
    $("mobile-controls"),
    $("battle-menu").parentElement!,
    $("practice-controls"),
  );
else $("battle").append($("battle-menu"));
// ---- Keyboard, mouse and controller (bindings live in controls.ts) ----
/** Physical keys and mouse buttons ("KeyQ", "Mouse0") currently held. */
const held = new Set<string>();
const caster = new SkillCaster();
const castPredictor = new CastPredictor();
/** The enemy a phone player locked on to (tap it on the court). */
const targetLock = new TargetLock();
// The frame-rate line along the top, when turned on (perf-hud.ts).
syncPerfHud();
// The ping badge by the battle gear; predicted casts wait about one round trip.
startPingBadge(
  socket,
  () =>
    !$("battle").hidden && myId && state && state.phase !== "lobby"
      ? $("battle-menu")
      : null,
  (ms) => {
    castPredictor.rtt = ms;
    if (state?.phase === "playing") netMeter.rtt(ms);
    lastPing = ms;
  },
);
/**
 * A skill you just cast (predicted) shows its cooldown before the server's
 * snapshot does; the server's value takes over as soon as it has one.
 */
const optimisticCooldowns = new Map<number, { until: number; at: number }>();
function cooldownLeft(me: Fighter, slot: number, time: number) {
  const server = Math.max(0, (me.cooldowns[slot] ?? 0) - time);
  if (server > 0) {
    optimisticCooldowns.delete(slot);
    return server;
  }
  const guess = optimisticCooldowns.get(slot);
  if (!guess) return 0;
  // The server refused or never answered: drop the guess.
  if (performance.now() - guess.at > Math.max(400, castPredictor.rtt + 300)) {
    optimisticCooldowns.delete(slot);
    return 0;
  }
  return Math.max(0, guess.until - time);
}
/** The skill's buttons answer the press at once: a flash, and the cooldown starts. */
function flashSkillButton(slot: number, ok: boolean) {
  const buttons = [
    document.getElementById(`ability-${slot}`),
    document.querySelector<HTMLElement>(
      `#mobile-controls [data-skill="${slot}"]`,
    ),
  ];
  for (const button of buttons) {
    if (!button) continue;
    button.classList.remove("press-ok", "press-denied");
    void button.offsetWidth; // restart the animation
    button.classList.add(ok ? "press-ok" : "press-denied");
    const press = button;
    setTimeout(() => press.classList.remove("press-ok", "press-denied"), 260);
    if (ok && slot !== ULT_SLOT) {
      button.classList.add("cooling");
      button.style.setProperty("--cooldown", "100%");
    }
  }
}
/** How long a basic (slot -1) or skill animation plays. */
function castDuration(c: (typeof CHARACTERS)[CharacterId], slot: number) {
  return slot >= 0
    ? Math.max(
        c.skills[slot].kind === "cone" ? c.skills[slot].duration * 1000 : 0,
        slot === 3 ? 650 : 360,
      )
    : 220;
}
let padHeld = new Set<PadAction>();
/** The controller was used last (aim from the right stick, pad labels). */
let usingPad = false;
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const skillSlot = (action: Action | PadAction) =>
  (SKILL_ACTIONS as readonly string[]).indexOf(action);
function pressAction(action: Action | PadAction) {
  // Between rounds the skill keys/buttons pick a rite (1st, 2nd, 3rd, 4th).
  if (state?.phase === "intermission") {
    const pick = skillSlot(action);
    const me = state.players.find((p) => p.id === myId);
    const offers = state.raid ? state.raid.offers[myId ?? ""] : me?.riteOffer;
    const id = pick >= 0 ? offers?.[pick] : undefined;
    if (id) chooseRite(id);
    return;
  }
  if (!scene?.canControl()) return;
  audio.unlock();
  const slot = skillSlot(action);
  if (slot >= 0) {
    const cast = caster.press(slot, controlPrefs().cast);
    if (cast >= 0) scene.actions.skill = cast;
  } else if (action === "dash") scene.actions.dash = true;
  else if (action === "jump") scene.actions.jump = true;
  else if (action === "basic") scene.actions.basic = true;
}
function releaseAction(action: Action | PadAction) {
  const slot = skillSlot(action);
  if (slot < 0) return;
  const cast = caster.release(slot, controlPrefs().cast);
  if (cast >= 0 && scene?.canControl()) scene.actions.skill = cast;
}
const matchKeys = () =>
  state?.phase === "playing" && !$<HTMLDialogElement>("dialog").open;
document.addEventListener(
  "keydown",
  (e) => {
    if (controlsCapturing() || typingIn(e.target)) return;
    const rune = dreamRuneKey(state, myId, e.code);
    if (rune && matchKeys()) {
      e.preventDefault();
      if (!e.repeat) void request("raid-rune", { rune });
      return;
    }
    const action = actionFor(controlPrefs().bindings, e.code);
    if (!action) return;
    const live = matchKeys();
    if (live) e.preventDefault(); // Space, arrows and friends must not scroll or click.
    if (e.repeat) return;
    usingPad = false;
    // Held keys are tracked in every phase, so movement held through the countdown works at "Fight".
    // A fresh press moves the key to the end: the latest press wins (heldAxis).
    held.delete(e.code);
    held.add(e.code);
    if (live) pressAction(action);
    else if (
      state?.phase === "intermission" &&
      !$<HTMLDialogElement>("dialog").open
    )
      pressAction(action);
  },
  true,
);
// Raid team signals on Z / X / C (when those keys aren't bound to anything).
const PING_KEYS: Record<string, "stack" | "revive" | "bait"> = {
  KeyZ: "stack",
  KeyX: "revive",
  KeyC: "bait",
};
window.addEventListener("keydown", (e) => {
  const kind = PING_KEYS[e.code];
  if (
    !kind ||
    e.repeat ||
    controlsCapturing() ||
    typingIn(e.target) ||
    actionFor(controlPrefs().bindings, e.code) ||
    !state?.raid ||
    !["playing", "countdown"].includes(state.phase)
  )
    return;
  void request("raid-ping", { kind });
});
let ritePending = "";
function chooseRite(id: string) {
  if (ritePending === id) return;
  ritePending = id;
  void request("rite", { id }).then((reply) => {
    ritePending = "";
    if (!reply.ok && reply.error) toast(reply.error);
  });
}
document.addEventListener("click", (e) => {
  const card = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(
    "[data-rite]",
  );
  if (card?.dataset.rite) chooseRite(card.dataset.rite);
});
/** Between rounds: the rite choice, or what you and your rivals picked. */
/**
 * Seconds that tick down on an overlay card. The card's markup must stay the
 * same from one second to the next (rebuilding it restarts its pop-in
 * animation, which flickers), so the number lives in this slot and is filled
 * in after the card is drawn (see fillLiveSeconds).
 */
function riteMarkup(me: Fighter, _seconds: number) {
  const timer = `Next round in ${LIVE_SECONDS}`;
  const chips = (p: Fighter) =>
    (p.rites ?? [])
      .map((id) => RITE_BY_ID[id])
      .filter(Boolean)
      .map(
        (r) =>
          `<span class="rite-chip ${r.tier}" title="${escape(r.text)}">${riteIcon(r, "chip")}${escape(r.name)}</span>`,
      )
      .join("");
  const offer = me.riteOffer;
  if (offer?.length) {
    const comeback = offer.length > RITE_RULES.choices;
    const cards = offer
      .map((id) => RITE_BY_ID[id])
      .map(
        (r, i) =>
          `<button class="rite-card ${r.tier}" data-rite="${r.id}"><kbd>${touch.enabled ? i + 1 : escape(keyText(SKILL_ACTIONS[i]))}</kbd><span class="rite-head">${riteIcon(r)}<span class="rite-tier">${r.tier === "major" ? "MAJOR RITE" : "RITE"}<em style="color:${RITE_EFFECTS[riteEffect(r)].color}">${escape(RITE_EFFECTS[riteEffect(r)].label)}</em></span></span><b>${escape(r.name)}</b><small>${escape(r.text)}</small></button>`,
      )
      .join("");
    return {
      body: `<p class="rite-intro">Choose an upgrade for the rest of the match${comeback ? " · comeback: one extra choice" : ""}.</p><p class="rite-timer">${timer} · a choice is made for you when time runs out</p>${me.rites?.length ? `<div class="rite-owned">${chips(me)}</div>` : ""}`,
      actions: `<div class="rite-choices" style="--rite-count:${offer.length}">${cards}</div>`,
    };
  }
  const rivals = state!.players.filter((p) => p.id !== myId && p.rites?.length);
  const roulette = state!.mutators?.includes("random")
    ? '<p class="rite-intro">Fighter roulette: everyone gets a new random fighter next round.</p>'
    : "";
  return {
    body: `${roulette}${me.rites?.length ? `<div class="rite-owned"><em>Your rites</em>${chips(me)}</div>` : ""}${rivals
      .map(
        (p) =>
          `<div class="rite-owned rival"><em>${escape(p.name)}</em>${chips(p)}</div>`,
      )
      .join(
        "",
      )}<p class="rite-timer">${state!.players.some((p) => p.riteOffer) ? "Waiting for the others to choose · " : ""}${timer}</p>`,
    actions: "",
  };
}
document.addEventListener(
  "keyup",
  (e) => {
    if (!held.delete(e.code)) return;
    const action = actionFor(controlPrefs().bindings, e.code);
    if (action) releaseAction(action);
  },
  true,
);
// mousedown/mouseup fire for every button (pointer events skip chorded buttons).
$("game").addEventListener("mousedown", (e) => {
  audio.unlock();
  if (touch.enabled) return;
  const code = `Mouse${e.button}`;
  usingPad = false;
  if (e.button === 1) e.preventDefault(); // No middle-click autoscroll.
  held.add(code);
  const action = actionFor(controlPrefs().bindings, code);
  if (action && matchKeys()) pressAction(action);
});
window.addEventListener("mouseup", (e) => {
  const code = `Mouse${e.button}`;
  if (!held.delete(code)) return;
  const action = actionFor(controlPrefs().bindings, code);
  if (action) releaseAction(action);
});
$("game").addEventListener("mousemove", () => (usingPad = false));
window.addEventListener("blur", () => {
  held.clear();
  caster.cancel();
});
const heldAction = (action: Action) =>
  controlPrefs().bindings[action].some((code) => !!code && held.has(code));
/**
 * One movement axis from the held keys. With both directions held, the one
 * pressed last wins (held keeps press order): holding A and pressing D turns
 * right at once, instead of the two cancelling and the fighter stopping.
 */
function heldAxis(negative: Action, positive: Action) {
  const bindings = controlPrefs().bindings;
  let value = 0;
  for (const code of held)
    if (bindings[negative].includes(code)) value = -1;
    else if (bindings[positive].includes(code)) value = 1;
  return value;
}
/** Poll the controller once per frame; returns its movement for this frame. */
function pollPad() {
  const pad = firstPad();
  if (!pad) {
    for (const action of padHeld) releaseAction(action);
    padHeld = new Set();
    return undefined;
  }
  const frame = readPad(pad, padHeld);
  padHeld = frame.held;
  if (frame.active) usingPad = true;
  for (const action of frame.pressed) {
    if (action === "menu") {
      const open = $<HTMLDialogElement>("dialog");
      if (open.open) $("close-dialog")?.click();
      else if (state && state.phase !== "lobby") showSettings();
    } else if (action === "jump" && state?.phase === "briefing")
      document.getElementById("instructions-ready")?.click();
    else pressAction(action);
  }
  for (const action of frame.released) releaseAction(action);
  return frame;
}
window.addEventListener("gamepadconnected", () =>
  toast(
    "Controller connected: left stick moves, right stick aims, RT attacks. See Settings → Controls.",
  ),
);
/** Key label for an action; controller button names while a pad is in use. */
function keyText(action: Action) {
  if (usingPad) {
    if (action in PAD_LABELS) return PAD_LABELS[action as PadAction];
    return "L-STICK";
  }
  return actionLabel(controlPrefs().bindings, action);
}
const moveText = () =>
  usingPad ? "L-STICK" : movementLabel(controlPrefs().bindings);
const skillsText = () =>
  usingPad
    ? SKILL_ACTIONS.map((a) => PAD_LABELS[a]).join(" ")
    : skillLabels(controlPrefs().bindings).join(" ");
/** The controls cheat sheet used by the briefing and How to play. */
function controlsList(full = false) {
  const aimHow = usingPad ? "right stick to aim" : "mouse to aim";
  const casting =
    controlPrefs().cast === "preview"
      ? " · hold to preview, release to cast"
      : "";
  return `<div class="controls-list"><span><kbd>${escape(moveText())}</kbd>Move · ${aimHow}</span><span><kbd>${escape(keyText("basic"))}</kbd>Basic attack${full ? " · hold to keep attacking" : ""}</span><span><kbd>${escape(skillsText())}</kbd>Four skills · the last is your ultimate${casting}</span>${full ? "<span><kbd>ULT</kbd>The ultimate charges as you fight · basic hits shorten cooldowns</span><span><kbd>COMBO</kbd>Each fighter has a setup → payoff combo (see the fighter panel)</span>" : ""}<span><kbd>${escape(keyText("dash"))}</kbd>Dash${full ? " · 3 second cooldown" : ""}</span><span><kbd>${escape(keyText("jump"))}</kbd>Jump over ground attacks</span>${full ? "<span><kbd>ESC</kbd>Settings · change keys under Controls</span>" : ""}</div>`;
}
/** The briefing's keys: one compact row (the help screen has the full list). */
function briefKeys() {
  const key = (k: string, what: string) =>
    `<span><kbd>${escape(k)}</kbd>${what}</span>`;
  return `<div class="brief-keys">${key(moveText(), "Move")}${key(keyText("basic"), "Attack")}${key(skillsText(), "Skills")}${key(keyText("dash"), "Dash")}${key(keyText("jump"), "Jump")}</div>`;
}
let labelState = "";
/** Keep HUD key labels in step with bindings and the device in use. */
function refreshControlLabels() {
  const now = `${bindingsKey()}:${usingPad}:${controlPrefs().cast}`;
  if (now === labelState) return;
  labelState = now;
  for (const kbd of Array.from(
    document.querySelectorAll<HTMLElement>("#abilities kbd[data-action]"),
  ))
    kbd.textContent = keyText(kbd.dataset.action as Action);
  const hint = (key: string, what: string) => `${escape(key)} <b>${what}</b>`;
  $("control-hints").innerHTML = [
    hint(moveText(), "Move"),
    hint(usingPad ? "R-STICK" : "Mouse", "Aim"),
    hint(keyText("basic"), "Basic"),
    hint(skillsText(), "Skills"),
    hint(keyText("dash"), "Dash"),
    hint(keyText("jump"), "Jump"),
  ].join(" · ");
}
onControlPrefs(() => {
  labelState = "";
  refreshControlLabels();
});
function stopControls() {
  touch.reset();
  if (scene) {
    scene.actions = { skill: -1, dash: false, jump: false, basic: false };
    held.clear();
    caster.cancel();
  }
  if (connected && state?.phase === "playing" && local)
    socket.emit("input", {
      seq: ++seq,
      dx: 0,
      dy: 0,
      aimX: Math.max(
        0,
        Math.min(RULES.width, local.x + Math.cos(local.angle) * 100),
      ),
      aimY: Math.max(
        0,
        Math.min(RULES.height, local.y + Math.sin(local.angle) * 100),
      ),
      basic: false,
      skill: -1,
      dash: false,
      jump: false,
    });
}
window.addEventListener("blur", stopControls);
window.addEventListener("pagehide", stopControls);
document.addEventListener("visibilitychange", stopControls);
const pwa = setupPWA(() => state?.phase, dialog, toast);
wireRotateGate();
watchRotation();
watchNotchInsets();
watchScrollRows();
watchScreenPin();
// The iPhone app (native.ts): iOS pauses it soon after you switch away, which
// drops the game connection; coming back reconnects at once.
void setupNativeShell(() => {
  const token = (socket.auth as { accessToken?: string | null }).accessToken;
  if (token && !socket.connected) socket.connect();
});
watchCosmeticPreviews();
// Remember a room from an invite link (?room=ABC123) before the first render.
if (captureInvite()) inviteHinted = false;
// A farm invite (?farm=CODE) waits until the new player is signed in.
captureFarmInvite();
let farmInviteSent = false;
/** Claim a farm invite once the player is signed in (migration 057). */
function claimFarmInvite() {
  const code = pendingFarmInvite();
  if (!code || farmInviteSent || !accountsUI?.account) return;
  farmInviteSent = true;
  clearFarmInvite();
  void accountsUI
    .api("/api/farm/invite", { code })
    .then((r) => {
      const res = r as { ok?: boolean; inviter?: string; error?: string };
      if (res.ok)
        toast(
          `You and ${res.inviter} are now friends. Reach farm level 10 and you both get rewards!`,
        );
      else if (res.error) toast(res.error);
    })
    .catch(() => {});
}
let savingRoomPick = "";
let lockAttempt = 0;
/**
 * The room screen (UI remodel step 5): the seats column beside the roster,
 * which is the room's fighter picker (Lock in, Ready, the corner leaves).
 */
let roomPicker: RosterScreen | undefined;
let openingRoomPicker = false;
let roomSeatsTemplate: HTMLElement | undefined;
let roomWatchTemplate: HTMLElement | undefined;
/** The roster's data, shared by the hub's Fighters screen and the rooms. */
function rosterData() {
  const bindings = controlPrefs().bindings;
  return {
    playing: selected,
    matches: masteryMatches,
    owned: accountsUI.economy?.owned ?? [],
    looks: accountsUI.economy?.looks ?? {},
    look: accountsUI.raidLook ?? {},
    keys: {
      skills: skillLabels(bindings),
      basic: actionLabel(bindings, "basic"),
      dash: actionLabel(bindings, "dash"),
      jump: actionLabel(bindings, "jump"),
    },
  };
}
/** What the room's seats column shows. */
function roomData(watch: boolean): RoomData {
  const s = state!;
  const mode: RoomKind = s.raid
    ? "raid"
    : isFfa()
      ? "ffa"
      : isTeams()
        ? "teams"
        : "duel";
  const players = s.players.filter((p) => isRaider(p));
  const hostId = players[0]?.id;
  const me = players.find((p) => p.id === myId);
  const on = new Set(s.mutators ?? []);
  return {
    mode,
    watch,
    code: s.code,
    boss: s.raid?.boss,
    spire: s.raid?.spire
      ? { problem: s.raid.spire.problem, zone: s.raid.spire.zone }
      : undefined,
    rounds: roundsNeeded(s.mutators),
    seats: players.map((p, i) => {
      const character = p.id === myId ? selected : p.character;
      return {
        id: p.id,
        name: p.name,
        character,
        avatar: framedAvatar(
          identityOf(p, character),
          `room-${watch ? "watch" : "seat"}-${i}`,
        ),
        ready: p.ready,
        connected: p.connected,
        host: p.id === hostId,
        me: p.id === myId,
        team: mode === "teams" ? (teamOf(p) === 1 ? 1 : 0) : undefined,
        flair: p.flair ? `★ ${p.flair}` : undefined,
      };
    }),
    host: !watch && hostId === myId,
    rules: MUTATOR_IDS.map((m) => ({
      id: m,
      name: MUTATORS[m].name,
      text: MUTATORS[m].description,
      on: on.has(m),
    })),
    arcade: s.arcade
      ? {
          name: ARCADE_EVENTS[s.arcade.id].name,
          text: ARCADE_EVENTS[s.arcade.id].text,
        }
      : undefined,
    teamUp:
      mode === "teams" && me ? teamUpNote({ ...me, character: selected }) : "",
    watchers: s.watchers ?? [],
  };
}
/** Draw the room (or a watched room): seats patched in place, the picker
 * opened once and refreshed after. */
function renderRoom(watch: boolean) {
  // A match follows: have the battle renderer ready (phaser-runtime.ts).
  warmPhaser(0);
  const menu = $("menu");
  const d = roomData(watch);
  const seats = roomSeatsMarkup(d);
  let room = menu.querySelector<HTMLElement>(":scope > .room-screen");
  if (!room || room.dataset.roomWatch !== String(watch)) {
    roomPicker?.close();
    roomPicker = undefined;
    menu.innerHTML = `<div class="room-screen ui" data-room-watch="${watch}" data-graphics="${lowGraphics() ? "low" : "high"}">${seats}${watch ? roomWatchMarkup(d) : ""}</div>`;
    room = menu.querySelector<HTMLElement>(":scope > .room-screen")!;
    room.addEventListener("click", onRoomClick);
    roomSeatsTemplate = parse(seats);
    roomWatchTemplate = watch ? parse(roomWatchMarkup(d)) : undefined;
  } else {
    const next = parse(seats);
    patch(room.querySelector(".room-seats")!, roomSeatsTemplate!, next);
    roomSeatsTemplate = next;
    const panel = room.querySelector<HTMLElement>(":scope > .room-watch");
    // Patched too: its buttons stay put under a finger.
    if (watch && panel) {
      const nextWatch = parse(roomWatchMarkup(d));
      if (roomWatchTemplate) patch(panel, roomWatchTemplate, nextWatch);
      else panel.replaceWith(nextWatch.cloneNode(true));
      roomWatchTemplate = nextWatch;
    }
  }
  if (watch) return;
  // Friends stands in the picker's place until it closes (only the sheet
  // opened in this room: one left over from the Lobby is closing).
  // A sheet that is closing (fading out) has given the place back.
  if (
    !roomPicker &&
    room.querySelector(
      ":scope > .ui-panel-host:not([data-ui-leaving]) .friends-sheet",
    )
  )
    return;
  if (roomPicker?.isOpen) roomPicker.refresh();
  // Opening the picker closes the screen it replaces (Friends, left open on
  // the Lobby), and Friends closing draws the room again: that nested draw
  // must not open a second picker before this one is stored.
  else if (!openingRoomPicker) {
    openingRoomPicker = true;
    try {
      roomPicker = openRoster(
        {
          data: () => {
            const me = state?.players.find((p) => p.id === myId);
            return {
              ...rosterData(),
              action: "lock" as const,
              room: {
                kicker: state ? roomKicker(roomData(false)) : "Room",
                saving: !!savingRoomPick,
                ready: !!me?.ready,
                canReady: state?.phase === "lobby" && !savingRoomPick,
              },
            };
          },
          choose: (c) => void lockIn(c),
          skins: () => {},
          ready: (c) => void roomReady(c),
          leave: () => void leave(),
          onClose: () => (roomPicker = undefined),
        },
        { focus: selected, room: { host: room } },
      );
    } finally {
      openingRoomPicker = false;
    }
  }
}
/** Clicks on the seats column: invite, teams, shuffle, party rules. */
function onRoomClick(event: MouseEvent) {
  const t = (event.target as Element).closest<HTMLElement>("button");
  if (!t || t.closest(".ui-panel-host") || (t as HTMLButtonElement).disabled)
    return;
  audio.unlock();
  const d = t.dataset;
  if (d.roomInvite !== undefined) void accountsUI.showFriends();
  else if (d.team !== undefined) void request("team", { team: Number(d.team) });
  else if (d.roomShuffle !== undefined) void request("shuffle");
  else if (d.mutator) {
    const on = new Set(state?.mutators ?? []);
    const id = d.mutator as MutatorId;
    if (on.has(id)) on.delete(id);
    else on.add(id);
    void request("mutators", { ids: [...on] });
  } else if (t.id === "stop-watching") void stopWatching();
}
/** Redraw the room's seats and picker in place. */
function refreshRoom() {
  if ($("menu").querySelector(":scope > .room-screen")) {
    const watch = !myId;
    renderRoom(watch);
  }
}
/** Lock in a fighter for this room; the server's answer counts (a refusal
 * puts its pick back). */
async function lockIn(choice: CharacterId) {
  const me = state?.players.find((p) => p.id === myId);
  if (!state || !me) return false;
  audio.unlock();
  const roomCode = state.code;
  if (choice === selected && me.character === choice) {
    refreshRoom();
    return true;
  }
  const attempt = ++lockAttempt;
  savingRoomPick = `${roomCode}:${choice}`;
  selected = choice;
  rememberHomeFighter(choice);
  const revision = lobbySelection.choose(choice);
  renderMenu(true);
  const reply = await request("select", choice);
  const mine = state?.players.find((p) => p.id === myId);
  let ok = false;
  if (attempt === lockAttempt) {
    savingRoomPick = "";
    if (
      reply.ok &&
      state &&
      state.code === roomCode &&
      state.phase === "lobby"
    ) {
      ok = true;
      toast(`${CHARACTERS[choice].name} locked in.`);
    }
    refreshRoom();
  }
  // The server said no (e.g. the match is starting): show its pick again.
  if (
    !reply.ok &&
    revision !== undefined &&
    lobbySelection.reject(revision) &&
    mine
  ) {
    selected = mine.character;
    renderMenu();
  }
  return ok;
}
/** Ready (or Cancel ready) with the fighter shown: locking it in first. */
async function roomReady(choice: CharacterId) {
  audio.unlock();
  const me = state?.players.find((p) => p.id === myId);
  if (!me) return;
  if (!me.ready && choice !== selected && !(await lockIn(choice))) return;
  void request("ready");
}

/** A player's equipped champion skins (yours update as soon as you equip). */
function looksOf(p: Pick<Fighter, "id" | "championLooks"> | undefined) {
  return p?.id === myId && accountsUI?.economy
    ? accountsUI.economy.looks
    : p?.championLooks;
}
/** The champion skin a player wears on a champion, if any. */
function skinOf(
  p: Pick<Fighter, "id" | "championLooks"> | undefined,
  character: CharacterId,
) {
  return looksOf(p)?.[character] ?? null;
}
/** The local saved Wardrobe updates immediately; peers use verified snapshots. */
function identityOf(p: Fighter, character = p.character): Fighter {
  return p.id === myId && accountsUI?.account
    ? {
        ...p,
        character,
        raidLook: accountsUI.raidLook ?? p.raidLook,
        championLooks: looksOf(p),
        raidClears:
          accountsUI.raidLook !== undefined
            ? accountsUI.raidClears
            : p.raidClears,
      }
    : { ...p, character };
}
let lastWornKey = "{}";
/** Your fighter's colour on the page (the room, the hub). */
function syncMenuCosmetic() {
  document.body.style.setProperty(
    "--element",
    `#${CHARACTERS[selected].color.toString(16).padStart(6, "0")}`,
  );
}
function syncHomePresentation() {
  accountsUI?.syncAvatar();
  homeNavigation.refresh();
}
/** Blue = 0, Red = 1. Older snapshots without teams fall back to seat order. */
const teamOf = (p: Fighter) =>
  p.team ??
  (state?.mode === "ffa"
    ? (state?.players.indexOf(p) ?? 0)
    : (state?.players.indexOf(p) ?? 0) % 2 === 0
      ? 0
      : 1);
const TEAM_LABELS = ["Blue", "Red"] as const;
const isTeams = () => state?.mode === "teams";
/** Free-for-all: three or four fighters, everyone for themselves. */
const isFfa = () => state?.mode === "ffa";
/** The off-screen arrow circles the fighter at this distance (CSS px),
 * around a point this far (world px) above the feet. */
const BEARING_RADIUS = 46;
const BEARING_LIFT = 32;
/** Living, visible enemies nearest first (aim assist, off-screen arrow). */
function nearestEnemy(from: { x: number; y: number }, myself: Fighter) {
  return visibleEnemies(from, myself)[0];
}
function visibleEnemies(from: { x: number; y: number }, myself: Fighter) {
  const team = teamOf(myself);
  return (state?.players ?? [])
    .filter(
      (p) =>
        p.id !== myself.id &&
        teamOf(p) !== team &&
        p.hp > 0 &&
        !p.out &&
        !p.statuses.some((s) => s.kind === "stealth"),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - from.x, a.y - from.y) -
        Math.hypot(b.x - from.x, b.y - from.y),
    );
}
type RoomMode = "duel" | "teams" | "ffa" | "raid";
let roomMode: RoomMode = (() => {
  try {
    const saved = localStorage.getItem("arena-room-mode");
    return saved === "teams" || saved === "ffa" || saved === "raid"
      ? saved
      : "duel";
  } catch {
    return "duel";
  }
})();
/** Lobby panel: a duel list, or Blue/Red columns for 2v2. */
/** Orb Rush HUD line: gems you carry, your side's bank and the best rival's. */
function rushLabel(me: Fighter) {
  const banked = state?.banked ?? [];
  const mine = banked[teamOf(me)] ?? 0;
  const rival = Math.max(0, ...banked.filter((_, t) => t !== teamOf(me)));
  return `RUSH · CARRYING ${me.gems ?? 0} · BANKED ${mine} · RIVAL ${rival} / ${RUSH.target}`;
}
/** Crown Hill HUD line: your hold time against the best rival's. */
function crownLabel(me: Fighter) {
  const crown = state?.crown ?? [];
  const mine = crown[teamOf(me)] ?? 0;
  const rival = Math.max(0, ...crown.filter((_, t) => t !== teamOf(me)));
  return `CROWN · YOU ${Math.floor(mine)}s · RIVAL ${Math.floor(rival)}s / ${state?.arcade?.hill?.target ?? CROWN.holdSeconds}s`;
}
/** What a watcher sees over the arena: no buttons but "Stop watching". */
function renderWatchOverlay(overlay: HTMLElement) {
  const banner = $("spectate");
  banner.hidden = state!.phase !== "playing";
  banner.textContent = `Watching room ${state!.code} · Esc / Menu to stop`;
  if (state!.phase === "playing") {
    setOverlayMarkup(overlay, "");
    overlay.style.pointerEvents = "none";
    return;
  }
  overlay.style.pointerEvents = "auto";
  const name = (id: string | null) =>
    escape(state!.players.find((p) => p.id === id)?.name ?? "");
  let heading = "",
    details = "",
    actions = "";
  if (state!.phase === "briefing") {
    heading = "The players are getting ready";
    details = `<div class="briefing-versus${isFfa() ? " ffa" : ""}">${state!.players
      .map(
        (p, i) =>
          `<div class="vs-fighter" style="--element:#${CHARACTERS[p.character].color.toString(16).padStart(6, "0")}">${scopeIds(fighterArt(p.character, undefined, skinOf(p, p.character)), `watchvs${i}`)}<b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}</span></div>`,
      )
      .join(
        '<span class="vs-mark">VS</span>',
      )}</div><p class="arena-brief"><b>Arena · ${escape(ARENAS[state!.arena ?? "classic"].name)}</b>${escape(ARENAS[state!.arena ?? "classic"].tip)}</p>${partyRulesNote()}`;
  }
  if (state!.phase === "countdown") {
    heading = LIVE_COUNTDOWN;
    details = "Here we go.";
  }
  if (state!.phase === "intermission") {
    heading = isTeams()
      ? state!.roundWinnerTeam === null || state!.roundWinnerTeam === undefined
        ? "Round drawn"
        : `${TEAM_LABELS[state!.roundWinnerTeam] ?? ""} team takes the round`
      : state!.roundWinner
        ? `${name(state!.roundWinner)} takes the round`
        : "Round drawn";
    details = `<p class="rite-timer">Next round in ${LIVE_SECONDS}</p>`;
  }
  if (state!.phase === "paused") {
    heading = "A player disconnected";
    details = `Waiting for them · ${LIVE_SECONDS}`;
  }
  if (state!.phase === "finished") {
    heading = isTeams()
      ? `${TEAM_LABELS[state!.winnerTeam ?? 0] ?? ""} team wins`
      : `${name(state!.winner)} wins`;
    details =
      (isFfa() ? standingsMarkup(state!, "") : "") + recapMarkup(state!, "");
    actions = `<div class="result-actions"><button class="secondary btn-secondary leave-button" id="watch-stop">${iconLabel("stop-watching", "Stop watching")}</button></div>`;
  }
  setOverlayMarkup(
    overlay,
    `<div class="overlay-card${actions ? " action-overlay" : state!.phase === "countdown" ? " countdown-card" : ""}"><span class="eyebrow">Watching · ${escape(state!.code)}</span><h2>${heading}</h2><div${actions ? ' class="panel-scroll" tabindex="0" role="region" aria-label="Match results"' : ""}>${details}</div>${actions ? `<div class="panel-actions">${actions}</div>` : ""}</div>`,
    actions
      ? `${state!.code}:${state!.matchId ?? ""}:${state!.phase}`
      : undefined,
  );
  fillLiveSeconds(
    overlay,
    state!.phase === "paused" ? state!.pauseRemaining : state!.remaining,
  );
  if (state!.phase === "countdown")
    fillLiveCountdown(overlay, state!.remaining);
  const stop = document.getElementById("watch-stop");
  if (stop) stop.onclick = () => void stopWatching();
}
/** 2v2: what you and your partner give each other when side by side. */
function teamUpNote(me: Fighter) {
  if (!isTeams()) return "";
  const partner = state!.players.find(
    (p) => p.id !== me.id && teamOf(p) === teamOf(me),
  );
  if (!partner) return "";
  const gift = giftFrom(partner.character);
  return `<p class="teamup-note"><b>Team-up</b> ${me.id === myId ? "You get" : `${escape(me.name)} gets`} <i title="${escape(gift.text)}">${escape(gift.name)}</i> from ${escape(CHARACTERS[partner.character].name)}</p>`;
}
/** Join a friend's room from the friends list. */
async function joinByCode(code: string) {
  if (!accountsUI.ensurePlayer()) return false;
  if (myId) {
    toast("Leave your current room first.");
    return false;
  }
  if (!connected) {
    toast("Waiting for the server connection.");
    return false;
  }
  if (watching) await stopWatching();
  audio.unlock();
  const reply = await request("join", {
    name: accountsUI.account?.displayName ?? "Player",
    code,
  });
  identity(reply);
  if (reply.ok) {
    await request("select", selected);
    $<HTMLDialogElement>("dialog").close();
    menuOpen = false;
    settingsOpen = false;
  }
  return reply.ok;
}

/** Room code being watched (no seat), or "". */
let watching = "";
const pvpSpectator = new PvpSpectator();
const roomInvites = new RoomInvites({
  accountId: () => accountsUI?.account?.id,
  canJoin: () => connected && !!accountsUI?.account && !myId,
  join: (code, mode) =>
    mode === "party" ? acceptParty(code) : joinByCode(code),
  decline: (invite) =>
    void (invite.mode === "party"
      ? request("party-decline", { code: invite.code })
      : request("room-invite-decline", { fromId: invite.fromId })),
});
/** Your party on the Lobby (hub redesign phase 2b), or null. */
let party: PartyState = null;
let partyRoomSent = "";
/**
 * Room invitations you sent (friend → until when). Party invitations come
 * from the server's party state; both make every Invite button for that
 * friend say Invited until they answer or it lapses (90 s, the server's).
 */
const roomInvitesSent = new Map<string, number>();
const INVITE_OPEN_MS = 90_000;
let invitesTimer: ReturnType<typeof setTimeout> | undefined;
function invitedFriends(): ReadonlySet<string> {
  const now = Date.now(),
    server = serverNow();
  const ids = new Set<string>();
  for (const [id, until] of roomInvitesSent)
    if (until > now) ids.add(id);
    else roomInvitesSent.delete(id);
  const members = new Set(party?.members.map((m) => m.id) ?? []);
  for (const invite of party?.invites ?? [])
    if (invite.expiresAt > server && !members.has(invite.id))
      ids.add(invite.id);
  for (const id of members) ids.delete(id);
  return ids;
}
/** Redraw the Invite buttons now, and again when the next invite lapses. */
function invitesChanged() {
  clearTimeout(invitesTimer);
  accountsUI?.refreshInvites();
  syncPartyInviteDialog();
  const now = Date.now(),
    skew = now - serverNow();
  const next = Math.min(
    ...[...roomInvitesSent.values()],
    ...(party?.invites ?? []).map((i) => i.expiresAt + skew),
  );
  if (Number.isFinite(next) && next > now)
    invitesTimer = setTimeout(invitesChanged, next - now + 50);
}
function noteInviteSent(id: string, room: boolean) {
  if (room) roomInvitesSent.set(id, Date.now() + INVITE_OPEN_MS);
  invitesChanged();
}
/** A reply to an invite: sent, or already on its way (also Invited). */
const inviteStands = (reply: { ok?: boolean; error?: string }) =>
  !!reply.ok || /already sent/i.test(reply.error ?? "");
/**
 * Your party's room: the code you stepped out of (Rejoin on the Lobby
 * brings you back; you aren't pulled in again) and the one this tab
 * already followed the leader into.
 */
let partyRoomLeft = "";
let partyRoomFollowed = "";
let partyFollowing = false;
/**
 * Follow your party's leader into their room, as in most team games: from
 * the Lobby straight away, and from another room between matches (never
 * during a fight). A room you left yourself waits for Rejoin.
 */
async function followPartyRoom(
  room = party?.room ?? null,
  rejoin = false,
): Promise<void> {
  if (!room || !party || partyLeader() || watching || partyFollowing) return;
  if (myId && state?.code === room.code) {
    partyRoomFollowed = room.code;
    return;
  }
  if (
    !rejoin &&
    (room.code === partyRoomFollowed || room.code === partyRoomLeft)
  )
    return;
  if (!connected || !accountsUI?.account) return;
  if (myId) {
    if (
      !state ||
      state.practice ||
      (state.phase !== "lobby" && state.phase !== "finished")
    )
      return;
  }
  partyRoomFollowed = room.code;
  partyFollowing = true;
  try {
    toast("Following your party leader into their room…");
    if (myId) await leave(false);
    if (myId) return;
    if (await joinByCode(room.code)) partyRoomLeft = "";
  } finally {
    partyFollowing = false;
    syncHub();
  }
}
let partyCharacterSent = "";
/** Your saved look as the party last saw it (see syncParty). */
let partyLookSeen: string | undefined;
const partyLeader = () => !!party && party.leader === accountsUI?.account?.id;
/** The leader removes a member (Kick on their seat). */
async function kickFromParty(playerId: string) {
  const name = party?.members.find((m) => m.id === playerId)?.name ?? "They";
  const reply = await request("party-kick", { playerId });
  toast(
    reply.ok
      ? `${name} was removed from the party.`
      : (reply.error ?? "Couldn't remove them."),
  );
}
async function acceptParty(code: string) {
  if (!accountsUI.ensurePlayer()) return false;
  if (myId) {
    toast("Leave your current room first.");
    return false;
  }
  const reply = await request("party-accept", { code, character: selected });
  if (!reply.ok) {
    toast(reply.error ?? "That party is no longer open.");
    return false;
  }
  partyCharacterSent = selected;
  setHubScene("lobby");
  return true;
}
/** What a friend's button says in Invite a friend: one per state. */
function partyInviteButton(id: string) {
  if (party?.members.some((m) => m.id === id))
    return { label: iconLabel("check", "In party"), off: true };
  if (invitedFriends().has(id))
    return { label: iconLabel("check", "Invited"), off: true };
  return { label: iconLabel("add-friend", "Invite"), off: false };
}
/** Keep an open Invite a friend in step with the party and its invites. */
function syncPartyInviteDialog() {
  document
    .querySelectorAll<HTMLButtonElement>(
      "#party-invite-list [data-party-invite]",
    )
    .forEach((button) => {
      if (button.dataset.busy) return;
      const state = partyInviteButton(button.dataset.partyInvite!);
      if (button.innerHTML !== state.label) button.innerHTML = state.label;
      button.disabled = state.off;
    });
}
/** Invite a friend into your party: online friends, one tap each. */
async function showPartyInvite() {
  if (!accountsUI.ensurePlayer()) return;
  // Anyone in the party may invite (most team games let them).
  const lead =
    party && !partyLeader()
      ? party.members.find((m) => m.id === party!.leader)?.name
      : undefined;
  dialog(
    `<div class="party-invite"><span class="eyebrow">Party</span><h2>Invite a friend</h2><p class="muted">${lead ? `Friends join ${escape(lead)}'s party on the Lobby stage and follow your leader into each room.` : "Friends join you on the Lobby stage. When you press PLAY, they follow you into the room, and you stay a party after the match."}</p><div id="party-invite-list"><p class="muted">Loading your friends…</p></div></div>`,
  );
  try {
    const list = await accountsUI.nearbyFriends();
    const members = new Set(party?.members.map((m) => m.id) ?? []);
    // Your party first, then friends online.
    const online = list.friends
      .filter((f) => f.online || members.has(f.id))
      .sort((a, b) => Number(members.has(b.id)) - Number(members.has(a.id)));
    const box = document.getElementById("party-invite-list");
    if (!box) return;
    box.innerHTML = online.length
      ? `<ul class="party-invite-list">${online
          .map((f) => {
            const state = partyInviteButton(f.id);
            return `<li><span><b>${escape(f.name)}</b><small>${members.has(f.id) ? "In your party" : "Online"}</small></span><button type="button" class="secondary" data-party-invite="${f.id}"${state.off ? " disabled" : ""}>${state.label}</button></li>`;
          })
          .join("")}</ul>`
      : `<p class="muted">None of your friends are online right now.</p><p><button type="button" class="secondary" id="party-open-friends">${iconLabel("friends", "Open Friends")}</button></p>`;
    document
      .getElementById("party-open-friends")
      ?.addEventListener("click", () => void accountsUI.showFriends());
    box.querySelectorAll<HTMLButtonElement>("[data-party-invite]").forEach(
      (button) =>
        (button.onclick = async () => {
          const id = button.dataset.partyInvite!;
          button.disabled = true;
          button.dataset.busy = "1";
          const reply = await request("party-invite", {
            playerId: id,
            character: selected,
          });
          delete button.dataset.busy;
          if (reply.ok) partyCharacterSent = selected;
          if (inviteStands(reply)) noteInviteSent(id, false);
          if (!reply.ok) toast(reply.error ?? "Couldn't send this invitation.");
          if (inviteStands(reply) && !invitedFriends().has(id)) {
            // The party's own list arrives a moment later.
            button.innerHTML = iconLabel("check", "Invited");
            button.disabled = true;
          } else syncPartyInviteDialog();
        }),
    );
  } catch {
    const box = document.getElementById("party-invite-list");
    if (box)
      box.innerHTML = `<p class="muted">Couldn't load your friends. Try again.</p>`;
  }
}
/** Keep the party in step: your fighter, and your room when you lead. */
function syncParty() {
  if (!party || party.members.length < 2) {
    partyLookSeen = undefined;
    return;
  }
  void followPartyRoom();
  if (!myId && partyCharacterSent !== selected) {
    partyCharacterSent = selected;
    socket.emit("party-character", { character: selected });
  }
  // You saved a new look (Wardrobe, Shop): the server reads it again from
  // your account, so your friends see it on their Lobby. The server loads it
  // anyway when you join, so the first look is only remembered.
  const look = JSON.stringify([
    accountsUI.economy?.looks ?? null,
    accountsUI.raidLook ?? null,
  ]);
  if (partyLookSeen !== undefined && partyLookSeen !== look)
    socket.emit("party-look");
  partyLookSeen = look;
  if (
    myId &&
    partyLeader() &&
    state?.phase === "lobby" &&
    !state.practice &&
    state.code &&
    state.code !== partyRoomSent
  ) {
    partyRoomSent = state.code;
    void request("party-room");
  }
}
async function watchRoom(raw: string) {
  if (!accountsUI.ensurePlayer()) return;
  const code = raw.trim().toUpperCase();
  const reply = await request("watch", { code });
  if (!reply.ok) {
    toast(reply.error ?? "Couldn't watch that room.");
    return;
  }
  watching = code;
  screen = "";
  toast(
    `Watching room ${code}. You can't be hit, and nobody sees your screen.`,
  );
}
async function stopWatching(notice?: string) {
  if (watching) await request("unwatch");
  watching = "";
  state = undefined;
  screen = "";
  document.body.classList.remove("spectating");
  renderMenu();
  $<HTMLDialogElement>("dialog").close();
  menuOpen = false;
  if (notice) toast(notice);
}
/** The side panel while watching a room's lobby. */
/** Turbo party rule: skills recharge faster (for the cooldown displays). */
function cooldownScale() {
  return state?.mutators?.includes("turbo") ? MUTATOR_RULES.turboCooldown : 1;
}
/** "two" / "three": round wins needed under this room's party rules. */
function roundWord() {
  const n = roundsNeeded(state?.mutators);
  return ["zero", "one", "two", "three", "four"][n] ?? String(n);
}
/** Party rules on the briefing card, if any. */
function partyRulesNote() {
  const on = state?.mutators ?? [];
  return on.length
    ? `<p class="party-note"><b>Party rules:</b> ${on.map((m) => escape(MUTATORS[m].name)).join(" · ")}</p>`
    : "";
}
type BotLevel = "easy" | "normal" | "hard";
const BOT_LEVELS: [BotLevel, string, string][] = [
  ["easy", "Easy", "Learning"],
  ["normal", "Normal", "A fair fight"],
  ["hard", "Hard", "No mercy"],
];
let botLevel: BotLevel = (() => {
  try {
    const saved = localStorage.getItem("arena-bot-level");
    return BOT_LEVELS.some(([id]) => id === saved)
      ? (saved as BotLevel)
      : "normal";
  } catch {
    return "normal";
  }
})();
async function startAdventure(mode: string) {
  if (!accountsUI.ensurePlayer()) return;
  if (myId) return toast("Leave your current room first.");
  if (!connected) return toast("Waiting for the server connection.");
  if (watching) await stopWatching();
  audio.unlock();
  $<HTMLDialogElement>("dialog").close();
  settingsOpen = false;
  menuOpen = false;
  const name = accountsUI.account?.displayName ?? "Player";
  if (mode === "arcade-bot") {
    identity(
      await request("bot-match", {
        name,
        character: selected,
        difficulty: botLevel,
        arcade: arcadeWeek(pacificDate()).id,
      }),
    );
    return;
  }
  if (!["arcade-duel", "arcade-teams"].includes(mode)) return;
  roomMode = mode === "arcade-teams" ? "teams" : "duel";
  const reply = await request("create", {
    name,
    mode: roomMode,
    arcade: arcadeWeek(pacificDate()).id,
  });
  identity(reply);
  if (!reply.ok) return;
  await request("select", selected);
}
/**
 * The welcome screen: shown when signed out (with the sign-up / log-in
 * panel in it), while the account loads, and while a signed-in player is
 * (re)connecting to the hub.
 */
function renderGate() {
  syncHub();
  const status: GateStatus = replacedAccount
    ? "session-replaced"
    : !accountsUI?.checked
      ? "loading"
      : accountsUI.account
        ? "connecting"
        : accountsUI.session
          ? "error"
          : !accountsUI.client
            ? "unavailable"
            : "signed-out";
  const invite = pendingInvite();
  const key = `gate:${status}:${invite ?? ""}`;
  if (screen === key) return;
  screen = key;
  audio.setTheme("lobby");
  pwa.sync();
  touch.reset();
  document.body.classList.remove(
    "battle-active",
    "battle-raid",
    "raid-downed",
    "lobby-active",
  );
  document.body.classList.add("home-active", "gate-active");
  $("battle").hidden = true;
  syncBattleLoop();
  $("menu").hidden = false;
  $("menu").innerHTML = welcomeGate(status, invite);
  const login = document.getElementById("gate-login"),
    retry = document.getElementById("gate-retry");
  if (login) login.onclick = () => accountsUI.showAuth("login");
  if (retry)
    retry.onclick = () => {
      if (replacedAccount) {
        replacedAccount = null;
        sessionStorage.removeItem("arena-session-replaced");
        socket.connect();
        screen = "";
        renderMenu();
      } else void accountsUI.refresh();
    };
  // Signed out: the panel is right there. Returning players see Log in,
  // new ones Create account.
  if (status === "signed-out") {
    let returning = false;
    try {
      returning = localStorage.getItem("arena-has-account") === "yes";
    } catch {
      /* optional */
    }
    accountsUI.showAuth(invite || returning ? "login" : "signup");
  }
}

const WORLD_NAMES: Record<World, string> = {
  farm: "Farm",
  plaza: "Plaza",
  bistro: "Bistro",
};
// Light or full menus from the first screen on (ui/ui-effects.ts).
syncUiEffects();
const worlds = worldLoader();
let phaserWarm: ReturnType<typeof setTimeout> | undefined;
/** Load Phaser `ms` from now, while the page is idle (phaser-runtime.ts). */
function warmPhaser(ms: number) {
  if (phaser() || phaserWarm !== undefined) return;
  phaserWarm = setTimeout(() => {
    const load = () =>
      void loadPhaser().catch(() => {
        // Offline or a new deploy: a battle asks again when it needs it.
        phaserWarm = undefined;
      });
    if (ms && typeof requestIdleCallback === "function")
      requestIdleCallback(load, { timeout: 4000 });
    else load();
  }, ms);
}
/** The hub world wanted on screen whose code is still on the way (or failed). */
let worldWait: World | null = null;
/**
 * A world's code, or undefined while it loads: then the hub shows a loading
 * card, and syncHub runs again when the code arrives, deciding afresh
 * whether that world is still wanted (nothing opens after you moved on).
 */
function worldCode<W extends World>(world: W) {
  // Joins a load already on the way (the idle warm-up's too). A failed load
  // shows its card until the page reloads (hub-worlds.ts).
  const code = worlds.want(world, (loaded) =>
    loaded ? syncHub() : renderWorldWait(),
  );
  if (!code) worldWait = world;
  return code;
}
/** The card shown while a hub world's code loads, or after it failed. */
function renderWorldWait() {
  let card = document.getElementById("hub-world-wait");
  const world = worldWait;
  if (!world) {
    card?.remove();
    return;
  }
  const failed = worlds.failed(world);
  const key = `${world}:${failed ? "failed" : "loading"}`;
  if (!card) {
    card = document.createElement("div");
    card.id = "hub-world-wait";
    card.className = "hub-world-wait";
    card.setAttribute("role", "status");
    document.body.append(card);
  }
  if (card.dataset.key === key) return;
  card.dataset.key = key;
  const name = WORLD_NAMES[world];
  // A browser won't fetch a failed import again, so trying again is a
  // reload; the hub reopens on this tab (and gets a newer release, if any).
  card.innerHTML = failed
    ? `<p>Couldn't load the ${name}. Check your connection, then reload.</p><button type="button" class="primary" id="hub-world-retry">Reload</button>`
    : `<p><span class="hub-world-spinner" aria-hidden="true"></span>Loading the ${name}…</p>`;
  card
    .querySelector("#hub-world-retry")
    ?.addEventListener("click", () => location.reload());
}
let plaza: PlazaScreen | undefined;
let plazaLook = "";
let plazaLow = false;
let plazaRetry: ReturnType<typeof setTimeout> | undefined;
let wantedPlazaClosed = false;
/**
 * The hub (Lobby, Plaza, Farm): open whenever a signed-in, connected player
 * is not in a room (and not about to resume or join one); closed otherwise.
 */
function syncHub() {
  syncUiEffects();
  const hub =
    !!accountsUI?.account &&
    connected &&
    !myId &&
    !watching &&
    !state &&
    !sessionStorage.getItem("arena-token") &&
    !pendingInvite();
  syncHubScenes(hub);
  // Which hub scene is showing (styles such as the toast's place follow it).
  if (hub) document.body.dataset.hubScene = hubScene;
  else delete document.body.dataset.hubScene;
  syncParty();
  syncLobby(hub && hubScene === "lobby");
  worldWait = null;
  syncFarm(hub && hubScene === "farm", hub);
  syncBistro(hub && hubScene === "bistro", hub);
  syncPlaza(hub && hubScene === "plaza", hub);
  renderWorldWait();
  // While the hub is idle, fetch the other worlds' code so they open at once
  // (not in a match, and not when the browser asks to save data).
  const saveData = (navigator as { connection?: { saveData?: boolean } })
    .connection?.saveData;
  if (hub && !saveData) worlds.warm();
  else worlds.stopWarming();
  // The battle renderer too, a moment after the hub shows.
  if (hub) warmPhaser(1500);
  // A scene hiding after the next one showed may have taken the hub's top
  // bar style away (each checks only some of the others): in the hub it is on.
  if (hub) document.body.classList.add("hub-screen");
  syncChat(hub);
}
/** The farm whose Nearby chat this page is in (chat-farm). */
let farmChatOwner: string | null = null;
/** The chat button's place and channels (chat/chat-ui.ts). */
function syncChat(hub: boolean) {
  const inRoom = !!myId && !!state;
  const fighting =
    inRoom && state!.phase !== "lobby" && state!.phase !== "finished";
  const place: ChatPlace = hub
    ? "hub"
    : inRoom && !fighting && !state!.practice
      ? "room"
      : "none";
  // Quick chat in a battle with other people in it (not practice, not a
  // bot match, not a raid alone).
  battleChat.sync(
    chatMode() !== "off" &&
      fighting &&
      !state!.practice &&
      !state!.vsBot &&
      state!.players.length > 1 &&
      (!state!.raid || state!.raid.partySize > 1),
    !!state?.raid,
  );
  chat.sync(place, {
    party: !!party,
    room: inRoom && !state!.practice,
    // Nearby: the Plaza's copy, or the farm you are on.
    place:
      hub && (hubScene === "plaza" || (hubScene === "farm" && !!farmChatOwner)),
    // Friends: anyone signed in with an account (guests have no friends).
    friend: !!accountsUI?.account && !accountsUI.account.guest,
  });
  // A tapped notification waits for the sign-in, then opens that friend.
  if (friendToOpen && accountsUI?.account && !accountsUI.account.guest) {
    const { id, name } = friendToOpen;
    friendToOpen = null;
    chat.openFriend(id, name);
  }
  // Either chat button is up in the screen's top-left corner: the raid's
  // briefing and results cards keep clear of it on phones (raid-cards.css).
  document.body.classList.toggle(
    "chat-corner",
    ["battle-chat", "chat-button"].some(
      (id) => document.getElementById(id)?.hidden === false,
    ),
  );
  placeSceneSwitch?.();
}
/** The new Plaza (hub redesign phase 3): the server moves everyone in it. */
function syncPlaza(want: boolean, hub = want) {
  if (!want) {
    // Behind the Lobby or the Farm the Plaza waits, drawn and kept (you are
    // off it on the server, which keeps your spot); out of the hub it closes.
    if (plaza && hub) plaza.hide();
    else if (plaza) {
      wantedPlazaClosed = true;
      plaza.close();
      wantedPlazaClosed = false;
    }
    return;
  }
  const skin = accountsUI.economy?.looks[selected] ?? null;
  const look = plazaOutfitKey(selected, skin, accountsUI.raidLook);
  if (plaza) {
    plaza.show();
    if (look !== plazaLook)
      plaza.look(selected, skin, accountsUI.raidLook?.skin ?? null);
    plazaLook = look;
    return;
  }
  if (plazaRetry) return;
  const code = worldCode("plaza");
  if (!code) return;
  plazaLook = look;
  plazaLow = lowGraphics();
  plaza = code.openPlazaScreen({
    socket,
    character: selected,
    skin,
    colour: accountsUI.raidLook?.skin ?? null,
    reduced: reducedMotion,
    low: plazaLow,
    art: (character, worn, flat, colour) => {
      const id = (
        Object.hasOwn(CHARACTERS, character) ? character : "voltkit"
      ) as CharacterId;
      const svg = fighterArt(id, undefined, worn, flat);
      // The Skin slot's palette shows unless a champion skin is worn, the
      // same rule as battle and portraits (portraits.ts).
      return (
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          colour && !wornArt(id, worn) ? colourPreview(svg, colour) : svg,
        )
      );
    },
    skinName: (id) => CHAMPION_SKIN_BY_ID[id]?.name ?? null,
    fighterName: (id) => CHARACTERS[id as CharacterId]?.name ?? "Fighter",
    playerName: () => accountsUI.account?.displayName ?? "You",
    loadProgress: async () =>
      (await accountsUI.api("/api/plaza")) as PlazaProgress,
    goFarm: () => setHubScene("farm"),
    isBlocked: (accountId) => accountsUI.isBlocked(accountId),
    // Emotes go through chat's Nearby channel (docs/chat-plan.md).
    quickChat: (quick: ChatQuick) =>
      void request("chat-send", { channel: "place", quick }).then((r) => {
        if (!r.ok && r.error) toast(r.error);
      }),
    myAccountId: () => accountsUI.account?.id,
    onPlayer: async (action, playerId, name) => {
      if (action === "friend") {
        await accountsUI.friendRequest({ playerId });
        return;
      }
      if (action === "report") {
        accountsUI.showReport(
          { ...reportContext(), player: playerId, playerName: name },
          "player",
        );
        return true;
      }
      if (action === "block") {
        try {
          const done = await accountsUI.block(playerId, name);
          if (done) toast(`${name} is blocked.`);
          return done;
        } catch (error) {
          toast(
            error instanceof Error ? error.message : "Couldn't block them.",
          );
          return false;
        }
      }
      const reply = await request("party-invite", {
        playerId,
        character: selected,
      });
      if (reply.ok) partyCharacterSent = selected;
      if (inviteStands(reply)) noteInviteSent(playerId, false);
      toast(
        reply.ok
          ? "Party invitation sent."
          : (reply.error ?? "Couldn't send this invitation."),
      );
    },
    toast,
    onLeaves: (balance) => accountsUI.setLeaves(balance),
    onClose: (failed) => {
      plaza = undefined;
      if (wantedPlazaClosed) return;
      // Closed by the server or refused: back in when possible (and not in a
      // tight loop if the server keeps refusing).
      plazaRetry = setTimeout(
        () => {
          plazaRetry = undefined;
          syncHub();
        },
        failed ? 15000 : 1500,
      );
    },
  });
}
async function showRaidBestiary() {
  await accountsUI.showRaids(state?.raid?.boss);
}
/** The hub's scenes (Lobby, Plaza, later Farm), switched from the top bar. */
let hubScene: HubScene = savedHubScene();
let lobby: LobbyHandle | undefined;
let lobbyFriends: { requests: number; online: number | null } = {
  requests: 0,
  online: null,
};
let lobbyFriendsTimer: ReturnType<typeof setInterval> | undefined;
function syncHubScenes(hub: boolean) {
  const nav = $("hub-scenes");
  nav.hidden = !hub;
  document.body.classList.toggle("hub-active", hub);
  if (!hub) return;
  const markup = sceneSwitchMarkup(hubScene);
  if (nav.innerHTML !== markup) nav.innerHTML = markup;
  // Centred, or between the player card and the pills on narrow phones.
  placeSceneSwitch ??= watchSceneSwitch(nav);
  placeSceneSwitch();
}
let placeSceneSwitch: (() => void) | undefined;
function setHubScene(scene: HubScene) {
  if (!sceneAvailable(scene) || scene === hubScene) return;
  hubScene = scene;
  if (scene === "farm" || scene === "bistro") guide.mark(scene);
  saveHubScene(scene);
  homeNavigation.close();
  syncHub();
}
async function refreshLobbyFriends() {
  try {
    const list = await accountsUI.nearbyFriends();
    lobbyFriends = {
      requests: list.incoming.length,
      online: list.friends.filter((f) => f.online).length,
    };
  } catch {
    /* Friends are optional on the Lobby. */
  }
  syncLobby(!!lobby);
}
function lobbyView() {
  const me = accountsUI.account?.id;
  const seat = (m: NonNullable<PartyState>["members"][number]) => ({
    id: m.id,
    kickable: partyLeader() && m.id !== me,
    name: m.name,
    character: (Object.hasOwn(CHARACTERS, m.character)
      ? m.character
      : "voltkit") as CharacterId,
    leader: m.id === party!.leader,
    skin: m.skin ?? null,
    look: m.look ?? {},
    ...(m.away ? { away: true } : {}),
  });
  // In someone else's party the leader stands in the middle, as on every
  // member's screen, and you stand beside them (your seat first).
  const lead =
    party && party.members.length > 1 && party.leader !== me
      ? party.members.find((m) => m.id === party!.leader)
      : undefined;
  const others = (party?.members ?? []).filter(
    (m) => m.id !== me && m.id !== lead?.id,
  );
  const mine = {
    name: accountsUI.account?.displayName ?? "You",
    character: selected,
    leader: false,
    skin: accountsUI.economy?.looks?.[selected] ?? null,
    look: accountsUI.raidLook ?? {},
    you: true,
  };
  return {
    character: selected,
    host: lead ? seat(lead) : undefined,
    party: lead
      ? [mine, ...others.map(seat)].slice(0, 3)
      : others.slice(0, 3).map(seat),
    leading: (party?.members.length ?? 0) > 1 && partyLeader(),
    partyRoom:
      !!party?.room &&
      !partyLeader() &&
      !myId &&
      (party?.members.length ?? 0) > 1,
    partySize: party?.members.length ?? 0,
    look: accountsUI.raidLook ?? {},
    economy: accountsUI.economy ?? undefined,
    friendRequests: lobbyFriends.requests,
    friendsOnline: lobbyFriends.online,
    guide: guide.view(),
    spire: lobbySpire(),
  };
}
/** The Lobby's Spire card, and the Raids dot while it's new (spire-nudge.ts). */
function lobbySpire() {
  const account = accountsUI?.account?.id;
  if (!account) return null;
  return spireLobbyCard({
    spire: accountsUI.spire,
    clears: accountsUI.raidClears,
    seen: loadSpireSeen(account),
  });
}
/** Getting started (getting-started.ts): a new player's first steps. */
const guide = createGuide({
  account: () => accountsUI.account?.id,
  facts: () => {
    const journey = accountsUI.economy?.journey;
    return {
      level: journey ? playerLevel(journey.xp).level : undefined,
      cragmuffClears: accountsUI.raidClears.grumblecrag ?? 0,
      wearing:
        Object.values(accountsUI.raidLook ?? {}).some(Boolean) ||
        !!accountsUI.account?.title,
    };
  },
  go: (step) => {
    if (step === "bot") void lobbyPlay("bot-easy");
    else if (step === "raid") void accountsUI.showRaids("grumblecrag", "party");
    else if (step === "wear") void accountsUI.showWardrobe();
    else setHubScene(step);
  },
  changed: () => syncLobby(!!lobby),
  toast: (text) => toast(text),
});
function syncLobby(want: boolean) {
  if (!want) {
    if (lobby) {
      lobby.close();
      lobby = undefined;
      clearInterval(lobbyFriendsTimer);
    }
    return;
  }
  if (!lobby) {
    lobby = openLobby({
      reduced: reducedMotion,
      onAction: lobbyAction,
      onPlay: (mode) => void lobbyPlay(mode),
      onStep: stepHomeFighter,
      onKick: (id) => void kickFromParty(id),
    });
    void refreshLobbyFriends();
    lobbyFriendsTimer = setInterval(() => void refreshLobbyFriends(), 60000);
  }
  lobby.update(lobbyView());
}
/** The Bistro (migration 068): the server's restaurant, next to the Farm. */
let bistro: BistroHandle | undefined;
let bistroOwner: string | undefined;
function syncBistro(want: boolean, hub = want) {
  // Another player now (or logged out): that bistro is not theirs.
  if (bistro && bistroOwner !== accountsUI?.account?.id) {
    bistro.close();
    bistro = undefined;
  }
  if (!want) {
    if (bistro) {
      // Behind another hub tab the bistro waits, paused, as it is (guests,
      // plates, coins); out of the hub (a match) it closes.
      if (hub) bistro.hide();
      else {
        bistro.close();
        bistro = undefined;
      }
      document.body.classList.remove("hub-bistro");
      if (!document.querySelector(".lobby-layer"))
        document.body.classList.remove("hub-screen");
    }
    return;
  }
  if (bistro) {
    document.body.classList.add("hub-screen", "hub-bistro");
    bistro.show();
    return;
  }
  const code = worldCode("bistro");
  if (!code) return;
  document.body.classList.add("hub-screen", "hub-bistro");
  bistroOwner = accountsUI.account?.id;
  bistro = code.openBistro({
    owner: bistroOwner,
    api: {
      load: () => accountsUI.api("/api/bistro"),
      act: (request, actions) =>
        accountsUI.api("/api/bistro/act", { request, actions }),
      friends: async () =>
        (await accountsUI.api("/api/bistro/friends")) as BistroFriend[],
      visit: (id) =>
        accountsUI.api(`/api/bistro/visit/${encodeURIComponent(id)}`),
      visitAct: (friend, kind) =>
        accountsUI.api("/api/bistro/visit/act", {
          request: crypto.randomUUID(),
          friend,
          kind,
        }),
    },
    onLeaves: (balance) => accountsUI.setLeaves(balance),
    playerName: () => accountsUI.account?.displayName ?? "Your",
    character: () => selected,
    toast,
    sound: (cue, step) => audio.farm(cue, step),
    reduced: reducedMotion,
    low: lowGraphics(),
  });
}
/** The Farm scene (hub redesign phase 4): server state, server time. */
let farmScreen: FarmScreen | undefined;
let farmLow = false;
let farmOwner: string | undefined;
const farmLoad = async () => (await accountsUI.api("/api/farm")) as FarmState;
function syncFarm(want: boolean, hub = want) {
  const owner = accountsUI?.account?.id;
  // Another player now (or logged out): that farm is not theirs.
  if (farmScreen && farmOwner !== owner) {
    farmScreen.close();
    farmScreen = undefined;
  }
  if (!want) {
    // Behind the Lobby or the Plaza the farm waits, paused, as it is; out of
    // the hub (a match) it closes, so the battle has the device to itself.
    if (hub) farmScreen?.hide();
    else {
      farmScreen?.close();
      farmScreen = undefined;
    }
    // In the hub, the farm loads in the background (once) so it opens ready.
    if (hub && owner) prefetchFarm(owner, farmLoad);
    return;
  }
  if (farmScreen) {
    farmScreen.show();
    return;
  }
  const code = worldCode("farm");
  if (!code) return;
  farmOwner = owner;
  farmLow = lowGraphics();
  farmScreen = code.openFarmScreen({
    owner,
    reduced: reducedMotion,
    low: farmLow,
    sound: (cue, step) => audio.farm(cue, step),
    gifts: async () =>
      (await accountsUI.api("/api/farm/gifts")) as FarmGiftsState,
    giftSend: async (friend) =>
      (await accountsUI.api("/api/farm/gifts/send", {
        friend,
      })) as FarmGiftResult,
    giftOpen: async (friend) =>
      (await accountsUI.api("/api/farm/gifts/open", {
        friend,
      })) as FarmGiftResult,
    inviteLink: (code) => farmInviteUrl(location.origin, code),
    here: async (owner, emote) => {
      // In chat's Nearby channel for this farm (once per farm).
      const farm = owner ?? accountsUI.account?.id ?? null;
      if (farm && farm !== farmChatOwner) {
        farmChatOwner = farm;
        void request("chat-farm", { owner: farm }).then((r) => {
          if (!r.ok && farmChatOwner === farm) farmChatOwner = null;
          syncHub();
        });
      }
      return (await accountsUI.api("/api/farm/here", {
        ...(owner ? { owner } : {}),
        ...(emote ? { emote } : {}),
      })) as FarmHere;
    },
    gone: async () => {
      if (farmChatOwner) {
        farmChatOwner = null;
        void request("chat-farm", { owner: null });
        syncHub();
      }
      await accountsUI.api("/api/farm/gone", {});
    },
    tour: async () =>
      (await accountsUI.api("/api/farm/tour")) as FarmTourEntry[],
    like: async (owner) =>
      (await accountsUI.api("/api/farm/like", { owner })) as FarmLikeResult,
    stall: async () => (await accountsUI.api("/api/farm/stall")) as FarmStall,
    stallAct: async (action) =>
      (await accountsUI.api("/api/farm/stall", {
        request: crypto.randomUUID(),
        ...action,
      })) as FarmStallResult,
    balloon: async () =>
      (await accountsUI.api("/api/farm/balloon")) as FarmBalloon,
    balloonAct: async (kind, slot) =>
      (await accountsUI.api("/api/farm/balloon", {
        request: crypto.randomUUID(),
        kind,
        ...(slot === undefined ? {} : { slot }),
      })) as FarmBalloonResult,
    help: async () => (await accountsUI.api("/api/farm/help")) as FarmHelpList,
    helpFill: async (friend, slot) =>
      (await accountsUI.api("/api/farm/help", {
        request: crypto.randomUUID(),
        friend,
        slot,
      })) as FarmHelpResult,
    rainSound: (level) => audio.farmRainSound(level),
    load: farmLoad,
    act: async (actions) =>
      (await accountsUI.api("/api/farm/act", {
        request: crypto.randomUUID(),
        actions,
      })) as FarmActResult,
    trade: async (lots) => {
      await accountsUI.api("/api/leaves/trade", { lots });
      await accountsUI.loadEconomy();
    },
    toast,
    playerName: () => accountsUI.account?.displayName ?? "Your",
    character: () => selected,
    economy: () => accountsUI.economy ?? undefined,
    onLeaves: (balance) => accountsUI.setLeaves(balance),
    master: async (crop) =>
      (await accountsUI.api("/api/farm/master", {
        request: crypto.randomUUID(),
        crop,
      })) as Awaited<ReturnType<FarmScreenOptions["master"]>>,
    wish: async () =>
      (await accountsUI.api("/api/farm/wish", {})) as Awaited<
        ReturnType<FarmScreenOptions["wish"]>
      >,
    order: async (slot, kind) =>
      (await accountsUI.api("/api/farm/order", {
        request: crypto.randomUUID(),
        slot,
        kind,
      })) as FarmOrderResult,
    friends: async () =>
      (await accountsUI.api("/api/farm/friends")) as FarmFriend[],
    visit: async (id) =>
      (await accountsUI.api(
        `/api/farm/visit/${encodeURIComponent(id)}`,
      )) as FarmVisit,
    visitAct: async (friend, actions) =>
      (await accountsUI.api("/api/farm/visit/act", {
        request: crypto.randomUUID(),
        friend,
        actions,
      })) as FarmVisitResult,
    art: (character) =>
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        fighterAvatar(
          (Object.hasOwn(CHARACTERS, character)
            ? character
            : "voltkit") as CharacterId,
          `order-${character}`,
        ),
      ),
  });
}
/** The roster (UI remodel step 3): every fighter, and a fighter's detail. */
let rosterScreen: RosterScreen | undefined;
function openRosterScreen() {
  rosterScreen = openRoster({
    data: () => {
      const bindings = controlPrefs().bindings;
      return {
        playing: selected,
        matches: masteryMatches,
        owned: accountsUI.economy?.owned ?? [],
        looks: accountsUI.economy?.looks ?? {},
        look: accountsUI.raidLook ?? {},
        keys: {
          skills: skillLabels(bindings),
          basic: actionLabel(bindings, "basic"),
          dash: actionLabel(bindings, "dash"),
          jump: actionLabel(bindings, "jump"),
        },
      };
    },
    choose: (id) => {
      if (id === selected) return;
      selected = id;
      rememberHomeFighter(id);
      renderMenu();
      syncHub();
    },
    skins: (id) => void accountsUI.showShop("skins", id),
    onClose: () => (rosterScreen = undefined),
  });
}
/** Menu, cards and party slots on the Lobby. */
function lobbyAction(action: LobbyAction) {
  audio.unlock();
  // A screen opened from the rail replaces the one that is open (the Shop
  // and the Wardrobe are one screen and switch in place).
  if (action !== "shop" && action !== "wardrobe") openHubPanelNow()?.close();
  if (action === "fighters") openRosterScreen();
  else if (action === "more-play") homeNavigation.open("play");
  else if (action === "guide") guide.open();
  else if (action === "wardrobe") void accountsUI.showWardrobe();
  else if (action === "shop") void accountsUI.showShop();
  else if (action === "raids") void showRaidBestiary();
  else if (action === "spire")
    void accountsUI.showRaids(undefined, undefined, "climb");
  else if (action === "journey") void accountsUI.showJourney();
  else if (action === "missions") void accountsUI.showMissions();
  else if (action === "ranks") $("leaderboard").click();
  else if (action === "invite") void showPartyInvite();
  else if (action === "leave-party") void request("party-leave");
  else if (action === "party-room") void followPartyRoom(undefined, true);
  else if (action === "farm") setHubScene("farm");
  else void accountsUI.showFriends();
}
/** PLAY: the remembered mode, through the same controls as the Play panel. */
async function lobbyPlay(chosen: LobbyMode) {
  audio.unlock();
  if (!accountsUI.ensurePlayer()) return;
  if (!connected) return toast("Waiting for the server connection.");
  const size = party?.members.length ?? 0;
  const mode = partyLobbyMode(chosen, size);
  if (size > 1) {
    if (!partyLeader() && party?.room)
      return void followPartyRoom(undefined, true);
    if (!partyLeader())
      return toast(
        "Your party leader starts the game. Leave the party to play on your own.",
      );
    if (mode.startsWith("bot-") || mode === "practice")
      return toast(
        "With a party, choose a room: 1v1, 2v2, Free-for-all or Boss Raid.",
      );
    if ((mode === "duel" && size > 2) || (mode === "teams" && size > 4))
      return toast(
        `Your party has ${size} players: choose 2v2 Teams, Free-for-all or Boss Raid.`,
      );
  }
  if (mode === "raid") return void accountsUI.showRaids();
  if (mode === "practice") return document.getElementById("practice")?.click();
  if (mode.startsWith("bot-")) {
    document
      .querySelector<HTMLButtonElement>(`#menu [data-bot="${mode.slice(4)}"]`)
      ?.click();
    return document.getElementById("bot-match")?.click();
  }
  document
    .querySelector<HTMLButtonElement>(`#menu [data-mode="${mode}"]`)
    ?.click();
  document.getElementById("play-create")?.click();
}
/** The Lobby's ‹ › arrows: the previous or next fighter on the roster. */
function stepHomeFighter(direction: -1 | 1) {
  audio.unlock();
  const ids = Object.keys(CHARACTERS) as CharacterId[];
  const next =
    ids[(ids.indexOf(selected) + direction + ids.length) % ids.length];
  selected = next;
  rememberHomeFighter(next);
  renderMenu();
  syncHub();
}
/** Start a raid from the Raid Hub. */
async function startRaid(
  boss: RaidBossId,
  options: { solo?: boolean; returnTab?: RaidTab },
) {
  if (!accountsUI.ensurePlayer()) return;
  if (myId) return toast("Leave your current room first.");
  if (!connected) return toast("Waiting for the server connection.");
  if (watching) await stopWatching();
  audio.unlock();
  $<HTMLDialogElement>("dialog").close();
  settingsOpen = false;
  menuOpen = false;
  roomMode = "raid";
  const reply = await request("create", {
    name:
      accountsUI.account?.displayName ??
      localStorage.getItem("arena-name") ??
      "Player",
    mode: "raid",
    boss,
  });
  identity(reply);
  if (!reply.ok) return;
  raidRoomReturn = {
    code: reply.code!,
    boss,
    tab: options.returnTab ?? "party",
  };
  await request("select", selected);
  if (options.solo) await request("ready");
}
/**
 * Rasterize ahead the fighters the next battle will load (fighter-prepaint.ts):
 * everyone in the room, or your own pick in the menus. A battle that is on
 * stops it and takes what was painted.
 */
function syncFighterArt() {
  if (state && state.phase !== "lobby") return holdFighterPrepaint();
  const room = (state?.players ?? [])
    .filter((p) => !p.raidBoss)
    .map((p) => ({
      character: p.character,
      look: p.championLooks?.[p.character] ?? null,
    }));
  syncFighterPrepaint([
    ...room,
    {
      character: selected,
      look: accountsUI?.economy?.looks?.[selected] ?? null,
    },
  ]);
}
/** Start a Spire climb from the Raid Hub (a raid room; the server checks where it starts). */
async function startSpire(options: {
  solo?: boolean;
  returnTab?: SpireTab;
  /** The zone to climb (the server checks every climber has earned it). */
  zone?: number;
}) {
  const zone = SPIRE_ZONES[options.zone ?? 1] ? (options.zone ?? 1) : 1;
  if (!accountsUI.ensurePlayer()) return;
  if (myId) return toast("Leave your current room first.");
  if (!connected) return toast("Waiting for the server connection.");
  if (watching) await stopWatching();
  audio.unlock();
  $<HTMLDialogElement>("dialog").close();
  settingsOpen = false;
  menuOpen = false;
  roomMode = "raid";
  const reply = await request("create", {
    name:
      accountsUI.account?.displayName ??
      localStorage.getItem("arena-name") ??
      "Player",
    mode: "raid",
    spire: spireZoneStart(zone),
  });
  identity(reply);
  if (!reply.ok) return;
  raidRoomReturn = {
    code: reply.code!,
    boss: SPIRE_ZONES[zone].boss,
    tab: "party",
    spire: options.returnTab ?? "climb",
  };
  await request("select", selected);
  if (options.solo) await request("ready");
}
function renderMenu(revealSelection = false) {
  coach.stop();
  // In a raid room, the boss's atlas is painted ahead (boss-prepaint.ts).
  syncBossPrepaint(state);
  syncFighterArt();
  document.body.classList.remove("practice-active");
  audio.setTheme("lobby");
  pwa.sync();
  const p = state?.players.find((p) => p.id === myId);
  const isRoom = !!p;
  const watchingRoom = !isRoom && !!watching && state?.code === watching;
  // Everyone plays from the shared hub, so the game needs an account.
  // No hub without an account or a connection: the welcome screen instead.
  if (!isRoom && !watchingRoom && (!accountsUI?.account || !connected))
    return renderGate();
  document.body.classList.remove("gate-active");
  syncHub();
  const raidChallenge = state?.raid
    ? `${state.raid.boss}/${state.raid.peril}`
    : "";
  const key = `${isRoom ? `room-${state!.mode ?? "duel"}` : watchingRoom ? `watch-${watching}` : "home"}:${(state?.mutators ?? []).join(",")}|${raidChallenge}|${(state?.watchers ?? []).join(",")}:${state?.players
    .map(
      (p) =>
        `${p.id}${p.id === myId ? "" : p.character}${p.ready}${p.connected}${p.team ?? ""}${p.flair ?? ""}${raidLookList(identityOf(p).raidLook)}${JSON.stringify(identityOf(p).raidClears ?? {})}${Object.values(
          looksOf(p) ?? {},
        )
          .map((l) => `${l?.skin}${l?.stage}`)
          .join(",")}`,
    )
    .join(":")}:${
    accountsUI?.economy
      ? `${accountsUI.economy.journey?.xp ?? ""}/${accountsUI.economy.journey?.season.xp ?? ""}/${accountsUI.economy.balance}/${accountsUI.economy.missions.map((m) => m.progress).join(",")}/${Object.values(
          accountsUI.economy.looks,
        )
          .map((l) => `${l?.skin}${l?.stage}`)
          .join(",")}`
      : ""
  }:${selected}`;
  if (screen === key) return;
  const previous = screen;
  screen = key;
  // Only the fighter changed (a tap on a card): update in place so the page
  // under the player's finger is never torn down and the scroll stays put.
  if (
    previous &&
    !$("menu").hidden &&
    previous.slice(0, previous.lastIndexOf(":")) ===
      key.slice(0, key.lastIndexOf(":")) &&
    $("menu").querySelector(":scope > .room-screen")
  ) {
    refreshRoom();
    syncMenuCosmetic();
    syncHomePresentation();
    return;
  }
  // Keep the reader's place when the menu re-renders while already visible.
  const keepScroll = !$("menu").hidden ? scrollY : null;
  touch.reset();
  document.body.classList.remove(
    "battle-active",
    "battle-raid",
    "raid-downed",
    "pvp-knocked-out",
  );
  audio.setAmbience(null);
  const home = !isRoom && !watchingRoom;
  document.body.classList.toggle("home-active", home);
  document.body.classList.toggle("lobby-active", !home);
  // Home and lobby share a mounted shell; only returning from battle fades in.
  const arriving = $("menu").hidden;
  $("battle").hidden = true;
  syncBattleLoop();
  $("menu").hidden = false;
  $("menu").classList.remove("screen-enter");
  if (arriving) {
    void $("menu").offsetWidth;
    $("menu").classList.add("screen-enter");
  }
  const wornKey = JSON.stringify([
    accountsUI?.economy?.looks ?? {},
    accountsUI?.raidLook ?? {},
  ]);
  const wornChanged = wornKey !== lastWornKey;
  lastWornKey = wornKey;
  setWornSkins(accountsUI?.economy?.looks);
  setWornLook(accountsUI?.raidLook);
  // A room (or a room you watch): the seats beside the roster picker.
  if (!home) {
    renderRoom(watchingRoom);
    syncMenuCosmetic();
    syncHomePresentation();
    return;
  }
  // The drawer ("Join or watch" in the Lobby's mode menu) shows only what
  // the mode menu doesn't: a room code to join or watch, and your name. The
  // room types, bot levels and the practice room are the mode menu's; their
  // buttons stay here, hidden, because PLAY starts a match through them
  // (lobbyPlay) and they keep one code path for every way in.
  const panelMarkup = `<label for="name">Your display name</label><input id="name" maxlength="20" placeholder="Enter your name" value="${escape(accountsUI?.account?.displayName ?? localStorage.getItem("arena-name") ?? "")}" autocomplete="nickname"><div class="home-play-options"><section><label for="code">Room code</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Room code"><button id="join" class="secondary btn-secondary">${iconLabel("enter", "Join")}</button></div><button id="watch" class="quiet full">${iconLabel("watch", "Watch this room instead")}</button></section></div><div class="play-engine" hidden>${startRoomSection(roomMode)}<div class="bot-picker" role="radiogroup" aria-label="Bot difficulty">${BOT_LEVELS.map(([id, label, hint]) => `<button type="button" role="radio" class="bot-level${botLevel === id ? " active" : ""}" data-bot="${id}" aria-checked="${botLevel === id}"><b>${label}</b><small>${hint}</small></button>`).join("")}</div><button class="secondary btn-secondary full" id="bot-match">${iconLabel("bot", "Battle an AI bot")}</button>${accountsUI?.account ? '<button class="quiet full" id="practice">' + iconLabel("target", "Solo test mode") + "</button>" : ""}</div>`;
  updateMenuShell(
    $("menu"),
    panelMarkup,
    () => homeShell(panelMarkup),
    keepScroll !== null &&
      !wornChanged &&
      !!$("menu").querySelector(".home-screen"),
  );
  syncMenuCosmetic();
  syncHomePresentation();
  if (keepScroll !== null && Math.abs(scrollY - keepScroll) > 1)
    scrollTo(0, keepScroll);
  if (accountsUI?.account) $<HTMLInputElement>("name").readOnly = true;
  {
    const play = async (event: "create" | "join") => {
      if (!accountsUI.ensurePlayer()) return;
      if (!connected) return toast("Waiting for the server connection.");
      audio.unlock();
      const name = $<HTMLInputElement>("name").value.trim();
      localStorage.setItem("arena-name", name);
      const button = $(event === "create" ? "play-create" : event);
      (button as HTMLButtonElement).disabled = true;
      const reply = await request(
        event,
        event === "create"
          ? { name, mode: roomMode }
          : {
              name,
              code: $<HTMLInputElement>("code").value.trim().toUpperCase(),
            },
      );
      (button as HTMLButtonElement).disabled = false;
      identity(reply);
      if (reply.ok) await request("select", selected);
    };
    // Boss Raid goes through the Raid Hub, where the boss is chosen.
    $("play-create").onclick = () => {
      homeNavigation.close();
      if (roomMode === "raid") void accountsUI.showRaids();
      else void play("create");
    };
    $("join").onclick = () => void play("join");
    $("watch").onclick = () =>
      void watchRoom($<HTMLInputElement>("code").value);
    claimFarmInvite();
    // Opened from an invite link: join as soon as we're signed in and online.
    const invite = pendingInvite();
    if (invite) {
      $<HTMLInputElement>("code").value = invite;
      homeNavigation.open("play");
      if (connected && accountsUI?.account) {
        clearInvite();
        void play("join");
      } else if (!inviteHinted && accountsUI && !accountsUI.account) {
        inviteHinted = true;
        toast(`Log in to join room ${invite}. You'll go straight in.`);
      }
    }
    document.querySelectorAll<HTMLButtonElement>("[data-bot]").forEach(
      (button) =>
        (button.onclick = () => {
          botLevel = button.dataset.bot as BotLevel;
          try {
            localStorage.setItem("arena-bot-level", botLevel);
          } catch {
            /* optional */
          }
          // Update in place: no re-render, so the page keeps its scroll.
          document
            .querySelectorAll<HTMLButtonElement>("[data-bot]")
            .forEach((b) => {
              const on = b === button;
              b.classList.toggle("active", on);
              b.setAttribute("aria-checked", String(on));
            });
        }),
    );
    document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
      (button) =>
        (button.onclick = () => {
          roomMode = button.dataset.mode as RoomMode;
          try {
            localStorage.setItem("arena-room-mode", roomMode);
          } catch {
            /* optional */
          }
          // The same choice can appear in more than one list: match by value.
          document
            .querySelectorAll<HTMLButtonElement>("[data-mode]")
            .forEach((b) => {
              const on = b.dataset.mode === roomMode;
              b.classList.toggle("active", on);
              b.setAttribute("aria-checked", String(on));
            });
        }),
    );
    $("bot-match").onclick = async () => {
      if (!accountsUI.ensurePlayer()) return;
      if (!connected) return toast("Waiting for the server connection.");
      audio.unlock();
      const button = $<HTMLButtonElement>("bot-match");
      button.disabled = true;
      const name = $<HTMLInputElement>("name").value.trim() || "Trainer";
      identity(
        await request("bot-match", {
          name,
          character: selected,
          difficulty: botLevel,
        }),
      );
      button.disabled = false;
    };
    if ($("practice"))
      $("practice").onclick = async () => {
        if (!accountsUI.ensurePlayer()) return;
        if (!connected) return toast("Waiting for the server connection.");
        const button = $<HTMLButtonElement>("practice");
        button.disabled = true;
        const name = $<HTMLInputElement>("name").value.trim() || "Trainer";
        identity(await request("practice", { name, character: selected }));
        button.disabled = false;
      };
  }
}
async function leave(returnToHub = true) {
  if (watching && !myId) {
    await stopWatching();
    return;
  }
  const returnToRaidHub = returnToHub
    ? state?.raid
      ? raidRoomReturn?.code === state.code
        ? raidRoomReturn
        : {
            boss: state.raid.boss,
            tab: "party" as const,
            spire: state.raid.spire ? ("climb" as const) : undefined,
          }
      : undefined
    : undefined;
  const leftCode = state?.code;
  const reply = await request("leave", {
    token: sessionStorage.getItem("arena-token"),
  });
  if (!reply.ok) {
    toast("Could not leave the room yet. Reconnect and try again.");
    return;
  }
  // You stepped out of your party's room: you stay in the party, and the
  // Lobby offers Rejoin instead of pulling you straight back in.
  if (leftCode && party?.room?.code === leftCode && !partyLeader())
    partyRoomLeft = leftCode;
  raidRoomReturn = undefined;
  sessionStorage.removeItem("arena-token");
  lobbySelection.reset();
  savingRoomPick = "";
  lockAttempt++;
  state = undefined;
  myId = "";
  local = undefined;
  pending = [];
  owedSteps = 0;
  screen = "";
  renderMenu();
  $<HTMLDialogElement>("dialog").close();
  menuOpen = false;
  if (returnToRaidHub)
    await accountsUI.showRaids(
      returnToRaidHub.boss,
      returnToRaidHub.tab,
      returnToRaidHub.spire,
    );
}
/** The spectator bar's arrows: drawn, not the ‹ › glyphs, which some
 * phones' fonts drew tiny and off centre in the big buttons. */
const spectateArrow = (back: boolean) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${back ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}"/></svg>`;
/** What the bar last showed: rebuilt only when it changes, so a tap is
 * never lost to a button replaced under the finger. */
let spectateShown = "";
function renderPvpSpectator() {
  const banner = $("spectate");
  const target = state && pvpSpectator.target(state, myId);
  banner.classList.toggle("pvp-spectator", !!target);
  banner.hidden = !target;
  if (!state || !target) {
    spectateShown = "";
    return;
  }
  const candidates = pvpSpectator.candidates(state, myId);
  const alive = state.players.filter((p) => p.hp > 0 && !p.out).length;
  const off = candidates.length < 2 ? " disabled" : "";
  const markup = `<button type="button" data-spectate-step="-1" aria-label="Watch previous survivor"${off}>${spectateArrow(true)}</button><span class="spectator-copy"><small>Knocked out · ${alive} still fighting</small><b>Watching ${escape(target.name)}</b></span><button type="button" data-spectate-step="1" aria-label="Watch next survivor"${off}>${spectateArrow(false)}</button>`;
  if (spectateShown === markup && banner.querySelector(".spectator-copy"))
    return;
  spectateShown = markup;
  banner.innerHTML = markup;
  banner
    .querySelectorAll<HTMLButtonElement>("[data-spectate-step]")
    .forEach((button) => {
      button.onclick = () => {
        if (!state) return;
        pvpSpectator.cycle(state, myId, Number(button.dataset.spectateStep));
        renderPvpSpectator();
      };
    });
}

/** The first match's coach (battle-coach.ts), over the court. */
const coach = createCoach({
  host: () => document.querySelector<HTMLElement>("#battle .arena-frame"),
  keys: () => ({
    touch: touch.enabled,
    move: moveText(),
    basic: keyText("basic"),
    skills: skillsText(),
    dash: keyText("dash"),
  }),
});
/** The room the coach was last decided for (once per room). */
let coachRoom = "";
/**
 * A new player's match against a bot, while Getting started still has it
 * to do: the coach runs until the match ends.
 */
function syncCoach() {
  const live =
    !!state &&
    !!myId &&
    !!state.vsBot &&
    state.phase !== "lobby" &&
    state.phase !== "finished";
  if (!live) {
    if (coach.running) coach.stop();
    return;
  }
  if (coach.running || coachRoom === state!.code) return;
  coachRoom = state!.code;
  const g = guide.view();
  if (g.active && !g.done.bot) coach.start();
}
function renderBattle() {
  document.body.classList.remove("home-active", "lobby-active", "gate-active");
  if (!state?.practice) document.body.classList.remove("practice-active");
  syncHub();
  if (state) audio.setTheme(battleMusic(state, myId), state.raid?.phase ?? 1);
  if (!document.body.classList.contains("battle-active")) {
    document.body.classList.add("battle-active");
    // The battle screen fits the window; drop any scroll left over from the menu.
    scrollTo(0, 0);
    requestAnimationFrame(() => {
      touch.resize();
      fitRenderer();
    });
  }
  // Watching: see the match from the first player's side, with no controls.
  const me =
    state?.players.find((p) => p.id === myId) ??
    (watching && state?.code === watching ? state.players[0] : undefined);
  if (!state || !me) return;
  syncCoach();
  setHudStyle(
    document.body,
    "--element",
    `#${CHARACTERS[me.character].color.toString(16).padStart(6, "0")}`,
  );
  document.body.classList.toggle("battle-raid", !!state.raid);
  if (!state.raid) document.body.classList.remove("raid-downed");
  document.body.classList.toggle("spectating", !myId && !!watching);
  const knockedOut = !state.raid && !state.practice && (me.hp <= 0 || !!me.out);
  document.body.classList.toggle("pvp-knocked-out", knockedOut);
  if (!knockedOut) $("spectate").classList.remove("pvp-spectator");
  queueMicrotask(refreshControlLabels);
  const hudOrder = isTeams()
    ? [
        ...state.players.filter((p) => teamOf(p) === teamOf(me)),
        ...state.players.filter((p) => teamOf(p) !== teamOf(me)),
      ]
    : isFfa()
      ? [me, ...state.players.filter((p) => p !== me)]
      : state.raid?.spire
        ? // A climb's Echoes come and go: the cards are the climbers'.
          state.players.filter((p) => !p.echo)
        : state.players;
  // PvP shows one score badge (names, rounds, the clock): health is over
  // each fighter, and no one sees an opponent's ultimate (owner, 7 Nov
  // 2026). Raids and Practice keep the full cards.
  const badge = !state.raid && !state.practice;
  const key = `battle:${me.character}:${!!state.practice}:${badge}:${state.mode ?? "duel"}:${hudOrder.map((p) => p.id + p.character).join(",")}`;
  if (screen !== key) {
    screen = key;
    $("menu").hidden = true;
    $("battle").hidden = false;
    ensureBattleRenderer();
    syncBattleLoop();
    fitRenderer();
    $("practice-controls").hidden = !state.practice;
    // Solo test mode keeps its only leave action inside the Practice panel.
    document.body.classList.toggle("practice-active", !!state.practice);
    if (state.practice) {
      $("practice-controls").innerHTML =
        `<details id="practice-settings" class="practice-settings"><summary>Practice</summary><div class="practice-panel"><div class="practice-heading"><span class="eyebrow">Solo test mode</span><span id="practice-stats"></span><button type="button" class="quiet" id="practice-close" aria-label="Close Practice">×</button></div><div class="practice-actions"><label>Creature <select id="practice-character">${Object.values(
          CHARACTERS,
        )
          .map(
            (c) =>
              `<option value="${c.id}" ${me.character === c.id ? "selected" : ""}>${c.name}</option>`,
          )
          .join(
            "",
          )}</select></label><label><input id="practice-unlimited" type="checkbox"> No skill cooldowns</label><label><input id="practice-attacks" type="checkbox"> Target attacks</label><button class="secondary btn-secondary" id="practice-reset">${iconLabel("again", "Reset arena")}</button><button class="quiet leave-button" id="practice-exit">${iconLabel("leave", "Exit test mode")}</button></div><p>Target respawns automatically. Enable attacks to test counters, clones and jumping over ground fire. Hover a skill for its description.</p></div></details>`;
      $("practice-settings").addEventListener("toggle", () => {
        if (($("practice-settings") as HTMLDetailsElement).open) stopControls();
      });
      $("practice-close").onclick = () => {
        ($("practice-settings") as HTMLDetailsElement).open = false;
      };
      $("practice-character").onchange = () =>
        void request(
          "practice-character",
          $<HTMLSelectElement>("practice-character").value,
        );
      const options = () =>
        void request("practice-options", {
          unlimitedCooldowns: $<HTMLInputElement>("practice-unlimited").checked,
          targetAttacks: $<HTMLInputElement>("practice-attacks").checked,
        });
      $("practice-unlimited").onchange = options;
      $("practice-attacks").onchange = options;
      $("practice-reset").onclick = () => void request("practice-reset");
      $("practice-exit").onclick = () => void leave();
    }
    const split = isTeams() || isFfa() ? 2 : 1;
    $("hud").classList.toggle("hud-teams", isTeams() || isFfa());
    $("hud").classList.toggle("hud-ffa", isFfa());
    const timerWrap =
      '<div class="timer-wrap"><span id="round-label"></span><strong id="timer">03:00</strong><span id="phase-label"></span></div>';
    const card = (p: Fighter, i: number) =>
      `<div class="health-card ${i >= split ? "right" : ""}${isTeams() ? ` team-${teamOf(p)}${p.id === myId ? " me" : ""}` : isFfa() && p.id === myId ? " me" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16)}"><div><b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}</span><strong id="score-${i}"></strong></div><div class="health-track"><span id="health-${i}"></span></div><small id="health-text-${i}"></small><small id="status-${i}"></small><div class="hud-ultimate" title="Ultimate charge"><span>ULT <b id="ult-text-${i}"></b></span><div class="hud-ultimate-track" role="meter" aria-label="${escape(p.name)} ultimate charge" aria-valuemin="0" aria-valuemax="100"><i id="ult-meter-${i}"></i></div></div></div>`;
    const cards = hudOrder.map(card);
    // The badge holds each side in a group of the same width, so the clock
    // sits in the middle whatever the names' lengths.
    $("hud").innerHTML = badge
      ? `<div class="hud-side">${cards.slice(0, split).join("")}</div>${timerWrap}<div class="hud-side right">${cards.slice(split).join("")}</div>`
      : cards.map((c, i) => (i === split ? timerWrap : "") + c).join("") +
        (cards.length <= split ? timerWrap : "");
    battleHudSize.disconnect();
    battleHudSize.observe($("hud"));
    battleHudSize.observe($("phase-label"));
    // The arena's size too: the badge's place in it follows.
    battleHudSize.observe($("game").parentElement!);
    const c = CHARACTERS[me.character];
    $("abilities").innerHTML =
      `<div class="basic-hint" title="${c.basic.name}: ${c.basic.description} No cooldown · ${Math.round(basicInterval(c, false, state?.mode, state?.players.length) * 1000)} ms between attacks."><kbd data-action="basic">${keyText("basic")}</kbd><span>${abilityIcon(c.basic.name)}<small>${c.basic.name.toUpperCase()}</small></span></div>${c.skills.map((a, i) => `<div class="ability" id="ability-${i}" style="--element:#${c.color.toString(16)}"><kbd data-action="${SKILL_ACTIONS[i]}">${keyText(SKILL_ACTIONS[i])}</kbd><span>${abilityIcon(a.name)}<small id="cooldown-${i}">READY</small></span><i class="cooldown-fill" id="fill-${i}"></i><i class="skill-cooldown-ring" aria-hidden="true"></i></div>`).join("")}<div class="movement-ability"><kbd data-action="dash">${keyText("dash")}</kbd><span>Dash<small id="dash-cd"></small></span></div><div class="movement-ability"><kbd data-action="jump">${keyText("jump")}</kbd><span>Jump<small id="jump-cd"></small></span></div>`;
  }
  document.body.classList.toggle("pvp-badge", badge);
  $("hud").classList.toggle("hud-badge", badge);
  hudOrder.forEach((p, i) => {
    // 2v2 has its own health per champion (TEAM_TUNING).
    const full = maxHealth(p.character, state!.mode, state!.players.length);
    setHudStyle(
      $(`health-${i}`),
      "width",
      `${(100 * Math.max(0, p.hp)) / full}%`,
    );
    setHudText(
      $(`health-text-${i}`),
      p.out ? "LEFT THE MATCH" : `${Math.ceil(Math.max(0, p.hp))} / ${full} HP`,
    );
    setHudText(
      $(`score-${i}`),
      state!.practice
        ? p.id === myId
          ? "TRAINER"
          : "TARGET"
        : badge
          ? String(
              isTeams()
                ? (state!.teamScores?.[teamOf(p)] ?? 0)
                : (state!.scores[p.id] ?? 0),
            )
          : isTeams()
            ? `${state!.teamScores?.[teamOf(p)] ?? 0} / ${roundsNeeded(state!.mutators)}`
            : `${state!.scores[p.id]} / ${roundsNeeded(state!.mutators)}`,
    );
    const charge = Math.min(
      100,
      Math.max(0, (100 * (p.ult ?? 0)) / RULES.ultMax),
    );
    setHudText(
      $(`ult-text-${i}`),
      charge >= 100 ? "READY" : `${Math.floor(charge)}%`,
    );
    setHudStyle($(`ult-meter-${i}`), "width", `${charge}%`);
    setHudAttribute(
      $(`ult-meter-${i}`).parentElement!,
      "aria-valuenow",
      String(Math.floor(charge)),
    );
    $(`ult-meter-${i}`)
      .closest(".hud-ultimate")
      ?.classList.toggle("is-ready", charge >= 100);
    setHudText(
      $(`status-${i}`),
      p.statuses
        .map((s) =>
          s.kind === "sleep"
            ? `SLEEP +${Math.round((STATUS_RULES.sleepVulnerability - 1) * 100)}% DMG`
            : s.kind === "shell"
              ? `SHELL −${Math.round((1 - STATUS_RULES.shellReduction) * 100)}% DMG`
              : s.kind === "mark"
                ? comboOf(s.by).toUpperCase()
                : s.kind === "warp"
                  ? "TIME SLOWED"
                  : s.kind === "leash"
                    ? "PINNED"
                    : s.kind === "blind"
                      ? "BLINDED"
                      : s.kind === "taunt"
                        ? "TAUNTED"
                        : s.kind === "brace"
                          ? "BRACED"
                          : s.kind === "clamp"
                            ? "CHARGED"
                            : s.kind === "cage"
                              ? "CAGED"
                              : s.kind === "current"
                                ? "SWEPT AWAY"
                                : s.kind === "float"
                                  ? "FLOATING"
                                  : s.kind === "confuse"
                                    ? "CONFUSED"
                                    : s.kind.toUpperCase(),
        )
        .join(" · "),
    );
  });
  // Blinded by Ink Jet: ink splashes over your view while it lasts.
  document.body.classList.toggle(
    "is-blinded",
    me.statuses.some((s) => s.kind === "blind" && s.until > state!.time),
  );
  if (state.practice) {
    setHudText(
      $("practice-stats"),
      `Damage dealt: ${Math.round(me.stats.dealt)} · Damage taken: ${Math.round(me.stats.received)} · Skills used: ${me.stats.skills}`,
    );
    $<HTMLInputElement>("practice-unlimited").checked =
      state.practice.unlimitedCooldowns;
    $<HTMLInputElement>("practice-attacks").checked =
      state.practice.targetAttacks;
  }
  setHudText(
    $("round-label"),
    state.practice
      ? "FREE PRACTICE"
      : badge
        ? `R${state.round} · BO${roundsNeeded(state.mutators) * 2 - 1}`
        : `ROUND ${state.round} · BEST OF ${roundsNeeded(state.mutators) * 2 - 1}`,
  );
  setHudText(
    $("network"),
    `${state.raid?.spire ? "The Spire" : state.raid ? "Raid" : (state.arena ?? "classic") === "classic" ? "Coliseum" : ARENAS[state.arena!].name} · ${state.practice ? "Practice" : state.raid?.spire ? `Floor ${state.raid.spire.floor}` : state.raid ? "Boss fight" : "Online match"}`,
  );
  const seconds = Math.ceil(state.remaining);
  setHudText(
    $("timer"),
    state.practice
      ? "∞"
      : state.overtime
        ? "OVERTIME"
        : `${Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`,
  );
  const phaseText =
    state.phase === "playing"
      ? state.practice
        ? "TEST YOUR SKILLS"
        : state.banked
          ? rushLabel(me)
          : state.crown
            ? crownLabel(me)
            : ringRadius(state.remaining, state.overtime) !== null
              ? "RING CLOSING · STAY INSIDE"
              : `LIVE · ${ARENAS[state.arena ?? "classic"].name.toUpperCase()}`
      : state.phase.toUpperCase();
  setHudText($("phase-label"), phaseText);
  // The badge says only what changes the fight (ring, overtime, a rule).
  const quietPhase =
    badge && state.phase === "playing" && phaseText.startsWith("LIVE ·");
  if ($("phase-label").hidden !== quietPhase)
    $("phase-label").hidden = quietPhase;
  $("timer").classList.toggle(
    "ring-on",
    !state.practice &&
      state.phase === "playing" &&
      ringRadius(state.remaining, state.overtime) !== null,
  );
  // Sound/state feedback is shared by both control layouts. Only the hidden
  // desktop button's decoration is omitted on touch screens.
  const fullMeter = (me.ult ?? 0) >= RULES.ultMax;
  if (fullMeter && !ultWasReady && state.phase === "playing" && myId) {
    audio.play("orb");
    if (!touch.enabled) {
      const button = $(`ability-${ULT_SLOT}`);
      button.classList.add("ult-burst");
      setTimeout(() => button.classList.remove("ult-burst"), 650);
    }
  }
  ultWasReady = fullMeter;
  if (!touch.enabled) {
    kitOf(me.character, me.rites).skills.forEach((a, i) => {
      setHudAttribute(
        $(`ability-${i}`),
        "title",
        `${a.name}: ${a.description}`,
      );
      setHudAttribute(
        $(`ability-${i}`),
        "aria-label",
        `${a.name}: ${a.description}`,
      );
      if (i === ULT_SLOT) {
        // The ultimate fills a meter by fighting instead of a cooldown.
        const charge = Math.floor(me.ult ?? 0),
          ready = skillReady(
            me,
            i,
            state!.time,
            !!state!.practice?.unlimitedCooldowns,
          );
        const armed = exArmedUntil > performance.now();
        const exReady = !ready && charge >= EX.cost && !state!.practice;
        setHudText(
          $(`cooldown-${i}`),
          ready
            ? "READY"
            : armed
              ? "EX ARMED"
              : exReady
                ? `${charge}% · EX`
                : `${charge}%`,
        );
        setHudStyle($(`fill-${i}`), "height", `${ready ? 0 : 100 - charge}%`);
        setHudStyle(
          $(`ability-${i}`),
          "--cooldown",
          `${ready ? 0 : 100 - charge}%`,
        );
        $(`ability-${i}`).classList.toggle("cooling", !ready);
        $(`ability-${i}`).classList.toggle("ult-ready", ready);
        $(`ability-${i}`).classList.toggle("ex-ready", exReady && !armed);
        setHudAttribute(
          $(`ability-${i}`),
          "title",
          ready
            ? `${a.name}: ${a.description}`
            : `${a.name}: ${a.description} Press it before the meter is full to arm an EX skill (costs ${EX.cost}% of the meter): your next skill hits ${Math.round((EX.damage - 1) * 100)}% harder and ${Math.round((EX.radius - 1) * 100)}% wider.`,
        );
        return;
      }
      $(`ability-${i}`).classList.toggle(
        "ex-armed",
        exArmedUntil > performance.now(),
      );
      const left = cooldownLeft(me, i, state!.time);
      setHudText(
        $(`cooldown-${i}`),
        left > 0 ? `${left.toFixed(1)}s` : "READY",
      );
      setHudStyle(
        $(`fill-${i}`),
        "height",
        `${(100 * left) / (a.cooldown * cooldownScale())}%`,
      );
      setHudStyle(
        $(`ability-${i}`),
        "--cooldown",
        `${Math.min(100, (100 * left) / (a.cooldown * cooldownScale()))}%`,
      );
      $(`ability-${i}`).classList.toggle("cooling", left > 0);
    });
    setHudText(
      $("dash-cd"),
      me.dashAt > state.time
        ? `${(me.dashAt - state.time).toFixed(1)}s`
        : "READY",
    );
    setHudText(
      $("jump-cd"),
      me.jumpAt > state.time
        ? `${(me.jumpAt - state.time).toFixed(1)}s`
        : "READY",
    );
  }
  touch.update(
    state.phase === "playing" && connected && !!myId && !knockedOut,
    CHARACTERS[me.character].skills.map((a) => a.name),
    me.cooldowns.map((_, i) => cooldownLeft(me, i, state!.time)),
    Math.max(0, me.dashAt - state.time),
    Math.max(0, me.jumpAt - state.time),
    kitOf(me.character, me.rites).skills.map(
      (a) => a.cooldown * cooldownScale(),
    ),
    {
      name: CHARACTERS[me.character].basic.name,
      left: Math.max(0, me.basicAt - state.time),
      duration: CHARACTERS[me.character].basic.interval ?? 0.3,
    },
    state.practice?.unlimitedCooldowns ? RULES.ultMax : (me.ult ?? 0),
    state.practice ? Infinity : EX.cost,
    exArmedUntil > performance.now(),
  );
  if (state.raid && myId) {
    renderRaidUI(
      state,
      me,
      request,
      async () => {
        const progress = (await accountsUI.api(
          "/api/raids",
        )) as import("../../../packages/shared/src/raid").RaidProgress;
        // Frame stars follow the new clear count straight away.
        accountsUI.raidClears = bossClears(progress);
        accountsUI.syncAvatar();
        const fresh = takeNewRewards(accountsUI.account?.id, progress);
        // Let the victory screen land, then turn the new cards over.
        if (fresh.length) {
          const champion = me.character;
          setTimeout(
            () =>
              void showRewardReveal(fresh, champion, document.body, (r) =>
                accountsUI.wearLook(r.slot as RaidSlot, r.id),
              ),
            1800,
          );
        }
        return progress;
      },
      accountsUI.economy?.journey,
    );
    const raidHud = document.getElementById("raid-hud");
    if (raidHud && raidHud !== measuredRaidHud) {
      if (measuredRaidHud) battleHudSize.unobserve(measuredRaidHud);
      measuredRaidHud = raidHud;
      battleHudSize.observe(raidHud);
    }
    if (me.hp <= 0)
      document
        .querySelectorAll<HTMLButtonElement>(".touch-buttons button")
        .forEach((b) => (b.disabled = true));
    const exit = document.getElementById("raid-exit");
    if (exit) exit.onclick = () => void leave();
    return;
  }
  const overlay = $("arena-overlay");
  if (!myId && watching) {
    renderWatchOverlay(overlay);
    return;
  }
  if (state.phase === "playing") {
    // Its own element: a non-empty overlay dims the whole screen on phones.
    setOverlayMarkup(overlay, "");
    renderPvpSpectator();
    overlay.style.pointerEvents = "none";
  } else {
    $("spectate").hidden = true;
    overlay.style.pointerEvents = "auto";
    let heading = "",
      details = "",
      actions = "";
    if (state.phase === "briefing") {
      heading = "How to play";
      const confirmed = state.instructionsReady.includes(myId);
      // Who's fighting whom (you first), each dressed as their Wardrobe
      // shows: the fighter skin, else their Colors; no element aura, as in
      // the roster and the Lobby.
      const vsArt = (p: Fighter) => {
        const skin = skinOf(p, p.character);
        const palette = skin ? "" : (identityOf(p).raidLook?.skin ?? "");
        const art = fighterArt(p.character, undefined, skin);
        return palette ? colourPreview(art, palette) : art;
      };
      const card = (p: Fighter) =>
        `<div class="vs-fighter${p.id === myId ? " me" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16).padStart(6, "0")}">${scopeIds(vsArt(p), `vs${state!.players.indexOf(p)}`)}<b>${escape(p.name)}${p.id === myId ? " <small>(you)</small>" : ""}</b><span>${CHARACTERS[p.character].name} · ${CHARACTERS[p.character].element}</span></div>`;
      const mine = (p: Fighter) => teamOf(p) === teamOf(me);
      const side = (list: Fighter[]) =>
        list.sort((a, b) => Number(b.id === myId) - Number(a.id === myId));
      const versus = isTeams()
        ? `<div class="briefing-versus teams"><div class="vs-team team-${teamOf(me)}">${side(state.players.filter(mine)).map(card).join("")}</div><span class="vs-mark">VS</span><div class="vs-team team-${1 - teamOf(me)}">${state.players
            .filter((p) => !mine(p))
            .map(card)
            .join("")}</div></div>`
        : `<div class="briefing-versus${isFfa() ? " ffa" : ""}">${side([
            ...state.players,
          ])
            .map(card)
            .join('<span class="vs-mark">VS</span>')}</div>`;
      // Short on purpose (owner, 5 Nov 2026): who, the goal, the arena if
      // it has something to dodge, the keys. The HUD and the fighters'
      // panels hold the rest.
      const arena = ARENAS[state.arena ?? "classic"];
      const event = state.arcade ? ARCADE_EVENTS[state.arcade.id] : undefined;
      const rounds = roundsNeeded(state.mutators);
      const goal = isTeams()
        ? `Stay side by side: +${Math.round((TEAMUP.damage - 1) * 100)}% damage · First team to ${rounds} rounds`
        : isFfa()
          ? `Last one standing takes the round · First to ${rounds}`
          : `First to win ${rounds} rounds`;
      const place = event
        ? `<p class="brief-arena"><b>${escape(event.name)}</b>${escape(event.tip)} · No rating change</p>`
        : arena.hazards.length
          ? `<p class="brief-arena"><b>${escape(arena.name)}</b>${escape(arena.tip)}</p>`
          : `<p class="brief-arena"><b>${escape(arena.name)}</b></p>`;
      details =
        versus +
        `<p class="brief-goal">${menuIcon("leaderboard")}<span>${goal}</span></p>` +
        teamUpNote(me) +
        place +
        briefKeys() +
        '<p class="mobile-howto">Joystick to move · aim follows your nearest foe</p>' +
        partyRulesNote();
      // Ready only once this device has the arena: the countdown starts when
      // everyone is ready, so a slow phone would otherwise miss the start.
      const loading = arenaLoading(state);
      actions = `<button class="primary btn-primary" id="instructions-ready" ${confirmed || loading ? "disabled" : ""}>${confirmed ? "Waiting for the others…" : loading ? "Loading the arena…" : "I’m ready"}</button>`;
    }
    if (state.phase === "countdown") {
      heading = LIVE_COUNTDOWN;
      details = "Get ready. Make your move.";
    }
    if (state.phase === "intermission") {
      heading = isTeams()
        ? state.roundWinnerTeam === null || state.roundWinnerTeam === undefined
          ? "Round drawn"
          : state.roundWinnerTeam === teamOf(me)
            ? "Your team takes the round"
            : `${TEAM_LABELS[state.roundWinnerTeam]} team takes the round`
        : state.roundWinner
          ? `${escape(state.players.find((p) => p.id === state!.roundWinner)!.name)} takes the round`
          : "Round drawn";
      const rites = riteMarkup(me, Math.ceil(state.remaining));
      details = rites.body;
      actions = rites.actions;
    }
    if (state.phase === "paused") {
      heading = isTeams() ? "A player disconnected" : "Opponent disconnected";
      details = `Match suspended · reconnect grace ${LIVE_SECONDS}`;
    }
    if (state.phase === "finished") {
      const won = isTeams()
        ? state.winnerTeam === teamOf(me)
        : state.winner === myId;
      heading = won
        ? isFfa()
          ? "Last one standing. Victory!"
          : "Victory. Well played."
        : isFfa() && state.winner
          ? `${escape(state.players.find((p) => p.id === state!.winner)?.name ?? "A rival")} takes the free-for-all`
          : "A worthy fight.";
      // Scoreline: your side on the left, always.
      const score = (left: string, a: number, b: number, right: string) =>
        `<div class="result-score"><span>${left}</span><b>${a}</b><i>–</i><b>${b}</b><span>${right}</span></div>`;
      const rival = state.players.find((p) => p.id !== myId);
      details = isFfa()
        ? standingsMarkup(state, myId)
        : isTeams()
          ? score(
              `${TEAM_LABELS[teamOf(me)]} team`,
              state.teamScores?.[teamOf(me)] ?? 0,
              state.teamScores?.[1 - teamOf(me)] ?? 0,
              `${TEAM_LABELS[1 - teamOf(me)]} team`,
            )
          : score(
              "You",
              state.scores[me.id] ?? 0,
              rival ? (state.scores[rival.id] ?? 0) : 0,
              escape(rival?.name ?? "Opponent"),
            );
      details +=
        recapMarkup(state, myId) +
        recordsMarkup(
          state.matchId && !state.arcade
            ? matchRecords.get(state.matchId)
            : undefined,
          friendIds,
        );
      details += resultXp(
        accountsUI.economy?.journey,
        state.matchId ? `match:${state.matchId}` : undefined,
        state.activityStatus,
        state.activityEligible?.includes(myId) ?? true,
      );
      if (state.arcade)
        details +=
          '<p class="arcade-rating-note">Weekly arcade · XP and mission progress · PvP rating stays separate.</p>';
      // A finished match against a bot: Getting started's first step.
      if (state.vsBot) guide.mark("bot");
      actions = `<div class="result-actions"><button class="primary btn-primary" id="rematch">${me.ready ? "Waiting for opponent…" : iconLabel("again", "Rematch")}</button><button class="secondary btn-secondary" id="share-result">${iconLabel("share", "Share result")}</button><button class="secondary btn-secondary${state.vsBot ? " leave-button" : ""}" id="return">${state.vsBot ? iconLabel("home", "Back to menu") : iconLabel("back", "Return to lobby")}</button></div>`;
    }
    const markup = `<div class="overlay-card${actions ? " action-overlay" : state.phase === "countdown" ? " countdown-card" : ""}"><span class="eyebrow">Element Arena</span><h2>${heading}</h2><div${actions ? ' class="panel-scroll" tabindex="0" role="region" aria-label="Match details"' : ""}>${details}</div>${actions ? `<div class="panel-actions">${actions}</div>` : ""}</div>`;
    // Preserve the pressed button and native scrolling between snapshots.
    setOverlayMarkup(
      overlay,
      markup,
      actions
        ? `${state.code}:${state.matchId ?? ""}:${state.phase}${state.phase === "briefing" && arenaLoading(state) ? ":loading" : ""}`
        : undefined,
    );
    fillLiveSeconds(
      overlay,
      state.phase === "paused" ? state.pauseRemaining : state.remaining,
    );
    if (state.phase === "countdown")
      fillLiveCountdown(overlay, state.remaining);
    if (state.phase === "briefing")
      $("instructions-ready").onclick = () => {
        // Phones: go fullscreen and turn sideways where the browser allows it.
        if (touch.enabled) void fullscreenLandscape();
        void request("instructions-ready");
      };
    if (state.phase === "finished") {
      $("rematch").onclick = () => void request("rematch");
      document
        .querySelectorAll<HTMLButtonElement>("[data-add-friend]")
        .forEach((b) => {
          b.onclick = () => {
            b.disabled = true;
            void accountsUI.friendRequest({ playerId: b.dataset.addFriend });
          };
        });
      $("share-result").onclick = () => {
        if (!state) return;
        void shareResult(
          state,
          myId,
          import.meta.env.VITE_SITE_URL || location.origin,
        ).then((how) =>
          toast(
            how === "downloaded"
              ? "Result card saved, and the message copied for pasting."
              : how === "failed"
                ? "Couldn’t make the result card on this browser."
                : "Shared.",
          ),
        );
      };
      // A bot room has no lobby to return to: go back to the menu.
      $("return").onclick = () =>
        void (state?.vsBot ? leave() : request("lobby"));
    }
  }
}
socket.on("connect", () => {
  if (replacedAccount) {
    socket.disconnect();
    return;
  }
  connected = true;
  // Tell the server what this browser saw when it last dropped (once).
  const dropReport = connectionWatch.reconnected();
  if (dropReport) socket.emit("connection-report", dropReport);
  // Reconnected while watching: take the ringside seat again.
  if (watching && !myId)
    void request("watch", { code: watching }).then((reply) => {
      if (!reply.ok) void stopWatching(reply.error ?? "The room closed.");
    });
  // Invite link opened before the connection was up: try joining now.
  if (pendingInvite() && !myId && !sessionStorage.getItem("arena-token")) {
    screen = "";
    renderMenu();
  }
  if (!myId && !watching && !state) {
    screen = "";
    renderMenu();
  }
  syncHub();
  $("connection").textContent = "SERVER CONNECTED";
  $("connection").classList.add("online");
  const token = sessionStorage.getItem("arena-token");
  if (token)
    void request("resume", { token }).then((reply) => {
      if (reply.ok) identity(reply);
      else {
        sessionStorage.removeItem("arena-token");
        lobbySelection.reset();
        state = undefined;
        myId = "";
        screen = "";
        renderMenu();
      }
    });
});
socket.on("disconnect", (reason: string) => {
  const drop = connectionWatch.dropped({
    reason,
    transport: socket.io.engine?.transport?.name ?? "unknown",
    hiddenNow: document.hidden,
    offlineNow: !navigator.onLine,
    // Only drops from inside a room are worth reporting to the server.
    report: reason !== "io client disconnect" && !replacedAccount && !!myId,
  });
  lobbySelection.reset();
  connected = false;
  if (!myId && !watching && !state) {
    screen = "";
    renderMenu();
  }
  $("connection").textContent = replacedAccount
    ? "SESSION PAUSED"
    : "RECONNECTING…";
  $("connection").classList.remove("online");
  pending = [];
  owedSteps = 0;
  const message = dropMessage(drop);
  if (message && !replacedAccount) toast(message);
});
socket.on("session-replaced", () => {
  replacedAccount =
    accountsUI.session?.user.id ?? accountsUI.account?.id ?? "paused";
  sessionStorage.setItem("arena-session-replaced", replacedAccount);
  // Stop inputs, stale snapshots, room reservations and automatic rejoining.
  socket.disconnect();
  sessionStorage.removeItem("arena-token");
  roomInvites.clear();
  lobbySelection.reset();
  savingRoomPick = "";
  lockAttempt++;
  state = undefined;
  myId = watching = "";
  local = undefined;
  pending = [];
  owedSteps = 0;
  remoteFrames.clear();
  timeline.clear();
  shotTimeline.clear();
  touch.reset();
  document
    .querySelectorAll<HTMLDialogElement>("dialog[open]")
    .forEach((panel) => panel.close());
  screen = "";
  renderMenu();
});
socket.on(
  "connect_error",
  (error: Error & { data?: { code?: string; status?: number } }) => {
    if (replacedAccount) return;
    $("connection").classList.remove("online");
    if (error.data?.code === "ACCOUNT_ERROR") {
      // An expired login: get a fresh token (onToken connects with it). Only
      // a second refusal soon after says something is really wrong.
      if (error.data.status === 401 && renewLogin()) return;
      toast(error.message);
      $("connection").textContent =
        error.data.status === 401 ? "LOGIN REQUIRED" : "SIGN-IN UNAVAILABLE";
    } else {
      // Socket.IO retries temporary transport failures. During sign-in these
      // are not evidence that the account login failed.
      $("connection").textContent = "RECONNECTING…";
    }
  },
);
socket.on("account-changed", () => void accountsUI.refresh());
// Coins, missions or Awakening changed after a match or raid.
socket.on("economy-changed", () => void accountsUI.loadEconomy());
socket.on("room-invite", (data: unknown) => roomInvites.receive(data));
socket.on("party", (data: unknown) => {
  const parsed = partyStateSchema.safeParse(data);
  if (!parsed.success) return;
  const was = party?.members.length ?? 0;
  const before = new Set(party?.members.map((m) => m.id) ?? []);
  party = parsed.data;
  if (!party) {
    partyRoomSent = partyRoomLeft = partyRoomFollowed = "";
  } else {
    // A friend who joined isn't "invited" any more.
    for (const m of party.members) roomInvitesSent.delete(m.id);
    // The leader opened a new room: you are no longer out of the last one.
    if (party.room?.code !== partyRoomLeft && party.room) partyRoomLeft = "";
    // The lead passed to you (the leader left): your room is the party's.
    if (partyLeader()) partyRoomSent = "";
  }
  const joined = party?.members.find((m) => !before.has(m.id));
  if (party && joined && was > 0 && joined.id !== accountsUI.account?.id)
    toast(`${joined.name} joined your party.`);
  syncHub();
  accountsUI.refreshRaids();
  invitesChanged();
});
socket.on("party-kicked", (data: unknown) => {
  const parsed = partyKickedSchema.safeParse(data);
  toast(
    parsed.success
      ? `${parsed.data.by} removed you from the party.`
      : "You were removed from the party.",
  );
});
socket.on("invite-declined", (data: unknown) => {
  const parsed = inviteDeclinedSchema.safeParse(data);
  if (!parsed.success) return;
  roomInvitesSent.delete(parsed.data.playerId);
  toast(`${parsed.data.name} declined your invitation.`);
  invitesChanged();
});
// In-game chat (docs/chat-plan.md).
socket.on("chat", (line: ChatLine) => {
  chat.receive(line);
  // In a battle: a bubble over the speaker, and the feed under the button.
  if (line.channel === "room" && line.fighter && state) {
    const speaker = state.players.find((p) => p.id === line.fighter);
    const me = state.players.find((p) => p.id === myId);
    const plate = document.querySelector<HTMLElement>(
      `.battle-nameplate[data-fighter="${CSS.escape(line.fighter)}"]`,
    );
    battleChat.receive(
      line.quick ? quickText(line.quick) : (line.text ?? ""),
      line.from.name,
      plate,
      !!state.raid || (!!speaker && !!me && teamOf(speaker) === teamOf(me)),
      !!line.quick && quickKind(line.quick) === "emote",
    );
  }
  // Nearby lines pop over the speaker's head. On the Plaza the server
  // already pops its own emotes through the Plaza's state.
  if (line.channel !== "place") return;
  const text = line.quick ? quickText(line.quick) : (line.text ?? "");
  if (hubScene === "plaza") {
    if (!(line.quick && (PLAZA_EMOTES as readonly string[]).includes(text)))
      plaza?.say(line.from.id, text);
  } else if (hubScene === "farm") farmScreen?.say(line.from.id, text);
});
socket.on("chat-config", (data: { freeText?: unknown } | null) => {
  chat.setFreeText(data?.freeText === true);
  // Friends' messages that came while you were away (a dot on the chat).
  const me = accountsUI?.account;
  if (me && !me.guest)
    void request("chat-unread", {}, true).then((reply) => {
      const unread = (reply as { unread?: unknown }).unread;
      if (reply.ok && unread && typeof unread === "object")
        chat.setUnread(unread as Record<string, number>);
    });
});
socket.on("party-room", (data: unknown) => {
  const parsed = partyRoomSchema.safeParse(data);
  if (!parsed.success || !party) return;
  void followPartyRoom(parsed.data);
});
socket.on("friends-changed", () => {
  if (accountsUI.friendsOpen) void accountsUI.loadFriends();
  else
    void accountsUI.checkFriendRequests().then((list) => {
      if (list) friendIds = new Set(list.friends.map((f) => f.id));
    });
});
socket.on("watch-ended", ({ reason }: { reason?: string }) => {
  if (watching) void stopWatching(reason ?? "The room closed.");
});
socket.on("token-expired", () => {
  // The server's copy of our login expired: send the current one, refreshing
  // it first if the browser's copy has also run out.
  const token = accountsUI.session?.access_token;
  const expires = accountsUI.session?.expires_at ?? 0;
  if (token && expires * 1000 > Date.now() + 30_000)
    socket.emit("token", { token });
  else void accountsUI.client?.auth.refreshSession();
});
/**
 * Ask Supabase for a fresh token after the server refused an expired one;
 * its refresh reaches onToken, which reconnects. At most once in 30 s, so a
 * login that can't be renewed is reported instead of retried forever.
 */
let loginRenewedAt = 0;
function renewLogin() {
  const auth = accountsUI.client?.auth;
  if (!auth || !accountsUI.session || Date.now() - loginRenewedAt < 30_000)
    return false;
  loginRenewedAt = Date.now();
  void auth.refreshSession().catch(() => {
    /* Signed out: the gate asks for a login. */
  });
  return true;
}
socket.on("access-revoked", ({ error }: { error: string }) => {
  sessionStorage.removeItem("arena-token");
  lobbySelection.reset();
  savingRoomPick = "";
  lockAttempt++;
  state = undefined;
  myId = "";
  local = undefined;
  pending = [];
  owedSteps = 0;
  screen = "";
  renderMenu();
  toast(error);
  // Reconnects too (onSession); a refused expired token is then renewed.
  void accountsUI.refresh();
});
socket.on("state", (snapshot: WireSnapshot) => {
  if (replacedAccount) return;
  const spectator = !myId && !!watching;
  // A stale room (we left it) can still send a last snapshot: ignore it.
  if (spectator && snapshot.code !== watching) return;
  if (state?.phase !== snapshot.phase || state?.round !== snapshot.round) {
    remoteFrames.clear();
    timeline.clear();
    shotTimeline.clear();
  }
  const previous = state;
  if (snapshot.raid?.boss) prefetchRaidArena(snapshot.raid.boss);
  // No rite choice mid-fight: at each new chapter the rites grow a step.
  if (
    snapshot.raid &&
    previous?.raid &&
    previous.code === snapshot.code &&
    snapshot.raid.phase > previous.raid.phase &&
    (snapshot.raid.rites[myId ?? ""] ?? []).length
  )
    toast(`Chapter ${snapshot.raid.phase} · your rites grow stronger`);
  if (
    snapshot.phase === "lobby" &&
    (previous?.phase !== "lobby" || previous.code !== snapshot.code)
  ) {
    savingRoomPick = "";
    lockAttempt++;
  }
  state = unpackSnapshot(snapshot, snapshotMeta);
  if (
    snapshot.metaRev !== undefined &&
    !snapshotMeta.current(snapshot.code, snapshot.metaRev)
  )
    recoverSnapshotMeta(snapshot.code, snapshot.metaRev);
  scene?.observeSnapshot(state, previous);
  pwa.sync();
  const receivedAt = performance.now();
  remoteFrames.add(state, receivedAt);
  netMeter.snapshot(receivedAt, state.phase === "playing" && !document.hidden);
  const me = state.players.find((p) => p.id === myId);
  if (!me) {
    timeline.snapshot(0, receivedAt);
    if (!spectator) return;
    for (const event of state.events)
      if (event.id > eventId) {
        if (scene && state.phase !== "lobby") scene.effect(event);
        eventId = Math.max(eventId, event.id);
      }
    if (state.phase === "lobby") renderMenu();
    else renderBattle();
    return;
  }
  selected = lobbySelection.reconcile(me.character, state.phase === "lobby");
  if (state.phase === "lobby") syncFlair(me);
  seq = Math.max(seq, me.ack);
  pending = pending.filter((i) => i.seq > me.ack);
  if (me.hp <= 0 || me.out) {
    pending = [];
    owedSteps = 0;
    if (previous?.players.some((p) => p.id === myId && p.hp > 0 && !p.out)) {
      stopControls();
      exArmedUntil = 0;
    }
  }
  // Where your fighter was predicted to be, to measure how far this
  // snapshot moves it (a correction you see as a jerk).
  const predicted =
    local &&
    previous?.code === state.code &&
    previous.round === state.round &&
    state.phase === "playing" &&
    me.hp > 0
      ? { x: local.x, y: local.y }
      : undefined;
  // Late inputs the server will fold into one tick take no step of their
  // own (serverSteps, Fighter.owed).
  owedSteps = me.owed ?? 0;
  const steps = serverSteps(pending, owedSteps);
  timeline.snapshot(steps.length, receivedAt);
  local = structuredClone(me);
  carryCurrent(local, state.time);
  for (const [i, input] of steps.entries())
    predict(local, input, state.time + (i + 1) / RULES.tick);
  if (predicted)
    netMeter.correction(
      Math.hypot(local.x - predicted.x, local.y - predicted.y),
      correctionCause(
        me,
        previous?.players.find((p) => p.id === myId),
        state.events.filter((e) => e.id > eventId),
        state.time,
      ).cause,
    );
  for (const event of state.events)
    if (event.id > eventId) {
      if (scene && state.phase !== "lobby") scene.effect(event);
      if (
        event.kind === "hit" &&
        event.target === myId &&
        state.phase === "playing"
      )
        measureHitGap(event);
      eventId = Math.max(eventId, event.id);
    }
  if (
    state.phase === "finished" &&
    state.matchId &&
    !state.practice &&
    !state.arcade
  )
    void reportMatch(state.matchId);
  syncBossPrepaint(state);
  syncFighterArt();
  if (state.phase === "lobby") renderMenu();
  else renderBattle();
});
/** Wear your best mastery tier for the fighter you've picked (lobby only). */
let flairSent = "";
function syncFlair(me: Fighter) {
  const tier = masteryTier(masteryMatches(me.character))?.name ?? null;
  const key = `${state?.code}:${me.character}:${tier}`;
  if ((me.flair ?? null) === tier || flairSent === key) return;
  flairSent = key;
  void request("flair", { tier });
}
/** Your friends' account ids (to skip "Add friend" on the result card). */
let friendIds = new Set<string>();
/** Fighter mastery badges on the roster: matches you've played with each. */
let masteryFor = "";
function loadMastery(force = false) {
  const id = accountsUI?.account?.id ?? "";
  if (!id) {
    if (masteryFor) setMastery({});
    masteryFor = "";
    return;
  }
  if (id === masteryFor && !force) return;
  // First load for this account: mention any waiting friend requests.
  if (id !== masteryFor)
    void accountsUI.checkFriendRequests().then((list) => {
      if (list) friendIds = new Set(list.friends.map((f) => f.id));
    });
  masteryFor = id;
  void accountsUI
    .api("/api/progress")
    .then((value) => {
      setMastery(progressSchema.parse(value).fighters);
      rosterScreen?.refresh();
      const me = state?.players.find((p) => p.id === myId);
      if (me && state?.phase === "lobby") syncFlair(me);
      if (!state || state.phase === "lobby") {
        screen = "";
        renderMenu();
      }
    })
    .catch(() => {
      // Records not set up yet (migration 004): no badges.
    });
}
/** Records for finished matches, by match id (reported once each). */
const matchRecords = new Map<string, RecordState>();
/**
 * Save a finished match to your records. A match counts once every player's
 * game has saved it, so if ours was first, check again shortly.
 */
async function reportMatch(matchId: string, attempt = 0) {
  if (!accountsUI.account) return;
  if (attempt === 0) {
    if (matchRecords.has(matchId)) return;
    matchRecords.set(matchId, { status: "pending" });
  }
  try {
    const reply = matchReportReplySchema.parse(
      await accountsUI.api("/api/matches/report", { matchId }),
    );
    const before = matchRecords.get(matchId);
    const seen =
      before?.status === "done" ? before.reply.achievements : ([] as string[]);
    matchRecords.set(matchId, { status: "done", reply });
    if (
      reply.confirmed &&
      !(before?.status === "done" && before.reply.confirmed)
    )
      loadMastery(true);
    for (const name of reply.achievements)
      if (!seen.includes(name))
        toast(`Achievement unlocked: ${name}. Its title is yours to wear.`);
    // Rank up: say so once, when the rating change first arrives.
    const rating = reply.rating;
    const wasRated =
      before?.status === "done" && before.reply.rating?.before !== undefined;
    if (
      rating?.before !== undefined &&
      !wasRated &&
      rating.rank !== "Unranked" &&
      rating.previousRank !== rating.rank &&
      RANKS.findIndex((r) => r.name === rating.rank) >
        RANKS.findIndex((r) => r.name === rating.previousRank)
    )
      toast(`Rank up! You're now ${rating.rank}. The title is yours to keep.`);
    if (!reply.confirmed && attempt < 3)
      setTimeout(
        () => {
          if (state?.matchId === matchId)
            void reportMatch(matchId, attempt + 1);
        },
        3000 + attempt * 3000,
      );
  } catch (error) {
    matchRecords.set(matchId, {
      status: "unavailable",
      message:
        error instanceof Error && /database needs an update/.test(error.message)
          ? "Match records switch on once the database update (migration 004) has been run."
          : "Couldn’t save this match to your records.",
    });
  }
  if (state?.phase === "finished") renderBattle();
}
function predict(p: Fighter, input: Input, time: number) {
  predictFighter(p, input, time, !!state?.raid);
}

function dialog(html: string) {
  menuOpen = true;
  // Pin the page before showModal moves focus, rather than after its mutation.
  setScrollLock(true);
  setDialogContent($<HTMLDialogElement>("dialog"), html);
  // Switching screens inside an open dialog (Settings → Controls) keeps it open.
  if (!$<HTMLDialogElement>("dialog").open)
    $<HTMLDialogElement>("dialog").showModal();
  $("close-dialog").onclick = () => {
    $<HTMLDialogElement>("dialog").close();
    settingsOpen = false;
    menuOpen = false;
  };
}
/**
 * The Settings leave button. Outlined red normally; bolder, with what it
 * costs, while a match is actually under way.
 */
function leaveButton() {
  if (state?.practice) return "";
  const live =
    !!state &&
    !state.practice &&
    ["briefing", "countdown", "playing", "intermission", "paused"].includes(
      state.phase,
    );
  if (!live)
    return `<button id="exit-room" class="secondary btn-secondary leave-button">${iconLabel("leave", "Leave room")}</button>`;
  if (state!.raid) {
    const others = state!.players.filter(
      (p) => isRaider(p) && !p.out && p.id !== myId,
    ).length;
    return `<button id="exit-room" class="secondary btn-secondary leave-button is-costly"><span>${buttonIcon("leave")}Leave raid</span><small>${others ? "Your team carries on without you" : "Ends this run"}</small></button>`;
  }
  return `<button id="exit-room" class="secondary btn-secondary leave-button is-costly"><span>${buttonIcon("leave")}Leave match</span><small>Counts as a forfeit</small></button>`;
}
/** Settings → Graphics: Auto, High or Low for the Plaza and the Farm (graphics-quality.ts). */
function graphicsCard() {
  const setting = graphicsSetting();
  const option = (value: GraphicsSetting, label: string) =>
    `<button type="button" role="radio" data-graphics="${value}" aria-checked="${setting === value}">${label}</button>`;
  return `<section class="prefs-card prefs-graphics" aria-labelledby="prefs-graphics"><h3 id="prefs-graphics">${menuIcon("sparkle")}Graphics</h3><div class="prefs-choice" role="radiogroup" aria-labelledby="prefs-graphics">${option("auto", "Auto")}${option("high", "High")}${option("low", "Low")}</div><p class="prefs-graphics-note">${graphicsNote(setting)}</p>${softwareRendering() ? GPU_OFF_NOTE : ""}</section>`;
}
/** Shown when the browser draws without the graphics card (gpu-check.ts). */
const GPU_OFF_NOTE =
  '<p class="prefs-gpu-off" role="note"><b>This browser is not using the graphics card</b>, so the game is drawn by the processor and can lag on any setting. In Edge: Settings → System and performance → turn on “Use graphics acceleration when available”, then restart Edge (in Chrome: Settings → System). If it is already on, the computer’s graphics driver may need an update.</p>';
function graphicsNote(setting: GraphicsSetting) {
  if (setting === "high")
    return "The living Plaza and Farm: animals, night glow and full weather, sharp on high-resolution screens.";
  if (setting === "low")
    return "A lighter Plaza and Farm at 30 fps for older phones: no animals or night glow, lighter rain. Battles keep every attack, telegraph and skill but draw fewer decorative sparks.";
  return autoChoosesLow()
    ? `Auto picked <b>Low</b> for the Plaza and Farm on this device (${softwareRendering() ? "it draws without a graphics card" : autoLowWhy() ? `the ${escape(autoLowWhy())}` : "they ran slowly"}). Battles adapt on their own. Pick High to try it again.`
    : "Starts on High. The Plaza and Farm switch to Low if they run slowly; battles trim decorative sparks only while frames stay slow.";
}
/** Five taps on Graphics' title within 3 s: the frame-rate line over every
 *  screen and the battle read-out, on this device (perf-hud.ts,
 *  perf-overlay.ts).
 *  A tool to screenshot when something lags (the iPhone app has no address
 *  bar for `?perf=1`), so it adds no row to Settings, which fits a phone
 *  held sideways without scrolling. */
let perfTaps: number[] = [];
function bindGraphicsCard() {
  const title = document.querySelector<HTMLElement>("#prefs-graphics");
  if (title)
    title.onclick = () => {
      const now = performance.now();
      perfTaps = [...perfTaps.filter((t) => now - t < 3000), now];
      if (perfTaps.length < 5) return;
      perfTaps = [];
      const on = !perfMode();
      setPerfMode(on);
      toast(on ? "Frame rate read-out on" : "Frame rate read-out off");
      syncPerfHud();
    };
  for (const b of Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-graphics]"),
  ))
    b.onclick = () => {
      const value = b.dataset.graphics as GraphicsSetting;
      setGraphicsSetting(value);
      syncUiEffects();
      // The Lobby's fighters follow at once (lobby-screen.ts).
      document.dispatchEvent(new Event("ea-graphics-change"));
      // Picking Auto again measures battles afresh too.
      if (value === "auto") battleQuality.reset(resetBattleQuality);
      for (const other of Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-graphics]"),
      ))
        other.setAttribute("aria-checked", String(other === b));
      const note = document.querySelector(".prefs-graphics-note");
      if (note) note.innerHTML = graphicsNote(value);
      // The Plaza behind the dialog reloads at the new quality.
      if (plaza && plazaLow !== lowGraphics()) {
        wantedPlazaClosed = true;
        plaza.close();
        wantedPlazaClosed = false;
        syncHub();
      }
      // So does the Farm.
      if (farmScreen && farmLow !== lowGraphics()) {
        farmScreen.close();
        farmScreen = undefined;
        syncHub();
      }
    };
}
/** A labelled slider with its value shown as a percentage beside the label. */
function prefSlider(
  id: string,
  label: string,
  value: number,
  range: { min: number; max: number; step: number },
) {
  return `<label class="prefs-slider"><span class="prefs-slider-label">${label}</span><output for="${id}" data-pref-for="${id}">${Math.round(value * 100)}%</output><input type="range" id="${id}" min="${range.min}" max="${range.max}" step="${range.step}" value="${value}"></label>`;
}
/** Keep every slider's percentage in step with its knob. */
function syncPrefOutputs(root: ParentNode) {
  for (const out of Array.from(
    root.querySelectorAll<HTMLOutputElement>("output[data-pref-for]"),
  )) {
    const input = document.getElementById(
      out.dataset.prefFor!,
    ) as HTMLInputElement | null;
    if (input) out.value = `${Math.round(Number(input.value) * 100)}%`;
  }
}
const syncDialogPrefs = () => syncPrefOutputs($<HTMLDialogElement>("dialog"));
function showSettings() {
  settingsOpen = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  dialog(
    `<div class="settings-screen"><h2>Settings</h2>${state?.practice && touch.enabled ? `<div class="settings-quick-actions"><button id="settings-practice" class="secondary btn-secondary">${iconLabel("target", "Practice")}</button></div>` : ""}<p class="prefs-note">Online matches keep running while this is open.</p><div class="prefs-grid${state ? "" : isNativeApp() ? " has-graphics" : " has-display has-graphics"}"><section class="prefs-card" aria-labelledby="prefs-sound"><h3 id="prefs-sound">${menuIcon("sound")}Sound</h3>${prefSlider("music", "Music", audio.music, { min: 0, max: 1, step: 0.01 })}${prefSlider("effects", "Sound effects", audio.effects, { min: 0, max: 1, step: 0.01 })}</section><section class="prefs-card" aria-labelledby="prefs-motion"><h3 id="prefs-motion">${menuIcon("motion")}Motion</h3><p class="prefs-status"><b class="${reduced ? "is-on" : ""}">Reduced motion ${reduced ? "on" : "off"}</b><span>Follows your device's accessibility setting.</span></p></section>${state ? "" : isNativeApp() ? graphicsCard() + appIconCardHTML() : displayCard() + graphicsCard()}</div><div class="settings-actions"><button id="open-controls" class="secondary btn-secondary">${iconLabel("keyboard", "Controls &amp; key bindings")}</button>${myId ? leaveButton() : watching ? `<button id="exit-room" class="secondary btn-secondary leave-button">${iconLabel("stop-watching", "Stop watching")}</button>` : ""}<button id="settings-report" class="quiet">${iconLabel("report", "Report a problem")}</button><button id="settings-credits" class="quiet">${iconLabel("star", "Credits")}</button></div></div>`,
  );
  bindGraphicsCard();
  void bindAppIconCard(toast);
  for (const kind of ["music", "effects"] as const)
    $(kind).oninput = () => {
      audio.unlock();
      audio.set(kind, Number($<HTMLInputElement>(kind).value));
    };
  const box = $<HTMLDialogElement>("dialog");
  // Same function each time, so reopening Settings doesn't stack listeners.
  box.addEventListener("input", syncDialogPrefs);
  const practice = document.getElementById("settings-practice");
  if (practice)
    practice.onclick = () => {
      $<HTMLDialogElement>("dialog").close();
      settingsOpen = false;
      ($("practice-settings") as HTMLDetailsElement).open = true;
    };
  bindDisplayCard();
  $("open-controls").onclick = showControls;
  $("settings-report").onclick = () => accountsUI.showReport(reportContext());
  $("settings-credits").onclick = showCredits;
  const exitRoom = $("exit-room");
  if (exitRoom) exitRoom.onclick = () => void leave();
}
/**
 * Settings → Display: full screen on and off (where the browser allows it).
 * Not in the iPhone app, which is always full screen: App icon takes its place.
 */
const fullscreenSupported = () =>
  !!document.documentElement.requestFullscreen &&
  document.fullscreenEnabled !== false;
function displayCard() {
  const on = !!document.fullscreenElement;
  return `<section class="prefs-card prefs-display" aria-labelledby="prefs-display"><h3 id="prefs-display">${menuIcon("fullscreen")}Display</h3><div class="prefs-toggle-row"><span><b>Full screen</b><small>${fullscreenSupported() ? "Hide the browser's bars while you play." : "On iPhone, add the game to your Home Screen to play full screen."}</small></span><button type="button" class="prefs-switch" id="settings-fullscreen" role="switch" aria-checked="${on}" ${fullscreenSupported() ? "" : "disabled"}><span>${on ? "On" : "Off"}</span></button></div></section>`;
}
function syncDisplayCard() {
  const button = document.getElementById("settings-fullscreen");
  if (!button) return;
  const on = !!document.fullscreenElement;
  button.setAttribute("aria-checked", String(on));
  button.querySelector("span")!.textContent = on ? "On" : "Off";
}
document.addEventListener("fullscreenchange", syncDisplayCard);
function bindDisplayCard() {
  const button = document.getElementById("settings-fullscreen");
  if (!button) return;
  button.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("Full screen isn't available in this browser.");
    }
    syncDisplayCard();
  };
}
/** Who and what made the game (opened from Settings, with a way back). */
function showCredits() {
  dialog(
    `<div class="credits-screen"><button type="button" class="quiet" id="credits-back">${iconLabel("back", "Settings")}</button><h2>Credits</h2><div class="credits-hero"><span class="credits-crest" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="credits-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#credits-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><div><b>Element Arena</b><small>Real-time creature duels from Elemental Plaza.</small></div></div><div class="credits-grid"><section class="prefs-card"><h3>${menuIcon("user")}Creatures &amp; world</h3><p>Eight original creatures, each an articulated shaded-vector rig with front, back and side views, plus the Plaza, the Farm and the coliseum.</p></section><section class="prefs-card"><h3>${menuIcon("sound")}Music</h3><p>Original music played on instrument recordings from the <a href="https://github.com/sgossner/VCSL" target="_blank" rel="noopener noreferrer">Versilian Community Sample Library</a> and <a href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noopener noreferrer">VSCO 2 Community Edition</a> (CC0 public domain).</p></section><section class="prefs-card"><h3>${menuIcon("keyboard")}Built with</h3><ul class="credits-tags">${["Phaser", "Socket.IO", "Express", "TypeScript", "Vite", "Supabase"].map((t) => `<li>${t}</li>`).join("")}</ul></section></div></div>`,
  );
  $("credits-back").onclick = showSettings;
}
/** Settings → Controls (see controls-screen.ts). */
function showControls() {
  settingsOpen = true;
  showControlsScreen({
    open: dialog,
    box: $<HTMLDialogElement>("dialog"),
    onBack: showSettings,
    padConnected: !!firstPad(),
    // Touch controls live here (Settings keeps room for Graphics).
    touch: touch.available
      ? {
          html: touch.settingsHTML(),
          bind() {
            touch.bindSettings();
            const box = $<HTMLDialogElement>("dialog");
            // Same function each time, so reopening doesn't stack listeners.
            box.addEventListener("input", syncDialogPrefs);
            // Reset sets the knobs directly (no input event), so refresh after it.
            document
              .getElementById("control-reset")
              ?.addEventListener("click", () =>
                setTimeout(() => syncPrefOutputs(box)),
              );
          },
        }
      : undefined,
  });
}
$("mobile-settings").onclick = showSettings;
$("settings").onclick = showSettings;
$("battle-menu").onclick = showSettings;
/** Details attached to problem reports so admins can reproduce them. */
function reportContext(): Record<string, string> {
  const me = state?.players.find((p) => p.id === myId);
  const context: Record<string, string> = {
    screen: state && state.phase !== "lobby" ? "match" : "lobby",
    page: location.pathname.slice(0, 100),
    device: `${touch.enabled ? "touch" : "keyboard"} · ${innerWidth}x${innerHeight}`,
    browser: navigator.userAgent.slice(0, 300),
  };
  if (state) {
    context.room = state.code.slice(0, 12);
    context.phase = state.phase;
    if (state.practice) context.mode = "solo practice";
  }
  if (me) context.fighter = CHARACTERS[me.character].name;
  return context;
}
$("report-problem").onclick = () => accountsUI.showReport(reportContext());
$("privacy-policy").onclick = () => {
  headerMenu.open = false;
  window.open(PRIVACY_URL, "_blank", "noopener");
};
$("leaderboard").onclick = () => void accountsUI.showLeaderboard();
// In the hub the header's log-out button is folded into this menu.
$("menu-logout").onclick = () => {
  headerMenu.open = false;
  document.getElementById("account-logout")?.click();
};
$("guide-open").onclick = () => {
  $<HTMLDetailsElement>("header-menu").open = false;
  if (!accountsUI.ensurePlayer()) return;
  if (myId) return toast("Finish or leave this room first.");
  guide.reopen();
};
$("help").onclick = () =>
  dialog(
    `<div class="help-screen"><div class="eyebrow">How to play</div><h2>Welcome to Elemental Plaza.</h2><p>Press <b>PLAY</b> in the Lobby to start a match. Switch between the Lobby, the Plaza and your Farm at the top of the screen. In battle, win three rounds to take the match.</p><div class="eyebrow help-battle-eyebrow">In battle</div><div class="help-layout"><section class="help-controls" aria-label="Game controls">${controlsList(true)}</section>${illustratedHelp()}</div></div>`,
  );
$<HTMLDialogElement>("dialog").addEventListener("close", () => {
  settingsOpen = false;
  menuOpen = false;
});
document.addEventListener("keydown", (e) => {
  if (
    e.code === "Escape" &&
    state &&
    state.phase !== "lobby" &&
    !$<HTMLDialogElement>("dialog").open
  ) {
    e.preventDefault();
    showSettings();
  }
});
renderMenu();

/** A fighter's rig mid-attack (a basic or skill pose); no rig, no attack. */
const attacking = (rig: FighterVisual | undefined) =>
  !!rig &&
  (rig.controller.state === "basic" ||
    rig.controller.state.startsWith("skill"));
/**
 * ArenaScene's base until Phaser has loaded (phaser-runtime.ts), which then
 * puts Phaser.Scene in its place: `super` is looked up when it runs, and no
 * scene exists before a battle, by when Phaser is here.
 */
class SceneUntilPhaser {}
let Ph!: typeof Phaser;
whenPhaser((lib) => {
  Ph = lib;
  Object.setPrototypeOf(ArenaScene, lib.Scene);
  Object.setPrototypeOf(ArenaScene.prototype, lib.Scene.prototype);
});
class ArenaScene extends (SceneUntilPhaser as unknown as typeof Phaser.Scene) {
  graphics!: Phaser.GameObjects.Graphics;
  /** A raid boss, sorted with the fighters by where it stands. */
  bossGraphics!: Phaser.GameObjects.Graphics;
  /** Standing raid scenery and multi-bodied bosses (see LayerAt). */
  layers = new Map<string, Phaser.GameObjects.Graphics>();
  layersUsed = new Set<string>();
  layerAt: LayerAt = (key, groundY) => {
    let layer = this.layers.get(key);
    if (!layer) {
      layer = battleCurves(this.add.graphics());
      this.layers.set(key, layer);
    }
    if (!this.layersUsed.has(key)) {
      layer.clear();
      this.layersUsed.add(key);
    }
    return layer.setDepth(fighterDepth(groundY));
  };
  /** World point the local fighter is aiming at (for the skill preview). */
  aimPoint = { x: 800, y: 450 };
  /** Presentation clock (ms): pauses during hit-stop; rigs and auras use it. */
  feelClock = 0;
  /** performance.now() until which fighters freeze (hit-stop). */
  stopUntil = 0;
  /** Fighter id → performance.now() until which it flashes white. */
  flashUntil = new Map<string, number>();
  comboShown = new Map<string, number>();
  floor?: Phaser.GameObjects.Image;
  /** The floor on show: an arena id, or "court-<id>" for the duel courts. */
  floorArena: string = "classic";
  floorScale = new Map<string, number>();
  /**
   * Each duel court's stone blocks, as pictures that sort with the fighters
   * by where they stand (so you can be in front of or behind one). The
   * Shifting Ruins centre block is flagged so it can rise and sink.
   */
  courtBlocks = new Map<
    CourtId,
    {
      img: Phaser.GameObjects.Image;
      o: { x: number; y: number; w: number; h: number };
      shifting?: boolean;
    }[]
  >();
  activeCourt?: CourtId;
  /** What lies beyond each court's back edge, shown above it (world y < 0). */
  stands = new Map<CourtId, Phaser.GameObjects.Image>();
  courtAprons = new Map<CourtId, Phaser.GameObjects.Image>();
  /** Grumblecrag's raid plays on the Coliseum court (no stands strip). */
  courtRaid = false;
  /** Its pillars, shadows, rubble and crumbles (raid-grumble-pillars-rig.ts). */
  pillarRig?: PillarRig;
  /** Shared floor textures continue into dim, non-playable scenery around the court. */
  raidSurround: Phaser.GameObjects.Image[] = [];
  /** The Spire's court: sky, cover, stairs and number (spire-court-rig.ts). */
  spireRig?: SpireCourtRig;
  /** The Spire floor on show, and the next one already painted. */
  spireView?: SpireCourtView;
  spirePrepared = "";
  /** Bake an arena's floor once (2x on dense screens); returns its texture key. */
  floorTexture(id: string) {
    const key = `arena-floor-${id}`;
    // The illustrated version, once its picture has arrived (see below).
    if (this.textures.exists(`${key}:art`)) return `${key}:art`;
    const bake = floorBake();
    if (!this.textures.exists(key)) {
      this.floorScale.set(key, bake);
      const bare = id.endsWith("-bare");
      const court = id.startsWith("court-")
        ? id.slice(6).replace(/-bare$/, "")
        : "";
      if (isCourt(court)) {
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = RULES.height * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintCourtFloor(ctx, court, bare);
        addCanvasTexture(this.textures, key, canvas);
      } else if (isSpireFloorId(id)) {
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = RULES.height * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintSpireFloorId(ctx, id);
        addCanvasTexture(this.textures, key, canvas);
      } else if (isIllustratedRaidFloor(id) || isSpireSummitFloorId(id)) {
        // The Spire's boss floor: its raid's court with the summit grade.
        const summit = isSpireSummitFloorId(id) ? spireSummitArt(id) : null;
        const picture: IllustratedRaidFloor = summit
          ? summit.picture
          : (id as IllustratedRaidFloor);
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = RULES.height * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        if (isRaidFloor(picture)) paintRaidFloor(ctx, picture);
        else paintCourtFloor(ctx, "classic", true);
        summit?.grade(ctx);
        addCanvasTexture(this.textures, key, canvas);
        loadRaidArenaArt(picture, (image) => {
          if (!this.textures?.exists(key)) return;
          ctx.save();
          ctx.setTransform(bake, 0, 0, bake, 0, 0);
          paintIllustratedRaidFloor(ctx, picture, image);
          summit?.grade(ctx);
          ctx.restore();
          canvas.dataset.raidArtwork = id;
          // A new texture rather than re-uploading the old one in place: on
          // some phones the in-place update never showed, and the whole first
          // fight stayed on the stand-in floor (the next fight, painted
          // already, was fine). Whatever shows the stand-in switches over.
          const art = `${key}:art`;
          if (!this.textures.exists(art))
            addCanvasTexture(this.textures, art, canvas);
          this.floorScale.set(art, bake);
          for (const img of [this.floor, ...this.raidSurround])
            if (img?.texture.key === key) img.setTexture(art);
          if (this.floor?.texture.key === art) this.floor.setScale(1 / bake);
          for (const img of this.raidSurround) img.setDisplaySize(1600, 900);
        });
      } else {
        const g = this.make.graphics({}, false);
        paintArenaFloor(scaledPainter(g, bake), ARENAS[id as ArenaId]);
        generateGraphicsTexture(
          g,
          key,
          RULES.width * bake,
          RULES.height * bake,
        );
        g.destroy();
      }
    }
    return key;
  }
  /**
   * Drop a floor no picture shows any more (the stand-in "classic" floor
   * baked when the scene starts, or the last arena's): each is a full-court
   * canvas plus its GPU copy, 13–23 MB apiece, which a phone can't spare.
   * It is baked again if that arena comes back.
   */
  private releaseFloor(key: string) {
    if (!key.startsWith("arena-floor-")) return;
    // A raid floor's illustrated copy (":art") shares the stand-in's canvas:
    // both go, and only when no picture shows either.
    const base = key.replace(/:art$/, "");
    const keys = [base, `${base}:art`];
    const shown = [this.floor, ...this.raidSurround].some(
      (img) => !!img && keys.includes(img.texture.key),
    );
    if (shown) return;
    for (const k of keys) {
      if (!this.textures.exists(k)) continue;
      const source = this.textures.get(k).getSourceImage();
      this.textures.remove(k);
      this.floorScale.delete(k);
      // Give WebKit the canvas memory back now, not at some later collection.
      if (source instanceof HTMLCanvasElement) source.width = source.height = 0;
    }
  }
  /** Bake and place a court's blocks (once per court). */
  private ensureBlocks(id: CourtId) {
    if (this.courtBlocks.has(id)) return this.courtBlocks.get(id)!;
    const bake = floorBake();
    const list = courtBlocks(id).map((o) => ({ o, shifting: false }));
    if (id === "shifting-ruins")
      list.push({ o: SHIFTING_BLOCK, shifting: true });
    const made = list.map(({ o, shifting }, i) => {
      const frame = courtBlockFrame(o),
        key = `court-block-${id}-${i}`;
      if (!this.textures.exists(key)) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(frame.w * bake);
        canvas.height = Math.ceil(frame.h * bake);
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintCourtBlock(ctx, o, i, id);
        addCanvasTexture(this.textures, key, canvas);
      }
      const img = this.add
        .image(frame.x, frame.y, key)
        .setOrigin(0)
        .setScale(1 / bake)
        // Sorts by its front edge, in the same band as the fighters (see fighterDepth).
        .setDepth(fighterDepth(o.y + o.h))
        .setVisible(false);
      return { img, o, shifting };
    });
    this.courtBlocks.set(id, made);
    return made;
  }
  /** Duels play on the painted courts; raids keep their own floors. */
  showArena(arena: ArenaId, raid: boolean, spire?: SpireCourtView) {
    // The Spire's wave and elite floors have their own court; its boss
    // floor keeps the raid's (with the summit grade and the Spire's sky).
    const spireCourt = spire && spire.kind !== "boss" ? spire : undefined;
    // Every raid but Grumblecrag's brings its own arena; its pillars are the
    // Coliseum's blocks, so it fights on that court.
    const court =
      !spireCourt && isCourt(arena) && (!raid || arena === "classic")
        ? arena
        : undefined;
    const id = spire
      ? `spire-${spire.zone}-${spire.floor}-${spire.kind}`
      : court
        ? `court-${court}${raid ? ":raid" : ""}`
        : `${arena}${raid ? ":raid" : ""}`;
    if (id === this.floorArena || !this.floor) return;
    this.floorArena = id;
    this.spireView = spire;
    this.activeCourt = court;
    this.courtRaid = !!court && raid;
    const standsOn = !!court && !raid;
    const label = document.querySelector<HTMLElement>(".map-label");
    if (label) {
      label.hidden = !!court || !!spire;
      label.innerHTML =
        arena === "cloud-deck"
          ? "CLOUD DECK <span>SNOOZAKU’S DREAM</span>"
          : `${ARENAS[arena].name.toUpperCase()} <span>ELEMENT ARENA</span>`;
    }
    const key = this.floorTexture(
      spireCourt
        ? spireFloorId(spireCourt)
        : spire && (this.courtRaid || hasSpireSummitArena(arena))
          ? spireSummitFloorOf(arena)
          : this.courtRaid
            ? "raid-coliseum"
            : court
              ? `court-${court}`
              : arena,
    );
    const previous = this.floor.texture.key;
    this.floor
      .setTexture(key)
      .setScale(1 / (this.floorScale.get(key) ?? 1))
      // The Spire's platform takes the light of its height.
      .setTint(
        spireCourt
          ? spireFloorTint(spireCourt.floor, spireCourt.zone)
          : 0xffffff,
      );
    this.releaseFloor(previous);
    // Round the Spire's courts: its sky, not the raid's dimmed floor.
    if (spire) this.spireRig ??= new SpireCourtRig(this, fighterDepth);
    this.spireRig?.show(spire);
    if (raid && !spire && !this.raidSurround.length) {
      for (const x of [-1600, 0, 1600])
        for (const y of [-900, 0, 900]) {
          if (!x && !y) continue;
          this.raidSurround.push(
            this.add
              .image(x, y, key)
              .setOrigin(0)
              .setFlipX(x !== 0)
              .setFlipY(y !== 0)
              .setDisplaySize(1600, 900)
              .setTint(0x627185)
              .setDepth(-12),
          );
        }
    }
    for (const image of this.raidSurround)
      image
        .setTexture(key)
        .setDisplaySize(1600, 900)
        .setVisible(raid && !spire);
    if (court) this.ensureBlocks(court);
    // Grumblecrag's raid shows its own pillars (the PvP blocks stay as they are).
    for (const [cid, list] of this.courtBlocks)
      for (const b of list)
        b.img.setVisible(cid === court && !b.shifting && !this.courtRaid);
    if (standsOn && court && !this.stands.has(court)) {
      const bake = floorBake(),
        skey = `court-stands-${court}`;
      if (!this.textures.exists(skey)) {
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = STANDS * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintCourtStands(ctx, court);
        addCanvasTexture(this.textures, skey, canvas);
      }
      this.stands.set(
        court,
        this.add
          .image(0, -STANDS, skey)
          .setOrigin(0)
          .setScale(1 / bake)
          .setDepth(-10),
      );
    }
    for (const [cid, img] of this.stands)
      img.setVisible(standsOn && cid === court);
    if (standsOn && court && !this.courtAprons.has(court)) {
      const bake = floorBake(),
        akey = `court-apron-${court}`;
      if (!this.textures.exists(akey)) {
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = COURT_APRON * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintCourtApron(ctx, court);
        addCanvasTexture(this.textures, akey, canvas);
      }
      this.courtAprons.set(
        court,
        this.add
          .image(0, RULES.height, akey)
          .setOrigin(0)
          .setScale(1 / bake)
          .setDepth(-10),
      );
    }
    for (const [cid, img] of this.courtAprons)
      img.setVisible(standsOn && cid === court);

    if (this.courtRaid) this.pillarRig ??= new PillarRig(this, fighterDepth);
    this.pillarRig?.setVisible(this.courtRaid);
    // The frame grows to show the stands on desktop (see .court-view in CSS).
    document.body.classList.toggle("court-view", standsOn);
  }
  /**
   * Blocks on show each frame: the Shifting Ruins block only while it's up,
   * Grumblecrag's pillars crumbling and rising, and the cover effects sort
   * behind (see Fx.at).
   */
  private updateBlocks(t: number, pillars?: readonly { broken: boolean }[]) {
    const spire = this.spireView;
    if (spire && this.spireRig) {
      const s = state?.raid?.spire;
      const cleared = !!s && s.clearedAt !== undefined && s.kind !== "boss";
      this.spireRig.update(
        this.time.now,
        cleared,
        reducedMotion,
        battleQuality.current() === "low",
        fxFor(this),
      );
      // While the stairs are open, the next floor is painted (never mid-fight).
      const after =
        s && s.clearedAt !== undefined ? nextSpireCourtView(spire) : undefined;
      // (Only a floor this party may climb to.)
      const next =
        after && after.floor <= (s?.ceiling ?? 0) ? after : undefined;
      const ahead = next ? `${next.floor}` : "";
      if (next && ahead !== this.spirePrepared) {
        this.spirePrepared = ahead;
        this.spireRig.prepare(next);
        if (next.kind === "boss")
          this.floorTexture(spireSummitFloorId(next.zone));
      }
      if (spire.kind !== "boss") {
        fxFor(this).setOccluders(this.spireRig.fronts, fighterDepth);
        return;
      }
    }
    if (this.courtRaid && this.pillarRig) {
      const fronts = this.pillarRig.update(
        this.time.now,
        pillars ?? [],
        reducedMotion,
        battleQuality.current() === "low",
      );
      fxFor(this).setOccluders(fronts, fighterDepth);
      return;
    }
    const list = this.activeCourt && this.courtBlocks.get(this.activeCourt);
    // Effects pass behind the blocks on show (see Fx.at); none off the courts.
    fxFor(this).setOccluders(
      list
        ? list.filter(({ img }) => img.visible).map(({ o }) => o.y + o.h)
        : [],
      fighterDepth,
    );
    if (!list) return;
    for (const { img, shifting } of list) {
      if (shifting) img.setVisible(shiftingUp(ARENAS["shifting-ruins"], t));
      // The stone fills its footprint, so whatever stands behind it is clear
      // of the picture: blocks stay solid.
      img.setAlpha(1);
    }
  }
  /** Knockout moment: camera push-in multiplier and its end time. */
  koZoom = 1;
  koUntil = 0;
  accumulator = 0;
  actions = { skill: -1, dash: false, jump: false, basic: false };
  canControl(): boolean {
    return (
      connected &&
      state?.phase === "playing" &&
      !!local &&
      !local.out &&
      (local.hp > 0 || !!state.raid) &&
      !($("practice-settings") as HTMLDetailsElement | null)?.open &&
      !$<HTMLDialogElement>("dialog").open &&
      (touch.enabled ? touch.focused : document.hasFocus()) &&
      !document.hidden &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName ?? "",
      )
    );
  }
  positions = new Map<string, { x: number; y: number }>();
  labels = new Map<string, HTMLElement>();
  constructor() {
    super("arena");
  }
  private rigs = new Map<string, FighterVisual>();
  /** Only the fighters on the court are built and loaded (fighter-loading.ts). */
  private fighters = new FighterLoading({
    build: (id) => rigAssets(id),
    keys: fighterTextureKeys,
    exists: (key) => this.textures.exists(key),
  });
  private loadReported = false;
  private perfOverlay?: PerfOverlay;
  /** Every fighter in this snapshot has its textures (or gave up loading). */
  fightersReady(s: Snapshot) {
    return this.fighters.allReady(sceneFighters(s));
  }
  /** Queue whichever of this snapshot's fighters are still missing. */
  private requestFighters(s: Snapshot) {
    if (this.fightersReady(s)) return;
    // Layers rasterized ahead (fighter-prepaint.ts) are added at once.
    for (const id of sceneFighters(s))
      addPrepaintedLayers(this, this.fighters.assetsFor(id));
    const ids = this.fighters.toRequest(sceneFighters(s));
    if (!ids.length) return;
    for (const id of ids)
      queueFighterAssets(this, id, this.fighters.assetsFor(id));
    // Files added mid-load join the running load, whoever started it (a
    // skin, boss art), and settle with its COMPLETE (listener in preload).
    if (!this.load.isLoading()) this.load.start();
  }
  /**
   * A fighter's rig, or undefined while its art is loading (a fighter that
   * turns up later: Fighter roulette, a new seat) or after it failed to
   * load: that fighter is drawn as a plain stand-in meanwhile, and the rest
   * of the battle (other fighters, your controls and input, attack warnings)
   * carries on. A rig of the fighter it was before is removed.
   */
  private readyRig(id: string, character: CharacterId) {
    if (this.fighters.hasArt(character)) return this.getRig(id, character);
    const old = this.rigs.get(id);
    if (old) {
      old.destroy();
      this.rigs.delete(id);
    }
    return undefined;
  }
  private animationLive = false;
  private needsHydration = true;
  private followCamera = new FollowCamera();
  private enemyBearing = document.createElement("div");
  /** The camera view of the last frame (the target button's on-screen test). */
  private aimView: CameraView | undefined;
  /** Where each fighter's nameplate was drawn last frame (the arrow keeps
   * off the followed fighter's). */
  private plates = new Map<string, PlateBox>();
  hydrateNextSnapshot() {
    this.needsHydration = true;
  }
  private getRig(id: string, character: CharacterId) {
    let rig = this.rigs.get(id);
    if (rig && rig.character !== character) {
      rig.destroy();
      this.rigs.delete(id);
      rig = undefined;
    }
    if (!rig) {
      rig = createFighterVisual(
        this,
        character,
        this.fighters.assetsFor(character),
      );
      this.rigs.set(id, rig);
    }
    return rig;
  }
  /**
   * Feed live-play frame times to the quality governor (never menus, hidden
   * tabs or rounds not being played) and apply its decoration knobs.
   */
  private applyBattleQuality(now: number) {
    const live =
      state?.phase === "playing" &&
      !document.hidden &&
      !menuOpen &&
      !settingsOpen &&
      !$<HTMLDialogElement>("dialog").open;
    // A slow battle trims only its own decorations (battle-quality.ts). It
    // used to switch the Lobby, Plaza and Farm to Low for good as well, so a
    // heavy raid on an iPad Pro 13" M4 left it on Low everywhere (owner,
    // 17 Nov 2026); the Plaza and the Farm measure themselves.
    if (live) battleQuality.frame(now);
    else battleQuality.pause();
    battlePerf.frame(now, live);
    const knobs = battleQuality.knobs();
    const fx = fxFor(this);
    fx.density = knobs.particles;
    fx.trailScale = knobs.trails;
    fx.glowBudget = knobs.glowBudget;
    setRaidMapLow(knobs.stillBackground);
    this.perfOverlay?.update(
      now,
      battlePerf.summary(1000),
      // "cpu": drawn without the graphics card (gpu-check.ts).
      `${battleQuality.current()}${softwareRendering() ? " cpu" : ""}`,
      renderScale(),
      fx.stats,
    );
    if (battleStill !== knobs.stillBackground) {
      battleStill = knobs.stillBackground;
      document.body.classList.toggle("battle-still", battleStill);
    }
    // Low draws fewer pixels: resize the canvas on the next frame (the
    // floor keeps the density it was baked at, see floorScale).
    if (battleDensity !== knobs.density) {
      if (battleDensity !== undefined) scheduleBattleLayout();
      battleDensity = knobs.density;
    }
  }
  observeSnapshot(next: Snapshot, previous?: Snapshot) {
    this.requestFighters(next);
    // The match is over: tell the server how smoothly it ran here.
    if (
      next.phase === "finished" &&
      previous?.code === next.code &&
      previous.phase !== "finished"
    )
      reportBattlePerf();
    this.animationLive = !this.needsHydration && previous?.code === next.code;
    this.needsHydration = false;
    const reset = !this.animationLive || previous?.round !== next.round;
    if (reset) this.followCamera = new FollowCamera();
    const alive = new Set(
      next.players.flatMap((p) => [
        p.id,
        ...(p.clone ? [`${p.id}:clone`] : []),
      ]),
    );
    for (const [id, rig] of this.rigs)
      if (!alive.has(id)) {
        rig.destroy();
        this.rigs.delete(id);
      }
    for (const p of next.players) {
      const rig = this.readyRig(p.id, p.character);
      if (!rig) continue;
      if (reset) rig.controller.reset();
      const old = previous?.players.find((other) => other.id === p.id);
      if (!reset && old) {
        if (p.hp < old.hp) rig.trigger("hurt", this.feelClock, 160);
        if (old.jumpUntil > previous!.time && p.jumpUntil <= next.time)
          rig.trigger("land", this.feelClock, 130);
      }
    }
  }
  preload() {
    battleLoadMarks.preload ||= performance.now();
    if (state?.raid) {
      queueBossArt(this, state.raid.boss);
      queueBossSpellArt(this);
    }
    // Only the fighters in this room: the rest load if they ever appear.
    // Their layers rasterized ahead (fighter-prepaint.ts) are added now;
    // the loader skips those and loads only what's missing.
    if (state)
      for (const id of neededFighters(state.players))
        addPrepaintedLayers(this, this.fighters.assetsFor(id));
    if (state)
      for (const id of this.fighters.toRequest(sceneFighters(state)))
        queueFighterAssets(this, id, this.fighters.assetsFor(id));
    // The Shop skins they wear load here too, behind the loading screen: a
    // rig would otherwise ask for them on its first frame, mid-battle (a
    // stall while they rasterize, then the skin popping in).
    if (state)
      for (const p of state.players) {
        const look = p.championLooks?.[p.character];
        if (!p.raidBoss && look && skinSuffix(p.character, look)) {
          const layers = rigAssets(p.character, look);
          addPrepaintedLayers(this, layers);
          loadRigTextures(this, layers);
        }
      }
    // Every load that finishes (this one, and later ones started for a new
    // fighter, a skin or boss art) settles what was requested: art still
    // missing may be asked for again. The scene's loader drops its
    // listeners when the scene shuts down.
    this.load.on(Ph.Loader.Events.COMPLETE, () => this.fighters.settled());
  }
  create() {
    battleLoadMarks.create ||= performance.now();
    scene = this;
    // The boss's pieces are drawn once into an atlas: now, not on its first frame.
    if (state?.raid)
      prewarmBossAtlas(
        this,
        state.raid.boss,
        state.raid.phase,
        bossLookOf(state.raid),
      );
    // So are the arena's pieces (lanterns, conductor posts, light, marks).
    if (state?.raid) prewarmRaidArena(this, state.raid);
    // So are its arena's (pillars, braziers and burning ground).
    if (state?.raid?.boss === "grumblecrag") prewarmPillars(this);
    if (state?.raid?.boss === "emberwing") prewarmTerrace(this);
    // The Spire's court: the floor it starts on (the next one is painted
    // while its stairs are open; the boss floor's pillars just above).
    prewarmSpireCourt(this, spireCourtView(state?.raid));
    // So are the arena's painted pieces (islands, rune pads and the rest).
    if (state?.raid) {
      prewarmLagoon(this, state);
      prewarmCloudDeck(this, state);
    }
    battleQuality.restart();
    battlePerf.reset();
    netMeter.reset();
    leadSeen.sum = leadSeen.frames = 0;
    matchErrors = 0;
    drawnSelf.length = 0;
    // Read at each match: Settings → Graphics can turn it on or off.
    if (perfMode()) {
      this.perfOverlay = new PerfOverlay($("game").parentElement!);
      // The same numbers for the budget tests (tests/visual/effect-budget).
      (window as unknown as Record<string, unknown>).__arenaPerf = {
        fx: () => ({ ...fxFor(this).stats }),
        summary: (ms?: number) => battlePerf.summary(ms),
        quality: () => battleQuality.current(),
        density: () => renderScale(),
      };
    }
    this.enemyBearing.className = "enemy-bearing";
    this.enemyBearing.hidden = true;
    this.enemyBearing.innerHTML =
      '<span aria-hidden="true">➜</span><strong></strong>';
    $("game").parentElement!.append(this.enemyBearing);
    this.cameras.main.setBackgroundColor("#142746");
    // Effect sprites are painted now, not when they first appear mid-fight
    // (the first hit, the first skill, the first pillar to crumble).
    fxFor(this);
    prepareSurfaceTextures(this);
    // The floor picture: showArena bakes the room's court (once per arena,
    // at floorBake's density) on the first frame. No stand-in court is
    // painted first: that was a whole extra full-court canvas per battle.
    this.floor = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setDepth(-10);
    this.floorArena = "";
    const clearDom = () => {
      this.perfOverlay?.remove();
      this.perfOverlay = undefined;
      this.enemyBearing.remove();
      for (const label of this.labels.values()) label.remove();
      this.labels.clear();
    };
    this.events.once(Ph.Scenes.Events.SHUTDOWN, clearDom);
    this.events.once(Ph.Scenes.Events.DESTROY, clearDom);
    this.graphics = battleCurves(this.add.graphics());
    this.bossGraphics = this.add.graphics();
    // Keys and mouse buttons are read through the player's bindings (see pressAction).
    this.input.mouse!.disableContextMenu();
    // Phones: tap an enemy on the court to aim at it; tap it again for
    // automatic aiming. A tap on empty ground keeps the current lock.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!touch.enabled || state?.phase !== "playing" || !local) return;
      const hit = targetLock.pickAt(
        pointer.worldX,
        pointer.worldY,
        (raidTargets(state, local) as Targetable[] | undefined) ??
          visibleEnemies(local, local),
      );
      if (hit) targetLock.toggle(hit.id);
    });
    // The target button by Dash: the next enemy on screen, then none.
    touch.onTarget = () => {
      if (state?.phase !== "playing" || !local) return;
      targetLock.cycle(this.targetsOnScreen(local));
      // Lit (or not) at once, not a frame later.
      touch.setTarget(true, !!targetLock.id);
    };
    this.scale.refresh();
  }
  /**
   * The enemies the target button can pick: the ones a tap could lock (a
   * raid's bodies, lanterns and bubbles, else living visible enemies) that
   * stand on screen, nearest first. On screen as the off-screen arrow
   * judges it (outsideView), from the camera view of the last frame: the
   * camera's own worldView cut off fighters standing at the court's edge.
   */
  targetsOnScreen(me: Fighter) {
    const view = this.aimView;
    if (!state || !view) return [];
    const all =
      (raidTargets(state, me) as Targetable[] | undefined) ??
      visibleEnemies(me, me);
    return all
      .filter(
        (t) =>
          !outsideView(t.x, t.y, this.scale.width, this.scale.height, view),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - me.x, a.y - me.y) -
          Math.hypot(b.x - me.x, b.y - me.y),
      )
      .map((t) => t.id);
  }
  /** The tap-to-target lock's lifetime: it ends when its target dies or
   * leaves (a defeated fighter, a popped copy or bubble, a relit lantern). */
  keepTargetLock() {
    if (targetLock.id === undefined) return;
    const me = state?.players.find((p) => p.id === myId);
    const extra = state && me ? raidTargets(state, me) : undefined;
    targetLock.keepIf(
      (id) =>
        !!state?.players.some((p) => p.id === id && !p.out && p.hp > 0) ||
        !!extra?.some((t) => t.id === id),
    );
  }
  /** Start your own basic, skill or dash feedback on the press (see cast-prediction). */
  predictCasts(local: Fighter, input: Input, time: number) {
    if (!this.animationLive || !state) return;
    const now = performance.now();
    const c = CHARACTERS[local.character];
    const free = !!state.practice?.unlimitedCooldowns;
    // The server takes a skill over a basic in the same step.
    // Casting Curl & Roll again while rolling uncurls (the server allows it on cooldown).
    if (input.skill >= 0 && local.roll && input.skill === local.roll.slot) {
      // Nothing to flash: the server will uncurl.
    } else if (input.skill >= 0) {
      const windUp = c.skills[input.skill].cast;
      // A wind-up skill shows its charging pose now (as the server's charge
      // will); its cast arrives from the server when the charge ends, so it
      // is not marked as already shown.
      const action: CastAction =
        windUp > 0 ? "charge" : (`skill${input.skill}` as CastAction);
      if (castPredictor.waiting(action, now)) {
        // Already shown; the server has it.
      } else if (canCastSkill(local, input.skill, time, free)) {
        this.readyRig(local.id, local.character)?.trigger(
          windUp > 0 ? "skill3" : (action as "skill0"),
          this.feelClock,
          windUp > 0 ? windUp * 1000 : castDuration(c, input.skill),
        );
        if (windUp <= 0) {
          audio.play("cast");
          this.predictCastEffect(local, c.skills[input.skill], input);
        }
        castPredictor.predict(action, now);
        if (input.skill !== ULT_SLOT && !free)
          optimisticCooldowns.set(input.skill, {
            until:
              time +
              kitOf(local.character, local.rites).skills[input.skill].cooldown *
                cooldownScale(),
            at: now,
          });
        flashSkillButton(input.skill, true);
      } else if (!skillReady(local, input.skill, time, free))
        flashSkillButton(input.skill, false);
    } else if (
      input.basic &&
      !castPredictor.waiting("basic", now) &&
      canBasic(local, time)
    ) {
      this.readyRig(local.id, local.character)?.trigger(
        "basic",
        this.feelClock,
        castDuration(c, -1),
      );
      audio.play("cast");
      this.predictCastEffect(local, c.basic, input);
      castPredictor.predict("basic", now);
    }
    if (
      input.dash &&
      !castPredictor.waiting("dash", now) &&
      canDash(local, time)
    ) {
      audio.play("dash");
      castPredictor.predict("dash", now);
    }
  }
  /** Your own casts whose effect already played on the press (ability id → when). */
  private shownEffects = new Map<string, number>();
  /**
   * Play your own cast's effect on the press, one round trip before the
   * server confirms it: only moves whose cast effect depends on nothing but
   * where you stand and face (a strike, a shot leaving, a shield going up).
   * Moves the server places or resolves (a blink, a rush, a beam's path, a
   * zone at the aim, a nova's burst) still play when the server says so.
   */
  private predictCastEffect(local: Fighter, ability: Ability, input: Input) {
    if (!this.animationLive || !PREDICTED_CAST_KINDS.has(ability.kind)) return;
    // Facing as the server will set it from this very input (predictFighter
    // runs after this, so local.angle is still the last step's).
    const angle = Math.atan2(input.aimY - local.y, input.aimX - local.x);
    const color = fighterSkillColor(local) ?? CHARACTERS[local.character].color;
    playCast(this, ability, local.x, local.y, angle, color, reducedMotion, () =>
      this.positions.get(local.id),
    );
    this.shownEffects.set(ability.id, performance.now());
  }
  /** The server's cast of a move whose effect already played on the press. */
  private effectShown(abilityId: string) {
    const at = this.shownEffects.get(abilityId);
    this.shownEffects.delete(abilityId);
    return (
      at !== undefined &&
      performance.now() - at <=
        Math.max(300, Math.min(1200, castPredictor.rtt + 250))
    );
  }
  /** Is this server event the echo of a cast or dash already shown? */
  predictedEcho(event: Snapshot["events"][number]) {
    const now = performance.now();
    if (event.kind === "dash") return castPredictor.confirm("dash", now);
    if (event.kind !== "cast" || !event.abilityId) return false;
    const me = state?.players.find((p) => p.id === myId);
    if (!me) return false;
    const c = CHARACTERS[me.character];
    const slot = c.skills.findIndex((a) => a.id === event.abilityId);
    if (slot < 0 && event.abilityId !== c.basic.id) return false;
    const shown = castPredictor.confirm(
      slot >= 0 ? (`skill${slot}` as CastAction) : "basic",
      now,
    );
    // How long a skill press waited for the server (basics aside).
    if (shown && slot >= 0 && castPredictor.lastWait !== undefined)
      netMeter.confirmed(castPredictor.lastWait);
    return shown;
  }
  effect(event: Snapshot["events"][number]) {
    // Effects pose only fighters whose art has loaded (readyRig); sounds,
    // impacts and the other fighters' poses play as usual meanwhile.
    // Somnara's correct steps and Nightmare are drawn with its arena's pieces.
    const deck = noteCloudDeckEvent(event, state);
    if (
      event.kind === "raid-impact" &&
      this.courtRaid &&
      this.pillarRig &&
      event.raidRadius === IMPACT_RADIUS &&
      event.color === 0xffd65b
    )
      // A pillar breaking: its ring is drawn with the pillars.
      this.pillarRig.impact(event.x, event.y, this.time.now, reducedMotion);
    else if (
      event.kind === "raid-impact" &&
      !deck &&
      // A mirror turning rings its own chime (raid-prismatail-atrium.ts).
      !isMirrorTurnImpact(state?.raid, event)
    ) {
      const ring = this.add
        .circle(event.x, event.y, event.raidRadius ?? 90, event.color, 0.12)
        .setStrokeStyle(4, event.color, 0.9);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scale: reducedMotion ? 1 : 1.25,
        duration: 400,
        onComplete: () => ring.destroy(),
      });
    }

    // Your own cast or dash that was already shown on the key press (a
    // predicted cast) is not played a second time when the server confirms.
    const echo = event.owner === myId && this.predictedEcho(event);
    if (
      ((event.owner === myId &&
        event.kind !== "impact" &&
        event.kind !== "raid-impact") ||
        event.kind === "hit" ||
        event.kind === "round") &&
      !echo
    )
      audio.play(event.kind);
    if (
      this.animationLive &&
      event.kind === "cast" &&
      event.owner &&
      event.abilityId &&
      !echo
    ) {
      const p = state?.players.find((p) => p.id === event.owner);
      if (p) {
        const c = CHARACTERS[p.character];
        const slot = c.skills.findIndex((a) => a.id === event.abilityId);
        if (slot >= 0 || event.abilityId === c.basic.id)
          this.readyRig(p.id, p.character)?.trigger(
            slot >= 0
              ? (`skill${slot}` as "skill0" | "skill1" | "skill2" | "skill3")
              : "basic",
            this.feelClock,
            castDuration(c, slot),
            event.id,
          );
      }
    }
    if (
      this.animationLive &&
      event.owner &&
      (event.kind === "dash" || event.kind === "jump" || event.kind === "land")
    ) {
      const p = state?.players.find((p) => p.id === event.owner);
      if (p)
        this.readyRig(p.id, p.character)?.trigger(
          event.kind,
          this.feelClock,
          event.kind === "dash"
            ? RULES.dashDuration * 1000
            : event.kind === "jump"
              ? RULES.jumpDuration * 1000
              : 130,
          event.id,
        );
    }
    const ability = event.abilityId
      ? allAbilities.get(event.abilityId)
      : undefined;
    const owner = state?.players.find((p) => p.id === event.owner);
    const skinColor = owner ? skillColorOf(owner) : undefined;
    if (skinColor !== undefined) event = { ...event, color: skinColor };
    if (
      event.kind === "beam" &&
      ability &&
      event.tx !== undefined &&
      event.ty !== undefined
    )
      playBeam(
        this,
        ability,
        event.x,
        event.y,
        event.tx,
        event.ty,
        event.color,
        reducedMotion,
      );
    // A blink's landing, a rush's contact, a roll's or pinball's ram, a
    // seedling going off and a swap's landing play the move's impact effect.
    if (
      ability &&
      event.kind === "burst" &&
      [
        "blink",
        "rush",
        "roll",
        "pinball",
        "seedling",
        "swap",
        "rewind",
        "pound",
        "clamp",
        "throw",
        "lighthouse",
      ].includes(ability.kind)
    ) {
      playImpact(this, ability, event.x, event.y, event.color, reducedMotion);
      // Halcyon Rewind: the dive back from where it left.
      if (
        ability.kind === "rewind" &&
        event.tx !== undefined &&
        event.ty !== undefined &&
        !reducedMotion
      )
        playRewindDive(this, event.tx, event.ty, event.x, event.y, event.color);
    }
    // Novas play on their burst event; every other move plays on cast.
    else if (ability && event.kind === "burst") {
      const combo = owner && COMBOS[owner.character];
      const shown =
        event.combo && combo?.radius
          ? { ...ability, radius: ability.radius * combo.radius }
          : ability;
      playCast(this, shown, event.x, event.y, 0, event.color, reducedMotion);
    }
    if (event.kind === "hazard") this.hazardBurst(event);
    // Pangrove's plates break and grow back; a pinball bounces off a wall.
    if (event.kind === "burst" && !reducedMotion) {
      if (event.abilityId === "plate-break" || event.abilityId === "plate-grow")
        plateFx(this, event.x, event.y, event.abilityId === "plate-grow");
      else if (event.abilityId === "pinball-bounce")
        bounceFx(this, event.x, event.y);
    }
    if (event.combo && (event.kind === "burst" || event.kind === "hit"))
      this.comboText(event);
    // The first hit out of stealth, and a charge that drives into a wall.
    if (event.kind === "hit" && event.ambush) this.comboText(event, "AMBUSH!");
    // A blinded fighter's basic attack (Ink Jet) misses.
    if (event.kind === "hit" && event.miss) this.comboText(event, "MISS");
    // Mochi Pound: which pound of the chain.
    if (event.kind === "burst" && event.step && event.step > 1)
      this.comboText(event, event.step >= 3 ? "POUND!" : `×${event.step}`);
    if (event.kind === "burst" && event.slam) {
      this.comboText(event, "WALL SLAM!");
      if (!reducedMotion) this.cameras.main.shake(140, 0.004);
    }
    if (
      ability &&
      event.kind === "cast" &&
      ability.kind !== "nova" &&
      !(echo && event.abilityId && this.effectShown(event.abilityId))
    ) {
      const caster = event.owner;
      playCast(
        this,
        ability,
        event.x,
        event.y,
        owner?.angle ?? 0,
        event.color,
        reducedMotion,
        // Where the caster is drawn now (smoothed, and predicted for you).
        caster ? () => this.positions.get(caster) : undefined,
      );
    }
    if (ability && event.kind === "impact")
      playImpact(this, ability, event.x, event.y, event.color, reducedMotion);
    if (event.kind === "hit" && event.target) this.feelHit(event);
    this.surfaceEffect(event);
    if (event.kind === "hit")
      playHit(
        this,
        ability?.element ?? "",
        event.x,
        event.y,
        skinColor ?? (ability && abilityColor.get(ability.id)) ?? event.color,
        reducedMotion,
      );
    if (
      !reducedMotion &&
      (event.kind === "dash" || event.kind === "jump" || event.kind === "land")
    ) {
      const ring = this.add
        .circle(event.x, event.y, 22, event.color, 0.15)
        .setStrokeStyle(2, event.color, 0.7);
      this.tweens.add({
        targets: ring,
        scale: 2.2,
        alpha: 0,
        duration: 300,
        onComplete: () => ring.destroy(),
      });
    }
    if (event.value) {
      const bank = event.abilityId === "gem-bank",
        heal = event.kind === "heal" || bank,
        energy = event.kind === "heal" && event.abilityId === "energy-orb";
      const strength = hitStrength(event.value, event.ko);
      const value = event.value.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      });
      const label = this.add
        .text(
          event.x,
          event.y - 45,
          bank
            ? `+${value} GEM${event.value === 1 ? "" : "S"} BANKED`
            : energy
              ? `+${value}% ULT`
              : `${heal ? "+" : "−"}${value}`,
          {
            fontFamily: "DM Sans, sans-serif",
            fontStyle: "bold",
            fontSize: heal
              ? "26px"
              : strength === "critical"
                ? "38px"
                : strength === "strong"
                  ? "32px"
                  : "26px",
            color: bank
              ? "#d8b4ff"
              : energy
                ? "#ffd166"
                : heal
                  ? "#7dffb0"
                  : strength === "critical"
                    ? "#ffd65b"
                    : "#eef2ff",
            stroke: "#0b1020",
            strokeThickness: 5,
          },
        )
        .setOrigin(0.5)
        .setDepth(45)
        .setResolution(renderScale());
      this.tweens.add({
        targets: label,
        y: reducedMotion ? event.y - 45 : event.y - 95,
        alpha: 0,
        duration: 650,
        onComplete: () => label.destroy(),
      });
    }
  }
  /** A hazard going off: a ring the size of its reach (dust for the wall). */
  hazardBurst(event: Snapshot["events"][number]) {
    const arena = ARENAS[state?.arena ?? "classic"];
    const hazard = arena.hazards.find(
      (h) => Math.hypot(h.x - event.x, h.y - event.y) < 2,
    );
    const radius = hazard?.radius ?? 90;
    audio.play("hit");
    if (reducedMotion) return;
    const ring = this.add
      .circle(event.x, event.y, radius * 0.4, event.color, 0.35)
      .setStrokeStyle(4, event.color, 0.9)
      .setDepth(5);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy(),
    });
    const me = state?.players.find((p) => p.id === myId);
    if (me && Math.hypot(me.x - event.x, me.y - event.y) < radius + 60)
      this.cameras.main.shake(140, 0.004, false);
  }
  /** "SOAKED!" over a combo payoff, at most once per fighter per moment. */
  comboText(event: Snapshot["events"][number], text?: string) {
    const key = `${event.source ?? event.owner}:${text ?? event.combo}`;
    const now = performance.now();
    if ((this.comboShown.get(key) ?? 0) > now) return;
    this.comboShown.set(key, now + 600);
    const label = this.add
      .text(
        event.x,
        event.y - 75,
        text ??
          (event.abilityId === "ex-cast"
            ? `${event.combo!.toUpperCase()}!`
            : `${event.combo!.toUpperCase()} COMBO!`),
        {
          fontFamily: "system-ui, sans-serif",
          fontStyle: "900",
          fontSize: "24px",
          color: "#ffe27a",
          stroke: "#3a1f00",
          strokeThickness: 5,
        },
      )
      .setOrigin(0.5)
      .setDepth(40)
      .setResolution(renderScale());
    if (reducedMotion) {
      this.time.delayedCall(800, () => label.destroy());
      return;
    }
    label.setScale(0.6);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 140,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: label,
      y: event.y - 120,
      alpha: 0,
      delay: 450,
      duration: 500,
      onComplete: () => label.destroy(),
    });
  }
  /** On a painted court, hits, landings and dashes kick up its ground. */
  surfaceEffect(event: Snapshot["events"][number]) {
    if (!this.activeCourt) return;
    let x = event.x,
      y = event.y;
    let kind: "hit" | "ko" | "land" | "dash";
    if (event.kind === "hit" && event.target) {
      const target = state?.players.find((p) => p.id === event.target);
      // Bosses are big; their hits don't need a puff at their feet.
      if (!target || target.raidBoss) return;
      ({ x, y } = target);
      kind = event.ko ? "ko" : "hit";
    } else if (event.kind === "land") kind = "land";
    else if (event.kind === "dash") kind = "dash";
    else return;
    surfaceBurst(
      this,
      this.activeCourt,
      x,
      y + 6,
      kind,
      fighterDepth(y) - 0.0001,
      reducedMotion,
    );
  }
  /** Freeze, shake, flash and rumble for one hit, scaled by its size. */
  feelHit(event: Snapshot["events"][number]) {
    const role =
      event.target === myId
        ? "victim"
        : event.source === myId
          ? "attacker"
          : "spectator";
    const strength = hitStrength(event.value ?? 0, event.ko);
    const feel = hitFeel(
      event.combo && strength === "weak" ? "strong" : strength,
      role,
      reducedMotion,
      state?.phase === "playing",
    );
    const now = performance.now();
    // Burn ticks and other chip damage don't flash, or burning fighters strobe.
    if ((event.value ?? 0) >= 4)
      this.flashUntil.set(event.target!, now + feel.flashMs);
    if (feel.stopMs)
      this.stopUntil = Math.max(this.stopUntil, now + feel.stopMs);
    if (feel.shakeMs) this.cameras.main.shake(feel.shakeMs, feel.shake, false);
    rumble(feel.rumbleMs, feel.rumble);
    if (event.ko) audio.cheer();
    if (event.ko && !reducedMotion && state?.phase !== "playing") {
      // Knockout: hold the moment and push the camera in, then ease back.
      this.koUntil = now + KO_FEEL.holdMs;
      if (!this.cameras.main.flashEffect.isRunning) {
        // Phaser captures the initial alpha when the effect starts.
        this.cameras.main.flashEffect.alpha = 0.12;
        this.cameras.main.flash(KO_FEEL.holdMs, 255, 214, 91);
      }
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: KO_FEEL.zoomMs,
        onUpdate: (tween) => {
          this.koZoom =
            1 + (KO_FEEL.zoom - 1) * Math.sin(tween.getValue()! * Math.PI);
        },
        onComplete: () => (this.koZoom = 1),
      });
    }
  }
  update(_time: number, delta: number) {
    // A fighter still loading is drawn as a stand-in (readyRig) while its
    // art loads; nothing else waits for it.
    if (state) this.requestFighters(state);
    if (!this.loadReported && state && this.fightersReady(state)) {
      this.loadReported = true;
      reportBattleLoad(sceneFighters(state).length);
    }
    const feelNow = performance.now();
    this.applyBattleQuality(feelNow);
    const stopped = feelNow < this.stopUntil;
    if (!stopped) this.feelClock += delta;
    this.tweens.timeScale = stopped
      ? 0.05
      : feelNow < this.koUntil
        ? KO_FEEL.tweenSlowdown
        : 1;
    const me = state?.players.find((p) => p.id === myId);
    const partner =
      me && (isTeams() || !!state?.raid) && me.hp <= 0
        ? state!.players.find(
            (p) => p.id !== myId && teamOf(p) === teamOf(me) && p.hp > 0,
          )
        : undefined;
    const spectated = state && pvpSpectator.target(state, myId);
    const tracked = spectated ?? partner ?? me;
    const myTeam = me ? teamOf(me) : 0;
    const follow =
      state?.phase === "playing" && tracked && tracked.hp > 0
        ? tracked === me
          ? (local ?? tracked)
          : tracked
        : undefined;
    const presented = follow
      ? (this.positions.get(follow.id) ?? follow)
      : undefined;
    // Raid camera fits all mechanics; only PvP/practice follows a fighter.
    const view = state?.raid
      ? raidCameraView(this.scale.width, this.scale.height, raidCameraHudBottom)
      : this.followCamera.update(
          this.scale.width,
          this.scale.height,
          touch.enabled &&
            !state?.raid &&
            document.body.classList.contains("battle-active") &&
            innerWidth > innerHeight,
          ((touch.enabled && innerWidth > innerHeight) || !!spectated) &&
            follow &&
            presented &&
            !state?.arcade &&
            !state?.raid
            ? {
                ...follow,
                x: presented.x,
                y: presented.y,
                attacking: attacking(
                  this.readyRig(follow.id, follow.character),
                ),
              }
            : undefined,
          `${state?.code ?? "menu"}:${state?.round ?? 0}:${myId ?? ""}`,
          delta,
          reducedMotion,
          this.activeCourt && !this.courtRaid ? STANDS : 0,
          state?.practice ? 1.65 : 1.2,
          touch.enabled &&
            innerWidth > innerHeight &&
            this.activeCourt &&
            !this.courtRaid
            ? COURT_APRON
            : 0,
          // The PvP badge covers the top of a phone's arena: the court may
          // scroll below it (badge pixels → game pixels).
          touch.enabled && badgeClear ? badgeClear.bottom / this.scale.zoom : 0,
        );
    const hitZoom = state?.raid ? 1 : this.koZoom;
    this.cameras.main
      .setZoom(view.zoomX * hitZoom, view.zoomY * hitZoom)
      .centerOn(view.x, view.y);
    this.aimView = view;
    const aim = screenToWorld(
      this.input.activePointer.x,
      this.input.activePointer.y,
      this.scale.width,
      this.scale.height,
      view,
    );
    const opponent =
      tracked && presented ? nearestEnemy(presented, tracked) : undefined;
    this.enemyBearing.hidden =
      !follow ||
      !opponent ||
      !outsideView(
        opponent.x,
        opponent.y,
        this.scale.width,
        this.scale.height,
        view,
      );
    // PvP: an arrow circling the fighter you follow, in the nearest
    // off-screen opponent's colour (owner, 7 Nov 2026: no chip at the top,
    // where the score badge is). Raids keep the named chip.
    const orbit = !state?.raid;
    this.enemyBearing.classList.toggle("is-orbit", orbit);
    if (opponent && presented && !this.enemyBearing.hidden) {
      this.enemyBearing.querySelector("strong")!.textContent =
        opponent.raidBoss && state?.raid
          ? state.raid.boss === "storm-twins"
            ? opponent.name
            : state.raid.name
          : CHARACTERS[opponent.character].name;
      const css = this.scale.zoom;
      const from = {
        x: ((presented.x - view.x) * view.zoomX + this.scale.width / 2) * css,
        // The middle of the fighter, above the feet.
        y:
          ((presented.y - BEARING_LIFT - view.y) * view.zoomY +
            this.scale.height / 2) *
          css,
      };
      const angle = orbit
        ? Math.atan2(
            (opponent.y - presented.y) * view.zoomY,
            (opponent.x - presented.x) * view.zoomX,
          )
        : Math.atan2(
            (opponent.y - view.y) * view.zoomY,
            (opponent.x - view.x) * view.zoomX,
          );
      this.enemyBearing.querySelector<HTMLElement>("span")!.style.transform =
        `rotate(${angle}rad)`;
      const spot = bearingSpot(
        from.x + Math.cos(angle) * BEARING_RADIUS,
        from.y + Math.sin(angle) * BEARING_RADIUS,
        this.plates.get(follow!.id),
      );
      setHudStyle(
        this.enemyBearing,
        "transform",
        orbit ? `translate(${spot.x}px, ${spot.y}px)` : "",
      );
      setHudStyle(
        this.enemyBearing,
        "--bearing-color",
        `#${CHARACTERS[opponent.character].color.toString(16).padStart(6, "0")}`,
      );
    }
    for (const [id, label] of this.labels)
      if (!state?.players.some((p) => p.id === id)) {
        label.remove();
        this.labels.delete(id);
        this.positions.delete(id);
      }
    const pad = pollPad();
    this.keepTargetLock();
    if (!this.canControl()) {
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
      caster.cancel();
      touch.reset();
      castPredictor.clear();
      optimisticCooldowns.clear();
    }
    // A predicted cast the server never confirmed (it refused) ends early.
    const refused = castPredictor.expired(performance.now());
    if (refused.length && local)
      for (const action of refused)
        if (action !== "dash" && action !== "charge")
          this.readyRig(local.id, local.character)?.controller.cancel(action);
    if (!state || state.phase === "lobby") {
      this.rigs.forEach((rig) => rig.setVisible(false));
      this.labels.forEach((label) => (label.hidden = true));
      audio.setAmbience(null);
      return;
    }
    // Walls for prediction (the Shifting Ruins block comes and goes) and the floor.
    useObstacles(
      state.raid
        ? (spireCourtWalls(state.raid.spire) ??
            (state.arena === "lagoon" ||
            state.arena === "lantern-yard" ||
            state.arena === "cloud-deck" ||
            state.arena === "sun-atrium" ||
            state.arena === "sky-terrace" ||
            state.arena === "conductor-ring"
              ? []
              : OBSTACLES.filter((_, i) => !state!.raid!.pillars[i]?.broken)))
        : obstaclesAt(state.arena, arenaClock()),
    );
    useSpeedScale(state.mutators?.includes("speed") ? MUTATOR_RULES.speed : 1);
    this.showArena(
      state.arena ?? "classic",
      !!state.raid,
      spireCourtView(state.raid),
    );
    // Duel courts have their own background sound (crowd, sea, forge, wind).
    audio.setAmbience(
      this.activeCourt && !this.courtRaid ? this.activeCourt : null,
    );
    this.updateBlocks(arenaClock(), state.raid?.pillars);
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / RULES.tick) {
      this.accumulator -= 1000 / RULES.tick;
      if (!connected || state.phase !== "playing" || !local) continue;
      const active =
        this.canControl() &&
        !settingsOpen &&
        !menuOpen &&
        !$<HTMLDialogElement>("dialog").open &&
        (touch.enabled ? touch.focused : document.hasFocus()) &&
        !document.hidden;
      const enemies = visibleEnemies(local, local);
      // Gloomshade's bodies are aimed at alike (real or copy), and its unlit
      // lanterns can be locked on to (raid-targets.ts).
      // Tidewyrm's bubbles holding teammates can be locked on to too.
      const extra = raidTargets(state, local);
      const found = extra?.filter(
        (t) => t.kind === "shade" || t.kind === "boss",
      );
      const bodies = found?.length ? found : undefined;
      // A locked enemy (touch or controller) before the nearest one.
      const target =
        targetLock.resolve<Targetable>(extra ?? enemies) ??
        (bodies ? bodies[0] : enemies[0]);
      const combatActive = active && local.hp > 0 && !local.out;
      let skill = combatActive ? this.actions.skill : -1;
      // EX skills: the ultimate button before the meter is full arms an EX
      // version of your next skill (costs a third of the meter).
      const meter = local.ult ?? 0;
      let ex = false;
      if (
        skill === ULT_SLOT &&
        meter < RULES.ultMax &&
        !state.practice?.unlimitedCooldowns
      ) {
        if (meter >= EX.cost) {
          exArmedUntil = exArmedUntil
            ? 0
            : performance.now() + EX.armSeconds * 1000;
          if (exArmedUntil) audio.play("orb");
        }
        skill = -1;
      } else if (skill >= 0 && skill < ULT_SLOT && exArmedUntil) {
        if (performance.now() < exArmedUntil && meter >= EX.cost) ex = true;
        exArmedUntil = 0;
      }
      if (exArmedUntil && performance.now() >= exArmedUntil) exArmedUntil = 0;
      const keyX = heldAxis("left", "right"),
        keyY = heldAxis("up", "down");
      // Aim: touch and an idle right stick follow the nearest opponent;
      // the right stick aims by direction and tilt; otherwise the mouse.
      let aimAt = { x: aim.x, y: aim.y };
      if (touch.enabled && target) aimAt = target;
      else if (usingPad && pad?.aim) {
        const tilt = Math.hypot(pad.aim.x, pad.aim.y),
          reach = 90 + 410 * tilt;
        aimAt = {
          x: local.x + (pad.aim.x / tilt) * reach,
          y: local.y + (pad.aim.y / tilt) * reach,
        };
      } else if (usingPad && target) aimAt = target;
      else if (usingPad) aimAt = this.aimPoint;
      else if (controlPrefs().aimAssist && skill < 0)
        aimAt = assistAim(aimAt, bodies ?? enemies);
      const stormAim = state ? stormTarget(state, local.id) : undefined;
      if (stormAim) aimAt = stormAim;
      const prismAim = state ? prismatailAim(state, local) : undefined;
      if (prismAim) aimAt = prismAim;
      aimAt = {
        x: Ph.Math.Clamp(aimAt.x, 0, RULES.width),
        y: Ph.Math.Clamp(aimAt.y, 0, RULES.height),
      };
      this.aimPoint = aimAt;
      const input: Input = {
        seq: ++seq,
        dx: active ? (touch.enabled ? touch.dx : keyX || (pad?.dx ?? 0)) : 0,
        dy: active ? (touch.enabled ? touch.dy : keyY || (pad?.dy ?? 0)) : 0,
        aimX: aimAt.x,
        aimY: aimAt.y,
        basic:
          combatActive &&
          (prismAim
            ? prismAim.basic
            : (touch.enabled
                ? touch.basic
                : heldAction("basic") || !!pad?.held.has("basic")) ||
              this.actions.basic),
        skill,
        ...(ex ? { ex: true } : {}),
        dash: combatActive && this.actions.dash,
        jump: combatActive && this.actions.jump,
      };
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
      socket.emit("input", input);
      if (combatActive && coach.running) coach.note(input);
      // Show your own cast now (before this step's movement changes the
      // fighter), at the time this input is predicted to run.
      this.predictCasts(
        local,
        input,
        state.time + Math.max(1, pending.length + 1 - owedSteps) / RULES.tick,
      );
      pending.push(input);
      if (pending.length > 90) pending.shift();
      const next = newestStep(pending, owedSteps);
      if (next) predict(local, next.input, state.time + next.tick / RULES.tick);
    }
    const g = this.graphics;
    g.clear();
    this.bossGraphics.clear();
    retainBossArt(this, state.raid?.boss);
    // In raids the boss and standing scenery sort with the raiders by where they stand.
    const boss = state.raid ? state.players.find((p) => p.raidBoss) : undefined;
    this.bossGraphics.setDepth(boss ? fighterDepth(boss.y) : 0);
    this.layersUsed.clear();
    // The target button: on while an enemy stands on screen in play, lit
    // while a lock holds.
    if (touch.enabled)
      touch.setTarget(
        state.phase === "playing" &&
          !!local &&
          local.hp > 0 &&
          !local.out &&
          this.targetsOnScreen(local).length > 0,
        !!targetLock.id,
      );
    // A locked Gloomshade body (real or copy, alike), unlit lantern or
    // Tidewyrm bubble (phones).
    if (touch.enabled && targetLock.id && local) {
      const locked = raidTargets(state, local)?.find(
        (t) => t.id === targetLock.id,
      );
      if (locked)
        drawTargetReticle(
          g,
          locked.x,
          locked.feetY,
          reducedMotion ? 0 : _time / 1000,
          this.cameras.main.zoomX * this.scale.zoom,
        );
    }
    const raidCues =
      drawRaidArena(
        g,
        state,
        reducedMotion,
        _time / 1000,
        state.raid
          ? { boss: this.bossGraphics, at: this.layerAt, court: this.courtRaid }
          : undefined,
      ) ?? [];
    for (const [key, layer] of this.layers)
      if (!this.layersUsed.has(key)) layer.clear();
    for (const cue of raidCues) {
      audio.playRaid(cue);
      if (!reducedMotion && ["slam", "crash", "awaken", "fall"].includes(cue))
        this.cameras.main.shake(
          cue === "awaken" ? 230 : 150,
          cue === "crash" ? 0.004 : 0.0025,
          false,
        );
    }
    this.rigs.forEach((rig) => rig.setVisible(false));
    drawArenaLive(
      g,
      state.arena ?? "classic",
      arenaClock(),
      _time,
      !!this.activeCourt,
    );
    // Shots, zone timers and wind-ups are drawn on your timeline: where the
    // server will have them when it runs the inputs it has not answered yet,
    // as your own fighter is (networking/timeline-lead.ts). Then a shot you
    // see miss you is one the server sees miss you.
    const frameNow = performance.now();
    const live = state.phase === "playing";
    const lead = live ? timeline.lead(frameNow) : 0,
      snapshotAge = live ? timeline.age(frameNow) : 0;
    const yourTime = state.time + lead;
    if (live) {
      leadSeen.sum += lead;
      leadSeen.frames++;
    }
    // Epic and Mythical skins recolour their wearer's moves (shapes never change).
    const tints = new Map(
      state.players.map((p) => [p.id, skillColorOf(p)] as const),
    );
    const tinted = <T extends { owner: string; color: number }>(o: T): T => {
      const color = tints.get(o.owner);
      return color === undefined ? o : { ...o, color };
    };
    // A zone that follows its caster is drawn where the caster is drawn (its
    // smoothed, and for you predicted, position), not at the last snapshot,
    // so it moves with the fighter instead of trailing in steps.
    const followed = (z: Zone) => {
      const at =
        z.ability.follow || z.ability.kind === "lighthouse"
          ? this.positions.get(z.owner)
          : undefined;
      return at ? { ...z, x: at.x, y: at.y } : z;
    };
    for (const z of state.zones)
      drawZone(
        g,
        followed(tinted(z)),
        1 -
          Math.max(0, z.until - yourTime) / Math.max(0.01, z.ability.duration),
        _time,
        reducedMotion,
      );
    const walls = currentObstacles();
    const bubbles = state.zones.filter(
      (z) => z.ability.kind === "timewarp" && z.until > yourTime,
    );
    const ownerOf = new Map(state.players.map((p) => [p.id, p] as const));
    const rivals = (a: string, b: string) => {
      const pa = ownerOf.get(a),
        pb = ownerOf.get(b);
      return a !== b && (!pa || !pb || teamOf(pa) !== teamOf(pb));
    };
    for (const pr of state.projectiles) {
      const seconds = shotTimeline.seconds(
        pr,
        pr.owner === myId,
        frameNow,
        lead,
        snapshotAge,
      );
      // A time bubble slows the shots of whoever it works against.
      const bubble = bubbles.find(
        (z) =>
          rivals(z.owner, pr.owner) &&
          Math.hypot(pr.x - z.x, pr.y - z.y) < z.radius,
      );
      const slow = bubble
        ? (bubble.ability.warp ?? STATUS_RULES.warpMultiplier)
        : 1;
      const drawn = leadProjectile(pr, seconds, walls, slow);
      drawProjectile(g, tinted(drawn), _time, reducedMotion);
    }
    shotTimeline.keep(state.projectiles.map((pr) => pr.id));
    // Healing orbs: a soft green glow with a white cross, gently pulsing.
    // Energy orbs: gold with a lightning bolt (they charge the ultimate).
    for (const orb of state.orbs ?? []) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(_time / 220) * 0.12;
      if (orb.kind === "energy") {
        g.fillStyle(0xffd166, 0.2).fillCircle(orb.x, orb.y, 34 * pulse);
        g.fillStyle(0xe0a020, 0.92).fillCircle(orb.x, orb.y, 17);
        g.lineStyle(3, 0xfff1c2, 0.95).strokeCircle(orb.x, orb.y, 17);
        g.fillStyle(0xffffff, 1).fillPoints(
          [
            { x: orb.x + 3, y: orb.y - 12 },
            { x: orb.x - 7, y: orb.y + 2 },
            { x: orb.x - 1, y: orb.y + 2 },
            { x: orb.x - 4, y: orb.y + 12 },
            { x: orb.x + 7, y: orb.y - 3 },
            { x: orb.x + 1, y: orb.y - 3 },
          ],
          true,
        );
        continue;
      }
      g.fillStyle(0x7dffb0, 0.18).fillCircle(orb.x, orb.y, 34 * pulse);
      g.fillStyle(0x3ccf7a, 0.9).fillCircle(orb.x, orb.y, 17);
      g.lineStyle(3, 0xd9ffe9, 0.9).strokeCircle(orb.x, orb.y, 17);
      g.fillStyle(0xffffff, 1)
        .fillRect(orb.x - 3, orb.y - 10, 6, 20)
        .fillRect(orb.x - 10, orb.y - 3, 20, 6);
    }
    // 2v2 team-up: a soft link between partners standing close together.
    if (isTeams() && state.phase === "playing")
      for (const team of [0, 1]) {
        const pair = state.players.filter(
          (p) => teamOf(p) === team && p.hp > 0 && !p.out,
        );
        if (
          pair.length === 2 &&
          Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) <=
            TEAMUP.range
        )
          g.lineStyle(4, team === 0 ? 0x5ab0ff : 0xff5d6c, 0.35).lineBetween(
            pair[0].x,
            pair[0].y + 12,
            pair[1].x,
            pair[1].y + 12,
          );
      }
    // Orb Rush: goals (in each side's colour), gems, and gems being carried.
    if (state.gems) {
      const goals = rushGoals(state.mode);
      goals.forEach((goal, side) => {
        if (state!.mode === "ffa" && side >= state!.players.length) return;
        const owner = state!.players.find((p) => teamOf(p) === side);
        const color =
          state!.mode === "ffa" && owner
            ? CHARACTERS[owner.character].color
            : side === 0
              ? 0x5ab0ff
              : 0xff5d6c;
        g.fillStyle(color, 0.12).fillCircle(goal.x, goal.y, RUSH.goalRadius);
        g.lineStyle(3, color, 0.7).strokeCircle(
          goal.x,
          goal.y,
          RUSH.goalRadius,
        );
      });
      const bob = reducedMotion ? 0 : Math.sin(_time / 200) * 3;
      const diamond = (x: number, y: number, r: number) => [
        { x, y: y - r },
        { x: x + r * 0.7, y },
        { x, y: y + r },
        { x: x - r * 0.7, y },
      ];
      for (const gem of state.gems) {
        const y = gem.y + bob;
        g.fillStyle(0xc58cff, 0.22).fillCircle(gem.x, y, 22);
        g.fillStyle(0xb06cff, 1).fillPoints(diamond(gem.x, y, 14), true);
        g.lineStyle(2, 0xf1e2ff, 0.9).strokePoints(diamond(gem.x, y, 14), true);
      }
      for (const p of state.players) {
        const n = Math.min(p.gems ?? 0, 6);
        for (let i = 0; i < n; i++)
          g.fillStyle(0xb06cff, 1).fillPoints(
            diamond(p.x - ((n - 1) * 9) / 2 + i * 9, p.y - 62, 6),
            true,
          );
      }
    }
    // Crown Hill: the circle to hold, with each side's progress as an arc.
    drawArcade(g, state, reducedMotion);
    if (state.crown) {
      const hill = state.arcade?.hill ?? CROWN;
      const targetSeconds = state.arcade?.hill?.target ?? CROWN.holdSeconds;
      const pulse = reducedMotion ? 0.6 : 0.5 + Math.sin(_time / 260) * 0.2;
      g.fillStyle(0xffd166, 0.07).fillCircle(hill.x, hill.y, hill.radius);
      g.lineStyle(3, 0xffd166, pulse).strokeCircle(hill.x, hill.y, hill.radius);
      state.crown.forEach((held, side) => {
        if (held <= 0) return;
        const holder = state!.players.find((p) => teamOf(p) === side);
        const color = isTeams()
          ? side === 0
            ? 0x5ab0ff
            : 0xff5d6c
          : holder
            ? CHARACTERS[holder.character].color
            : 0xffffff;
        const r = hill.radius + 8 + side * 7;
        g.lineStyle(5, color, 0.95);
        g.beginPath();
        g.arc(
          hill.x,
          hill.y,
          r,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * held) / targetSeconds,
        );
        g.strokePath();
      });
    }
    // The closing ring: shade everything outside the safe circle.
    const ring =
      state.phase === "playing" && !state.practice && !state.raid
        ? ringRadius(state.remaining, state.overtime)
        : null;
    if (ring !== null) {
      const beat = reducedMotion ? 0.5 : 0.5 + Math.sin(_time / 180) * 0.5;
      // Shade outside the ring as edge-to-edge wedges (no overlaps, so the
      // translucent shade stays even).
      g.fillStyle(0x6b1030, 0.32);
      const far = 2200,
        steps = 72;
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2,
          a1 = ((i + 1) / steps) * Math.PI * 2;
        g.fillPoints(
          [
            {
              x: RING.x + Math.cos(a0) * ring,
              y: RING.y + Math.sin(a0) * ring,
            },
            {
              x: RING.x + Math.cos(a1) * ring,
              y: RING.y + Math.sin(a1) * ring,
            },
            { x: RING.x + Math.cos(a1) * far, y: RING.y + Math.sin(a1) * far },
            { x: RING.x + Math.cos(a0) * far, y: RING.y + Math.sin(a0) * far },
          ],
          true,
        );
      }
      g.lineStyle(5, 0xff5d73, 0.55 + 0.4 * beat).strokeCircle(
        RING.x,
        RING.y,
        ring,
      );
    }
    // Aim preview: where the held skill lands if released now (dim while recharging).
    const previewer = state.players.find((p) => p.id === myId);
    if (caster.aiming >= 0 && local && previewer && this.canControl()) {
      const ability = CHARACTERS[local.character].skills[caster.aiming];
      if (ability)
        drawPreview(
          g,
          previewShape(ability, local, this.aimPoint),
          CHARACTERS[local.character].color,
          skillReady(
            previewer,
            caster.aiming,
            state.time,
            !!state.practice?.unlimitedCooldowns,
          ),
        );
    }
    // Ambient costume effects for at most two living fighters (you first).
    // Mythical ornaments and the compact Epic signatures still animate
    // outside this budget.
    const ambient = new Set(
      [...state.players]
        .filter((q) => {
          const art = wornArt(q.character, q.championLooks?.[q.character]);
          return q.hp > 0 && (art?.mythic || art?.signature);
        })
        .sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
        .slice(0, battleQuality.knobs().mythicAmbient)
        .map((q) => q.id),
    );
    const sampledAt = performance.now();
    for (const serverPlayer of state.players) {
      const p = serverPlayer.id === myId && local ? local : serverPlayer;
      let pos = this.positions.get(p.id);
      if (!pos || state.phase !== "playing") pos = { x: p.x, y: p.y };
      const factor = 1 - Math.exp(-delta / 30);
      const interpolated =
        p.id !== myId && state.phase === "playing"
          ? remoteFrames.sample(p.id, sampledAt)
          : undefined;
      if (stopped) {
        // Hit-stop: hold everyone in place for a few frames.
      } else if (interpolated) {
        pos.x = interpolated.x;
        pos.y = interpolated.y;
        p.angle = interpolated.angle;
      } else {
        pos.x += (p.x - pos.x) * factor;
        pos.y += (p.y - pos.y) * factor;
      }
      this.positions.set(p.id, pos);
      if (p.id === myId && state.phase === "playing") {
        drawnSelf.push({ t: sampledAt, x: pos.x, y: pos.y });
        if (drawnSelf.length > 150) drawnSelf.splice(0, 30);
      }
      const x = pos.x,
        y = pos.y,
        c = CHARACTERS[p.character];
      if (serverPlayer.raidBoss) continue;
      // A climb's Echoes fade out once it ends (not frozen over the results).
      const shown = echoShown(state, serverPlayer, sampledAt);
      const serverTime = state.time;
      const airborne = serverPlayer.jumpUntil - serverTime;
      // Static Glide keeps a fighter airborne longer than a jump: it lifts,
      // sails at a steady height and settles, instead of following the jump arc.
      let glide = gliding.get(p.id);
      if (
        airborne > RULES.jumpDuration + 0.05 &&
        glide?.until !== serverPlayer.jumpUntil
      )
        gliding.set(
          p.id,
          (glide = { until: serverPlayer.jumpUntil, start: state.time }),
        );
      const isGliding =
        !!glide && glide.until === serverPlayer.jumpUntil && airborne > 0;
      const jump = isGliding
        ? 34 *
            Math.min(1, (state.time - glide!.start) / 0.2) *
            Math.min(1, airborne / 0.3) +
          Math.sin(state.time * 9) * 2
        : airborne > 0
          ? Math.sin((1 - airborne / RULES.jumpDuration) * Math.PI) * 45
          : 0;
      const pose = {
        hp: p.hp,
        // Spire Echoes: the champion in a dark violet shade (pale on
        // zone 3's dark court).
        ...(serverPlayer.echo ? spireEchoTint(this.spireView?.zone) : {}),
        look: p.raidLook,
        skin: p.championLooks?.[p.character] ?? null,
        ambient: ambient.has(p.id),
        speed: Math.hypot(p.vx, p.vy),
        angle: p.angle,
        // A glide spreads the glider membranes (the dash pose).
        dash: serverPlayer.dashUntil > state.time || isGliding,
        jump: serverPlayer.jumpUntil > state.time && !isGliding,
        shell: serverPlayer.statuses.some(
          (s) => s.kind === "shell" && s.until > serverTime,
        ),
        // Curled into a ball (Curl & Roll, Pinball): it spins as it travels.
        ball:
          (serverPlayer.roll && serverPlayer.roll.until > serverTime) ||
          (serverPlayer.pinball && serverPlayer.dashUntil > serverTime)
            ? ballSpin(
                p.id,
                Math.hypot(p.vx, p.vy),
                serverPlayer.roll?.heading ?? Math.atan2(p.vy, p.vx),
              )
            : undefined,
        charging: !!serverPlayer.charge,
        ultReady:
          (serverPlayer.ult ?? 0) >= RULES.ultMax && serverPlayer.hp > 0,
        greet: state.phase === "countdown",
        victory:
          isTeams() || !!state.raid
            ? (state.phase === "finished"
                ? state.winnerTeam
                : state.phase === "intermission"
                  ? state.roundWinnerTeam
                  : null) === teamOf(p) && p.hp > 0
            : (state.phase === "finished"
                ? state.winner
                : state.phase === "intermission"
                  ? state.roundWinner
                  : null) === p.id,
      };
      const clone =
        serverPlayer.clone && this.readyRig(`${p.id}:clone`, p.character);
      if (serverPlayer.clone && clone) {
        clone.root.setScale(view.fighterX * 0.7, view.fighterY * 0.7);
        clone.setVisible(true);
        clone.render(
          {
            ...pose,
            hp: 1,
            speed: 0,
            dash: false,
            jump: false,
            charging: false,
            victory: false,
            ultReady: false,
            greet: false,
          },
          serverPlayer.clone.x,
          serverPlayer.clone.y,
          this.feelClock,
          0.3,
          reducedMotion,
        );
      }
      // The Spire's elite captain stands bigger than a champion (its hit
      // area grows the same on the server: SpireArena.hitRadius).
      const giant =
        (state.mutators?.includes("giants") ? MUTATOR_RULES.giants : 1) *
        (serverPlayer.elite ? SPIRE_PARTY.eliteScale : 1);
      const feetY = y + WORLD_ART.fighterFeet * view.fighterY * 0.7 * giant;
      g.fillStyle(0x081f19, 0.45 * shown).fillEllipse(
        x,
        feetY,
        48 - jump * 0.2,
        18 - jump * 0.1,
      );
      g.lineStyle(
        2,
        p.id === myId
          ? 0xffffff
          : serverPlayer.echo
            ? 0xff5d6c
            : isTeams()
              ? teamOf(p) === myTeam
                ? 0x5ab0ff
                : 0xff5d6c
              : c.color,
        (isTeams() || serverPlayer.echo ? 0.8 : 0.55) * shown,
      ).strokeEllipse(x, feetY, 72, groundHeight(72));
      if (serverPlayer.echo && serverPlayer.hp > 0 && shown >= 1) {
        // An Echo: a violet ring (the captain's doubled) and a dark wisp
        // under it, through the effects engine (Low's budget sees it).
        g.lineStyle(
          serverPlayer.elite ? 4 : 2,
          ECHO_SKILL_COLOR,
          0.7,
        ).strokeEllipse(x, feetY, 84, groundHeight(84));
        const fx = fxFor(this);
        fx.glow(
          x,
          feetY,
          serverPlayer.elite ? 42 : 30,
          ECHO_SKILL_COLOR,
          0.3,
          true,
        );
        fx.soft(x, y - jump - 28, 30, 0x160c2c, 0.22);
      }
      // The enemy you locked on to (phones): turning corner brackets.
      if (
        p.id === targetLock.id &&
        touch.enabled &&
        p.hp > 0 &&
        !serverPlayer.statuses.some((s) => s.kind === "stealth")
      )
        drawTargetReticle(
          g,
          x,
          feetY,
          reducedMotion ? 0 : _time / 1000,
          this.cameras.main.zoomX * this.scale.zoom,
        );
      // Mastery flair: an outer ring in the tier's colour (Crystal shimmers).
      if (serverPlayer.flair) {
        const tier = MASTERY_TIERS.find((t) => t.name === serverPlayer.flair);
        if (tier) {
          const colour =
            tier.name === "Crystal" && !reducedMotion
              ? Ph.Display.Color.HSVToRGB((_time / 2400) % 1, 0.45, 1).color
              : Number.parseInt(tier.color.slice(1), 16);
          g.lineStyle(2, colour, 0.75).strokeEllipse(
            x,
            feetY,
            86,
            groundHeight(86),
          );
          if (tier.name === "Gold" || tier.name === "Crystal")
            g.lineStyle(6, colour, 0.18).strokeEllipse(
              x,
              feetY,
              90,
              groundHeight(90),
            );
        }
      }
      if (p.dashUntil > state.time && !reducedMotion) {
        g.fillStyle(c.color, 0.18).fillEllipse(
          x - p.vx * 0.035,
          y - p.vy * 0.035,
          48,
          38,
        );
      }
      const rig = shown > 0 ? this.readyRig(p.id, p.character) : undefined;
      if (rig) {
        // The rig keeps this as its base scale (squash and stretch multiply it).
        rig.root.setScale(
          view.fighterX * 0.7 * giant,
          view.fighterY * 0.7 * giant,
        );
        rig.setVisible(true);
        // On the coliseum court fighters sort with the blocks by where they stand.
        rig.setDepth(this.activeCourt || state?.raid ? fighterDepth(y) : 2);
        const casting =
          rig.controller.state === "basic" ||
          rig.controller.state.startsWith("skill") ||
          pose.charging;
        rig.render(
          {
            ...pose,
            angle:
              pose.speed > 12 && !casting ? Math.atan2(p.vy, p.vx) : p.angle,
          },
          x,
          y - jump,
          this.feelClock,
          (serverPlayer.statuses.some((s) => s.kind === "stealth")
            ? p.id === myId
              ? 0.5
              : 0.12
            : 1) * shown,
          reducedMotion,
        );
        if ((this.flashUntil.get(p.id) ?? 0) > feelNow) flashWhite(rig.root);
        // The captain: a crown of violet crystals over its head (in front
        // of the rig) and a small halo through the effects engine.
        if (
          serverPlayer.elite &&
          serverPlayer.hp > 0 &&
          shown >= 1 &&
          rig.front
        )
          drawEliteCrown(
            rig.front,
            fxFor(this),
            x,
            y -
              jump -
              (fighterPack(p.character)?.kind === "layered" ? 30 : 46) * giant,
            giant,
            reducedMotion ? 0 : _time / 1000,
          );
        // After render (it clears the rig's layers): the aura's near items
        // pass in front of the fighter, the rest go round behind. Sized to
        // the fighter as in the Lobby, Shop and Wardrobe (battleAuraScale),
        // a giant's too: drawn at the feet on scaled layers.
        if (p.raidLook?.aura) {
          const layers = rig.front ? [g, rig.front] : [g];
          for (const layer of layers)
            layer
              .save()
              .translateCanvas(x, feetY)
              .scaleCanvas(
                battleAuraScale(view.fighterX * 0.7 * giant),
                battleAuraScale(view.fighterY * 0.7 * giant),
              );
          // On the shadow's plane (48×18 at the feet): same flatness.
          drawCollectionAura(
            g,
            p.raidLook.aura,
            0,
            0,
            _time,
            reducedMotion,
            rig.front,
            18 / 48,
            0,
          );
          for (const layer of layers) layer.restore();
        }
      } else if (shown > 0) {
        // Its art is still loading (or failed): a plain stand-in in the
        // fighter's colour where the rig would stand, never missing textures.
        const alpha = serverPlayer.statuses.some((s) => s.kind === "stealth")
          ? p.id === myId
            ? 0.5
            : 0.12
          : 1;
        const r = 24 * giant * view.fighterX;
        g.fillStyle(c.color, 0.85 * alpha).fillEllipse(
          x,
          y - jump - r * 1.1,
          r * 1.6,
          r * 2.2,
        );
        g.lineStyle(2, 0xffffff, 0.7 * alpha).strokeEllipse(
          x,
          y - jump - r * 1.1,
          r * 1.6,
          r * 2.2,
        );
      }
      if (serverPlayer.statuses.some((s) => s.kind === "shield")) {
        g.fillStyle(c.color, 0.1).fillCircle(x, y - jump - 10, 46);
        g.lineStyle(3, c.color, 0.8).strokeCircle(x, y - jump - 10, 46);
      }
      if (serverPlayer.statuses.some((s) => s.kind === "counter"))
        g.lineStyle(
          3,
          0xffffff,
          0.55 + Math.sin(_time / 60) * 0.25,
        ).strokeCircle(x, y - jump - 10, 40);
      // Rooted: bark roots coil up round the feet until it wears off.
      if (
        serverPlayer.statuses.some(
          (s) => s.kind === "root" && s.until > state!.time,
        )
      ) {
        g.lineStyle(3, 0x7fcf6a, 0.7).strokeEllipse(
          x,
          feetY,
          70,
          groundHeight(70),
        );
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3,
            bx = x + Math.cos(a) * 30,
            by = feetY + Math.sin(a) * groundHeight(30),
            lean = -Math.cos(a) * 8;
          g.lineStyle(5, 0x2a1a0e, 0.85).lineBetween(
            bx,
            by,
            bx + lean,
            by - 20,
          );
          g.lineStyle(3, 0x8a5a30, 1).lineBetween(bx, by, bx + lean, by - 20);
          g.fillStyle(0x7fcf6a, 1).fillCircle(bx + lean, by - 21, 2.6);
        }
      }
      if (serverPlayer.statuses.some((s) => s.kind === "empower"))
        g.lineStyle(2, 0xffb347, 0.7).strokeEllipse(
          x,
          feetY,
          84,
          groundHeight(84),
        );
      if (serverPlayer.channel) {
        const cone = c.skills[serverPlayer.channel.skill];
        if (cone)
          drawChannel(g, cone, x, y, p.angle, c.color, _time, reducedMotion);
      }
      if (serverPlayer.charge) {
        // Wind-up telegraph showing the real area of the incoming move.
        const windup = c.skills[serverPlayer.charge.skill];
        if (windup)
          drawWindup(
            g,
            windup,
            x,
            y,
            p.angle,
            serverPlayer.lastInput.aimX,
            serverPlayer.lastInput.aimY,
            c.color,
            1 -
              (serverPlayer.charge.at - yourTime) / Math.max(0.01, windup.cast),
            _time,
          );
      }
      // Combo marks: a spinning target over whoever is primed for a payoff.
      for (const s of serverPlayer.statuses)
        if (s.kind === "mark" && s.until > state.time) {
          const marker = state.players.find((q) => q.id === s.by);
          if (marker)
            drawComboMark(
              g,
              x,
              y - jump - 84,
              CHARACTERS[marker.character].color,
              _time,
              s.by === myId || p.id === myId,
            );
        }
      // A combo that pays off on any harmful status (anyDebuff): show it to them.
      if (
        me &&
        p.id !== myId &&
        COMBOS[me.character].anyDebuff &&
        (!isTeams() || teamOf(p) !== myTeam) &&
        serverPlayer.statuses.some(
          (s) => s.until > state!.time && DEBUFFS.includes(s.kind),
        )
      )
        drawComboMark(
          g,
          x,
          y - jump - 84,
          CHARACTERS[me.character].color,
          _time,
          true,
        );
      for (const [i, s] of serverPlayer.statuses.entries()) {
        const colors = {
          burn: 0xff795a,
          slow: 0x63dce8,
          freeze: 0x9fefff,
          stun: 0xffd65b,
          paralysis: 0xffd65b,
          sleep: 0x8fa6d8,
          drowsy: 0xc9a3ff,
          shell: 0xc79a5b,
          shield: 0xc77dff,
          counter: 0x78c7ef,
          empower: 0xffb347,
          haste: 0x8ee6ad,
          stealth: 0xa98be6,
          root: 0x7fcf6a,
          warp: 0xc9b6ff,
          taunt: 0xff5a5a,
          brace: 0xb08850,
          leash: 0x9fb4ff,
          blind: 0x3a2a5a,
          clamp: 0x9fe8ff,
          cage: 0xbfe6ff,
          current: 0x4fc3f7,
          float: 0xe8e0ff,
          confuse: 0xff9de2,
          mark: 0xffffff,
        };
        g.fillStyle(colors[s.kind]).fillCircle(
          x - 18 + i * 10,
          y - 60 - jump,
          4,
        );
      }
      // Gill Siphon: the stream to the enemy it holds.
      if (serverPlayer.tether) {
        const to = this.positions.get(serverPlayer.tether.target);
        if (to)
          drawSiphon(
            this,
            x,
            y - jump,
            to.x,
            to.y,
            reducedMotion ? 0 : _time,
            CHARACTERS[p.character].color,
          );
      }
      // Mind Maze: little question marks circling its head while confused.
      if (
        serverPlayer.statuses.some(
          (s) => s.kind === "confuse" && s.until > serverTime,
        )
      ) {
        const spin = reducedMotion ? 0 : _time / 260;
        for (let k = 0; k < 3; k++) {
          const a0 = spin + (k * Math.PI * 2) / 3,
            qx = x + Math.cos(a0) * 20,
            qy = y - 66 - jump + Math.sin(a0) * 6;
          g.lineStyle(3, 0xff9de2, 0.95);
          g.beginPath();
          g.arc(qx, qy - 4, 4, Math.PI, Math.PI * 0.4, false);
          g.lineTo(qx, qy + 2);
          g.strokePath();
          g.fillStyle(0xff9de2, 0.95).fillCircle(qx, qy + 6, 1.6);
        }
      }
      // Moon Gravity: a floating fighter hovers over a soft shadow.
      if (
        serverPlayer.statuses.some(
          (s) => s.kind === "float" && s.until > serverTime,
        )
      ) {
        const bob = reducedMotion ? 0 : Math.sin(_time / 180) * 3;
        g.lineStyle(2, 0xe8e0ff, 0.7).strokeEllipse(
          x,
          y + 14 + bob * 0.3,
          52,
          16,
        );
        g.fillStyle(0xe8e0ff, 0.15).fillEllipse(x, y + 14, 44, 12);
      }
      // Static Clamp: a crackling ring that tightens as the charge runs out.
      const clamp = serverPlayer.statuses.find(
        (s) => s.kind === "clamp" && s.until > serverTime,
      );
      if (clamp) {
        const left = Math.max(0, clamp.until - serverTime),
          flick = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(_time / 30);
        const r = 22 + 16 * Math.min(1, left / 1.5);
        // The charge sizzles, faster as it runs out.
        if (!reducedMotion)
          fxFor(this).trail(
            `clamp-${p.id}`,
            0.05 + 0.1 * Math.min(1, left),
            () =>
              fxFor(this).burst({
                x,
                y,
                z: 30,
                count: 1,
                kind: "spark",
                color: [0xffffff, 0x9fe8ff],
                speed: [60, 160],
                up: [60, 180],
                life: [0.2, 0.4],
                size: [0.8, 1.4],
                grav: 1000,
                bounce: 0.4,
              }),
          );
        g.lineStyle(7, 0x2b6f8f, 0.35 * flick).strokeCircle(
          x,
          y - 18 - jump,
          r,
        );
        g.lineStyle(3.5, 0x9fe8ff, 0.95 * flick).strokeCircle(
          x,
          y - 18 - jump,
          r,
        );
        for (let k = 0; k < 4; k++) {
          const a0 = (reducedMotion ? 0 : _time / 160) + (k * Math.PI) / 2;
          g.lineStyle(2, 0xffffff, 0.8 * flick).lineBetween(
            x + Math.cos(a0) * r,
            y - 18 - jump + Math.sin(a0) * r,
            x + Math.cos(a0 + 0.35) * (r - 7),
            y - 18 - jump + Math.sin(a0 + 0.35) * (r - 7),
          );
        }
      }
      // Kraken Grasp: a tentacle round the enemy it holds.
      if (serverPlayer.grab) {
        const to = this.positions.get(serverPlayer.grab.target);
        if (to) {
          const wob = reducedMotion ? 0 : Math.sin(_time / 60) * 8;
          const mx = (x + to.x) / 2 + wob,
            my = (y + to.y) / 2 - 24;
          const curve = new Ph.Curves.QuadraticBezier(
            new Ph.Math.Vector2(x, y - 14 - jump),
            new Ph.Math.Vector2(mx, my),
            new Ph.Math.Vector2(to.x, to.y - 14),
          );
          g.lineStyle(9, 0x2a1240, 0.9);
          curve.draw(g, 16);
          g.lineStyle(5, 0x9a6ad8, 1);
          curve.draw(g, 16);
          g.lineStyle(3, 0x9a6ad8, 1).strokeCircle(to.x, to.y - 16, 20);
          // Suckers along the arm, and ink dripping from it.
          for (let k = 2; k < 15; k += 3) {
            const q = curve.getPoint(k / 16);
            g.fillStyle(0xe4d6ff, 0.9).fillCircle(q.x, q.y + 2, 2);
          }
          if (!reducedMotion)
            fxFor(this).trail(`grasp-${p.id}`, 0.08, () => {
              const q = curve.getPoint(0.3 + Math.random() * 0.6);
              fxFor(this).burst({
                x: q.x,
                y: q.y + 14,
                z: 14,
                count: 1,
                kind: "drop",
                color: [0x150b26, 0x2a1450],
                speed: [5, 25],
                up: [0, 30],
                life: [0.3, 0.5],
                size: [1.6, 2.6],
                grav: 1100,
              });
            });
        }
      }
      // Pinning Quill: a taut line back to the quill that pins it.
      const pin = serverPlayer.statuses.find(
        (s) => s.kind === "leash" && s.until > serverTime && s.tx !== undefined,
      );
      if (pin) {
        g.lineStyle(2, 0x9fb4ff, 0.8).lineBetween(
          x,
          y - jump,
          pin.tx!,
          pin.ty!,
        );
        g.fillStyle(0xffe58f, 1).fillCircle(pin.tx!, pin.ty!, 4);
        g.lineStyle(2, 0x9fb4ff, 0.55).strokeCircle(
          pin.tx!,
          pin.ty!,
          pin.amount ?? 110,
        );
      }
      // Passives everyone can read: Pangrove's plates (lit leaves, dim when
      // broken) and Mossloth's moss (tufts, and a green ring at its feet).
      const passive = CHARACTERS[p.character].passive;
      // (Under the feet: the nameplate covers the space above the head.)
      if (passive === "plates" && serverPlayer.hp > 0) {
        const n = platesOf(serverPlayer);
        for (let i = 0; i < PLATES.max; i++) {
          const px = x - 14 + i * 14,
            py = y + 42;
          const leafPts = [
            { x: px, y: py - 6 },
            { x: px + 5, y: py },
            { x: px, y: py + 6 },
            { x: px - 5, y: py },
          ];
          if (i < n) g.fillStyle(0x9be37a, 1).fillPoints(leafPts, true);
          g.lineStyle(1.5, 0x2a1a0e, i < n ? 0.9 : 0.5).strokePoints(
            leafPts,
            true,
          );
        }
      } else if (passive === "moss" && serverPlayer.hp > 0) {
        const moss = serverPlayer.moss ?? 0;
        if (moss > 0)
          g.lineStyle(2 + moss, 0x6fbf5a, 0.18 + 0.07 * moss).strokeEllipse(
            x,
            y + 26,
            50,
            18,
          );
        for (let i = 0; i < MOSS.max; i++)
          g.fillStyle(
            i < moss ? 0x8fd36a : 0x2f4a2a,
            i < moss ? 1 : 0.6,
          ).fillCircle(x - 16 + i * 8, y + 42, 3);
      }
      let label = this.labels.get(p.id);
      if (!label) {
        label = document.createElement("div");
        label.className = "player-nameplate battle-nameplate";
        // Quick chat in a battle finds the speaker's plate by this.
        label.dataset.fighter = p.id;
        $("game").parentElement!.append(label);
        this.labels.set(p.id, label);
      }
      updateNameplate(
        label,
        p.name,
        p.title,
        p.titleColor,
        p.id === myId,
        reducedMotion,
      );
      updateNameplateHealth(
        label,
        serverPlayer.hp,
        maxHealth(p.character, state.mode, state.players.length),
        p.id === myId
          ? "self"
          : (state.raid && !serverPlayer.echo) ||
              (isTeams() && teamOf(p) === myTeam)
            ? "ally"
            : "enemy",
      );
      // Canvas pixels → CSS pixels for the HTML nameplates.
      const css = this.scale.zoom;
      const labelX = ((x - view.x) * view.zoomX + this.scale.width / 2) * css;
      const labelY =
        ((y -
          jump -
          view.y -
          // Leave room below the health row for the status markers.
          (fighterPack(p.character)?.kind === "layered" ? 68 : 90) * giant) *
          view.zoomY +
          this.scale.height / 2) *
        css;
      // Decide first whether the plate shows: a hidden plate is never
      // measured or moved. A plate not yet measured on screen (a fighter
      // off screen from the start, or joining there) measured 0, which is
      // not cached, so it forced a page layout every frame until it showed.
      const hidden =
        labelX < 0 ||
        labelX > this.scale.width * css ||
        labelY > this.scale.height * css ||
        // Off screen, a fighter shows no name or health (only the arrow
        // says which way): where they are and how hurt they are stays a
        // guess (owner, 8 Nov 2026). Before, a name above the screen hung
        // under the badge with no one beneath it.
        (p.id !== myId &&
          outsideView(x, y, this.scale.width, this.scale.height, view)) ||
        serverPlayer.statuses.some(
          (s) => s.kind === "stealth" && p.id !== myId,
        ) ||
        shown <= 0;
      label.hidden = hidden;
      setHudStyle(label, "opacity", p.hp > 0 ? "1" : "0.4");
      label.classList.toggle(
        "team-ally",
        isTeams() && p.id !== myId && teamOf(p) === myTeam,
      );
      label.classList.toggle(
        "team-enemy",
        (isTeams() && teamOf(p) !== myTeam) || !!serverPlayer.echo,
      );
      if (hidden) {
        // Takes no room: the off-screen arrow ignores a plate with no width.
        this.plates.set(p.id, { x: labelX, bottom: labelY, w: 0, h: 0 });
        continue;
      }
      const plateBottom = Math.max(
        nameplateFloor(label, p.title ?? "", labelX),
        labelY,
      );
      label.style.transform = `translate3d(${labelX}px, ${plateBottom}px, 0) translate(-50%, -100%)`;
      const plateSize = nameplateSize(label, p.title ?? "");
      this.plates.set(p.id, {
        x: labelX,
        bottom: plateBottom,
        w: plateSize.w,
        h: plateSize.h,
      });
    }
    if (touch.enabled) return;
    g.lineStyle(1, 0xffffff, 0.6).strokeCircle(aim.x, aim.y, 10);
    g.lineBetween(aim.x - 15, aim.y, aim.x - 6, aim.y);
    g.lineBetween(aim.x + 6, aim.y, aim.x + 15, aim.y);
  }
}
/**
 * The champions a battle needs loaded: those on the court, and a Spire
 * climb's whole roster (its Echoes appear mid-fight, their art must not).
 */
function sceneFighters(s: Snapshot) {
  return neededFighters([
    ...s.players,
    ...(s.raid?.spire?.roster ?? []).map((character) => ({ character })),
  ]);
}
/** A fighter's skill colour: a worn skin's, or the Echoes' violet. */
function skillColorOf(p: Fighter) {
  return p.echo ? ECHO_SKILL_COLOR : fighterSkillColor(p);
}
/** Floors are baked at 2x on dense screens so they stay sharp when zoomed. */
/**
 * Depth for things standing on the court: a narrow band around the rigs'
 * usual depth (2), ordered by ground y, so effects drawn above (3+) and
 * floor marks below (<1) keep their places.
 */
function fighterDepth(y: number) {
  return 2 + y / 10000;
}
/**
 * Floor (and court block) pixels per world pixel: the battle canvas's own
 * density, in quarter steps. A phone's camera zooms in at most 1.65× on a
 * screen at most ~930 CSS px wide, so the court never needs more texels than
 * that; a flat 2× cost an iPhone two 23 MB copies of a 3200×1800 floor.
 */
function floorBake() {
  return Math.min(2, Math.max(1, Math.round(renderScale() * 4) / 4));
}
/** Seconds into the live round on the server's clock (-1 when not live). */
function arenaClock() {
  return state?.phase === "playing"
    ? state.time - (state.hazardClock ?? 0)
    : -1;
}
/** The moving parts of an arena: the shifting block and hazard telegraphs. */
function drawArenaLive(
  g: Phaser.GameObjects.Graphics,
  id: ArenaId,
  t: number,
  time: number,
  /** On a painted court the risen block is its own picture (see updateBlocks). */
  painted = false,
) {
  const arena = ARENAS[id];
  const wobble = reducedMotion ? 0 : Math.sin(time / 40) * 2;
  if (arena.shifting) {
    const r = arena.shifting.rect;
    if (shiftingUp(arena, t)) {
      if (painted) {
        // Nothing to draw: the block picture stands in its pit.
      } else {
        g.fillStyle(0x10170f, 0.35).fillEllipse(
          r.x + r.w / 2 + 10,
          r.y + r.h + 6,
          r.w + 40,
          34,
        );
        g.fillStyle(0x7f6f55).fillRoundedRect(r.x, r.y, r.w, r.h, 12);
        g.fillStyle(0x968566).fillRoundedRect(
          r.x + 5,
          r.y + 5,
          r.w - 10,
          r.h - 22,
          9,
        );
        g.fillStyle(0xc9b892).fillRoundedRect(
          r.x + 6,
          r.y + 4,
          r.w - 12,
          22,
          8,
        );
        g.lineStyle(2, 0x5e523d, 0.8)
          .lineBetween(r.x + 20, r.y + 40, r.x + 34, r.y + 66)
          .lineBetween(r.x + 34, r.y + 66, r.x + 26, r.y + 86);
      }
    } else {
      const rising = shiftingRisesIn(arena, t);
      if (t >= 0 && rising <= arena.shifting.warn) {
        // About to rise: rumbling outline and dust.
        const a = 0.5 + 0.4 * Math.sin(time / 60);
        g.lineStyle(4, 0xffd65b, a).strokeRoundedRect(
          r.x + wobble,
          r.y,
          r.w,
          r.h,
          12,
        );
        g.fillStyle(0xc9b892, 0.25).fillRoundedRect(r.x, r.y, r.w, r.h, 12);
      }
    }
  }
  if (t < 0) return;
  for (const h of arena.hazards) {
    const next = hazardIn(h, t);
    if (next > h.warn) continue;
    const k = 1 - next / h.warn; // 0 → 1 as it fires
    const color = h.kind === "vent" ? 0xff7a3d : 0x9fefff;
    g.fillStyle(color, 0.12 + 0.25 * k).fillCircle(h.x, h.y, h.radius);
    g.lineStyle(3, color, 0.5 + 0.5 * k).strokeCircle(
      h.x,
      h.y,
      h.radius * (0.4 + 0.6 * k),
    );
    g.lineStyle(2, 0xffffff, 0.35 + 0.4 * k).strokeCircle(h.x, h.y, h.radius);
  }
}
/** Name of the combo whose mark `by` places (their fighter's combo). */
function comboOf(by?: string) {
  const marker = state?.players.find((p) => p.id === by);
  return marker ? COMBOS[marker.character].name : "Marked";
}
/** A small spinning target: "this fighter is primed for a combo". */
function drawComboMark(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  time: number,
  mine: boolean,
) {
  const spin = reducedMotion ? 0 : time / 380;
  const r = mine ? 11 : 9;
  const alpha = mine ? 0.95 : 0.6;
  g.lineStyle(2.5, color, alpha).strokeCircle(x, y, r);
  g.fillStyle(0xffffff, alpha).fillCircle(x, y, 2.5);
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    g.lineBetween(
      x + Math.cos(a) * (r - 3),
      y + Math.sin(a) * (r - 3),
      x + Math.cos(a) * (r + 5),
      y + Math.sin(a) * (r + 5),
    );
  }
}
/** Paint a fighter solid white for this frame (the rig resets tint each render). */
function flashWhite(root: Phaser.GameObjects.Container) {
  for (const child of root.list) {
    if (child instanceof Ph.GameObjects.Container) flashWhite(child);
    else (child as Phaser.GameObjects.Image).setTintFill?.(0xffffff);
  }
}
/**
 * Canvas pixels per CSS pixel. Phones have 2–3x screens; rendering at that density
 * keeps creatures, effects and text sharp. Capped at 2 to protect frame rate,
 * and at 1.5 at Low battle graphics (battle-quality.ts), as on iPhones.
 */
function renderScale() {
  const density = Math.min(rendererDensity(), battleQuality.knobs().density);
  // Drawn by the processor (gpu-check.ts) at Low: every pixel costs CPU
  // time, so a large monitor draws the court a little softer rather than
  // lag. The HUD, names and controls are page elements and stay sharp.
  if (!softwareRendering() || battleQuality.current() !== "low") return density;
  const fit = Math.sqrt(SOFTWARE_BATTLE_PIXELS / Math.max(1, arenaCssArea));
  return Math.max(0.6, Math.min(density, Math.floor(fit * 20) / 20));
}
/**
 * Most battle canvas pixels on a browser without a graphics card at Low: a
 * 1366×768 screen's arena keeps one pixel per CSS pixel, a 1920×1080 one
 * draws at 0.8 (measured: 9.4 → 11.4 fps on a CPU-drawn 1920×1080 browser).
 */
const SOFTWARE_BATTLE_PIXELS = 1_100_000;
/** The arena box's CSS area, measured when the renderer is sized (never per frame). */
let arenaCssArea = 0;
/** Size the drawing buffer to the arena box at device resolution. */
function fitRenderer() {
  if (!gameInstance) return;
  arenaCssArea = $("game").clientWidth * $("game").clientHeight;
  const parent = $("game"),
    dpr = renderScale();
  fitDesktopBattleHud($("battle"));
  // Anchor desktop HUD and controls to the displayed court, including letterboxing.
  const frame = parent.parentElement!.getBoundingClientRect();
  const battle = $("battle").getBoundingClientRect();
  const raidHud = document.getElementById("raid-hud");
  raidCameraHudBottom =
    state?.raid && raidHud && !raidHud.hidden
      ? Math.max(0, raidHud.getBoundingClientRect().bottom - frame.top + 6) *
        dpr
      : 0;
  $("battle").style.setProperty("--desktop-arena-width", `${frame.width}px`);
  $("battle").style.setProperty(
    "--desktop-arena-top",
    `${frame.top - battle.top}px`,
  );
  $("battle").style.setProperty(
    "--desktop-arena-bottom",
    `${battle.bottom - frame.bottom}px`,
  );
  const width = Math.max(1, Math.round(parent.clientWidth * dpr)),
    height = Math.max(1, Math.round(parent.clientHeight * dpr));
  const scale = gameInstance.scale;
  // Outside HUD placement can move the canvas without changing its pixel size.
  // Keep mouse aim aligned with its new position in that case too.
  scale.updateBounds();
  if (
    scale.width === width &&
    scale.height === height &&
    scale.zoom === 1 / dpr
  )
    return;
  scale.setZoom(1 / dpr);
  scale.resize(width, height);
}
/** When this battle renderer started loading (for reportBattleLoad). */
let battleLoadStarted = 0;
/** When a battle began waiting for Phaser to load, if it is waiting (else 0). */
let phaserWaitStarted = 0;
/** When this renderer's scene reached preload() and create() (reportBattleLoad). */
const battleLoadMarks = { preload: 0, create: 0 };
/** Longest the briefing holds "I'm ready" back while the arena loads. */
const ARENA_WAIT_MAX_MS = 20_000;
let arenaWaitSince = 0;
/**
 * The battle renderer is still loading these fighters (or Phaser itself,
 * which loads after the first screen). Never blocks for good: no renderer
 * (nothing to wait for) or a load past ARENA_WAIT_MAX_MS lets the player
 * confirm anyway.
 */
function arenaLoading(s: Snapshot) {
  if ((!gameInstance && !phaserWaitStarted) || scene?.fightersReady(s)) {
    arenaWaitSince = 0;
    return false;
  }
  const now = performance.now();
  if (!arenaWaitSince) arenaWaitSince = now;
  return now - arenaWaitSince < ARENA_WAIT_MAX_MS;
}
/**
 * At the end of a match, tell the server how smoothly it ran on this device
 * ("arena-perf" in its log): frame rate, slowest frames, stutter, graphics
 * level. Technical numbers only (battle-perf.ts).
 */
function reportBattlePerf() {
  const summary = battlePerf.summary();
  const net = netMeter.summary();
  battlePerf.reset();
  netMeter.reset();
  const leadMs = leadSeen.frames
    ? Math.round((leadSeen.sum / leadSeen.frames) * 1000)
    : undefined;
  leadSeen.sum = leadSeen.frames = 0;
  const errors = matchErrors;
  matchErrors = 0;
  drawnSelf.length = 0;
  if (summary.seconds < PERF_MIN_SECONDS || !myId || !connected) return;
  const nav = navigator as Navigator & { deviceMemory?: number };
  socket.emit("battle-perf", {
    ...summary,
    ...net,
    quality: battleQuality.current(),
    setting: graphicsSetting(),
    density: renderScale(),
    ...(typeof nav.deviceMemory === "number"
      ? { memory: nav.deviceMemory }
      : {}),
    ...(nav.hardwareConcurrency ? { cores: nav.hardwareConcurrency } : {}),
    ...(lastPing !== undefined ? { ping: Math.round(lastPing) } : {}),
    ...(leadMs !== undefined ? { lead: leadMs } : {}),
    ...deviceKind(),
    build: BUILD,
    errors,
    ...(softwareRendering() ? { gpu: "software" as const } : {}),
    ...(screenHz(battleFrames) ? { hz: screenHz(battleFrames) } : {}),
  });
}
/**
 * Tell the server how long the arena took to load on this device, once per
 * renderer, so slow phones show up in the server log ("arena-load").
 */
function reportBattleLoad(fighters: number) {
  const started = battleLoadStarted;
  battleLoadStarted = 0;
  if (!started || !myId || !connected) return;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const now = performance.now();
  socket.emit("battle-loaded", {
    ms: Math.min(600_000, Math.round(now - started)),
    fighters,
    ...(typeof nav.deviceMemory === "number"
      ? { memory: nav.deviceMemory }
      : {}),
    ...(nav.hardwareConcurrency ? { cores: nav.hardwareConcurrency } : {}),
    // Which part was slow, and on what (an Android phone took 0.9-1.8 s
    // where an iPhone took 0.2-0.35 s, Nov 2026).
    ...loadPhases(started, battleLoadMarks, now),
    density: renderScale(),
    build: BUILD,
    ...deviceKind(),
  });
}
/**
 * Opening a battle on an iPhone (or a phone with little memory): forget the
 * Plaza's, the Farm's and the Bistro's baked sprites first. The scenes are closed by now,
 * and the cache (~45 MB of canvases once the Farm and the Plaza were visited) would otherwise
 * sit beside the battle's floor and textures until iOS ends the page.
 */
function releaseHubArt() {
  if (!memoryConstrained()) return;
  // The sprite cache is shared by the Farm and the Plaza; if neither has
  // loaded this session it holds nothing.
  (worlds.loaded("farm") ?? worlds.loaded("plaza"))?.hubGfx.release();
  // The Bistro's creature, furniture and dish drawings (it is closed too).
  worlds.loaded("bistro")?.releaseBistroArt();
}
function ensureBattleRenderer() {
  if (gameInstance || $("game").clientWidth < 1 || $("game").clientHeight < 1)
    return;
  // Phaser loads after the first screen (phaser-runtime.ts); a battle that
  // comes before the hub's warm-up finished waits for it, then asks again.
  if (!phaser()) {
    // The wait counts towards the battle's load time (reportBattleLoad).
    phaserWaitStarted ||= performance.now();
    void loadPhaser().then(
      () => {
        ensureBattleRenderer();
        // No renderer after all (the battle closed meanwhile): a later one
        // starts its own count.
        phaserWaitStarted = 0;
      },
      (error: unknown) => {
        phaserWaitStarted = 0;
        console.error("The battle renderer could not load.", error);
      },
    );
    return;
  }
  const Phaser = Ph;
  battleLoadStarted = phaserWaitStarted || performance.now();
  phaserWaitStarted = 0;
  battleLoadMarks.preload = battleLoadMarks.create = 0;
  releaseHubArt();
  // Effects, rings and auras are Graphics paths redrawn every frame: draw
  // them without Phaser's per-point garbage (graphics-render.ts).
  installGraphicsRenderer(Phaser);
  arenaCssArea = $("game").clientWidth * $("game").clientHeight;
  const dpr = renderScale();
  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1e3557",
    scale: {
      // Buffer = arena box × device pixel ratio, displayed at CSS size via zoom.
      mode: Phaser.Scale.NONE,
      width: Math.round($("game").clientWidth * dpr),
      height: Math.round($("game").clientHeight * dpr),
      zoom: 1 / dpr,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [ArenaScene],
    // The battle uses no Phaser Pre/Post FX. Left on, Phaser keeps a stack of
    // screen-sized render targets for them anyway (tens of MB of GPU memory,
    // which an older iPhone runs out of).
    disablePreFX: true,
    disablePostFX: true,
    // CSS zoom compensates for DPR; it must not enable Phaser's pixel-art mode.
    render: { pixelArt: false, antialias: true },
    // The camera maps the authoritative 1600x900 world onto the buffer.
    // Several fingers at once: the joystick's thumb takes one of Phaser's
    // pointers, so a court tap to lock a target needs another
    // (tests/visual/tap-target.spec.ts fails with one).
    input: { activePointers: 4 },
    // A 120 Hz phone draws the battle at about 60 frames a second, like
    // every other screen (frame-cap.ts): half the drawing for no visible
    // loss, so its graphics chip stays cool and the battle does not stutter.
    callbacks: {
      postBoot: (game) => {
        battleFrames = capGameFrames(game);
      },
    },
  });
  // A player can return home while the first texture load is still finishing.
  gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);
  gameInstance.events.on(Phaser.Core.Events.RESUME, syncBattleLoop);
  addEventListener("resize", fitRenderer);
  // The arena box also changes when the HUD or skill bar changes height.
  battleResizeObserver = new ResizeObserver(scheduleBattleLayout);
  battleResizeObserver.observe($("game"));
  watchRendererLifecycle(gameInstance, () => !$("battle").hidden, fitRenderer);
}
/** A hidden battle canvas must not compete with the menu or Shop preview. */
function syncBattleLoop() {
  if (!gameInstance) return;
  const Phaser = Ph;
  if ($("battle").hidden) {
    // Sleeping retains every fighter and arena texture. Release them before
    // opening the hub or the Shop so iOS does not have to evict the whole web app.
    const previous = gameInstance;
    gameInstance = undefined;
    scene = undefined;
    battleResizeObserver?.disconnect();
    battleResizeObserver = undefined;
    window.removeEventListener("resize", fitRenderer);
    // Phaser never releases its WebGL context: hand it back explicitly once
    // the game has torn down (destroy runs on its next step), or every
    // battle leaves a context and its buffers until garbage collection, and
    // Safari limits both. The renderer watcher has detached by then.
    // Something still holds each old battle canvas after Phaser removes it
    // (measured: one more per battle), so shrink it too, as Phaser's own
    // CanvasPool does: whatever keeps it then keeps a 1×1 canvas. Phaser
    // never pools WebGL canvases, so a later battle can't be handed this one.
    const gl = (previous.renderer as { gl?: WebGLRenderingContext | null }).gl;
    if (gl)
      previous.events.once(Phaser.Core.Events.DESTROY, () => {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        const canvas = gl.canvas;
        if (canvas instanceof HTMLCanvasElement)
          canvas.width = canvas.height = 1;
      });
    previous.destroy(true);
    if (previous.isRunning && !previous.loop.running) previous.loop.wake();
  } else if (gameInstance.isRunning && !gameInstance.loop.running)
    gameInstance.loop.wake();
}
accountsUI = new AccountUI({
  selectedCharacter: () => selected,
  chooseFighter: (id) => {
    if (id === selected) return;
    selected = id;
    rememberHomeFighter(id);
    renderMenu();
    syncHub();
  },
  // Logged in on another device: its last pick, unless a room holds yours.
  restoreFighter: (id) => {
    if (id === selected || state) return;
    selected = id;
    rememberHomeFighter(id);
    renderMenu();
    syncHub();
  },
  toLobby: () => setHubScene("lobby"),
  openFarm: () => setHubScene("farm"),
  openDialog: dialog,
  startRaid: (boss, options) => void startRaid(boss, options),
  startSpire: (options) => void startSpire(options),
  raidParty: () => {
    const me = accountsUI.account?.id;
    return {
      party:
        party && party.members.length > 1
          ? party.members.map((m) => ({
              id: m.id,
              name: m.name,
              character: (Object.hasOwn(CHARACTERS, m.character)
                ? m.character
                : "voltkit") as CharacterId,
              leader: m.id === party!.leader,
              me: m.id === me,
            }))
          : [],
      leader: !party || party.members.length < 2 || partyLeader(),
      inRoom: !!myId,
    };
  },
  inviteToParty: async (playerId) => {
    const reply = await request("party-invite", {
      playerId,
      character: selected,
    });
    if (reply.ok) partyCharacterSent = selected;
    if (inviteStands(reply)) noteInviteSent(playerId, false);
    return { ok: !!reply.ok, error: reply.error };
  },
  invitedFriends,
  startAdventure: (mode) => void startAdventure(mode),
  joinRoom: (code) => void joinByCode(code),
  friendsRoom: () => ({
    code: myId && state?.phase === "lobby" ? state.code : undefined,
    canCreate: !myId && !watching,
    canInvite:
      !!myId &&
      state?.phase === "lobby" &&
      !state.practice &&
      !state.vsBot &&
      state.players.length < ((state.mode ?? "duel") === "duel" ? 2 : 4),
  }),
  inviteFriend: async (playerId) => {
    const reply = await request("room-invite", { playerId });
    if (inviteStands(reply)) noteInviteSent(playerId, true);
    return reply;
  },
  // In a private room Friends takes the picker's place; closing it brings
  // the picker back (UI remodel step 6).
  messageFriend: (id, name) => chat.openFriend(id, name),
  friendsHost: () =>
    myId && !watching
      ? ($("menu").querySelector<HTMLElement>(":scope > .room-screen") ??
        undefined)
      : undefined,
  onFriendsClosed: () => {
    if (myId && !watching && $("menu").querySelector(":scope > .room-screen"))
      renderRoom(false);
  },
  watchRoom: (code) => {
    if (myId) return toast("Leave your current room first.");
    void watchRoom(code);
  },
  notify: toast,
  beforeSignOut: async () => {
    roomInvites.clear();
    // The farm kept in this browser is this player's: forget it.
    forgetFarms();
    clearKeptBistros();
    worlds.loaded("bistro")?.forgetBistros();
    bistro?.close();
    bistro = undefined;
    farmScreen?.close();
    farmScreen = undefined;
    if (plaza) {
      wantedPlazaClosed = true;
      plaza.close();
      wantedPlazaClosed = false;
    }
    if (myId) await leave(false);
  },
  onSession: (token, accountId) => {
    const attempt = ++authConnectionAttempt;
    if (!token) roomInvites.clear();
    // Signed out: this device stops getting the last player's notifications.
    if (!token) void turnPushOff();
    if (!token || (accountId && accountId !== replacedAccount)) {
      replacedAccount = null;
      sessionStorage.removeItem("arena-session-replaced");
    }
    const previous = (
      socket.auth as { accessToken?: string | null } | undefined
    )?.accessToken;
    socket.auth = { accessToken: token };
    if (replacedAccount) return;
    if (previous === token && socket.connected) return;
    if (previous !== token) socket.disconnect();
    void waitForServer()
      .then(() => {
        // A sign-out/auth switch cancels older attempts. Token refreshes keep
        // this attempt and connect with the latest token in socket.auth.
        if (!replacedAccount && authConnectionAttempt === attempt)
          socket.connect();
      })
      .catch(() => {
        /* The startup panel owns the retry action. */
      });
  },
  onToken: (token) => {
    // Keep the live connection's login fresh (tokens expire hourly) and use
    // the new token if the socket ever has to reconnect.
    socket.auth = { accessToken: token };
    if (socket.connected) socket.emit("token", { token });
    // A connection the server refused or closed (an hour-old token on a
    // phone waking up) never retries by itself: without this, a player sat
    // in the game offline to their friends until they reloaded.
    else if (!replacedAccount && !socket.active) socket.connect();
  },
  onChange: () => {
    loadMastery();
    rosterScreen?.refresh();
    // Re-render only when something the menu shows actually changed.
    const shown = JSON.stringify([
      accountsUI?.account ?? null,
      !!accountsUI?.session,
      accountsUI?.checked,
      accountsUI?.raidLook ?? null,
      accountsUI?.raidClears ?? null,
      accountsUI?.economy?.looks ?? null,
      accountsUI?.economy?.journey ?? null,
      accountsUI ? (lobbySpire()?.key ?? null) : null,
    ]);
    if (shown === accountShown) return;
    accountShown = shown;
    if (!state || state.phase === "lobby") {
      screen = "";
      renderMenu();
    } else renderBattle();
  },
});
// Every fighter you pick is kept with your account too (migration 108).
onHomeFighterRemembered((id) => accountsUI.saveFighter(id));

// Imported code and the UI shell are ready; dismiss the asset-independent loader.
onServerStartupRetry(() => {
  void waitForServer()
    .then(() => accountsUI.refresh())
    .catch(() => {});
});
void waitForServer().catch(() => {});
window.dispatchEvent(new Event("arena:ready"));
