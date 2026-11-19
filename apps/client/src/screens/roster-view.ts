/**
 * The roster (UI remodel step 3, docs/ui-remodel/PLAN.md): every fighter as
 * a card, filters and sort, and a fighter's detail on the stage. Markup and
 * rules only (no DOM); screens/roster.ts wires it up. It is built to be the
 * game's one fighter picker: the PvP and raid rooms move to it in step 5
 * (the `action` option says what the main button does).
 *
 * Every fighter is free (there is no fighter ownership), so a card shows
 * what does exist: element, range, role, mastery and how many looks you own.
 */
import {
  CHARACTERS,
  COMBOS,
  PASSIVES,
  ULT_SLOT,
  type CharacterId,
} from "@arena/shared";
import { CHAMPION_SKINS } from "../../../../packages/shared/src/shop";
import {
  RAID_BOSSES,
  RAID_BOSS_PERKS,
  type RaidBossId,
  type RaidLoadout,
} from "../../../../packages/shared/src/raid";
import {
  masteryTier,
  nextMastery,
} from "../../../../packages/shared/src/accounts";
import { abilityIcon } from "../ability-icons";
import { elementIcon } from "../element-icons";
import { colourPreview } from "../colour-preview";
import {
  fighterArt,
  fighterAvatar,
  scopeIds,
  svgBackdrop,
} from "../fighter-art";
import {
  attackRange,
  fighterStageArt,
  previewLook,
  RIG_FRAME,
} from "../fighter-selection";
import { stageLight } from "../stage-light";
import { itemPicture } from "../shop-ui";
import { originalLook } from "../skin-thumbnails";
import {
  actionBar,
  actions,
  attrs,
  avatar,
  bar,
  button,
  elementTag,
  esc,
  iconButton,
  ring,
  tabs,
  tag,
} from "../ui/components";

export const FIGHTERS = Object.keys(CHARACTERS) as CharacterId[];
export type RosterSort = "mastery" | "name" | "element";
export type RosterRange = "any" | "long" | "close";
export type RosterTab = "overview" | "skills" | "skins";
export interface RosterView {
  mode: "grid" | "detail";
  /** The card that is picked (grid) or the fighter shown (detail). */
  focus: CharacterId;
  element: string;
  range: RosterRange;
  sort: RosterSort;
  tab: RosterTab;
  /** The skill shown large on the Skills tab: 0–3, or "basic". */
  skill: number | "basic";
}
export interface RosterData {
  /** Your Lobby fighter now. */
  playing: CharacterId;
  /** Matches played with each fighter (mastery). */
  matches: (c: CharacterId) => number;
  /** Skins you own, and the one each fighter wears. */
  owned: readonly string[];
  looks: Partial<Record<CharacterId, { skin: string; stage: number }>>;
  /** Your equipped shared looks (Colors, aura...), as the Wardrobe shows. */
  look?: RaidLoadout;
  /** Key labels for the four skills, the basic attack, dash and jump. */
  keys: { skills: string[]; basic: string; dash: string; jump: string };
  /** Low graphics: no live fighter on the stage. */
  low?: boolean;
  /** What the main button does: Select here, Lock in a room (step 5). */
  action?: "select" | "lock";
  /**
   * In a room (action "lock"): the room's name, and where your pick stands.
   * `playing` is then the fighter locked in for you.
   */
  room?: {
    kicker: string;
    /** The pick is being saved on the server. */
    saving: boolean;
    ready: boolean;
    /** Ready can be pressed (the room is waiting, nothing is being saved). */
    canReady: boolean;
    /**
     * PvP: your pick is locked in (`playing`). Unset in a room that has no
     * lock (a raid): the fighter you play is then locked in already.
     */
    locked?: boolean;
    /**
     * 2v2: what your teammate is looking at or has locked in. A fighter your
     * teammate locked in is theirs (one per team; docs/hidden-picks.md).
     */
    mates?: Partial<Record<CharacterId, { name: string; locked: boolean }>>;
  };
}
export const rosterView = (
  focus: CharacterId,
  extra: Partial<RosterView> = {},
): RosterView => ({
  mode: "grid",
  focus,
  element: "All",
  range: "any",
  sort: "mastery",
  tab: "skills",
  skill: 0,
  ...extra,
});

