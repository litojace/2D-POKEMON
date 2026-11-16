/**
 * The Spire in the Raid Hub: its card (the last tile of the boss list) and
 * its page (Climb · Floors · Blessings). Markup and rules only; the Raid
 * Hub (raid-hall.ts) wires it up, with the shared components and styles.
 *
 * The Spire opens with a Cragmuff clear (the server checks it again before
 * a climb starts). A climb starts from your checkpoint (the first floor of
 * the zone you reached) and saves each floor as it is cleared.
 */
import { CHARACTERS, type CharacterId } from "@arena/shared";
import type { RaidProgress } from "../../../../packages/shared/src/raid";
import {
  SPIRE_BLESSINGS,
  SPIRE_BLESSING_IDS,
  SPIRE_BUILT_TOP,
  SPIRE_FLOORS,
  SPIRE_ROLES,
  SPIRE_SEATS,
  SPIRE_ZONES,
  spireBlessingText,
  spireRewardsOf,
  spireStartCheckpoint,
  type SpireFloor,
  type SpireProgress,
} from "../../../../packages/shared/src/spire";
import { fighterAvatar } from "../fighter-art";
import { menuIcon } from "../menu-icons";
import { SPIRE_COLOR, spireBlessingIcon } from "../spire-art";
import spirePoster from "../art/spire/tower-portrait.webp";
import {
  actionBar,
  actions,
  avatar,
  button,
  esc,
  iconButton,
  price,
  segmented,
  tabs,
  tag,
} from "../ui/components";

export type SpireTab = "climb" | "floors" | "blessings";
export const SPIRE_TABS: [SpireTab, string][] = [
  ["climb", "Climb"],
  ["floors", "Floors"],
  ["blessings", "Blessings"],
];
/** What the Spire page needs from the Raid Hub's data. */
export interface SpireData {
  progress: RaidProgress | null;
  spire?: SpireProgress | null;
  loading: boolean;
  me: { name: string; character: CharacterId };
  party: {
    id: string;
    name: string;
    character: CharacterId;
    leader: boolean;
    me: boolean;
  }[];
  leader: boolean;
  inRoom: boolean;
}
export interface SpireView {
  spireTab?: SpireTab;
  /** Floor preview only; starting a climb always uses the checkpoint. */
  spireFloor?: number;
  play: "solo" | "party";
  status: string;
}

/** The Spire opens with any Cragmuff clear. */
export function spireUnlocked(d: Pick<SpireData, "progress" | "spire">) {
  return (
    (d.spire?.clears?.grumblecrag ??
      d.progress?.bosses?.grumblecrag?.clears ??
      d.progress?.clears ??
      0) > 0
  );
}
/**
 * Your climb so far (nothing saved yet: floor 0, checkpoint 1). The
 * checkpoint is where a climb starts: a zone that is built (after zone 1's
 * boss, floor 1 until zone 2 exists).
 */
export function spireStanding(d: Pick<SpireData, "spire">) {
  const s = d.spire;
  return {
    highest: s?.highestFloor ?? 0,
    checkpoint: spireStartCheckpoint(s?.checkpoint ?? 1),
    attempts: s?.attempts ?? 0,
    claimed: new Set(s?.claimed ?? []),
  };
}
/** Start climb: whether it can go now, and what it will do. */
export function spireStartState(view: SpireView, d: SpireData) {
  const size = Math.max(1, d.party.length);
  const play: SpireView["play"] = size > 1 ? "party" : view.play;
  const { checkpoint } = spireStanding(d);
  const reason = !spireUnlocked(d)
    ? "Clear Cragmuff once to open the Spire."
    : d.inRoom
      ? "Leave your current room first."
      : !d.leader
        ? "Your party leader starts the climb."
        : "";
  const from = checkpoint;
  const note = reason
    ? reason
    : play === "solo"
      ? `Just you · from floor ${from} · one self-revive a floor`
      : size > 1
        ? `${size} of ${SPIRE_SEATS} seats · from your party's lowest checkpoint`
        : `A room for up to ${SPIRE_SEATS} · invite friends there`;
  return { play, ok: !reason, reason, note, soloLocked: size > 1 };
}

