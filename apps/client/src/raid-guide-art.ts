import type { CharacterId } from "@arena/shared";
import { fighterArt, scopeIds } from "./fighter-art";

// Miniature diagrams use the same fighter artwork, boss silhouette and warning colors as combat.
export function raidGuideBoss(exposed = false) {
  const glow = exposed ? "#82ffe7" : "#ffce75";
  return `<g stroke="#202e43" stroke-width="2" stroke-linejoin="round"><ellipse cy="35" rx="40" ry="9" fill="#071325" opacity=".5"/><path d="m-28-22 17-15 32 4 12 27-7 33-23 8-28-13Z" fill="#52657b"/><path d="m-28-22 17-15 32 4 7 13-26-1Z" fill="#8a9eb1"/><path d="m-27-22-1-20 8-15 8 29m31-1 8-33 10 17-1 24" fill="${glow}"/><path d="m-47 5 5-18 18 2 3 29-19 5Zm70-16 18-2 7 18-7 18-19-5Z" fill="#52657b"/><path d="m-19-15 13-5 23 6-3 16-29 1Z" fill="#202e43"/><path d="m-13-8 8 3m11 0 8-3" stroke="${glow}" stroke-width="3"/><path d="m0 5 12 9-3 16-10 6-10-10 1-14Z" fill="${glow}"/>${exposed ? '<circle cy="19" r="22" fill="none" stroke="#82ffe7" opacity=".7"/>' : ""}</g>`;
}
/** Tidewyrm in miniature: a coiled sea serpent with a pearl on its brow. */
export function raidGuideTidewyrm(exposed = false) {
  const pearl = exposed ? "#bff6ff" : "#fff3f8";
  return `<g stroke="#13606b" stroke-width="2" stroke-linejoin="round"><ellipse cy="38" rx="44" ry="9" fill="#071325" opacity=".45"/><path d="M-40 34q8-14 22-4t22-6 16-26" fill="none" stroke="#13606b" stroke-width="20" stroke-linecap="round"/><path d="M-40 34q8-14 22-4t22-6 16-26" fill="none" stroke="#2fb7a6" stroke-width="16" stroke-linecap="round"/><path d="m-6 12 4-16 10 10Zm-20 14 2-14 10 8Z" fill="#ffa8c8"/><ellipse cx="22" cy="-14" rx="24" ry="19" fill="#2fb7a6"/><ellipse cx="30" cy="-8" rx="14" ry="9" fill="#8ff0d8" stroke="none"/><path d="M4-22-14-36l4 18Z" fill="#ffa8c8"/><circle cx="20" cy="-17" r="4" fill="#fff" stroke="none"/><circle cx="31" cy="-17" r="4" fill="#fff" stroke="none"/><path d="M15-19h10m1 0h10" stroke-width="2.5"/><circle cx="24" cy="-31" r="5.5" fill="${pearl}"/>${exposed ? '<circle cx="24" cy="-31" r="12" fill="none" stroke="#bff6ff" opacity=".7"/>' : ""}<path d="M-56 38q10-6 20 0t20 0 20 0 20 0 20 0" fill="none" stroke="#d9f5f0" stroke-width="2" opacity=".7"/></g>`;
}
/** The boss's miniature for lobbies and results. */
export function raidGuideBossFor(boss: string, exposed = false) {
  return boss === "tidewyrm" ? raidGuideTidewyrm(exposed) : raidGuideBoss(exposed);
}
export function raidGuideScene(
  kind: "charge" | "core" | "revive" | "strand" | "tide" | "prison",
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
  const island = (x: number, y: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="34" ry="20" fill="#f2fbfa" opacity=".6"/><ellipse cx="${x}" cy="${y}" rx="30" ry="17" fill="#e2c88f" stroke="#c9a86a" stroke-width="2"/>`;
  const water = '<rect width="220" height="135" fill="#1f8fa6" opacity=".35"/>';
  if (kind === "strand")
    art = `${water}${island(150, 82)}<g transform="translate(150 70) scale(.55)">${raidGuideTidewyrm(true)}</g><circle cx="150" cy="82" r="26" fill="none" stroke="#7fe9ff" stroke-width="2" stroke-dasharray="4 4"/>${hero(44, 62, "s")}<path d="M90 90q24 12 38 0" stroke="#8beed2" stroke-width="2" stroke-dasharray="4 4" fill="none"/><text x="150" y="28">STRANDED</text>`;
  if (kind === "tide")
    art = `${water}<rect width="220" height="135" fill="#7fe9ff" opacity=".15"/>${island(110, 86)}${hero(66, 50, "t1")}${hero(110, 50, "t2")}<circle cx="99" cy="44" r="6" fill="#ffd65b"/><circle cx="121" cy="44" r="6" fill="#ffd65b"/><text x="110" y="28">TWO PER ISLAND</text>`;
  if (kind === "prison")
    art = `${water}<circle cx="80" cy="78" r="30" fill="#bff6ff" opacity=".25" stroke="#7fe9ff" stroke-width="3"/>${hero(59, 55, "p1")}${hero(140, 58, "p2")}<path class="raid-guide-bolt" d="m140 78-22-2 8-6-12-6 18 2-6-6Z" fill="#ffe17b"/><circle cx="62" cy="38" r="5" fill="#ffd65b"/><circle cx="80" cy="38" r="5" fill="#ffd65b"/><circle cx="98" cy="38" r="5" fill="#0c1b32" stroke="#ffd65b"/><text x="110" y="24">POP IT: 3 HITS</text>`;
  // Center the complete two-character scene; center its caption on the card.
  if (kind === "revive") art = `<g transform="translate(-14 -8)">${art}</g>`;
  return `<svg class="raid-guide-scene" viewBox="0 0 220 135" aria-hidden="true">${floor}${art}</svg>`;
}
