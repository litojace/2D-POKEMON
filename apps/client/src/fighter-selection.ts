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
  const framed = large ? withSoftGround(svg) : svg;
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
    const matches = masteryMatches(detail.dataset.detailFor as CharacterId);
    const text = `${masteryTier(matches)?.name ?? "New challenger"} mastery · ${matches} matches`;
    if (label.textContent !== text) label.textContent = text;
  }
}
export function fighterSelection(selected: CharacterId, element = "All") {
  // The player's own keys (Settings → Controls), so the cards teach real controls.
  const bindings = controlPrefs().bindings,
    skillKeys = skillLabels(bindings);
  const fighter = CHARACTERS[selected],
    color = hex(fighter.color),
    interval = Math.round((fighter.basic.interval ?? 0.3) * 1000);
  const cards = Object.values(CHARACTERS)
    .filter((c) => element === "All" || c.element === element)
    .map(
      (c) =>
        `<button class="creature-card showcase-card ${selected === c.id ? "selected" : ""}" style="--element:${hex(c.color)}" data-character="${c.id}" aria-pressed="${selected === c.id}"><span class="card-head"><strong>${c.name}</strong><span class="element-pill">${elementIcon(c.element)}${c.element}</span></span><small class="card-role">${rangeTag(c.id)}<span>${c.role}</span></small><span class="card-art">${masteryRing(c.id)}${art(c.id, false, selected === c.id)}${placeholderBadge(c.id)}</span><span class="card-skills">${c.skills.map((a, i) => `<span title="${a.name} (${i === ULT_SLOT ? "ultimate" : `${a.cooldown}s`}): ${a.description}">${abilityIcon(a.name)}<i>${i === ULT_SLOT ? "ULT" : `${a.cooldown}s`}</i></span>`).join("")}</span><span class="card-bottom"><span class="card-health">${c.health} HP</span>${masteryBadge(c.id)}<span class="card-selection-label">${selected === c.id ? "✓ Selected" : "Select"}</span></span></button>`,
    );
  const skills = fighter.skills
    .map(
      (a, i) =>
        `<div><kbd>${skillKeys[i]}</kbd>${abilityIcon(a.name)}<span><strong>${a.name}</strong><small>${a.description}</small></span><b>${i === ULT_SLOT ? "ULT" : `${a.cooldown}s`}</b></div>`,
    )
    .join("");
  const combo = COMBOS[selected];
  const comboRow = `<p class="combo-description"><b>Combo · ${combo.name}</b>${combo.text}</p>`;
  // Keep detail markup adjacent for legacy consumers; the mounted layout
  // places it in a separate, scrollable preview beside the portrait roster.
  const detail = `<div class="fighter-detail" data-detail-for="${selected}" style="--element:${color}"><nav class="fighter-preview-tabs" aria-label="Fighter preview sections"><button type="button" data-fighter-preview="overview" aria-pressed="true">Overview</button><button type="button" data-fighter-preview="skills" aria-pressed="false">Skills &amp; combo</button></nav><div class="selected-fighter" style="--element:${color}"><div class="selected-art fighter-rig-stage" data-preview-champion="${selected}" data-preview-item="${worn[selected]?.skin ?? ""}" data-preview-stage="${worn[selected]?.stage ?? 1}" data-preview-look="%7B%7D" data-preview-action="idle" aria-label="${fighter.name} animated preview">${art(selected, true, true)}${placeholderBadge(selected, "PLACEHOLDER ART")}<span class="selected-art-caption">${fighter.element} · ${fighter.role}</span></div><div class="selected-info"><span class="element-pill">${elementIcon(fighter.element)}${fighter.element}</span><h3>${fighter.name}</h3><p class="fighter-role-label">${fighter.role} · ${attackRange(selected) === "long" ? "Ranged basic attack" : "Melee basic attack"}</p><p class="fighter-mastery-label">${masteryTier(masteryMatches(selected))?.name ?? "New challenger"} mastery · ${masteryMatches(selected)} matches</p><p>${fighter.description}</p><div class="fighter-stats"><span><b>${fighter.health}</b>Health</span><span><b>${fighter.speed}</b>Move speed</span><span><b>${fighter.basic.damage}</b>Basic damage</span></div><p class="basic-description">${abilityIcon(fighter.basic.name)}<span class="basic-text"><b>${fighter.basic.name}</b> · ${fighter.basic.description} <em>No cooldown · ${interval} ms between attacks</em></span></p></div></div><div class="skill-preview" style="--element:${color}" hidden><div class="skill-preview-heading"><h3>Four special skills</h3><span>${skillKeys.join(" / ")}</span></div><div class="preview-skills">${skills}</div>${comboRow}</div></div>`;
  const ids = Object.values(CHARACTERS)
    .filter((c) => element === "All" || c.element === element)
    .map((c) => c.id);
  const at = ids.indexOf(selected);
  const grid =
    at < 0
      ? cards.join("") + detail
      : [...cards.slice(0, at + 1), detail, ...cards.slice(at + 1)].join("");
  return `<div class="section-title"><div><span class="eyebrow">The roster</span><h2>Find your fighter</h2></div></div><div class="roster-navigation" aria-label="Champion navigation"><div class="roster-swipe-hint"><span class="roster-swipe-icon" aria-hidden="true">${menuIcon("swipe")}</span><span>Browse fighters <small>${cards.length} champions</small></span></div><div class="roster-scroll-buttons"><button type="button" data-roster-step="-1" aria-label="Previous champions" disabled>&#8249;</button><button type="button" data-roster-step="1" aria-label="More champions">&#8250;</button></div><progress class="roster-scroll-progress" aria-label="Champion list scroll position" max="1" value="0"></progress></div><div class="selection-layout"><div class="roster showcase-roster" role="group" aria-label="Fighters">${grid}</div><aside class="fighter-preview-slot" tabindex="0" role="region" aria-label="Selected fighter, stats and skills"></aside></div><p class="universal">Every fighter shares one <b>dash</b> (${actionLabel(bindings, "dash")}) and one <b>jump</b> (${actionLabel(bindings, "jump")}). Jump clears ground attacks.</p>`;
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
      if (card.top < list.top || card.bottom > list.bottom)
        roster.scrollBy({
          top:
            card.top < list.top
              ? card.top - list.top
              : card.bottom - list.bottom,
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
      ? "18 -32 164 180"
      : "-20 -40 240 250";
    if (portrait.getAttribute("viewBox") !== frame)
      portrait.setAttribute("viewBox", frame);
  }
  const preview = root.querySelector<HTMLElement>(".fighter-preview-slot");
  if (preview) {
    if (detail.parentElement !== preview) preview.prepend(detail);
    const sharedControls = root.querySelector<HTMLElement>(".universal");
    if (sharedControls && sharedControls.parentElement !== preview)
      preview.append(sharedControls);
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
/** Both sections remain in the DOM; native buttons also work with a controller. */
function showFighterSection(detail: HTMLElement, section: string) {
  detail.dataset.preview = section;
  const skills = section === "skills";
  const expanded =
    !!detail.closest(".fighter-preview-slot") ||
    matchMedia("(min-width: 1001px)").matches;
  detail.querySelector<HTMLElement>(".fighter-preview-tabs")!.hidden = expanded;
  detail.querySelector<HTMLElement>(".selected-fighter")!.hidden =
    !expanded && skills;
  detail.querySelector<HTMLElement>(".skill-preview")!.hidden =
    !expanded && !skills;
  for (const button of Array.from(
    detail.querySelectorAll<HTMLElement>("[data-fighter-preview]"),
  ))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.fighterPreview === section),
    );
}
let watched: ResizeObserver | undefined;
let navigationEvents: AbortController | undefined;
/** Re-place the panel whenever the roster switches between layouts. */
export function watchFighterDetail(root: HTMLElement) {
  watched?.disconnect();
  navigationEvents?.abort();
  navigationEvents = new AbortController();
  const panel = root.querySelector<HTMLElement>(".roster-panel") ?? root;
  placeFighterDetail(panel);
  panel.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLElement>(
        "[data-fighter-preview]",
      );
      if (!button) return;
      const detail = button.closest<HTMLElement>(".fighter-detail");
      if (!detail) return;
      showFighterSection(detail, button.dataset.fighterPreview!);
      const preview = detail.closest<HTMLElement>(".fighter-preview-slot");
      if (preview) preview.scrollTop = 0;
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
    const vertical = !!panel.querySelector(".fighter-preview-slot");
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
        const vertical = !!panel.querySelector(".fighter-preview-slot");
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
