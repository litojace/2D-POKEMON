import { menuIcon } from "./menu-icons";
import { fighterPack } from "./animation/pack-config";
import { CHARACTERS, COMBOS, ULT_SLOT, type CharacterId } from "@arena/shared";
import { actionLabel, controlPrefs, skillLabels } from "./controls";
import { fighterArt, scopeIds, withSoftGround } from "./fighter-art";
import { abilityIcon } from "./ability-icons";
import { PLACEHOLDER_FIGHTERS } from "./creature-design";
import { elementIcon } from "./element-icons";
import { withAura } from "./trait-effects";
import {
  masteryTier,
  nextMastery,
} from "../../../packages/shared/src/accounts";
/** Reduced motion keeps the auras as still frames. */
const still = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Your equipped Shop skins, shown on the roster cards and detail art. */
let worn: Partial<Record<CharacterId, { skin: string; stage: number }>> = {};
export function setWornSkins(value: typeof worn | undefined) {
  worn = value ?? {};
}
function art(id: CharacterId, large = false, aura = false) {
  const pack = fighterPack(id);
  if (pack && pack.kind !== "layered")
    return `<img class="creature-portrait" loading="lazy" decoding="async" src="/assets/fighters/${id}/${large ? pack.selection : pack.portrait}" alt="${CHARACTERS[id].name}">`;
  // Card and detail portrait of the same fighter need their own ids.
  const svg = fighterArt(id, undefined, worn[id]);
  const framed = large ? withSoftGround(svg, id) : svg;
  return scopeIds(
    aura ? withAura(framed, id, still()) : framed,
    large ? "detail" : "card",
  );
}
/** Long range when the basic attack reaches across the arena, else close range. */
export function attackRange(id: CharacterId): "long" | "close" {
  return CHARACTERS[id].basic.range >= 400 ? "long" : "close";
}
const RANGE_ICONS = {
  long: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/><path d="M8 0v3M8 13v3M0 8h3M13 8h3" stroke="currentColor" stroke-width="1.6"/></svg>',
  close:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l1.6 4.2L14 4l-2.6 3.6L15 10l-4.4.4L10 15 8 11.4 6 15l-.6-4.6L1 10l3.6-2.4L2 4l4.4 1.2Z" fill="currentColor"/></svg>',
};
const rangeTag = (id: CharacterId) => {
  const r = attackRange(id);
  return `<span class="range-tag range-${r}" title="Basic attack: ${CHARACTERS[id].basic.name}">${RANGE_ICONS[r]}${r === "long" ? "Long range" : "Close range"}</span>`;
};
const placeholderBadge = (id: CharacterId, label = "PLACEHOLDER") =>
  PLACEHOLDER_FIGHTERS.includes(id)
    ? `<span class="art-placeholder" title="Generic stand-in until licensed artwork is added">${label}</span>`
    : "";
