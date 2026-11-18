/**
 * The boss HUD at the top of a raid: name, phase, health with its damage
 * trail and rite marks, the stagger (or brazier / light relay) meter, the
 * callout and the clock. Storm Twins add one bar per twin.
 *
 * Snapshots arrive about 15 times a second. The HUD's structure only changes
 * with the boss (and, for the Storm Twins, the twins), so it is built once
 * per boss and later snapshots write only the text, attributes, classes and
 * widths that changed. The callout keeps its `role="status"` element, so a
 * screen reader announces a new cue instead of a region being swapped out.
 */
import { healthTrail } from "./raid-health-trail";
import { twinBars, type TwinBarView } from "./storm-twins-controls";
import { raidCue } from "./raid-presentation";
import {
  RAID_BOSSES,
  prismRelayHold,
  raidBossName,
} from "../../../packages/shared/src/raid";
import type { Fighter, Snapshot } from "@arena/shared";
import {
  spireCue,
  spireFloorProgress,
  spireHudLine,
  spireWaveLabel,
} from "./spire-battle";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const time = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
/** Phase thresholds on the health bar (rite choices open there). */
const MARKS = [67, 33] as const;
const TWIN_COLOURS = ["#ffe18b", "#8edfff"] as const;

export interface RaidHudView {
  /** What the HUD's structure depends on: rebuilt when this changes. */
  key: string;
  stormTwins: boolean;
  title: string;
  phase: number;
  health: number;
  trail: number;
  stagger: number;
  staggerLabel: string;
  cue: string;
  elapsed: string;
  twins: TwinBarView[];
  /**
   * The Spire: its line ("Floor 7 · Wave 2/3 · 2 Echoes") replaces the phase.
   * A wave floor's bar is the floor's progress, one slice per wave, labelled
   * "Wave 2/3" (not a health bar: it fills as the Echoes fall).
   */
  spire?: {
    line: string;
    bar: "floor" | "elite" | "boss";
    wave?: number;
    waves?: number;
    label?: string;
  };
}

/** Everything the HUD shows for this snapshot. Moves the damage trails along. */
export function raidHudView(state: Snapshot, me: Fighter): RaidHudView {
  const climb = state.raid?.spire;
  if (climb && climb.kind !== "boss") return spireHudView(state);
  const r = state.raid!,
    boss = state.players.find((p) => p.id === r.bossId),
    stormTwins = r.boss === "storm-twins";
  const twins = stormTwins ? twinBars(state) : [];
  const health = Math.max(
    0,
    Math.min(
      100,
      ((stormTwins
        ? state.players
            .filter((p) => p.raidBoss)
            .reduce((sum, p) => sum + Math.max(0, p.hp), 0)
        : (boss?.hp ?? 0)) /
        r.maxHp) *
        100,
    ),
  );
  const exposed = r.exposedUntil > state.time;
  const lit =
    r.boss === "emberwing"
      ? (r.braziers ?? []).filter((b) => b.litUntil > state.time).length
      : 0;
  return {
    key: `${r.boss}|${twins.map((t) => `${t.id}:${t.name}`).join(",")}`,
    stormTwins,
    title: `${r.gilded ? "✦ GILDED " : ""}${raidBossName(r).toUpperCase()}${!stormTwins && (exposed || r.staggerUntil > state.time || r.permanentGround) ? " · EXPOSED" : ""}${(r.enrage ?? 0) > 0 ? " · FURIOUS" : ""}`,
    phase: r.phase,
    health,
    trail: healthTrail(`raid:${r.boss}`, health),
    stagger:
      r.boss === "emberwing"
        ? r.permanentGround || exposed
          ? 100
          : r.airborne
            ? (lit / 3) * 100
            : r.stagger
        : r.boss === "prismatail"
          ? exposed
            ? 100
            : Math.min(
                100,
                ((r.lightHold ?? 0) / prismRelayHold(r.phase, r.partySize)) *
                  100,
              )
          : r.staggerUntil > state.time
            ? 100
            : r.stagger,
    staggerLabel:
      r.boss === "emberwing"
        ? r.permanentGround
          ? "PAPER TORN · HEART OPEN"
          : r.airborne
            ? `AIRBORNE · ${lit}/3 BRAZIERS`
            : exposed
              ? "GROUNDED · HEART EXPOSED"
              : "STAGGER"
        : r.boss === "prismatail"
          ? exposed
            ? "HEART EXPOSED"
            : "LIGHT RELAY · SHIELDED"
          : r.staggerUntil > state.time
            ? "STAGGER · CORE EXPOSED"
            : "STAGGER",
    cue: raidCue(state, me.id),
    elapsed: time(r.elapsed),
    twins,
    // The Spire's boss floor: the raid's boss bar, the floor and its clock.
    ...(climb
      ? {
          key: `spire|boss|${r.boss}|${twins.map((t) => t.id).join(",")}`,
          cue:
            climb.clearedAt !== undefined
              ? spireCue(state)
              : raidCue(state, me.id),
          elapsed: time(Math.max(0, climb.limit - r.elapsed)),
          spire: {
            line: `Floor ${climb.floor} · Phase ${r.phase}/3`,
            bar: "boss" as const,
          },
        }
      : {}),
  };
}

