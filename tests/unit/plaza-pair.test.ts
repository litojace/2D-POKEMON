import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import {
  PLAZA,
  PLAZA_EMOTES,
  PLAZA_FLAG,
  PLAZA_PAIR,
  PLAZA_PAIR_EMOTES,
  plazaPairOf,
} from "../../packages/shared/src/plaza";

const profile = (name: string) => ({
  name,
  title: null,
  titleColor: null,
  level: null,
  character: "voltkit",
  skin: null,
});
const DT = 1 / PLAZA.tick;
/** 21:16 UTC: between Orb Showers. */
const QUIET = Date.parse("2026-11-02T21:16:00.000Z");
const run = (world: PlazaWorld, seconds: number, from: number) => {
  let now = from;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    now += DT * 1000;
    world.step(DT, now);
  }
  return now;
};
const place = (world: PlazaWorld, key: string, x: number, y: number) => {
  const b = world.bodyOf(key)!;
  b.x = x;
  b.y = y;
};
/** What `viewer` sees of the walker `of` (by socket key). */
const walker = (world: PlazaWorld, viewer: string, of: string) => {
  const id = world.profileOf(of)!.id;
  return world.view(viewer)!.state.walkers.find((w) => w[0] === id)!;
};
const two = () => {
  const world = new PlazaWorld(
    () => 0.5,
    () => QUIET,
  );
  world.join("a", "acc-a", profile("Ann"), QUIET);
  world.join("b", "acc-b", profile("Bo"), QUIET);
  place(world, "a", 1350, 1150);
  place(world, "b", 1450, 1150);
  return world;
};

describe("pair emotes (shared)", () => {
  it("keeps the snapshot flags apart and maps each pair emote both ways", () => {
    const bits = Object.values(PLAZA_FLAG);
    expect(new Set(bits).size).toBe(bits.length);
    for (const f of bits) expect(Math.log2(f) % 1).toBe(0);
    const ids = PLAZA_PAIR_EMOTES.map((p) => p.id),
      emotes = PLAZA_PAIR_EMOTES.map((p) => p.emote);
    expect(new Set(ids).size).toBe(ids.length);
    // A distinct ordinary emote each, so the emote field says which.
    expect(new Set(emotes).size).toBe(emotes.length);
    for (const p of PLAZA_PAIR_EMOTES) {
      const index = PLAZA_EMOTES.indexOf(p.emote) + 1;
      expect(index).toBeGreaterThan(0);
      expect(plazaPairOf(index, PLAZA_FLAG.pair)?.id).toBe(p.id);
      // Without the flag it is the ordinary emote.
      expect(plazaPairOf(index, 0)).toBeUndefined();
    }
    expect(plazaPairOf(0, PLAZA_FLAG.pair)).toBeUndefined();
  });
});

