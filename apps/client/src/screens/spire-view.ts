/**
 * The Spire in the Raid Hub: its card (the last tile of the boss list) and
 * its page (Climb · Floors · Blessings). Markup only: spire-model.ts derives
 * floor data, raid-hall.ts handles interaction, and spire.css handles layout.
 *
 * The Spire opens with a Cragmuff clear (the server checks it again before
 * a climb starts). A climb starts from your checkpoint (the first floor of
 * the zone you reached) and saves each floor as it is cleared.
 */
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  SPIRE_BLESSINGS,
  SPIRE_BLESSING_IDS,
  SPIRE_BUILT_TOP,
  SPIRE_ROLES,
  SPIRE_SEATS,
  spireBlessingText,
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

import {
  SPIRE_TABS,
  SPIRE_CATALOGUE,
  spireEntryBoss,
  spireUnlocked,
  spireStanding,
  spireModel,
  type SpireCatalogue,
  type SpireModel,
  type SpireData,
  type SpireView,
} from "./spire-model";
export {
  SPIRE_TABS,
  spireUnlocked,
  spireStanding,
  spireStartState,
  spirePreview,
  floorRoster,
} from "./spire-model";
export type { SpireTab, SpireData, SpireView } from "./spire-model";

const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
const chip = (c: CharacterId, scope: string, size = 26) =>
  avatar(fighterAvatar(c, scope), { element: CHARACTERS[c].element, size });
