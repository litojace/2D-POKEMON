/**
 * The Spire's checkpoint after each zone's elite: once every climber has
 * beaten the elite (floor 5 of a zone) and until they conquer the zone, a
 * climb starts on the floor after it, and first picks the blessings of the
 * floors it skipped (the floors are tuned with them: each zone's play-test
 * hands the bot one blessing per floor from the zone's second floor on).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { RULES } from "@arena/shared";
import { SpireArena, createSpireArena } from "../../apps/server/src/spire";
import {
  SPIRE_BUILT_ZONES,
  SPIRE_FLOORS,
  spireBlessingOffer,
  spireCatchUpPicks,
  spireEliteFloor,
  spireResumeFloor,
  spireStartFrom,
  spireZoneStart,
  spireZoneTop,
  type SpireBlessings,
} from "../../packages/shared/src/spire";

const DT = 1 / RULES.tick;
afterEach(() => vi.restoreAllMocks());

describe("the checkpoint after the elite (shared rules)", () => {
  it("finds every built zone's elite in the floor data: its floor 5", () => {
    for (const z of SPIRE_BUILT_ZONES) {
      const elite = spireEliteFloor(z)!;
      expect(elite, `zone ${z}`).toBe(spireZoneStart(z) + 4);
      expect(SPIRE_FLOORS[elite].kind).toBe("elite");
    }
    expect(spireEliteFloor(99)).toBeUndefined();
  });
  it("resumes past the elite once it is beaten, until the zone is conquered", () => {
    expect(spireResumeFloor(1, 0)).toBe(1);
    expect(spireResumeFloor(1, 4)).toBe(1);
    expect(spireResumeFloor(1, 5)).toBe(6);
    expect(spireResumeFloor(1, 9)).toBe(6);
    // Conquered: a climb of it again is the whole zone.
    expect(spireResumeFloor(1, 10)).toBe(1);
    expect(spireResumeFloor(1, 37)).toBe(1);
    expect(spireResumeFloor(2, 14)).toBe(11);
    expect(spireResumeFloor(2, 15)).toBe(16);
    expect(spireResumeFloor(7, 69)).toBe(66);
    expect(spireResumeFloor(7, 70)).toBe(61);
    for (const z of SPIRE_BUILT_ZONES) {
      const r = spireResumeFloor(z, spireZoneTop(z) - 1);
      expect(SPIRE_FLOORS[r].kind, `zone ${z}`).toBe("wave");
      expect(r).toBeLessThan(spireZoneTop(z));
    }
  });
  it("owes one blessing per skipped floor after the first", () => {
    expect(spireCatchUpPicks(1, 1)).toBe(0);
    expect(spireCatchUpPicks(1, 6)).toBe(5);
    expect(spireCatchUpPicks(2, 16)).toBe(5);
    expect(spireCatchUpPicks(7, 66)).toBe(5);
  });
});

describe("where a party resumes (spireStartFrom)", () => {
  const m = (highestFloor: number, checkpoint = 1) => ({
    checkpoint,
    highestFloor,
    clears: { grumblecrag: 1, tidewyrm: 1 },
  });
  it("starts a climber past the elite they have beaten", () => {
    expect(spireStartFrom([m(5)], 1)).toEqual({
      ok: true,
      startFloor: 6,
      ceiling: 10,
      highest: [5],
      resumed: true,
    });
    expect(spireStartFrom([m(15, 11)], 2)).toMatchObject({
      ok: true,
      startFloor: 16,
      resumed: true,
    });
  });
  it("starts a party at its lowest: everyone must have beaten the elite", () => {
    expect(spireStartFrom([m(7), m(6)], 1)).toMatchObject({
      startFloor: 6,
      resumed: true,
    });
    const behind = spireStartFrom([m(7), m(3)], 1);
    expect(behind).toMatchObject({ ok: true, startFloor: 1 });
    expect(behind.resumed).toBeUndefined();
    // Someone who conquered the zone climbs it whole: so does the party.
    expect(spireStartFrom([m(7), m(14, 11)], 1)).toMatchObject({
      startFloor: 1,
    });
  });
  it("still needs the zone's checkpoint, whatever the highest floor", () => {
    expect(spireStartFrom([m(15, 1)], 2)).toMatchObject({ ok: false });
  });
  it("starts older members (no highest floor) at the zone's first floor", () => {
    expect(
      spireStartFrom([{ checkpoint: 11, clears: { grumblecrag: 1 } }], 2),
    ).toMatchObject({ ok: true, startFloor: 11, highest: [0] });
  });
});

/** A zone-1 room whose climb the server resumed at floor 6. */
function resumed(o: { highest?: number[]; chars?: number } = {}) {
  const a = new SpireArena("CHK1");
  for (let i = 0; i < (o.chars ?? 1); i++) a.add("p" + i, "P" + i, "voltkit");
  a.configureSpire({
    startFloor: 6,
    ceiling: 10,
    resumed: true,
    highest: o.highest ?? [5],
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
/** Tick until the phase changes (or a limit). */
function until(a: SpireArena, ok: () => boolean, seconds = 60) {
  for (let t = 0; t < seconds && !ok(); t += DT) a.tick(DT);
}

describe("a climb resumed past the elite (the server)", () => {
  it("deals the skipped floors' cards one choice after another, then fights floor 6", () => {
    const a = resumed();
    const s = a.raid.spire!;
    const mine: SpireBlessings = {};
    for (let round = 1; round <= 5; round++) {
      expect(a.phase, `round ${round}`).toBe("intermission");
      expect(s.floor).toBe(6);
      expect(s.catchUp).toEqual({ round, of: 5 });
      // The cards a climb from floor 1 would have been dealt for floor round + 1.
      const offer = spireBlessingOffer(a.spire.seed, round + 1, 0, mine);
      expect(s.offers.p0).toEqual(offer);
      mine[offer[0]] = (mine[offer[0]] ?? 0) + 1;
      expect(a.pickRite("p0", offer[0])).toBe(true);
      until(a, () => a.phase !== "intermission", 3);
    }
    expect(s.blessings.p0).toEqual(mine);
    until(a, () => a.phase === "playing", 10);
    expect(a.phase).toBe("playing");
    expect(s.floor).toBe(6);
    expect(Object.values(mine).reduce((n, k) => n + k!, 0)).toBe(5);
  });
  it("picks the first card for anyone who doesn't choose in time", () => {
    const a = resumed({ chars: 2 });
    until(a, () => a.phase === "playing", 5 * 22 + 10);
    expect(a.phase).toBe("playing");
    for (const id of ["p0", "p1"])
      expect(
        Object.values(a.raid.spire!.blessings[id] ?? {}).reduce(
          (n, k) => n + k!,
          0,
        ),
      ).toBe(5);
  });
  it("deals one card a floor after that, as any climb", () => {
    const a = resumed();
    until(a, () => a.phase === "playing", 5 * 22 + 10);
    const s = a.raid.spire!;
    for (const p of a.players.filter((p) => p.echo)) p.hp = 0;
    until(
      a,
      () => {
        for (const p of a.players.filter((p) => p.echo)) p.hp = 0;
        for (const p of a.heroes()) p.hp = 9999;
        return a.phase === "intermission";
      },
      120,
    );
    expect(a.phase).toBe("intermission");
    expect(s.floor).toBe(7);
    expect(s.catchUp).toBeUndefined();
    expect(s.offers.p0).toEqual(
      spireBlessingOffer(a.spire.seed, 7, 0, s.blessings.p0),
    );
  });
  it("deals no cards before a climb that starts where the server didn't resume it", () => {
    const a = new SpireArena("CHK2");
    a.add("p0", "P0", "voltkit");
    a.configureSpire({ startFloor: 6, ceiling: 9 });
    a.start();
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("countdown");
    expect(a.raid.spire!.catchUp).toBeUndefined();
  });
  it("keeps the party's next checkpoint, and says it when the climb fails", () => {
    const a = resumed();
    const s = a.raid.spire!;
    expect(s.checkpoint).toBe(6);
    a.forfeit("p0");
    expect(a.raid.message).toContain("Climb again from floor 6");
  });
});

describe("the party's next checkpoint (nextStart)", () => {
  const room = (highest: number[], best: number) => {
    const a = createSpireArena("CHK3", 1) as SpireArena;
    a.add("p0", "P0", "voltkit");
    a.configureSpire({ startFloor: 1, ceiling: 10, highest });
    a.start();
    a.raid.spire!.best = best;
    return a;
  };
  it("moves past the elite once this climb beats it", () => {
    expect(room([0], 0).raid.spire!.checkpoint).toBe(1);
    expect(room([0], 4).nextStart()).toBe(1);
    expect(room([0], 5).nextStart()).toBe(6);
    expect(room([0, 2], 7).nextStart()).toBe(6);
  });
  it("stays at the zone's first floor for a climber who conquered it, or without saved progress", () => {
    expect(room([0, 12], 7).nextStart()).toBe(1);
    expect(room([], 7).nextStart()).toBe(1);
    // The boss floor beaten: the zone is conquered.
    expect(room([5], 10).nextStart()).toBe(1);
  });
});