const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
const chip = (c: CharacterId, scope: string, size = 26) =>
  avatar(fighterAvatar(c, scope), { element: CHARACTERS[c].element, size });
/** The champions a floor fields (each once), in order of appearance. */
export function floorRoster(f: SpireFloor): CharacterId[] {
  const all = [
    ...f.waves.flat(),
    ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
  ].map((e) => e.character);
  return [...new Set(all)];
}
const coinsOf = (floor: number) =>
  spireRewardsOf(floor)
    .filter((r) => r.kind === "coins")
    .reduce((n, r) => n + r.amount, 0);
const titleOf = (floor: number) =>
  spireRewardsOf(floor).find((r) => r.kind === "title")?.item;

/** The Spire's tile: the last card of the boss list. */
export function spireCard(d: SpireData) {
  const open = spireUnlocked(d);
  const { highest, checkpoint } = spireStanding(d);
  const corner = !open
    ? `<span class="ui-tag is-lock">${lockIcon}Clear Cragmuff first</span>`
    : highest
      ? tag(`Floor ${highest}`, "ok")
      : tag("New", "new");
  const line = open
    ? `Floor ${highest} · Checkpoint ${checkpoint}`
    : "Echo waves, an elite and the Ascendant bosses";
  const label = `The Spire, ${open ? `floor ${highest}, checkpoint ${checkpoint}` : "locked: clear Cragmuff first"}`;
  return `<button type="button" class="rh-card rh-spire-card${open ? "" : " is-locked"}" style="--boss:${SPIRE_COLOR}" data-raid-spire aria-label="${esc(label)}"><span class="rh-card-art spire-card-art"><img src="${spirePoster}" alt="" width="900" height="1350" decoding="async" /></span><span class="rh-card-top">${corner}<span class="rh-stars spire-floors" aria-hidden="true">${SPIRE_BUILT_TOP} floors</span></span><span class="rh-card-text"><b class="rh-card-name">The Spire</b><small class="ui-note rh-card-line">${esc(line)}</small><span class="rh-card-foot"><span class="ui-note">Climb · blessings · rewards</span></span></span></button>`;
}

/* ------------------------------------------------------------- tabs */

function seats(d: SpireData) {
  const me = d.party.find((s) => s.me) ?? {
    id: "me",
    name: d.me.name,
    character: d.me.character,
    leader: true,
    me: true,
  };
  const list = [
    { ...me, character: d.me.character },
    ...d.party.filter((s) => !s.me),
  ].slice(0, SPIRE_SEATS);
  const open = SPIRE_SEATS - list.length;
  return `<div class="rh-seats" role="group" aria-label="Climbing party">${list
    .map(
      (s, i) =>
        `<div class="rh-seat${s.me ? " is-me" : ""}">${chip(s.character, `sp-seat-${i}`, 52)}<b>${esc(s.name)}</b><small class="ui-note">${s.me ? "You" : s.leader ? "Leader" : "In your party"}</small></div>`,
    )
    .join(
      "",
    )}${Array.from({ length: open }, () => `<div class="rh-seat is-open"><span class="rh-plus" aria-hidden="true">+</span><b>Open seat</b><small class="ui-note">Invite from the Lobby</small></div>`).join("")}</div>`;
}
/** Floors available in the current build, including completed and gated floors. */
const builtFloors = () =>
  Object.values(SPIRE_FLOORS)
    .filter((f) => f.floor <= SPIRE_BUILT_TOP)
    .sort((a, b) => a.floor - b.floor);