const elVar = (c: CharacterId) =>
  `var(--el-${CHARACTERS[c].element.toLowerCase()})`;
export const ELEMENTS = [
  ...new Set(FIGHTERS.map((c) => CHARACTERS[c].element)),
];
const rangeName = (c: CharacterId) =>
  attackRange(c) === "long" ? "Ranged" : "Close";

/* ------------------------------------------------------------ rules */

/** Looks you have for a fighter: its original plus the skins you own. */
export function looksOwned(c: CharacterId, owned: readonly string[]) {
  const skins = CHAMPION_SKINS.filter((s) => s.champion === c);
  return {
    have: 1 + skins.filter((s) => owned.includes(s.id)).length,
    all: 1 + skins.length,
  };
}
/** The cards shown, filtered and sorted (stable within equal keys). */
export function rosterOrder(view: RosterView, d: RosterData) {
  const by = {
    mastery: (a: CharacterId, b: CharacterId) =>
      d.matches(b) - d.matches(a) ||
      CHARACTERS[a].name.localeCompare(CHARACTERS[b].name),
    name: (a: CharacterId, b: CharacterId) =>
      CHARACTERS[a].name.localeCompare(CHARACTERS[b].name),
    element: (a: CharacterId, b: CharacterId) =>
      ELEMENTS.indexOf(CHARACTERS[a].element) -
        ELEMENTS.indexOf(CHARACTERS[b].element) ||
      CHARACTERS[a].name.localeCompare(CHARACTERS[b].name),
  }[view.sort];
  return FIGHTERS.filter(
    (c) =>
      (view.element === "All" || CHARACTERS[c].element === view.element) &&
      (view.range === "any" || attackRange(c) === view.range),
  ).sort(by);
}
/** Mastery: the tier reached, progress to the next and what it needs. */
export function mastery(matches: number) {
  const tier = masteryTier(matches);
  const next = nextMastery(matches);
  const from = tier?.matches ?? 0;
  const progress = next
    ? Math.min(100, (100 * (matches - from)) / (next.matches - from))
    : 100;
  return {
    tier,
    next,
    progress,
    label: next
      ? `${tier?.name ?? "New"} · ${next.name} in ${next.left} match${next.left === 1 ? "" : "es"}`
      : `${tier!.name} · maximum mastery`,
  };
}
/** Health, speed and basic damage per second, with the roster's maxima. */
export function fighterStats(c: CharacterId) {
  const dps = (id: CharacterId) =>
    Math.round(
      CHARACTERS[id].basic.damage / (CHARACTERS[id].basic.interval ?? 0.3),
    );
  const max = (f: (id: CharacterId) => number) => Math.max(...FIGHTERS.map(f));
  return [
    ["Health", CHARACTERS[c].health, max((id) => CHARACTERS[id].health)],
    ["Speed", CHARACTERS[c].speed, max((id) => CHARACTERS[id].speed)],
    ["Basic DPS", dps(c), max(dps)],
  ] as const;
}
/** The fighter's tricks against raid bosses (RAID_BOSS_PERKS). */
export function raidTricks(c: CharacterId) {
  return (
    Object.entries(RAID_BOSS_PERKS) as [
      RaidBossId,
      (typeof RAID_BOSS_PERKS)[RaidBossId],
    ][]
  )
    .filter(([, perks]) => perks?.[c])
    .map(([boss, perks]) => ({
      boss: RAID_BOSSES[boss].name,
      ...perks![c]!,
    }));
}

/* ---------------------------------------------------------- pieces */

function masteryRing(c: CharacterId, d: RosterData, size?: number) {
  const m = mastery(d.matches(c));
  return ring(
    m.progress,
    100,
    `<b class="ui-num">${m.tier ? m.tier.name[0] : "–"}</b>`,
    {
      label: `${m.tier?.name ?? "No"} mastery · ${d.matches(c)} matches${m.next ? ` · ${m.next.left} to ${m.next.name}` : ""}`,
      color: m.tier?.color ?? "var(--ui-faint)",
      size,
    },
  );
}
const rangeTag = (c: CharacterId) =>
  `<span class="ui-tag roster-range">${rangeName(c)}</span>`;