describe("pair emotes (server)", () => {
  it("asks, and on yes plays it for both, facing each other, for two seconds", () => {
    const world = two();
    const bId = world.profileOf("b")!.id,
      aId = world.profileOf("a")!.id;
    const ask = world.pairAsk("a", bId, "highfive", QUIET);
    expect(ask).toEqual({
      ok: true,
      to: "b",
      ask: {
        from: aId,
        name: "Ann",
        kind: "highfive",
        ms: PLAZA_PAIR.askSeconds * 1000,
      },
    });
    const yes = world.pairAnswer("b", aId, true, QUIET + 1000);
    expect(yes).toEqual({
      ok: true,
      keys: ["a", "b"],
      start: { kind: "highfive", a: aId, b: bId },
    });
    run(world, 0.2, QUIET + 1000);
    const emote = PLAZA_EMOTES.indexOf("👏") + 1;
    for (const [viewer, of] of [
      ["b", "a"],
      ["a", "b"],
    ]) {
      const w = walker(world, viewer, of);
      expect(w[6]).toBe(emote);
      expect(w[5] & PLAZA_FLAG.pair).toBeTruthy();
      expect(plazaPairOf(w[6], w[5])?.id).toBe("highfive");
    }
    // Ann stands west of Bo: they face each other.
    expect(world.bodyOf("a")!.face).toBe(1);
    expect(world.bodyOf("b")!.face).toBe(-1);
    run(world, PLAZA_PAIR.playSeconds, QUIET + 1200);
    const after = walker(world, "b", "a");
    expect(after[6]).toBe(0);
    expect(after[5] & PLAZA_FLAG.pair).toBe(0);
    // The same request can't be answered twice.
    expect(world.pairAnswer("b", aId, true, QUIET + 4000).ok).toBe(false);
  });
  it("tells the asker of a no, and lets a request lapse after its seconds", () => {
    const world = two();
    const aId = world.profileOf("a")!.id,
      bId = world.profileOf("b")!.id;
    world.pairAsk("a", bId, "hug", QUIET);
    expect(world.pairAnswer("b", aId, false, QUIET + 500)).toEqual({
      ok: true,
      declined: true,
      asker: "a",
    });
    const later = QUIET + PLAZA_PAIR.askEvery * 1000;
    expect(world.pairAsk("a", bId, "dance", later).ok).toBe(true);
    const r = world.pairAnswer(
      "b",
      aId,
      true,
      later + PLAZA_PAIR.askSeconds * 1000 + 1,
    );
    expect(r).toEqual({ ok: false, error: "That request has ended." });
    expect(walker(world, "b", "a")[6]).toBe(0);
  });
  it("never asks yourself, a bot, a stranger to your copy, or someone far away", () => {
    const world = two();
    const aId = world.profileOf("a")!.id,
      bId = world.profileOf("b")!.id;
    expect(world.pairAsk("a", aId, "highfive", QUIET).ok).toBe(false);
    const bot = world
      .view("a")!
      .state.walkers.find((w) => w[5] & PLAZA_FLAG.bot)!;
    expect(bot).toBeDefined();
    expect(world.pairAsk("a", bot[0], "highfive", QUIET)).toEqual({
      ok: false,
      error: "They can't be asked right now.",
    });
    expect(world.pairAsk("a", 9999, "highfive", QUIET).ok).toBe(false);
    expect(world.pairAsk("a", bId, "wave", QUIET)).toEqual({
      ok: false,
      error: "Pick a pair emote.",
    });
    place(world, "b", 1350 + PLAZA_PAIR.reach + 20, 1150);
    expect(world.pairAsk("a", bId, "highfive", QUIET)).toEqual({
      ok: false,
      error: "Walk a little closer first.",
    });
  });
  it("never delivers a request between blocked players, either way", () => {
    const world = two();
    const aId = world.profileOf("a")!.id,
      bId = world.profileOf("b")!.id;
    const blocked = (x: string, y: string) =>
      (x === "acc-b" && y === "acc-a") || (x === "acc-a" && y === "acc-b");
    expect(world.pairAsk("a", bId, "highfive", QUIET, blocked)).toEqual({
      ok: false,
      error: "They can't be asked right now.",
    });
    expect(world.pairAsk("b", aId, "highfive", QUIET, blocked).ok).toBe(false);
    // Nothing reached Bo to answer.
    expect(world.pairAnswer("b", aId, true, QUIET).ok).toBe(false);
    // Blocked after asking: the answer goes nowhere.
    world.pairAsk("a", bId, "hug", QUIET);
    expect(world.pairAnswer("b", aId, true, QUIET + 100, blocked).ok).toBe(
      false,
    );
    expect(walker(world, "a", "b")[6]).toBe(0);
  });
  it("asks at most once every few seconds, and one open request per player", () => {
    const world = two();
    world.join("c", "acc-c", profile("Cy"), QUIET);
    place(world, "c", 1400, 1200);
    const bId = world.profileOf("b")!.id;
    expect(world.pairAsk("a", bId, "highfive", QUIET).ok).toBe(true);
    expect(world.pairAsk("a", bId, "hug", QUIET + 500)).toEqual({
      ok: false,
      error: "Wait a moment before asking again.",
    });
    expect(world.pairAsk("c", bId, "hug", QUIET + 500)).toEqual({
      ok: false,
      error: "They're answering someone else.",
    });
    // Once Ann's request lapses, Cy can ask.
    expect(
      world.pairAsk("c", bId, "hug", QUIET + PLAZA_PAIR.askSeconds * 1000 + 1)
        .ok,
    ).toBe(true);
  });
  it("ends the request when the asker leaves or wanders off", () => {
    const world = two();
    const aId = world.profileOf("a")!.id,
      bId = world.profileOf("b")!.id;
    world.pairAsk("a", bId, "highfive", QUIET);
    place(world, "a", 1450 - PLAZA_PAIR.reach - PLAZA_PAIR.slack - 20, 1150);
    expect(world.pairAnswer("b", aId, true, QUIET + 100)).toEqual({
      ok: false,
      error: "You've moved too far apart.",
    });
    place(world, "a", 1350, 1150);
    world.pairAsk("a", bId, "highfive", QUIET + 4000);
    world.leave("a", QUIET + 4100);
    expect(world.pairAnswer("b", aId, true, QUIET + 4200).ok).toBe(false);
  });
});
