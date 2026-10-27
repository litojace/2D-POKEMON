import type { CharacterId } from "@arena/shared";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { raidGuideSprite } from "./raid-guide-sprites";
import { raidCrest } from "./raid-crests";
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
/**
 * Gloomshade in miniature: a floppy-eared shadow puff with a crescent-moon
 * tail. `shadow` draws its ground shadow: the tell that marks the real one.
 */
export function raidGuideGloomshade(exposed = false, shadow = true) {
  const core = exposed ? '<circle cy="20" r="10" fill="#ffd65b" opacity=".45" stroke="none"/><circle cy="20" r="5" fill="#fff1c2"/>' : "";
  return `<g stroke="#18122b" stroke-width="2" stroke-linejoin="round">${shadow ? '<ellipse cx="6" cy="38" rx="38" ry="8" fill="#071325" opacity=".55" stroke="none"/>' : ""}<circle cx="-38" cy="12" r="8" fill="#2b2245"/><circle cx="-46" cy="6" r="6" fill="#2b2245"/><path d="M-50-20a16 16 0 1 0 0 32a20 20 0 0 1 0-32Z" fill="#ffd65b"/>${[-24, -12, 0, 12, 24].map((x) => `<circle cx="${x}" cy="28" r="9" fill="#18122b"/>`).join("")}<ellipse cx="-30" cy="0" rx="11" ry="26" fill="#2b2245"/><ellipse cx="30" cy="0" rx="11" ry="26" fill="#2b2245"/><circle cy="-4" r="34" fill="#2b2245"/><ellipse cx="-6" cy="-20" rx="22" ry="12" fill="#4a3d72" opacity=".6" stroke="none"/><ellipse cx="-11" cy="-8" rx="7" ry="9" fill="#fff3c4" stroke="none"/><ellipse cx="13" cy="-8" rx="7" ry="9" fill="#fff3c4" stroke="none"/><ellipse cx="-10" cy="-7" rx="3.5" ry="5" fill="#18122b" stroke="none"/><ellipse cx="14" cy="-7" rx="3.5" ry="5" fill="#18122b" stroke="none"/><circle cx="-8" cy="-11" r="1.6" fill="#fff" stroke="none"/><circle cx="16" cy="-11" r="1.6" fill="#fff" stroke="none"/><path d="M-3 6q4 4 8 0" fill="none" stroke="#fff3c4"/>${core}</g>`;
}
/** Somnara's sleepy whale, cloud cap and tiny cottage. */
export function raidGuideSomnara(exposed = false) {
  return `<g stroke="#283452" stroke-width="2" stroke-linejoin="round"><ellipse cy="35" rx="48" ry="9" fill="#0b1430" opacity=".4"/><path d="m30-4 28-16-8 20 10 16-28-9" fill="#7061ac"/><ellipse cy="5" rx="45" ry="27" fill="#8977c5"/><ellipse cy="17" rx="38" ry="14" fill="#c3b3eb"/><ellipse cx="7" cy="-21" rx="23" ry="7" fill="#99c6bf"/><path d="M-2-24v-15h18v15M-6-38l13-12 14 12Z" fill="#f0d6b9"/><path d="m-18-24-12-13-8 10" fill="#d3d8ed"/><circle cx="-37" cy="-27" r="7" fill="#d3d8ed"/><path d="M-32 0q5 5 10 0M-32 14q7 6 14 0" fill="none"/>${exposed ? '<path d="m-8 9 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffdf8d"/>' : '<path d="m-8-7 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#f6e8ff"/>'}</g>`;
}
/** The boss's miniature for lobbies and results. */
export function raidGuideBossFor(boss: string, exposed = false) {
  return boss === "storm-twins" ? raidCrest("storm-twins").replace(/<svg[^>]*>/, '<g transform="translate(-45 -50) scale(.9)">').replace("</svg>", "</g>") : boss === "emberwing" ? raidCrest("emberwing").replace(/<svg[^>]*>/, '<g transform="translate(-45 -50) scale(.9)">').replace("</svg>", "</g>") : boss === "prismatail" ? raidCrest("prismatail").replace(/<svg[^>]*>/, '<g transform="translate(-45 -50) scale(.9)">').replace("</svg>", "</g>") : boss === "somnara" ? raidGuideSomnara(exposed) : boss === "tidewyrm"
    ? raidGuideTidewyrm(exposed)
    : boss === "gloomshade"
      ? raidGuideGloomshade(exposed)
      : raidGuideBoss(exposed);
}
export function raidGuideScene(
  kind: "opening" | "two-hearts" | "polarity-pair" | "twin-finish" | "braziers" | "ground-bird" | "heat-spread" | "relay" | "mirror" | "glare" | "charge" | "core" | "revive" | "strand" | "tide" | "prison" | "lantern" | "shadow" | "curse" | "dream" | "runes" | "quiet",
  character: CharacterId,
  boss: RaidBossId = "grumblecrag",
) {
  const hero = (x: number, y: number, n: string) =>
    `<g transform="translate(${x} ${y})">${scopeIds(fighterArt(character), "raid-guide-" + kind + n).replace("<svg ", '<svg width="42" height="45" ')}</g>`;
  const floor =
    '<path d="M0 30h220M0 60h220M0 90h220M0 120h220M25 0v135M65 0v135M105 0v135M145 0v135M185 0v135" stroke="#8ca0bb" opacity=".12"/>';
  let art = "";
  if (kind === "opening")
    art = `${hero(18, 66, "open")}<g transform="translate(145 74) scale(.85)">${raidGuideSprite(boss, true)}</g><path class="raid-guide-bolt" d="m67 87 18-14-2 9 26-16-17 23 1-10Z" fill="#ffe17b"/><text x="110" y="18">OPENING: ATTACK NOW</text>`;
  if (kind === "charge")
    art = `<path d="M25 51h148v39H25Z" fill="#ff4059" opacity=".18"/><path d="M25 51h148M25 90h148" stroke="#ff4059" stroke-width="2"/><path class="raid-guide-arrows" d="m84 61 10 10-10 10m21-20 10 10-10 10m21-20 10 10-10 10" fill="none" stroke="#ff8c99" stroke-width="3"/><g class="raid-guide-charger"><g transform="translate(39 61) scale(.57)">${raidGuideSprite("grumblecrag")}</g></g><path d="m143 44 22-3 9 6v39l-25 4-9-7Z" fill="#738887" stroke="#253c3b" stroke-width="2"/><path d="m149 49 9 8-5 9 7 8" stroke="#c9ddd2" fill="none"/>${hero(177, 57, "a")}<path d="M194 102q-4 17-32 16" stroke="#8beed2" stroke-width="2" stroke-dasharray="4 4" fill="none"/><text x="155" y="31">PILLAR</text>`;
  if (kind === "core")
    art = `${hero(18, 66, "b")}<g transform="translate(145 74) scale(.85)">${raidGuideSprite("grumblecrag", true)}</g><path class="raid-guide-bolt" d="m67 87 18-14-2 9 26-16-17 23 1-10Z" fill="#ffe17b"/><rect x="107" y="111" width="78" height="5" rx="2" fill="#203c4b"/><rect x="107" y="111" width="58" height="5" rx="2" fill="#82ffe7"/><text x="145" y="26">CORE OPEN</text>`;
  if (kind === "revive")
    art = `<ellipse cx="144" cy="85" rx="42" ry="27" fill="#82ffe7" opacity=".09"/><ellipse cx="144" cy="85" rx="42" ry="27" stroke="#82ffe7" stroke-width="2" fill="none"/>${hero(61, 55, "c")}<g transform="translate(150 91) rotate(75)">${hero(-21, -35, "d")}</g><path class="raid-guide-revive" d="M113 88q30-35 59-6" fill="none" stroke="#a7ffb2" stroke-width="4" stroke-linecap="round"/><path d="M145 48v14m-7-7h14" stroke="#a7ffb2" stroke-width="3"/><text x="124" y="119">REVIVING</text>`;
  const island = (x: number, y: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="34" ry="20" fill="#f2fbfa" opacity=".6"/><ellipse cx="${x}" cy="${y}" rx="30" ry="17" fill="#e2c88f" stroke="#c9a86a" stroke-width="2"/>`;
  const water = '<rect width="220" height="135" fill="#1f8fa6" opacity=".35"/>';
  if (kind === "strand")
    art = `${water}${island(150, 82)}<g transform="translate(150 70) scale(.55)">${raidGuideSprite("tidewyrm", true)}</g><circle cx="150" cy="82" r="26" fill="none" stroke="#7fe9ff" stroke-width="2" stroke-dasharray="4 4"/>${hero(44, 62, "s")}<path d="M90 90q24 12 38 0" stroke="#8beed2" stroke-width="2" stroke-dasharray="4 4" fill="none"/><text x="150" y="28">STRANDED</text>`;
  if (kind === "tide")
    art = `${water}<rect width="220" height="135" fill="#7fe9ff" opacity=".15"/>${island(110, 86)}${hero(66, 50, "t1")}${hero(110, 50, "t2")}<circle cx="99" cy="44" r="6" fill="#ffd65b"/><circle cx="121" cy="44" r="6" fill="#ffd65b"/><text x="110" y="28">TWO PER ISLAND</text>`;
  if (kind === "prison")
    art = `${water}<circle cx="80" cy="78" r="30" fill="#bff6ff" opacity=".25" stroke="#7fe9ff" stroke-width="3"/>${hero(59, 55, "p1")}${hero(140, 58, "p2")}<path class="raid-guide-bolt" d="m140 78-22-2 8-6-12-6 18 2-6-6Z" fill="#ffe17b"/><circle cx="62" cy="38" r="5" fill="#ffd65b"/><circle cx="80" cy="38" r="5" fill="#ffd65b"/><circle cx="98" cy="38" r="5" fill="#0c1b32" stroke="#ffd65b"/><text x="110" y="24">POP IT: 3 HITS</text>`;
  const night = '<rect width="220" height="135" fill="#161a30" opacity=".55"/>';
  const post = (x: number, y: number, lit: boolean) =>
    `<g stroke="#23202f" stroke-width="2"><rect x="${x - 3}" y="${y}" width="6" height="34" fill="#23202f"/><rect x="${x - 12}" y="${y + 32}" width="24" height="9" rx="3" fill="#4d4668"/><path d="M${x - 13} ${y - 2}h26l-3 -18h-20Z" fill="${lit ? "#fff1c2" : "#2c2b44"}"/><path d="M${x - 14} ${y - 20}h28l-14 -9Z" fill="#23202f"/></g>`;
  const wisp = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="5" fill="#e0ccff" stroke="#b07bff" stroke-width="2"/>`;
  if (kind === "lantern")
    art = `${night}${post(150, 52, false)}${hero(40, 62, "l")}<path class="raid-guide-bolt" d="m92 82 22-8-6 8 16-4-18 12 4-8Z" fill="#ffe17b"/><circle cx="143" cy="22" r="5" fill="#ffd65b"/><circle cx="157" cy="22" r="5" fill="#0c1b32" stroke="#ffd65b" stroke-width="2"/><text x="150" y="128">TWO HITS</text>`;
  if (kind === "shadow")
    art = `${night}<ellipse cx="110" cy="96" rx="96" ry="30" fill="#ffd27a" opacity=".22"/>${post(110, 40, true)}<g transform="translate(58 70) scale(.5)">${raidGuideSprite("gloomshade", false, true)}</g><g transform="translate(166 70) scale(.5)" opacity=".9">${raidGuideSprite("gloomshade", false, false)}</g><circle cx="58" cy="30" r="9" fill="none" stroke="#ffd65b" stroke-width="3"/><path d="M160 24l12 12m0-12-12 12" stroke="#ff4059" stroke-width="3"/><text x="110" y="128">SHADOW = REAL</text>`;
  if (kind === "curse")
    art = `${night}<circle cx="160" cy="82" r="43" fill="#ffe9a1" fill-opacity=".2"/>${post(187, 46, true)}${hero(20, 57, "c1")}${wisp(23, 54)}${wisp(67, 58)}${wisp(44, 44)}${hero(127, 57, "c2")}<path d="M79 80h29m-8-7 8 7-8 7" stroke="#8beed2" stroke-width="3" fill="none"/><path d="m144 44 5 5 10-12" stroke="#8beed2" stroke-width="3" fill="none"/><text x="110" y="128">STAY IN LIGHT TO CLEANSE</text>`;

  if (kind === "dream") art = `<g transform="translate(156 77) scale(.65)">${raidGuideSprite("somnara")}</g>${hero(38, 64, "dream")}<rect x="25" y="26" width="100" height="28" rx="8" fill="#121c36" stroke="#c9a3ff"/><circle cx="43" cy="40" r="7" fill="none" stroke="#92efdb" stroke-width="2"/><path d="m70 32 3 5 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1Z" fill="#ffdf8d"/><path d="M98 33a8 8 0 1 0 7 11 9 9 0 0 1-7-11Z" fill="#d1b2ff"/><text x="110" y="128">ONLY YOUR DREAMER SEES</text>`;
  if (kind === "runes") art = `<circle cx="48" cy="74" r="25" fill="#92efdb" fill-opacity=".13" stroke="#92efdb" stroke-width="2"/><circle cx="48" cy="74" r="10" fill="none" stroke="#92efdb" stroke-width="3"/><circle cx="158" cy="74" r="25" fill="#ffdf8d" fill-opacity=".13" stroke="#ffdf8d" stroke-width="2"/><path d="m158 60 4 8 10 2-7 6 1 10-8-5-8 5 1-10-7-6 10-2Z" fill="#ffdf8d"/><path d="M82 74h40m-8-6 8 6-8 6" fill="none" stroke="#e4d6ff" stroke-width="3"/><text x="110" y="128">ENTER EACH PAD IN ORDER</text>`;
  if (kind === "quiet") art = `<rect x="10" y="20" width="200" height="88" rx="12" fill="#ff647f" opacity=".15"/><ellipse cx="123" cy="76" rx="54" ry="32" fill="#92efdb" fill-opacity=".2" stroke="#92efdb" stroke-width="3"/>${hero(98, 40, "quiet")}<path d="M47 73h29m-8-7 8 7-8 7" fill="none" stroke="#92efdb" stroke-width="3"/><text x="110" y="128">FOLLOW THE QUIET ZONE</text>`;
  if (kind === "relay") art = `<circle cx="27" cy="60" r="15" fill="#ffe2a0"/>${hero(49, 55, "relay")}<path d="M27 60 70 83 132 57 187 80" fill="none" stroke="#ffe2a0" stroke-width="4"/><path d="m132 40 13 17-13 17-13-17Z" fill="#9ae4ee"/><path d="m187 65 10 15-10 15-10-15Z" fill="#ffe2a0"/><text x="110" y="128">LIGHT → MIRRORS → HEART</text>`;
  if (kind === "mirror") art = `<ellipse cx="110" cy="98" rx="42" ry="12" fill="#08152b"/><path d="m110 30 25 32-25 32-25-32Z" fill="#9ae4ee" stroke="#ffe2a0" stroke-width="3"/><path d="M110 62h61m-12-9 12 9-12 9" stroke="#ffe2a0" stroke-width="4" fill="none"/><path d="M72 73a44 44 0 0 1 69-50m-13-2 13 2-3 13" stroke="#8cebd1" stroke-width="3" fill="none"/><text x="110" y="128">USE TURN MIRROR</text>`;
  if (kind === "glare") art = `<path d="M70 43q40-35 80 0-40 35-80 0Z" fill="#ffe2a0" fill-opacity=".2" stroke="#ffe2a0" stroke-width="3"/><circle cx="110" cy="43" r="11" fill="#ffe2a0"/>${hero(89, 65, "glare")}<path d="M111 90v21m-7-8 7 8 7-8" fill="none" stroke="#8cebd1" stroke-width="3"/><text x="110" y="128">TURN AWAY FROM GLARE</text>`;
  if(kind === "braziers") art = `<path d="M110 30 45 100h130Z" fill="none" stroke="#ffcf91" stroke-width="2" stroke-dasharray="5 4"/>${[[110,30],[45,100],[175,100]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="18" fill="#ffad6c" fill-opacity=".2" stroke="#ffcf91"/><path d="M${x-8} ${y+3}q-4-8 8-19-2 8 6 9 8 12-14 10Z" fill="#ffcf91"/>`).join("")}${hero(24,60,"brazier")}<text x="110" y="128">STAND INSIDE · 1.5s</text>`;
  if(kind === "ground-bird") art = `<g transform="translate(65 52) scale(.75)">${raidGuideSprite("emberwing")}</g><path d="M110 42v50m-8-9 8 9 8-9" stroke="#ffcf91" stroke-width="3" fill="none"/>${hero(151,65,"fire")}<text x="110" y="128">ALL THREE LIT → GROUNDED</text>`;
  if(kind === "heat-spread") art = `<circle cx="57" cy="72" r="35" fill="#ff688c" fill-opacity=".12" stroke="#ff688c"/>${hero(36,45,"mark1")}${hero(150,45,"mark2")}<path d="M103 73h32m-8-7 8 7-8 7" fill="none" stroke="#8be7d0" stroke-width="3"/><text x="110" y="128">SPREAD BEFORE IT BURSTS</text>`;
  if(kind === "two-hearts") art = `<g transform="translate(110 60) scale(.9)">${raidGuideSprite("storm-twins")}</g><rect x="29" y="100" width="68" height="7" rx="3" fill="#ffe18b"/><rect x="123" y="100" width="68" height="7" rx="3" fill="#8edfff"/><text x="110" y="128">TWO SEPARATE HEALTH BARS</text>`;
  if(kind === "polarity-pair") art = `${hero(42,58,"plus")}${hero(133,58,"minus")}<circle cx="63" cy="42" r="15" fill="#ffe18b" fill-opacity=".15" stroke="#ffe18b"/><path d="M55 42h16m-8-8v16" stroke="#ffe18b" stroke-width="3"/><circle cx="154" cy="42" r="15" fill="#8edfff" fill-opacity=".15" stroke="#8edfff"/><path d="M146 42h16" stroke="#8edfff" stroke-width="3"/><path d="m89 77 10-5-10-5m36 10-10-5 10-5" fill="none" stroke="#8de8cf" stroke-width="3"/><text x="110" y="128">OPPOSITE SIGNS CANCEL</text>`;
  if(kind === "twin-finish") art = `<g transform="translate(110 58) scale(.8)">${raidGuideSprite("storm-twins")}</g><circle cx="110" cy="99" r="16" fill="#15243b" stroke="#ffce8c" stroke-width="2"/><path d="M110 89v11l8 4" stroke="#ffce8c" stroke-width="2" fill="none"/><text x="110" y="128">FINISH BEFORE IT REVIVES</text>`;
  // Center the complete two-character scene; center its caption on the card.
  if (kind === "revive") art = `<g transform="translate(-14 -8)">${art}</g>`;
  return `<svg class="raid-guide-scene" viewBox="0 0 220 135" aria-hidden="true">${floor}${art}</svg>`;
}
