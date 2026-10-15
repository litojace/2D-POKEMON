import type { CharacterId } from "@arena/shared";
import { fighterArt, scopeIds } from "./fighter-art";

// Miniature diagrams use the same fighter artwork, boss silhouette and warning colors as combat.
export function raidGuideBoss(exposed = false) {
  const glow = exposed ? "#82ffe7" : "#ffce75";
  return `<g stroke="#202e43" stroke-width="2" stroke-linejoin="round"><ellipse cy="35" rx="40" ry="9" fill="#071325" opacity=".5"/><path d="m-28-22 17-15 32 4 12 27-7 33-23 8-28-13Z" fill="#52657b"/><path d="m-28-22 17-15 32 4 7 13-26-1Z" fill="#8a9eb1"/><path d="m-27-22-1-20 8-15 8 29m31-1 8-33 10 17-1 24" fill="${glow}"/><path d="m-47 5 5-18 18 2 3 29-19 5Zm70-16 18-2 7 18-7 18-19-5Z" fill="#52657b"/><path d="m-19-15 13-5 23 6-3 16-29 1Z" fill="#202e43"/><path d="m-13-8 8 3m11 0 8-3" stroke="${glow}" stroke-width="3"/><path d="m0 5 12 9-3 16-10 6-10-10 1-14Z" fill="${glow}"/>${exposed ? '<circle cy="19" r="22" fill="none" stroke="#82ffe7" opacity=".7"/>' : ""}</g>`;
}
export function raidGuideScene(
  kind: "charge" | "core" | "revive",
  character: CharacterId,
) {
  const hero = (x: number, y: number, n: string) =>
    `<g transform="translate(${x} ${y})">${scopeIds(fighterArt(character), "raid-guide-" + kind + n).replace("<svg ", '<svg width="42" height="45" ')}</g>`;
  const floor =
    '<path d="M0 30h220M0 60h220M0 90h220M0 120h220M25 0v135M65 0v135M105 0v135M145 0v135M185 0v135" stroke="#8ca0bb" opacity=".12"/>';
  let art = "";
  if (kind === "charge")
    art = `<path d="M25 51h148v39H25Z" fill="#ff4059" opacity=".18"/><path d="M25 51h148M25 90h148" stroke="#ff4059" stroke-width="2"/><path class="raid-guide-arrows" d="m84 61 10 10-10 10m21-20 10 10-10 10m21-20 10 10-10 10" fill="none" stroke="#ff8c99" stroke-width="3"/><g class="raid-guide-charger"><g transform="translate(39 61) scale(.57)">${raidGuideBoss()}</g></g><path d="m143 44 22-3 9 6v39l-25 4-9-7Z" fill="#738887" stroke="#253c3b" stroke-width="2"/><path d="m149 49 9 8-5 9 7 8" stroke="#c9ddd2" fill="none"/>${hero(177, 57, "a")}<path d="M194 102q-4 17-32 16" stroke="#8beed2" stroke-width="2" stroke-dasharray="4 4" fill="none"/><text x="155" y="31">PILLAR</text>`;
  if (kind === "core")
    art = `${hero(18, 66, "b")}<g transform="translate(145 61) scale(.72)">${raidGuideBoss(true)}</g><path class="raid-guide-bolt" d="m67 89 19-12-2 10 24-11-18 20 1-10Z" fill="#ffe17b"/><circle class="raid-guide-core" cx="145" cy="75" r="23" fill="none" stroke="#82ffe7" stroke-width="2"/><rect x="107" y="111" width="78" height="5" rx="2" fill="#203c4b"/><rect x="107" y="111" width="58" height="5" rx="2" fill="#82ffe7"/><text x="145" y="26">CORE OPEN</text>`;
  if (kind === "revive")
    art = `<ellipse cx="144" cy="85" rx="42" ry="27" fill="#82ffe7" opacity=".09"/><ellipse cx="144" cy="85" rx="42" ry="27" stroke="#82ffe7" stroke-width="2" fill="none"/>${hero(61, 55, "c")}<g transform="translate(150 91) rotate(75)">${hero(-21, -35, "d")}</g><path class="raid-guide-revive" d="M113 88q30-35 59-6" fill="none" stroke="#a7ffb2" stroke-width="4" stroke-linecap="round"/><path d="M145 48v14m-7-7h14" stroke="#a7ffb2" stroke-width="3"/><text x="124" y="119">REVIVING</text>`;
  // Center the complete two-character scene; center its caption on the card.
  if (kind === "revive") art = `<g transform="translate(-14 -8)">${art}</g>`;
  return `<svg class="raid-guide-scene" viewBox="0 0 220 135" aria-hidden="true">${floor}${art}</svg>`;
}
