import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  JOURNEY_ITEMS,
  JOURNEY_ITEM_BY_ID,
  LEVEL_ITEMS,
  LEVEL_MILESTONES,
  itemLevel,
  levelThreshold,
  milestoneNames,
  type Journey,
} from "../../packages/shared/src/journey";
import {
  cosmeticTier,
  tierRank,
} from "../../packages/shared/src/cosmetic-tier";
import { isColors } from "../../apps/client/src/skins/colors-fx";
import { framePortrait } from "../../apps/client/src/portraits";
import { levelBar, resultXp } from "../../apps/client/src/adventure-ui";
import {
  journeyMarkup,
  journeyView,
} from "../../apps/client/src/screens/journey-view";
import {
  FIT_SLOTS,
  ownedFor,
} from "../../apps/client/src/screens/fitting-room-view";
// Everything the Wardrobe (the fitting room) lists for a fighter, all slots.
const wardrobeOwned = (e: any, p: null, champion: any) =>
  FIT_SLOTS.flatMap(([slot]) => ownedFor(slot, champion, e, p));
import {
  SKINS,
  TONES,
  tonePixels,
  type Skin,
} from "../../apps/client/src/animation/cosmetics";
import {
  ECLIPSE_TOTALITY,
  drawCollectionAura,
  drawCollectionAuraBase,
  drawCollectionVictory,
  playCollectionEntrance,
} from "../../apps/client/src/skins/collection-fx";
function graphics() {
  const commands: any[] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args: any[]) => {
          commands.push([k, ...args]);
          return g;
        },
    },
  );
  return { g, commands };
}
it.each(JOURNEY_ITEMS.filter((i) => i.slot === "aura"))(
  "animates $id with bounded geometry and a still reduced-motion version",
  (item) => {
    const a = graphics(),
      b = graphics();
    expect(drawCollectionAura(a.g, item.id, 0, 0, 1000, false)).toBe(true);
    expect(drawCollectionAura(b.g, item.id, 0, 0, 1800, false)).toBe(true);
    // Bounded per frame, including the rarity flourish (tier-fx.ts).
    expect(a.commands.length).toBeLessThan(130);
    expect(a.commands).not.toEqual(b.commands);
    const c = graphics(),
      d = graphics();
    drawCollectionAura(c.g, item.id, 0, 0, 1000, true);
    drawCollectionAura(d.g, item.id, 0, 0, 1800, true);
    expect(c.commands).toEqual(d.commands);
  },
);
it.each(JOURNEY_ITEMS.filter((i) => i.slot === "victory"))(
  "draws the real $id finale and emits its initial particles only once",
  (item) => {
    const a = graphics(),
      emit = vi.fn();
    expect(
      drawCollectionVictory(
        a.g,
        a.g,
        emit,
        // No random extras: count only the finale's own opening burst.
        () => false,
        item.id,
        0,
        0,
        1,
        1,
        1 / 60,
        true,
      ),
    ).toBe(true);
    expect(emit).toHaveBeenCalledTimes(12);
    drawCollectionVictory(
      a.g,
      a.g,
      emit,
      () => false,
      item.id,
      0,
      0,
      1,
      1.1,
      1 / 60,
      false,
    );
    expect(emit).toHaveBeenCalledTimes(12);
  },
);
it("implements the Comet arrival entrance and every earned color palette", () => {
  const emit = vi.fn();
  expect(playCollectionEntrance(emit, "comet-arrival", 0, 0, 1)).toBe(true);
  expect(emit).toHaveBeenCalledTimes(18);
  for (const item of JOURNEY_ITEMS.filter((i) => i.slot === "skin")) {
    expect(SKINS).toContain(item.id);
    expect(TONES[item.id as Skin]).toBeDefined();
    const pixels = new Uint8ClampedArray([220, 140, 60, 255, 90, 40, 80, 127]);
    tonePixels(pixels, item.id as Skin);
    expect([...pixels]).not.toEqual([220, 140, 60, 255, 90, 40, 80, 127]);
    expect(pixels[3]).toBe(255);
    expect(pixels[7]).toBe(127);
  }
});

// ── The Lv 55–100 rewards (docs/hub-redesign/PLAN.md decision 10). ──
const ENDGAME = [
  [55, "prism-frame", "Prism frame", "frame"],
  [65, "nova-entrance", "Nova entrance", "entrance"],
  [70, "starlit-colors", "Starlit colors", "skin"],
  [80, "solar-aura", "Solar aura", "aura"],
  [85, "eclipse-finale", "Eclipse finale", "victory"],
  [95, "prismatic-laurel", "Prismatic laurel", "frame"],
  [100, "element-master-frame", "Element Master frame", "frame"],
] as const;
const journeyAt = (xp: number, recent: Journey["recent"] = []): Journey => ({
  xp,
  recent,
  season: {
    id: "2026-12",
    xp: 0,
    week: "2026-11-30",
    goals: {},
    completed: [],
  },
  unlocked: [],
});