export function spirePreview(view: SpireView, d: SpireData) {
  const floors = builtFloors();
  const { highest } = spireStanding(d);
  const next = floors.find((f) => f.floor > highest);
  const selected =
    floors.find((f) => f.floor === view.spireFloor) ??
    next ??
    floors[floors.length - 1];
  return { floors, next, selected };
}
function floorKind(f: SpireFloor) {
  return f.kind === "boss"
    ? "Boss"
    : f.kind === "elite"
      ? "Elite"
      : `${f.waves.length} waves`;
}
function floorPreview(view: SpireView, d: SpireData) {
  const { next, selected: f } = spirePreview(view, d);
  const zone = SPIRE_ZONES[f.zone];
  const state = floorState(f, d);
  const claimed = spireStanding(d).claimed.has(f.floor);
  const roster = floorRoster(f);
  const enemies =
    f.kind === "boss"
      ? esc(zone.ascendant)
      : roster
          .map(
            (c) =>
              `<span class="sp-enemy">${chip(c, `sp-preview-${f.floor}-${c}`, 24)}<span>${esc(CHARACTERS[c].name)}</span></span>`,
          )
          .join("");
  const challenge =
    f.kind === "boss"
      ? "Ascendant boss encounter"
      : f.elite
        ? `${f.elite.name} · reinforcements and eruption attacks`
        : "Defeat every Echo wave to open the stairs";
  const title = titleOf(f.floor);
  return `<article class="sp-preview is-${state.key}" aria-label="Floor ${f.floor} preview"><div class="sp-preview-heading"><div><small class="ui-kicker">${f === next ? "Next uncleared" : "Floor preview"} · Floor ${f.floor}</small><h3 class="ui-h">${esc(f.name)}</h3></div>${tag(floorKind(f))}</div><p class="ui-note">${esc(zone.name)} · ${esc(zone.element)} · ${esc(state.label)}</p><p class="ui-note">${esc(challenge)}</p><div class="sp-enemies">${enemies}</div><div class="sp-preview-reward"><small class="ui-note">${claimed ? "First-clear reward claimed" : "First-clear reward"}</small>${price(coinsOf(f.floor))}${title ? `<span class="ui-tag sp-preview-title">${esc(title)}</span>` : ""}</div></article>`;
}
function floorRoute(view: SpireView, d: SpireData) {
  const { floors, selected } = spirePreview(view, d);
  const { checkpoint } = spireStanding(d);
  return `<div class="sp-route-wrap"><div class="sp-route-heading"><b>Floor milestones</b><small class="ui-note">◆ Elite · ★ Boss · ◇ Checkpoint</small></div><div class="sp-route" role="group" aria-label="Preview a floor">${floors
    .map((f) => {
      const state = floorState(f, d);
      const mark =
        f.kind === "boss"
          ? "★"
          : f.kind === "elite"
            ? "◆"
            : f.floor === checkpoint
              ? "◇"
              : "";
      return `<button type="button" class="sp-milestone is-${state.key}${f.floor === checkpoint ? " is-checkpoint" : ""}" data-spire-preview="${f.floor}" aria-pressed="${selected.floor === f.floor}" aria-label="Floor ${f.floor}, ${floorKind(f)}, ${state.label}${f.floor === checkpoint ? ", checkpoint" : ""}"><span>${f.floor}</span><small aria-hidden="true">${mark}</small></button>`;
    })
    .join("")}</div></div>`;
}
function climbTab(view: SpireView, d: SpireData) {
  const { highest, checkpoint, attempts } = spireStanding(d);
  const complete = highest >= SPIRE_BUILT_TOP;
  const how = `<details class="sp-guide"><summary>How to play</summary><ul class="sp-how"><li><b>Waves of Echoes.</b> Shadow copies of the champions, with their whole kits. Beat every wave to open the stairs.</li><li><b>A blessing a floor.</b> After each floor, pick one of three. They stack, and last until the climb ends.</li><li><b>Every floor counts.</b> A cleared floor is saved at once and pays its first-clear reward, even if the climb ends later.</li><li><b>Checkpoints.</b> A new climb starts at the first floor of the zone you reached, with no blessings. A party climbs from its lowest checkpoint.</li></ul></details>`;
  return `${complete ? `<p class="sp-conquered">All ${SPIRE_BUILT_TOP} floors conquered! Replay from your checkpoint.</p>` : ""}${floorPreview(view, d)}${floorRoute(view, d)}<p class="ui-note sp-start-note">${attempts} climbs · Checkpoint ${checkpoint}. Floor previews do not change where a climb starts.</p>${seats(d)}${how}`;
}
function floorState(f: SpireFloor, d: SpireData) {
  const { highest, claimed } = spireStanding(d);
  if (f.kind === "boss" && f.floor > SPIRE_BUILT_TOP)
    return { key: "soon", label: "Coming soon" };
  if (claimed.has(f.floor) || f.floor <= highest)
    return { key: "done", label: "Cleared" };
  // A boss floor also needs that boss's raid cleared (the server checks too).
  const boss = f.kind === "boss" ? f.boss : undefined;
  if (
    boss &&
    !(d.spire?.clears?.[boss] ?? d.progress?.bosses?.[boss]?.clears ?? 0)
  )
    return { key: "locked", label: "Clear its raid first" };
  if (f.floor === highest + 1) return { key: "next", label: "Next" };
  return { key: "locked", label: `Clear floor ${f.floor - 1} first` };
}
function floorsTab(d: SpireData) {
  const zone = SPIRE_ZONES[1];
  const rows = Object.values(SPIRE_FLOORS)
    .filter((f) => f.zone === zone.id)
    .map((f) => {
      const state = floorState(f, d);
      const kind =
        f.kind === "elite"
          ? tag("Elite", "sale")
          : f.kind === "boss"
            ? tag("Boss", "lock")
            : tag(`${f.waves.length} waves`);
      const who =
        f.kind === "boss"
          ? `<small class="ui-note">${esc(zone.ascendant)} · new attacks: Avalanche Charge, Twin Slam</small>`
          : `<span class="rh-tricks">${floorRoster(f)
              .map((c) => chip(c, `sp-f${f.floor}-${c}`, 24))
              .join("")}</span>`;
      const title = titleOf(f.floor);
      const reward = `<span class="sp-reward">${price(coinsOf(f.floor))}${title ? `<span class="ui-tag sp-title-tag">${menuIcon("leaderboard")}${esc(title)}</span>` : ""}</span>`;
      const mark =
        state.key === "done"
          ? `<span class="sp-check" role="img" aria-label="Cleared">${menuIcon("check")}</span>`
          : state.key === "locked" || state.key === "soon"
            ? `<span class="sp-lock" aria-hidden="true">${lockIcon}</span>`
            : "";
      return `<li class="sp-floor is-${state.key}" data-spire-floor="${f.floor}"><span class="sp-floor-num ui-num">${f.floor}</span><span class="sp-floor-main"><span class="sp-floor-name"><b>${esc(f.name)}</b>${kind}</span>${who}<small class="ui-note sp-floor-state">${esc(state.label)}</small></span>${reward}${mark}</li>`;
    })
    .join("");
  return `<p class="ui-note">${esc(zone.name)} · ${esc(zone.element)}. First-clear rewards are paid once, the first time you clear each floor.</p><ol class="sp-floors" aria-label="Floors of the Spire">${rows}</ol>`;
}
function blessingsTab() {
  const cards = SPIRE_BLESSING_IDS.map((id) => {
    const b = SPIRE_BLESSINGS[id];
    const values = b.values
      .map((v) => (b.unit === "percent" ? `${Math.round(v * 100)}%` : `${v}`))
      .join(" → ");
    return `<div class="sp-blessing" data-spire-blessing-info="${id}"><span class="sp-blessing-icon">${spireBlessingIcon(id)}</span><span class="sp-blessing-text"><b>${esc(b.name)}</b><small class="ui-note">${esc(spireBlessingText(id, 0))}</small><small class="sp-stacks">${esc(b.tag)} · stacks ${b.values.length}× · ${esc(values)}</small></span></div>`;
  }).join("");
  return `<p class="ui-note">After every floor each climber picks one of three. Picking one you hold stacks it. Blessings end with the climb.</p><div class="sp-blessings">${cards}</div>`;
}
function stage(d: SpireData) {
  const { highest, checkpoint } = spireStanding(d);
  const cleared = Math.min(SPIRE_BUILT_TOP, Math.max(0, highest));
  const next = builtFloors().find((f) => f.floor > highest);
  const zone = SPIRE_ZONES[(next ?? builtFloors().at(-1)!).zone];
  const trail = builtFloors()
    .map(
      (f) =>
        `<span class="${f.floor <= highest ? "is-done" : ""}${f.floor === next?.floor ? " is-next" : ""}${f.floor === checkpoint ? " is-checkpoint" : ""}"></span>`,
    )
    .reverse()
    .join("");
  return `<section class="ui-split-stage rh-stage sp-stage" style="--el:${SPIRE_COLOR}" aria-label="The Spire"><span class="sp-poster"><img src="${spirePoster}" alt="" width="900" height="1350" decoding="async" /></span><div class="sp-ascent"><span class="sp-stat"><b class="ui-num">${cleared}<small> / ${SPIRE_BUILT_TOP}</small></b><small>Floors cleared</small></span><progress max="${SPIRE_BUILT_TOP}" value="${cleared}" aria-label="Floors cleared"></progress><small>${next ? `Next: floor ${next.floor}` : "Spire conquered"} · Checkpoint ${checkpoint}</small></div><div class="sp-tower-trail" aria-hidden="true">${trail}</div><div class="rh-stage-info"><span class="rh-row">${tag(`Zone ${zone.id} · ${zone.element}`)}</span><b class="rh-stage-name">The Spire</b><small class="ui-note rh-stage-line">Climb past the Echoes</small><p class="rh-win"><span class="ui-kicker">Roles</span><b>${Object.values(
    SPIRE_ROLES,
  )
    .map((r) => esc(r.name))
    .join(" · ")}</b></p></div></section>`;
}

