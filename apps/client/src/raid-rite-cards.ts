import { RAID_RITES, type RaidRite } from "../../../packages/shared/src/raid";
import { raidRitePicture, RAID_RITE_CUES } from "./raid-rite-art";

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

export function raidRiteChoices(offers: readonly RaidRite[]) {
  return (
    offers
      .map((id) => {
        const rite = RAID_RITES[id],
          cue = RAID_RITE_CUES[id];
        return `<button data-raid-rite="${id}" class="secondary raid-rite-${id}" title="${escape(rite.text)}" aria-label="${escape(rite.name + ". " + rite.text)}"><span class="raid-rite-copy"><span class="raid-rite-heading">${raidRitePicture(id)}<b>${rite.name}</b></span><small class="raid-rite-trigger">${cue.trigger}</small><span class="raid-rite-effect">${cue.effect}</span></span></button>`;
      })
      .join("") || "<p>Rite locked in · waiting for the team.</p>"
  );
}

/** A separate, tap-safe reference. Reading an effect never picks the rite. */
export function raidRiteDetails(offers: readonly RaidRite[]) {
  if (!offers.length) return "";
  return `<details class="raid-rite-more"><summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/></svg><span class="rite-details-closed">Rite details</span><span class="rite-details-open">Close details</span></summary><div class="raid-rite-reference" role="region" aria-label="Full rite effects" tabindex="0"><h3>Rite details</h3><ul>${offers.map((id) => `<li>${raidRitePicture(id)}<div><h4>${RAID_RITES[id].name}</h4><p>${escape(RAID_RITES[id].text)}</p></div></li>`).join("")}</ul></div></details>`;
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
