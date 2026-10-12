import Phaser from "phaser";
import { io } from "socket.io-client";
import {
  CHARACTERS,
  RULES,
  OBSTACLES,
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
const audio = new AudioManager();
const remoteFrames = new InterpolationBuffer();
const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
  auth: { accessToken: null },
});
let accountsUI: AccountUI;
let state: Snapshot | undefined,
  myId = "",
  selected: CharacterId = "voltling",
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
  `<header class="topbar"><a class="brand" href="#"><span class="brand-mark">✦</span> ELEMENT<span>ARENA</span></a><div class="top-links"><span class="connection" id="connection">Connecting</span><button class="quiet" id="help">How to play</button><button class="quiet" id="settings">⚙ Settings</button><div id="account-nav" class="account-nav"></div></div></header><main><section id="menu"></section><section id="battle" hidden><div id="practice-controls" class="practice-controls" hidden></div><div id="hud" class="hud"></div><div class="arena-frame"><div id="game"></div><div id="arena-overlay"></div><span class="map-label">FOREST ARENA <span>01 / VERDANT GROUNDS</span></span></div><div id="abilities" class="ability-bar"></div><div class="battle-footer"><span>WASD <b>Move</b> · Mouse <b>Aim</b> · Click <b>Attack</b></span><span id="network">AUTHORITATIVE ONLINE MATCH</span><button class="quiet" id="battle-menu">Esc / Menu</button></div></section></main><footer><span>ELEMENT ARENA <b>•</b> REAL-TIME CREATURE DUELS</span><button class="quiet" id="credits">Credits</button><span>Original creatures. One arena. Your move.</span></footer><div id="toast" role="status"></div><dialog id="dialog"></dialog>`;
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
  local = undefined;
  remoteFrames.clear();
  sessionStorage.setItem("arena-token", reply.token!);
}
function creatureArt(id: CharacterId) {
  const c = CHARACTERS[id];
  const color = `#${c.color.toString(16).padStart(6, "0")}`;
  const ears =
    id === "emberwing"
      ? '<path d="M62 85 23 51 31 104 60 116 M138 85 177 51 169 104 140 116"/>'
      : id === "voltling"
        ? '<path d="M67 76 52 22 86 65 M116 65 149 22 133 76"/>'
        : id === "aquashade"
          ? '<path d="M55 88 37 64 63 61 M140 88 166 62 136 64"/>'
          : '<path d="M57 92 43 39 75 64 M125 64 157 39 143 92"/>';
  return `<svg viewBox="0 0 200 180" aria-label="${c.name}" role="img"><ellipse cx="100" cy="154" rx="51" ry="10" fill="${color}" opacity=".13"/><g fill="${color}" stroke="#17242b" stroke-width="5" stroke-linejoin="round">${ears}<path d="M61 139 52 151 76 151 M125 151 148 151 139 138"/><path d="M52 106Q49 62 100 61Q151 62 148 106L139 140Q100 160 61 140Z"/></g><path d="M71 96h17v16H71zM113 96h17v16h-17z" fill="#17242b"/><path d="M75 97h5v5h-5zM117 97h5v5h-5z" fill="#fff"/><path d="m92 120 8 6 8-6" fill="none" stroke="#17242b" stroke-width="4"/><path d="m99 74 6 9-9 6-5-9z" fill="#fff" opacity=".65"/></svg>`;
}
function renderMenu() {
  const p = state?.players.find((p) => p.id === myId);
  const isRoom = !!p;
  const character = CHARACTERS[selected];
  const key = `${isRoom ? "room" : "home"}:${state?.players.map((p) => `${p.id}${p.character}${p.ready}${p.connected}`).join(":")}:${selected}`;
  if (screen === key) return;
  screen = key;
  $("battle").hidden = true;
  $("menu").hidden = false;
  $("menu").innerHTML =
    `<div class="eyebrow"><span class="live-dot"></span> ONLINE 1V1 · REAL-TIME BATTLES</div><div class="intro"><div><h1>Your creature.<br>Your <em>arena.</em></h1><p>Four elements. Four skills. No waiting for your turn.<br>Challenge a friend to a real-time duel in the Forest Arena.</p></div><div class="arena-badge">✦<span>FOREST ARENA</span><small>BEST OF THREE</small></div></div><div class="lobby-layout"><div class="roster-panel"><div class="section-title"><h2>Choose your fighter</h2><span>04 CREATURES</span></div><div class="roster">${Object.values(
      CHARACTERS,
    )
      .map(
        (c) =>
          `<button class="creature-card ${selected === c.id ? "selected" : ""}" style="--element:#${c.color.toString(16)}" data-character="${c.id}"><span class="element-label">${c.element}</span>${creatureArt(c.id)}<strong>${c.name}</strong><small>${c.role}</small><span class="card-bottom">${c.health} HP <span>${selected === c.id ? "✓ SELECTED" : "SELECT →"}</span></span></button>`,
      )
      .join(
        "",
      )}</div><div class="skill-preview"><div><span class="eyebrow" style="color:#${character.color.toString(16)}">${character.element}</span><h3>${character.name}'s toolkit</h3><p>${character.role} · ${character.speed} movement speed</p></div><div class="preview-skills">${character.skills.map((a, i) => `<div><kbd>${KEYS.skills[i]}</kbd><span><strong>${a.name}</strong><small>${a.description}</small></span><b>${a.cooldown}s</b></div>`).join("")}</div></div><p class="universal">Every fighter can <b>basic attack</b>, <b>dash</b>, and <b>jump</b> in addition to their four skills.</p></div><aside class="room-panel">${isRoom ? `<div class="eyebrow">PRIVATE LOBBY</div><h2>Your duel starts here.</h2><p>Share this code with your friend.</p><button id="copy" class="room-code">${state!.code}<span>COPY CODE ↗</span></button><div class="players">${state!.players.map((p, i) => `<div><span class="player-dot" style="background:#${CHARACTERS[p.character].color.toString(16)}">${i + 1}</span><span><strong>${escape(p.name)} ${p.id === myId ? "<small>(you)</small>" : ""}</strong><small>${CHARACTERS[p.character].name}</small></span><b>${!p.connected ? "OFFLINE" : p.ready ? "READY" : "CHOOSING"}</b></div>`).join("")}${state!.players.length < 2 ? '<div class="waiting"><span>＋</span> Waiting for your opponent…</div>' : ""}</div><button class="primary" id="ready">${p!.ready ? "Cancel ready" : "Ready to battle →"}</button><button class="quiet full" id="leave">Leave room</button><small class="room-note">The match begins when both players are ready.</small>` : `<div class="eyebrow">PLAY ONLINE</div><h2>A friend. A code.<br>A worthy opponent.</h2><label for="name">YOUR DISPLAY NAME</label><input id="name" maxlength="20" placeholder="Enter your name" value="${escape(accountsUI?.account?.displayName ?? localStorage.getItem("arena-name") ?? "")}" autocomplete="nickname"><button class="primary" id="create">Create private room →</button>${accountsUI?.account?.isAdmin ? '<button class="secondary full" id="practice">Solo test mode →</button>' : ""}<div class="divider">OR JOIN A FRIEND</div><label for="code">ROOM CODE</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Room code"><button id="join" class="secondary">Join →</button></div><small class="room-note">2 players · Free to play · Login required<br>Keyboard + mouse recommended</small>`}</aside></div>`;
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(
    (button) =>
      (button.onclick = async () => {
        audio.unlock();
        selected = button.dataset.character as CharacterId;
        if (isRoom) await request("select", selected);
        screen = "";
        renderMenu();
      }),
  );
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
        if (!accountsUI.ensurePlayer(true)) return;
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
  await request("leave");
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
  const me = state?.players.find((p) => p.id === myId);
  if (!state || !me) return;
  const key = `battle:${me.character}:${!!state.practice}`;
  if (screen !== key) {
    screen = key;
    $("menu").hidden = true;
    $("battle").hidden = false;
    scene?.scale.refresh();
    $("practice-controls").hidden = !state.practice;
    if (state.practice) {
      $("practice-controls").innerHTML =
        `<div class="practice-heading"><span class="eyebrow">SOLO TEST MODE</span><span id="practice-stats"></span></div><div class="practice-actions"><label>Creature <select id="practice-character">${Object.values(
          CHARACTERS,
        )
          .map(
            (c) =>
              `<option value="${c.id}" ${me.character === c.id ? "selected" : ""}>${c.name}</option>`,
          )
          .join(
            "",
          )}</select></label><label><input id="practice-unlimited" type="checkbox"> No skill cooldowns</label><label><input id="practice-attacks" type="checkbox"> Target attacks</label><button class="secondary" id="practice-reset">Reset arena</button><button class="quiet" id="practice-exit">Exit test mode</button></div><p>Target respawns automatically. Enable attacks to test counters, clones and jumping over ground fire. Hover a skill for its description.</p>`;
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
      `<div class="basic-hint"><kbd>LMB</kbd><span>${c.basic.name}<small>BASIC ATTACK</small></span></div>${c.skills.map((a, i) => `<div class="ability" id="ability-${i}" style="--element:#${c.color.toString(16)}"><kbd>${KEYS.skills[i]}</kbd><span>${a.name}<small id="cooldown-${i}">READY</small></span><i class="cooldown-fill" id="fill-${i}"></i></div>`).join("")}<div class="movement-ability"><kbd>SHIFT</kbd><span>Dash<small id="dash-cd"></small></span></div><div class="movement-ability"><kbd>SPACE</kbd><span>Jump<small id="jump-cd"></small></span></div>`;
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
    $(`ability-${i}`).title = a.description;
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
  const overlay = $("arena-overlay");
  if (state.phase === "playing") {
    overlay.innerHTML = "";
    overlay.style.pointerEvents = "none";
  } else {
    overlay.style.pointerEvents = "auto";
    let heading = "",
      details = "";
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
    overlay.innerHTML = `<div class="overlay-card"><span class="eyebrow">ELEMENT ARENA</span><h2>${heading}</h2><div>${details}</div></div>`;
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
  state = unpackSnapshot(snapshot);
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
    `<div class="eyebrow">YOUR PREFERENCES</div><h2>Find your rhythm.</h2><p>Online matches keep running while this menu is open.</p><label>MUSIC <input type="range" id="music" min="0" max="1" step=".01" value="${audio.music}"></label><label>SOUND EFFECTS <input type="range" id="effects" min="0" max="1" step=".01" value="${audio.effects}"></label><p>Reduced motion follows your system preference.</p>${myId ? '<button id="exit-room" class="secondary">Leave room</button>' : ""}`,
  );
  for (const kind of ["music", "effects"] as const)
    $(kind).oninput = () => {
      audio.unlock();
      audio.set(kind, Number($<HTMLInputElement>(kind).value));
    };
  if (myId) $("exit-room").onclick = () => void leave();
}
$("settings").onclick = showSettings;
$("battle-menu").onclick = showSettings;
$("help").onclick = () =>
  dialog(
    `<div class="eyebrow">HOW TO PLAY</div><h2>Every second counts.</h2><p>Create a room, share the code, choose your creatures, and both click Ready. Win two rounds to take the match.</p><div class="controls-list"><span><kbd>W A S D</kbd>Move in eight directions</span><span><kbd>MOUSE</kbd>Aim · left click to attack</span><span><kbd>Q E R F</kbd>Your four combat skills</span><span><kbd>SHIFT</kbd>Dash · 3 second cooldown</span><span><kbd>SPACE</kbd>Jump · dodge ground attacks</span><span><kbd>ESC</kbd>Settings · the match stays live</span></div><p>Use cover to block shots. Jump over ground zones. Ultimates recharge every 30 seconds. At a tie, overtime drains both players' health.</p>`,
  );
$("credits").onclick = () =>
  dialog(
    '<div class="eyebrow">BUILT FOR THE DUEL</div><h2>Element Arena</h2><p>Original procedural creature artwork, arena art, and synthesized audio. Built with Phaser, Socket.IO, Express, TypeScript, and Vite.</p><p>A monster-battling inspired project. No official Pokémon artwork, sprites, or music are used.</p>',
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
      !$<HTMLDialogElement>("dialog").open &&
      document.hasFocus()
    );
  }
  positions = new Map<string, { x: number; y: number }>();
  labels = new Map<string, Phaser.GameObjects.Text>();
  constructor() {
    super("arena");
  }
  create() {
    scene = this;
    this.cameras.main.setBackgroundColor("#17372d");
    const g = this.add.graphics();
    g.fillStyle(0x214736).fillRect(0, 0, 1600, 900);
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2400; i++) {
      g.fillStyle([0x2a513d, 0x2f5840, 0x1d4031][i % 3], 0.6);
      g.fillRect(random() * 1600, random() * 900, 3 + random() * 8, 3);
    }
    g.lineStyle(3, 0x608456, 0.4);
    g.strokeRoundedRect(35, 35, 1530, 830, 18);
    g.lineStyle(1, 0x9bbc75, 0.08);
    for (let x = 100; x < 1600; x += 100) g.lineBetween(x, 45, x, 855);
    for (let y = 100; y < 900; y += 100) g.lineBetween(45, y, 1555, y);
    g.fillStyle(0x8cb780, 0.06).fillCircle(800, 450, 235);
    g.lineStyle(2, 0xa8c98c, 0.15).strokeCircle(800, 450, 230);
    g.lineStyle(3, 0xa8c98c, 0.2).strokeCircle(800, 450, 165);
    for (const x of [260, 1340]) {
      g.lineStyle(3, x === 260 ? 0xffd65b : 0x63dce8, 0.3);
      g.strokeCircle(x, 450, 70);
      g.lineBetween(x - 20, 450, x + 20, 450);
      g.lineBetween(x, 430, x, 470);
    }
    for (const o of OBSTACLES) {
      g.fillStyle(0x102c24, 0.7).fillRoundedRect(
        o.x + 8,
        o.y + 15,
        o.w,
        o.h,
        18,
      );
      g.fillStyle(0x637574).fillRoundedRect(o.x, o.y, o.w, o.h, 14);
      g.fillStyle(0x81918a).fillRoundedRect(o.x + 7, o.y + 4, o.w - 14, 25, 8);
      g.fillStyle(0x384e4a).fillRect(o.x + 12, o.y + o.h - 15, o.w - 24, 7);
      g.lineStyle(3, 0x49615b).lineBetween(
        o.x + 20,
        o.y + 45,
        o.x + 35,
        o.y + 70,
      );
      g.fillStyle(0x426c40).fillEllipse(o.x + 20, o.y + 10, 50, 20);
    }
    for (let i = 0; i < 20; i++) {
      const x = i < 10 ? 30 + i * 170 : 30 + (i - 10) * 170;
      const y = i < 10 ? 5 : 880;
      g.fillStyle(0x102c24, 0.8).fillEllipse(x, y + 12, 120, 65);
      g.fillStyle(0x285d3c).fillCircle(x, y, 60);
      g.fillStyle(0x397449).fillCircle(x - 15, y - 15, 38);
      g.fillStyle(0x478450).fillCircle(x - 25, y - 25, 22);
    }
    this.graphics = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,Q,E,R,F,SHIFT,SPACE",
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse!.disableContextMenu();
    KEYS.skills.forEach((key, i) =>
      this.keys[key].on("down", () => {
        if (this.canControl()) this.actions.skill = i;
      }),
    );
    this.keys.SHIFT.on("down", () => {
      if (this.canControl()) this.actions.dash = true;
    });
    this.keys.SPACE.on("down", () => {
      if (this.canControl()) this.actions.jump = true;
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      audio.unlock();
      if (this.canControl() && pointer.leftButtonDown())
        this.actions.basic = true;
    });
    this.scale.refresh();
  }
  effect(event: Snapshot["events"][number]) {
    if (event.owner === myId || event.kind === "hit" || event.kind === "round")
      audio.play(event.kind);
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
    for (const [id, label] of this.labels)
      if (!state?.players.some((p) => p.id === id)) {
        label.destroy();
        this.labels.delete(id);
        this.positions.delete(id);
      }
    if (!this.canControl())
      this.actions = { skill: -1, dash: false, jump: false, basic: false };
    if (!state || state.phase === "lobby") return;
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / RULES.tick) {
      this.accumulator -= 1000 / RULES.tick;
      if (!connected || state.phase !== "playing" || !local) continue;
      const pointer = this.input.activePointer;
      const active =
        !settingsOpen &&
        !menuOpen &&
        !$<HTMLDialogElement>("dialog").open &&
        document.hasFocus();
      const input: Input = {
        seq: ++seq,
        dx: active
          ? Number(this.keys.D.isDown) - Number(this.keys.A.isDown)
          : 0,
        dy: active
          ? Number(this.keys.S.isDown) - Number(this.keys.W.isDown)
          : 0,
        aimX: Phaser.Math.Clamp(pointer.worldX, 0, 1600),
        aimY: Phaser.Math.Clamp(pointer.worldY, 0, 900),
        basic: active && (pointer.leftButtonDown() || this.actions.basic),
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
    for (const z of state.zones) {
      g.fillStyle(z.color, 0.12).fillCircle(z.x, z.y, z.radius);
      g.lineStyle(3, z.color, 0.7).strokeCircle(z.x, z.y, z.radius);
      if (!reducedMotion) {
        const pulse = 1 + Math.sin(_time / 140) * 0.08;
        g.lineStyle(1, z.color, 0.3).strokeCircle(z.x, z.y, z.radius * pulse);
      }
    }
    for (const pr of state.projectiles) {
      g.lineStyle(pr.ability.radius, pr.color, 0.15).lineBetween(
        pr.x - pr.vx * 0.025,
        pr.y - pr.vy * 0.025,
        pr.x,
        pr.y,
      );
      g.fillStyle(pr.color, 0.2).fillCircle(
        pr.x,
        pr.y,
        pr.ability.radius * 1.7,
      );
      g.fillStyle(pr.color).fillCircle(pr.x, pr.y, pr.ability.radius);
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
      const bob = reducedMotion
        ? 0
        : Math.sin(_time / (Math.hypot(p.vx, p.vy) > 30 ? 65 : 220)) * 2;
      if (serverPlayer.clone)
        this.drawCreature(
          g,
          serverPlayer.clone.x,
          serverPlayer.clone.y,
          p.character,
          p.angle,
          0.3,
        );
      g.fillStyle(0x081f19, 0.45).fillEllipse(
        x,
        y + 15,
        65 - jump * 0.3,
        23 - jump * 0.1,
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
      if (p.hp > 0)
        this.drawCreature(g, x, y - jump + bob, p.character, p.angle, 1);
      else {
        g.fillStyle(c.color, 0.4).fillEllipse(x, y, 45, 15);
      }
      if (serverPlayer.statuses.some((s) => s.kind === "shield"))
        g.lineStyle(3, c.color, 0.8).strokeCircle(x, y - jump, 43);
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
          shield: 0xb5a1ff,
          haste: 0x8ee6ad,
        };
        g.fillStyle(colors[s.kind]).fillCircle(
          x - 18 + i * 10,
          y - 60 - jump,
          4,
        );
      }
      let label = this.labels.get(p.id);
      if (!label) {
        label = this.add
          .text(0, 0, "", {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: "#e7f3df",
            stroke: "#17372d",
            strokeThickness: 4,
          })
          .setOrigin(0.5);
        this.labels.set(p.id, label);
      }
      label
        .setPosition(x, y - 45 - jump)
        .setText(
          `${p.title ? `${p.title}\n` : ""}${p.name}${p.id === myId ? " • YOU" : ""}`,
        )
        .setAlpha(p.hp > 0 ? 1 : 0.4);
      g.fillStyle(0x102c24).fillRoundedRect(x - 30, y + 29, 60, 6, 3);
      g.fillStyle(c.color).fillRoundedRect(
        x - 30,
        y + 29,
        Math.max(0, (60 * serverPlayer.hp) / c.health),
        6,
        3,
      );
    }
    const pointer = this.input.activePointer;
    g.lineStyle(1, 0xffffff, 0.6).strokeCircle(
      pointer.worldX,
      pointer.worldY,
      10,
    );
    g.lineBetween(
      pointer.worldX - 15,
      pointer.worldY,
      pointer.worldX - 6,
      pointer.worldY,
    );
    g.lineBetween(
      pointer.worldX + 6,
      pointer.worldY,
      pointer.worldX + 15,
      pointer.worldY,
    );
  }
  drawCreature(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    id: CharacterId,
    angle: number,
    alpha: number,
  ) {
    const color = CHARACTERS[id].color;
    g.fillStyle(color, alpha);
    if (id === "voltling") {
      g.fillTriangle(x - 20, y - 10, x - 25, y - 46, x - 6, y - 23);
      g.fillTriangle(x + 20, y - 10, x + 25, y - 46, x + 6, y - 23);
    } else if (id === "emberwing") {
      g.fillTriangle(x - 20, y, x - 47, y - 22, x - 40, y + 18);
      g.fillTriangle(x + 20, y, x + 47, y - 22, x + 40, y + 18);
    } else if (id === "aquashade") {
      g.fillTriangle(x - 20, y - 8, x - 38, y - 24, x - 10, y - 22);
      g.fillTriangle(x + 20, y - 8, x + 38, y - 24, x + 10, y - 22);
    } else {
      g.fillTriangle(x - 20, y - 10, x - 30, y - 36, x - 10, y - 26);
      g.fillTriangle(x + 20, y - 10, x + 30, y - 36, x + 10, y - 26);
    }
    g.fillRoundedRect(x - 25, y - 25, 50, 52, 17);
    g.fillStyle(0xffffff, alpha * 0.2).fillEllipse(x - 7, y - 15, 30, 13);
    g.fillStyle(0x152a2d, alpha);
    const offset = Math.cos(angle) * 4;
    g.fillRect(x - 14 + offset, y - 7 + Math.sin(angle) * 3, 8, 10);
    g.fillRect(x + 6 + offset, y - 7 + Math.sin(angle) * 3, 8, 10);
    g.fillStyle(0xffffff, alpha)
      .fillRect(x - 13 + offset, y - 6 + Math.sin(angle) * 3, 3, 3)
      .fillRect(x + 7 + offset, y - 6 + Math.sin(angle) * 3, 3, 3);
    g.fillStyle(0x152a2d, alpha).fillRect(x - 4, y + 12, 8, 3);
    g.fillStyle(color, alpha)
      .fillRoundedRect(x - 24, y + 20, 17, 10, 4)
      .fillRoundedRect(x + 7, y + 20, 17, 10, 4);
    g.lineStyle(3, color, alpha * 0.5).lineBetween(
      x + Math.cos(angle) * 31,
      y + Math.sin(angle) * 31,
      x + Math.cos(angle) * 47,
      y + Math.sin(angle) * 47,
    );
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: RULES.width,
  height: RULES.height,
  backgroundColor: "#214736",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [ArenaScene],
  render: { antialias: true },
  input: { activePointers: 1 },
});
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
