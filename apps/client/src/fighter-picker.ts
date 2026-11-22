import { CHARACTERS, type CharacterId } from "@arena/shared";
import { fighterPortrait } from "./fighter-art";
import { avatar, esc } from "./ui/components";

/**
 * The result screen's Change fighter (bot matches): every fighter as a
 * portrait and name, the one you just played marked. A pick starts the
 * rematch with it at once (main.ts), so there is no second button to press.
 */
export function fighterPickerMarkup(current: CharacterId) {
  const tiles = (Object.keys(CHARACTERS) as CharacterId[])
    .map((id) => {
      const c = CHARACTERS[id];
      const now = id === current;
      return `<button type="button" class="fp-tile${now ? " is-current" : ""}" data-fp-pick="${id}" aria-pressed="${now}" aria-label="${esc(now ? `${c.name}, played last` : `Rematch with ${c.name}`)}">${avatar(fighterPortrait(id), { element: c.element, size: 48 })}<span>${esc(c.name)}</span></button>`;
    })
    .join("");
  return `<div class="fp-screen"><h2>Change fighter</h2><p class="fp-note">Pick one and the rematch starts with it.</p><div class="fp-grid" role="group" aria-label="Fighters">${tiles}</div></div>`;
}
