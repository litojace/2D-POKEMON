/**
 * The Spire court's zone looks (apps/client/src/spire-court-art.ts): the
 * lookup the floor flow calls (`spireZoneTheme`), zone 2's Water look,
 * zone 3's Shadow look, zone 4's Psychic look, zone 5's Light look, zone
 * 6's Fire look, zone 7's Electric look, zones 1 to 6's paintings (and
 * the Storm Twins' own Conductor Ring) left exactly as they were, the
 * floor tint by zone, how the rig reads a snapshot's zone, the boss floors'
 * summit courts, nothing that looks like a pad under a phone's touch
 * controls, and the Echoes' tint on zone 3's dark court, zone 4's pale
 * one, zone 5's bright one, zone 6's dusky one and zone 7's storm slate.
 */
import { describe, expect, it } from "vitest";
import {
  SPIRE_ZONE_THEMES,
  paintDreamSummitGrade,
  paintEmberSummitGrade,
  paintLagoonSummitGrade,
  paintLanternSummitGrade,
  paintRadiantSummitGrade,
  paintSpireFloor,
  paintSpireSky,
  paintSpireSummitGrade,
  paintStormSummitGrade,
  SPIRE_COILS,
  SPIRE_LANTERNS,
  spireFloorPieces,
  spireFloorTint,
  spireNumberOffset,
  spireTheme,
  spireZoneTheme,
} from "../../apps/client/src/spire-court-art";
import {
  SPIRE_ATRIUM_SUMMIT_FLOOR,
  SPIRE_DECK_SUMMIT_FLOOR,
  SPIRE_LAGOON_SUMMIT_FLOOR,
  SPIRE_SUMMIT_FLOOR,
  SPIRE_RING_SUMMIT_FLOOR,
  SPIRE_TERRACE_SUMMIT_FLOOR,
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
  ECHO_TINT_HURT_Z5,
  ECHO_TINT_Z5,
  ECHO_TINT_HURT_Z6,
  ECHO_TINT_Z6,
  ECHO_WASH_Z6,
  ECHO_TINT_HURT_Z7,
  ECHO_TINT_Z7,
  ECHO_WASH_Z7,
  spireEchoTint,
} from "../../apps/client/src/spire-art";
import {
  SPIRE_PHONE_CONTROLS,
  spireUnderControls,
} from "../../packages/shared/src/spire";
import { paintRaidFloor } from "../../apps/client/src/raid-floors";
import { paintIllustratedRaidFloor } from "../../apps/client/src/raid-arena-art";

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
  it("gives zone 1 (Earth), zone 2 (Water), zone 3 (Shadow), zone 4 (Psychic), zone 5 (Light), zone 6 (Fire) and zone 7 (Electric); unknown zones fall back to zone 1", () => {
    for (const z of [1, 2, 3, 4, 5, 6, 7]) {
      expect(spireZoneTheme(z)).toBe(SPIRE_ZONE_THEMES[z]);
      expect(spireZoneTheme(z).zone).toBe(z);
    }
    for (const z of [0, -1, 8, 99, NaN, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5])
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
  it("zone 4's painting is exactly what it was (recipe recorded before zone 5)", () => {
    const log = paintZone(4, [31, 32, 35, 39]);
    paintDreamSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("43802:9663b940");
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
  it("zone 5 is champagne stone with clear prism crystal, a gold sun inlay and a bright morning sky", () => {
    const five = spireZoneTheme(5);
    for (const z of [1, 2, 3, 4]) {
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
        expect(five[key]).not.toEqual(other[key]);
      expect(five.glow).not.toBe(other.glow);
      expect(other.radiant).toBeUndefined();
    }
    expect(five.radiant).toBeDefined();
    expect(five.dream).toBeUndefined();
    expect(five.night).toBeUndefined();
    expect(five.sea).toBeUndefined();
    // Warm, light stone (red leads blue), but a mid champagne, never
    // white: white and yellow fighters keep a floor to stand out from.
    const stone = lum(five.slab[0]),
      deep = lum(five.slab[1]);
    expect(stone.r).toBeGreaterThan(stone.b + 40);
    expect(stone.l).toBeGreaterThan(190);
    expect(stone.l).toBeLessThan(225);
    expect(deep.l).toBeLessThan(175);
    // The cover's top paler still, its fronts darker (blocks read on it).
    expect(lum(five.top[0]).l).toBeGreaterThan(stone.l + 20);
    expect(lum(five.front[0]).l).toBeLessThan(stone.l - 40);
    // Clear, cool prism crystal (blue leads: it reads against the warm
    // stone), a spectrum of five bands from red to blue.
    const crystal = lum(five.crystal[1]);
    expect(crystal.l).toBeGreaterThan(230);
    expect(crystal.b).toBeGreaterThan(crystal.r + 20);
    expect(lum(five.crystal[2]).b).toBeGreaterThan(lum(five.crystal[2]).r + 60);
    const prism = five.radiant!.prism.map(lum);
    expect(prism).toHaveLength(5);
    expect(prism[0].r).toBeGreaterThan(prism[0].b);
    expect(prism[4].b).toBeGreaterThan(prism[4].r);
    // A gold inlay.
    for (const gold of [five.rune, five.radiant!.gold]) {
      const g = lum(gold);
      expect(g.l).toBeGreaterThan(170);
      expect(g.r - g.b).toBeGreaterThan(150);
    }
    // The number's groove: a deep brown, far darker than the stone.
    expect(lum(five.carve).l).toBeLessThan(50);
    // A bright morning low down (blue over a pale gold horizon), a warm
    // sunset at the top (the horizon gold, the top rose: never night).
    const low = lum(five.skyLow[0]),
      horizon = lum(five.skyLow[1]),
      high = lum(five.skyHigh[0]),
      highHorizon = lum(five.skyHigh[1]);
    expect(low.b).toBeGreaterThan(low.r + 80);
    expect(low.l).toBeGreaterThan(150);
    expect(horizon.l).toBeGreaterThan(220);
    expect(high.r).toBeGreaterThan(high.g + 50);
    expect(high.l).toBeGreaterThan(90);
    expect(highHorizon.r - highHorizon.b).toBeGreaterThan(150);
    // Zone 5 paints differently from zones 1 to 4.
    const z5 = fingerprint(paintZone(5, [41]));
    for (const [z, f] of [
      [1, 1],
      [2, 11],
      [3, 21],
      [4, 31],
    ])
      expect(z5).not.toBe(fingerprint(paintZone(z, [f])));
  });
  it("zone 5 inlays a sun, splits light in its crystals and hangs a sun with rays in the sky", () => {
    const five = spireZoneTheme(5),
      gold = five.radiant!.gold;
    const count = (log: string[], re: RegExp) =>
      log.filter((l) => re.test(l)).length;
    const low = paintZone(5, [41]),
      high = paintZone(5, [49]);
    // The sun inlay (rays, corner sunbursts, block fronts).
    const goldFill = new RegExp(`^fillStyle=${gold}$`);
    expect(count(low, goldFill)).toBeGreaterThan(8);
    // Rainbow facets: the spectrum's red band, on crystals and paving.
    const red = (log: string[]) =>
      count(log, /^(fillStyle|strokeStyle)=rgba\(255,143,168,/);
    expect(red(low)).toBeGreaterThan(40);
    // The sun, on every floor; lower and bigger at the top.
    const sun = (log: string[]) =>
      log.filter((l) =>
        /^Radial\d+\(-230,-?[\d.]+,[\d.]+,-230,-?[\d.]+,560\)$/.test(l),
      );
    expect(sun(low)).toEqual([expect.stringContaining("-230,-170,")]);
    expect(sun(high)).toHaveLength(1);
    expect(sun(high)[0]).not.toBe(sun(low)[0]);
    // No stars in the sky: the sun is up (a dream zone has many).
    const skyStars = (log: string[]) =>
      count(log, /^fillStyle=rgba\(255,248,232,/);
    expect(skyStars(low)).toBe(0);
    expect(skyStars(high)).toBe(0);
    // No other zone carries any of it.
    for (const [z, f] of [
      [1, 9],
      [2, 19],
      [3, 29],
      [4, 39],
    ] as const) {
      const log = paintZone(z, [f]);
      expect(count(log, goldFill)).toBe(0);
      expect(red(log)).toBe(0);
      expect(sun(log)).toEqual([]);
    }
  });
  it("zone 5's painting is exactly what it was (recipe recorded before zone 6)", () => {
    const log = paintZone(5, [41, 42, 45, 49]);
    paintRadiantSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("46514:3cbab52c");
  });
  it("zone 6 is dusky basalt with fire-opal crystal, an ember-gold inlay and a volcanic dusk sky", () => {
    const six = spireZoneTheme(6);
    for (const z of [1, 2, 3, 4, 5]) {
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
        expect(six[key]).not.toEqual(other[key]);
      expect(six.glow).not.toBe(other.glow);
      expect(other.ember).toBeUndefined();
    }
    expect(six.ember).toBeDefined();
    expect(six.radiant).toBeUndefined();
    expect(six.dream).toBeUndefined();
    expect(six.night).toBeUndefined();
    expect(six.sea).toBeUndefined();
    // Warm but dusky stone, only gently red: red and orange warnings, the
    // enemies' red rings and fire champions stand out from it by lightness
    // (far lighter) as well as hue (far more saturated).
    const stone = lum(six.slab[0]),
      deep = lum(six.slab[1]);
    expect(stone.r).toBeGreaterThan(stone.b + 25);
    expect(stone.r - stone.b).toBeLessThan(70);
    expect(stone.l).toBeGreaterThan(70);
    expect(stone.l).toBeLessThan(110);
    expect(deep.l).toBeLessThan(stone.l - 25);
    for (const warning of ["#ff4059", "#ff5d6c", "#ff7a4f", "#ff8a3d"]) {
      const w = lum(warning);
      expect(w.l).toBeGreaterThan(stone.l + 30);
      expect(w.r - w.b).toBeGreaterThan(stone.r - stone.b + 60);
    }
    // The cover's top lighter, its fronts dark basalt (blocks read on it).
    expect(lum(six.top[0]).l).toBeGreaterThan(stone.l + 40);
    expect(lum(six.front[0]).l).toBeLessThan(stone.l - 20);
    // Fire-opal crystal: a bright warm orange lit face over a deep oxblood.
    const crystal = lum(six.crystal[1]);
    expect(crystal.l).toBeGreaterThan(150);
    expect(crystal.r - crystal.b).toBeGreaterThan(150);
    expect(lum(six.crystal[2]).l).toBeLessThan(50);
    // The ember-gold inlay and runes.
    for (const gold of [six.rune, six.ember!.gold]) {
      const g = lum(gold);
      expect(g.l).toBeGreaterThan(150);
      expect(g.r - g.b).toBeGreaterThan(150);
    }
    // Red paper lanterns, glowing coals, lava.
    const paper = lum(six.ember!.paper[0]);
    expect(paper.r).toBeGreaterThan(paper.g + 120);
    expect(lum(six.ember!.coal[2]).l).toBeGreaterThan(220);
    // The number's groove: near black, far darker than the stone.
    expect(lum(six.carve).l).toBeLessThan(30);
    // A dusky sky low down (violet over an orange horizon), a crimson night
    // at the top.
    const low = lum(six.skyLow[0]),
      horizon = lum(six.skyLow[1]),
      high = lum(six.skyHigh[0]),
      highHorizon = lum(six.skyHigh[1]);
    expect(low.b).toBeGreaterThan(low.g);
    expect(horizon.r - horizon.b).toBeGreaterThan(140);
    expect(horizon.l).toBeGreaterThan(150);
    expect(high.l).toBeLessThan(20);
    expect(highHorizon.r).toBeGreaterThan(highHorizon.g + 90);
    // Zone 6 paints differently from zones 1 to 5.
    const z6 = fingerprint(paintZone(6, [51]));
    for (const [z, f] of [
      [1, 1],
      [2, 11],
      [3, 21],
      [4, 31],
      [5, 41],
    ])
      expect(z6).not.toBe(fingerprint(paintZone(z, [f])));
  });
  it("zone 6 inlays flames, sets braziers and paper lanterns, and hangs volcanoes, sky lanterns and embers in the sky", () => {
    const six = spireZoneTheme(6),
      e = six.ember!;
    const count = (log: string[], re: RegExp) =>
      log.filter((l) => re.test(l)).length;
    const low = paintZone(6, [51]),
      high = paintZone(6, [59]);
    const esc = (hex: string) =>
      `rgba\\(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},`;
    // The ember-gold flames (24 tongues) and the diamonds between them.
    const flame = new RegExp(`^fillStyle=${esc(e.gold)}0\\.46\\)$`);
    expect(count(low, flame)).toBe(24);
    expect(count(low, new RegExp(`^fillStyle=${e.gold}$`))).toBeGreaterThan(8);
    // Paper lanterns: the coping's six, and one on each pylon's or wall's
    // front (their lit paper's gradient ends in the deep paper red).
    const paper = (log: string[]) =>
      log.filter((l) => l.endsWith(`.stop(1,${e.paper[0]})`)).length;
    expect(paper(low)).toBeGreaterThanOrEqual(6);
    // Braziers: the corners' four (their white-hot coals).
    const coals = (log: string[]) =>
      log.filter((l) => l.endsWith(`.stop(0,${e.coal[2]})`)).length;
    expect(coals(low)).toBeGreaterThanOrEqual(4);
    // The volcanoes' lava, the sky lanterns, the embers: more embers and
    // lanterns at the top, stars only there.
    const lava = (log: string[]) =>
      count(
        log,
        new RegExp(`^(fillStyle|strokeStyle)=${esc(e.lava)}0\\.(95|75)\\)$`),
      );
    expect(lava(low)).toBeGreaterThanOrEqual(4);
    const embers = (log: string[]) =>
      log.filter((l) =>
        l.endsWith(`.stop(1,${esc(e.coal[1]).replace("\\", "")}0))`),
      ).length;
    expect(embers(high)).toBeGreaterThan(embers(low));
    const skyStars = (log: string[]) =>
      count(log, /^fillStyle=rgba\(255,248,232,/);
    expect(skyStars(low)).toBe(0);
    expect(skyStars(high)).toBeGreaterThan(80);
    // No other zone carries any of it.
    for (const [z, f] of [
      [1, 9],
      [2, 19],
      [3, 29],
      [4, 39],
      [5, 49],
    ] as const) {
      const log = paintZone(z, [f]);
      expect(count(log, flame)).toBe(0);
      expect(coals(log)).toBe(0);
      expect(lava(log)).toBe(0);
    }
  });
  it("zone 6's painting is exactly what it was (recipe recorded before zone 7)", () => {
    const log = paintZone(6, [51, 52, 55, 59]);
    paintEmberSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("46644:fbc11130");
  });
  it("zone 7 is cool storm slate and steel with electric yellow crystal, a copper circuit inlay and a thundercloud sky", () => {
    const seven = spireZoneTheme(7);
    for (const z of [1, 2, 3, 4, 5, 6]) {
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
        expect(seven[key]).not.toEqual(other[key]);
      expect(seven.glow).not.toBe(other.glow);
      expect(other.storm).toBeUndefined();
    }
    expect(seven.storm).toBeDefined();
    for (const k of ["ember", "radiant", "dream", "night", "sea"] as const)
      expect(seven[k]).toBeUndefined();
    // Cool mid-dark slate: blue leads, gently; the twins' yellow (+) and
    // blue (−) cues, chain lightning's yellow, the static field's blue, the
    // Link Beam's pink and the Echoes' violet, all light colours, stand
    // far lighter than it.
    const stone = lum(seven.slab[0]),
      deep = lum(seven.slab[1]);
    expect(stone.b).toBeGreaterThan(stone.r + 10);
    expect(stone.b - stone.r).toBeLessThan(40);
    expect(stone.l).toBeGreaterThan(70);
    expect(stone.l).toBeLessThan(100);
    expect(deep.l).toBeLessThan(stone.l - 30);
    for (const cue of [
      "#ffda85",
      "#8edfff",
      "#ffd579",
      "#8adfff",
      "#ffdc85",
      "#abc7ff",
      "#ff7799",
      "#a98bff",
    ])
      expect(lum(cue).l).toBeGreaterThan(stone.l + 60);
    // The cover's top lighter steel, its fronts dark slate.
    expect(lum(seven.top[0]).l).toBeGreaterThan(stone.l + 60);
    expect(lum(seven.front[0]).l).toBeLessThan(stone.l - 5);
    // Electric yellow crystal over a deep storm-indigo face.
    const crystal = lum(seven.crystal[1]);
    expect(crystal.l).toBeGreaterThan(180);
    expect(crystal.r + crystal.g - 2 * crystal.b).toBeGreaterThan(300);
    expect(lum(seven.crystal[2]).l).toBeLessThan(60);
    // The inlay is copper (red leads, then green, little blue): never the
    // cues' yellow or blue, and the runes copper too.
    for (const copper of [seven.storm!.copper[0], seven.rune]) {
      const c = lum(copper);
      expect(c.r - c.g).toBeGreaterThan(50);
      expect(c.r - c.b).toBeGreaterThan(100);
    }
    // The number's groove: near black.
    expect(lum(seven.carve).l).toBeLessThan(20);
    // A storm sky low down (slate over a grey horizon), a black storm
    // night at the top.
    const low = lum(seven.skyLow[0]),
      high = lum(seven.skyHigh[0]);
    expect(low.b).toBeGreaterThan(low.r + 30);
    expect(low.l).toBeLessThan(80);
    expect(high.l).toBeLessThan(10);
    expect(lum(seven.cloud[1]).l).toBeLessThan(30);
    // Zone 7 paints differently from zones 1 to 6.
    const z7 = fingerprint(paintZone(7, [61]));
    for (const [z, f] of [
      [1, 1],
      [2, 11],
      [3, 21],
      [4, 31],
      [5, 41],
      [6, 51],
    ])
      expect(z7).not.toBe(fingerprint(paintZone(z, [f])));
  });
  it("zone 7 inlays circuit traces and bolts, stands tesla coils and lightning rods, and hangs forked lightning and rain in the sky", () => {
    const s = spireZoneTheme(7).storm!;
    const count = (log: string[], re: RegExp) =>
      log.filter((l) => re.test(l)).length;
    const esc = (hex: string) =>
      `rgba\\(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},`;
    const low = paintZone(7, [61]),
      high = paintZone(7, [69]);
    // The copper traces: two along each of the 8 spokes (and the rail).
    const copper = new RegExp(`^strokeStyle=${esc(s.copper[0])}0\\.7\\)$`);
    expect(count(low, copper)).toBe(16);
    // Each trace ends in a node (a copper ring round a pale dot).
    const node = new RegExp(`^fillStyle=${esc(s.arc)}0\\.85\\)$`);
    expect(count(low, node)).toBe(16);
    // Copper bolts between the spokes.
    const bolt = new RegExp(`^fillStyle=${esc(s.copper[0])}0\\.55\\)$`);
    expect(count(low, bolt)).toBe(8);
    // Four corner coils (their toroids' lit tops) and six lightning rods,
    // and cover coils on the elite's outcrops.
    const toroid = new RegExp(`^fillStyle=${esc(s.arc)}0\\.9\\)$`);
    expect(count(paintZone(7, []), toroid)).toBe(SPIRE_COILS.length);
    const rods = (log: string[]) =>
      log.filter((l) => l.endsWith(`.stop(0,#ffe6c8)`)).length;
    expect(rods(paintZone(7, []))).toBe(SPIRE_LANTERNS.length);
    // Forked lightning in the sky (its white core), more higher up; rain.
    const sky = (floor: number) => {
      const log: string[] = [];
      paintSpireSky(recordingContext(log), spireZoneTheme(7), floor);
      return log;
    };
    const core = new RegExp(`^strokeStyle=${esc(s.bolt)}0\\.95\\)$`);
    expect(count(sky(61), core)).toBeGreaterThanOrEqual(4);
    expect(count(sky(69), core)).toBeGreaterThan(count(sky(61), core));
    const rain = new RegExp(`^strokeStyle=rgba\\(${s.rain},`);
    expect(count(sky(61), rain)).toBeGreaterThan(200);
    expect(count(sky(69), rain)).toBeGreaterThan(count(sky(61), rain));
    // The storm night: stars only at the top, few.
    const stars = (log: string[]) =>
      count(log, /^fillStyle=rgba\(255,248,232,/);
    expect(stars(sky(61))).toBe(0);
    expect(stars(sky(69))).toBeGreaterThan(20);
    expect(stars(sky(69))).toBeLessThan(100);
    expect(high.length).toBeGreaterThan(low.length);
    // No other zone carries any of it.
    for (const [z, f] of [
      [1, 9],
      [2, 19],
      [3, 29],
      [4, 39],
      [5, 49],
      [6, 59],
    ] as const) {
      const log = paintZone(z, [f]);
      expect(count(log, copper)).toBe(0);
      expect(count(log, node)).toBe(0);
      expect(count(log, core)).toBe(0);
      expect(count(log, rain)).toBe(0);
    }
  });
  it("zone 7 paints nothing pad- or hazard-like under a phone's touch controls", () => {
    // Every radial light zone 7's floor adds (beyond the shared court's)
    // that sits within reach of the controls is small: no disc a player
    // could take for a pad, a field or a safe spot.
    const radials = (log: string[]) =>
      log
        .filter((l) => /^Radial\d+\(/.test(l))
        .map((l) =>
          l
            .replace(/^Radial\d+\(/, "")
            .replace(")", "")
            .split(",")
            .map(Number),
        );
    const shared = new Set(
      radials(paintZone(1, [])).map((r) => r.join(",")),
    );
    const added = radials(paintZone(7, [])).filter(
      (r) => !shared.has(r.join(",")),
    );
    expect(added.length).toBeGreaterThan(0);
    const near = added.filter(([, , , x, y, r]) =>
      spireUnderControls(x, y, r),
    );
    for (const [, , , , , r] of near) expect(r).toBeLessThan(32);
    // The corner coil under the controls stands quiet (no arcs off it);
    // the others crackle.
    const quiet = SPIRE_COILS.filter(([x, y]) => spireUnderControls(x, y, 40));
    expect(quiet.length).toBeGreaterThanOrEqual(1);
    expect(quiet.length).toBeLessThan(SPIRE_COILS.length);
    const s = spireZoneTheme(7).storm!;
    const arcs = paintZone(7, []).filter(
      (l) =>
        l ===
        `strokeStyle=rgba(${[1, 3, 5].map((i) => parseInt(s.arc.slice(i, i + 2), 16)).join(",")},0.85)`,
    ).length;
    expect(arcs).toBe((SPIRE_COILS.length - quiet.length) * 3);
    // The summit grade's rim lightning: never under the controls.
    const log: string[] = [];
    paintStormSummitGrade(recordingContext(log));
    const moves = log
      .filter((l) => /^(moveTo|lineTo)\(/.test(l))
      .map((l) =>
        l
          .replace(/^\w+\(/, "")
          .replace(")", "")
          .split(",")
          .map(Number),
      );
    expect(moves.length).toBeGreaterThan(40);
    for (const [x, y] of moves) {
      expect(spireUnderControls(x, y, 30)).toBe(false);
      // Inside the edge band only (the rush box and posts stand far in).
      expect(Math.min(x, 1600 - x, y, 900 - y)).toBeLessThan(40);
    }
    expect(SPIRE_PHONE_CONTROLS.length).toBeGreaterThan(0);
  });
  it("zone 7's number is centred on the ring for every floor 61 to 69 (no number on floor 70)", () => {
    for (let f = 61; f <= 69; f++) {
      const kind = f === 65 ? "elite" : "wave";
      const n = spireFloorPieces(7, f, kind, 1.4).find(
        (p) => p.name === "number",
      )!;
      expect(n.x + n.w / 2).toBe(800);
      expect(n.y + n.h / 2).toBe(450);
      const log: string[] = [];
      n.paint(recordingContext(log));
      // Two digits at the two-digit size, centred by the glyphs' ink.
      expect(log).toContain('font=700 104px Georgia, "Times New Roman", serif');
      expect(log.filter((l) => l.startsWith(`fillText(${f},`)).length).toBe(
        3,
      );
    }
    expect(
      spireFloorPieces(7, 70, "boss", 1.4).find((p) => p.name === "number"),
    ).toBeUndefined();
  });
  it("zone 7's painting is exactly what it was (recipe recorded with zone 7)", () => {
    const log = paintZone(7, [61, 62, 65, 69]);
    paintStormSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("49627:7ada9f39");
  });
  it("the Storm Twins' own Conductor Ring paints exactly as it did (recipe recorded before zone 7)", () => {
    const log: string[] = [];
    const undo = installRecordingDocument(log);
    try {
      paintRaidFloor(recordingContext(log), "conductor-ring");
      paintIllustratedRaidFloor(
        recordingContext(log),
        "conductor-ring",
        {} as HTMLImageElement,
      );
    } finally {
      undo();
    }
    expect(fingerprint(log)).toBe("7404:c608c7e7");
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
    // Zone 5: untinted on its first floor, a warm gold sunset at the top
    // (red leads blue, unlike every other zone's dusk), never dark.
    expect(spireFloorTint(41, 5)).toBe(0xffffff);
    const warm = (tint: number) => (tint >> 16) - (tint & 255);
    expect(warm(spireFloorTint(49, 5))).toBeGreaterThan(50);
    for (const z of [1, 2, 3, 4])
      expect(warm(spireFloorTint(49, z))).toBeLessThan(0);
    expect(spireFloorTint(49, 5) >> 16).toBeGreaterThan(240);
    expect(spireFloorTint(45, 5)).toBeGreaterThan(spireFloorTint(49, 5));
    // Zone 6: untinted on its first floor, a crimson night at the top (red
    // leads green and blue), never so dark the basalt turns black.
    expect(spireFloorTint(51, 6)).toBe(0xffffff);
    const red = (tint: number) => (tint >> 16) - ((tint >> 8) & 255);
    expect(red(spireFloorTint(59, 6))).toBeGreaterThan(30);
    for (const z of [1, 2, 3, 4])
      expect(red(spireFloorTint(59, z))).toBeLessThan(15);
    expect(spireFloorTint(59, 6) >> 16).toBeGreaterThan(220);
    expect(spireFloorTint(55, 6)).toBeGreaterThan(spireFloorTint(59, 6));
    // Zone 7: untinted on its first floor, a cold storm night at the top
    // (blue leads, darker than zone 3's), never so dark the slate turns
    // black.
    expect(spireFloorTint(61, 7)).toBe(0xffffff);
    expect(blue(spireFloorTint(69, 7))).toBeGreaterThan(35);
    expect(blue(spireFloorTint(69, 7))).toBeGreaterThan(
      blue(spireFloorTint(69, 1)),
    );
    expect(spireFloorTint(69, 7) >> 16).toBeLessThan(
      spireFloorTint(29, 3) >> 16,
    );
    expect(spireFloorTint(69, 7) >> 16).toBeGreaterThan(160);
    expect(spireFloorTint(65, 7)).toBeGreaterThan(spireFloorTint(69, 7));
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
    expect(spireCourtView({ spire: { floor: 45, kind: "elite" } })?.zone).toBe(
      5,
    );
    expect(spireCourtView({ spire: { floor: 50, kind: "boss" } })?.zone).toBe(
      5,
    );
    expect(spireFloorId({ zone: 5, floor: 41, kind: "wave" })).toBe("spire-z5");
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
    expect(nextSpireCourtView({ zone: 5, floor: 44, kind: "wave" })).toEqual({
      zone: 5,
      floor: 45,
      kind: "elite",
    });
    expect(nextSpireCourtView({ zone: 5, floor: 49, kind: "wave" })).toEqual({
      zone: 5,
      floor: 50,
      kind: "boss",
    });
  });
});

describe("summit courts", () => {
  it("floor 10 on Cragmuff's court, floor 20 on Tidelotl's lagoon, each graded", () => {
    expect(spireSummitFloorId(1)).toBe(SPIRE_SUMMIT_FLOOR);
    expect(spireSummitFloorId(2)).toBe(SPIRE_LAGOON_SUMMIT_FLOOR);
    expect(spireSummitFloorId(8)).toBe(SPIRE_SUMMIT_FLOOR);
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
    expect(hasSpireSummitArena("conductor-ring")).toBe(true);
    expect(hasSpireSummitArena("raid-coliseum")).toBe(false);
    expect(
      new Set([
        SPIRE_SUMMIT_FLOOR,
        SPIRE_LAGOON_SUMMIT_FLOOR,
        SPIRE_YARD_SUMMIT_FLOOR,
        SPIRE_DECK_SUMMIT_FLOOR,
        SPIRE_ATRIUM_SUMMIT_FLOOR,
        SPIRE_TERRACE_SUMMIT_FLOOR,
        SPIRE_RING_SUMMIT_FLOOR,
      ]).size,
    ).toBe(7);
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
    // The other zones keep theirs (an unbuilt zone's boss floor: zone 1's).
    expect(spireSummitFloorId(3)).toBe(SPIRE_YARD_SUMMIT_FLOOR);
    expect(spireSummitFloorId(8)).toBe(SPIRE_SUMMIT_FLOOR);
  });
  it("floor 50 on Prismell's Sun Atrium, with its own grade (Prismell's raid untouched)", () => {
    expect(spireSummitFloorId(5)).toBe(SPIRE_ATRIUM_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("sun-atrium")).toBe(SPIRE_ATRIUM_SUMMIT_FLOOR);
    expect(hasSpireSummitArena("sun-atrium")).toBe(true);
    expect(isSpireSummitFloorId(SPIRE_ATRIUM_SUMMIT_FLOOR)).toBe(true);
    // The raid's own arena id is never a summit texture.
    expect(isSpireSummitFloorId("sun-atrium")).toBe(false);
    expect(spireSummitArt(SPIRE_ATRIUM_SUMMIT_FLOOR)).toEqual({
      picture: "sun-atrium",
      grade: paintRadiantSummitGrade,
    });
    // The other zones keep theirs.
    for (const [zone, id] of [
      [1, SPIRE_SUMMIT_FLOOR],
      [2, SPIRE_LAGOON_SUMMIT_FLOOR],
      [3, SPIRE_YARD_SUMMIT_FLOOR],
      [4, SPIRE_DECK_SUMMIT_FLOOR],
    ] as const)
      expect(spireSummitFloorId(zone)).toBe(id);
    expect(spireSummitFloorOf("cloud-deck")).toBe(SPIRE_DECK_SUMMIT_FLOOR);
  });
  it("floor 60 on Lumiwick's Sky Terrace, with its own grade (Lumiwick's raid untouched)", () => {
    expect(spireSummitFloorId(6)).toBe(SPIRE_TERRACE_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("sky-terrace")).toBe(SPIRE_TERRACE_SUMMIT_FLOOR);
    expect(hasSpireSummitArena("sky-terrace")).toBe(true);
    expect(isSpireSummitFloorId(SPIRE_TERRACE_SUMMIT_FLOOR)).toBe(true);
    // The raid's own arena id is never a summit texture.
    expect(isSpireSummitFloorId("sky-terrace")).toBe(false);
    expect(spireSummitArt(SPIRE_TERRACE_SUMMIT_FLOOR)).toEqual({
      picture: "sky-terrace",
      grade: paintEmberSummitGrade,
    });
    // The other zones keep theirs; an unbuilt zone's boss floor, zone 1's.
    for (const [zone, id] of [
      [1, SPIRE_SUMMIT_FLOOR],
      [2, SPIRE_LAGOON_SUMMIT_FLOOR],
      [3, SPIRE_YARD_SUMMIT_FLOOR],
      [4, SPIRE_DECK_SUMMIT_FLOOR],
      [5, SPIRE_ATRIUM_SUMMIT_FLOOR],
      [7, SPIRE_RING_SUMMIT_FLOOR],
      [8, SPIRE_SUMMIT_FLOOR],
    ] as const)
      expect(spireSummitFloorId(zone)).toBe(id);
    expect(spireSummitFloorOf("sun-atrium")).toBe(SPIRE_ATRIUM_SUMMIT_FLOOR);
  });
  it("the terrace's summit grade is a soft crimson nightfall that keeps the middle lit", () => {
    const log: string[] = [];
    paintEmberSummitGrade(recordingContext(log));
    const multiply = log.indexOf("globalCompositeOperation=multiply");
    expect(multiply).toBeGreaterThanOrEqual(0);
    const fill = lum(log[multiply + 1].replace("fillStyle=", ""));
    // Rose-crimson: green drops most (the braziers' teal stands further
    // from the warm stone), soft: red keeps nearly all its light.
    expect(fill.r).toBeGreaterThan(fill.g + 20);
    expect(fill.b).toBeGreaterThanOrEqual(fill.g);
    expect(fill.r).toBeGreaterThan(215);
    expect(fill.l).toBeGreaterThan(190);
    // The edge's night starts about half way out (the braziers stay clear).
    expect(log.some((l) => /^Radial\d+\(800,450,414,/.test(l))).toBe(true);
    // Lanterns strung along the rim only (never inside the edge band).
    const papers = log.filter((l) =>
      /^Radial\d+\([\d.]+,[\d.]+,1,[\d.]+,[\d.]+,[\d.]+\)$/.test(l),
    );
    expect(papers.length).toBeGreaterThanOrEqual(24);
    for (const l of papers) {
      const [x, y] = l
        .replace(/^Radial\d+\(/, "")
        .split(",")
        .map(Number);
      expect(Math.min(x, 1600 - x, y, 900 - y)).toBeLessThan(40);
    }
    const of = (paint: (c: CanvasRenderingContext2D) => void) => {
      const l: string[] = [];
      paint(recordingContext(l));
      return fingerprint(l);
    };
    for (const other of [
      paintSpireSummitGrade,
      paintLagoonSummitGrade,
      paintLanternSummitGrade,
      paintDreamSummitGrade,
      paintRadiantSummitGrade,
    ])
      expect(of(paintEmberSummitGrade)).not.toBe(of(other));
  });
  it("the atrium's summit grade is a soft golden hour that keeps the middle lit", () => {
    const log: string[] = [];
    paintRadiantSummitGrade(recordingContext(log));
    const multiply = log.indexOf("globalCompositeOperation=multiply");
    expect(multiply).toBeGreaterThanOrEqual(0);
    const fill = lum(log[multiply + 1].replace("fillStyle=", ""));
    // A pale gold cream (blue drops; red and green stay level, so the
    // scramble's pink keeps its distance from the floor), soft: the atrium
    // is a bright picture already, and its light cues gain on a slightly
    // deeper floor.
    expect(fill.r).toBeGreaterThan(fill.b + 20);
    expect(Math.abs(fill.r - fill.g)).toBeLessThan(8);
    expect(fill.l).toBeGreaterThan(200);
    // The edge's dusk starts about half way out (the mirrors stay clear).
    expect(log.some((l) => /^Radial\d+\(800,450,414,/.test(l))).toBe(true);
    const of = (paint: (c: CanvasRenderingContext2D) => void) => {
      const l: string[] = [];
      paint(recordingContext(l));
      return fingerprint(l);
    };
    for (const other of [
      paintSpireSummitGrade,
      paintLagoonSummitGrade,
      paintLanternSummitGrade,
      paintDreamSummitGrade,
    ])
      expect(of(paintRadiantSummitGrade)).not.toBe(of(other));
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
    for (const zone of [1, 2, 4, 5, undefined])
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

describe("Echoes on zone 5's bright court", () => {
  it("take a deep indigo shade there (no wash) and flush magenta when hit", () => {
    expect(spireEchoTint(5)).toEqual({
      tint: ECHO_TINT_Z5,
      hurtTint: ECHO_TINT_HURT_Z5,
    });
    const hexOf = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
    const deep = lum(hexOf(ECHO_TINT_Z5)),
      usual = lum(hexOf(ECHO_TINT)),
      hurt = lum(hexOf(ECHO_TINT_HURT_Z5)),
      stone = lum(spireZoneTheme(5).slab[1]);
    // Darker than the usual shade and far darker than the stone's darker
    // tone, and cool (blue leads: gold's opposite) on the warm stone
    // (tests/visual/spire-court.spec.ts measures the Echoes on the court).
    expect(deep.l).toBeLessThan(usual.l - 30);
    expect(deep.l).toBeLessThan(stone.l - 70);
    expect(deep.b).toBeGreaterThan(deep.r + 50);
    // The hit flush reads by hue on the gold stone (magenta: red and blue
    // lead green), never a pale gold.
    expect(hurt.r).toBeGreaterThan(hurt.g + 100);
    expect(hurt.b).toBeGreaterThan(hurt.g + 50);
  });
});

describe("Echoes on zone 6's dusky court", () => {
  it("are pale ice-blue there, washed pale (flushing cyan when hit): cool on the warm basalt", () => {
    expect(spireEchoTint(6)).toEqual({
      tint: ECHO_TINT_Z6,
      hurtTint: ECHO_TINT_HURT_Z6,
      wash: ECHO_WASH_Z6,
    });
    const hexOf = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
    const pale = lum(hexOf(ECHO_TINT_Z6)),
      wash = lum(hexOf(ECHO_WASH_Z6.color)),
      hurt = lum(hexOf(ECHO_TINT_HURT_Z6)),
      stone = lum(spireZoneTheme(6).slab[0]);
    // Far lighter than the stone and cool (blue leads: fire's opposite),
    // the wash lifting even a dark champion off the dusky basalt
    // (tests/visual/spire-court.spec.ts measures the Echoes on the court).
    expect(pale.l).toBeGreaterThan(stone.l + 100);
    expect(pale.b).toBeGreaterThan(pale.r + 30);
    expect(wash.l).toBeGreaterThan(stone.l + 110);
    expect(ECHO_WASH_Z6.alpha).toBeGreaterThan(0.2);
    expect(ECHO_WASH_Z6.alpha).toBeLessThan(0.4);
    // The hit flush reads by hue on the warm stone: cyan (green and blue
    // lead red), never a warm or red flush that could pass for fire.
    expect(hurt.g).toBeGreaterThan(hurt.r + 40);
    expect(hurt.b).toBeGreaterThan(hurt.r + 40);
  });
});