/** Your matches per fighter (from your records), for mastery badges. */
let mastery: Record<string, { matches: number; wins: number }> = {};
export function setMastery(
  value: Record<string, { matches: number; wins: number }>,
) {
  mastery = value;
}
/** Matches you've played with a fighter (0 until your records load). */
export function masteryMatches(id: CharacterId) {
  return mastery[id]?.matches ?? 0;
}
const masteryBadge = (id: CharacterId) => {
  const played = mastery[id]?.matches ?? 0;
  const tier = masteryTier(played);
  return tier
    ? `<span class="mastery-badge" style="--tier:${tier.color}" title="${tier.name} mastery · ${played} matches with ${CHARACTERS[id].name}">★ ${tier.name}</span>`
    : "";
};
/** Progress through the existing mastery milestones; no new progression rules. */
function masteryRing(id: CharacterId) {
  const played = masteryMatches(id),
    tier = masteryTier(played),
    next = nextMastery(played);
  const from = tier?.matches ?? 0;
  const progress = next
    ? Math.min(100, (100 * (played - from)) / (next.matches - from))
    : 100;
  return `<span class="fighter-mastery-ring" style="--mastery-progress:${progress}%;--tier:${tier?.color ?? "var(--accent)"}" role="img" aria-label="${tier?.name ?? "New challenger"} mastery · ${played} matches${next ? ` · ${next.left} to ${next.name}` : ""}"></span>`;
}
const displayedMastery = new WeakMap<HTMLElement, number>();
/** Records may arrive after the roster mounts; refresh every card without a tap. */
export function syncRosterMastery(root: ParentNode) {
  for (const card of Array.from(
    root.querySelectorAll<HTMLElement>(".showcase-roster [data-character]"),
  )) {
    const id = card.dataset.character as CharacterId;
    const matches = masteryMatches(id);
    if (displayedMastery.get(card) === matches) continue;
    const next = document.createElement("template");
    next.innerHTML = masteryRing(id);
    card.querySelector(".fighter-mastery-ring")?.replaceWith(next.content);
    next.innerHTML = masteryBadge(id);
    const badge = card.querySelector(".mastery-badge");
    if (badge) badge.replaceWith(next.content);
    else card.querySelector(".card-selection-label")?.before(next.content);
    displayedMastery.set(card, matches);
  }
  const detail = root.querySelector<HTMLElement>(".fighter-detail");
  const label = detail?.querySelector(".fighter-mastery-label");
  if (detail && label) {
    const id = detail.dataset.detailFor as CharacterId;
    const matches = masteryMatches(id);
    const next = nextMastery(matches);
    const text = `${matches} matches${next ? ` · ${next.left} to ${next.name}` : " · Maximum mastery"}`;
    if (label.textContent !== text) label.textContent = text;
    if (displayedMastery.get(detail) !== matches) {
      const footer = detail.querySelector(".champion-mastery");
      const name = footer?.querySelector<HTMLElement>("b");
      const tier = masteryTier(matches);
      if (name) {
        name.textContent = tier?.name ?? "New challenger";
        name.style.color = tier?.color ?? "var(--accent)";
      }
      const ring = document.createElement("template");
      ring.innerHTML = masteryRing(id);
      footer?.querySelector(".fighter-mastery-ring")?.replaceWith(ring.content);
      displayedMastery.set(detail, matches);
    }
  }
}
export function fighterSelection(selected: CharacterId, element = "All") {
  const bindings = controlPrefs().bindings;
  const skillKeys = skillLabels(bindings);
  const fighter = CHARACTERS[selected];
  const color = hex(fighter.color);
  const interval = Math.round((fighter.basic.interval ?? 0.3) * 1000);
  const fighters = Object.values(CHARACTERS);
  const cards = fighters
    .filter((c) => element === "All" || c.element === element)
    .map(
      (c) =>
        `<button type="button" class="creature-card showcase-card ${selected === c.id ? "selected" : ""}" style="--element:${hex(c.color)}" data-character="${c.id}" data-element="${c.element}" aria-label="Preview ${c.name}" aria-pressed="${selected === c.id}"><span class="card-head"><strong>${c.name}</strong><span class="element-pill">${elementIcon(c.element)}${c.element}</span></span><small class="card-role">${rangeTag(c.id)}<span>${c.role}</span></small><span class="card-art">${masteryRing(c.id)}${art(c.id, false, selected === c.id)}${placeholderBadge(c.id)}</span><span class="card-skills">${c.skills.map((a, i) => `<span title="${a.name}: ${a.description}">${abilityIcon(a.name)}<i>${i === ULT_SLOT ? "ULT" : `${a.cooldown}s`}</i></span>`).join("")}</span><span class="card-bottom"><span class="card-health">${c.health} HP</span>${masteryBadge(c.id)}<span class="card-selection-label">${selected === c.id ? "✓ Selected" : "Select"}</span></span></button>`,
    );
  const skills = fighter.skills
    .map(
      (a, i) =>
        `<div class="${i === ULT_SLOT ? "champion-ultimate-row" : ""}" data-kit-skill="${i}"><kbd>${skillKeys[i]}</kbd>${abilityIcon(a.name)}<span><strong>${a.name}</strong><small>${a.description}</small></span><b>${i === ULT_SLOT ? "Ultimate" : `${a.cooldown}s`}</b></div>`,
    )
    .join("");
  const combo = COMBOS[selected];
  const basicRow = `<div class="champion-basic-row" data-kit-skill="basic"><kbd>${actionLabel(bindings, "basic")}</kbd>${abilityIcon(fighter.basic.name)}<span><strong>${fighter.basic.name} <em>Basic attack</em></strong><small>${fighter.basic.description} No cooldown · ${interval} ms between attacks.</small></span><b>${fighter.basic.damage} dmg</b></div>`;
  const comboRow = `<div class="combo-description champion-combo-row" data-kit-skill="combo"><kbd>Combo</kbd><span class="champion-combo-spark" aria-hidden="true">✦</span><span><strong>${combo.name}</strong><small>${combo.text}</small></span></div>`;
  const statValues = [
    ["Health", fighter.health, Math.max(...fighters.map((c) => c.health))],
    ["Speed", fighter.speed, Math.max(...fighters.map((c) => c.speed))],
    [
      "Basic DPS",
      Math.round(fighter.basic.damage / (fighter.basic.interval ?? 0.3)),
      Math.max(
        ...fighters.map((c) =>
          Math.round(c.basic.damage / (c.basic.interval ?? 0.3)),
        ),
      ),
    ],
  ] as const;
  const stats = statValues
    .map(
      ([label, value, max]) =>
        `<div class="champion-stat"><span>${label}</span><span class="champion-stat-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><i style="width:${Math.round((value / max) * 100)}%"></i></span><b>${value}</b></div>`,
    )
    .join("");
  const played = masteryMatches(selected),
    tier = masteryTier(played),
    next = nextMastery(played);
  const detail = `<div class="fighter-detail" data-detail-for="${selected}" data-preview="overview" style="--element:${color}">
    <nav class="fighter-preview-tabs" aria-label="Fighter preview sections" hidden><button type="button" data-fighter-preview="overview" aria-pressed="true">‹ Overview</button><button type="button" data-fighter-preview="skills" aria-pressed="false">Full kit</button></nav>
    <div class="selected-fighter" style="--element:${color}">
      <div class="selected-art fighter-rig-stage" data-preview-champion="${selected}" data-preview-item="${worn[selected]?.skin ?? ""}" data-preview-stage="${worn[selected]?.stage ?? 1}" data-preview-look="%7B%7D" data-preview-action="idle" aria-label="${fighter.name} animated preview"><span class="champion-index"><b>${String(fighters.findIndex((c) => c.id === selected) + 1).padStart(2, "0")}</b> / ${String(fighters.length).padStart(2, "0")}</span>${art(selected, true, true)}${placeholderBadge(selected, "PLACEHOLDER ART")}<span class="champion-wordmark" aria-hidden="true">${fighter.name}</span><span class="selected-art-caption">${fighter.element} · ${fighter.role}</span></div>
      <div class="selected-info"><div class="champion-tags"><span class="element-pill">${elementIcon(fighter.element)}${fighter.element}</span><span>${attackRange(selected) === "long" ? "Ranged" : "Melee"}</span><span class="fighter-role-label">${fighter.role}</span></div><div class="champion-name-row"><h3>${fighter.name}</h3><button type="button" class="champion-bio-button" data-skill-inspect="bio" aria-label="About ${fighter.name}" aria-expanded="false">${menuIcon("help")}</button></div><p class="champion-bio">${fighter.description}</p><div class="fighter-stats">${stats}</div>
      <div class="champion-skill-buttons" aria-label="Inspect skills">${fighter.skills.map((a, i) => `<button type="button" data-skill-inspect="${i}" aria-label="${a.name}, ${i === ULT_SLOT ? "ultimate" : `${a.cooldown} second cooldown`}" aria-expanded="false" title="${a.name}"><kbd>${skillKeys[i]}</kbd>${abilityIcon(a.name)}<small>${i === ULT_SLOT ? "ULT" : `${a.cooldown}s`}</small></button>`).join("")}<button type="button" class="champion-full-kit" data-fighter-preview="skills">${menuIcon("missions")}<small>Full kit</small></button></div>
      <div class="champion-skill-tooltip" role="region" aria-label="Skill details" hidden><button type="button" data-skill-close aria-label="Close skill details">×</button><b data-skill-title></b><p data-skill-description></p></div>
      <div class="champion-basic-summary"><button type="button" class="basic-description" data-skill-inspect="basic" aria-expanded="false">${abilityIcon(fighter.basic.name)}<span class="basic-text"><b>${fighter.basic.name}</b><small>Basic attack · no cooldown</small></span></button><button type="button" class="champion-combo-button" data-skill-inspect="combo" aria-expanded="false">Combo · ${combo.name}</button></div></div>
    </div>
    <section class="skill-preview" tabindex="0" role="region" aria-label="${fighter.name} full kit and movement controls" style="--element:${color}" hidden><div class="skill-preview-heading"><h3>${fighter.name}</h3><span>Full kit</span></div><h4 class="champion-kit-heading">Skills &amp; combo</h4><div class="preview-skills">${skills}${basicRow}${comboRow}</div></section>
    <footer class="champion-actions"><div class="champion-mastery">${masteryRing(selected)}<div><b style="color:${tier?.color ?? "var(--accent)"}">${tier?.name ?? "New challenger"}</b><p class="fighter-mastery-label">${played} matches${next ? ` · ${next.left} to ${next.name}` : " · Maximum mastery"}</p></div></div><button type="button" class="primary btn-primary champion-lock" data-fighter-lock="${selected}" aria-label="Lock in ${fighter.name}">Lock in</button></footer>
  </div>`;
  const ids = fighters
    .filter((c) => element === "All" || c.element === element)
    .map((c) => c.id);
  const at = ids.indexOf(selected);
  // Preserve inline order for consumers; placeFighterDetail mounts the stable stage.
  const grid =
    at < 0
      ? cards.join("") + detail
      : [...cards.slice(0, at + 1), detail, ...cards.slice(at + 1)].join("");
  const filters = ["All", ...new Set(fighters.map((c) => c.element))]
    .map(
      (name) =>
        `<button type="button" data-champion-filter="${name}" aria-label="${name === "All" ? "All fighters" : `${name} fighters`}" aria-pressed="${name === element}" title="${name}">${name === "All" ? "All" : elementIcon(name)}</button>`,
    )
    .join("");
  return `<div class="champion-selector"><div class="section-title"><div><span class="eyebrow">The roster</span><h2>Find your fighter</h2></div></div><div class="roster-navigation" aria-label="Champion navigation"><div class="roster-swipe-hint"><span class="roster-swipe-icon" aria-hidden="true">${menuIcon("swipe")}</span><span>Browse fighters <small>${cards.length} champions</small></span></div><div class="roster-scroll-buttons"><button type="button" data-roster-step="-1" aria-label="Previous champions" disabled>‹</button><button type="button" data-roster-step="1" aria-label="More champions">›</button></div><progress class="roster-scroll-progress" aria-label="Champion list scroll position" max="1" value="0"></progress></div><div class="selection-layout champion-selection"><div class="champion-strip"><button type="button" class="champion-filter-toggle" data-champion-filter-toggle aria-label="Filter fighters by element" aria-expanded="false"><span>All</span>${menuIcon("swipe")}</button><nav class="champion-filters" aria-label="Filter fighters by element">${filters}</nav><div class="roster showcase-roster" role="group" aria-label="Fighters">${grid}</div></div><aside class="fighter-preview-slot" tabindex="0" role="region" aria-label="Selected fighter, stats and skills"></aside></div><p class="universal">Every fighter shares one <b>dash</b> (${actionLabel(bindings, "dash")}) and one <b>jump</b> (${actionLabel(bindings, "jump")}). Jump clears ground attacks.</p></div>`;
}

