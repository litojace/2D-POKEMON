/**
 * The Spire court's zone looks (apps/client/src/spire-court-art.ts): the
 * lookup the floor flow calls (`spireZoneTheme`), zone 2's Water look,
 * zone 1's painting left exactly as it was, the floor tint by zone, how the
 * rig reads a snapshot's zone and the boss floors' summit courts.
 */
import { describe, expect, it } from "vitest";
import {
  SPIRE_ZONE_THEMES,
  paintLagoonSummitGrade,
  paintSpireFloor,
  paintSpireSky,
  paintSpireSummitGrade,
  spireFloorPieces,
  spireFloorTint,
  spireTheme,
  spireZoneTheme,
} from "../../apps/client/src/spire-court-art";
import {
  SPIRE_LAGOON_SUMMIT_FLOOR,
  SPIRE_SUMMIT_FLOOR,
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
  it("gives zone 1 (Earth) and zone 2 (Water); unknown zones fall back to zone 1", () => {
    expect(spireZoneTheme(1)).toBe(SPIRE_ZONE_THEMES[1]);
    expect(spireZoneTheme(2)).toBe(SPIRE_ZONE_THEMES[2]);
    expect(spireZoneTheme(1).zone).toBe(1);
    expect(spireZoneTheme(2).zone).toBe(2);
    for (const z of [0, -1, 3, 99, NaN, 1.5])
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
  it("zone 1's painting is exactly what it was (recipe recorded before zone 2)", () => {
    const log = paintZone(1, [1, 2, 5, 9]);
    paintSpireSummitGrade(recordingContext(log));
    expect(fingerprint(log)).toBe("37336:e022bcfd");
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
