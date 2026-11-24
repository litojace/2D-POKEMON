/**
 * The Spire in the Raid Hub: its card (the last tile of the boss list) and
 * its page (Climb · Floors · Blessings). Markup only: spire-model.ts derives
 * floor data, raid-hall.ts handles interaction, and spire.css handles layout.
 *
 * The Spire opens with a Cragmuff clear (the server checks it again before
 * a climb starts). One climb is one zone: you pick the zone on the Climb tab
 * (zone 1 always, a later zone once you reached its first floor), the climb
 * starts at its first floor and saves each floor as it is cleared.
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
import { elementIcon } from "../element-icons";
import { fighterPortrait } from "../fighter-art";
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
  spireZoneChoice,
  floorRoster,
} from "./spire-model";
export type { SpireTab, SpireData, SpireView } from "./spire-model";

const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
const chip = (c: CharacterId, size = 26) =>
  avatar(fighterPortrait(c), { element: CHARACTERS[c].element, size });
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
        `<div class="rh-seat${s.me ? " is-me" : ""}">${chip(s.character, 52)}<b>${esc(s.name)}</b><small class="ui-note">${s.me ? "You" : s.leader ? "Leader" : "In your party"}</small></div>`,
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
              `<span class="sp-enemy">${chip(c, 24)}<span>${esc(CHARACTERS[c].name)}</span></span>`,
          )
          .join("");
  return `<article class="sp-preview is-${state.key}" aria-label="Floor ${f.floor} preview"><div class="sp-preview-heading"><div><small class="ui-kicker">${selected === next ? "Next uncleared" : "Floor preview"} · Floor ${f.floor}</small><h3 class="ui-h">${esc(f.name)}</h3></div>${tag(selected.kind)}</div><p class="ui-note">${esc(zone.name)} · ${esc(zone.element)} · ${esc(state.label)}</p><p class="ui-note sp-encounter-description${f.description ? " is-specific" : ""}">${esc(description)}</p><div class="sp-enemies">${enemies}</div><div class="sp-preview-reward"><small class="ui-note">${claimed ? "First-clear reward claimed" : "First-clear reward"}</small>${price(coins)}${title ? `<span class="ui-tag sp-preview-title">${esc(title)}</span>` : ""}</div></article>`;
}
/**
 * The zone picker: the zone a climb starts in (zone 1 always, a later zone
 * once its checkpoint is earned). The preview and milestones below follow
 * it. Shown once more than one zone is released.
 *
 * Phones first: one row of equal, finger-sized chips (the zone's number and
 * its element's glyph; a lock while it is closed), all of them in view
 * without scrolling for up to seven zones, and the picked zone's name,
 * element, floors and Ascendant said once beside the row. Where the row
 * leaves no room beside it (phones), the milestones' heading says the
 * zone's name and element instead (its floors are the milestones): no
 * extra line, so the milestones stay in view.
 */