it("puts each Lv 55–100 cosmetic at its level, beside the titles at 60, 75, 90 and 100", () => {
  for (const [level, id, name, slot] of ENDGAME) {
    const m = LEVEL_MILESTONES.find((x) => x.level === level)!;
    expect(m.item, `level ${level}`).toBe(id);
    expect(JOURNEY_ITEM_BY_ID[id]).toMatchObject({ name, slot });
    expect(LEVEL_ITEMS.map((i) => i.id)).toContain(id);
    expect(itemLevel(id)).toBe(level);
  }
  expect(
    LEVEL_MILESTONES.filter((m) => m.level > 50 && m.title).map((m) => [
      m.level,
      m.title,
    ]),
  ).toEqual([
    [60, "Arena Veteran"],
    [75, "Mythic Champion"],
    [90, "Ascendant"],
    [100, "Element Master"],
  ]);
  // Lv 100 gives both, in that order.
  expect(milestoneNames(LEVEL_MILESTONES.at(-1)!)).toEqual([
    "Element Master",
    "Element Master frame",
  ]);
  expect(itemLevel("season-ember-frame")).toBeUndefined();
});

it("matches the level rewards in the hub redesign numbers (NUMBERS.md)", () => {
  const line = readFileSync("docs/hub-redesign/NUMBERS.md", "utf8")
    .split("\n")
    .find((l) => l.includes("Level rewards (cosmetics/titles):"))!;
  const rewards = [...line.matchAll(/Lv (\d+) ([^·]+?)(?= ·|\.?$)/g)].map(
    ([, level, text]) => [Number(level), text.trim()] as const,
  );
  expect(rewards.length).toBe(18); // Lv 15–100
  for (const [level, text] of rewards) {
    const m = LEVEL_MILESTONES.find((x) => x.level === level)!;
    if (level === 100) {
      // "Title: Element Master + prismatic frame": the frame is named after
      // the title so it can't be mistaken for the Lv 55 Prism frame.
      expect(text).toBe("Title: Element Master + prismatic frame");
      expect(m.title).toBe("Element Master");
      expect(JOURNEY_ITEM_BY_ID[m.item!].slot).toBe("frame");
      expect(JOURNEY_ITEM_BY_ID[m.item!].description).toMatch(/prismatic/i);
    } else if (text.startsWith("Title: ")) expect(m.title).toBe(text.slice(7));
    else expect(JOURNEY_ITEM_BY_ID[m.item!]?.name, `level ${level}`).toBe(text);
  }
});

it("ranks the endgame rewards Mythical, above every Lv 10–45 reward", () => {
  for (const [, id] of ENDGAME) expect(cosmeticTier(id), id).toBe("mythic");
  for (const m of LEVEL_MILESTONES)
    if (m.item && m.level < 55)
      expect(tierRank(cosmeticTier(m.item)), m.item).toBeLessThan(
        tierRank("mythic"),
      );
});

it("draws the Solar aura as its own sun, not the shared journey diamonds", () => {
  const solar = graphics(),
    astral = graphics();
  expect(drawCollectionAuraBase(solar.g, "solar-aura", 0, 0, 1000, false)).toBe(
    true,
  );
  drawCollectionAuraBase(astral.g, "astral-aura", 0, 0, 1000, false);
  const count = (c: any[][], k: string) => c.filter(([n]) => n === k).length;
  // Twelve corona rays and three small suns (a glow and a core each).
  expect(count(solar.commands, "fillTriangle")).toBe(12);
  expect(count(solar.commands, "fillCircle")).toBe(6);
  expect(solar.commands).toContainEqual(["fillStyle", 0xffd36b, 0.85]);
  expect(count(astral.commands, "fillTriangle")).toBe(16); // 8 diamonds
});

it("bursts the Nova entrance inward and out, bigger than Comet arrival", () => {
  const nova: any[] = [],
    comet: any[] = [];
  expect(
    playCollectionEntrance((p) => nova.push(p), "nova-entrance", 0, 0, 1),
  ).toBe(true);
  playCollectionEntrance((p) => comet.push(p), "comet-arrival", 0, 0, 1);
  expect(nova.length).toBeGreaterThan(comet.length * 3);
  const shapes = new Set(nova.map((p) => p.shape));
  for (const shape of ["ray", "ring", "star", "beam", "shock"])
    expect(shapes, shape).toContain(shape);
  // Starlight rushing in: stars starting away from the centre, flying at it.
  const cy = -40;
  const inward = nova.filter(
    (p) =>
      p.shape === "star" &&
      Math.hypot(p.x, p.y - cy) > 50 &&
      p.vx * (0 - p.x) + p.vy * (cy - p.y) > 0,
  );
  expect(inward.length).toBe(16);
  expect(nova.every((p) => p.glow)).toBe(true);
});

