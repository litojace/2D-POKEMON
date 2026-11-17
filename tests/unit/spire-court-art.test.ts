/**
 * The Spire court's zone looks (apps/client/src/spire-court-art.ts): the
 * lookup the floor flow calls (`spireZoneTheme`), zone 2's Water look,
 * zone 3's Shadow look, zone 4's Psychic look, zones 1 to 3's paintings
 * left exactly as they were, the floor tint by zone, how the rig reads a
 * snapshot's zone, the boss floors' summit courts and the Echoes' tint on
 * zone 3's dark court and zone 4's pale one.
 */
import { describe, expect, it } from "vitest";
import {
  SPIRE_ZONE_THEMES,
  paintDreamSummitGrade,
  paintLagoonSummitGrade,
  paintLanternSummitGrade,
  paintSpireFloor,
  paintSpireSky,
  paintSpireSummitGrade,
  spireFloorPieces,
  spireFloorTint,
  spireNumberOffset,
  spireTheme,
  spireZoneTheme,
} from "../../apps/client/src/spire-court-art";
import {
  SPIRE_DECK_SUMMIT_FLOOR,
  SPIRE_LAGOON_SUMMIT_FLOOR,
  SPIRE_SUMMIT_FLOOR,
  SPIRE_YARD_SUMMIT_FLOOR,
  hasSpireSummitArena,
  isSpireSummitFloorId,
  nextSpireCourtView,
  spireCourtView,
  spireFloorId,
  spireSummitArt,
  spireSummitFloorId,
  spireSummitFloorOf,
} from "../../apps/client/src/spire-court-rig";
import {
  fingerprint,
  installRecordingDocument,
  recordingContext,
} from "./canvas-recorder";
import {
  ECHO_SKILL_COLOR,
  ECHO_TINT,
  ECHO_TINT_HURT,
  ECHO_TINT_HURT_Z4,
  ECHO_TINT_Z4,
  spireEchoTint,
} from "../../apps/client/src/spire-art";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { r, g, b, l: 0.3 * r + 0.59 * g + 0.11 * b };
};
/** Every painting a zone's floors make, recorded (floors, skies, atlases). */
function paintZone(zone: number, floors: number[]) {
  const log: string[] = [];
  const undo = installRecordingDocument(log);
  try {
    const t = spireZoneTheme(zone);
    paintSpireFloor(recordingContext(log), t);
    for (const f of floors) {
      paintSpireSky(recordingContext(log), t, f);
      const kind = f % 10 === 5 ? "elite" : "wave";
      for (const p of spireFloorPieces(zone, f, kind, 1.4))
        p.paint(recordingContext(log));
    }
  } finally {
    undo();
  }
  return log;
}