function zonePicker(model: SpireModel) {
  const { groups, climbZone } = model;
  if (groups.length < 2) return "";
  const range = (g: SpireModel["groups"][number]) => ({
    from: g.floors[0].floor.floor,
    top: g.floors[g.floors.length - 1].floor.floor,
  });
  const items = groups
    .map((g) => {
      const { zone: z, open } = g;
      const on = open && z.id === climbZone;
      const { from, top } = range(g);
      // Its boss floor cleared: the zone is conquered (a gold edge).
      const won = g.floors[g.floors.length - 1]?.state.key === "done";
      const label = `Zone ${z.id}, ${z.name}, ${z.element}. ${open ? `Floors ${from} to ${top}, ${z.ascendant} at the top${won ? ", conquered" : ""}` : `Locked: conquer zone ${z.id - 1} first`}`;
      const glyph = open ? elementIcon(z.element) : lockIcon;
      return `<button type="button" class="sp-zone${on ? " is-on" : ""}${open ? "" : " is-locked"}${won ? " is-conquered" : ""}" data-ui-spire-zone="${z.id}" aria-pressed="${on}"${open ? "" : " disabled"} aria-label="${esc(label)}" title="${esc(`Zone ${z.id} · ${z.name}${won ? " · conquered" : open ? "" : ` · conquer zone ${z.id - 1} first`}`)}" style="--zone:var(--el-${esc(z.element.toLowerCase())}, var(--boss))"><span class="sp-zone-num ui-num" aria-hidden="true">${z.id}</span><span class="sp-zone-glyph" aria-hidden="true">${glyph}</span></button>`;
    })
    .join("");
  const picked =
    groups.find((g) => g.open && g.zone.id === climbZone) ?? groups[0];
  const { from, top } = range(picked);
  const z = picked.zone;
  // The picked zone, said once (the chips' labels carry it for screen readers).
  const info = `<p class="sp-zone-info" aria-hidden="true" style="--zone:var(--el-${esc(z.element.toLowerCase())}, var(--boss))"><b><span class="sp-zone-info-num">Zone ${z.id}</span> ${esc(z.name)}</b><small class="ui-note">${elementIcon(z.element)}${esc(z.element)} · Floors ${from}–${top} · ${esc(z.ascendant)}</small></p>`;
  return `<div class="sp-zones" data-zones="${groups.length}"><div class="sp-zone-picker" role="group" aria-label="Zone to climb">${items}</div>${info}</div>`;
}
// Small decorative UI glyphs; encounter types and state still come from the model.
const milestoneCrest = (kind: "boss" | "elite" | "checkpoint") => {
  const path = {
    boss: '<path d="m3 6 4 4 5-7 5 7 4-4-2 13H5Z"/><path d="M6 15h12"/>',
    elite: '<path d="m12 2 8 10-8 10-8-10Z"/><path d="M12 7v10M8 12h8"/>',
    checkpoint: '<path d="M6 22V3m0 1c5-4 7 4 13 0v10c-6 4-8-4-13 0"/>',
  }[kind];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
};
function floorRoute(model: SpireModel) {
  const { activeGroup, selected, checkpoint, groups } = model;
  const cleared = activeGroup.floors.filter(
    (f) => f.state.key === "done",
  ).length;
  return `<div class="sp-route-wrap"><div class="sp-route-heading"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 20h6v-6h6V8h6M4 7l4-4 4 4M8 3v9"/></svg>Floor milestones${groups.length > 1 ? ` · Zone ${activeGroup.zone.id}<span class="sp-route-zone">· ${esc(activeGroup.zone.name)} · ${esc(activeGroup.zone.element)}</span>` : ""}</b><small class="ui-note"><strong>${cleared}</strong> / ${activeGroup.floors.length} cleared</small></div><div class="sp-route" role="group" aria-label="Preview a floor">${activeGroup.floors
    .map(({ floor: f, state, kind }) => {
      const camp = f.floor === checkpoint;
      const crest =
        f.kind === "boss" || f.kind === "elite"
          ? milestoneCrest(f.kind)
          : camp
            ? milestoneCrest("checkpoint")
            : state.key === "done"
              ? menuIcon("check")
              : state.key === "locked" || state.key === "soon"
                ? lockIcon
                : "";
      const caption =
        f.kind === "boss"
          ? "Boss"
          : f.kind === "elite"
            ? "Elite"
            : camp
              ? "Camp"
              : state.key === "next"
                ? "Next"
                : "";
      return `<button type="button" class="sp-milestone is-${f.kind} is-${state.key}${camp ? " is-checkpoint" : ""}" data-spire-preview="${f.floor}" aria-pressed="${selected.floor.floor === f.floor}" aria-label="Floor ${f.floor}, ${kind}, ${state.label}${camp ? ", checkpoint" : ""}"><span class="sp-route-link" aria-hidden="true"></span><span class="sp-node" aria-hidden="true"><span class="sp-node-number">${f.floor}</span>${crest ? `<span class="sp-node-crest">${crest}</span>` : ""}</span><small class="sp-node-caption" aria-hidden="true">${caption || "&nbsp;"}</small></button>`;
    })
    .join("")}</div></div>`;
}
function climbTab(model: SpireModel, d: SpireData) {
  const { checkpoint, attempts, complete, total } = model;
  const how = `<details class="sp-guide"><summary>How to play</summary><ul class="sp-how"><li><b>Waves of Echoes.</b> Shadow copies of the champions, with their whole kits. Beat every wave to open the stairs.</li><li><b>A blessing a floor.</b> After each floor, pick one of three. They stack, and last until the climb ends.</li><li><b>Every floor counts.</b> A cleared floor is saved at once and pays its first-clear reward, even if the climb ends later.</li><li><b>One zone a climb.</b> A new climb starts at the first floor of the zone you pick, with no blessings, and ends at its boss. Conquer a zone to open the next; you can always climb an earlier one again. Everyone in a party needs the zone's checkpoint.</li><li><b>A checkpoint after the elite.</b> Beat a zone's elite and, until you conquer the zone, your climbs of it start on the next floor: you first pick the blessings of the floors before it. A party starts there when everyone has beaten it.</li></ul></details>`;
  // Every floor of the Spire cleared, its summit too: the whole Spire is yours.
  return `${complete ? `<p class="sp-conquered" role="status"><b>The Spire is yours!</b> All ${model.groups.length} zones and ${total} floors conquered. Pick a zone to climb again.</p>` : ""}${zonePicker(model)}${floorRoute(model)}${floorPreview(model)}<p class="ui-note sp-start-note">${attempts} climbs · Checkpoint ${checkpoint}. Floor previews do not change where a climb starts.</p>${seats(d)}${how}`;
}
function floorsTab(model: SpireModel) {
  return `<p class="ui-note">First-clear rewards are paid once, the first time you clear each floor.</p>${model.groups
    .map(({ zone, floors }) => {
      const rows = floors
        .map(({ floor: f, state, kind, roster, description, title, coins }) => {
          const who =
            f.kind === "boss"
              ? `<small class="ui-note">${esc(f.name)} · ${esc(description)}</small>`
              : `<span class="rh-tricks">${roster.map((c) => chip(c, 24)).join("")}</span>`;
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
      const from = floors[0].floor.floor,
        top = floors[floors.length - 1].floor.floor;
      return `<section class="sp-floor-zone" data-spire-zone-floors="${zone.id}" aria-label="Zone ${zone.id}, ${esc(zone.name)}"><h3 class="ui-h sp-zone-head">Zone ${zone.id} · ${esc(zone.name)} · ${esc(zone.element)} <small class="ui-note">floors ${from}–${top}</small></h3><ol class="sp-floors" start="${from}" aria-label="Floors of the Spire, Zone ${zone.id}">${rows}</ol></section>`;
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
        s.play === "solo" ? `Climb from floor ${s.from}` : "Start party climb",
        {
          kind: "primary",
          icon: "battle",
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
