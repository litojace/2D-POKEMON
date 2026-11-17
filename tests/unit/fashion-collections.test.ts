import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  FASHION_COLLECTION_IDS,
  FASHION_SKINS,
} from "../../packages/shared/src/shop";
import { epicBodyCut } from "../../apps/client/src/skins/epic-fashion";
import { fashionCut } from "../../apps/client/src/skins/fashion-fits";
import { fashionOutfit } from "../../apps/client/src/skins/fashion-outfits";
import { HEAD, SKIN_ART } from "../../apps/client/src/skins/skin-art";
import {
  creatureLayers,
  creaturePalette,
} from "../../apps/client/src/creature-design";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const dirs = ["down", "left", "right", "up"] as const;
// Ignore paint, labels and coordinates in metadata: uniqueness must be in the
// authored shapes, not merely a different skin id or palette.
const shapes = (svg: string) =>
  [...svg.matchAll(/(?:\sd="([^"]+)"|<(circle|ellipse)[^>]+>)/g)]
    .map((m) => m[1] ?? m[0].replace(/(?:fill|stroke)="[^"]*"/g, ""))
    .join("|");

const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
};
const distance = (a: string, b: string) =>
  Math.hypot(
    ...[1, 3, 5].map(
      (i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
    ),
  );

describe("fashion collection colors", () => {
  it("gives each Rare collection its own body color for every champion", () => {
    for (const id of ids) {
      const mids = ["wayfarer", "moonlit-tea", "astral-court"].map(
        (c) => SKIN_ART[`${id}-${c}`].palette!.mid!,
      );
      for (let i = 0; i < mids.length; i++)
        for (let j = i + 1; j < mids.length; j++)
          expect(distance(mids[i], mids[j]), `${id} ${i}/${j}`).toBeGreaterThan(
            45,
          );
    }
  });
  it("keeps each champion's light and dark markings (Duskveil's void face, Pyranda's mask)", () => {
    for (const id of ids)
      for (const c of [
        "wayfarer",
        "moonlit-tea",
        "astral-court",
        "abyssal-expedition",
      ])
        for (const key of ["accent", "dark"] as const) {
          const was = lightness(creaturePalette[id][key]);
          const now = lightness(SKIN_ART[`${id}-${c}`].palette![key]!);
          expect(Math.abs(now - was), `${id}-${c} ${key}`).toBeLessThan(0.12);
        }
  });
});

describe("authored fashion collections", () => {
  it("replaces conflicting default props without covering faces or removing Halcyra's beak", () => {
    for (const collection of ["abyssal-expedition", "dream-carnival"] as const)
      for (const dir of dirs) {
        for (const id of ids) {
          const { layers } = creatureLayers(id, dir, "normal", {
            skin: `${id}-${collection}`,
          });
          // Neckwear belongs below the face, not in the last-painted scarf layer.
          expect(layers.scarf, `${id} ${collection} ${dir}`).toBe("");
          expect(layers.body).toContain("epic-fashion");
        }
        for (const id of ["voltkit", "tidefin", "sunbara"] as const) {
          const original = creatureLayers(id, dir).layers.flame;
          const dressed = creatureLayers(id, dir, "normal", {
            skin: `${id}-${collection}`,
          }).layers.flame;
          for (const [, d] of original.matchAll(/\sd="([^"]+)"/g))
            expect(dressed, `${id}: old prop must not remain`).not.toContain(
              `d="${d}"`,
            );
        }
        const beak = creatureLayers("halcyra", dir).layers.flame;
        const dressed = creatureLayers("halcyra", dir, "normal", {
          skin: `halcyra-${collection}`,
        }).layers.flame;
        const beakPaths = [...beak.matchAll(/\sd="([^"]+)"/g)];
        if (dir !== "up") expect(beakPaths.length).toBeGreaterThan(0);
        for (const [, d] of beakPaths) expect(dressed).toContain(`d="${d}"`);
      }
  });

  it("gives the new Epics independent geometry from every retained Rare collection", () => {
    const rares = FASHION_SKINS.filter((s) => s.rarity === "rare");
    expect(rares).toHaveLength(ids.length * 3);
    expect(
      FASHION_SKINS.some(
        (s) => (s.collection as string) === "clockwork-reverie",
      ),
    ).toBe(false);
    for (const id of ids)
      for (const dir of dirs) {
        const deep = epicBodyCut(id, dir, "abyssal-expedition"),
          stage = epicBodyCut(id, dir, "dream-carnival");
        expect(deep).not.toBe(stage);
        for (const rare of rares.filter((s) => s.champion === id)) {
          const cut = fashionCut(
            id,
            dir,
            rare.collection as (typeof FASHION_COLLECTION_IDS)[number],
          );
          expect(deep).not.toBe(cut);
          expect(stage).not.toBe(cut);
        }
      }
  });

  it("gives each Rare collection its own silhouette for every champion and facing", () => {
    const rares = ["wayfarer", "moonlit-tea", "astral-court"] as const;
    for (const id of ids)
      for (const dir of dirs) {
        const looks = rares.map((c) => {
          const layers = fashionOutfit(
            c,
            id,
            dir,
            SKIN_ART[`${id}-${c}`].palette as any,
            HEAD[id][dir],
          );
          return { c, layers, svg: layers.map(([, s]) => s).join("") };
        });
        // No two collections share their construction.
        const shapeSets = looks.map((l) => shapes(l.svg));
        expect(new Set(shapeSets).size, `${id} ${dir}`).toBe(3);
        // ...and not merely in a detail: at most a fifth of either's
        // shapes may also appear in another collection.
        for (let i = 0; i < 3; i++)
          for (let j = i + 1; j < 3; j++) {
            const A = new Set(shapeSets[i].split("|")),
              B = new Set(shapeSets[j].split("|"));
            const shared = [...A].filter((s) => B.has(s)).length;
            expect(
              shared / Math.min(A.size, B.size),
              `${id} ${dir} ${rares[i]}/${rares[j]}`,
            ).toBeLessThan(0.2);
          }
        const [way, tea, court] = looks;
        // Wayfarer: a pack (behind the torso, or over the back from behind).
        expect(way.svg, `${id} ${dir} pack`).toContain('rx="6"');
        // Moonlit Tea: a kanzashi on the head; Astral Court: a star circlet.
        expect(
          tea.layers.some(([p]) => p === "flame"),
          `${id} ${dir} kanzashi`,
        ).toBe(true);
        expect(
          court.layers.some(([p]) => p === "flame"),
          `${id} ${dir} circlet`,
        ).toBe(true);
        // From behind, shells and glider membranes cover the back, so the
        // pack, obi bow and mantle sit on the part painted last there.
        if (dir === "up")
          for (const l of looks)
            expect(
              l.layers.some(([p]) => p === "scarf"),
              `${id} ${l.c} back`,
            ).toBe(true);
      }
  });
  it("keeps Rare idle effects silent and Epic details within a small drawing budget", () => {
    for (const skin of FASHION_SKINS)
      for (const now of [100, 600, 1200]) {
        let commands = 0,
          emissions = 0;
        const g: any = new Proxy(
          {},
          {
            get: () => () => {
              commands++;
              return g;
            },
          },
        );
        const ctx = {
          g,
          under: g,
          emit: () => emissions++,
          chance: () => true,
          x: 100,
          y: 160,
          headX: 100,
          headY: 90,
          sc: 1,
          now,
          dt: 1 / 60,
          angle: 0,
          moving: false,
          dashing: false,
          hurt: false,
          defeated: false,
          greeting: false,
          celebrating: false,
          knockedOut: false,
          ultimate: false,
          ambient: false,
        } as unknown as FxContext;
        drawSkinFx(ctx, SKIN_ART[skin.id], 1);
        expect(emissions, skin.id).toBe(0);
        expect(commands, skin.id).toBeLessThanOrEqual(
          skin.rarity === "rare" ? 0 : 20,
        );
      }
  });
  it("gives every champion one Rare/Epic costume in each new collection", () => {
    expect(FASHION_SKINS).toHaveLength(
      ids.length * FASHION_COLLECTION_IDS.length,
    );
    for (const collection of FASHION_COLLECTION_IDS) {
      const skins = FASHION_SKINS.filter((s) => s.collection === collection);
      expect(skins.map((s) => s.champion).sort()).toEqual([...ids].sort());
      expect(new Set(skins.map((s) => s.name)).size).toBe(ids.length);
    }
  });
  it("has a distinct garment cut for every champion, with separately authored side and back", () => {
    for (const dir of ["down", "left", "up"] as const) {
      expect(
        new Set(ids.map((id) => fashionCut(id, dir, "wayfarer"))).size,
      ).toBe(ids.length);
    }
    for (const id of ids)
      expect(
        new Set(
          ["down", "left", "up"].map((dir) =>
            fashionCut(id, dir as (typeof dirs)[number], "wayfarer"),
          ),
        ).size,
        id,
      ).toBe(3);
  });
  it("keeps individual equipment on rig joints and does not reuse a painted front from behind", () => {
    for (const skin of FASHION_SKINS) {
      const art = SKIN_ART[skin.id],
        views: string[] = [];
      for (const dir of dirs) {
        const layers = fashionOutfit(
          skin.collection as (typeof FASHION_COLLECTION_IDS)[number],
          skin.champion,
          dir,
          art.palette as any,
          HEAD[skin.champion][dir],
        );
        expect(layers.length, skin.id).toBeGreaterThanOrEqual(2);
        const svg = layers.map(([, svg]) => svg).join("");
        expect(svg, skin.id).toMatch(/class="[^"]*\bfashion-signature\b/);
        expect(svg, skin.id).not.toMatch(/NaN|undefined|Infinity/);
        views.push(shapes(svg));
      }
      expect(views[0], skin.id).not.toBe(views[3]);
      expect(views[0], skin.id).not.toBe(views[1]);
    }
  });
});
