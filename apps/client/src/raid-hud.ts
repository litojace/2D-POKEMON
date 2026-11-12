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
import { RAID_BOSSES } from "../../../packages/shared/src/raid";
import type { Fighter, Snapshot } from "@arena/shared";

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
}

/** Everything the HUD shows for this snapshot. Moves the damage trails along. */
export function raidHudView(state: Snapshot, me: Fighter): RaidHudView {
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
    title: `${r.gilded ? "✦ GILDED " : ""}${RAID_BOSSES[r.boss].name.toUpperCase()}${!stormTwins && (exposed || r.staggerUntil > state.time || r.permanentGround) ? " · EXPOSED" : ""}${(r.enrage ?? 0) > 0 ? ` · FURIOUS${r.enrage! > 1 ? ` ×${r.enrage}` : ""}` : ""}`,
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
                ((r.lightHold ?? 0) /
                  (r.phase === 3 && r.partySize === 1 ? 2 : 0.65)) *
                  100,
              )
          : r.staggerUntil > state.time
            ? 100
            : r.stagger,
    staggerLabel:
      r.boss === "emberwing"
        ? r.permanentGround
          ? "WINGS BROKEN · HEART OPEN"
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
  return `<div class="raid-boss-heading"><b data-hud="title"></b><span class="raid-boss-phase" data-hud="phase"></span></div>${twins}<div class="raid-boss-health" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="100" data-hud="health"><i class="raid-boss-trail" data-hud="trail"></i><i class="raid-boss-fill" data-hud="fill"></i>${MARKS.map((mark, i) => `<span class="raid-health-mark" style="left:${mark}%" aria-hidden="true" data-hud="mark${i}"></span>`).join("")}<span class="raid-boss-pct" aria-hidden="true" data-hud="pct"></span></div><div class="raid-stagger"${view.stormTwins ? " hidden" : ""}><i data-hud="stagger"></i><span data-hud="stagger-label"></span></div><div class="raid-status-row"><p class="raid-callout" role="status" data-hud="cue"></p><div class="raid-elapsed" role="timer" aria-label="Raid elapsed time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><b data-hud="elapsed"></b></div></div>`;
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
  write(m, "phase", "text", `Phase ${view.phase}/3`);
  write(m, "phase", "aria-label", `Phase ${view.phase} of 3`);
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
    `${rounded}% health. Rite choices open at 67% and 33% health.`,
  );
  write(m, "trail", "width", `${view.trail}%`);
  write(m, "fill", "width", `${view.health}%`);
  MARKS.forEach((_, i) =>
    write(m, `mark${i}`, "passed", view.phase > i + 1 ? "1" : ""),
  );
  write(m, "pct", "text", `${Math.ceil(view.health)}%`);
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