/**
 * The Spire's HUD: wave floors show the floor's progress (no boss); the
 * elite keeps a boss bar and its stagger.
 */
export function spireHudView(state: Snapshot): RaidHudView {
  const r = state.raid!,
    s = r.spire!,
    elite =
      s.kind === "elite"
        ? state.players.find((p) => p.id === s.eliteId)
        : undefined;
  const health = elite
    ? Math.max(
        0,
        Math.min(100, (Math.max(0, elite.hp) / Math.max(1, r.maxHp)) * 100),
      )
    : spireFloorProgress(state);
  return {
    key: `spire|${s.kind}|${elite ? "elite" : `floor|${s.waves}`}`,
    stormTwins: false,
    title: elite
      ? `FLOOR ${s.floor} · ${elite.name.toUpperCase()}`
      : `THE SPIRE · FLOOR ${s.floor}`,
    phase: 1,
    health,
    trail: healthTrail(elite ? `spire:elite` : `spire:floor`, health),
    stagger: r.staggerUntil > state.time ? 100 : r.stagger,
    staggerLabel:
      r.staggerUntil > state.time ? "REELING · HIT IT NOW" : "STAGGER",
    cue: spireCue(state),
    elapsed: time(Math.max(0, s.limit - r.elapsed)),
    twins: [],
    spire: elite
      ? { line: spireHudLine(state), bar: "elite" }
      : {
          line: spireHudLine(state),
          bar: "floor",
          wave: Math.min(s.waves, Math.max(1, s.wave)),
          waves: s.waves,
          label: spireWaveLabel(state),
        },
  };
}

/** The HUD's structure for a boss: values are filled in by `paintRaidHud`. */
function skeleton(view: RaidHudView) {
  const twins = view.stormTwins
    ? `<div class="raid-twin-health">${view.twins
        .map((t, i) => {
          const name = escape(t.name);
          return `<div class="raid-twin-bar" style="--twin-color:${TWIN_COLOURS[i ? 1 : 0]}"><div><b>${name}</b><span data-hud="t${i}-status"></span></div><div class="raid-twin-track" role="progressbar" aria-label="${name} health" aria-valuemin="0" aria-valuemax="100" data-hud="t${i}-track"><i class="raid-boss-trail" data-hud="t${i}-trail"></i><i class="raid-boss-fill" data-hud="t${i}-fill"></i><span class="raid-boss-pct" aria-hidden="true" data-hud="t${i}-pct"></span></div><div class="raid-twin-stagger" title="${name} stagger"><i data-hud="t${i}-stagger"></i></div></div>`;
        })
        .join("")}</div>`
    : "";
  const spire = view.spire;
  // A wave floor's bar: a divider where each wave's slice ends.
  const waveMarks =
    spire?.bar === "floor"
      ? Array.from(
          { length: Math.max(0, (spire.waves ?? 0) - 1) },
          (_, i) =>
            `<span class="raid-health-mark spire-wave-mark" style="left:${(((i + 1) / spire.waves!) * 100).toFixed(3)}%" aria-hidden="true" data-hud="wave${i}"></span>`,
        ).join("")
      : "";
  return `<div class="raid-boss-heading"><b data-hud="title"></b><span class="raid-boss-phase" data-hud="phase"></span></div>${twins}<div class="raid-boss-health${spire?.bar === "floor" ? " is-spire-floor" : ""}" role="progressbar" aria-label="${spire?.bar === "floor" ? "Floor progress" : "Boss health"}" aria-valuemin="0" aria-valuemax="100" data-hud="health"><i class="raid-boss-trail" data-hud="trail"></i><i class="raid-boss-fill" data-hud="fill"></i>${waveMarks}${spire && spire.bar !== "boss" ? "" : MARKS.map((mark, i) => `<span class="raid-health-mark" style="left:${mark}%" aria-hidden="true" data-hud="mark${i}"></span>`).join("")}<span class="raid-boss-pct" aria-hidden="true" data-hud="pct"></span></div><div class="raid-stagger"${view.stormTwins || spire?.bar === "floor" ? " hidden" : ""}><i data-hud="stagger"></i><span data-hud="stagger-label"></span></div><div class="raid-status-row"><p class="raid-callout" role="status" data-hud="cue"></p><div class="raid-elapsed" role="timer" aria-label="${spire ? "Time left on this floor" : "Raid elapsed time"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><b data-hud="elapsed"></b></div></div>`;
}

