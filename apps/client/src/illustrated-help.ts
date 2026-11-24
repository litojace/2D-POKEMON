import { CHARACTERS, RULES } from "@arena/shared";
import { fighterArt, scopeIds } from "./fighter-art";
import { abilityIcon } from "./ability-icons";
import { menuIcon } from "./menu-icons";

/**
 * The pictures How to play shows beside its battle tips (how-to-play.ts).
 * They reuse the live fighter and skill artwork, with scoped SVG IDs so
 * hidden lobby portraits cannot steal these illustrations' gradients.
 */
export type HelpArt =
  "cover" | "jump" | "attack" | "ultimate" | "ex" | "orbs" | "ring" | "ranks";

const fighter = (scope: string, airborne = false) =>
  `<span class="guide-fighter ${airborne ? "guide-airborne" : ""}">${scopeIds(fighterArt("voltkit"), "guide-" + scope)}</span>`;
const icon = (name: string) =>
  `<span class="guide-move">${abilityIcon(name)}</span>`;

const SCENES: Record<HelpArt, () => string> = {
  cover: () =>
    `${fighter("cover")}<span class="guide-rock"></span><span class="guide-shot">${abilityIcon(CHARACTERS.cindrake.basic.name)}</span><span class="guide-block-spark">&#10038;</span>`,
  jump: () =>
    `<span class="guide-ground-zone"></span><span class="guide-floor-shadow"></span>${fighter("jump", true)}<span class="guide-jump">${abilityIcon("Jump")}</span>`,
  attack: () =>
    `<div class="guide-move-pair">${icon(CHARACTERS.voltkit.basic.name)}<span class="guide-infinity">&#8734;</span>${icon(CHARACTERS.voltkit.skills[0].name)}<span class="guide-clock">8–20s</span></div>`,
  // The meter cards: the button, then its meter and what it reads, one
  // centred stack (no fighter behind the bar: owner, 22 Nov 2026).
  ultimate: () =>
    `<div class="guide-charge is-ult"><span class="guide-charge-row"><span class="guide-ultimate">${abilityIcon(CHARACTERS.voltkit.skills[3].name)}</span></span><span class="guide-charge-bar"><i></i></span><b class="guide-charge-label">ULT READY</b></div>`,
  ex: () =>
    `<div class="guide-charge is-ex"><span class="guide-charge-row"><span class="guide-ex">EX</span>${icon(CHARACTERS.voltkit.skills[0].name)}</span><span class="guide-charge-bar"><i></i></span><b class="guide-charge-label">&#8531; METER</b></div>`,
  orbs: () =>
    `<div class="guide-orb-pair"><div class="guide-orb-item"><span class="guide-orb guide-heal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="guide-orb-label guide-heal-label">+${Math.round(RULES.orbHeal * 100)}% HP</span></div><div class="guide-orb-item"><span class="guide-orb guide-energy"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m14 2-9 12h6l-1 8 9-12h-6Z"/></svg></span><span class="guide-orb-label guide-energy-label">+${RULES.orbEnergy} ENERGY</span></div></div>`,
  ring: () =>
    `<span class="guide-danger"></span><span class="guide-safe-ring"></span>${fighter("ring")}<span class="guide-ring-time">LAST MINUTE</span>`,
  ranks: () =>
    `<span class="guide-rank-badge">${menuIcon("leaderboard")}</span><span class="guide-rank-path">&#8599; &#8599; &#8599;</span><span class="guide-rank-star">&#10022;</span><span class="guide-rank-label">NEWBIE &#8594; LEGENDARY</span>`,
};

/** One tip's picture (decorative: the tip's text says the same). */
export function helpArt(art: HelpArt) {
  return `<div class="guide-scene" aria-hidden="true">${SCENES[art]()}</div>`;
}
