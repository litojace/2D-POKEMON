import { describe, expect, it } from "vitest";
import { SOMNARA, TIDEWYRM } from "../../packages/shared/src/raid";
import type { Snapshot } from "../../packages/shared/src/index";
import { packMapPieces } from "../../apps/client/src/raid-map-atlas";
import {
  ISLAND_RADII,
  crackBox,
  lagoonPieces,
} from "../../apps/client/src/raid-lagoon-pieces";
import { cloudDeckPieces } from "../../apps/client/src/raid-cloud-deck-pieces";
import {
  correctStepPad,
  isNightmare,
  padAtPoint,
  padsUnderRaiders,
  quietRadiusFor,
} from "../../apps/client/src/raid-somnara-art";

type Event = Snapshot["events"][number];
const event = (o: Partial<Event>): Event => ({
  id: 1,
  kind: "heal",
  x: 0,
  y: 0,
  color: 0,
  ...o,
});

describe("Somnara's steps, read from the events the client already gets", () => {
  it("finds the pad under a point by the server's entry radius", () => {
    for (const pad of SOMNARA.pads) {
      expect(padAtPoint(pad.x, pad.y)).toBe(pad.rune);
      expect(padAtPoint(pad.x + SOMNARA.padRadius, pad.y)).toBe(pad.rune);
      expect(
        padAtPoint(pad.x + SOMNARA.padRadius + 0.5, pad.y),
      ).toBeUndefined();
    }
    expect(padAtPoint(800, 450)).toBeUndefined();
  });
  it("matches a correct step: a value-0 mint heal on a pad", () => {
    const star = SOMNARA.pads.find((p) => p.rune === "star")!;
    const step = { x: star.x - 30, y: star.y + 20, color: 0x99efdd, value: 0 };
    expect(correctStepPad(event(step))).toBe("star");
    // An orb pick-up heals for something, a value-0 heal elsewhere is no step.
    expect(correctStepPad(event({ ...step, value: 25 }))).toBeUndefined();
    expect(correctStepPad(event({ ...step, color: 0x7dffb0 }))).toBeUndefined();
    expect(correctStepPad(event({ ...step, x: 800, y: 450 }))).toBeUndefined();
    expect(correctStepPad(event({ ...step, kind: "hit" }))).toBeUndefined();
  });
  it("tells the Nightmare from other violet impacts by its 500 reach", () => {
    const night = {
      kind: "raid-impact" as const,
      color: 0xc090ff,
      raidRadius: 500,
    };
    expect(isNightmare(event(night))).toBe(true);
    // Falling stars and the tail splash land with their own (small) radius.
    expect(
      isNightmare(event({ ...night, color: 0xc9a3ff, raidRadius: 90 })),
    ).toBe(false);
    expect(isNightmare(event({ ...night, raidRadius: 90 }))).toBe(false);
  });
  it("finds the wrong step: pads with a living raider on them", () => {
    const moon = SOMNARA.pads.find((p) => p.rune === "moon")!;
    const state = {
      players: [
        { id: "a", x: moon.x + 10, y: moon.y, hp: 50 },
        { id: "b", x: 800, y: 450, hp: 50 },
        // The whale and the downed don't step on pads.
        { id: "boss", raidBoss: true, x: 500, y: 270, hp: 900 },
        { id: "c", x: 500, y: 630, hp: 0 },
      ],
    } as unknown as Snapshot;
    expect(padsUnderRaiders(state)).toEqual(["moon"]);
  });
  it("predicts the Quiet Zone's radius as the server sets it", () => {
    const s = (peril: number, trait?: string) =>
      ({ raid: { peril, trait } }) as unknown as Snapshot;
    expect(quietRadiusFor(s(1))).toBe(SOMNARA.song.radius[1]);
    expect(quietRadiusFor(s(3))).toBe(SOMNARA.song.radius[3]);
    expect(quietRadiusFor(s(2, "starry-night"))).toBe(
      SOMNARA.song.radius[2] + 35,
    );
    const live = {
      raid: { peril: 1, quietZone: { radius: 999 } },
    } as unknown as Snapshot;
    expect(quietRadiusFor(live)).toBe(999);
  });
});

describe("arena atlases", () => {
  it("packs every piece without overlaps, inside one 2048-wide canvas", () => {
    for (const pieces of [
      ...ISLAND_RADII.map((R) => lagoonPieces(R)),
      cloudDeckPieces(175),
    ]) {
      const a = packMapPieces(pieces, 2);
      expect(a.width).toBe(2048);
      expect(a.height).toBeLessThanOrEqual(2048);
      expect(new Set(pieces.map((p) => p.name)).size).toBe(pieces.length);
      for (const s of a.spots) {
        expect(s.x + s.pw).toBeLessThanOrEqual(a.width);
        expect(s.y + s.ph).toBeLessThanOrEqual(a.height);
      }
      for (const [i, p] of a.spots.entries())
        for (const q of a.spots.slice(i + 1))
          expect(
            p.x + p.pw <= q.x ||
              q.x + q.pw <= p.x ||
              p.y + p.ph <= q.y ||
              q.y + q.ph <= p.y,
          ).toBe(true);
    }
  });
  it("keeps every gameplay edge inside its piece at its exact radius", () => {
    for (const R of ISLAND_RADII) {
      const byName = new Map(lagoonPieces(R).map((p) => [p.name, p]));
      // Centred pieces: half the size must reach the ring they carry.
      expect(byName.get(`body${R}`)!.w / 2).toBeGreaterThanOrEqual(R);
      expect(byName.get(`gold${R}`)!.w / 2).toBeGreaterThan(R + 10 + 3);
      expect(byName.get(`red${R}`)!.w / 2).toBeGreaterThan(R + 3 + 3);
      // A crack's box stays on its island.
      for (let i = 0; i < TIDEWYRM.islands.length; i++)
        for (let ci = 0; ci < 2; ci++) {
          const b = crackBox(R, i, ci);
          expect(b.x0).toBeGreaterThanOrEqual(-R);
          expect(b.y0).toBeGreaterThanOrEqual(-R);
          expect(b.x0 + b.w).toBeLessThanOrEqual(R);
          expect(b.y0 + b.h).toBeLessThanOrEqual(R);
        }
    }
    const deck = new Map(cloudDeckPieces(175).map((p) => [p.name, p]));
    expect(deck.get("edge-star")!.w / 2).toBeGreaterThan(SOMNARA.padRadius + 9);
    expect(deck.get("quiet-175")!.w / 2).toBeGreaterThan(175 + 2.5);
    expect(deck.get("bubble")!.w / 2).toBeGreaterThan(SOMNARA.bubbles.radius);
    expect(deck.get("mist")!.w / 2).toBeGreaterThan(45);
  });
});