it("plays the Eclipse finale: the moon covers the sun at totality, with one burst each", () => {
  const sunAndMoon = (t: number) => {
    const under = graphics(),
      top = graphics();
    drawCollectionVictory(
      top.g,
      under.g,
      () => {},
      () => false,
      "eclipse-finale",
      0,
      0,
      1,
      t,
      1 / 60,
      false,
    );
    const circles = under.commands.filter(([k]) => k === "fillCircle");
    // The glow, the sun, then the moon.
    return { sun: circles[1], moon: circles[2], under: under.commands };
  };
  const early = sunAndMoon(0.6),
    total = sunAndMoon(ECLIPSE_TOTALITY + 0.2);
  expect(early.moon[1] - early.sun[1]).toBeGreaterThan(early.sun[3]);
  expect(total.moon[1]).toBeCloseTo(total.sun[1]);
  expect(total.moon[2]).toBeCloseTo(total.sun[2]);
  // At totality the corona's 16 rays flare round it (on top of the tier's
  // own light rays, drawn the whole time).
  const rays = (c: any[][]) => c.filter(([k]) => k === "fillTriangle").length;
  expect(rays(total.under) - rays(early.under)).toBe(16);
  // Twelve stars as it starts, sixteen exactly once as totality begins.
  const emit = vi.fn(),
    g = graphics().g;
  const dt = 1 / 30;
  let first = true;
  for (let t = 0; t <= 2.9; t += dt) {
    drawCollectionVictory(
      g,
      g,
      emit,
      () => false,
      "eclipse-finale",
      0,
      0,
      1,
      t,
      dt,
      first,
    );
    first = false;
  }
  expect(emit).toHaveBeenCalledTimes(12 + 16);
});

it("gives Starlit colors a midnight palette of its own, with its motif and tier effects", () => {
  expect(SKINS).toContain("starlit-colors");
  expect(isColors("starlit-colors")).toBe(true);
  expect(TONES["starlit-colors"]).not.toEqual(TONES["starlit-skin"]);
  // A bright yellow body turns blue; shadows turn midnight.
  const px = new Uint8ClampedArray([255, 214, 91, 255, 40, 30, 20, 255]);
  tonePixels(px, "starlit-colors");
  expect(px[2]).toBeGreaterThan(px[0] + 40);
  expect(Math.max(px[4], px[5], px[6])).toBeLessThan(90);
  expect(px[6]).toBeGreaterThan(px[4] + 30);
});

it("frames the portrait with each new frame's own artwork", () => {
  const css = readFileSync("apps/client/src/journey-frames.css", "utf8");
  expect(readFileSync("apps/client/src/main.ts", "utf8")).toContain(
    'import "./journey-frames.css";',
  );
  for (const id of [
    "prism-frame",
    "prismatic-laurel",
    "element-master-frame",
  ]) {
    expect(framePortrait("<svg></svg>", id)).toContain(
      `data-portrait-frame="${id}"`,
    );
    for (const part of ["::before", "::after"])
      expect(css).toMatch(
        new RegExp(
          `\\[data-cosmetic="${id}"\\]${part} \\{[^}]*data:image/svg\\+xml`,
        ),
      );
  }
});

it("lists every Lv 55–100 reward in the Journey's Levels tab and names them on level-ups", () => {
  const e = {
    journey: journeyAt(levelThreshold(100)),
    balance: 0,
    owned: [],
  } as any;
  const html = journeyMarkup(journeyView("levels"), {
    economy: e,
    look: {},
    champion: "voltkit",
  });
  for (const [level, , name] of ENDGAME)
    expect(html).toContain(
      `<small>Level ${level}</small><b>${name}</b><em>✓ Earned</em>`,
    );
  expect(html).toContain(
    "<small>Level 100</small><b>Element Master</b><em>✓ Earned</em>",
  );
  // One card per title and per cosmetic.
  const cards = LEVEL_MILESTONES.reduce(
    (n, m) => n + (m.title ? 1 : 0) + (m.item ? 1 : 0),
    0,
  );
  expect(html.match(/class="journey-prize[ "]/g)).toHaveLength(cards);
  expect(html.match(/✓ Earned/g)).toHaveLength(cards);
  expect(levelBar(journeyAt(levelThreshold(96)))).toContain(
    "Next milestone · Level 100 · Element Master + Element Master frame",
  );
  expect(levelBar(journeyAt(levelThreshold(52)))).toContain(
    "Next milestone · Level 55 · Prism frame",
  );
  const at = "2026-12-01T00:00:00Z";
  const card = resultXp(
    journeyAt(levelThreshold(55) + 10, [
      { ref: "match:x", source: "match", amount: 75, at },
    ]),
    "match:x",
    "saved",
  );
  expect(card).toContain("LEVEL UP · 54 → 55");
  expect(card).toContain("+100 coins · Prism frame");
});

it("shows owned Journey rewards in the Wardrobe, for every fighter", () => {
  const e = {
    owned: ["prism-frame", "solar-aura", "season-ember-frame", "galaxy-aura"],
  } as any;
  for (const champion of ["voltkit", "duskveil"] as const) {
    const ids = wardrobeOwned(e, null, champion).map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "prism-frame",
        "solar-aura",
        "season-ember-frame",
        "galaxy-aura",
      ]),
    );
    expect(ids).not.toContain("eclipse-finale");
    expect(
      wardrobeOwned(e, null, champion).find((i) => i.id === "solar-aura"),
    ).toMatchObject({
      slot: "aura",
      source: "Journey reward",
    });
  }
});