/** Swap the selected preview without replacing the roster or moving the page. */
export function updateRosterSelection(
  root: ParentNode,
  selected: CharacterId,
  reducedMotion = false,
  revealSelection = false,
) {
  const next = document.createElement("template");
  next.innerHTML = fighterSelection(selected);
  const freshDetail =
      next.content.querySelector<HTMLElement>(".fighter-detail"),
    oldDetail = root.querySelector(".fighter-detail");
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>(".showcase-roster [data-character]"),
  );
  const chosen = cards.find((c) => c.dataset.character === selected);
  if (!freshDetail || !oldDetail || !chosen) return false;
  const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
  const anchorTop = chosen.getBoundingClientRect().top;
  for (const card of cards) {
    const on = card.dataset.character === selected;
    card.classList.toggle("selected", on);
    card.setAttribute("aria-pressed", String(on));
    const label = card.querySelector(".card-selection-label");
    if (label) label.textContent = on ? "✓ Selected" : "Select";
    // Only the selected card wears its trait aura.
    const artwork = card.querySelector(".card-art"),
      fresh = next.content.querySelector(
        `[data-character="${card.dataset.character}"] .card-art`,
      );
    if (artwork && fresh && (on || artwork.querySelector(".trait-aura")))
      artwork.replaceWith(fresh);
  }
  showFighterSection(
    freshDetail,
    oldDetail.getAttribute("data-preview") ?? "overview",
  );
  const sharedHelp = oldDetail.querySelector(".universal");
  if (sharedHelp)
    freshDetail.querySelector(".skill-preview")!.append(sharedHelp);
  oldDetail.remove();
  chosen.after(freshDetail);
  placeFighterDetail(root);
  const preview = root.querySelector<HTMLElement>(".fighter-preview-slot");
  if (preview) {
    preview.scrollTop = 0;
    if (revealSelection) {
      const roster = chosen.parentElement!;
      const card = chosen.getBoundingClientRect(),
        list = roster.getBoundingClientRect();
      if (card.left < list.left || card.right > list.right)
        roster.scrollBy({
          left:
            card.left < list.left
              ? card.left - list.left
              : card.right - list.right,
          behavior: reducedMotion || still() ? "instant" : "smooth",
        });
      if (!reducedMotion && !still())
        freshDetail.animate(
          [
            { opacity: 0.4, transform: "translateX(14px)" },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
    }
    return true;
  }
  // Server snapshots and room entry update the selection without navigating
  // away from the room controls. Only a deliberate card tap reveals details.
  if (!revealSelection) return true;
  // Swipeable row: bring the picked card fully into view.
  const roster = chosen.parentElement;
  if (roster && getComputedStyle(roster).gridAutoFlow.startsWith("column")) {
    const left = chosen.offsetLeft - roster.offsetLeft,
      right = left + chosen.offsetWidth;
    if (
      left < roster.scrollLeft ||
      right > roster.scrollLeft + roster.clientWidth
    )
      roster.scrollTo({
        left: Math.max(0, left - 2),
        behavior: reducedMotion ? "auto" : "smooth",
      });
  }
  window.scrollBy({
    top: chosen.getBoundingClientRect().top - anchorTop,
    behavior: "auto",
  });
  if (!reducedMotion)
    for (const card of cards) {
      const from = before.get(card)!,
        to = card.getBoundingClientRect();
      const dx = from.left - to.left,
        dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  // Make sure the panel can be read without hunting for it.
  const box = freshDetail.getBoundingClientRect();
  const strip =
    !!roster && getComputedStyle(roster).gridAutoFlow.startsWith("column");
  let shift = 0;
  if (strip) {
    // Phones: keep the swipeable row at the top with the panel right under it.
    if (box.top > innerHeight * 0.62)
      shift = roster!.getBoundingClientRect().top - 12;
  } else if (box.top > innerHeight * 0.62) shift = box.top - innerHeight * 0.35;
  // PC, picked from the second row while scrolled down: show the panel's top.
  else if (box.top < 0) shift = box.top - 90;
  if (shift)
    window.scrollBy({
      top: shift,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  return true;
}

/** Mount the stable preview slot, with legacy inline placement as a fallback. */
export function placeFighterDetail(root: ParentNode) {
  const roster = root.querySelector<HTMLElement>(".showcase-roster"),
    detail = root.querySelector<HTMLElement>(".fighter-detail");
  if (!roster || !detail) return;
  for (const portrait of Array.from(
    root.querySelectorAll<SVGSVGElement>(
      ".card-art > svg, .fighter-detail .selected-art > svg",
    ),
  )) {
    const frame = portrait.closest(".card-art")
      ? "22 -8 156 156"
      : "-20 -40 240 250";
    if (portrait.getAttribute("viewBox") !== frame)
      portrait.setAttribute("viewBox", frame);
  }
  const preview = root.querySelector<HTMLElement>(".fighter-preview-slot");
  if (preview) {
    if (detail.parentElement !== preview) preview.prepend(detail);
    const sharedControls = root.querySelector<HTMLElement>(".universal");
    if (
      sharedControls &&
      sharedControls.parentElement !== detail.querySelector(".skill-preview")
    )
      detail.querySelector(".skill-preview")!.append(sharedControls);
    preview.style.setProperty(
      "--element",
      hex(CHARACTERS[detail.dataset.detailFor as CharacterId].color),
    );
    showFighterSection(detail, detail.dataset.preview ?? "overview");
    return;
  }
  const strip = getComputedStyle(roster).gridAutoFlow.startsWith("column");
  if (strip) {
    if (detail.parentElement === roster) roster.after(detail);
  } else if (detail.parentElement !== roster) {
    const chosen = roster.querySelector(
      `[data-character="${detail.dataset.detailFor}"]`,
    );
    if (chosen) chosen.after(detail);
    else roster.append(detail);
  }
}
let groundResize: ResizeObserver | undefined;
let groundedArt: HTMLElement | undefined;
/** Match the rays to the SVG ground plane, including contain-fit letterboxing. */
function alignChampionGround(detail: HTMLElement) {
  const art = detail.querySelector<HTMLElement>(".fighter-rig-stage")!;
  const align = () => {
    const shadow = art.querySelector<SVGEllipseElement>(".fighter-shadow");
    const matrix = shadow?.getScreenCTM();
    if (!shadow || !matrix || !art.getClientRects().length) return;
    const point = new DOMPoint(
      shadow.cx.baseVal.value,
      shadow.cy.baseVal.value,
    );
    const ground =
      point.matrixTransform(matrix).y - art.getBoundingClientRect().top;
    if (ground > 0)
      art.style.setProperty("--champion-ground-y", `${ground.toFixed(2)}px`);
  };
  if (groundedArt !== art) {
    groundResize?.disconnect();
    groundedArt = art;
    groundResize = new ResizeObserver(align);
    groundResize.observe(art);
  }
  align();
}
/** Both sections remain in the DOM; native buttons also work with a controller. */
function showFighterSection(detail: HTMLElement, section: string) {
  const inline = matchMedia(
    "(min-width: 1001px) and (min-height: 601px)",
  ).matches;
  const changedLayout =
    detail.dataset.kitLayout !== (inline ? "inline" : "tabs");
  detail.dataset.kitLayout = inline ? "inline" : "tabs";
  const info = detail.querySelector<HTMLElement>(".selected-info")!;
  const kit = detail.querySelector<HTMLElement>(".skill-preview")!;
  if (inline && kit.parentElement !== info) info.append(kit);
  else if (!inline && kit.parentElement !== detail)
    detail.insertBefore(kit, detail.querySelector(".champion-actions"));
  const skills = !inline && section === "skills";
  detail.dataset.preview = skills ? "skills" : "overview";
  detail.querySelector<HTMLElement>(".fighter-preview-tabs")!.hidden = !skills;
  detail.querySelector<HTMLElement>(".selected-fighter")!.hidden = false;
  info.hidden = skills;
  kit.hidden = !inline && !skills;
  for (const button of Array.from(
    detail.querySelectorAll<HTMLElement>("[data-fighter-preview]"),
  ))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.fighterPreview === detail.dataset.preview),
    );
  if (changedLayout) {
    detail.querySelector<HTMLElement>(".champion-skill-tooltip")!.hidden = true;
    delete detail.dataset.inspection;
    for (const row of Array.from(detail.querySelectorAll(".is-inspected")))
      row.classList.remove("is-inspected");
    for (const button of Array.from(
      detail.querySelectorAll("[data-skill-inspect]"),
    ))
      button.setAttribute("aria-expanded", "false");
  }
  alignChampionGround(detail);
}
function inspectSkill(detail: HTMLElement, key?: string) {
  const tooltip = detail.querySelector<HTMLElement>(".champion-skill-tooltip")!;
  const id = detail.dataset.detailFor as CharacterId;
  const fighter = CHARACTERS[id];
  const same = detail.dataset.inspection === key;
  if (detail.dataset.kitLayout === "inline") {
    tooltip.hidden = true;
    if (!key || same) delete detail.dataset.inspection;
    else detail.dataset.inspection = key;
    for (const button of Array.from(
      detail.querySelectorAll<HTMLElement>("[data-skill-inspect]"),
    ))
      button.setAttribute(
        "aria-expanded",
        String(button.dataset.skillInspect === detail.dataset.inspection),
      );
    for (const row of Array.from(
      detail.querySelectorAll<HTMLElement>("[data-kit-skill]"),
    )) {
      const active = row.dataset.kitSkill === detail.dataset.inspection;
      row.classList.toggle("is-inspected", active);
      if (active) {
        const info = detail.querySelector<HTMLElement>(".selected-info")!;
        const bounds = row.getBoundingClientRect(),
          viewport = info.getBoundingClientRect();
        if (bounds.top < viewport.top || bounds.bottom > viewport.bottom)
          info.scrollTo({
            top: info.scrollTop + bounds.top - viewport.top - 12,
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
      }
    }
    return;
  }
  if (!key || same) {
    const previous = detail.dataset.inspection;
    tooltip.hidden = true;
    delete detail.dataset.inspection;
    if (previous)
      detail
        .querySelector<HTMLElement>(`[data-skill-inspect="${previous}"]`)
        ?.focus({ preventScroll: true });
  } else {
    let title: string, description: string;
    if (key === "combo") {
      title = `Combo · ${COMBOS[id].name}`;
      description = COMBOS[id].text;
    } else if (key === "bio") {
      title = fighter.name;
      description = fighter.description;
    } else if (key === "basic") {
      title = `${fighter.basic.name} · ${fighter.basic.damage} damage`;
      description = `${fighter.basic.description} No cooldown · ${Math.round((fighter.basic.interval ?? 0.3) * 1000)} ms between attacks.`;
    } else {
      const skill = fighter.skills[Number(key)];
      if (!skill) return;
      title = `${skill.name} · ${Number(key) === ULT_SLOT ? "Ultimate" : `${skill.cooldown}s cooldown`}`;
      description = skill.description;
    }
    tooltip.querySelector<HTMLElement>("[data-skill-title]")!.textContent =
      title;
    tooltip.querySelector<HTMLElement>(
      "[data-skill-description]",
    )!.textContent = description;
    tooltip.hidden = false;
    detail.dataset.inspection = key;
  }
  for (const button of Array.from(
    detail.querySelectorAll<HTMLElement>("[data-skill-inspect]"),
  ))
    button.setAttribute(
      "aria-expanded",
      String(button.dataset.skillInspect === detail.dataset.inspection),
    );
}
let watched: ResizeObserver | undefined;
let navigationEvents: AbortController | undefined;
/** Re-place the panel whenever the roster switches between layouts. */
export function watchFighterDetail(root: HTMLElement) {
  watched?.disconnect();
  groundResize?.disconnect();
  groundedArt = undefined;
  navigationEvents?.abort();
  navigationEvents = new AbortController();
  const panel = root.querySelector<HTMLElement>(".roster-panel") ?? root;
  placeFighterDetail(panel);
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        (event.target as Element).closest(
          ".champion-filters, [data-champion-filter-toggle]",
        )
      )
        return;
      panel.classList.remove("is-filter-open");
      panel
        .querySelector("[data-champion-filter-toggle]")
        ?.setAttribute("aria-expanded", "false");
    },
    { signal: navigationEvents.signal },
  );
  panel.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      const filterToggle = target.closest<HTMLElement>(
        "[data-champion-filter-toggle]",
      );
      if (filterToggle) {
        const open = panel.classList.toggle("is-filter-open");
        filterToggle.setAttribute("aria-expanded", String(open));
        return;
      }
      const filter = target.closest<HTMLElement>("[data-champion-filter]");
      if (filter) {
        const element = filter.dataset.championFilter!;
        panel.classList.remove("is-filter-open");
        const toggle = panel.querySelector<HTMLElement>(
          "[data-champion-filter-toggle]",
        );
        toggle?.setAttribute("aria-expanded", "false");
        const label = toggle?.querySelector("span");
        if (label)
          label.textContent = element === "All" ? "All" : element.slice(0, 3);
        for (const option of Array.from(
          panel.querySelectorAll<HTMLElement>("[data-champion-filter]"),
        ))
          option.setAttribute("aria-pressed", String(option === filter));
        for (const card of Array.from(
          panel.querySelectorAll<HTMLElement>(".showcase-card"),
        ))
          card.hidden = element !== "All" && card.dataset.element !== element;
        const chosen = panel.querySelector<HTMLElement>(
          ".showcase-card.selected:not([hidden])",
        );
        if (!chosen)
          panel
            .querySelector<HTMLElement>(".showcase-card:not([hidden])")
            ?.click();
        return;
      }
      const inspect = target.closest<HTMLElement>(
        "[data-skill-inspect], [data-skill-close]",
      );
      if (inspect) {
        const detail = inspect.closest<HTMLElement>(".fighter-detail");
        if (detail) inspectSkill(detail, inspect.dataset.skillInspect);
        return;
      }
      const button = target.closest<HTMLElement>("[data-fighter-preview]");
      if (!button) return;
      const detail = button.closest<HTMLElement>(".fighter-detail");
      if (!detail) return;
      showFighterSection(detail, button.dataset.fighterPreview!);
      const destination = detail.querySelector<HTMLElement>(
        button.dataset.fighterPreview === "skills"
          ? ".skill-preview"
          : ".champion-full-kit",
      );
      destination?.focus({ preventScroll: true });
      const preview = detail.closest<HTMLElement>(".fighter-preview-slot");
      if (preview) preview.scrollTop = 0;
    },
    { signal: navigationEvents.signal },
  );
  panel.addEventListener(
    "keydown",
    (event) => {
      if (
        !(event.target as Element).matches("[data-character]") ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      const cards = Array.from(
        panel.querySelectorAll<HTMLElement>("[data-character]:not([hidden])"),
      );
      const index = cards.indexOf(event.target as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? cards.length - 1
            : (index + (event.key === "ArrowLeft" ? -1 : 1) + cards.length) %
              cards.length;
      event.preventDefault();
      cards[next]?.focus({ preventScroll: true });
      cards[next]?.click();
    },
    { signal: navigationEvents.signal },
  );
  const roster = panel.querySelector<HTMLElement>(".showcase-roster");
  const previous = panel.querySelector<HTMLButtonElement>(
    '[data-roster-step="-1"]',
  );
  const next = panel.querySelector<HTMLButtonElement>('[data-roster-step="1"]');
  const progress = panel.querySelector<HTMLProgressElement>(
    ".roster-scroll-progress",
  );
  const syncNavigation = () => {
    if (!roster) return;
    const vertical = false;
    const max = Math.max(
      0,
      vertical
        ? roster.scrollHeight - roster.clientHeight
        : roster.scrollWidth - roster.clientWidth,
    );
    const position = vertical ? roster.scrollTop : roster.scrollLeft;
    if (previous) previous.textContent = vertical ? "⌃" : "‹";
    if (next) next.textContent = vertical ? "⌄" : "›";
    if (previous) previous.disabled = position <= 2;
    if (next) next.disabled = position >= max - 2;
    if (progress) progress.value = max ? position / max : 0;
  };
  for (const button of [previous, next])
    button?.addEventListener(
      "click",
      () => {
        const vertical = false;
        roster?.scrollBy({
          [vertical ? "top" : "left"]:
            Number(button.dataset.rosterStep) *
            ((vertical ? roster.clientHeight : roster.clientWidth) * 0.8),
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      },
      { signal: navigationEvents.signal },
    );
  roster?.addEventListener("scroll", syncNavigation, {
    passive: true,
    signal: navigationEvents.signal,
  });
  syncNavigation();
  watched = new ResizeObserver(() => {
    placeFighterDetail(panel);
    syncNavigation();
  });
  watched.observe(panel);
}
