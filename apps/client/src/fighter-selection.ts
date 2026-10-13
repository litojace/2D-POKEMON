import { fighterPack } from "./animation/pack-config";
import { CHARACTERS, KEYS, type CharacterId } from "@arena/shared";
import { fighterArt } from "./fighter-art";
import { abilityIcon } from "./ability-icons";
import { PLACEHOLDER_FIGHTERS } from "./creature-design";
import { elementIcon } from "./element-icons";
import { withAura } from "./trait-effects";
/** Reduced motion keeps the auras as still frames. */
const still = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
function art(id: CharacterId, large = false, aura = false) {
  const pack = fighterPack(id);
  if (pack && pack.kind !== "layered")
    return `<img class="creature-portrait" loading="lazy" decoding="async" src="/assets/fighters/${id}/${large ? pack.selection : pack.portrait}" alt="${CHARACTERS[id].name}">`;
  return aura ? withAura(fighterArt(id), id, still()) : fighterArt(id);
}
const placeholderBadge = (id: CharacterId, label = "PLACEHOLDER") =>
  PLACEHOLDER_FIGHTERS.includes(id)
    ? `<span class="art-placeholder" title="Generic stand-in until licensed artwork is added">${label}</span>`
    : "";
export function fighterSelection(selected: CharacterId, element = "All") {
  const fighter = CHARACTERS[selected],
    color = hex(fighter.color),
    interval = Math.round((fighter.basic.interval ?? 0.3) * 1000);
  const cards = Object.values(CHARACTERS)
    .filter((c) => element === "All" || c.element === element)
    .map(
      (c) =>
        `<button class="creature-card showcase-card ${selected === c.id ? "selected" : ""}" style="--element:${hex(c.color)}" data-character="${c.id}" aria-pressed="${selected === c.id}"><span class="card-head"><strong>${c.name}</strong><span class="element-pill">${elementIcon(c.element)}${c.element}</span></span><small class="card-role">${c.role}</small><span class="card-art">${art(c.id, false, selected === c.id)}${placeholderBadge(c.id)}</span><span class="card-basic" title="${c.basic.name}: ${c.basic.description}"><span class="card-basic-label">Basic · no cooldown</span>${abilityIcon(c.basic.name)}<b>${c.basic.name}</b></span><span class="card-skills">${c.skills.map((a) => `<span title="${a.name} (${a.cooldown}s): ${a.description}">${abilityIcon(a.name)}<i>${a.cooldown}s</i></span>`).join("")}</span><span class="card-bottom">${c.health} HP<span>${selected === c.id ? "✓ SELECTED" : "SELECT"}</span></span></button>`,
    )
    .join("");
  const skills = fighter.skills
    .map(
      (a, i) =>
        `<div><kbd>${KEYS.skills[i]}</kbd>${abilityIcon(a.name)}<span><strong>${a.name}</strong><small>${a.description}</small></span><b>${a.cooldown}s</b></div>`,
    )
    .join("");
  return `<div class="section-title"><div><span class="eyebrow">THE ROSTER</span><h2>Find your fighter</h2></div></div><div class="roster showcase-roster">${cards}</div><div class="selected-fighter" style="--element:${color}"><div class="selected-art">${art(selected, true, true)}${placeholderBadge(selected, "PLACEHOLDER ART")}<span>${fighter.element.toUpperCase()} · ${fighter.role.toUpperCase()}</span></div><div class="selected-info"><span class="element-pill">${elementIcon(fighter.element)}${fighter.element}</span><h3>${fighter.name}</h3><p>${fighter.description}</p><div class="fighter-stats"><span><b>${fighter.health}</b>Health</span><span><b>${fighter.speed}</b>Move speed</span><span><b>${fighter.basic.damage}</b>Basic damage</span></div><p class="basic-description">${abilityIcon(fighter.basic.name)}<span class="basic-text"><b>${fighter.basic.name}</b> · ${fighter.basic.description} <em>No cooldown · ${interval} ms between attacks</em></span></p></div></div><div class="skill-preview" style="--element:${color}"><div class="skill-preview-heading"><h3>Four special skills</h3><span>${KEYS.skills.join(" / ")}</span></div><div class="preview-skills">${skills}</div></div><p class="universal">Every fighter shares one <b>dash</b> (${KEYS.dash}) and one <b>jump</b> (${KEYS.jump}). Jump clears ground attacks.</p>`;
}
