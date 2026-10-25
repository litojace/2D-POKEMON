import { frameLobbyPanel } from "./lobby-layout";
import { fitDesktopBattleHud } from "./desktop-battle-layout";
import {
  homeShell,
  lastHomeFighter,
  rememberHomeFighter,
  startRoomSection,
  welcomeGate,
  type GateStatus,
} from "./home-screen";
import { setupHomeNavigation } from "./home-navigation";
import { watchSelectionPreview } from "./selection-preview";
import { townOutfitKey } from "./town-outfit";
import { raidDay } from "../../../packages/shared/src/raid";
import { resultXp } from "./adventure-ui";
import { arcadeWeek, ARCADE_EVENTS } from "../../../packages/shared/src/arcade";
import { drawArcade } from "./arcade-art";
import { stormTarget } from "./storm-twins-controls";
import { prismatailAim } from "./prismatail-controls";
import { dreamRuneKey } from "./somnara-controls";
import { battleMusic } from "./battle-music";
import { setDialogContent } from "./dialog";
import { wireRaidDifficulty } from "./raid-difficulty";
import { updateMenuShell } from "./menu-shell";
import {
  raidLobby,
  renderRaidUI,
  drawRaidArena,
  raidLookList,
  portraitCosmetics,
} from "./raid-ui";
import { townGuide, illustratedHelp } from "./illustrated-help";
import { buttonIcon, iconLabel, menuIcon } from "./menu-icons";
import type { RaidBossId } from "../../../packages/shared/src/raid";
import {
  fighterSelection,
  syncRosterMastery,
  updateRosterSelection,
  watchFighterDetail,
} from "./fighter-selection";
import { LobbySelection } from "./lobby-selection";
import { setupBattleDock } from "./battle-dock";
import {
  queueFighterAssets,
  createFighterVisual,
  type FighterVisual,
} from "./animation/pipeline";
import { rigAssets } from "./animation/assets";
import { setOverlayMarkup, LIVE_SECONDS, fillLiveSeconds } from "./overlay";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
import { fighterSkillColor, wornArt } from "./skins/skin-art";
import { drawCollectionAura } from "./skins/collection-fx";
import { withAura } from "./trait-effects";
import { drawBattleAura } from "./battle-aura";
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
} from "./skill-effects";
import { setupPWA } from "./pwa";
import { abilityIcon } from "./ability-icons";
import { TouchControls } from "./touch-controls";
import Phaser from "phaser";
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
  useObstacles,
  useSpeedScale,
  type ArenaId,
  RITE_BY_ID,
  RITE_RULES,
  kitOf,
  skillReady,
  advanceMovement,
  normalize,
  move,
  unpackSnapshot,
  type WireSnapshot,
  type CharacterId,
  type Fighter,
  type Input,
  type Reply,
  type Snapshot,
} from "../../../packages/shared/src/index";
import { AudioManager } from "./audio";
import { InterpolationBuffer } from "./networking/interpolation";
import { AccountUI } from "./accounts";
import "./style.css";
import "./champion-selection.css";
import "./friends.css";
import "./wardrobe.css";
import "./battle-dock.css";
import { FollowCamera, screenToWorld, outsideView } from "./follow-camera";
import { updateNameplate } from "./player-nameplate";
import { fighterPack } from "./animation/pack-config";
import { fullscreenLandscape } from "./orientation";
import { wireRotateGate } from "./rotate-gate";
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
import { KO_FEEL, hitFeel, hitStrength, rumble } from "./game-feel";
import {
  captureInvite,
  clearInvite,
  pendingInvite,
  shareInvite,
} from "./invite";
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
import { matchReportReplySchema } from "../../../packages/shared/src/accounts";
import { masteryMatches, setMastery, setWornSkins } from "./fighter-selection";
import { shareResult } from "./share-card";
import { openTown } from "./town";
import { courtBlockFrame, courtBlocks, isCourt, paintCourtBlock, paintCourtFloor, paintCourtRubble, paintCourtStands, RUBBLE_PAD, SHIFTING_BLOCK, STANDS, type CourtId } from "./arena-courts";
import { RITE_EFFECTS, riteEffect, riteIcon } from "./rite-icons";
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
const lobbySelection = new LobbySelection();
const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
  auth: { accessToken: null },
});
let accountsUI: AccountUI;
let gameInstance: Phaser.Game | undefined;
let state: Snapshot | undefined,
  myId = "",
  selected: CharacterId = lastHomeFighter(),
  seq = 0,
  local: Fighter | undefined,
  pending: Input[] = [],
  scene: ArenaScene | undefined;
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
  `<header class="topbar"><a class="brand" href="#"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="element-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#element-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span> ELEMENT<span>ARENA</span></a><div class="top-links"><div id="account-nav" class="account-nav"></div><button type="button" class="quiet home-settings" id="home-settings" aria-label="Settings" title="Settings">${menuIcon("settings")}</button><details class="header-menu" id="header-menu"><summary><i class="menu-burger" aria-hidden="true">☰</i><i class="menu-gear" aria-hidden="true">${menuIcon("settings")}</i> <span>Menu</span></summary><div class="header-menu-panel"><button class="quiet" id="help">${menuIcon("help")}<span>How to play</span></button><button class="quiet" id="settings">${menuIcon("settings")}<span>Settings</span></button><button class="quiet" id="leaderboard">${menuIcon("leaderboard")}<span>Leaderboard</span></button><button class="quiet" id="install-app">${menuIcon("fullscreen")}<span>Want fullscreen?</span></button><button class="quiet" id="report-problem">${menuIcon("report")}<span>Report a problem</span></button><button class="quiet" id="menu-logout">${menuIcon("leave")}<span>Log out</span></button><span class="connection" id="connection">Connecting</span></div></details></div></header><main><section id="menu"></section><section id="battle" hidden>${stadiumCrowd()}<div id="practice-controls" class="practice-controls" hidden></div><div id="hud" class="hud"></div><div class="arena-stage"><div class="arena-frame"><div id="game"></div><div id="arena-overlay"></div><div id="spectate" class="spectate-banner" role="status" hidden></div><span class="map-label">ELEMENTAL COLISEUM <span>01 / CHAMPIONS COURT</span></span></div></div><div id="mobile-controls"></div><div id="abilities" class="ability-bar"></div><div class="battle-footer"><span id="control-hints"></span><span id="network">AUTHORITATIVE ONLINE MATCH</span><button class="quiet" id="battle-menu" title="Battle settings (Esc / controller Menu)">Settings</button></div></section></main><div id="toast" role="status"></div><dialog id="dialog"></dialog>`;
