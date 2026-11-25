import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { creatureLayers } from "../../apps/client/src/creature-design";
import { ABYSSAL_TEAM } from "../../apps/client/src/skins/collection-colours";
import type { Facing } from "../../apps/client/src/animation/controller";
import { EPIC_PROPS } from "../../apps/client/src/skins/epic-props";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const dirs: Facing[] = ["down", "left", "right", "up"];
const epics = CHAMPION_SKINS.filter((s) => s.rarity === "epic");
const all = (skin: string, id: CharacterId, dir: Facing) =>
  Object.values(creatureLayers(id, dir, "normal", { skin, stage: 1 }).layers).join("");

describe("Epic skins (3,500 coins)", () => {
  it("dress every Epic in a costume piece: none is a recolour alone", () => {
    for (const s of epics) {
      const art = SKIN_ART[s.id];
      expect(art, s.id).toBeTruthy();
      expect(art.accessories?.length ?? 0, s.id).toBeGreaterThan(0);
    }
  });

  it("tailor Hero Squad, Neon Campus, Starlight Idol and the champions' own costumes front and back", () => {
    const tailored = epics.filter((s) => SKIN_ART[s.id].accessories?.some((a) => a === "modern-hero" || a === "modern-campus" || a === "modern-idol" || a === "modern-kit"));
    expect(tailored.length).toBe(18 * 3 + 11);
    // Costumes that are not a garment over the body: a wax capelet, a knitted
    // scarf, a jelly collar and cape, a geode on the shell.
    const pieces = ["duskveil-candlelight", "pyranda-fireside-knit", "glacelle-deep-glow"];
    const miss: string[] = [];
    for (const s of tailored.filter((s) => !pieces.includes(s.id)))
      for (const dir of dirs) {
        if (s.id === "terradon-geode" && dir === "up") continue;
        const svg = all(s.id, s.champion, dir);
        // Cloth shading, and stitching (front hem or back topstitch).
        if (!svg.includes("epic-cloth-v") || !svg.includes('stroke-dasharray="1.8 1.5"')) miss.push(`${s.id} ${dir}`);
      }
    expect(miss).toEqual([]);
  });

  it("give every Hero Squad and Neon Campus skin a signature prop of its own", () => {
    for (const [theme, table] of Object.entries(EPIC_PROPS)) {
      expect(Object.keys(table).sort(), theme).toEqual([...ids].sort());
      expect(new Set(Object.values(table)).size, theme).toBe(ids.length);
    }
    // Each draws a piece in every view, through the shared kit.
    const calls = (fn: (k: any) => void, side: number, back: boolean) => {
      const parts: string[] = [];
      const svg = () => "<g/>";
      fn({ id: "voltkit", side, back, hx: 100, ht: 44, C: 100, T: 121, B: 164, W: 25, L: 75, R: 125, ink: "#000", epic: true,
        put: (part: string) => parts.push(part), path: svg, line: svg, circle: svg, rect: svg, lume: svg, garment: svg, star: () => "M0 0Z" });
      return parts;
    };
    for (const [theme, table] of Object.entries(EPIC_PROPS))
      for (const [id, fn] of Object.entries(table))
        for (const [side, back] of [[0, false], [-1, false], [1, false], [0, true]] as const)
          expect(calls(fn as (k: any) => void, side, back).length, `${theme} ${id} ${side} ${back}`).toBeGreaterThan(0);
  });

  it("hand Stargazer its telescope and Moon Blink its moon staff in place of the mallet", () => {
    // The mallet's head: its path, as the champion draws it front and side.
    const MALLET = /fill="#d29a5c"/;
    for (const dir of dirs) {
      expect(all("astrabun-neon-campus", "astrabun", dir), `campus ${dir}`).not.toMatch(MALLET);
      expect(all("astrabun-hero-squad", "astrabun", dir), `hero ${dir}`).not.toMatch(MALLET);
      expect(Object.values(creatureLayers("astrabun", dir).layers).join(""), `own ${dir}`).toMatch(MALLET);
    }
  });

  it("keep Legendary's marks off Epics: no gold rim, no clasp, no aura or motif", () => {
    for (const s of epics) {
      const art = SKIN_ART[s.id];
      expect(art.signature, s.id).toBeUndefined();
      expect(art.vanguard, s.id).toBeUndefined();
      const svg = all(s.id, s.champion, "down");
      expect(svg, s.id).not.toContain("#f2c14e\" stroke-width=\"3.2\"");
    }
  });

  it("give each Abyssal diver its own sea and team colour, so the eighteen tell apart", () => {
    const mids = ids.map((id) => SKIN_ART[`${id}-abyssal-expedition`].palette.mid!);
    expect(new Set(mids).size).toBe(ids.length);
    expect(new Set(ids.map((id) => ABYSSAL_TEAM[id].hue)).size).toBe(ids.length);
    for (const id of ids)
      expect(all(`${id}-abyssal-expedition`, id, "up"), id).toContain(ABYSSAL_TEAM[id].team);
  });
});