/**
 * Ranged or close, readable at a glance on every card, in its top-right
 * corner (where mastery was: the owner, 18 Nov; mastery stays on the
 * fighter's detail), drawn as the element badge beside it is: a solid
 * glyph on a tinted disc. On phones the card has no room for the words: a crosshair in sky blue, or an upright sword
 * in ember (upright and square: a slanted line in a circle reads as "no").
 */
const RANGE_ICONS = {
  long: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/>',
  close:
    '<path d="M12 1.5 15 5.5V15H9V5.5Z" fill="currentColor"/><rect x="5.5" y="14.5" width="13" height="3" rx="1.5" fill="currentColor"/><rect x="10.7" y="17" width="2.6" height="3.6" fill="currentColor"/><circle cx="12" cy="21.4" r="1.6" fill="currentColor"/>',
} as const;
export const rangeBadge = (c: CharacterId) => {
  const r = attackRange(c) === "long" ? "long" : "close";
  return `<span class="roster-range-badge is-${r}" role="img" aria-label="${rangeName(c)}" title="${rangeName(c)}"><svg viewBox="0 0 24 24" aria-hidden="true">${RANGE_ICONS[r]}</svg></span>`;
};

/** A card's fighter as the Wardrobe dresses it: its skin, else your Colors. */
function cardArt(c: CharacterId, d: RosterData) {
  const skin = d.looks[c];
  const palette = !skin && d.look?.skin ? d.look.skin : "";
  const art = () => {
    const svg = fighterArt(c, undefined, skin);
    return palette ? colourPreview(svg, palette) : svg;
  };
  // One picture per fighter and look, drawn once (svgBackdrop): inline, the
  // grid's 18 fighters were 3,500 SVG elements (masks, gradients) built,
  // styled and laid out on every open, three quarters of a second on a 4×
  // slowed CPU (Nov 2026). The page's rule hiding the Cragstone reward's
  // cracks goes with the picture.
  return svgBackdrop(
    `roster-card ${c} ${skin ? JSON.stringify(skin) : ""} ${palette}`,
    () => art().replace(/<svg [^>]*>/, (open) => open + CARD_PAGE_RULES),
    c,
    () => {
      const svg = art();
      return palette ? scopeIds(svg, `card-${c}`) : svg;
    },
  );
}
const CARD_PAGE_RULES = "<style>.crag-cracks{display:none}</style>";
/** The teammate who locked in this fighter (it is theirs), if any. */
export const takenBy = (c: CharacterId, d: RosterData) => {
  const mate = d.room?.mates?.[c];
  return mate?.locked ? mate.name : undefined;
};
function card(c: CharacterId, view: RosterView, d: RosterData) {
  const f = CHARACTERS[c];
  const looks = looksOwned(c, d.owned);
  const playing = c === d.playing && d.room?.locked !== false;
  const mate = d.room?.mates?.[c];
  const taken = takenBy(c, d);
  const label = `${f.name}, ${f.element}, ${rangeName(c)}, ${f.role}${playing ? ", playing" : ""}${taken ? `, picked by ${taken}` : mate ? `, ${mate.name} is looking at it` : ""}`;
  // Your teammate's name on the fighter they're looking at or locked in.
  const badge = mate
    ? `<span class="roster-mate${mate.locked ? " is-locked" : ""}">${esc(mate.name)}</span>`
    : "";
  const foot = taken
    ? `${rangeTag(c)}${tag("Taken")}`
    : `${rangeTag(c)}<span class="ui-note">${looks.have}/${looks.all} looks</span>${playing ? (d.room ? `<span class="ui-tag roster-locked">Locked</span>` : tag("Playing", "ok")) : ""}`;
  return `<button type="button" class="roster-card${taken ? " is-taken" : ""}" data-roster-card="${c}" aria-pressed="${c === view.focus}" aria-label="${esc(label)}" style="--el:${elVar(c)}"><span class="roster-card-top">${elementTag(f.element)}${badge}${rangeBadge(c)}</span><span class="roster-card-art">${cardArt(c, d)}</span><span class="roster-card-text"><b class="roster-card-name">${esc(f.name)}</b><small>${esc(f.role)}</small></span><span class="roster-card-foot">${foot}</span></button>`;
}