/** The Spire's tile: the last card of the boss list. */
export function spireCard(d: SpireData) {
  const open = spireUnlocked(d);
  const { highest, checkpoint } = spireStanding(d);
  const corner = !open
    ? `<span class="ui-tag is-lock">${lockIcon}Clear ${esc(spireEntryBoss().name)} first</span>`
    : highest
      ? tag(`Floor ${highest}`, "ok")
      : tag("New", "new");
  const line = open
    ? `Floor ${highest} · Checkpoint ${checkpoint}`
    : "Echo waves, an elite and the Ascendant bosses";
  const label = `The Spire, ${open ? `floor ${highest}, checkpoint ${checkpoint}` : `locked: clear ${spireEntryBoss().name} first`}`;
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
function floorPreview(model: SpireModel) {
  const { next, selected } = model;
  const {
    floor: f,
    zone,
    state,
    roster,
    description,
    title,
    coins,
    claimed,
  } = selected;
  const enemies =
    f.kind === "boss"
      ? esc(f.name)
      : roster
          .map(
            (c) =>
              `<span class="sp-enemy">${chip(c, `sp-preview-${f.floor}-${c}`, 24)}<span>${esc(CHARACTERS[c].name)}</span></span>`,
          )
          .join("");
  return `<article class="sp-preview is-${state.key}" aria-label="Floor ${f.floor} preview"><div class="sp-preview-heading"><div><small class="ui-kicker">${selected === next ? "Next uncleared" : "Floor preview"} · Floor ${f.floor}</small><h3 class="ui-h">${esc(f.name)}</h3></div>${tag(selected.kind)}</div><p class="ui-note">${esc(zone.name)} · ${esc(zone.element)} · ${esc(state.label)}</p><p class="ui-note sp-encounter-description${f.description ? " is-specific" : ""}">${esc(description)}</p><div class="sp-enemies">${enemies}</div><div class="sp-preview-reward"><small class="ui-note">${claimed ? "First-clear reward claimed" : "First-clear reward"}</small>${price(coins)}${title ? `<span class="ui-tag sp-preview-title">${esc(title)}</span>` : ""}</div></article>`;
}
function floorRoute(model: SpireModel) {
  const { activeGroup, selected, checkpoint, groups } = model;
  const zones =
    groups.length > 1
      ? `<div class="sp-zone-picker" role="group" aria-label="Preview a zone">${groups.map((g) => `<button type="button" data-spire-zone="${g.floors[0].floor.floor}" aria-pressed="${activeGroup.zone.id === g.zone.id}" aria-label="Preview Zone ${g.zone.id}, ${esc(g.zone.name)}">Zone ${g.zone.id} · ${esc(g.zone.element)}</button>`).join("")}</div>`
      : "";
  return `<div class="sp-route-wrap">${zones}<div class="sp-route-heading"><b>Floor milestones${groups.length > 1 ? ` · Zone ${activeGroup.zone.id}` : ""}</b><small class="ui-note">◆ Elite · ★ Boss · ◇ Checkpoint</small></div><div class="sp-route" role="group" aria-label="Preview a floor">${activeGroup.floors
    .map(({ floor: f, state, kind }) => {
      const mark =
        f.kind === "boss"
          ? "★"
          : f.kind === "elite"
            ? "◆"
            : f.floor === checkpoint
              ? "◇"
              : "";
      return `<button type="button" class="sp-milestone is-${state.key}${f.floor === checkpoint ? " is-checkpoint" : ""}" data-spire-preview="${f.floor}" aria-pressed="${selected.floor.floor === f.floor}" aria-label="Floor ${f.floor}, ${kind}, ${state.label}${f.floor === checkpoint ? ", checkpoint" : ""}"><span>${f.floor}</span><small aria-hidden="true">${mark}</small></button>`;
    })
    .join("")}</div></div>`;
}
function climbTab(model: SpireModel, d: SpireData) {
  const { checkpoint, attempts, complete, total } = model;
  const how = `<details class="sp-guide"><summary>How to play</summary><ul class="sp-how"><li><b>Waves of Echoes.</b> Shadow copies of the champions, with their whole kits. Beat every wave to open the stairs.</li><li><b>A blessing a floor.</b> After each floor, pick one of three. They stack, and last until the climb ends.</li><li><b>Every floor counts.</b> A cleared floor is saved at once and pays its first-clear reward, even if the climb ends later.</li><li><b>Checkpoints.</b> A new climb starts at the first floor of the zone you reached, with no blessings. A party climbs from its lowest checkpoint.</li></ul></details>`;
  return `${complete ? `<p class="sp-conquered">All ${total} floors conquered! Replay from your checkpoint.</p>` : ""}${floorPreview(model)}${floorRoute(model)}<p class="ui-note sp-start-note">${attempts} climbs · Checkpoint ${checkpoint}. Floor previews do not change where a climb starts.</p>${seats(d)}${how}`;
}
function floorsTab(model: SpireModel) {
  return `<p class="ui-note">First-clear rewards are paid once, the first time you clear each floor.</p>${model.groups
    .map(({ zone, floors }) => {
      const rows = floors
        .map(({ floor: f, state, kind, roster, description, title, coins }) => {
          const who =
            f.kind === "boss"
              ? `<small class="ui-note">${esc(f.name)} · ${esc(description)}</small>`
              : `<span class="rh-tricks">${roster.map((c) => chip(c, `sp-f${f.floor}-${c}`, 24)).join("")}</span>`;
          const reward = `<span class="sp-reward">${price(coins)}${title ? `<span class="ui-tag sp-title-tag">${menuIcon("leaderboard")}${esc(title)}</span>` : ""}</span>`;
          const mark =
            state.key === "done"
              ? `<span class="sp-check" role="img" aria-label="Cleared">${menuIcon("check")}</span>`
              : state.key === "locked" || state.key === "soon"
                ? `<span class="sp-lock" aria-hidden="true">${lockIcon}</span>`
                : "";
          return `<li class="sp-floor is-${state.key}" data-spire-floor="${f.floor}"><span class="sp-floor-num ui-num">${f.floor}</span><span class="sp-floor-main"><span class="sp-floor-name"><b>${esc(f.name)}</b>${tag(kind, f.kind === "elite" ? "sale" : f.kind === "boss" ? "lock" : undefined)}</span>${who}<small class="ui-note sp-floor-state">${esc(state.label)}</small></span>${reward}${mark}</li>`;
        })
        .join("");
      return `<section class="sp-floor-zone" aria-label="Zone ${zone.id}, ${esc(zone.name)}"><h3 class="ui-h">Zone ${zone.id} · ${esc(zone.name)} · ${esc(zone.element)}</h3><ol class="sp-floors" aria-label="Floors of the Spire, Zone ${zone.id}">${rows}</ol></section>`;
    })
    .join("")}`;
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
function stage(model: SpireModel) {
  const { highest, checkpoint, cleared, next, total, activeGroup } = model;
  const zone = activeGroup.zone;
  const trail = activeGroup.floors
    .map(
      ({ floor: f }) =>
        `<span class="${f.floor <= highest ? "is-done" : ""}${f.floor === next?.floor.floor ? " is-next" : ""}${f.floor === checkpoint ? " is-checkpoint" : ""}"></span>`,
    )
    .reverse()
    .join("");
  return `<section class="ui-split-stage rh-stage sp-stage" style="--el:${SPIRE_COLOR}" aria-label="The Spire"><span class="sp-poster"><img src="${spirePoster}" alt="" width="900" height="1350" decoding="async" /></span><div class="sp-ascent"><span class="sp-stat"><b class="ui-num">${cleared}<small> / ${total}</small></b><small>Floors cleared</small></span><progress max="${total}" value="${cleared}" aria-label="Floors cleared"></progress><small>${next ? `Next: floor ${next.floor.floor}` : "Spire conquered"} · Checkpoint ${checkpoint}</small></div><div class="sp-tower-trail" aria-hidden="true">${trail}</div><div class="rh-stage-info"><span class="rh-row">${tag(`Zone ${zone.id} · ${zone.element}`)}</span><b class="rh-stage-name">The Spire</b><small class="ui-note rh-stage-line">Climb past the Echoes</small><p class="rh-win"><span class="ui-kicker">Roles</span><b>${Object.values(
    SPIRE_ROLES,
  )
    .map((r) => esc(r.name))
    .join(" · ")}</b></p></div></section>`;
}

/** The Spire's page in the Raid Hub. */
export function spireMarkup(
  view: SpireView,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const model = spireModel(view, d, catalogue);
  const tab = view.spireTab ?? "climb";
  const s = model.start;
  const tabRow = tabs(
    SPIRE_TABS.map(([id, label]) => ({ id, label, selected: tab === id })),
    "The Spire",
    "spire-tab",
  );
  const body =
    tab === "floors"
      ? floorsTab(model)
      : tab === "blessings"
        ? blessingsTab()
        : climbTab(model, d);
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
          ? `Climb from floor ${model.checkpoint}`
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
  return `<section class="ui-panel is-split rh-room sp-room" role="dialog" aria-label="The Spire" data-raid-mode="spire" style="--boss:${SPIRE_COLOR}">${stage(model)}<div class="ui-split-main"><header class="ui-panel-head rh-head">${button("All bosses", { size: "s", icon: "back", attrs: { "data-raid-back": true } })}<span class="ui-note rh-hint">Preview floors, enemies and first-clear rewards.</span>${iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true })}</header>${tabRow}<div class="ui-panel-body rh-body sp-body" data-raid-region="body" data-tab="${tab}">${loading}${body}<p class="ui-note rh-status" role="status">${esc(view.status)}</p></div>${foot}</div></section>`;
}
