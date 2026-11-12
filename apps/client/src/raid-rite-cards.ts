import {
  RAID_RITES,
  riteGrowth,
  type RaidRite,
} from "../../../packages/shared/src/raid";
import {
  raidRitePicture,
  raidRiteBuffPicture,
  raidRiteBuffTrigger,
} from "./raid-rite-art";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

/**
 * The rite cards. `list` is the order they were offered in; a picked rite
 * stays in its place, checked and greyed out, instead of vanishing (the
 * server drops it from the offers). Once every pick is made (`locked`), the
 * rest are greyed out too, and the heading says the rites are locked in.
 */
export function raidRiteChoices(
  list: readonly RaidRite[],
  picked: readonly RaidRite[] = [],
  locked = false,
) {
  const cards = list
    .map((id) => {
      const rite = RAID_RITES[id];
      const chosen = picked.includes(id);
      const off = chosen || locked;
      return `<button data-raid-rite="${id}" class="secondary raid-rite-${id}${chosen ? " is-picked" : ""}"${off ? " disabled" : ""} aria-pressed="${chosen}" title="${escape(rite.text)}" aria-label="${escape(rite.name + ". " + rite.text + (chosen ? " Chosen." : ""))}"><span class="raid-rite-copy"><span class="raid-rite-heading">${raidRiteBuffPicture(id)}<b>${rite.name}</b></span><small class="raid-rite-trigger">${raidRiteBuffTrigger(id)}</small></span>${chosen ? '<span class="raid-rite-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' : ""}</button>`;
    })
    .join("");
  // Locked in: the heading says so (raid-ui.ts), so the cards keep their places.
  return cards || "<p>Rites locked in · waiting for the team.</p>";
}

/**
 * The order the rites were first offered in this choice. The server removes
 * a rite from the offers once it is picked, so the client remembers the full
 * list to keep a picked card where it was.
 */
let riteOrder: RaidRite[] = [];
export function riteDisplayOrder(
  offers: readonly RaidRite[],
  picked: readonly RaidRite[],
): RaidRite[] {
  const known = new Set(riteOrder);
  // A fresh choice (nothing picked yet), or a list from another choice.
  if (
    (!picked.length && offers.length) ||
    offers.some((id) => !known.has(id)) ||
    picked.some((id) => !known.has(id))
  )
    riteOrder = [...picked.filter((id) => !offers.includes(id)), ...offers];
  return riteOrder.slice();
}

/** A separate, tap-safe reference. Reading an effect never picks the rite. */
export function raidRiteDetails(offers: readonly RaidRite[]) {
  if (!offers.length) return "";
  return `<details class="raid-rite-more"><summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/></svg><span class="rite-details-closed">Rite details</span><span class="rite-details-open">Close details</span></summary><div class="raid-rite-reference" role="region" aria-label="Full rite effects" tabindex="0"><h3>Rite details</h3><ul>${offers.map((id) => `<li>${raidRitePicture(id)}<div><h4>${RAID_RITES[id].name}</h4><p>${escape(RAID_RITES[id].text)}</p>${riteGrowth(id) ? `<p class="raid-rite-growth">By chapter: ${escape(riteGrowth(id)!)}</p>` : ""}</div></li>`).join("")}</ul></div></details>`;
}

export function bindRaidRiteDetails(root: HTMLElement) {
  const more = root.querySelector<HTMLDetailsElement>(".raid-rite-more");
  const choices = root.querySelector<HTMLElement>(".raid-rite-options");
  if (!more || !choices) return;
  const update = () => {
    choices.inert = more.open;
  };
  more.ontoggle = update;
  update();
  more.onkeydown = (event) => {
    if (event.key !== "Escape" || !more.open) return;
    event.preventDefault();
    event.stopPropagation();
    more.open = false;
    update();
    more.querySelector<HTMLElement>("summary")?.focus();
  };
}