function filters(view: RosterView) {
  const chip = (id: string, label: string, inner: string, color = "") =>
    `<button type="button" class="ui-chip roster-el" data-roster-element="${esc(id)}" aria-pressed="${view.element === id}" aria-label="${esc(label)}" title="${esc(label)}"${color ? ` style="--el:${color}"` : ""}>${inner}</button>`;
  const elements = `<div class="ui-chips roster-elements" role="group" aria-label="Element">${chip("All", "All elements", "All")}${ELEMENTS.map((e) => chip(e, `${e} fighters`, elementIcon(e), `var(--el-${e.toLowerCase()})`)).join("")}</div>`;
  const range = `<div class="ui-seg roster-ranges" role="group" aria-label="Range">${(
    [
      ["any", "Any range"],
      ["long", "Ranged"],
      ["close", "Close"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button type="button" aria-pressed="${view.range === id}" data-roster-range="${id}">${label}</button>`,
    )
    .join("")}</div>`;
  const sort = `<label class="roster-sort"><span>Sort</span><select data-roster-sort aria-label="Sort fighters">${(
    [
      ["mastery", "Mastery"],
      ["name", "Name"],
      ["element", "Element"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<option value="${id}"${view.sort === id ? " selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label>`;
  return `<div class="roster-tools">${elements}${range}${sort}</div>`;
}

/* ------------------------------------------------------------ grid */

/** A room's two buttons for the fighter shown: Lock in, then Ready. */
function roomButtons(c: CharacterId, d: RosterData) {
  const r = d.room!;
  const locked = c === d.playing && !r.saving && r.locked !== false;
  // Your teammate locked this one in: it's theirs (2v2).
  const taken = !locked && !!takenBy(c, d);
  const word = r.saving
    ? "Confirming…"
    : locked
      ? "Locked in"
      : taken
        ? "Taken"
        : "Lock in";
  return [
    button(word, {
      // A padlock to lock in (the seat's Locked tag shows the same one),
      // a tick once it is.
      icon: locked ? "check" : r.saving || taken ? undefined : "lock",
      disabled: locked || taken || r.saving || r.ready,
      attrs: {
        "data-roster-select": c,
        "aria-label": `${word.replace("…", "")} ${CHARACTERS[c].name}`,
      },
    }),
    button(r.ready ? "Cancel ready" : "Ready", {
      kind: "primary",
      icon: r.ready ? undefined : "battle",
      disabled: !r.canReady || (taken && !r.ready),
      attrs: { id: "ready", "data-roster-ready": c },
    }),
  ];
}
/** The corner button: back to the Lobby, or (in a room) leave the room. */
const cornerButton = (d: RosterData) =>
  d.room
    ? iconButton("leave", "Leave the room", {
        class: "ui-close is-danger",
        id: "leave",
        "data-roster-leave": true,
      })
    : iconButton("cancel", "Back to the Lobby", {
        class: "ui-close",
        "data-ui-close": true,
      });

function gridMarkup(view: RosterView, d: RosterData) {
  const cards = rosterOrder(view, d);
  const focus = CHARACTERS[view.focus];
  const body = cards.length
    ? `<div class="ui-grid roster-grid" role="group" aria-label="Fighters">${cards.map((c) => card(c, view, d)).join("")}</div>`
    : `<div class="ui-empty" role="status"><b>No fighters match</b><span>Try another element or range.</span>${button("Show all", { size: "s", attrs: { "data-roster-reset": true } })}</div>`;
  const lock = d.action === "lock";
  const chosen = view.focus === d.playing && d.room?.locked !== false;
  const taken = d.room && !chosen ? takenBy(view.focus, d) : undefined;
  // Nothing shown (a filter): nothing to act on either.
  const none = !cards.length;
  const status = d.room
    ? d.room.ready
      ? "Ready · waiting…"
      : d.room.saving && view.focus === d.playing
        ? "Locking in…"
        : chosen
          ? "Locked in"
          : taken
            ? `Taken by ${taken}`
            : "Lock in to play"
    : chosen
      ? "You play as"
      : "Picked";
  const foot = actionBar(
    `${avatar(fighterAvatar(view.focus, "roster-foot", d.looks[view.focus]), { element: focus.element })}<span class="roster-foot-text"><small class="ui-note">${esc(status)}</small><span class="roster-foot-name"><b class="ui-h">${esc(focus.name)}</b>${rangeBadge(view.focus)}<small class="roster-foot-range">${rangeName(view.focus)}</small></span></span>`,
    actions(
      button("Details", {
        icon: "info",
        disabled: none,
        attrs: { "data-roster-details": view.focus },
      }),
      ...(d.room
        ? roomButtons(view.focus, d)
        : [
            button(lock ? "Lock in" : chosen ? "Playing" : "Select", {
              kind: "primary",
              icon: lock ? "lock" : "check",
              disabled: none || (!lock && chosen),
              attrs: { "data-roster-select": view.focus },
            }),
          ]),
    ),
  );
  const heading = d.room
    ? `<span class="ui-kicker">${esc(d.room.kicker)}</span><h2 class="ui-title">Fighters</h2>`
    : `<span class="ui-kicker">Your roster · ${FIGHTERS.length} fighters</span><h2 class="ui-title">Fighters</h2>`;
  return `<section class="ui-panel roster-room${d.room ? " is-room" : ""}" role="dialog" aria-label="${d.room ? "Choose your fighter" : "Fighters"}" data-roster-mode="grid"><header class="ui-panel-head roster-head"><div class="ui-heading">${heading}</div>${filters(view)}${cornerButton(d)}</header><div class="ui-panel-body roster-body" data-roster-region="body">${body}</div>${foot}</section>`;
}

/* ---------------------------------------------------------- detail */

function stage(view: RosterView, d: RosterData) {
  const c = view.focus;
  const f = CHARACTERS[c];
  const worn = d.looks[c];
  const index = FIGHTERS.indexOf(c) + 1;
  const stats = fighterStats(c)
    .map(
      ([label, value, max]) =>
        `<div class="roster-stat"><span>${label}</span>${bar(value, max, { label, color: elVar(c), thick: true })}<b class="ui-num">${value}</b></div>`,
    )
    .join("");
  return `<section class="ui-split-stage roster-stage" style="--el:${elVar(c)}" aria-label="${esc(f.name)}" data-roster-region="stage"><div class="fighter-rig-stage roster-rig${d.low ? " is-still" : ""}" data-preview-champion="${c}" data-preview-item="${esc(worn?.skin ?? "")}" data-preview-stage="${worn?.stage ?? 1}" data-preview-look="${previewLook(d.look ?? {})}" data-preview-action="idle" role="img" aria-label="${esc(f.name)}">${stageLight(RIG_FRAME, "roster")}${fighterStageArt(c, "roster", worn, d.look ?? {})}</div><div class="roster-stage-top"><span class="roster-counter ui-num">${String(index).padStart(2, "0")}<small>/${String(FIGHTERS.length).padStart(2, "0")}</small></span>${masteryRing(c, d, 40)}</div><button type="button" class="ui-icon-btn roster-step roster-prev" data-roster-step="-1" aria-label="Previous fighter">‹</button><button type="button" class="ui-icon-btn roster-step roster-next" data-roster-step="1" aria-label="Next fighter">›</button><div class="roster-stage-info"><div class="roster-plate"><span class="roster-row">${elementTag(f.element)}${rangeTag(c)}</span><b class="roster-stage-name">${esc(f.name)}</b><small class="ui-note roster-stage-role">${esc(f.role)}</small></div><div class="roster-stats">${stats}</div></div></section>`;
}

/** One skill (or the basic attack) as a row: key, icon, name, text, cooldown. */
function skillRow(view: RosterView, d: RosterData, i: number | "basic") {
  const f = CHARACTERS[view.focus];
  const s = i === "basic" ? f.basic : f.skills[i];
  const key = i === "basic" ? d.keys.basic : d.keys.skills[i];
  const cd =
    i === "basic"
      ? "Basic"
      : i === ULT_SLOT
        ? "Ultimate"
        : `${f.skills[i].cooldown}s`;
  return `<button type="button" class="roster-skill" data-roster-skill="${i}" aria-pressed="${view.skill === i}"><span class="roster-key">${esc(key)}</span><span class="roster-skill-icon">${abilityIcon(s.name)}</span><span class="roster-skill-text"><b>${esc(s.name)}</b><small>${esc(s.description)}</small></span><span class="roster-cd ui-num">${cd}</span></button>`;
}
function skillsTab(view: RosterView, d: RosterData) {
  const f = CHARACTERS[view.focus];
  const i = view.skill;
  const s = i === "basic" ? f.basic : f.skills[i];
  const key = i === "basic" ? d.keys.basic : d.keys.skills[i];
  const when =
    i === "basic"
      ? `no cooldown · ${Math.round((f.basic.interval ?? 0.3) * 1000)} ms between attacks · ${f.basic.damage} damage`
      : i === ULT_SLOT
        ? "Ultimate"
        : `${f.skills[i].cooldown}s cooldown`;
  const tricks = raidTricks(view.focus);
  const combo = COMBOS[view.focus];
  // The combo sits under the basic attack: it is how the skills above chain.
  return `<div class="roster-skill-big" aria-live="polite"><span class="roster-skill-art">${abilityIcon(s.name)}</span><span class="roster-skill-big-text"><span class="ui-kicker">${esc(key)} · ${esc(when)}</span><b class="ui-h">${esc(s.name)}</b><p class="ui-note">${esc(s.description)}</p></span></div><div class="roster-skills" role="group" aria-label="Skills">${[0, 1, 2, 3].map((n) => skillRow(view, d, n)).join("")}${skillRow(view, d, "basic")}</div><div class="roster-combo" role="note" aria-label="Combo: ${esc(combo.name)}"><span class="roster-combo-tag">Combo</span><span class="roster-combo-text"><b>${esc(combo.name)}</b><small>${esc(combo.text)}</small></span></div>${
    tricks.length
      ? `<div class="roster-tricks"><span class="ui-kicker">Raid tricks</span>${tricks.map((t) => `<span class="roster-trick"><b>${esc(t.boss)}</b> · ${esc(t.skill)}: ${esc(t.text)}</span>`).join("")}</div>`
      : ""
  }`;
}
function overviewTab(view: RosterView, d: RosterData) {
  const c = view.focus;
  const f = CHARACTERS[c];
  const m = mastery(d.matches(c));
  // The combo is on the Skills tab, under the basic attack.
  return `<p class="roster-bio">${esc(f.description)}</p><div class="roster-facts"><div class="roster-fact"><span class="ui-kicker">Mastery</span><b class="ui-h" style="color:${m.tier?.color ?? "var(--ui-text)"}">${esc(m.tier?.name ?? "New challenger")}</b><p class="ui-note">${d.matches(c)} matches · ${esc(m.next ? `${m.next.left} more to ${m.next.name}` : "maximum mastery")}</p>${bar(m.progress, 100, { label: "Mastery progress", color: m.next?.color ?? m.tier?.color })}</div><div class="roster-fact"><span class="ui-kicker">Basic attack</span><b class="ui-h">${esc(f.basic.name)}</b><p class="ui-note">${esc(f.basic.description)} ${rangeName(c)} · ${f.basic.damage} damage.</p></div>${f.passive ? `<div class="roster-fact roster-passive"><span class="ui-kicker">Passive</span><b class="ui-h">${esc(PASSIVES[f.passive].name)}</b><p class="ui-note">${esc(PASSIVES[f.passive].text)}</p></div>` : ""}</div><p class="ui-note roster-universal">Every fighter shares one <b>dash</b> (${esc(d.keys.dash)}) and one <b>jump</b> (${esc(d.keys.jump)}). Jump clears ground attacks.</p>`;
}
function skinsTab(view: RosterView, d: RosterData) {
  const c = view.focus;
  const skins = CHAMPION_SKINS.filter((s) => s.champion === c);
  const worn = d.looks[c]?.skin;
  const tile = (
    id: string,
    name: string,
    art: string,
    have: boolean,
    on: boolean,
  ) =>
    `<span class="roster-look${have ? "" : " is-unowned"}"><span class="roster-look-art">${art}</span><b>${esc(name)}</b><small class="${on ? "is-on" : ""}">${on ? "Wearing" : have ? "Owned" : "In the Shop"}</small></span>`;
  return `<p class="ui-note">${looksOwned(c, d.owned).have} of ${skins.length + 1} looks owned. Try them all on in the Shop and Wardrobe.</p><div class="roster-looks">${tile("original", "Original look", originalLook(c, "roster-look-original"), true, !worn)}${skins.map((s) => tile(s.id, s.name, itemPicture(s.id, c, `roster-look-${s.id}`), d.owned.includes(s.id), worn === s.id)).join("")}</div>`;
}
function detailMarkup(view: RosterView, d: RosterData) {
  const c = view.focus;
  const f = CHARACTERS[c];
  const looks = looksOwned(c, d.owned);
  const lock = d.action === "lock";
  const chosen = c === d.playing;
  const m = mastery(d.matches(c));
  const tabRow = tabs(
    [
      { id: "overview", label: "Overview", selected: view.tab === "overview" },
      { id: "skills", label: "Skills", selected: view.tab === "skills" },
      {
        id: "skins",
        label: "Skins",
        selected: view.tab === "skins",
        count: `${looks.have}/${looks.all}`,
      },
    ],
    `${f.name}`,
    "rtab",
  );
  const body = { overview: overviewTab, skills: skillsTab, skins: skinsTab }[
    view.tab
  ](view, d);
  const foot = actionBar(
    `<span class="roster-foot-text"><small class="ui-note">Mastery · ${esc(m.label)}</small>${bar(m.progress, 100, { label: "Mastery progress", color: m.tier?.color })}</span>`,
    d.room
      ? actions(...roomButtons(c, d))
      : actions(
          button("Try skins", {
            icon: "wardrobe",
            attrs: { "data-roster-skins": c },
          }),
          button(lock ? "Lock in" : chosen ? "Playing" : "Select", {
            kind: "primary",
            icon: lock ? "lock" : "check",
            disabled: !lock && chosen,
            attrs: { "data-roster-select": c },
          }),
        ),
  );
  return `<section class="ui-panel is-split roster-room${d.room ? " is-room" : ""}" role="dialog" aria-label="${esc(f.name)}" data-roster-mode="detail">${stage(view, d)}<div class="ui-split-main"><header class="ui-panel-head roster-head">${button("Roster", { size: "s", icon: "back", attrs: { "data-roster-back": true } })}${view.tab === "overview" ? "" : `<span class="ui-note roster-hint">${esc(f.description)}</span>`}${cornerButton(d)}</header>${tabRow}<div class="ui-panel-body roster-body" data-roster-region="body"${attrs({ "data-tab": view.tab })}>${body}</div>${foot}</div></section>`;
}

/** The whole screen: the grid, or one fighter on the stage. */
export function rosterMarkup(view: RosterView, d: RosterData) {
  return view.mode === "grid" ? gridMarkup(view, d) : detailMarkup(view, d);
}
/** The next fighter in the roster order shown (wrapping), for ‹ ›. */
export function stepFighter(view: RosterView, d: RosterData, by: number) {
  const order = rosterOrder({ ...view, element: "All", range: "any" }, d);
  const i = order.indexOf(view.focus);
  return order[(i + by + order.length) % order.length];
}