interface Mounted {
  hud: HTMLElement;
  key: string;
  /** The HUD's first child when built: another owner replacing it shows here. */
  first: Element | null;
  parts: Map<string, HTMLElement>;
  /** Last value written per part and property. */
  written: Map<string, string>;
}
let mounted: Mounted | undefined;

function write(
  m: Mounted,
  part: string,
  property: string,
  value: string,
): void {
  const id = `${part} ${property}`;
  if (m.written.get(id) === value) return;
  const el = m.parts.get(part);
  if (!el) return;
  m.written.set(id, value);
  if (property === "text") el.textContent = value;
  else if (property === "width") el.style.width = value;
  else if (property === "passed") el.classList.toggle("is-passed", !!value);
  else el.setAttribute(property, value);
}

/**
 * Show the view in the HUD element. Builds the structure when the element,
 * the boss or the twins changed (or other code replaced the insides), and
 * otherwise touches only what changed. Returns whether it was rebuilt.
 */
export function paintRaidHud(hud: HTMLElement, view: RaidHudView): boolean {
  let m = mounted;
  const rebuild =
    !m ||
    m.hud !== hud ||
    m.key !== view.key ||
    hud.firstElementChild !== m.first;
  if (rebuild) {
    hud.innerHTML = skeleton(view);
    const parts = new Map<string, HTMLElement>();
    for (const el of Array.from(
      hud.querySelectorAll<HTMLElement>("[data-hud]"),
    ))
      parts.set(el.dataset.hud!, el);
    m = mounted = {
      hud,
      key: view.key,
      first: hud.firstElementChild,
      parts,
      written: new Map(),
    };
  }
  m = m!;
  write(m, "title", "text", view.title);
  write(m, "phase", "text", view.spire?.line ?? `Phase ${view.phase}/3`);
  write(
    m,
    "phase",
    "aria-label",
    view.spire?.line ?? `Phase ${view.phase} of 3`,
  );
  view.twins.forEach((t, i) => {
    write(m, `t${i}-status`, "text", t.status);
    write(m, `t${i}-track`, "aria-valuenow", `${Math.round(t.percent)}`);
    write(m, `t${i}-trail`, "width", `${t.trail}%`);
    write(m, `t${i}-fill`, "width", `${t.percent}%`);
    write(m, `t${i}-pct`, "text", `${Math.ceil(t.percent)}%`);
    write(m, `t${i}-stagger`, "width", `${t.stagger}%`);
  });
  const rounded = Math.round(view.health);
  write(m, "health", "aria-valuenow", `${rounded}`);
  write(
    m,
    "health",
    "aria-valuetext",
    view.spire?.bar === "floor"
      ? `${view.spire.label}: ${rounded}% of the floor beaten.`
      : view.spire
        ? `${rounded}% health.`
        : `${rounded}% health. Rite choices open at 67% and 33% health.`,
  );
  write(m, "trail", "width", `${view.trail}%`);
  write(m, "fill", "width", `${view.health}%`);
  MARKS.forEach((_, i) =>
    write(m, `mark${i}`, "passed", view.phase > i + 1 ? "1" : ""),
  );
  // A wave floor's bar counts waves, not health.
  for (let i = 0; i < (view.spire?.waves ?? 1) - 1; i++)
    write(m, `wave${i}`, "passed", (view.spire?.wave ?? 1) > i + 1 ? "1" : "");
  write(m, "pct", "text", view.spire?.label ?? `${Math.ceil(view.health)}%`);
  write(m, "stagger", "width", `${view.stagger}%`);
  write(m, "stagger-label", "text", view.staggerLabel);
  write(m, "cue", "text", view.cue);
  write(m, "cue", "title", view.cue);
  write(m, "elapsed", "text", view.elapsed);
  return rebuild;
}

/** Forget the built HUD (tests; a fresh element is rebuilt anyway). */
export function resetRaidHud() {
  mounted = undefined;
}
