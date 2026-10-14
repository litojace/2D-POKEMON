import {
  fighterSelection,
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
import { setOverlayMarkup } from "./overlay";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
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
  RING,
  ringRadius,
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
  type ArenaId,
  RITE_BY_ID,
  RITE_RULES,
  kitOf,
  skillReady,
  advanceMovement,
  normalize,
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
import { FollowCamera, screenToWorld, outsideView } from "./follow-camera";
import { updateNameplate } from "./player-nameplate";
import { fighterPack } from "./animation/pack-config";
import { fullscreenLandscape } from "./orientation";
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
import { lockScrollWhileOpen } from "./scroll-lock";
import { recapMarkup, recordsMarkup, type RecordState } from "./match-recap";
import { matchReportReplySchema } from "../../../packages/shared/src/accounts";
const audio = new AudioManager();
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
  selected: CharacterId = "voltkit",
  seq = 0,
  local: Fighter | undefined,
  pending: Input[] = [],
  scene: ArenaScene | undefined;
let accountShown = "";
/** Last known "ultimate ready" state, for the ready sound. */
let ultWasReady = false;
/** An invite is waiting for sign-in: say so once. */
let inviteHinted = true;
/** Which menu screen is showing ("home", "room-duel"…), for entry fades. */
let menuKind = "";
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
  `<header class="topbar"><a class="brand" href="#"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="element-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#element-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span> ELEMENT<span>ARENA</span></a><div class="top-links"><details class="header-menu" id="header-menu"><summary>☰ <span>Menu</span></summary><div class="header-menu-panel"><button class="quiet" id="help">How to play</button><button class="quiet" id="settings">Settings</button><button class="quiet" id="install-app">Want fullscreen?</button><button class="quiet" id="report-problem">Report a problem</button><span class="connection" id="connection">Connecting</span></div></details><div id="account-nav" class="account-nav"></div></div></header><main><section id="menu"></section><section id="battle" hidden>${stadiumCrowd()}<div id="practice-controls" class="practice-controls" hidden></div><div id="hud" class="hud"></div><div class="arena-stage"><div class="arena-frame"><div id="game"></div><div id="arena-overlay"></div><div id="spectate" class="spectate-banner" role="status" hidden></div><span class="map-label">ELEMENTAL COLISEUM <span>01 / CHAMPIONS COURT</span></span></div></div><div id="mobile-controls"></div><div id="abilities" class="ability-bar"></div><div class="battle-footer"><span id="control-hints"></span><span id="network">AUTHORITATIVE ONLINE MATCH</span><button class="quiet" id="battle-menu">Esc / Menu</button></div></section></main><footer><span>ELEMENT ARENA <b>•</b> REAL-TIME CREATURE DUELS</span><button class="quiet" id="credits">Credits</button><span>Eight creatures. One arena. Your move.</span></footer><div id="toast" role="status"></div><dialog id="dialog"></dialog>`;
// Touch battles lock zoom (pinch and double tap); menus keep it for accessibility.
watchBattleZoom();
// The page behind settings, help and other dialogs stays put.
lockScrollWhileOpen($<HTMLDialogElement>("dialog"));
const headerMenu = $("header-menu") as HTMLDetailsElement;
headerMenu.addEventListener("click", (event) => {
  if ((event.target as Element).closest("button")) headerMenu.open = false;
});
document.addEventListener("pointerdown", (event) => {
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
    const id = pick >= 0 ? me?.riteOffer?.[pick] : undefined;
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
  const action = actionFor(controlPrefs().bindings, e.code);
  if (!action) return;
  const live = matchKeys();
  if (live) e.preventDefault(); // Space, arrows and friends must not scroll or click.
  if (e.repeat) return;
  usingPad = false;
  // Held keys are tracked in every phase, so movement held through the countdown works at "Fight".
  held.add(e.code);
  if (live) pressAction(action);
  else if (state?.phase === "intermission" && !$<HTMLDialogElement>("dialog").open)
    pressAction(action);
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
function riteMarkup(me: Fighter, seconds: number) {
  const timer = `Next round in ${seconds} second${seconds === 1 ? "" : "s"}`;
  const chips = (p: Fighter) =>
    (p.rites ?? [])
      .map((id) => RITE_BY_ID[id])
      .filter(Boolean)
      .map(
        (r) =>
          `<span class="rite-chip ${r.tier}" title="${escape(r.text)}">${escape(r.name)}</span>`,
      )
      .join("");
  const offer = me.riteOffer;
  if (offer?.length) {
    const comeback = offer.length > RITE_RULES.choices;
    const cards = offer
      .map((id) => RITE_BY_ID[id])
      .map(
        (r, i) =>
          `<button class="rite-card ${r.tier}" data-rite="${r.id}"><kbd>${touch.enabled ? i + 1 : escape(keyText(SKILL_ACTIONS[i]))}</kbd><span class="rite-tier">${r.tier === "major" ? "MAJOR RITE" : "RITE"}</span><b>${escape(r.name)}</b><small>${escape(r.text)}</small></button>`,
      )
      .join("");
    return `<p class="rite-intro">Choose an upgrade for the rest of the match${comeback ? " · comeback: one extra choice" : ""}.</p><div class="rite-choices">${cards}</div><p class="rite-timer">${timer} · a choice is made for you when time runs out</p>${me.rites?.length ? `<div class="rite-owned">${chips(me)}</div>` : ""}`;
  }
  const rivals = state!.players.filter(
    (p) => p.id !== myId && p.rites?.length,
  );
  return `${me.rites?.length ? `<div class="rite-owned"><em>Your rites</em>${chips(me)}</div>` : ""}${rivals
    .map(
      (p) =>
        `<div class="rite-owned rival"><em>${escape(p.name)}</em>${chips(p)}</div>`,
    )
    .join("")}<p class="rite-timer">${state!.players.some((p) => p.riteOffer) ? "Waiting for the others to choose · " : ""}${timer}</p>`;
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
// Remember a room from an invite link (?room=ABC123) before the first render.
if (captureInvite()) inviteHinted = false;
function wireRoster(isRoom: boolean) {
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(
    (button) =>
      (button.onclick = async () => {
        audio.unlock();
        const choice = button.dataset.character as CharacterId;
        if (choice === selected) return;
        selected = choice;
        const revision = isRoom ? lobbySelection.choose(choice) : undefined;
        renderMenu();
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
          renderMenu();
        }
      }),
  );
}
/** Move the selection highlight and swap the detail panel without re-rendering. */
function showSelection() {
  const panel = document.querySelector<HTMLElement>("#menu .roster-panel");
  if (!panel) return false;
  if (!updateRosterSelection(panel, selected, reducedMotion)) return false;
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
    );
  }
  return true;
}
/** Blue = 0, Red = 1. Older snapshots without teams fall back to seat order. */
const teamOf = (p: Fighter) =>
  p.team ?? ((state?.players.indexOf(p) ?? 0) % 2 === 0 ? 0 : 1);
const TEAM_LABELS = ["Blue", "Red"] as const;
const isTeams = () => state?.mode === "teams";
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
type RoomMode = "duel" | "teams";
let roomMode: RoomMode = (() => {
  try {
    return localStorage.getItem("arena-room-mode") === "teams"
      ? "teams"
      : "duel";
  } catch {
    return "duel";
  }
})();
const COPY_ICON =
  '<svg class="copy-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
/** Lobby panel: a duel list, or Blue/Red columns for 2v2. */
function roomPanel(me: Fighter) {
  const row = (p: Fighter) => {
    const fighter = CHARACTERS[p.id === myId ? selected : p.character];
    return `<div${p.id === myId ? " data-me" : ""}><span class="player-avatar" style="--element:#${fighter.color.toString(16).padStart(6, "0")}" title="${fighter.name}">${fighterAvatar(fighter.id, `lobby${state!.players.indexOf(p)}`)}</span><span><strong>${escape(p.name)} ${p.id === myId ? "<small>(you)</small>" : ""}</strong><small class="player-fighter">${fighter.name}</small></span><b class="status-pill ${!p.connected ? "offline" : p.ready ? "ready" : "choosing"}">${!p.connected ? "Offline" : p.ready ? "Ready" : "Choosing"}</b></div>`;
  };
  const ready = `<button class="primary" id="ready">${me.ready ? "Cancel ready" : "Ready to battle →"}</button><button class="quiet full" id="leave">Leave room</button>`;
  const code = `<button id="copy" class="room-code">${state!.code}<span>${COPY_ICON}COPY CODE</span></button><button id="invite" class="secondary full invite-link">Share invite link</button>`;
  if (!isTeams())
    return `<div class="eyebrow">PRIVATE LOBBY</div><h2>Your duel starts here.</h2><p>Share this code with your friend.</p>${code}<div class="players">${state!.players.map(row).join("")}${state!.players.length < 2 ? '<div class="waiting"><span>＋</span> Waiting for your opponent…</div>' : ""}</div>${ready}<small class="room-note">The match begins when both players are ready.</small>`;
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
  return `<div class="eyebrow">PRIVATE 2V2 LOBBY</div><h2>Two on two.</h2><p>Share this code with three friends, then pick a side.</p>${code}<div class="team-columns">${columns}</div>${host ? '<button class="quiet full" id="shuffle">Shuffle teams ⇄</button>' : ""}${ready}<small class="room-note">First team to 3 round wins. Starts when all four players are ready.</small>`;
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
function wireRoom() {
  $("ready").onclick = () => {
    audio.unlock();
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
  $("copy").onclick = () =>
    void navigator.clipboard
      .writeText(state!.code)
      .then(() => toast("Room code copied."))
      .catch(() => toast(`Share this code: ${state!.code}`));
  $("invite").onclick = () =>
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
function renderMenu() {
  pwa.sync();
  const p = state?.players.find((p) => p.id === myId);
  const isRoom = !!p;
  const key = `${isRoom ? `room-${state!.mode ?? "duel"}` : "home"}:${state?.players.map((p) => `${p.id}${p.id === myId ? "" : p.character}${p.ready}${p.connected}${p.team ?? ""}`).join(":")}:${selected}`;
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
    showSelection()
  )
    return;
  // Keep the reader's place when the menu re-renders while already visible.
  const keepScroll = !$("menu").hidden ? scrollY : null;
  // Lobby status updates must not restart the roster's artwork or idle animations.
  const retainedRoster =
    previous &&
    !$("menu").hidden &&
    isRoom &&
    previous.startsWith(`room-${state!.mode ?? "duel"}:`)
      ? $("menu").querySelector(".roster-panel")
      : null;
  if (retainedRoster) {
    if (previous.slice(previous.lastIndexOf(":") + 1) !== selected)
      showSelection();
    $("menu").querySelector(".room-panel")!.innerHTML = roomPanel(p!);
    wireRoom();
    if (keepScroll !== null && Math.abs(scrollY - keepScroll) > 1)
      scrollTo(0, keepScroll);
    return;
  }
  touch.reset();
  document.body.classList.remove("battle-active");
  // Fade up only when arriving at a different screen (home, a room, back
  // from a match). Rebuilding the screen you are already on stays still.
  const kind = key.slice(0, key.indexOf(":"));
  const arriving = $("menu").hidden || kind !== menuKind;
  menuKind = kind;
  $("battle").hidden = true;
  $("menu").hidden = false;
  $("menu").classList.remove("screen-enter");
  if (arriving) {
    void $("menu").offsetWidth;
    $("menu").classList.add("screen-enter");
  }
  $("menu").innerHTML =
    `<header class="desktop-lobby-header"><div class="eyebrow">ELEMENTAL COLISEUM</div><h1>Choose your fighter</h1><p>Pick your creature. Enter the arena.</p></header><div class="lobby-layout"><div class="roster-panel">${fighterSelection(selected)}</div><aside class="room-panel">${
      isRoom
        ? roomPanel(p!)
        : `<div class="eyebrow">PLAY ONLINE</div><h2>A friend. A code.<br>A worthy opponent.</h2><label for="name">YOUR DISPLAY NAME</label><input id="name" maxlength="20" placeholder="Enter your name" value="${escape(accountsUI?.account?.displayName ?? localStorage.getItem("arena-name") ?? "")}" autocomplete="nickname"><div class="mode-picker" role="radiogroup" aria-label="Room type">${(
            [
              ["duel", "1v1 Duel", "Best of five"],
              ["teams", "2v2 Teams", "Best of five"],
            ] as const
          )
            .map(
              ([id, label, hint]) =>
                `<button type="button" role="radio" class="bot-level mode-level${roomMode === id ? " active" : ""}" data-mode="${id}" aria-checked="${roomMode === id}"><b>${label}</b><small>${hint}</small></button>`,
            )
            .join(
              "",
            )}</div><button class="primary" id="create">Create private room →</button><div class="divider">OR JOIN A FRIEND</div><label for="code">ROOM CODE</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Room code"><button id="join" class="secondary">Join →</button></div><div class="divider">OR PLAY SOLO</div><div class="bot-picker" role="radiogroup" aria-label="Bot difficulty">${BOT_LEVELS.map(([id, label, hint]) => `<button type="button" role="radio" class="bot-level${botLevel === id ? " active" : ""}" data-bot="${id}" aria-checked="${botLevel === id}"><b>${label}</b><small>${hint}</small></button>`).join("")}</div><button class="secondary full" id="bot-match">Battle an AI bot →</button>${accountsUI?.account ? '<button class="quiet full" id="practice">Solo test mode →</button>' : ""}<small class="room-note">Free to play · Login required<br>Keyboard + mouse or mobile touch controls</small>`
    }</aside></div>`;
  wireRoster(isRoom);
  // Fighter panel slot: between the rows on PC, under the swipeable row on phones.
  watchFighterDetail($("menu"));
  if (keepScroll !== null && Math.abs(scrollY - keepScroll) > 1)
    scrollTo(0, keepScroll);
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
      const button = $(event);
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
    $("create").onclick = () => void play("create");
    $("join").onclick = () => void play("join");
    // Opened from an invite link: join as soon as we're signed in and online.
    const invite = pendingInvite();
    if (invite) {
      $<HTMLInputElement>("code").value = invite;
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
          document
            .querySelectorAll<HTMLButtonElement>("[data-mode]")
            .forEach((b) => {
              const on = b === button;
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
async function leave() {
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
  if (!document.body.classList.contains("battle-active")) {
    document.body.classList.add("battle-active");
    // The battle screen fits the window; drop any scroll left over from the menu.
    scrollTo(0, 0);
    requestAnimationFrame(() => {
      touch.resize();
      fitRenderer();
    });
  }
  const me = state?.players.find((p) => p.id === myId);
  if (!state || !me) return;
  queueMicrotask(refreshControlLabels);
  const hudOrder = isTeams()
    ? [
        ...state.players.filter((p) => teamOf(p) === teamOf(me)),
        ...state.players.filter((p) => teamOf(p) !== teamOf(me)),
      ]
    : state.players;
  const key = `battle:${me.character}:${!!state.practice}:${state.mode ?? "duel"}:${hudOrder.map((p) => p.id + p.character).join(",")}`;
  if (screen !== key) {
    screen = key;
    $("menu").hidden = true;
    $("battle").hidden = false;
    ensureBattleRenderer();
    fitRenderer();
    $("practice-controls").hidden = !state.practice;
    if (state.practice) {
      $("practice-controls").innerHTML =
        `<details id="practice-settings" class="practice-settings"><summary>Practice</summary><div class="practice-panel"><div class="practice-heading"><span class="eyebrow">SOLO TEST MODE</span><span id="practice-stats"></span></div><div class="practice-actions"><label>Creature <select id="practice-character">${Object.values(
          CHARACTERS,
        )
          .map(
            (c) =>
              `<option value="${c.id}" ${me.character === c.id ? "selected" : ""}>${c.name}</option>`,
          )
          .join(
            "",
          )}</select></label><label><input id="practice-unlimited" type="checkbox"> No skill cooldowns</label><label><input id="practice-attacks" type="checkbox"> Target attacks</label><button class="secondary" id="practice-reset">Reset arena</button><button class="quiet" id="practice-exit">Exit test mode</button></div><p>Target respawns automatically. Enable attacks to test counters, clones and jumping over ground fire. Hover a skill for its description.</p></div></details>`;
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
    const split = isTeams() ? 2 : 1;
    $("hud").classList.toggle("hud-teams", isTeams());
    $("hud").innerHTML = hudOrder
      .map(
        (p, i) =>
          `${i === split ? '<div class="timer-wrap"><span id="round-label"></span><strong id="timer">03:00</strong><span id="phase-label"></span></div>' : ""}<div class="health-card ${i >= split ? "right" : ""}${isTeams() ? ` team-${teamOf(p)}${p.id === myId ? " me" : ""}` : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16)}"><div><b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}</span><strong id="score-${i}"></strong></div><div class="health-track"><span id="health-${i}"></span></div><small id="health-text-${i}"></small><small id="status-${i}"></small></div>`,
      )
      .join("");
    const c = CHARACTERS[me.character];
    $("abilities").innerHTML =
      `<div class="basic-hint" title="${c.basic.name}: ${c.basic.description} No cooldown · ${Math.round((c.basic.interval ?? 0.3) * 1000)} ms between attacks."><kbd data-action="basic">${keyText("basic")}</kbd><span>${abilityIcon(c.basic.name)}<small>${c.basic.name.toUpperCase()}</small></span></div>${c.skills.map((a, i) => `<div class="ability" id="ability-${i}" style="--element:#${c.color.toString(16)}"><kbd data-action="${SKILL_ACTIONS[i]}">${keyText(SKILL_ACTIONS[i])}</kbd><span>${abilityIcon(a.name)}<small id="cooldown-${i}">READY</small></span><i class="cooldown-fill" id="fill-${i}"></i></div>`).join("")}<div class="movement-ability"><kbd data-action="dash">${keyText("dash")}</kbd><span>Dash<small id="dash-cd"></small></span></div><div class="movement-ability"><kbd data-action="jump">${keyText("jump")}</kbd><span>Jump<small id="jump-cd"></small></span></div>`;
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
        ? `${state!.teamScores?.[teamOf(p)] ?? 0} / 3`
        : `${state!.scores[p.id]} / ${RULES.roundsToWin}`;
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
    : `ROUND ${state.round} · BEST OF ${RULES.roundsToWin * 2 - 1}`;
  $("network").textContent = state.practice
    ? "SOLO PRACTICE · SERVER-VALIDATED COMBAT"
    : "AUTHORITATIVE ONLINE MATCH";
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
      if (full && !ultWasReady && state!.phase === "playing") audio.play("orb");
      ultWasReady = full;
      const charge = Math.floor(me.ult ?? 0),
        ready = skillReady(
          me,
          i,
          state!.time,
          !!state!.practice?.unlimitedCooldowns,
        );
      $(`cooldown-${i}`).textContent = ready ? "READY" : `${charge}%`;
      $(`fill-${i}`).style.height = `${ready ? 0 : 100 - charge}%`;
      $(`ability-${i}`).classList.toggle("cooling", !ready);
      $(`ability-${i}`).classList.toggle("ult-ready", ready);
      return;
    }
    const left = Math.max(0, me.cooldowns[i] - state!.time);
    $(`cooldown-${i}`).textContent = left > 0 ? `${left.toFixed(1)}s` : "READY";
    $(`fill-${i}`).style.height = `${(100 * left) / a.cooldown}%`;
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
    state.phase === "playing" && connected,
    CHARACTERS[me.character].skills.map((a) => a.name),
    me.cooldowns.map((t) => Math.max(0, t - state!.time)),
    Math.max(0, me.dashAt - state.time),
    Math.max(0, me.jumpAt - state.time),
    kitOf(me.character, me.rites).skills.map((a) => a.cooldown),
    {
      name: CHARACTERS[me.character].basic.name,
      left: Math.max(0, me.basicAt - state.time),
      duration: CHARACTERS[me.character].basic.interval ?? 0.3,
    },
    state.practice?.unlimitedCooldowns ? RULES.ultMax : (me.ult ?? 0),
  );
  const overlay = $("arena-overlay");
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
    banner.hidden = !partner;
    if (partner) banner.textContent = `Knocked out · watching ${partner.name}`;
    overlay.style.pointerEvents = "none";
  } else {
    $("spectate").hidden = true;
    overlay.style.pointerEvents = "auto";
    let heading = "",
      details = "";
    if (state.phase === "briefing") {
      heading = "How to play";
      const confirmed = state.instructionsReady.includes(myId);
      // Who's fighting whom, each wearing their trait aura (you first).
      const card = (p: Fighter) =>
        `<div class="vs-fighter${p.id === myId ? " me" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16).padStart(6, "0")}">${scopeIds(withAura(fighterArt(p.character), p.character, reducedMotion), `vs${state!.players.indexOf(p)}`)}<b>${escape(p.name)}${p.id === myId ? " <small>(you)</small>" : ""}</b><span>${CHARACTERS[p.character].name} · ${CHARACTERS[p.character].element}</span></div>`;
      const mine = (p: Fighter) => teamOf(p) === teamOf(me);
      const side = (list: Fighter[]) =>
        list.sort((a, b) => Number(b.id === myId) - Number(a.id === myId));
      const versus = isTeams()
        ? `<div class="briefing-versus teams"><div class="vs-team team-${teamOf(me)}">${side(state.players.filter(mine)).map(card).join("")}</div><span class="vs-mark">VS</span><div class="vs-team team-${1 - teamOf(me)}">${state.players
            .filter((p) => !mine(p))
            .map(card)
            .join("")}</div></div>`
        : `<div class="briefing-versus">${side([...state.players])
            .map(card)
            .join('<span class="vs-mark">VS</span>')}</div>`;
      const arena = ARENAS[state.arena ?? "classic"];
      details =
        versus +
        `<p class="arena-brief"><b>Arena · ${escape(arena.name)}</b>${escape(arena.tip)}</p>` +
        '<p class="mobile-howto">Touch mode: left joystick to move; big button for basic attacks, the four curved buttons for skills, DASH and JUMP below. Aim follows your nearest opponent. Use Enter fullscreen below the arena.</p>' +
        controlsList() +
        "<p>" +
        (isTeams()
          ? "Stick with your partner and focus the same target. Your attacks pass through your teammate. First team to win three rounds takes the match."
          : "Use cover. First to win three rounds takes the match.") +
        ' The countdown begins when everyone confirms.</p><button class="primary" id="instructions-ready" ' +
        (confirmed ? "disabled" : "") +
        ">" +
        (confirmed ? "Waiting for the others…" : "I’m ready →") +
        "</button>";
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
      details = riteMarkup(me, Math.ceil(state.remaining));
    }
    if (state.phase === "paused") {
      heading = isTeams() ? "A player disconnected" : "Opponent disconnected";
      details = `Match suspended · reconnect grace ${Math.ceil(state.pauseRemaining)}s`;
    }
    if (state.phase === "finished") {
      const won = isTeams()
        ? state.winnerTeam === teamOf(me)
        : state.winner === myId;
      heading = won ? "Victory. Well played." : "A worthy fight.";
      // Scoreline: your side on the left, always.
      const score = (left: string, a: number, b: number, right: string) =>
        `<div class="result-score"><span>${left}</span><b>${a}</b><i>–</i><b>${b}</b><span>${right}</span></div>`;
      const rival = state.players.find((p) => p.id !== myId);
      details = isTeams()
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
          state.matchId ? matchRecords.get(state.matchId) : undefined,
        );
      details += `<button class="primary" id="rematch">${me.ready ? "Waiting for opponent…" : "Rematch →"}</button><button class="secondary" id="return">${state.vsBot ? "Back to menu" : "Return to lobby"}</button>`;
    }
    const markup = `<div class="overlay-card${state.phase === "countdown" ? " countdown-card" : ""}"><span class="eyebrow">ELEMENT ARENA</span><h2>${heading}</h2><div>${details}</div></div>`;
    // Preserve the pressed button between snapshots so pointer-up can complete its click.
    setOverlayMarkup(overlay, markup);
    if (state.phase === "briefing")
      $("instructions-ready").onclick = () => {
        // Phones: go fullscreen and turn sideways where the browser allows it.
        if (touch.enabled) void fullscreenLandscape();
        void request("instructions-ready");
      };
    if (state.phase === "finished") {
      $("rematch").onclick = () => void request("rematch");
      // A bot room has no lobby to return to: go back to the menu.
      $("return").onclick = () =>
        void (state?.vsBot ? leave() : request("lobby"));
    }
  }
}
socket.on("connect", () => {
  connected = true;
  // Invite link opened before the connection was up: try joining now.
  if (pendingInvite() && !myId && !sessionStorage.getItem("arena-token")) {
    screen = "";
    renderMenu();
  }
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
  if (snapshot.phase === "finished" && state?.phase !== "finished")
    audio.play(
      (
        snapshot.mode === "teams"
          ? snapshot.winnerTeam ===
            snapshot.players.find((p) => p.id === myId)?.team
          : snapshot.winner === myId
      )
        ? "victory"
        : "defeat",
    );
  if (state?.phase !== snapshot.phase || state?.round !== snapshot.round)
    remoteFrames.clear();
  const previous = state;
  state = unpackSnapshot(snapshot);
  scene?.observeSnapshot(state, previous);
  pwa.sync();
  remoteFrames.add(state, performance.now());
  const me = state.players.find((p) => p.id === myId);
  if (!me) return;
  selected = lobbySelection.reconcile(me.character, state.phase === "lobby");
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
  if (state.phase === "finished" && state.matchId && !state.practice)
    void reportMatch(state.matchId);
  if (state.phase === "lobby") renderMenu();
  else renderBattle();
});
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
    for (const name of reply.achievements)
      if (!seen.includes(name))
        toast(`Achievement unlocked: ${name}. Its title is yours to wear.`);
    if (!reply.confirmed && attempt < 3)
      setTimeout(() => {
        if (state?.matchId === matchId) void reportMatch(matchId, attempt + 1);
      }, 3000 + attempt * 3000);
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
  $("dialog").innerHTML =
    `<button id="close-dialog" class="close">×</button>${html}`;
  // Switching screens inside an open dialog (Settings → Controls) keeps it open.
  if (!$<HTMLDialogElement>("dialog").open)
    $<HTMLDialogElement>("dialog").showModal();
  $("close-dialog").onclick = () => {
    $<HTMLDialogElement>("dialog").close();
    settingsOpen = false;
    menuOpen = false;
  };
}
function showSettings() {
  settingsOpen = true;
  dialog(
    `<div class="eyebrow">YOUR PREFERENCES</div><h2>Find your rhythm.</h2><p>Online matches keep running while this menu is open.</p><label>MUSIC <input type="range" id="music" min="0" max="1" step=".01" value="${audio.music}"></label><label>SOUND EFFECTS <input type="range" id="effects" min="0" max="1" step=".01" value="${audio.effects}"></label><p>Reduced motion follows your system preference.</p><button id="open-controls" class="secondary full">Controls &amp; key bindings →</button>${touch.settingsHTML()}<button id="settings-report" class="quiet">Report a problem</button>${myId ? '<button id="exit-room" class="secondary">Leave room</button>' : ""}`,
  );
  for (const kind of ["music", "effects"] as const)
    $(kind).oninput = () => {
      audio.unlock();
      audio.set(kind, Number($<HTMLInputElement>(kind).value));
    };
  touch.bindSettings();
  $("open-controls").onclick = showControls;
  $("settings-report").onclick = () => accountsUI.showReport(reportContext());
  if (myId) $("exit-room").onclick = () => void leave();
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
$("help").onclick = () =>
  dialog(
    `<div class="eyebrow">HOW TO PLAY</div><h2>Every second counts.</h2><p>Create a room, share the code, choose your creatures, and both click Ready. Win three rounds to take the match.</p>${controlsList(true)}<p>Use cover to block shots. Jump over ground zones. Skills recharge in 8–20 seconds; basic attacks never go on cooldown. In a round's last minute a ring closes in on the centre: stay inside it. Healing orbs (green) restore health; energy orbs (gold) charge your ultimate. At a tie, overtime drains both players' health.</p>`,
  );
$("credits").onclick = () =>
  dialog(
    '<div class="eyebrow">BUILT FOR THE DUEL</div><h2>Element Arena</h2><p>Eight original creatures, each an articulated shaded-vector rig with front, back and side views, plus a stone coliseum and synthesized audio.</p><p>Built with Phaser, Socket.IO, Express, TypeScript, Vite, and Supabase. Rendered sprite sheets or atlases can replace any creature through the fighter asset pipeline.</p>',
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
  floorArena: ArenaId = "classic";
  floorScale = new Map<string, number>();
  /** Bake an arena's floor once (2x on dense screens); returns its texture key. */
  floorTexture(id: ArenaId) {
    const key = `arena-floor-${id}`;
    const bake = floorBake();
    if (!this.textures.exists(key)) {
      this.floorScale.set(key, bake);
      const g = this.make.graphics({}, false);
      paintArenaFloor(scaledPainter(g, bake), ARENAS[id]);
      g.generateTexture(key, RULES.width * bake, RULES.height * bake);
      g.destroy();
    }
    return key;
  }
  showArena(id: ArenaId) {
    if (id === this.floorArena || !this.floor) return;
    this.floorArena = id;
    const key = this.floorTexture(id);
    this.floor.setTexture(key).setScale(1 / (this.floorScale.get(key) ?? 1));
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
    // Keys and mouse buttons are read through the player's bindings (see pressAction).
    this.input.mouse!.disableContextMenu();
    this.scale.refresh();
  }
  effect(event: Snapshot["events"][number]) {
    if (
      (event.owner === myId && event.kind !== "impact") ||
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
        (ability && abilityColor.get(ability.id)) ?? event.color,
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
      const heal = event.kind === "heal",
        energy = heal && event.abilityId === "energy-orb";
      const label = this.add
        .text(
          event.x,
          event.y - 45,
          energy ? `+${event.value}% ULT` : `${heal ? "+" : "−"}${event.value}`,
          {
          fontFamily: "monospace",
          fontSize: "25px",
          color: energy ? "#ffd166" : heal ? "#7dffb0" : "#fff",
          stroke: "#152820",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setResolution(renderScale());
      this.tweens.add({
        targets: label,
        y: event.y - 95,
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
      .text(event.x, event.y - 75, `${event.combo!.toUpperCase()} COMBO!`, {
        fontFamily: "system-ui, sans-serif",
        fontStyle: "900",
        fontSize: "24px",
        color: "#ffe27a",
        stroke: "#3a1f00",
        strokeThickness: 5,
      })
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
      me && isTeams() && me.hp <= 0
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
      follow && presented
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
        CHARACTERS[opponent.character].name;
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
    useObstacles(obstaclesAt(state.arena, arenaClock()));
    this.showArena(state.arena ?? "classic");
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
      const skill = active ? this.actions.skill : -1;
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
          ((touch.enabled
            ? touch.basic
            : heldAction("basic") || !!pad?.held.has("basic")) ||
            this.actions.basic),
        skill,
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
    this.rigs.forEach((rig) => rig.setVisible(false));
    drawArenaLive(g, state.arena ?? "classic", arenaClock(), _time);
    for (const z of state.zones)
      drawZone(
        g,
        z,
        1 -
          Math.max(0, z.until - state.time) /
            Math.max(0.01, z.ability.duration),
        _time,
        reducedMotion,
      );
    for (const pr of state.projectiles)
      drawProjectile(g, pr, _time, reducedMotion);
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
    // The closing ring: shade everything outside the safe circle.
    const ring =
      state.phase === "playing" && !state.practice
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
            { x: RING.x + Math.cos(a0) * ring, y: RING.y + Math.sin(a0) * ring },
            { x: RING.x + Math.cos(a1) * ring, y: RING.y + Math.sin(a1) * ring },
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
      const jump =
        serverPlayer.jumpUntil > state.time
          ? Math.sin(
              (1 - (serverPlayer.jumpUntil - state.time) / RULES.jumpDuration) *
                Math.PI,
            ) * 45
          : 0;
      const pose = {
        hp: p.hp,
        speed: Math.hypot(p.vx, p.vy),
        angle: p.angle,
        dash: serverPlayer.dashUntil > state.time,
        jump: serverPlayer.jumpUntil > state.time,
        charging: !!serverPlayer.charge,
        victory: isTeams()
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
        clone.root.setScale(view.fighterX, view.fighterY);
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
          },
          serverPlayer.clone.x,
          serverPlayer.clone.y,
          this.feelClock,
          0.3,
          reducedMotion,
        );
        clone.root.setScale(view.fighterX * 0.7, view.fighterY * 0.7);
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
      if (p.dashUntil > state.time && !reducedMotion) {
        g.fillStyle(c.color, 0.18).fillEllipse(
          x - p.vx * 0.035,
          y - p.vy * 0.035,
          48,
          38,
        );
      }
      const rig = this.getRig(p.id, p.character);
      rig.root.setScale(view.fighterX, view.fighterY);
      rig.setVisible(true);
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
      rig.root.setScale(view.fighterX * 0.7, view.fighterY * 0.7);
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
function floorBake() {
  return renderScale() > 1.25 ? 2 : 1;
}
/** Seconds into the live round on the server's clock (-1 when not live). */
function arenaClock() {
  return state?.phase === "playing" ? state.time - (state.hazardClock ?? 0) : -1;
}
/** The moving parts of an arena: the shifting block and hazard telegraphs. */
function drawArenaLive(
  g: Phaser.GameObjects.Graphics,
  id: ArenaId,
  t: number,
  time: number,
) {
  const arena = ARENAS[id];
  const wobble = reducedMotion ? 0 : Math.sin(time / 40) * 2;
  if (arena.shifting) {
    const r = arena.shifting.rect;
    if (shiftingUp(arena, t)) {
      g.fillStyle(0x10170f, 0.35).fillEllipse(r.x + r.w / 2 + 10, r.y + r.h + 6, r.w + 40, 34);
      g.fillStyle(0x7f6f55).fillRoundedRect(r.x, r.y, r.w, r.h, 12);
      g.fillStyle(0x968566).fillRoundedRect(r.x + 5, r.y + 5, r.w - 10, r.h - 22, 9);
      g.fillStyle(0xc9b892).fillRoundedRect(r.x + 6, r.y + 4, r.w - 12, 22, 8);
      g.lineStyle(2, 0x5e523d, 0.8)
        .lineBetween(r.x + 20, r.y + 40, r.x + 34, r.y + 66)
        .lineBetween(r.x + 34, r.y + 66, r.x + 26, r.y + 86);
    } else {
      const rising = shiftingRisesIn(arena, t);
      if (t >= 0 && rising <= arena.shifting.warn) {
        // About to rise: rumbling outline and dust.
        const a = 0.5 + 0.4 * Math.sin(time / 60);
        g.lineStyle(4, 0xffd65b, a).strokeRoundedRect(r.x + wobble, r.y, r.w, r.h, 12);
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
    g.lineStyle(3, color, 0.5 + 0.5 * k).strokeCircle(h.x, h.y, h.radius * (0.4 + 0.6 * k));
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
  const width = Math.max(1, Math.round(parent.clientWidth * dpr)),
    height = Math.max(1, Math.round(parent.clientHeight * dpr));
  const scale = gameInstance.scale;
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
  addEventListener("resize", fitRenderer);
  // The arena box also changes when the HUD or skill bar changes height.
  new ResizeObserver(() => fitRenderer()).observe($("game"));
}
accountsUI = new AccountUI({
  openDialog: dialog,
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
    // Re-render only when something the menu shows actually changed.
    const shown = JSON.stringify([
      accountsUI?.account ?? null,
      !!accountsUI?.session,
    ]);
    if (shown === accountShown) return;
    accountShown = shown;
    screen = "";
    if (!state || state.phase === "lobby") renderMenu();
  },
});
