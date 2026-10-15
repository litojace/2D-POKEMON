import { CHARACTERS, RULES } from "@arena/shared";
import { fighterArt, scopeIds } from "./fighter-art";
import { abilityIcon } from "./ability-icons";
import { menuIcon } from "./menu-icons";

// Reuse the live fighter and skill artwork, with scoped SVG IDs so hidden
// lobby portraits cannot steal these illustrations' gradients.
export function illustratedHelp() {
  const fighter = (scope: string, airborne = false) =>
    `<span class="guide-fighter ${airborne ? "guide-airborne" : ""}">${scopeIds(fighterArt("voltkit"), "guide-" + scope)}</span>`;
  const icon = (name: string) =>
    `<span class="guide-move">${abilityIcon(name)}</span>`;
  const scene = (body: string) =>
    `<div class="guide-scene" aria-hidden="true">${body}</div>`;
  const card = (title: string, picture: string, caption: string) =>
    `<article class="guide-card">${picture}<div class="guide-caption"><h3>${title}</h3><p>${caption}</p></div></article>`;
  const tiles = [
    card(
      "Take cover",
      scene(
        `${fighter("cover")}<span class="guide-rock"></span><span class="guide-shot">${abilityIcon(CHARACTERS.cindrake.basic.name)}</span><span class="guide-block-spark">&#10038;</span>`,
      ),
      "Hide behind stone blocks to stop enemy shots.",
    ),
    card(
      "Jump ground attacks",
      scene(
        `<span class="guide-ground-zone"></span><span class="guide-floor-shadow"></span>${fighter("jump", true)}<span class="guide-jump">${abilityIcon("Jump")}</span>`,
      ),
      "Jump over glowing ground zones.",
    ),
    card(
      "Keep attacking",
      scene(
        `<div class="guide-move-pair">${icon(CHARACTERS.voltkit.basic.name)}<span class="guide-infinity">&#8734;</span>${icon(CHARACTERS.voltkit.skills[0].name)}<span class="guide-clock">8–20s</span></div>`,
      ),
      "Basics repeat freely. Specials need time to recharge.",
    ),
    card(
      "Charge your ultimate",
      scene(
        `${fighter("ultimate")}<span class="guide-ultimate">${abilityIcon(CHARACTERS.voltkit.skills[3].name)}</span><span class="guide-meter"><i></i><b>ULT READY</b></span>`,
      ),
      "Fight to fill the gold meter, then unleash your ultimate.",
    ),
    card(
      "Power up with EX",
      scene(
        `<span class="guide-ex">EX</span>${icon(CHARACTERS.voltkit.skills[0].name)}<span class="guide-ex-meter"><i></i><b>&#8531; METER</b></span>`,
      ),
      "Press ultimate early to arm EX. Your next special hits harder and wider.",
    ),
    card(
      "Collect glowing orbs",
      scene(
        `<div class="guide-orb-pair"><div class="guide-orb-item"><span class="guide-orb guide-heal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="guide-orb-label guide-heal-label">+${Math.round(RULES.orbHeal * 100)}% HP</span></div><div class="guide-orb-item"><span class="guide-orb guide-energy"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m14 2-9 12h6l-1 8 9-12h-6Z"/></svg></span><span class="guide-orb-label guide-energy-label">+${RULES.orbEnergy} ENERGY</span></div></div>`,
      ),
      "Green restores health. Gold charges your ultimate.",
    ),
    card(
      "Stay inside the ring",
      scene(
        `<span class="guide-danger"></span><span class="guide-safe-ring"></span>${fighter("ring")}<span class="guide-ring-time">LAST MINUTE</span>`,
      ),
      "The ring shrinks near round end. Keep inside its safe circle.",
    ),
    card(
      "Climb the ranks",
      scene(
        `<span class="guide-rank-badge">${menuIcon("leaderboard")}</span><span class="guide-rank-path">&#8599; &#8599; &#8599;</span><span class="guide-rank-star">&#10022;</span><span class="guide-rank-label">NEWBIE &#8594; LEGENDARY</span>`,
      ),
      "Player matches change your rating. Earn rank titles to keep.",
    ),
  ];
  return `<section class="illustrated-guide" aria-label="Battle tips in pictures"><div class="guide-section-heading"><span class="eyebrow">LEARN BY LOOKING</span><h3>Your arena field guide</h3></div><div class="guide-grid">${tiles.join("")}</div><p class="guide-overtime"><span aria-hidden="true">&#9201;</span><span><b>Tied when time runs out?</b> Overtime drains both players’ health.</span></p><p class="guide-rank-note">Rank details: Menu → Leaderboard → How ranks work.</p></section>`;
}
