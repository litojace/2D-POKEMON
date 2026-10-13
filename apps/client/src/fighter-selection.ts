import { fighterPack } from "./animation/pack-config";
import { CHARACTERS, KEYS, type CharacterId } from "@arena/shared";
import { fighterArt } from "./fighter-art";
import { abilityIcon } from "./ability-icons";
function art(id: CharacterId, large = false) {
  const pack = fighterPack(id);
  return pack && pack.kind !== "layered"
    ? `<img class="creature-portrait ${id === "voltkit" ? "voltkit-pilot" : ""}" loading="lazy" decoding="async" src="/assets/fighters/${id}/${large ? pack.selection : pack.portrait}" alt="${CHARACTERS[id].name}">`
    : fighterArt(id);
}
export function fighterSelection(selected: CharacterId, element = "All") {
  const fighter = CHARACTERS[selected],
    color = `#${fighter.color.toString(16).padStart(6, "0")}`;
  return `<div class="section-title"><div><span class="eyebrow">THE ELEMENTALS</span><h2>Find your fighter</h2></div><label class="element-filter">Element<select id="fighter-filter" aria-label="Filter fighters by element">${["All", ...new Set(Object.values(CHARACTERS).map((c) => c.element))].map((e) => `<option ${e === element ? "selected" : ""}>${e}</option>`).join("")}</select></label></div><div class="roster elemental-roster">${Object.values(
    CHARACTERS,
  )
    .filter((c) => element === "All" || c.element === element)
    .map(
      (c) =>
        `<button class="creature-card ${selected === c.id ? "selected" : ""}" style="--element:#${c.color.toString(16)}" data-character="${c.id}" aria-pressed="${selected === c.id}"><span class="element-label">${c.element}</span>${art(c.id)}<strong>${c.name}</strong><small>${c.role}</small><span class="card-bottom">${c.health} HP<span>${selected === c.id ? "SELECTED" : "SELECT"}</span></span></button>`,
    )
    .join(
      "",
    )}</div><div class="selected-fighter" style="--element:${color}"><div class="selected-art">${art(selected, true)}<span>ORIGINAL ELEMENTAL</span></div><div class="selected-info"><span class="eyebrow">${fighter.element}</span><h3>${fighter.name}</h3><p>${fighter.role}</p><div class="fighter-stats"><span><b>${fighter.health}</b>Health</span><span><b>${fighter.speed}</b>Move speed</span><span><b>${fighter.basic.damage}</b>Basic damage</span></div><p class="basic-description"><b>${fighter.basic.name}</b> · ${fighter.basic.description}</p></div></div><div class="skill-preview"><div class="skill-preview-heading"><h3>Four ways to turn the fight</h3><span>1 / 2 / 3 / R</span></div><div class="preview-skills">${fighter.skills.map((a, i) => `<div><kbd>${KEYS.skills[i]}</kbd>${abilityIcon(a.name)}<span><strong>${a.name}</strong><small>${a.description}</small></span><b>${a.cooldown}s</b></div>`).join("")}</div></div><p class="universal">Every fighter can <b>basic attack</b>, <b>dash</b>, and <b>jump</b>. Eight elements. Your playstyle.</p>`;
}
