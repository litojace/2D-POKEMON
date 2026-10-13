import { drawElementGlyph } from "./element-effects";
import { fighterSelection } from "./fighter-selection";
import { setupBattleDock } from "./battle-dock";
import {
  queueFighterAssets,
  createFighterVisual,
  type FighterVisual,
} from "./animation/pipeline";
import { rigAssets } from "./animation/assets";
import { setOverlayMarkup } from "./overlay";
import { stadiumCrowd } from "./stadium";
import { paintArenaFloor } from "./arena-floor";
import { setupPWA } from "./pwa";
import { abilityIcon } from "./ability-icons";
import { TouchControls } from "./touch-controls";
import Phaser from "phaser";
import { io } from "socket.io-client";
import {
  CHARACTERS,
  RULES,
  KEYS,
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
import { celebrateSelection } from "./selection-celebration";
import { fighterPack } from "./animation/pack-config";
const audio = new AudioManager();
const allAbilities = new Map(
  Object.values(CHARACTERS)
    .flatMap((c) => [c.basic, ...c.skills])
    .map((a) => [a.id, a]),
);
const remoteFrames = new InterpolationBuffer();
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
  `<header class="topbar"><a class="brand" href="#"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><defs><linearGradient id="element-crest" x2="0" y2="1"><stop stop-color="#fff1a3"/><stop offset="1" stop-color="#d9a340"/></linearGradient></defs><path fill="url(#element-crest)" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span> ELEMENT<span>ARENA</span></a><div class="top-links"><details class="header-menu" id="header-menu"><summary>☰ <span>Menu</span></summary><div class="header-menu-panel"><button class="quiet" id="help">How to play</button><button class="quiet" id="settings">Settings</button><button class="quiet" id="mobile-play">Mobile fullscreen</button><button class="quiet" id="install-app">Install app</button><span class="connection" id="connection">Connecting</span></div></details><div id="account-nav" class="account-nav"></div></div></header><main><section id="menu"></section><section id="battle" hidden>${stadiumCrowd()}<div id="practice-controls" class="practice-controls" hidden></div><div id="hud" class="hud"></div><div class="arena-frame"><div id="game"></div><div id="arena-overlay"></div><span class="map-label">ELEMENTAL COLISEUM <span>01 / CHAMPIONS COURT</span></span></div><div id="mobile-controls"></div><div id="abilities" class="ability-bar"></div><div class="battle-footer"><span>WASD <b>Move</b> · Mouse <b>Aim</b> · LMB <b>Basic</b> · 1 / 2 / 3 / R <b>Skills</b> &middot; RMB <b>Dash</b> &middot; SPACE <b>Jump</b></span><span id="network">AUTHORITATIVE ONLINE MATCH</span><button class="quiet" id="battle-menu">Esc / Menu</button></div></section></main><footer><span>ELEMENT ARENA <b>•</b> REAL-TIME CREATURE DUELS</span><button class="quiet" id="credits">Credits</button><span>Eight creatures. One arena. Your move.</span></footer><div id="toast" role="status"></div><dialog id="dialog"></dialog>`;
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
$("mobile-play").hidden = !touch.available;
$("mobile-play").onclick = () => {
  if (!touch.enabled) $("touch-toggle").click();
  $("mobile-fullscreen").click();
};
function stopControls() {
  touch.reset();
  if (scene) {
    scene.actions = { skill: -1, dash: false, jump: false, basic: false };
    scene.input.keyboard?.resetKeys();
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
let elementFilter = "All";
function renderMenu() {
  pwa.sync();
  const p = state?.players.find((p) => p.id === myId);
  const isRoom = !!p;
  const key = `${isRoom ? "room" : "home"}:${state?.players.map((p) => `${p.id}${p.character}${p.ready}${p.connected}`).join(":")}:${selected}:${elementFilter}`;
  if (screen === key) return;
  screen = key;
  touch.reset();
  document.body.classList.remove("battle-active");
  $("battle").hidden = true;
  $("menu").hidden = false;
  $("menu").innerHTML =
    `<div class="eyebrow"><span class="live-dot"></span> ONLINE 1V1 · REAL-TIME BATTLES</div><div class="intro"><div><h1>Your creature.<br>Your <em>arena.</em></h1><p>Eight original creatures. One basic attack and four special skills each. No waiting for your turn.<br>Challenge a friend to a real-time duel in Elemental Coliseum.</p></div><div class="arena-badge">✦<span>ELEMENTAL COLISEUM</span><small>BEST OF THREE</small></div></div><div class="lobby-layout"><div class="roster-panel">${fighterSelection(selected, elementFilter)}</div><aside class="room-panel">${isRoom ? `<div class="eyebrow">PRIVATE LOBBY</div><h2>Your duel starts here.</h2><p>Share this code with your friend.</p><button id="copy" class="room-code">${state!.code}<span>COPY CODE ↗</span></button><div class="players">${state!.players.map((p, i) => `<div><span class="player-dot" style="background:#${CHARACTERS[p.character].color.toString(16)}">${i + 1}</span><span><strong>${escape(p.name)} ${p.id === myId ? "<small>(you)</small>" : ""}</strong><small>${CHARACTERS[p.character].name}</small></span><b>${!p.connected ? "OFFLINE" : p.ready ? "READY" : "CHOOSING"}</b></div>`).join("")}${state!.players.length < 2 ? '<div class="waiting"><span>＋</span> Waiting for your opponent…</div>' : ""}</div><button class="primary" id="ready">${p!.ready ? "Cancel ready" : "Ready to battle →"}</button><button class="quiet full" id="leave">Leave room</button><small class="room-note">The match begins when both players are ready.</small>` : `<div class="eyebrow">PLAY ONLINE</div><h2>A friend. A code.<br>A worthy opponent.</h2><label for="name">YOUR DISPLAY NAME</label><input id="name" maxlength="20" placeholder="Enter your name" value="${escape(accountsUI?.account?.displayName ?? localStorage.getItem("arena-name") ?? "")}" autocomplete="nickname"><button class="primary" id="create">Create private room →</button>${accountsUI?.account ? '<button class="secondary full" id="practice">Solo test mode →</button>' : ""}<div class="divider">OR JOIN A FRIEND</div><label for="code">ROOM CODE</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Room code"><button id="join" class="secondary">Join →</button></div><small class="room-note">2 players · Free to play · Login required<br>Keyboard + mouse or mobile touch controls</small>`}</aside></div>`;
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(
    (button) =>
      (button.onclick = async () => {
        audio.unlock();
        selected = button.dataset.character as CharacterId;
        if (isRoom) await request("select", selected);
        screen = "";
        renderMenu();
        celebrateSelection($("menu"), reducedMotion);
      }),
  );
  $<HTMLSelectElement>("fighter-filter").onchange = () => {
    elementFilter = $<HTMLSelectElement>("fighter-filter").value;
    screen = "";
    renderMenu();
  };
  if (!isRoom && accountsUI?.account)
    $<HTMLInputElement>("name").readOnly = true;
  if (isRoom) {
    $("ready").onclick = () => {
      audio.unlock();
      void request("ready");
    };
    $("leave").onclick = () => void leave();
    $("copy").onclick = () =>
      void navigator.clipboard
        .writeText(state!.code)
        .then(() => toast("Room code copied."))
        .catch(() => toast(`Share this code: ${state!.code}`));
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
          ? { name }
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
    requestAnimationFrame(() => {
      touch.resize();
      scene?.scale.refresh();
    });
  }
  const me = state?.players.find((p) => p.id === myId);
  if (!state || !me) return;
  const key = `battle:${me.character}:${!!state.practice}`;
  if (screen !== key) {
    screen = key;
    $("menu").hidden = true;
    $("battle").hidden = false;
    ensureBattleRenderer();
    scene?.scale.refresh();
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
    $("hud").innerHTML = state.players
      .map(
        (p, i) =>
          `${i === 1 ? '<div class="timer-wrap"><span id="round-label"></span><strong id="timer">03:00</strong><span id="phase-label"></span></div>' : ""}<div class="health-card ${i === 1 ? "right" : ""}" style="--element:#${CHARACTERS[p.character].color.toString(16)}"><div><b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}</span><strong id="score-${i}"></strong></div><div class="health-track"><span id="health-${i}"></span></div><small id="health-text-${i}"></small><small id="status-${i}"></small></div>`,
      )
      .join("");
    const c = CHARACTERS[me.character];
    $("abilities").innerHTML =
      `<div class="basic-hint" title="${c.basic.name}: ${c.basic.description} No cooldown · ${Math.round((c.basic.interval ?? 0.3) * 1000)} ms between attacks."><kbd>LMB</kbd><span>${abilityIcon(c.basic.name)}<small>${c.basic.name.toUpperCase()}</small></span></div>${c.skills.map((a, i) => `<div class="ability" id="ability-${i}" style="--element:#${c.color.toString(16)}"><kbd>${KEYS.skills[i]}</kbd><span>${abilityIcon(a.name)}<small id="cooldown-${i}">READY</small></span><i class="cooldown-fill" id="fill-${i}"></i></div>`).join("")}<div class="movement-ability"><kbd>RMB</kbd><span>Dash<small id="dash-cd"></small></span></div><div class="movement-ability"><kbd>SPACE</kbd><span>Jump<small id="jump-cd"></small></span></div>`;
  }
  state.players.forEach((p, i) => {
    const c = CHARACTERS[p.character];
    $(`health-${i}`).style.width = `${(100 * p.hp) / c.health}%`;
    $(`health-text-${i}`).textContent = `${Math.ceil(p.hp)} / ${c.health} HP`;
    $(`score-${i}`).textContent = state!.practice
      ? p.id === myId
        ? "TRAINER"
        : "TARGET"
      : `${state!.scores[p.id]} / 2`;
    $(`status-${i}`).textContent = p.statuses
      .map((s) => s.kind.toUpperCase())
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
    : `ROUND ${state.round} · BEST OF 3`;
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
        : "LIVE DUEL"
      : state.phase.toUpperCase();
  CHARACTERS[me.character].skills.forEach((a, i) => {
    $(`ability-${i}`).title = `${a.name}: ${a.description}`;
    $(`ability-${i}`).setAttribute("aria-label", `${a.name}: ${a.description}`);
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
    CHARACTERS[me.character].skills.map((a) => a.cooldown),
    {
      name: CHARACTERS[me.character].basic.name,
      left: Math.max(0, me.basicAt - state.time),
      duration: CHARACTERS[me.character].basic.interval ?? 0.3,
    },
  );
  const overlay = $("arena-overlay");
  if (state.phase === "playing") {
    setOverlayMarkup(overlay, "");
    overlay.style.pointerEvents = "none";
  } else {
    overlay.style.pointerEvents = "auto";
    let heading = "",
      details = "";
    if (state.phase === "briefing") {
      heading = "How to play";
      const confirmed = state.instructionsReady.includes(myId);
      details =
        '<p class="mobile-howto">Touch mode: left joystick to move; big button for basic attacks, the four curved buttons for skills, DASH and JUMP below. Aim follows your opponent. Use Enter fullscreen below the arena.</p><div class="controls-list"><span><kbd>W A S D</kbd>Move · mouse to aim</span><span><kbd>LMB</kbd>Basic attack</span><span><kbd>1 2 3 R</kbd>Four special skills</span><span><kbd>RMB</kbd>Dash</span><span><kbd>SPACE</kbd>Jump over ground attacks</span></div><p>Use cover. Win two rounds. The countdown begins when both players confirm.</p><button class="primary" id="instructions-ready" ' +
        (confirmed ? "disabled" : "") +
        ">" +
        (confirmed ? "Waiting for opponent…" : "I’m ready →") +
        "</button>";
    }
    if (state.phase === "countdown") {
      heading = `${Math.ceil(state.remaining)}`;
      details = "Get ready. Make your move.";
    }
    if (state.phase === "intermission") {
      heading = state.roundWinner
        ? `${escape(state.players.find((p) => p.id === state!.roundWinner)!.name)} takes the round`
        : "Round drawn";
      details = `Next round in ${Math.ceil(state.remaining)} seconds`;
    }
    if (state.phase === "paused") {
      heading = "Opponent disconnected";
      details = `Match suspended · reconnect grace ${Math.ceil(state.pauseRemaining)}s`;
    }
    if (state.phase === "finished") {
      heading =
        state.winner === myId ? "Victory. Well played." : "A worthy fight.";
      details = `${escape(state.players.find((p) => p.id === state!.winner)?.name ?? "Nobody")} wins · ${state.players.map((p) => state!.scores[p.id]).join(" — ")}`;
      const stats = me.stats;
      details += `<div class="result-stats"><span><b>${Math.round(stats.dealt)}</b>DAMAGE DEALT</span><span><b>${Math.round(stats.received)}</b>DAMAGE TAKEN</span><span><b>${stats.skills}</b>SKILLS CAST</span></div><button class="primary" id="rematch">${me.ready ? "Waiting for opponent…" : "Rematch →"}</button><button class="secondary" id="return">Return to lobby</button>`;
    }
    const markup = `<div class="overlay-card"><span class="eyebrow">ELEMENT ARENA</span><h2>${heading}</h2><div>${details}</div></div>`;
    // Preserve the pressed button between snapshots so pointer-up can complete its click.
    setOverlayMarkup(overlay, markup);
    if (state.phase === "briefing")
      $("instructions-ready").onclick = () => {
        if (touch.enabled && !document.fullscreenElement)
          $("mobile-fullscreen").click();
        void request("instructions-ready");
      };
    if (state.phase === "finished") {
      $("rematch").onclick = () => void request("rematch");
      $("return").onclick = () => void request("lobby");
    }
  }
}
socket.on("connect", () => {
  connected = true;
  $("connection").textContent = "SERVER CONNECTED";
  $("connection").classList.add("online");
  const token = sessionStorage.getItem("arena-token");
  if (token)
    void request("resume", { token }).then((reply) => {
      if (reply.ok) identity(reply);
      else {
        sessionStorage.removeItem("arena-token");
        state = undefined;
        myId = "";
        screen = "";
        renderMenu();
      }
    });
});
socket.on("disconnect", () => {
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
socket.on("access-revoked", ({ error }: { error: string }) => {
  sessionStorage.removeItem("arena-token");
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
    audio.play(snapshot.winner === myId ? "victory" : "defeat");
  if (state?.phase !== snapshot.phase || state?.round !== snapshot.round)
    remoteFrames.clear();
  const previous = state;
  state = unpackSnapshot(snapshot);
  scene?.observeSnapshot(state, previous);
  pwa.sync();
  remoteFrames.add(state, performance.now());
  const me = state.players.find((p) => p.id === myId);
  if (!me) return;
  selected = me.character;
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
  if (state.phase === "lobby") renderMenu();
  else renderBattle();
});
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
    `<div class="eyebrow">YOUR PREFERENCES</div><h2>Find your rhythm.</h2><p>Online matches keep running while this menu is open.</p><label>MUSIC <input type="range" id="music" min="0" max="1" step=".01" value="${audio.music}"></label><label>SOUND EFFECTS <input type="range" id="effects" min="0" max="1" step=".01" value="${audio.effects}"></label><p>Reduced motion follows your system preference.</p>${touch.settingsHTML()}${myId ? '<button id="exit-room" class="secondary">Leave room</button>' : ""}`,
  );
  for (const kind of ["music", "effects"] as const)
    $(kind).oninput = () => {
      audio.unlock();
      audio.set(kind, Number($<HTMLInputElement>(kind).value));
    };
  touch.bindSettings();
  if (myId) $("exit-room").onclick = () => void leave();
}
$("mobile-settings").onclick = showSettings;
$("settings").onclick = showSettings;
$("battle-menu").onclick = showSettings;
$("help").onclick = () =>
  dialog(
    `<div class="eyebrow">HOW TO PLAY</div><h2>Every second counts.</h2><p>Create a room, share the code, choose your creatures, and both click Ready. Win two rounds to take the match.</p><div class="controls-list"><span><kbd>W A S D</kbd>Move in eight directions</span><span><kbd>MOUSE</kbd>Aim · left click to attack</span><span><kbd>1 2 3 R</kbd>Four special skills</span><span><kbd>RMB</kbd>Dash · 3 second cooldown</span><span><kbd>SPACE</kbd>Jump · dodge ground attacks</span><span><kbd>ESC</kbd>Settings · the match stays live</span></div><p>Use cover to block shots. Jump over ground zones. Skills recharge in 8–18 seconds; basic attacks never go on cooldown. At a tie, overtime drains both players' health.</p>`,
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
    e.code === "Space" &&
    state?.phase === "playing" &&
    !$<HTMLDialogElement>("dialog").open
  ) {
    if (!e.repeat && scene?.canControl()) scene.actions.jump = true;
    e.preventDefault();
  }
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
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
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
        if (p.hp < old.hp) rig.trigger("hurt", this.time.now, 160);
        if (old.jumpUntil > previous!.time && p.jumpUntil <= next.time)
          rig.trigger("land", this.time.now, 130);
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
    const g = this.make.graphics({}, false);
    paintArenaFloor(g);
    g.generateTexture("arena-floor", RULES.width, RULES.height);
    g.destroy();
    this.add.image(0, 0, "arena-floor").setOrigin(0).setDepth(-10);
    new ResizeObserver(() => {
      this.scale.getParentBounds();
      this.scale.refresh();
    }).observe($("game"));
    this.graphics = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,ONE,TWO,THREE,R,SPACE",
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse!.disableContextMenu();
    ["ONE", "TWO", "THREE", "R"].forEach((key, i) =>
      this.keys[key].on("down", () => {
        if (this.canControl()) this.actions.skill = i;
      }),
    );
    this.keys.SPACE.on("down", () => {
      if (this.canControl()) this.actions.jump = true;
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      audio.unlock();
      if (!touch.enabled && this.canControl() && pointer.leftButtonDown())
        this.actions.basic = true;
      if (!touch.enabled && this.canControl() && pointer.rightButtonDown())
        this.actions.dash = true;
    });
    this.scale.refresh();
  }
  effect(event: Snapshot["events"][number]) {
    if (event.owner === myId || event.kind === "hit" || event.kind === "round")
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
            this.time.now,
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
          this.time.now,
          event.kind === "dash"
            ? RULES.dashDuration * 1000
            : event.kind === "jump"
              ? RULES.jumpDuration * 1000
              : 130,
          event.id,
        );
    }
    if (
      event.kind === "beam" &&
      event.tx !== undefined &&
      event.ty !== undefined
    ) {
      const beam = this.add.graphics().setDepth(4);
      beam
        .lineStyle(14, event.color, 0.25)
        .lineBetween(event.x, event.y - 12, event.tx, event.ty);
      beam
        .lineStyle(5, 0xffffff, 0.85)
        .lineBetween(event.x, event.y - 12, event.tx, event.ty);
      this.tweens.add({
        targets: beam,
        alpha: 0,
        duration: reducedMotion ? 120 : 260,
        onComplete: () => beam.destroy(),
      });
      return;
    }
    const burst =
      event.kind === "burst" && event.abilityId
        ? allAbilities.get(event.abilityId)
        : undefined;
    if (burst) {
      // Show the true server hit radius so players can read the attack.
      const ring = this.add
        .circle(event.x, event.y, burst.radius, event.color, 0.16)
        .setStrokeStyle(4, event.color, 0.9)
        .setDepth(1);
      if (burst.ground) ring.setScale(1, 0.85);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scale: reducedMotion ? 1 : 1.08,
        duration: 420,
        onComplete: () => ring.destroy(),
      });
      return;
    }
    const melee =
      event.kind === "cast" && event.abilityId
        ? allAbilities.get(event.abilityId)
        : undefined;
    const attacker = state?.players.find((p) => p.id === event.owner);
    if (melee?.kind === "melee" && attacker) {
      // Swipe arc that matches the server hit range and width.
      const spread = Math.min(Math.PI * 0.95, Math.acos(melee.arc ?? 0.35));
      const swipe = this.add.graphics().setDepth(4);
      swipe
        .fillStyle(event.color, 0.28)
        .slice(
          event.x,
          event.y - 10,
          melee.range,
          attacker.angle - spread,
          attacker.angle + spread,
        )
        .fillPath();
      swipe
        .lineStyle(4, 0xffffff, 0.7)
        .beginPath()
        .arc(
          event.x,
          event.y - 10,
          melee.range * 0.92,
          attacker.angle - spread,
          attacker.angle + spread,
        )
        .strokePath();
      this.tweens.add({
        targets: swipe,
        alpha: 0,
        duration: reducedMotion ? 120 : 220,
        onComplete: () => swipe.destroy(),
      });
    }
    if (reducedMotion) return;
    const ring = this.add
      .circle(
        event.x,
        event.y,
        event.kind === "hit" ? 18 : 30,
        event.color,
        0.2,
      )
      .setStrokeStyle(2, event.color, 0.8);
    this.tweens.add({
      targets: ring,
      scale: 2.8,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy(),
    });
    if (event.kind === "hit")
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const particle = this.add.circle(event.x, event.y, 3, event.color);
        this.tweens.add({
          targets: particle,
          x: event.x + Math.cos(angle) * 45,
          y: event.y + Math.sin(angle) * 45,
          alpha: 0,
          scale: 0,
          duration: 300,
          onComplete: () => particle.destroy(),
        });
      }
    if (event.value) {
      const label = this.add
        .text(event.x, event.y - 45, `−${event.value}`, {
          fontFamily: "monospace",
          fontSize: "25px",
          color: "#fff",
          stroke: "#152820",
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: label,
        y: event.y - 95,
        alpha: 0,
        duration: 650,
        onComplete: () => label.destroy(),
      });
    }
  }
  update(_time: number, delta: number) {
    const tracked = state?.players.find((p) => p.id === myId);
    const follow =
      state?.phase === "playing" && tracked && tracked.hp > 0
        ? (local ?? tracked)
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
    this.cameras.main.setZoom(view.zoomX, view.zoomY).centerOn(view.x, view.y);
    const aim = screenToWorld(
      this.input.activePointer.x,
      this.input.activePointer.y,
      this.scale.width,
      this.scale.height,
      view,
    );
    const opponent = state?.players.find(
      (p) =>
        p.id !== myId &&
        p.hp > 0 &&
        !p.statuses.some((s) => s.kind === "stealth"),
    );
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
    if (!this.canControl()) {
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
      touch.reset();
    }
    if (!state || state.phase === "lobby") {
      this.rigs.forEach((rig) => rig.setVisible(false));
      this.labels.forEach((label) => (label.hidden = true));
      return;
    }
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / RULES.tick) {
      this.accumulator -= 1000 / RULES.tick;
      if (!connected || state.phase !== "playing" || !local) continue;
      const pointer = this.input.activePointer;
      const active =
        this.canControl() &&
        !settingsOpen &&
        !menuOpen &&
        !$<HTMLDialogElement>("dialog").open &&
        document.hasFocus() &&
        !document.hidden;
      const target = state.players.find(
        (p) =>
          p.id !== myId &&
          p.hp > 0 &&
          !p.statuses.some((s) => s.kind === "stealth"),
      );
      const mobileAim = touch.enabled && target;
      const input: Input = {
        seq: ++seq,
        dx: active
          ? touch.enabled
            ? touch.dx
            : Number(this.keys.D.isDown) - Number(this.keys.A.isDown)
          : 0,
        dy: active
          ? touch.enabled
            ? touch.dy
            : Number(this.keys.S.isDown) - Number(this.keys.W.isDown)
          : 0,
        aimX: mobileAim ? target.x : Phaser.Math.Clamp(aim.x, 0, 1600),
        aimY: mobileAim ? target.y : Phaser.Math.Clamp(aim.y, 0, 900),
        basic:
          active &&
          ((touch.enabled ? touch.basic : pointer.leftButtonDown()) ||
            this.actions.basic),
        skill: active ? this.actions.skill : -1,
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
    for (const z of state.zones) {
      g.fillStyle(z.color, 0.12).fillCircle(z.x, z.y, z.radius);
      g.lineStyle(3, z.color, 0.7).strokeCircle(z.x, z.y, z.radius);
      drawElementGlyph(
        g,
        z.ability.element,
        z.x,
        z.y,
        Math.min(22, z.radius * 0.18),
        z.color,
        0.35,
      );
      if (!reducedMotion) {
        const pulse = 1 + Math.sin(_time / 140) * 0.08;
        g.lineStyle(1, z.color, 0.3).strokeCircle(z.x, z.y, z.radius * pulse);
      }
    }
    for (const pr of state.projectiles) {
      // Layered comet trail: wide soft glow, element-coloured body, white-hot core.
      const r = pr.ability.radius,
        trail = reducedMotion ? 0.03 : 0.075;
      g.lineStyle(r * 2.4, pr.color, 0.16).lineBetween(
        pr.x - pr.vx * trail,
        pr.y - pr.vy * trail,
        pr.x,
        pr.y,
      );
      g.lineStyle(r * 1.2, pr.color, 0.45).lineBetween(
        pr.x - pr.vx * trail * 0.6,
        pr.y - pr.vy * trail * 0.6,
        pr.x,
        pr.y,
      );
      g.lineStyle(Math.max(2, r * 0.45), 0xffffff, 0.75).lineBetween(
        pr.x - pr.vx * trail * 0.3,
        pr.y - pr.vy * trail * 0.3,
        pr.x,
        pr.y,
      );
      g.fillStyle(pr.color, 0.25).fillCircle(pr.x, pr.y, r * 2.2);
      g.fillStyle(pr.color, 0.2).fillCircle(
        pr.x,
        pr.y,
        pr.ability.radius * 1.7,
      );
      g.fillStyle(pr.color).fillCircle(pr.x, pr.y, pr.ability.radius);
      drawElementGlyph(
        g,
        pr.ability.element,
        pr.x,
        pr.y,
        Math.max(6, pr.ability.radius),
        pr.color,
        0.9,
      );
      g.fillStyle(0xffffff, 0.8).fillCircle(
        pr.x - 3,
        pr.y - 3,
        pr.ability.radius * 0.4,
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
      if (interpolated) {
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
        victory:
          (state.phase === "finished"
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
          this.time.now,
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
      g.lineStyle(2, p.id === myId ? 0xffffff : c.color, 0.55).strokeEllipse(
        x,
        y + 12,
        72,
        32,
      );
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
        this.time.now,
        serverPlayer.statuses.some((s) => s.kind === "stealth")
          ? p.id === myId
            ? 0.5
            : 0.12
          : 1,
        reducedMotion,
      );
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
      if (serverPlayer.channel && !reducedMotion) {
        const cone = c.skills[serverPlayer.channel.skill];
        if (cone) {
          const spread = Math.acos(cone.arc ?? 0.7);
          const flicker = 0.85 + Math.sin(_time / 40) * 0.15;
          g.fillStyle(c.color, 0.22).slice(
            x,
            y - 12,
            cone.range * flicker,
            p.angle - spread,
            p.angle + spread,
          );
          g.fillPath();
        }
      }
      if (serverPlayer.charge) {
        g.lineStyle(3, c.color, 0.8).strokeCircle(
          x,
          y,
          45 + Math.sin(_time / 80) * 8,
        );
      }
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
      const labelX = (x - view.x) * view.zoomX + this.scale.width / 2;
      const labelY =
        (y -
          jump -
          view.y -
          (fighterPack(p.character)?.kind === "layered" ? 56 : 78)) *
          view.zoomY +
        this.scale.height / 2;
      label.style.left = labelX + "px";
      label.style.top = Math.max(36, labelY) + "px";
      label.style.opacity = p.hp > 0 ? "1" : "0.4";
      label.hidden =
        labelX < 0 ||
        labelX > this.scale.width ||
        labelY > this.scale.height ||
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
function ensureBattleRenderer() {
  if (gameInstance || $("game").clientWidth < 1 || $("game").clientHeight < 1)
    return;
  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: RULES.width,
    height: RULES.height,
    backgroundColor: "#1e3557",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: { width: 1, height: 1 },
    },
    scene: [ArenaScene],
    render: { antialias: true },
    // CSS-sized buffer; the camera maps the authoritative 1600x900 world.
    input: { activePointers: 4 },
  });
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
  onChange: () => {
    screen = "";
    if (!state || state.phase === "lobby") renderMenu();
  },
});