// Measure wrapped HUDs for phone spacing and desktop boss-specific controls.
let measuredRaidHud: HTMLElement | null = null;
const battleHudSize = new ResizeObserver((entries) => {
  const raidEntry = entries.find((entry) => entry.target.id === "raid-hud");
  if (raidEntry)
    $("battle").style.setProperty(
      "--desktop-raid-hud-height",
      `${Math.ceil(raidEntry.target.getBoundingClientRect().height)}px`,
    );
  if ($("battle").hidden) return;
  const panel = $("hud").getBoundingClientRect();
  const callout = document
    .getElementById("phase-label")
    ?.getBoundingClientRect();
  const height = Math.ceil(
    Math.max(panel.bottom, callout?.bottom ?? panel.bottom) - panel.top,
  );
  $("battle").style.setProperty("--match-hud-height", `${height + 8}px`);
  fitRenderer();
});
battleHudSize.observe($("hud"));
battleHudSize.observe($("abilities"));
// Touch battles lock zoom (pinch and double tap); menus keep it for accessibility.
watchBattleZoom();
const homeNavigation = setupHomeNavigation($("menu"), () => showSettings());
$("home-settings").onclick = () => showSettings();
const headerMenu = $("header-menu") as HTMLDetailsElement;
// A dropdown-to-dialog transition keeps the same page position throughout.
lockScrollWhileOpen($<HTMLDialogElement>("dialog"), headerMenu);
watchMenuMotion($("menu"), $<HTMLDialogElement>("dialog"), headerMenu);
watchSelectionPreview($("menu"), $<HTMLDialogElement>("dialog"), headerMenu);
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
function request(event: string, data: unknown = {}): Promise<Reply> {
  return new Promise((resolve) =>
    socket
      .timeout(5000)
      .emit(event, data, (error: Error | null, reply: Reply) => {
        if (error) {
          toast("Server did not respond. Check your connection.");
          resolve({ ok: false });
        } else {
          if (!reply.ok && reply.error) toast(reply.error);
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
  eventId = 0;
  scene?.hydrateNextSnapshot();
  local = undefined;
  remoteFrames.clear();
  sessionStorage.setItem("arena-token", reply.token!);
}
const touch = new TouchControls(
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
// ---- Keyboard, mouse and controller (bindings live in controls.ts) ----
/** Physical keys and mouse buttons ("KeyQ", "Mouse0") currently held. */
const held = new Set<string>();
const caster = new SkillCaster();
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
window.addEventListener("keydown", (e) => {
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
  held.add(e.code);
  if (live) pressAction(action);
  else if (
    state?.phase === "intermission" &&
    !$<HTMLDialogElement>("dialog").open
  )
    pressAction(action);
});
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
    state.raid.drill ||
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
window.addEventListener("keyup", (e) => {
  if (!held.delete(e.code)) return;
  const action = actionFor(controlPrefs().bindings, e.code);
  if (action) releaseAction(action);
});
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
// Remember a room from an invite link (?room=ABC123) before the first render.
if (captureInvite()) inviteHinted = false;
function wireRoster(isRoom: boolean) {
  const panel = document.querySelector<HTMLElement>("#menu .roster-panel");
  if (!panel) return;
  const confirm = () => {
    for (const card of Array.from(
      panel.querySelectorAll<HTMLElement>("[data-character]"),
    )) {
      card.classList.toggle("is-equipped", card.dataset.character === selected);
      card.title = `${CHARACTERS[card.dataset.character as CharacterId].name}${card.dataset.character === selected ? " · Your current fighter" : ""}`;
    }
  };
  confirm();
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(
    (button) =>
      (button.onclick = () => {
        audio.unlock();
        const choice = button.dataset.character as CharacterId;
        if (
          panel.querySelector<HTMLElement>(".fighter-detail")?.dataset
            .detailFor === choice
        )
          return;
        updateRosterSelection(panel, choice, reducedMotion, true);
        syncRosterMastery(panel);
        syncMenuCosmetic();
      }),
  );
  panel.onclick = async (event) => {
    const lock = (event.target as Element).closest<HTMLButtonElement>(
      "[data-fighter-lock]",
    );
    if (!lock || lock.disabled) return;
    audio.unlock();
    const choice = lock.dataset.fighterLock as CharacterId;
    if (!isRoom) homeNavigation.close();
    if (choice === selected) {
      if (isRoom)
        toast(
          `${CHARACTERS[choice].name} is selected. Ready up when you're set.`,
        );
      return;
    }
    selected = choice;
    confirm();
    rememberHomeFighter(choice);
    const revision = isRoom ? lobbySelection.choose(choice) : undefined;
    renderMenu(true);
    if (!isRoom) return;
    const reply = await request("select", choice);
    const mine = state?.players.find((p) => p.id === myId);
    // The server said no (e.g. the match is starting): show its pick again.
    if (
      !reply.ok &&
      revision !== undefined &&
      lobbySelection.reject(revision) &&
      mine
    ) {
      selected = mine.character;
      confirm();
      renderMenu();
    }
  };
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
let lastWornKey = "{}";
function syncMenuCosmetic() {
  const panel = document.querySelector<HTMLElement>("#menu .roster-panel");
  const fighter = state?.players.find((p) => p.id === myId);
  const look =
    accountsUI?.account && accountsUI.raidLook !== undefined
      ? accountsUI.raidLook
      : fighter?.raidLook;
  const worn = portraitCosmetics({
    character: selected,
    raidLook: look,
    championLooks: accountsUI?.economy?.looks ?? fighter?.championLooks,
  });
  if (panel)
    panel.dataset.raidCosmetic = portraitCosmetics({
      character:
        (panel.querySelector<HTMLElement>(".fighter-detail")?.dataset
          .detailFor as CharacterId) ?? selected,
      raidLook: look,
      championLooks: accountsUI?.economy?.looks ?? fighter?.championLooks,
    });
  const preview = panel?.querySelector<HTMLElement>(".fighter-rig-stage");
  const previewLook = encodeURIComponent(JSON.stringify(look ?? {}));
  if (preview && preview.dataset.previewLook !== previewLook)
    preview.dataset.previewLook = previewLook;
  document.body.style.setProperty(
    "--element",
    `#${CHARACTERS[selected].color.toString(16).padStart(6, "0")}`,
  );
  const avatar = Array.from(
    document.querySelectorAll<HTMLElement>("#menu [data-raid-player]"),
  )
    .find((row) => row.dataset.raidPlayer === myId)
    ?.querySelector<HTMLElement>(".raid-party-avatar");
  if (avatar) avatar.dataset.raidCosmetic = worn;
}
/** Move the selection highlight and swap the detail panel without re-rendering. */
function showSelection(revealSelection = false) {
  const panel = document.querySelector<HTMLElement>("#menu .roster-panel");
  if (!panel) return false;
  if (!updateRosterSelection(panel, selected, reducedMotion, revealSelection))
    return false;
  const me = document.querySelector<HTMLElement>("#menu [data-me]");
  if (me) {
    const fighter = CHARACTERS[selected];
    me.querySelector(".player-fighter")!.textContent = fighter.name;
    const avatar = me.querySelector<HTMLElement>(".player-avatar")!;
    avatar.style.setProperty(
      "--element",
      `#${fighter.color.toString(16).padStart(6, "0")}`,
    );
    avatar.title = fighter.name;
    avatar.innerHTML = fighterAvatar(
      fighter.id,
      `lobby${state?.players.findIndex((p) => p.id === myId) ?? 0}`,
      skinOf(
        state?.players.find((p) => p.id === myId),
        fighter.id,
      ),
    );
  }
  const raidMe = Array.from(
    document.querySelectorAll<HTMLElement>("#menu [data-raid-player]"),
  ).find((row) => row.dataset.raidPlayer === myId);
  if (raidMe) {
    const avatar = raidMe.querySelector<HTMLElement>(".raid-party-avatar");
    const name = raidMe.querySelector<HTMLElement>(".raid-player-character");
    if (avatar)
      avatar.innerHTML = fighterAvatar(
        selected,
        "raid-lobby-" + myId,
        skinOf(
          state?.players.find((p) => p.id === myId),
          selected,
        ),
      );
    if (name) name.textContent = CHARACTERS[selected].name;
  }
  syncMenuCosmetic();
  syncHomePresentation();
  return true;
}
function syncHomePresentation() {
  const avatar = document.querySelector("#account-profile .account-avatar");
  if (avatar && avatar.getAttribute("data-champion") !== selected) {
    avatar.innerHTML = fighterAvatar(
      selected,
      "account-nav",
      accountsUI?.economy?.looks[selected],
    );
    avatar.setAttribute("data-champion", selected);
  }
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
const COPY_ICON =
  '<svg class="copy-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
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
    heading = `${Math.ceil(state!.remaining)}`;
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
  const mine = giftFrom(partner.character),
    theirs = giftFrom(me.character);
  const myName = me.id === myId ? "You" : escape(me.name);
  return `<p class="teamup-note"><b>Team-up</b> Side by side, you both deal ${Math.round((TEAMUP.damage - 1) * 100)}% more damage. ${myName} get <i>${escape(mine.name)}</i> (${escape(mine.text)}) from ${escape(CHARACTERS[partner.character].name)}; ${escape(partner.name)} gets <i>${escape(theirs.name)}</i> (${escape(theirs.text)}).</p>`;
}
/** Join a friend's room from the friends list. */
async function joinByCode(code: string) {
  if (!accountsUI.ensurePlayer()) return;
  if (myId) return toast("Leave your current room first.");
  if (!connected) return toast("Waiting for the server connection.");
  if (watching) await stopWatching();
  audio.unlock();
  const reply = await request("join", {
    name: accountsUI.account?.displayName ?? "Player",
    code,
  });
  identity(reply);
  if (reply.ok) await request("select", selected);
}
/** Room code being watched (no seat), or "". */
let watching = "";
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
function watchPanel() {
  const rows = state!.players
    .map((p) => {
      const c = CHARACTERS[p.character];
      return `<div><span class="player-avatar" style="--element:#${c.color.toString(16).padStart(6, "0")}" title="${c.name}">${fighterAvatar(c.id, `watch${state!.players.indexOf(p)}`, skinOf(p, c.id))}</span><span><strong>${escape(p.name)}</strong><small class="player-fighter">${c.name}</small></span><b class="status-pill ${!p.connected ? "offline" : p.ready ? "ready" : "choosing"}">${!p.connected ? "Offline" : p.ready ? "Ready" : "Choosing"}</b></div>`;
    })
    .join("");
  return `<div class="eyebrow">Watching room ${escape(state!.code)}</div><h2>Ringside seat.</h2><p>You'll see the match live as soon as everyone's ready. Watching: ${escape((state!.watchers ?? []).join(", ") || "just you")}.</p><div class="players">${rows}</div>${partyRulesNote()}<button class="secondary btn-secondary full leave-button" id="stop-watching">${iconLabel("stop-watching", "Stop watching")}</button>`;
}
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
/** Lobby party rules: the host toggles them, everyone else sees them. */
function partyRules(host: boolean) {
  if (state?.arcade)
    return `<p class="arcade-lobby-note"><b>${ARCADE_EVENTS[state.arcade.id].name}</b> · ${ARCADE_EVENTS[state.arcade.id].text} Weekly rules are fixed. PvP rating stays separate.</p>`;
  const on = new Set(state!.mutators ?? []);
  if (!host && !on.size) return "";
  const chips = MUTATOR_IDS.filter((m) => host || on.has(m))
    .map((m) =>
      host
        ? `<button type="button" class="rule-chip${on.has(m) ? " on" : ""}" data-mutator="${m}" aria-pressed="${on.has(m)}"><b>${escape(MUTATORS[m].name)}</b><small>${escape(MUTATORS[m].description)}</small></button>`
        : `<span class="rule-chip on"><b>${escape(MUTATORS[m].name)}</b><small>${escape(MUTATORS[m].description)}</small></span>`,
    )
    .join("");
  return `<details class="party-rules"${on.size ? " open" : ""}><summary>Party rules${on.size ? ` · ${on.size} on` : host ? " · optional" : ""}</summary><div class="rule-chips">${chips}</div>${host ? "<small>Only you (the host) can change these. Everyone readies up again after a change.</small>" : ""}</details>`;
}
function roomPanel(me: Fighter) {
  if (state?.raid) return raidLobby(state, myId, selected);
  const row = (p: Fighter) => {
    const fighter = CHARACTERS[p.id === myId ? selected : p.character];
    return `<div${p.id === myId ? " data-me" : ""}><span class="player-avatar" data-raid-cosmetic="${portraitCosmetics({ character: fighter.id, raidLook: p.raidLook, championLooks: looksOf(p) })}" style="--element:#${fighter.color.toString(16).padStart(6, "0")}" title="${fighter.name}">${fighterAvatar(fighter.id, `lobby${state!.players.indexOf(p)}`, skinOf(p, fighter.id))}</span><span><strong>${escape(p.name)} ${p.id === myId ? "<small>(you)</small>" : ""}</strong><small class="player-fighter">${fighter.name}${p.flair ? ` · <b class="flair flair-${p.flair.toLowerCase()}">★ ${p.flair}</b>` : ""}</small></span><b class="status-pill ${!p.connected ? "offline" : p.ready ? "ready" : "choosing"}">${!p.connected ? "Offline" : p.ready ? "Ready" : "Choosing"}</b></div>`;
  };
  const ready = `<button class="primary btn-primary" id="ready">${me.ready ? iconLabel("cancel", "Cancel ready") : iconLabel("battle", "Ready to battle")}</button><button class="quiet full leave-button" id="leave">${iconLabel("leave", "Leave room")}</button>`;
  const code = `<button id="copy" class="room-code">${state!.code}<span>${COPY_ICON}Copy code</span></button><button id="invite" class="secondary btn-secondary full invite-link">${iconLabel("share", "Share invite link")}</button>`;
  if (isFfa()) {
    const open = Math.max(0, 4 - state!.players.length);
    const slots = Array.from(
      { length: open },
      (_, k) =>
        `<div class="open-slot"><span class="slot-mark">＋</span><span>Open slot<small>${state!.players.length + k < 3 ? "Needed to start" : "Optional fourth fighter"}</small></span></div>`,
    ).join("");
    return `<div class="eyebrow">Private free-for-all</div><h2>Last one standing.</h2><p>Share this code with two or three friends. Everyone fights everyone; the last fighter standing takes the round.</p>${code}<div class="players">${state!.players.map(row).join("")}${slots}</div>${partyRules(state!.players[0]?.id === myId)}${ready}<small class="room-note">First to ${roundsNeeded(state!.mutators)} round wins. Starts when everyone here is ready (3 or 4 players).</small>`;
  }
  if (!isTeams())
    return `<div class="eyebrow">Private lobby</div><h2>Your duel starts here.</h2><p>Share this code with your friend.</p>${code}<div class="players">${state!.players.map(row).join("")}${state!.players.length < 2 ? '<div class="waiting"><span>＋</span> Waiting for your opponent…</div>' : ""}</div>${partyRules(state!.players[0]?.id === myId)}${ready}<small class="room-note">The match begins when both players are ready.</small>`;
  const mine = teamOf(me),
    host = state!.players[0]?.id === myId;
  const columns = ([0, 1] as const)
    .map((t) => {
      const members = state!.players.filter((p) => teamOf(p) === t);
      const open = Math.max(0, 2 - members.length);
      // One way to join the other team; further free seats are just shown open.
      const slots = Array.from({ length: open }, (_, k) =>
        t !== mine && k === 0
          ? `<button type="button" class="open-slot join" data-team="${t}"><span class="slot-mark">＋</span><span>Join ${TEAM_LABELS[t]}<small>Switch to this team</small></span></button>`
          : `<div class="open-slot"><span class="slot-mark">＋</span><span>Open slot<small>Waiting for a player</small></span></div>`,
      ).join("");
      return `<div class="team-column team-${t}${t === mine ? " mine" : ""}"><div class="team-head">${TEAM_LABELS[t]} team</div><div class="players">${members.map(row).join("")}${slots}</div></div>`;
    })
    .join("");
  return `<div class="eyebrow">Private 2v2 lobby</div><h2>Two on two.</h2><p>Share this code with three friends, then pick a side.</p>${code}<div class="team-columns">${columns}</div>${host ? `<button class="quiet full" id="shuffle">${iconLabel("shuffle", "Shuffle teams")}</button>` : ""}${teamUpNote({ ...me, character: selected })}${partyRules(host)}${ready}<small class="room-note">First team to ${roundsNeeded(state!.mutators)} round wins. Starts when all four players are ready.</small>`;
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
        arcade: arcadeWeek(raidDay().day).id,
      }),
    );
    return;
  }
  const expedition = mode.startsWith("expedition-");
  roomMode = expedition ? "raid" : mode === "arcade-teams" ? "teams" : "duel";
  const reply = await request("create", {
    name,
    mode: roomMode,
    ...(expedition
      ? { expedition: true }
      : { arcade: arcadeWeek(raidDay().day).id }),
  });
  identity(reply);
  if (!reply.ok) return;
  await request("select", selected);
  if (mode === "expedition-solo") await request("ready");
}
/**
 * The welcome screen: shown when signed out (with the sign-up / log-in
 * panel in it), while the account loads, and while a signed-in player is
 * (re)connecting to the town.
 */
function renderGate() {
  syncTown();
  const status: GateStatus = !accountsUI?.checked
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
  if (retry) retry.onclick = () => void accountsUI.refresh();
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

let town: ReturnType<typeof openTown> | undefined;
let townLook = "";
let townRetry: ReturnType<typeof setTimeout> | undefined;
let wantedTownClosed = false;
/**
 * The town is the hub: open whenever a signed-in, connected player is not in
 * a room (and not about to resume or join one); closed otherwise.
 */
function syncTown() {
  const want =
    !!accountsUI?.account &&
    connected &&
    !myId &&
    !watching &&
    !state &&
    !sessionStorage.getItem("arena-token") &&
    !pendingInvite();
  if (!want) {
    if (town) {
      wantedTownClosed = true;
      town.close();
      wantedTownClosed = false;
    }
    return;
  }
  const look = townOutfitKey(
    selected,
    accountsUI.economy?.looks[selected],
    accountsUI.raidLook,
  );
  if (town) {
    if (look !== townLook) town.look(selected);
    townLook = look;
    return;
  }
  if (townRetry) return;
  townLook = look;
  town = openTown({
    socket,
    character: selected,
    request,
    reduced: reducedMotion,
    onPortal: (spot) => {
      if (spot.id === "raids")
        void accountsUI.showRaidHub(spot.boss ?? state?.raid?.boss);
      else if (spot.id === "shop") void accountsUI.showShop(spot.tab);
      else if (spot.id === "wardrobe") void accountsUI.showWardrobe();
      else if (spot.id === "missions") void accountsUI.showMissions();
      else if (spot.id === "boss-rush")
        void accountsUI.showAdventure("expedition");
      else if (spot.id === "leaderboard") $("leaderboard").click();
      else homeNavigation.open("play");
    },
    onAction: (action) => {
      if (action === "play") homeNavigation.open("play");
      else if (action === "fighters") homeNavigation.open("fighters");
      else if (action === "wardrobe") void accountsUI.showWardrobe();
      else if (action === "friends") void accountsUI.showFriends();
      else if (action === "adventure") void accountsUI.showAdventure();
      else if (action === "raids") void showRaidBestiary();
    },
    onClose: (failed) => {
      town = undefined;
      if (wantedTownClosed) return;
      // Closed by the server or a dropped connection: back in when possible
      // (and not in a tight loop if the server keeps refusing).
      townRetry = setTimeout(
        () => {
          townRetry = undefined;
          syncTown();
        },
        failed ? 15000 : 1500,
      );
    },
  });
}
async function showRaidBestiary() {
  await accountsUI.showRaidHub(state?.raid?.boss);
}
/** Create a raid room for a boss from the Raid Hub (optionally today's raid, or straight in solo). */
async function startRaid(
  boss: RaidBossId,
  options: { daily?: boolean; solo?: boolean },
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
  await request("select", selected);
  if (options.daily) {
    const daily = (await request("raid-config", { peril: 2, daily: true })) as {
      ok?: boolean;
      error?: string;
    };
    if (!daily.ok && daily.error) toast(daily.error);
  }
  if (options.solo) await request("ready");
}
function wireRaidLobby() {
  wireRaidDifficulty();
  const copy = document.getElementById("raid-copy-code");
  if (copy)
    copy.onclick = () =>
      void navigator.clipboard
        .writeText(state?.code ?? "")
        .then(() => toast("Room code copied"))
        .catch(() => toast("Room code: " + (state?.code ?? "")));

  const peril = document.getElementById(
      "raid-peril",
    ) as HTMLInputElement | null,
    daily = document.getElementById(
      "raid-daily-toggle",
    ) as HTMLInputElement | null;
  const configure = () => {
    const isDaily = daily?.checked ?? false;
    // The daily raid grants access to Peril 2 before regular Peril 2 is unlocked.
    // Always allow leaving it by returning to the first regular difficulty.
    const difficulty =
      !isDaily && state?.raid?.daily ? 1 : Number(peril?.value ?? 1);
    void request("raid-config", { peril: difficulty, daily: isDaily }).then(
      (reply) => {
        const result = reply as { ok?: boolean; error?: string };
        if (!result.ok) {
          if (result.error) toast(result.error);
          // Restore the authoritative values when a locked challenge is rejected.
          if (state?.phase === "lobby") {
            screen = "";
            renderMenu();
          }
        }
      },
    );
  };
  // Practice: the host picks one boss attack to repeat.
  document
    .querySelectorAll<HTMLButtonElement>("#menu [data-raid-drill]")
    .forEach((b) => {
      b.onclick = () =>
        void request("raid-drill", { kind: b.dataset.raidDrill }).then(
          (reply) => {
            const r = reply as { ok?: boolean; error?: string };
            if (!r.ok && r.error) toast(r.error);
          },
        );
    });
  if (peril) peril.onchange = configure;
  if (daily) daily.onchange = configure;
}
function wireRoom() {
  wireRaidLobby();
  $("ready").onclick = () => {
    audio.unlock();
    const preview =
      $("menu").querySelector<HTMLElement>(".fighter-detail")?.dataset
        .detailFor;
    const alreadyReady = state?.players.find((p) => p.id === myId)?.ready;
    if (!alreadyReady && preview && preview !== selected) {
      toast(
        `Lock in ${CHARACTERS[preview as CharacterId].name} or return to your current fighter before readying up.`,
      );
      $("menu")
        .querySelector<HTMLButtonElement>("[data-fighter-lock]")
        ?.focus({ preventScroll: true });
      return;
    }
    void request("ready");
  };
  $("leave").onclick = () => void leave();
  document
    .querySelectorAll<HTMLButtonElement>("[data-team]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          void request("team", { team: Number(b.dataset.team) })),
    );
  if (document.getElementById("shuffle"))
    $("shuffle").onclick = () => void request("shuffle");
  document
    .querySelectorAll<HTMLButtonElement>("[data-mutator]")
    .forEach((b) => {
      b.onclick = () => {
        const on = new Set(state?.mutators ?? []);
        const id = b.dataset.mutator as MutatorId;
        if (on.has(id)) on.delete(id);
        else on.add(id);
        void request("mutators", { ids: [...on] });
      };
    });
  // The raid lobby has its own copy button and no invite link.
  const copy = document.getElementById("copy");
  if (copy)
    copy.onclick = () =>
      void navigator.clipboard
        .writeText(state!.code)
        .then(() => toast("Room code copied."))
        .catch(() => toast(`Share this code: ${state!.code}`));
  const invite = document.getElementById("invite");
  if (invite)
    invite.onclick = () =>
      void shareInvite(state!.code).then((how) =>
        toast(
          how === "copied"
            ? "Invite link copied. Friends who open it join this room."
            : how === "failed"
              ? `Share this code: ${state!.code}`
              : "Invite sent.",
        ),
      );
}
function renderMenu(revealSelection = false) {
  document.body.classList.remove("practice-active");
  audio.setTheme("lobby");
  pwa.sync();
  const p = state?.players.find((p) => p.id === myId);
  const isRoom = !!p;
  const watchingRoom = !isRoom && !!watching && state?.code === watching;
  // Everyone plays from the shared town, so the game needs an account.
  // No town without an account or a connection: the welcome screen instead.
  if (!isRoom && !watchingRoom && (!accountsUI?.account || !connected))
    return renderGate();
  document.body.classList.remove("gate-active");
  syncTown();
  const raidChallenge = state?.raid
    ? `${state.raid.boss}/${state.raid.peril}/${state.raid.daily}`
    : "";
  const key = `${isRoom ? `room-${state!.mode ?? "duel"}` : watchingRoom ? `watch-${watching}` : "home"}:${(state?.mutators ?? []).join(",")}|${raidChallenge}|${(state?.watchers ?? []).join(",")}:${state?.players
    .map(
      (p) =>
        `${p.id}${p.id === myId ? "" : p.character}${p.ready}${p.connected}${p.team ?? ""}${p.flair ?? ""}${raidLookList(p.raidLook)}${Object.values(
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
    showSelection(revealSelection)
  )
    return;
  // Keep the reader's place when the menu re-renders while already visible.
  const keepScroll = !$("menu").hidden ? scrollY : null;
  touch.reset();
  document.body.classList.remove("battle-active", "battle-raid");
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
  const panelMarkup = isRoom
    ? roomPanel(p!)
    : watchingRoom
      ? watchPanel()
      : `${startRoomSection(roomMode)}<label for="name">Your display name</label><input id="name" maxlength="20" placeholder="Enter your name" value="${escape(accountsUI?.account?.displayName ?? localStorage.getItem("arena-name") ?? "")}" autocomplete="nickname"><div class="home-play-options"><section><h3>Join your crew</h3><label for="code">Room code</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Room code"><button id="join" class="secondary btn-secondary">${iconLabel("enter", "Join")}</button></div><button id="watch" class="quiet full">${iconLabel("watch", "Watch this room instead")}</button></section><section><h3>Sharpen your skills</h3><div class="bot-picker" role="radiogroup" aria-label="Bot difficulty">${BOT_LEVELS.map(([id, label, hint]) => `<button type="button" role="radio" class="bot-level${botLevel === id ? " active" : ""}" data-bot="${id}" aria-checked="${botLevel === id}"><b>${label}</b><small>${hint}</small></button>`).join("")}</div><button class="secondary btn-secondary full" id="bot-match">${iconLabel("bot", "Battle an AI bot")}</button>${accountsUI?.account ? '<button class="quiet full" id="practice">' + iconLabel("target", "Solo test mode") + "</button>" : ""}</section></div><small class="room-note">Free to play · Login required<br>Keyboard + mouse · Controller · Touch</small>`;
  // A newly equipped Shop skin redraws the roster cards.
  const wornKey = JSON.stringify(accountsUI?.economy?.looks ?? {});
  const wornChanged = wornKey !== lastWornKey;
  lastWornKey = wornKey;
  setWornSkins(accountsUI?.economy?.looks);
  const retainedShell = updateMenuShell(
    $("menu"),
    panelMarkup,
    () =>
      home
        ? homeShell(panelMarkup, fighterSelection(selected))
        : `<header class="desktop-lobby-header"><div class="eyebrow">Elemental Coliseum</div><h1>Choose your fighter</h1><p>Pick your creature. Enter the arena.</p></header><div class="lobby-layout"><div class="roster-panel">${fighterSelection(selected)}</div><aside class="room-panel card">${panelMarkup}</aside></div>`,
    keepScroll !== null &&
      !wornChanged &&
      !!$("menu").querySelector(".home-screen") === home,
  );
  if (!home)
    frameLobbyPanel($("menu").querySelector<HTMLElement>(".room-panel")!);
  wireRoster(isRoom);
  syncRosterMastery($("menu"));
  syncMenuCosmetic();
  syncHomePresentation();
  // Fighter panel slot: between the rows on PC, under the swipeable row on phones.
  if (!retainedShell) watchFighterDetail($("menu"));
  else if (
    previous &&
    previous.slice(previous.lastIndexOf(":") + 1) !== selected
  )
    showSelection(revealSelection);
  if (keepScroll !== null && Math.abs(scrollY - keepScroll) > 1)
    scrollTo(0, keepScroll);
  if (watchingRoom) {
    $("stop-watching").onclick = () => void stopWatching();
    return;
  }
  if (!isRoom && accountsUI?.account)
    $<HTMLInputElement>("name").readOnly = true;
  if (isRoom) {
    wireRoom();
  } else {
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
      if (roomMode === "raid") void accountsUI.showRaidHub();
      else void play("create");
    };
    $("join").onclick = () => void play("join");
    $("watch").onclick = () =>
      void watchRoom($<HTMLInputElement>("code").value);
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
    wireRaidLobby();
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
async function leave() {
  if (watching && !myId) {
    await stopWatching();
    return;
  }
  const reply = await request("leave", {
    token: sessionStorage.getItem("arena-token"),
  });
  if (!reply.ok) {
    toast("Could not leave the room yet. Reconnect and try again.");
    return;
  }
  sessionStorage.removeItem("arena-token");
  lobbySelection.reset();
  state = undefined;
  myId = "";
  local = undefined;
  pending = [];
  screen = "";
  renderMenu();
  $<HTMLDialogElement>("dialog").close();
  menuOpen = false;
}
function renderBattle() {
  document.body.classList.remove("home-active", "lobby-active", "gate-active");
  if (!state?.practice) document.body.classList.remove("practice-active");
  syncTown();
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
  document.body.style.setProperty(
    "--element",
    `#${CHARACTERS[me.character].color.toString(16).padStart(6, "0")}`,
  );
  document.body.classList.toggle("battle-raid", !!state.raid);
  document.body.classList.toggle("spectating", !myId && !!watching);
  queueMicrotask(refreshControlLabels);
  const hudOrder = isTeams()
    ? [
        ...state.players.filter((p) => teamOf(p) === teamOf(me)),
        ...state.players.filter((p) => teamOf(p) !== teamOf(me)),
      ]
    : isFfa()
      ? [me, ...state.players.filter((p) => p !== me)]
      : state.players;
  const key = `battle:${me.character}:${!!state.practice}:${state.mode ?? "duel"}:${hudOrder.map((p) => p.id + p.character).join(",")}`;
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
        `<details id="practice-settings" class="practice-settings"><summary>Practice</summary><div class="practice-panel"><div class="practice-heading"><span class="eyebrow">Solo test mode</span><span id="practice-stats"></span></div><div class="practice-actions"><label>Creature <select id="practice-character">${Object.values(
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
    $("hud").innerHTML = hudOrder
      .map(
        (p, i) =>
          `${i === split ? '<div class="timer-wrap"><span id="round-label"></span><strong id="timer">03:00</strong><span id="phase-label"></span></div>' : ""}<div class="health-card ${i >= split ? "right" : ""}${isTeams() ? ` team-${teamOf(p)}${p.id === myId ? " me" : ""}` : isFfa() && p.id === myId ? " me" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16)}"><div><b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}</span><strong id="score-${i}"></strong></div><div class="health-track"><span id="health-${i}"></span></div><small id="health-text-${i}"></small><small id="status-${i}"></small><div class="hud-ultimate" title="Ultimate charge"><span>ULT <b id="ult-text-${i}"></b></span><div class="hud-ultimate-track" role="meter" aria-label="${escape(p.name)} ultimate charge" aria-valuemin="0" aria-valuemax="100"><i id="ult-meter-${i}"></i></div></div></div>`,
      )
      .join("");
    battleHudSize.disconnect();
    battleHudSize.observe($("hud"));
    battleHudSize.observe($("phase-label"));
    const c = CHARACTERS[me.character];
    $("abilities").innerHTML =
      `<div class="basic-hint" title="${c.basic.name}: ${c.basic.description} No cooldown · ${Math.round((c.basic.interval ?? 0.3) * 1000)} ms between attacks."><kbd data-action="basic">${keyText("basic")}</kbd><span>${abilityIcon(c.basic.name)}<small>${c.basic.name.toUpperCase()}</small></span></div>${c.skills.map((a, i) => `<div class="ability" id="ability-${i}" style="--element:#${c.color.toString(16)}"><kbd data-action="${SKILL_ACTIONS[i]}">${keyText(SKILL_ACTIONS[i])}</kbd><span>${abilityIcon(a.name)}<small id="cooldown-${i}">READY</small></span><i class="cooldown-fill" id="fill-${i}"></i><i class="skill-cooldown-ring" aria-hidden="true"></i></div>`).join("")}<div class="movement-ability"><kbd data-action="dash">${keyText("dash")}</kbd><span>Dash<small id="dash-cd"></small></span></div><div class="movement-ability"><kbd data-action="jump">${keyText("jump")}</kbd><span>Jump<small id="jump-cd"></small></span></div>`;
  }
  hudOrder.forEach((p, i) => {
    const c = CHARACTERS[p.character];
    $(`health-${i}`).style.width = `${(100 * Math.max(0, p.hp)) / c.health}%`;
    $(`health-text-${i}`).textContent = p.out
      ? "LEFT THE MATCH"
      : `${Math.ceil(Math.max(0, p.hp))} / ${c.health} HP`;
    $(`score-${i}`).textContent = state!.practice
      ? p.id === myId
        ? "TRAINER"
        : "TARGET"
      : isTeams()
        ? `${state!.teamScores?.[teamOf(p)] ?? 0} / ${roundsNeeded(state!.mutators)}`
        : `${state!.scores[p.id]} / ${roundsNeeded(state!.mutators)}`;
    const charge = Math.min(
      100,
      Math.max(0, (100 * (p.ult ?? 0)) / RULES.ultMax),
    );
    $(`ult-text-${i}`).textContent =
      charge >= 100 ? "READY" : `${Math.floor(charge)}%`;
    $(`ult-meter-${i}`).style.width = `${charge}%`;
    $(`ult-meter-${i}`).parentElement!.setAttribute(
      "aria-valuenow",
      String(Math.floor(charge)),
    );
    $(`ult-meter-${i}`)
      .closest(".hud-ultimate")
      ?.classList.toggle("is-ready", charge >= 100);
    $(`status-${i}`).textContent = p.statuses
      .map((s) =>
        s.kind === "sleep"
          ? `SLEEP +${Math.round((STATUS_RULES.sleepVulnerability - 1) * 100)}% DMG`
          : s.kind === "mark"
            ? comboOf(s.by).toUpperCase()
            : s.kind.toUpperCase(),
      )
      .join(" · ");
  });
  if (state.practice) {
    $("practice-stats").textContent =
      `Damage dealt: ${Math.round(me.stats.dealt)} · Damage taken: ${Math.round(me.stats.received)} · Skills used: ${me.stats.skills}`;
    $<HTMLInputElement>("practice-unlimited").checked =
      state.practice.unlimitedCooldowns;
    $<HTMLInputElement>("practice-attacks").checked =
      state.practice.targetAttacks;
  }
  $("round-label").textContent = state.practice
    ? "FREE PRACTICE"
    : `ROUND ${state.round} · BEST OF ${roundsNeeded(state.mutators) * 2 - 1}`;
  $("network").textContent = `${state.raid ? "Raid" : (state.arena ?? "classic") === "classic" ? "Coliseum" : ARENAS[state.arena!].name} · ${state.practice ? "Practice" : state.raid ? "Boss fight" : "Online match"}`;
  const seconds = Math.ceil(state.remaining);
  $("timer").textContent = state.practice
    ? "∞"
    : state.overtime
      ? "OVERTIME"
      : `${Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  $("phase-label").textContent =
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
  $("timer").classList.toggle(
    "ring-on",
    !state.practice &&
      state.phase === "playing" &&
      ringRadius(state.remaining, state.overtime) !== null,
  );
  kitOf(me.character, me.rites).skills.forEach((a, i) => {
    $(`ability-${i}`).title = `${a.name}: ${a.description}`;
    $(`ability-${i}`).setAttribute("aria-label", `${a.name}: ${a.description}`);
    if (i === ULT_SLOT) {
      // The ultimate fills a meter by fighting instead of a cooldown.
      const full = (me.ult ?? 0) >= RULES.ultMax;
      if (full && !ultWasReady && state!.phase === "playing" && myId) {
        audio.play("orb");
        // A one-off pop the moment the meter fills.
        const button = $(`ability-${i}`);
        button.classList.add("ult-burst");
        setTimeout(() => button.classList.remove("ult-burst"), 650);
      }
      ultWasReady = full;
      const charge = Math.floor(me.ult ?? 0),
        ready = skillReady(
          me,
          i,
          state!.time,
          !!state!.practice?.unlimitedCooldowns,
        );
      const armed = exArmedUntil > performance.now();
      const exReady = !ready && charge >= EX.cost && !state!.practice;
      $(`cooldown-${i}`).textContent = ready
        ? "READY"
        : armed
          ? "EX ARMED"
          : exReady
            ? `${charge}% · EX`
            : `${charge}%`;
      $(`fill-${i}`).style.height = `${ready ? 0 : 100 - charge}%`;
      $(`ability-${i}`).style.setProperty(
        "--cooldown",
        `${ready ? 0 : 100 - charge}%`,
      );
      $(`ability-${i}`).classList.toggle("cooling", !ready);
      $(`ability-${i}`).classList.toggle("ult-ready", ready);
      $(`ability-${i}`).classList.toggle("ex-ready", exReady && !armed);
      $(`ability-${i}`).title = ready
        ? `${a.name}: ${a.description}`
        : `${a.name}: ${a.description} Press it before the meter is full to arm an EX skill (costs ${EX.cost}% of the meter): your next skill hits ${Math.round((EX.damage - 1) * 100)}% harder and ${Math.round((EX.radius - 1) * 100)}% wider.`;
      return;
    }
    $(`ability-${i}`).classList.toggle(
      "ex-armed",
      exArmedUntil > performance.now(),
    );
    const left = Math.max(0, me.cooldowns[i] - state!.time);
    $(`cooldown-${i}`).textContent = left > 0 ? `${left.toFixed(1)}s` : "READY";
    $(`fill-${i}`).style.height =
      `${(100 * left) / (a.cooldown * cooldownScale())}%`;
    $(`ability-${i}`).style.setProperty(
      "--cooldown",
      `${Math.min(100, (100 * left) / (a.cooldown * cooldownScale()))}%`,
    );
    $(`ability-${i}`).classList.toggle("cooling", left > 0);
  });
  $("dash-cd").textContent =
    me.dashAt > state.time
      ? `${(me.dashAt - state.time).toFixed(1)}s`
      : "READY";
  $("jump-cd").textContent =
    me.jumpAt > state.time
      ? `${(me.jumpAt - state.time).toFixed(1)}s`
      : "READY";
  touch.update(
    state.phase === "playing" && connected && !!myId,
    CHARACTERS[me.character].skills.map((a) => a.name),
    me.cooldowns.map((t) => Math.max(0, t - state!.time)),
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
      async () =>
        (await accountsUI.api(
          "/api/raids",
        )) as import("../../../packages/shared/src/raid").RaidProgress,
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
    const rewards = document.getElementById("raid-rewards");
    if (rewards)
      rewards.onclick = () =>
        void accountsUI.showRaidHub(state?.raid?.boss, "rewards");
    return;
  }
  const overlay = $("arena-overlay");
  if (!myId && watching) {
    renderWatchOverlay(overlay);
    return;
  }
  if (state.phase === "playing") {
    const partner =
      isTeams() && me.hp <= 0
        ? state.players.find(
            (p) => p.id !== myId && teamOf(p) === teamOf(me) && p.hp > 0,
          )
        : undefined;
    // Its own element: a non-empty overlay dims the whole screen on phones.
    setOverlayMarkup(overlay, "");
    const banner = $("spectate");
    const outOfRound = isFfa() && me.hp <= 0 && !me.out;
    banner.hidden = !partner && !outOfRound;
    if (partner) banner.textContent = `Knocked out · watching ${partner.name}`;
    else if (outOfRound)
      banner.textContent = `Knocked out · ${state.players.filter((p) => p.hp > 0 && !p.out).length} still fighting`;
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
      // Who's fighting whom, each wearing their trait aura (you first).
      const card = (p: Fighter) =>
        `<div class="vs-fighter${p.id === myId ? " me" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16).padStart(6, "0")}">${scopeIds(withAura(fighterArt(p.character, undefined, skinOf(p, p.character)), p.character, reducedMotion), `vs${state!.players.indexOf(p)}`)}<b>${escape(p.name)}${p.id === myId ? " <small>(you)</small>" : ""}</b><span>${CHARACTERS[p.character].name} · ${CHARACTERS[p.character].element}</span></div>`;
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
      const arena = ARENAS[state.arena ?? "classic"];
      details =
        (state.arcade
          ? `<p class="arcade-brief"><b>${ARCADE_EVENTS[state.arcade.id].name}</b>${ARCADE_EVENTS[state.arcade.id].tip} · Arcade does not change your PvP rating.</p>`
          : "") +
        versus +
        teamUpNote(me) +
        `<p class="arena-brief"><b>Arena · ${escape(arena.name)}</b>${escape(state.arcade ? ARCADE_EVENTS[state.arcade.id].tip : arena.tip)}</p>` +
        '<p class="mobile-howto">Touch mode: left joystick to move; big button for basic attacks, the four curved buttons for skills, DASH and JUMP below. Aim follows your nearest opponent. Use Enter fullscreen below the arena.</p>' +
        controlsList() +
        "<p>" +
        (isTeams()
          ? `Stick with your partner and focus the same target: side by side, you both hit ${Math.round((TEAMUP.damage - 1) * 100)}% harder (a link shows between you). Your attacks pass through your teammate. First team to win ${roundWord()} rounds takes the match.`
          : isFfa()
            ? `Everyone is your enemy: the last fighter standing takes the round. First to win ${roundWord()} rounds takes the match.`
            : `Use cover. First to win ${roundWord()} rounds takes the match.`) +
        partyRulesNote() +
        " The countdown begins when everyone confirms.</p>";
      actions = `<button class="primary btn-primary" id="instructions-ready" ${confirmed ? "disabled" : ""}>${confirmed ? "Waiting for the others…" : "I’m ready"}</button>`;
    }
    if (state.phase === "countdown") {
      heading = `${Math.ceil(state.remaining)}`;
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
      actions = `<div class="result-actions"><button class="primary btn-primary" id="rematch">${me.ready ? "Waiting for opponent…" : iconLabel("again", "Rematch")}</button><button class="secondary btn-secondary" id="share-result">${iconLabel("share", "Share result")}</button><button class="secondary btn-secondary" id="return">${state.vsBot ? iconLabel("home", "Back to menu") : iconLabel("back", "Return to lobby")}</button></div>`;
    }
    const markup = `<div class="overlay-card${actions ? " action-overlay" : state.phase === "countdown" ? " countdown-card" : ""}"><span class="eyebrow">Element Arena</span><h2>${heading}</h2><div${actions ? ' class="panel-scroll" tabindex="0" role="region" aria-label="Match details"' : ""}>${details}</div>${actions ? `<div class="panel-actions">${actions}</div>` : ""}</div>`;
    // Preserve the pressed button and native scrolling between snapshots.
    setOverlayMarkup(
      overlay,
      markup,
      actions
        ? `${state.code}:${state.matchId ?? ""}:${state.phase}`
        : undefined,
    );
    fillLiveSeconds(
      overlay,
      state.phase === "paused" ? state.pauseRemaining : state.remaining,
    );
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
  connected = true;
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
  syncTown();
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
socket.on("disconnect", () => {
  lobbySelection.reset();
  connected = false;
  if (!myId && !watching && !state) {
    screen = "";
    renderMenu();
  }
  $("connection").textContent = "RECONNECTING…";
  $("connection").classList.remove("online");
  pending = [];
  toast("Connection lost. Reconnecting to your session…");
});
socket.on("connect_error", (error: Error) => {
  toast(error.message);
  $("connection").textContent = "LOGIN REQUIRED";
});
socket.on("account-changed", () => void accountsUI.refresh());
// Coins, missions or Awakening changed after a match or raid.
socket.on("economy-changed", () => void accountsUI.loadEconomy());
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
socket.on("access-revoked", ({ error }: { error: string }) => {
  sessionStorage.removeItem("arena-token");
  lobbySelection.reset();
  state = undefined;
  myId = "";
  local = undefined;
  pending = [];
  screen = "";
  renderMenu();
  toast(error);
  void accountsUI.refresh();
});
socket.on("state", (snapshot: WireSnapshot) => {
  const spectator = !myId && !!watching;
  // A stale room (we left it) can still send a last snapshot: ignore it.
  if (spectator && snapshot.code !== watching) return;
  if (state?.phase !== snapshot.phase || state?.round !== snapshot.round)
    remoteFrames.clear();
  const previous = state;
  state = unpackSnapshot(snapshot);
  scene?.observeSnapshot(state, previous);
  pwa.sync();
  remoteFrames.add(state, performance.now());
  const me = state.players.find((p) => p.id === myId);
  if (!me) {
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
  local = structuredClone(me);
  for (const [i, input] of pending.entries())
    predict(local, input, state.time + (i + 1) / RULES.tick);
  for (const event of state.events)
    if (event.id > eventId) {
      if (scene && state.phase !== "lobby") scene.effect(event);
      eventId = Math.max(eventId, event.id);
    }
  if (
    state.phase === "finished" &&
    state.matchId &&
    !state.practice &&
    !state.arcade
  )
    void reportMatch(state.matchId);
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
  if (state?.raid && p.hp <= 0) {
    if (!p.out) {
      const d = normalize(input.dx, input.dy);
      move(p, (d.x * 35) / RULES.tick, (d.y * 35) / RULES.tick);
    }
    return;
  }

  if (input.dash && time >= p.dashAt) {
    const d = normalize(input.dx, input.dy);
    p.dashX = (d.x || d.y ? d.x : Math.cos(p.angle)) * RULES.dashSpeed;
    p.dashY = (d.x || d.y ? d.y : Math.sin(p.angle)) * RULES.dashSpeed;
    p.dashUntil = time + RULES.dashDuration;
    p.dashAt = time + RULES.dashCooldown;
  }
  advanceMovement(p, input, 1 / RULES.tick, time);
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
      (p) => !p.raidBoss && !p.out && p.id !== myId,
    ).length;
    return `<button id="exit-room" class="secondary btn-secondary leave-button is-costly"><span>${buttonIcon("leave")}Leave raid</span><small>${others ? "Your team carries on without you" : "Ends this run"}</small></button>`;
  }
  return `<button id="exit-room" class="secondary btn-secondary leave-button is-costly"><span>${buttonIcon("leave")}Leave match</span><small>Counts as a forfeit</small></button>`;
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
    const input = document.getElementById(out.dataset.prefFor!) as HTMLInputElement | null;
    if (input) out.value = `${Math.round(Number(input.value) * 100)}%`;
  }
}
const syncDialogPrefs = () => syncPrefOutputs($<HTMLDialogElement>("dialog"));
function showSettings() {
  settingsOpen = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchHTML = touch.settingsHTML();
  dialog(
    `<div class="settings-screen"><h2>Settings</h2><p class="prefs-note">Online matches keep running while this is open.</p><div class="prefs-grid${touchHTML ? " has-touch" : ""}"><section class="prefs-card" aria-labelledby="prefs-sound"><h3 id="prefs-sound">${menuIcon("sound")}Sound</h3>${prefSlider("music", "Music", audio.music, { min: 0, max: 1, step: 0.01 })}${prefSlider("effects", "Sound effects", audio.effects, { min: 0, max: 1, step: 0.01 })}</section><section class="prefs-card" aria-labelledby="prefs-motion"><h3 id="prefs-motion">${menuIcon("motion")}Motion</h3><p class="prefs-status"><b class="${reduced ? "is-on" : ""}">Reduced motion ${reduced ? "on" : "off"}</b><span>Follows your device's accessibility setting.</span></p></section>${touchHTML ? `<section class="prefs-card prefs-touch" aria-labelledby="prefs-touch">${touchHTML}</section>` : ""}</div><div class="settings-actions"><button id="open-controls" class="secondary btn-secondary">${iconLabel("keyboard", "Controls &amp; key bindings")}</button>${myId ? leaveButton() : watching ? `<button id="exit-room" class="secondary btn-secondary leave-button">${iconLabel("stop-watching", "Stop watching")}</button>` : ""}<button id="settings-report" class="quiet">${iconLabel("report", "Report a problem")}</button><button id="settings-credits" class="quiet">${iconLabel("star", "Credits")}</button></div></div>`,
  );
  for (const kind of ["music", "effects"] as const)
    $(kind).oninput = () => {
      audio.unlock();
      audio.set(kind, Number($<HTMLInputElement>(kind).value));
    };
  touch.bindSettings();
  const box = $<HTMLDialogElement>("dialog");
  // Same function each time, so reopening Settings doesn't stack listeners.
  box.addEventListener("input", syncDialogPrefs);
  // Reset sets the knobs directly (no input event), so refresh after it.
  document
    .getElementById("control-reset")
    ?.addEventListener("click", () => setTimeout(() => syncPrefOutputs(box)));
  $("open-controls").onclick = showControls;
  $("settings-report").onclick = () => accountsUI.showReport(reportContext());
  $("settings-credits").onclick = showCredits;
  const exitRoom = $("exit-room");
  if (exitRoom) exitRoom.onclick = () => void leave();
}
/** Who and what made the game (opened from Settings, with a way back). */
function showCredits() {
  dialog(
    `<div class="credits-screen"><button type="button" class="quiet" id="credits-back">${iconLabel("back", "Settings")}</button><h2>Credits</h2><div class="credits-hero"><span class="credits-crest" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="credits-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#credits-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><div><b>Element Arena</b><small>Real-time creature duels from Elemental Plaza.</small></div></div><div class="credits-grid"><section class="prefs-card"><h3>${menuIcon("user")}Creatures &amp; world</h3><p>Eight original creatures, each an articulated shaded-vector rig with front, back and side views, plus the town and its coliseum.</p></section><section class="prefs-card"><h3>${menuIcon("sound")}Music</h3><p>Original music played on instrument recordings from the <a href="https://github.com/sgossner/VCSL" target="_blank" rel="noopener noreferrer">Versilian Community Sample Library</a> and <a href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noopener noreferrer">VSCO 2 Community Edition</a> (CC0 public domain).</p></section><section class="prefs-card"><h3>${menuIcon("keyboard")}Built with</h3><ul class="credits-tags">${["Phaser", "Socket.IO", "Express", "TypeScript", "Vite", "Supabase"].map((t) => `<li>${t}</li>`).join("")}</ul></section></div></div>`,
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
$("leaderboard").onclick = () => void accountsUI.showLeaderboard();
// In town the header's log-out button is folded into this menu.
$("menu-logout").onclick = () => {
  headerMenu.open = false;
  document.getElementById("account-logout")?.click();
};
$("help").onclick = () =>
  dialog(
    `<div class="help-screen"><div class="eyebrow">How to play</div><h2>Welcome to Elemental Plaza.</h2><p>Everyone online shares this town. Walk to a building to use it, or open <b>Menu</b> (bottom left) and press <b>Play</b> to start a match. In battle, win three rounds to take the match.</p>${townGuide(usingPad)}<div class="eyebrow help-battle-eyebrow">In battle</div><div class="help-layout"><section class="help-controls" aria-label="Game controls">${controlsList(true)}</section>${illustratedHelp()}</div></div>`,
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

class ArenaScene extends Phaser.Scene {
  graphics!: Phaser.GameObjects.Graphics;
  /** Grumblecrag on the painted court: sorted with the fighters by where it stands. */
  bossGraphics!: Phaser.GameObjects.Graphics;
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
  courtBlocks = new Map<CourtId, { img: Phaser.GameObjects.Image; o: { x: number; y: number; w: number; h: number }; shifting?: boolean }[]>();
  activeCourt?: CourtId;
  /** What lies beyond each court's back edge, shown above it (world y < 0). */
  stands = new Map<CourtId, Phaser.GameObjects.Image>();
  /** Grumblecrag's raid plays on the Coliseum court (no stands strip). */
  courtRaid = false;
  /** A broken pillar's rubble, with the floor under it (no block shadow). */
  rubble: Phaser.GameObjects.Image[] = [];
  /** Bake an arena's floor once (2x on dense screens); returns its texture key. */
  floorTexture(id: string) {
    const key = `arena-floor-${id}`;
    const bake = floorBake();
    if (!this.textures.exists(key)) {
      this.floorScale.set(key, bake);
      const bare = id.endsWith("-bare");
      const court = id.startsWith("court-") ? id.slice(6).replace(/-bare$/, "") : "";
      if (isCourt(court)) {
        const canvas = document.createElement("canvas");
        canvas.width = RULES.width * bake;
        canvas.height = RULES.height * bake;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(bake, bake);
        paintCourtFloor(ctx, court, bare);
        this.textures.addCanvas(key, canvas);
      } else {
        const g = this.make.graphics({}, false);
        paintArenaFloor(scaledPainter(g, bake), ARENAS[id as ArenaId]);
        g.generateTexture(key, RULES.width * bake, RULES.height * bake);
        g.destroy();
      }
    }
    return key;
  }
  /** Bake and place a court's blocks (once per court). */
  private ensureBlocks(id: CourtId) {
    if (this.courtBlocks.has(id)) return this.courtBlocks.get(id)!;
    const bake = floorBake();
    const list = courtBlocks(id).map((o) => ({ o, shifting: false }));
    if (id === "shifting-ruins") list.push({ o: SHIFTING_BLOCK, shifting: true });
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
        this.textures.addCanvas(key, canvas);
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
  showArena(arena: ArenaId, raid: boolean) {
    // Every raid but Grumblecrag's brings its own arena; its pillars are the
    // Coliseum's blocks, so it fights on that court.
    const court = isCourt(arena) && (!raid || arena === "classic") ? arena : undefined;
    const id = court ? `court-${court}${raid ? ":raid" : ""}` : arena;
    if (id === this.floorArena || !this.floor) return;
    this.floorArena = id;
    this.activeCourt = court;
    this.courtRaid = !!court && raid;
    const standsOn = !!court && !raid;
    const label = document.querySelector<HTMLElement>(".map-label");
    if (label) {
      label.hidden = !!court;
      label.innerHTML =
        arena === "cloud-deck"
          ? "CLOUD DECK <span>SOMNARA’S DREAM</span>"
          : `${ARENAS[arena].name.toUpperCase()} <span>ELEMENT ARENA</span>`;
    }
    const key = this.floorTexture(court ? `court-${court}` : arena);
    this.floor.setTexture(key).setScale(1 / (this.floorScale.get(key) ?? 1));
    if (court) this.ensureBlocks(court);
    for (const [cid, list] of this.courtBlocks) for (const b of list) b.img.setVisible(cid === court && !b.shifting);
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
        this.textures.addCanvas(skey, canvas);
      }
      this.stands.set(court, this.add.image(0, -STANDS, skey).setOrigin(0).setScale(1 / bake).setDepth(-10));
    }
    for (const [cid, img] of this.stands) img.setVisible(standsOn && cid === court);
    if (this.courtRaid && !this.rubble.length) this.rubble = courtBlocks("classic").map((o, i) => this.rubbleImage(o, i));
    for (const img of this.rubble) img.setVisible(false);
    // The frame grows to show the stands on desktop (see .court-view in CSS).
    document.body.classList.toggle("court-view", standsOn);
  }
  /**
   * Where a pillar stood once Grumblecrag breaks it: the court floor without
   * that block's shadow, and a low heap of its stones (walkable, so it sits
   * on the ground under everyone).
   */
  private rubbleImage(o: { x: number; y: number; w: number; h: number }, index: number) {
    const bake = floorBake(),
      key = `court-rubble-${index}`;
    const x = o.x - RUBBLE_PAD,
      y = o.y - RUBBLE_PAD,
      w = o.w + RUBBLE_PAD * 2 + 32,
      h = o.h + RUBBLE_PAD * 2 + 8;
    if (!this.textures.exists(key)) {
      const bare = this.textures.get(this.floorTexture("court-classic-bare")).getSourceImage() as HTMLCanvasElement;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(w * bake);
      canvas.height = Math.ceil(h * bake);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bare, x * bake, y * bake, w * bake, h * bake, 0, 0, w * bake, h * bake);
      ctx.scale(bake, bake);
      ctx.translate(-x, -y);
      paintCourtRubble(ctx, o, index);
      this.textures.addCanvas(key, canvas);
    }
    return this.add.image(x, y, key).setOrigin(0).setScale(1 / bake).setDepth(-9).setVisible(false);
  }
  /**
   * A block hides whoever stands just behind it, so it turns see-through
   * while a fighter is there (they stay readable; the block still blocks).
   * The Shifting Ruins block shows only while it's up.
   */
  private updateBlocks(
    players: readonly { x: number; y: number; raidBoss?: boolean }[],
    t: number,
    pillars?: readonly { broken: boolean }[],
  ) {
    const list = this.activeCourt && this.courtBlocks.get(this.activeCourt);
    if (!list) return;
    for (const [i, { img, o, shifting }] of list.entries()) {
      if (shifting) img.setVisible(shiftingUp(ARENAS["shifting-ruins"], t));
      if (this.courtRaid) {
        const broken = !!pillars?.[i]?.broken;
        img.setVisible(!broken);
        this.rubble[i]?.setVisible(broken);
      }
      // Grumblecrag is tall: it disappears further behind a block.
      const behind = players.some(
        (p) => p.x > o.x - 30 && p.x < o.x + o.w + 30 && p.y < o.y + o.h && p.y > o.y - (p.raidBoss ? 170 : 95),
      );
      img.setAlpha(img.alpha + ((behind ? 0.45 : 1) - img.alpha) * 0.25);
    }
  }
  /** Knockout moment: camera push-in multiplier and its end time. */
  koZoom = 1;
  koUntil = 0;
  accumulator = 0;
  actions = { skill: -1, dash: false, jump: false, basic: false };
  canControl() {
    return (
      connected &&
      state?.phase === "playing" &&
      !($("practice-settings") as HTMLDetailsElement | null)?.open &&
      !$<HTMLDialogElement>("dialog").open &&
      document.hasFocus() &&
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
  private assets = Object.fromEntries(
    (Object.keys(CHARACTERS) as CharacterId[]).map((id) => [id, rigAssets(id)]),
  ) as Record<CharacterId, ReturnType<typeof rigAssets>>;
  private animationLive = false;
  private needsHydration = true;
  private followCamera = new FollowCamera();
  private enemyBearing = document.createElement("div");
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
      rig = createFighterVisual(this, character, this.assets[character]);
      this.rigs.set(id, rig);
    }
    return rig;
  }
  observeSnapshot(next: Snapshot, previous?: Snapshot) {
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
      const rig = this.getRig(p.id, p.character);
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
    for (const id of Object.keys(CHARACTERS) as CharacterId[])
      queueFighterAssets(this, id, this.assets[id]);
  }
  create() {
    scene = this;
    this.enemyBearing.className = "enemy-bearing";
    this.enemyBearing.hidden = true;
    this.enemyBearing.innerHTML =
      '<span aria-hidden="true">➜</span><strong></strong>';
    $("game").parentElement!.append(this.enemyBearing);
    this.cameras.main.setBackgroundColor("#142746");
    // Paint the court once and bake it into a texture so it costs nothing per frame.
    // High-density screens get a 2x bake so the floor stays sharp when zoomed in.
    this.floor = this.add
      .image(0, 0, this.floorTexture("classic"))
      .setOrigin(0)
      .setScale(1 / (this.floorScale.get("arena-floor-classic") ?? 1))
      .setDepth(-10);
    new ResizeObserver(() => fitRenderer()).observe($("game"));
    this.graphics = this.add.graphics();
    this.bossGraphics = this.add.graphics();
    // Keys and mouse buttons are read through the player's bindings (see pressAction).
    this.input.mouse!.disableContextMenu();
    this.scale.refresh();
  }
  effect(event: Snapshot["events"][number]) {
    if (event.kind === "raid-impact") {
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

    if (
      (event.owner === myId &&
        event.kind !== "impact" &&
        event.kind !== "raid-impact") ||
      event.kind === "hit" ||
      event.kind === "round"
    )
      audio.play(event.kind);
    if (
      this.animationLive &&
      event.kind === "cast" &&
      event.owner &&
      event.abilityId
    ) {
      const p = state?.players.find((p) => p.id === event.owner);
      if (p) {
        const c = CHARACTERS[p.character];
        const slot = c.skills.findIndex((a) => a.id === event.abilityId);
        if (slot >= 0 || event.abilityId === c.basic.id)
          this.getRig(p.id, p.character).trigger(
            slot >= 0
              ? (`skill${slot}` as "skill0" | "skill1" | "skill2" | "skill3")
              : "basic",
            this.feelClock,
            slot >= 0
              ? Math.max(
                  c.skills[slot].kind === "cone"
                    ? c.skills[slot].duration * 1000
                    : 0,
                  slot === 3 ? 650 : 360,
                )
              : 220,
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
        this.getRig(p.id, p.character).trigger(
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
    const skinColor = owner ? fighterSkillColor(owner) : undefined;
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
    // Novas play on their burst event; every other move plays on cast.
    if (ability && event.kind === "burst") {
      const combo = owner && COMBOS[owner.character];
      const shown =
        event.combo && combo?.radius
          ? { ...ability, radius: ability.radius * combo.radius }
          : ability;
      playCast(this, shown, event.x, event.y, 0, event.color, reducedMotion);
    }
    if (event.kind === "hazard") this.hazardBurst(event);
    if (event.combo && (event.kind === "burst" || event.kind === "hit"))
      this.comboText(event);
    if (ability && event.kind === "cast" && ability.kind !== "nova")
      playCast(
        this,
        ability,
        event.x,
        event.y,
        owner?.angle ?? 0,
        event.color,
        reducedMotion,
      );
    if (ability && event.kind === "impact")
      playImpact(this, ability, event.x, event.y, event.color, reducedMotion);
    if (event.kind === "hit" && event.target) this.feelHit(event);
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
  comboText(event: Snapshot["events"][number]) {
    const key = `${event.source ?? event.owner}:${event.combo}`;
    const now = performance.now();
    if ((this.comboShown.get(key) ?? 0) > now) return;
    this.comboShown.set(key, now + 600);
    const label = this.add
      .text(
        event.x,
        event.y - 75,
        event.abilityId === "ex-cast"
          ? `${event.combo!.toUpperCase()}!`
          : `${event.combo!.toUpperCase()} COMBO!`,
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
    );
    const now = performance.now();
    // Burn ticks and other chip damage don't flash, or burning fighters strobe.
    if ((event.value ?? 0) >= 4)
      this.flashUntil.set(event.target!, now + feel.flashMs);
    if (feel.stopMs)
      this.stopUntil = Math.max(this.stopUntil, now + feel.stopMs);
    if (feel.shakeMs) this.cameras.main.shake(feel.shakeMs, feel.shake, false);
    rumble(feel.rumbleMs, feel.rumble);
    if (event.ko && !reducedMotion) {
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
    const feelNow = performance.now();
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
    const tracked = partner ?? me;
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
    const view = this.followCamera.update(
      this.scale.width,
      this.scale.height,
      touch.enabled &&
        document.body.classList.contains("battle-active") &&
        innerWidth > innerHeight,
      touch.enabled &&
        innerWidth > innerHeight &&
        follow &&
        presented &&
        !state?.arcade &&
        state?.raid?.boss !== "somnara" &&
        state?.raid?.boss !== "prismatail" &&
        state?.raid?.boss !== "emberwing" &&
        state?.raid?.boss !== "storm-twins"
        ? {
            ...follow,
            x: presented.x,
            y: presented.y,
            attacking:
              this.getRig(follow.id, follow.character).controller.state ===
                "basic" ||
              this.getRig(
                follow.id,
                follow.character,
              ).controller.state.startsWith("skill"),
          }
        : undefined,
      `${state?.code ?? "menu"}:${state?.round ?? 0}:${myId ?? ""}`,
      delta,
      reducedMotion,
      this.activeCourt && !this.courtRaid ? STANDS : 0,
    );
    this.cameras.main
      .setZoom(view.zoomX * this.koZoom, view.zoomY * this.koZoom)
      .centerOn(view.x, view.y);
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
    if (opponent && !this.enemyBearing.hidden) {
      this.enemyBearing.querySelector("strong")!.textContent =
        opponent.raidBoss && state?.raid
          ? state.raid.boss === "storm-twins"
            ? opponent.name
            : state.raid.name
          : CHARACTERS[opponent.character].name;
      this.enemyBearing.querySelector<HTMLElement>("span")!.style.transform =
        `rotate(${Math.atan2((opponent.y - view.y) * view.zoomY, (opponent.x - view.x) * view.zoomX)}rad)`;
    }
    for (const [id, label] of this.labels)
      if (!state?.players.some((p) => p.id === id)) {
        label.remove();
        this.labels.delete(id);
        this.positions.delete(id);
      }
    const pad = pollPad();
    if (!this.canControl()) {
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
      caster.cancel();
      touch.reset();
    }
    if (!state || state.phase === "lobby") {
      this.rigs.forEach((rig) => rig.setVisible(false));
      this.labels.forEach((label) => (label.hidden = true));
      return;
    }
    // Walls for prediction (the Shifting Ruins block comes and goes) and the floor.
    useObstacles(
      state.raid
        ? state.arena === "lagoon" ||
          state.arena === "lantern-yard" ||
          state.arena === "cloud-deck" ||
          state.arena === "sun-atrium" ||
          state.arena === "sky-terrace" ||
          state.arena === "conductor-ring"
          ? []
          : OBSTACLES.filter((_, i) => !state!.raid!.pillars[i]?.broken)
        : obstaclesAt(state.arena, arenaClock()),
    );
    useSpeedScale(state.mutators?.includes("speed") ? MUTATOR_RULES.speed : 1);
    this.showArena(state.arena ?? "classic", !!state.raid);
    this.updateBlocks(state.players, arenaClock(), state.raid?.pillars);
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / RULES.tick) {
      this.accumulator -= 1000 / RULES.tick;
      if (!connected || state.phase !== "playing" || !local) continue;
      const active =
        this.canControl() &&
        !settingsOpen &&
        !menuOpen &&
        !$<HTMLDialogElement>("dialog").open &&
        document.hasFocus() &&
        !document.hidden;
      const enemies = visibleEnemies(local, local);
      const target = enemies[0];
      let skill = active ? this.actions.skill : -1;
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
      const keyX = Number(heldAction("right")) - Number(heldAction("left")),
        keyY = Number(heldAction("down")) - Number(heldAction("up"));
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
        aimAt = assistAim(aimAt, enemies);
      const stormAim = state ? stormTarget(state) : undefined;
      if (stormAim) aimAt = stormAim;
      const prismAim = state ? prismatailAim(state, local) : undefined;
      if (prismAim) aimAt = prismAim;
      aimAt = {
        x: Phaser.Math.Clamp(aimAt.x, 0, RULES.width),
        y: Phaser.Math.Clamp(aimAt.y, 0, RULES.height),
      };
      this.aimPoint = aimAt;
      const input: Input = {
        seq: ++seq,
        dx: active ? (touch.enabled ? touch.dx : keyX || (pad?.dx ?? 0)) : 0,
        dy: active ? (touch.enabled ? touch.dy : keyY || (pad?.dy ?? 0)) : 0,
        aimX: aimAt.x,
        aimY: aimAt.y,
        basic:
          active &&
          (prismAim
            ? prismAim.basic
            : (touch.enabled
                ? touch.basic
                : heldAction("basic") || !!pad?.held.has("basic")) ||
              this.actions.basic),
        skill,
        ...(ex ? { ex: true } : {}),
        dash: active && this.actions.dash,
        jump: active && this.actions.jump,
      };
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
      socket.emit("input", input);
      pending.push(input);
      if (pending.length > 90) pending.shift();
      predict(local, input, state.time + pending.length / RULES.tick);
    }
    const g = this.graphics;
    g.clear();
    this.bossGraphics.clear();
    const boss = this.courtRaid ? state.players.find((p) => p.raidBoss) : undefined;
    this.bossGraphics.setDepth(boss ? fighterDepth(boss.y) : 0);
    const raidCues =
      drawRaidArena(g, state, reducedMotion, _time / 1000, this.courtRaid ? { boss: this.bossGraphics } : undefined) ?? [];
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
    drawArenaLive(g, state.arena ?? "classic", arenaClock(), _time, !!this.activeCourt);
    // Epic and Mythical skins recolour their wearer's moves (shapes never change).
    const tints = new Map(
      state.players.map((p) => [p.id, fighterSkillColor(p)] as const),
    );
    const tinted = <T extends { owner: string; color: number }>(o: T): T => {
      const color = tints.get(o.owner);
      return color === undefined ? o : { ...o, color };
    };
    for (const z of state.zones)
      drawZone(
        g,
        tinted(z),
        1 -
          Math.max(0, z.until - state.time) /
            Math.max(0.01, z.ability.duration),
        _time,
        reducedMotion,
      );
    for (const pr of state.projectiles)
      drawProjectile(g, tinted(pr), _time, reducedMotion);
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
    // Extra ambient particles for at most two living Mythicals (you first).
    // Signature ornaments still animate for every equipped fighter.
    const ambient = new Set(
      [...state.players]
        .filter(
          (q) =>
            q.hp > 0 &&
            wornArt(q.character, q.championLooks?.[q.character])?.mythic,
        )
        .sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
        .slice(0, 2)
        .map((q) => q.id),
    );
    for (const serverPlayer of state.players) {
      const p = serverPlayer.id === myId && local ? local : serverPlayer;
      let pos = this.positions.get(p.id);
      if (!pos || state.phase !== "playing") pos = { x: p.x, y: p.y };
      const factor = 1 - Math.exp(-delta / 30);
      const interpolated =
        p.id !== myId && state.phase === "playing"
          ? remoteFrames.sample(p.id, performance.now())
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
      const x = pos.x,
        y = pos.y,
        c = CHARACTERS[p.character];
      if (serverPlayer.raidBoss) continue;
      const jump =
        serverPlayer.jumpUntil > state.time
          ? Math.sin(
              (1 - (serverPlayer.jumpUntil - state.time) / RULES.jumpDuration) *
                Math.PI,
            ) * 45
          : 0;
      const pose = {
        hp: p.hp,
        look: p.raidLook,
        skin: p.championLooks?.[p.character] ?? null,
        ambient: ambient.has(p.id),
        speed: Math.hypot(p.vx, p.vy),
        angle: p.angle,
        dash: serverPlayer.dashUntil > state.time,
        jump: serverPlayer.jumpUntil > state.time,
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
      if (serverPlayer.clone) {
        const clone = this.getRig(`${p.id}:clone`, p.character);
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
      g.fillStyle(0x081f19, 0.45).fillEllipse(
        x,
        y + 15,
        48 - jump * 0.2,
        18 - jump * 0.1,
      );
      // Trait aura at the feet; a stealthed opponent shows none.
      const stealthed = serverPlayer.statuses.some((s) => s.kind === "stealth");
      if (!reducedMotion && !(stealthed && p.id !== myId)) {
        drawBattleAura(
          g,
          c.element,
          x,
          y + 14,
          this.feelClock / 1000,
          stealthed ? 0.5 : 0.9,
        );
        if (serverPlayer.clone)
          drawBattleAura(
            g,
            c.element,
            serverPlayer.clone.x,
            serverPlayer.clone.y + 14,
            this.feelClock / 1000,
            0.3,
          );
      }
      g.lineStyle(
        2,
        p.id === myId
          ? 0xffffff
          : isTeams()
            ? teamOf(p) === myTeam
              ? 0x5ab0ff
              : 0xff5d6c
            : c.color,
        isTeams() ? 0.8 : 0.55,
      ).strokeEllipse(x, y + 12, 72, 32);
      // Mastery flair: an outer ring in the tier's colour (Crystal shimmers).
      if (serverPlayer.flair) {
        const tier = MASTERY_TIERS.find((t) => t.name === serverPlayer.flair);
        if (tier) {
          const colour =
            tier.name === "Crystal" && !reducedMotion
              ? Phaser.Display.Color.HSVToRGB((_time / 2400) % 1, 0.45, 1).color
              : Number.parseInt(tier.color.slice(1), 16);
          g.lineStyle(2, colour, 0.75).strokeEllipse(x, y + 12, 86, 40);
          if (tier.name === "Gold" || tier.name === "Crystal")
            g.lineStyle(6, colour, 0.18).strokeEllipse(x, y + 12, 90, 43);
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
      const rig = this.getRig(p.id, p.character);
      const giant = state.mutators?.includes("giants")
        ? MUTATOR_RULES.giants
        : 1;
      // The rig keeps this as its base scale (squash and stretch multiply it).
      rig.root.setScale(
        view.fighterX * 0.7 * giant,
        view.fighterY * 0.7 * giant,
      );
      if (p.raidLook?.aura === "mountain-aura")
        g.lineStyle(3, 0xffd28c, 0.7).strokeEllipse(x, y + 10, 95, 45);
      else if (p.raidLook?.aura)
        drawCollectionAura(g, p.raidLook.aura, x, y + 10, _time, reducedMotion);
      rig.setVisible(true);
      // On the coliseum court fighters sort with the blocks by where they stand.
      rig.setDepth(this.activeCourt ? fighterDepth(y) : 2);
      const casting =
        rig.controller.state === "basic" ||
        rig.controller.state.startsWith("skill") ||
        pose.charging;
      rig.render(
        {
          ...pose,
          angle: pose.speed > 12 && !casting ? Math.atan2(p.vy, p.vx) : p.angle,
        },
        x,
        y - jump,
        this.feelClock,
        serverPlayer.statuses.some((s) => s.kind === "stealth")
          ? p.id === myId
            ? 0.5
            : 0.12
          : 1,
        reducedMotion,
      );
      if ((this.flashUntil.get(p.id) ?? 0) > feelNow) flashWhite(rig.root);
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
      if (serverPlayer.statuses.some((s) => s.kind === "empower"))
        g.lineStyle(2, 0xffb347, 0.7).strokeEllipse(x, y + 12, 84, 38);
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
              (serverPlayer.charge.at - state.time) /
                Math.max(0.01, windup.cast),
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
      // Duskveil's Curse Mark pays off on any harmful status: show it to them.
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
          shield: 0xc77dff,
          counter: 0x78c7ef,
          empower: 0xffb347,
          haste: 0x8ee6ad,
          stealth: 0xa98be6,
          mark: 0xffffff,
        };
        g.fillStyle(colors[s.kind]).fillCircle(
          x - 18 + i * 10,
          y - 60 - jump,
          4,
        );
      }
      let label = this.labels.get(p.id);
      if (!label) {
        label = document.createElement("div");
        label.className = "player-nameplate";
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
      // Canvas pixels → CSS pixels for the HTML nameplates.
      const css = this.scale.zoom;
      const labelX = ((x - view.x) * view.zoomX + this.scale.width / 2) * css;
      const labelY =
        ((y -
          jump -
          view.y -
          (fighterPack(p.character)?.kind === "layered" ? 56 : 78)) *
          view.zoomY +
          this.scale.height / 2) *
        css;
      label.style.left = labelX + "px";
      label.style.top = Math.max(36, labelY) + "px";
      label.style.opacity = p.hp > 0 ? "1" : "0.4";
      label.classList.toggle(
        "team-ally",
        isTeams() && p.id !== myId && teamOf(p) === myTeam,
      );
      label.classList.toggle("team-enemy", isTeams() && teamOf(p) !== myTeam);
      label.hidden =
        labelX < 0 ||
        labelX > this.scale.width * css ||
        labelY > this.scale.height * css ||
        serverPlayer.statuses.some(
          (s) => s.kind === "stealth" && p.id !== myId,
        );
      g.fillStyle(0x0b1a32).fillRoundedRect(x - 30, y + 29, 60, 6, 3);
      g.fillStyle(c.color).fillRoundedRect(
        x - 30,
        y + 29,
        Math.max(0, (60 * serverPlayer.hp) / c.health),
        6,
        3,
      );
    }
    if (touch.enabled) return;
    g.lineStyle(1, 0xffffff, 0.6).strokeCircle(aim.x, aim.y, 10);
    g.lineBetween(aim.x - 15, aim.y, aim.x - 6, aim.y);
    g.lineBetween(aim.x + 6, aim.y, aim.x + 15, aim.y);
  }
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
function floorBake() {
  return renderScale() > 1.25 ? 2 : 1;
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
      g.fillStyle(0xc9b892).fillRoundedRect(r.x + 6, r.y + 4, r.w - 12, 22, 8);
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
    if (child instanceof Phaser.GameObjects.Container) flashWhite(child);
    else (child as Phaser.GameObjects.Image).setTintFill?.(0xffffff);
  }
}
/**
 * Canvas pixels per CSS pixel. Phones have 2–3x screens; rendering at that density
 * keeps creatures, effects and text sharp. Capped at 2 to protect frame rate.
 */
function renderScale() {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}
/** Size the drawing buffer to the arena box at device resolution. */
function fitRenderer() {
  if (!gameInstance) return;
  const parent = $("game"),
    dpr = renderScale();
  fitDesktopBattleHud($("battle"));
  // Anchor desktop HUD and controls to the displayed court, including letterboxing.
  const frame = parent.parentElement!.getBoundingClientRect();
  const battle = $("battle").getBoundingClientRect();
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
function ensureBattleRenderer() {
  if (gameInstance || $("game").clientWidth < 1 || $("game").clientHeight < 1)
    return;
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
    render: { antialias: true },
    // The camera maps the authoritative 1600x900 world onto the buffer.
    input: { activePointers: 4 },
  });
  // A player can return home while the first texture load is still finishing.
  gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);
  gameInstance.events.on(Phaser.Core.Events.RESUME, syncBattleLoop);
  addEventListener("resize", fitRenderer);
  // The arena box also changes when the HUD or skill bar changes height.
  new ResizeObserver(() => fitRenderer()).observe($("game"));
}
/** A hidden battle canvas must not compete with the menu or Shop preview. */
function syncBattleLoop() {
  if (!gameInstance?.isRunning) return;
  if ($("battle").hidden) gameInstance.loop.sleep();
  else if (!gameInstance.loop.running) gameInstance.loop.wake();
}
accountsUI = new AccountUI({
  selectedCharacter: () => selected,
  openDialog: dialog,
  startRaid: (boss, options) => void startRaid(boss, options),
  startAdventure: (mode) => void startAdventure(mode),
  joinRoom: (code) => void joinByCode(code),
  friendsRoom: () => ({
    code: myId && state?.phase === "lobby" ? state.code : undefined,
    canCreate: !myId && !watching,
  }),
  createFriendRoom: () => homeNavigation.open("play"),
  watchRoom: (code) => {
    if (myId) return toast("Leave your current room first.");
    void watchRoom(code);
  },
  notify: toast,
  beforeSignOut: async () => {
    if (myId) await leave();
  },
  onSession: (token) => {
    const previous = (
      socket.auth as { accessToken?: string | null } | undefined
    )?.accessToken;
    socket.auth = { accessToken: token };
    if (previous !== token) socket.disconnect();
    socket.connect();
  },
  onToken: (token) => {
    // Keep the live connection's login fresh (tokens expire hourly) and use
    // the new token if the socket ever has to reconnect.
    socket.auth = { accessToken: token };
    if (socket.connected) socket.emit("token", { token });
  },
  onChange: () => {
    loadMastery();
    // Re-render only when something the menu shows actually changed.
    const shown = JSON.stringify([
      accountsUI?.account ?? null,
      !!accountsUI?.session,
      accountsUI?.raidLook ?? null,
      accountsUI?.economy?.looks ?? null,
      accountsUI?.economy?.journey ?? null,
    ]);
    if (shown === accountShown) return;
    accountShown = shown;
    if (!state || state.phase === "lobby") {
      screen = "";
      renderMenu();
    } else renderBattle();
  },
});