/** The Spire's page in the Raid Hub. */
export function spireMarkup(view: SpireView, d: SpireData) {
  const tab = view.spireTab ?? "climb";
  const s = spireStartState(view, d);
  const tabRow = tabs(
    SPIRE_TABS.map(([id, label]) => ({ id, label, selected: tab === id })),
    "The Spire",
    "spire-tab",
  );
  const body =
    tab === "floors"
      ? floorsTab(d)
      : tab === "blessings"
        ? blessingsTab()
        : climbTab(view, d);
  const mode = segmented(
    [
      {
        id: "solo",
        label: "Solo",
        selected: s.play === "solo",
        attrs: s.soloLocked
          ? { disabled: true, title: "Leave your party to climb solo" }
          : {},
      },
      { id: "party", label: "With party", selected: s.play === "party" },
    ],
    "How to climb",
    "raid-play",
  );
  const foot = actionBar(
    s.ok
      ? `${mode}<small class="ui-note rh-foot-note">${esc(s.note)}</small>`
      : `<small class="ui-note rh-foot-note is-reason" role="status">${esc(s.reason)}</small>`,
    actions(
      button(
        s.play === "solo"
          ? `Climb from floor ${spireStanding(d).checkpoint}`
          : "Start party climb",
        {
          kind: "primary",
          disabled: !s.ok,
          attrs: { "data-raid-start": s.play },
        },
      ),
    ),
  );
  const loading =
    d.loading && !d.spire
      ? `<p class="ui-note" role="status">Loading your climb…</p>`
      : "";
  return `<section class="ui-panel is-split rh-room sp-room" role="dialog" aria-label="The Spire" data-raid-mode="spire" style="--boss:${SPIRE_COLOR}">${stage(d)}<div class="ui-split-main"><header class="ui-panel-head rh-head">${button("All bosses", { size: "s", icon: "back", attrs: { "data-raid-back": true } })}<span class="ui-note rh-hint">Ten floors a zone: waves, an elite on 5, a boss on 10.</span>${iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true })}</header>${tabRow}<div class="ui-panel-body rh-body sp-body" data-raid-region="body" data-tab="${tab}">${loading}${body}<p class="ui-note rh-status" role="status">${esc(view.status)}</p></div>${foot}</div></section>`;
}