describe("spireZoneTheme", () => {
  it("gives zone 1 (Earth), zone 2 (Water), zone 3 (Shadow) and zone 4 (Psychic); unknown zones fall back to zone 1", () => {
    for (const z of [1, 2, 3, 4]) {
      expect(spireZoneTheme(z)).toBe(SPIRE_ZONE_THEMES[z]);
      expect(spireZoneTheme(z).zone).toBe(z);
    }
    for (const z of [0, -1, 5, 99, NaN, 1.5, 2.5, 3.5])
      expect(spireZoneTheme(z)).toBe(SPIRE_ZONE_THEMES[1]);
    // The older name is the same lookup.
    expect(spireTheme).toBe(spireZoneTheme);
  });
  it("zone 2 is pale sea-glass stone with aquamarine crystal and a sea below", () => {
    const one = spireZoneTheme(1),
      two = spireZoneTheme(2);
    for (const key of [
      "slab",
      "top",
      "front",
      "crystal",
      "rune",
      "skyLow",
      "skyHigh",
    ] as const)
      expect(two[key]).not.toEqual(one[key]);
    expect(two.glow).not.toBe(one.glow);
    // Pale, cool stone (zone 1's is warm sandstone).
    const stone = lum(two.slab[0]);
    expect(stone.l).toBeGreaterThan(200);
    expect(stone.b).toBeGreaterThanOrEqual(stone.r);
    expect(lum(one.slab[0]).r).toBeGreaterThan(lum(one.slab[0]).b);
    // Aquamarine crystal: blue-green, bright enough to read on pale stone.
    const crystal = lum(two.crystal[1]);
    expect(crystal.g).toBeGreaterThan(crystal.r + 80);
    expect(crystal.b).toBeGreaterThan(crystal.r + 80);
    // Its carved number groove stays dark against the stone.
    expect(lum(two.carve).l).toBeLessThan(80);
    expect(two.sea).toBeDefined();
    expect(one.sea).toBeUndefined();
    // Zone 2 paints differently from zone 1.
    expect(fingerprint(paintZone(2, [11]))).not.toBe(
      fingerprint(paintZone(1, [1])),
    );
  });
  // (Re-recorded once for the floor number's centring, spire-court-art.ts
  // paintNumber: its ink on the ring's centre. Nothing else changed.)
  it("zone 1's painting is exactly what it was (recipe recorded before zone 2)", () => {
    const log = paintZone(1, [1, 2, 5, 9]);
    paintSpireSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("37340:20ffb4c9");
  });
  it("zone 2's painting is exactly what it was (recipe recorded before zone 3)", () => {
    const log = paintZone(2, [11, 12, 15, 19]);
    paintLagoonSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("45089:a485dcb");
  });
  it("zone 3's painting is exactly what it was (recipe recorded before zone 4)", () => {
    const log = paintZone(3, [21, 22, 25, 29]);
    paintLanternSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("40964:a6c31d31");
  });
  it("zone 3 is dark slate with candle-pale crystal, ink veins and lanterns, at night", () => {
    const one = spireZoneTheme(1),
      two = spireZoneTheme(2),
      three = spireZoneTheme(3);
    for (const key of [
      "slab",
      "top",
      "front",
      "crystal",
      "rune",
      "skyLow",
      "skyHigh",
    ] as const) {
      expect(three[key]).not.toEqual(one[key]);
      expect(three[key]).not.toEqual(two[key]);
    }
    // Dark stone (the other zones' is pale), the cover's top paler than the
    // floor (blocks read against it), the night sky dark even low down.
    expect(lum(three.slab[0]).l).toBeLessThan(80);
    expect(lum(three.slab[0]).l).toBeGreaterThan(40);
    expect(lum(three.top[0]).l).toBeGreaterThan(lum(three.slab[0]).l + 50);
    expect(lum(three.skyLow[0]).l).toBeLessThan(50);
    // Candle-pale crystal and a gold inlay: bright and warm on dark stone.
    const crystal = lum(three.crystal[1]);
    expect(crystal.l).toBeGreaterThan(190);
    expect(crystal.r - crystal.b).toBeGreaterThan(100);
    expect(lum(three.crystal[0]).l).toBeGreaterThan(235);
    expect(lum(three.rune).l).toBeGreaterThan(200);
    // The number's groove stays darker than the darkest stone.
    expect(lum(three.carve).l).toBeLessThan(lum(three.slab[1]).l - 20);
    // The ink is a deep, redder violet: never the Echoes' lavender.
    const ink = lum(three.night!.veins),
      echo = lum(`#${ECHO_SKILL_COLOR.toString(16)}`);
    expect(ink.b).toBeGreaterThan(ink.g + 80);
    expect(ink.l).toBeLessThan(echo.l - 40);
    expect(ink.r - ink.g).toBeGreaterThan(echo.r - echo.g + 40);
    expect(three.night).toBeDefined();
    expect(three.sea).toBeUndefined();
    expect(one.night).toBeUndefined();
    expect(two.night).toBeUndefined();
    // Zone 3 paints differently from zones 1 and 2.
    const z3 = fingerprint(paintZone(3, [21]));
    expect(z3).not.toBe(fingerprint(paintZone(1, [1])));
    expect(z3).not.toBe(fingerprint(paintZone(2, [11])));
  });
  it("zone 3's cover carries lanterns and candles, and gathers ink higher up", () => {
    const flame = spireZoneTheme(3).night!.lantern[1];
    const count = (log: string[], text: string) =>
      log.filter((l) => l.includes(text)).length;
    const low = paintZone(3, [21]),
      high = paintZone(3, [29]);
    // Lantern glass on every floor (the coping's, the cover's).
    expect(count(low, `stop(1,${flame})`)).toBeGreaterThan(6);
    // The ink drips' colour: more of it on the top floors.
    const drips = (log: string[]) =>
      log.filter((l) => /^fillStyle=rgba\(65,30,92,/.test(l)).length;
    expect(drips(high)).toBeGreaterThan(drips(low));
    // Zone 1 and zone 2 carry none of it.
    expect(count(paintZone(1, [9]), `stop(1,${flame})`)).toBe(0);
    expect(drips(paintZone(2, [19]))).toBe(0);
  });
  it("zone 4 is pale periwinkle marble with rose crystal, a gold star inlay and a twilight sky", () => {
    const four = spireZoneTheme(4);
    for (const z of [1, 2, 3]) {
      const other = spireZoneTheme(z);
      for (const key of [
        "slab",
        "top",
        "front",
        "crystal",
        "rune",
        "skyLow",
        "skyHigh",
      ] as const)
        expect(four[key]).not.toEqual(other[key]);
      expect(four.glow).not.toBe(other.glow);
      expect(other.dream).toBeUndefined();
    }
    expect(four.dream).toBeDefined();
    expect(four.night).toBeUndefined();
    expect(four.sea).toBeUndefined();
    // Pale, cool marble: periwinkle (blue leads), leaning blue rather than
    // the Echoes' violet (their ring keeps its own hue on it).
    const stone = lum(four.slab[0]);
    expect(stone.l).toBeGreaterThan(180);
    expect(stone.b).toBeGreaterThan(stone.r + 20);
    expect(stone.g).toBeGreaterThanOrEqual(stone.r);
    // The cover's top paler still, its fronts darker (blocks read on it).
    expect(lum(four.top[0]).l).toBeGreaterThan(stone.l + 20);
    expect(lum(four.front[0]).l).toBeLessThan(stone.l - 40);
    // Rose psychic crystal, bright: never the Echoes' lavender (blue leads
    // there, red here).
    const crystal = lum(four.crystal[1]),
      echo = lum(`#${ECHO_SKILL_COLOR.toString(16)}`);
    expect(crystal.l).toBeGreaterThan(180);
    expect(crystal.r).toBeGreaterThan(crystal.b + 30);
    expect(echo.b).toBeGreaterThan(echo.r);
    // A gold inlay and gold stars.
    for (const gold of [four.rune, four.dream!.star]) {
      const g = lum(gold);
      expect(g.l).toBeGreaterThan(190);
      expect(g.r - g.b).toBeGreaterThan(100);
    }
    // The number's groove: a deep indigo, far darker than the marble.
    expect(lum(four.carve).l).toBeLessThan(40);
    // Twilight low down (periwinkle over a rose horizon), deep indigo at the top.
    const low = lum(four.skyLow[0]),
      horizon = lum(four.skyLow[1]),
      high = lum(four.skyHigh[0]);
    expect(low.b).toBeGreaterThan(low.r + 60);
    expect(horizon.r).toBeGreaterThan(horizon.g);
    expect(horizon.l).toBeGreaterThan(190);
    expect(high.l).toBeLessThan(20);
    expect(high.b).toBeGreaterThan(high.r);
    // Zone 4 paints differently from zones 1 to 3.
    const z4 = fingerprint(paintZone(4, [31]));
    for (const [z, f] of [
      [1, 1],
      [2, 11],
      [3, 21],
    ])
      expect(z4).not.toBe(fingerprint(paintZone(z, [f])));
  });
  it("zone 4 inlays stars and crescents, stars the crystals' tips and hangs a moon in the sky", () => {
    const star = spireZoneTheme(4).dream!.star;
    const count = (log: string[], line: string) =>
      log.filter((l) => l === line).length;
    const low = paintZone(4, [31]),
      high = paintZone(4, [39]);
    // The star inlay (paving, constellations, crescents, block fronts).
    expect(count(low, `fillStyle=${star}`)).toBeGreaterThan(40);
    // A sparkle at crystal tips: a gold glow stop in every block's atlas piece.
    const sparkles = (log: string[]) =>
      log.filter((l) => /stop\(0,rgba\(255,223,134,0\.6\)\)$/.test(l)).length;
    expect(sparkles(low)).toBeGreaterThan(4);
    // The moon, on the zone's first floor already.
    const moon = (log: string[]) =>
      log.filter((l) => /^Radial\d+\(1880,-190,20,1880,-190,360\)$/.test(l))
        .length;
    expect(moon(low)).toBe(1);
    expect(moon(high)).toBe(1);
    // More sky stars higher up (the twilight deepens).
    const skyStars = (log: string[]) =>
      log.filter((l) => /^fillStyle=rgba\(255,248,232,/.test(l)).length;
    expect(skyStars(high)).toBeGreaterThan(skyStars(low) + 100);
    // No other zone carries any of it.
    for (const [z, f] of [
      [1, 9],
      [2, 19],
      [3, 29],
    ] as const) {
      const log = paintZone(z, [f]);
      expect(count(log, `fillStyle=${star}`)).toBe(0);
      expect(moon(log)).toBe(0);
    }
  });
  it("zone 2's high floors add bioluminescence (none low down)", () => {
    const low = paintZone(2, [11]).join("\n"),
      high = paintZone(2, [19]).join("\n");
    const bio = spireZoneTheme(2).sea!.bio;
    const glows = (s: string) =>
      s.split("\n").filter((l) => l.includes("rgba(111,247,230,")).length;
    expect(bio).toBe("#6ff7e6");
    expect(glows(low)).toBe(0);
    expect(glows(high)).toBeGreaterThan(100);
  });
  it("tints the platform by height in the zone's dusk (zone 1 unchanged)", () => {
    expect(spireFloorTint(1)).toBe(0xffffff);
    expect(spireFloorTint(1, 1)).toBe(0xffffff);
    expect(spireFloorTint(10)).toBe(0xcec2e6);
    expect(spireFloorTint(9, 1)).toBe(spireFloorTint(9));
    expect(spireFloorTint(11, 2)).toBe(0xffffff);
    // Zone 2's top floors are bluer than zone 1's violet dusk.
    const blue = (tint: number) => (tint & 255) - (tint >> 16);
    expect(blue(spireFloorTint(19, 2))).toBeGreaterThan(
      blue(spireFloorTint(19, 1)),
    );
    expect(spireFloorTint(19, 2)).toBeLessThan(0xffffff);
    // Zone 3: untinted on its first floor, a cool night dusk at the top
    // (bluer than zone 1's), never so dark the slate turns black.
    expect(spireFloorTint(21, 3)).toBe(0xffffff);
    expect(spireFloorTint(29, 3)).toBeLessThan(0xffffff);
    expect(blue(spireFloorTint(29, 3))).toBeGreaterThan(
      blue(spireFloorTint(29, 1)),
    );
    expect(spireFloorTint(29, 3) >> 16).toBeGreaterThan(170);
    expect(spireFloorTint(25, 3)).toBeGreaterThan(spireFloorTint(29, 3));
    // Zone 4: untinted on its first floor, a deeper indigo at the top (blue
    // leads more than zone 1's dusk, darker than zone 3's), never so dark
    // the marble loses its pale.
    expect(spireFloorTint(31, 4)).toBe(0xffffff);
    expect(blue(spireFloorTint(39, 4))).toBeGreaterThan(
      blue(spireFloorTint(39, 1)),
    );
    expect(spireFloorTint(39, 4) >> 16).toBeLessThan(
      spireFloorTint(29, 3) >> 16,
    );
    expect(spireFloorTint(39, 4) >> 16).toBeGreaterThan(140);
    expect(spireFloorTint(35, 4)).toBeGreaterThan(spireFloorTint(39, 4));
  });
});

describe("the rig's zone", () => {
  it("comes from the snapshot when it carries one, else from the floor", () => {
    expect(spireCourtView({ spire: { floor: 3, kind: "wave" } })).toEqual({
      zone: 1,
      floor: 3,
      kind: "wave",
    });
    expect(spireCourtView({ spire: { floor: 15, kind: "elite" } })?.zone).toBe(
      2,
    );
    expect(spireCourtView({ spire: { floor: 20, kind: "boss" } })?.zone).toBe(
      2,
    );
    expect(
      spireCourtView({ spire: { floor: 12, kind: "wave", zone: 1 } })?.zone,
    ).toBe(1);
    expect(spireCourtView(undefined)).toBeUndefined();
    expect(spireCourtView({})).toBeUndefined();
    expect(spireFloorId({ zone: 2, floor: 11, kind: "wave" })).toBe("spire-z2");
    expect(spireCourtView({ spire: { floor: 25, kind: "elite" } })?.zone).toBe(
      3,
    );
    expect(
      spireCourtView({ spire: { floor: 5, kind: "elite", zone: 3 } })?.zone,
    ).toBe(3);
    expect(spireFloorId({ zone: 3, floor: 21, kind: "wave" })).toBe("spire-z3");
    expect(spireCourtView({ spire: { floor: 35, kind: "elite" } })?.zone).toBe(
      4,
    );
    expect(spireCourtView({ spire: { floor: 40, kind: "boss" } })?.zone).toBe(
      4,
    );
    expect(spireFloorId({ zone: 4, floor: 31, kind: "wave" })).toBe("spire-z4");
  });
  it("paints zone 2's next floors ahead (floor 19's next is the boss, 20)", () => {
    expect(nextSpireCourtView({ zone: 1, floor: 9, kind: "wave" })).toEqual({
      zone: 1,
      floor: 10,
      kind: "boss",
    });
    expect(nextSpireCourtView({ zone: 2, floor: 14, kind: "wave" })).toEqual({
      zone: 2,
      floor: 15,
      kind: "elite",
    });
    expect(nextSpireCourtView({ zone: 2, floor: 19, kind: "wave" })).toEqual({
      zone: 2,
      floor: 20,
      kind: "boss",
    });
    expect(nextSpireCourtView({ zone: 3, floor: 24, kind: "wave" })).toEqual({
      zone: 3,
      floor: 25,
      kind: "elite",
    });
    expect(nextSpireCourtView({ zone: 3, floor: 29, kind: "wave" })).toEqual({
      zone: 3,
      floor: 30,
      kind: "boss",
    });
    expect(nextSpireCourtView({ zone: 4, floor: 34, kind: "wave" })).toEqual({
      zone: 4,
      floor: 35,
      kind: "elite",
    });
    expect(nextSpireCourtView({ zone: 4, floor: 39, kind: "wave" })).toEqual({
      zone: 4,
      floor: 40,
      kind: "boss",
    });
  });
});

describe("summit courts", () => {
  it("floor 10 on Cragmuff's court, floor 20 on Tidelotl's lagoon, each graded", () => {
    expect(spireSummitFloorId(1)).toBe(SPIRE_SUMMIT_FLOOR);
    expect(spireSummitFloorId(2)).toBe(SPIRE_LAGOON_SUMMIT_FLOOR);
    expect(spireSummitFloorId(7)).toBe(SPIRE_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("lagoon")).toBe(SPIRE_LAGOON_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("classic")).toBe(SPIRE_SUMMIT_FLOOR);
    expect(isSpireSummitFloorId(SPIRE_SUMMIT_FLOOR)).toBe(true);
    expect(isSpireSummitFloorId(SPIRE_LAGOON_SUMMIT_FLOOR)).toBe(true);
    expect(isSpireSummitFloorId("lagoon")).toBe(false);
    expect(spireSummitArt(SPIRE_SUMMIT_FLOOR)).toEqual({
      picture: "raid-coliseum",
      grade: paintSpireSummitGrade,
    });
    expect(spireSummitArt(SPIRE_LAGOON_SUMMIT_FLOOR)).toEqual({
      picture: "lagoon",
      grade: paintLagoonSummitGrade,
    });
  });
  it("floor 30 on Inkpurr's Lantern Yard, with its own grade (Inkpurr's raid untouched)", () => {
    expect(spireSummitFloorId(3)).toBe(SPIRE_YARD_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("lantern-yard")).toBe(SPIRE_YARD_SUMMIT_FLOOR);
    expect(isSpireSummitFloorId(SPIRE_YARD_SUMMIT_FLOOR)).toBe(true);
    expect(isSpireSummitFloorId("lantern-yard")).toBe(false);
    expect(spireSummitArt(SPIRE_YARD_SUMMIT_FLOOR)).toEqual({
      picture: "lantern-yard",
      grade: paintLanternSummitGrade,
    });
    // Only boss floors with a summit of their own take one; the raid's own
    // arena id is never a summit texture.
    expect(hasSpireSummitArena("lantern-yard")).toBe(true);
    expect(hasSpireSummitArena("lagoon")).toBe(true);
    expect(hasSpireSummitArena("classic")).toBe(false);
    expect(hasSpireSummitArena("sun-atrium")).toBe(false);
    expect(
      new Set([
        SPIRE_SUMMIT_FLOOR,
        SPIRE_LAGOON_SUMMIT_FLOOR,
        SPIRE_YARD_SUMMIT_FLOOR,
        SPIRE_DECK_SUMMIT_FLOOR,
      ]).size,
    ).toBe(4);
  });
  it("floor 40 on Snoozaku's Cloud Deck, with its own grade (Snoozaku's raid untouched)", () => {
    expect(spireSummitFloorId(4)).toBe(SPIRE_DECK_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("cloud-deck")).toBe(SPIRE_DECK_SUMMIT_FLOOR);
    expect(hasSpireSummitArena("cloud-deck")).toBe(true);
    expect(isSpireSummitFloorId(SPIRE_DECK_SUMMIT_FLOOR)).toBe(true);
    // The raid's own arena id is never a summit texture.
    expect(isSpireSummitFloorId("cloud-deck")).toBe(false);
    expect(spireSummitArt(SPIRE_DECK_SUMMIT_FLOOR)).toEqual({
      picture: "cloud-deck",
      grade: paintDreamSummitGrade,
    });
    // The other zones keep theirs.
    expect(spireSummitFloorId(3)).toBe(SPIRE_YARD_SUMMIT_FLOOR);
    expect(spireSummitFloorId(5)).toBe(SPIRE_SUMMIT_FLOOR);
  });
  it("the deck's summit grade is a soft twilight that keeps the middle lit", () => {
    const log: string[] = [];
    paintDreamSummitGrade(recordingContext(log));
    const multiply = log.indexOf("globalCompositeOperation=multiply");
    expect(multiply).toBeGreaterThanOrEqual(0);
    const fill = lum(log[multiply + 1].replace("fillStyle=", ""));
    // Periwinkle (blue leads), soft: the deck is a pale picture already.
    expect(fill.b).toBeGreaterThan(fill.g + 30);
    expect(fill.l).toBeGreaterThan(180);
    // The edge's night starts about half way out (the pads stay clear).
    expect(log.some((l) => /^Radial\d+\(800,450,414,/.test(l))).toBe(true);
    // Different from every other summit grade.
    const of = (paint: (c: CanvasRenderingContext2D) => void) => {
      const l: string[] = [];
      paint(recordingContext(l));
      return fingerprint(l);
    };
    for (const other of [
      paintSpireSummitGrade,
      paintLagoonSummitGrade,
      paintLanternSummitGrade,
    ])
      expect(of(paintDreamSummitGrade)).not.toBe(of(other));
  });
  it("the yard's summit grade is a soft violet midnight that keeps the middle lit and bakes no lantern light", () => {
    const log: string[] = [];
    paintLanternSummitGrade(recordingContext(log));
    const multiply = log.indexOf("globalCompositeOperation=multiply");
    expect(multiply).toBeGreaterThanOrEqual(0);
    const fill = lum(log[multiply + 1].replace("fillStyle=", ""));
    // Violet, and lighter than the lagoon's (the yard is dark already).
    expect(fill.b).toBeGreaterThan(fill.g + 20);
    expect(fill.l).toBeGreaterThan(190);
    // The edge's night starts half way out (the lanterns' pools stay clear).
    const vignette = log.find((l) => /^Radial\d+\(800,450,450,/.test(l));
    expect(vignette).toBeDefined();
    // No warm light baked in: a snuffed lantern must look dark.
    const warm = log
      .flatMap((l) => [...l.matchAll(/rgba\((\d+),(\d+),(\d+),/g)])
      .filter(([, r, , b]) => Number(r) - Number(b) > 30);
    expect(warm).toEqual([]);
    expect(fingerprint(log)).not.toBe(
      fingerprint(
        (() => {
          const l: string[] = [];
          paintLagoonSummitGrade(recordingContext(l));
          return l;
        })(),
      ),
    );
  });
  it("the lagoon's summit grade darkens with a cool multiply and an abyssal edge", () => {
    const log: string[] = [];
    paintLagoonSummitGrade(recordingContext(log));
    const multiply = log.indexOf("globalCompositeOperation=multiply");
    expect(multiply).toBeGreaterThanOrEqual(0);
    const fill = lum(log[multiply + 1].replace("fillStyle=", ""));
    expect(fill.b).toBeGreaterThan(fill.r + 40);
    expect(fill.l).toBeLessThan(150);
    expect(log.some((l) => /stop\(1,rgba\(2,12,34,0\.5/.test(l))).toBe(true);
  });
});

describe("Echoes on zone 3's dark court", () => {
  it("are pale violet ghosts there (flushing pink when hit); elsewhere the dark violet shade", () => {
    expect(spireEchoTint(1)).toEqual({
      tint: ECHO_TINT,
      hurtTint: ECHO_TINT_HURT,
    });
    expect(spireEchoTint(2)).toEqual({
      tint: ECHO_TINT,
      hurtTint: ECHO_TINT_HURT,
    });
    expect(spireEchoTint(undefined)).toEqual({
      tint: ECHO_TINT,
      hurtTint: ECHO_TINT_HURT,
    });
    const hexOf = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
    const pale = lum(hexOf(spireEchoTint(3).tint)),
      dark = lum(hexOf(ECHO_TINT)),
      hurt = lum(hexOf(spireEchoTint(3).hurtTint));
    // Paler than the usual shade, still violet (blue leads), and the hit
    // flush reads by its hue (red leads).
    expect(pale.l).toBeGreaterThan(dark.l + 60);
    expect(pale.b).toBeGreaterThan(pale.r);
    expect(hurt.r).toBeGreaterThan(hurt.b);
    // Washed over in pale violet (a dark champion's outlines lift off the
    // slate; tests/visual/spire-court.spec.ts measures it), never elsewhere.
    const wash = spireEchoTint(3).wash!;
    expect(lum(hexOf(wash.color)).l).toBeGreaterThan(200);
    expect(wash.alpha).toBeGreaterThan(0.2);
    expect(wash.alpha).toBeLessThanOrEqual(0.35);
    for (const zone of [1, 2, 4, undefined])
      expect(spireEchoTint(zone).wash).toBeUndefined();
  });
});

describe("Echoes on zone 4's pale court", () => {
  it("take a deeper violet shade there (no wash) and flush rose when hit", () => {
    expect(spireEchoTint(4)).toEqual({
      tint: ECHO_TINT_Z4,
      hurtTint: ECHO_TINT_HURT_Z4,
    });
    const hexOf = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
    const deep = lum(hexOf(ECHO_TINT_Z4)),
      usual = lum(hexOf(ECHO_TINT)),
      hurt = lum(hexOf(ECHO_TINT_HURT_Z4)),
      marble = lum(spireZoneTheme(4).slab[1]);
    // Darker than the usual shade and far darker than the marble's darker
    // tone, still violet (tests/visual/spire-court.spec.ts measures the
    // Echoes on the court: 0.80-0.99 of their pixels stand clear).
    expect(deep.l).toBeLessThan(usual.l - 30);
    expect(deep.l).toBeLessThan(marble.l - 80);
    expect(deep.b).toBeGreaterThan(deep.r + 40);
    // The hit flush reads by hue on the pale stone (red leads, rose).
    expect(hurt.r).toBeGreaterThan(hurt.g + 60);
    expect(hurt.r).toBeGreaterThan(hurt.b);
  });
});

describe("the floor number's centring", () => {
  it("centres the glyphs' ink, not the font's em box", () => {
    // An old-style "7" (Georgia): ink from 40 px above the baseline to 30
    // below, its left edge 2 px right of the pen's centre, its right 30 px.
    const o = spireNumberOffset(
      {
        width: 60,
        actualBoundingBoxLeft: -2,
        actualBoundingBoxRight: 30,
        actualBoundingBoxAscent: 40,
        actualBoundingBoxDescent: 30,
      },
      118,
    );
    // Drawn at (o.x, o.y): ink from x -14..14 and y -35..35, round (0, 0).
    expect(o).toEqual({ x: -16, y: 5 });
    // Without glyph bounds: a lining digit's cap height, centred.
    expect(spireNumberOffset({ width: 60 }, 100)).toEqual({ x: 0, y: 35 });
  });
});
