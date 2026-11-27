import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { createSpireArena } from "../../apps/server/src/spire";
import {
  MetaTracker,
  SnapshotDeltaDecoder,
  SnapshotDeltaEncoder,
  cloneData,
  packSnapshot,
  type ObjectDelta,
  type WireSnapshot,
} from "../../packages/shared/src/index";
import { RAID_BOSSES } from "../../packages/shared/src/raid-roster";
import type { RaidBossId } from "../../packages/shared/src/raid";
import { ROSTER, dressUp, driveInputs } from "../../scripts/perf/workloads";

// Snapshots as changes (snapshot-delta.ts): whatever a room does, the client
// must end up holding exactly the snapshot it would have parsed whole.

/** What a client parsing the whole message would hold. */
const parsed = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** Over the network: the delta is text between the two ends. */
const sent = parsed;

/** A room mid-fight with every seat dressed up (as workloads.ts does). */
function fight(a: Arena, seats: number) {
  for (let i = 0; i < seats; i++)
    a.add(`p${i + 1}`, `Player ${i + 1}`, ROSTER[(i * 3) % ROSTER.length]);
  a.players.forEach((p, i) => dressUp(p, i));
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 10_000;
  return a;
}
/** The room's snapshots as the server would send them, tick by tick. */
function* wires(a: Arena, ticks: number, drive = true) {
  const tracker = new MetaTracker();
  let cursor = 0,
    n = 0;
  for (let tick = 0; tick < ticks; tick++) {
    if (drive) driveInputs(a, tick);
    a.tick();
    const snapshot = a.snapshot(0);
    snapshot.events = snapshot.events.filter((e) => e.id > cursor);
    if (snapshot.events.length) cursor = snapshot.events.at(-1)!.id;
    const changed = tracker.update(snapshot.players);
    const wire = packSnapshot(snapshot, {
      compact: true,
      metaRev: tracker.rev,
      meta:
        changed || tick % 97 === 0 ? tracker.meta(snapshot.players) : undefined,
    });
    wire.n = ++n;
    yield wire;
  }
}
/** Run a room through both ends and check every snapshot on the way. */
function roundTrip(a: Arena, ticks: number, drive = true) {
  const encoder = new SnapshotDeltaEncoder();
  const decoder = new SnapshotDeltaDecoder();
  let full = 0,
    delta = 0,
    events = 0;
  for (const wire of wires(a, ticks, drive)) {
    const expected = parsed(wire);
    events += expected.events.length;
    const d = encoder.encode(wire);
    let got: WireSnapshot | undefined;
    if (!d) {
      decoder.full(sent(wire));
      got = expected;
      full += JSON.stringify(wire).length;
    } else {
      const message = sent({ code: wire.code, n: wire.n!, d });
      got = decoder.delta(message);
      full += JSON.stringify(wire).length;
      delta += JSON.stringify(message).length;
    }
    // toStrictEqual: an extra key or an `undefined` left behind fails too.
    expect(got).toStrictEqual(expected);
  }
  return { full, delta, events };
}

describe("a delta rebuilds exactly the snapshot it stands for", () => {
  it.each(["duel", "ffa", "teams"] as const)("%s", (mode) => {
    const a = fight(new Arena("DELTA1", mode), mode === "duel" ? 2 : 4);
    const { full, delta, events } = roundTrip(a, 900);
    expect(events).toBeGreaterThan(20);
    // And it is worth sending: well under half the bytes.
    expect(delta / full).toBeLessThan(0.45);
  });
  it.each(Object.keys(RAID_BOSSES) as RaidBossId[])("raid: %s", (boss) => {
    const a = fight(createRaidArena("DELTA2", boss), 4);
    const { full, delta } = roundTrip(a, 1200);
    expect(delta / full).toBeLessThan(0.45);
  });
  it.each([1, 2, 3, 4, 5, 6, 7])("Spire zone %i", (zone) => {
    const a = fight(createSpireArena("DELTA3", zone), 1);
    roundTrip(a, 900);
  });
  it("Tidelotl's bubble roots (raid.rooted) come and go as changes", () => {
    // The server writes the record in place and drops a root as it
    // expires (raid-tidewyrm.ts): the delta must carry both.
    const a = fight(createRaidArena("DELTA5", "tidewyrm"), 2);
    const encoder = new SnapshotDeltaEncoder();
    const decoder = new SnapshotDeltaDecoder();
    const seen = { two: 0, gone: 0 };
    let tick = 0;
    for (const wire of wires(a, 150)) {
      const expected = parsed(wire);
      const d = encoder.encode(wire);
      if (!d) decoder.full(sent(wire));
      else
        expect(
          decoder.delta(sent({ code: wire.code, n: wire.n!, d })),
        ).toStrictEqual(expected);
      const roots = Object.keys(expected.raid?.rooted ?? {}).length;
      if (roots === 2) seen.two++;
      if (seen.two && !expected.raid?.rooted) seen.gone++;
      tick++;
      if (tick === 10) (a.raid.rooted ??= {}).p1 = a.time + 0.8;
      if (tick === 16) (a.raid.rooted ??= {}).p2 = a.time + 0.4;
    }
    expect(seen.two).toBeGreaterThan(0);
    expect(seen.gone).toBeGreaterThan(0);
  });
  it("a whole match: lobby, countdown, rounds, results", () => {
    const a = new Arena("DELTA4", "duel");
    a.add("p1", "One", "voltkit");
    a.add("p2", "Two", "tidefin");
    const encoder = new SnapshotDeltaEncoder();
    const decoder = new SnapshotDeltaDecoder();
    const phases = new Set<string>();
    let n = 0;
    const check = () => {
      const wire = packSnapshot(a.snapshot(0), { compact: true, metaRev: 0 });
      wire.n = ++n;
      phases.add(wire.phase);
      const d = encoder.encode(wire);
      if (!d) return decoder.full(sent(wire));
      expect(decoder.delta(sent({ code: wire.code, n, d }))).toStrictEqual(
        parsed(wire),
      );
    };
    check();
    for (const p of a.players) p.ready = true;
    a.start();
    check();
    for (const p of a.players) a.acknowledgeInstructions(p.id);
    for (let tick = 0; tick < 30 * 120 && a.phase !== "finished"; tick++) {
      // One side is knocked out a second into each round.
      if (a.phase === "playing" && tick % 30 === 0) a.players[1].hp = 0;
      a.tick();
      check();
    }
    expect([...phases]).toEqual(
      expect.arrayContaining(["lobby", "countdown", "playing", "finished"]),
    );
  });
});

describe("the format", () => {
  const through = (before: unknown, after: unknown, strict = true) => {
    const encoder = new SnapshotDeltaEncoder();
    const decoder = new SnapshotDeltaDecoder();
    const a = { code: "X", n: 1, v: before } as unknown as WireSnapshot;
    const b = { code: "X", n: 2, v: after } as unknown as WireSnapshot;
    expect(encoder.encode(a)).toBeUndefined();
    decoder.full(sent(a));
    // As the client receives it (the encoder's own values carry its notes).
    const d = sent(encoder.encode(b)!);
    const got = decoder.delta({ code: "X", n: 2, d });
    // (Strict equality reads `.constructor` to compare types: not for the
    // test whose data has a key of that name.)
    if (strict) expect(got).toStrictEqual(parsed(b));
    else expect(JSON.stringify(got)).toBe(JSON.stringify(b));
    return (d.d?.v ?? d.s?.v) as unknown;
  };
  it("sends only the fields that changed", () => {
    expect(
      through(
        { hp: 5, x: 1, stats: { dealt: 3, hits: 1 } },
        { hp: 5, x: 2, stats: { dealt: 3, hits: 2 } },
      ),
    ).toEqual({ s: { x: 2 }, d: { stats: { s: { hits: 2 } } } });
  });
  it("drops keys that went away, and keys that became undefined", () => {
    expect(through({ a: 1, b: 2, c: 3 }, { a: 1, c: undefined })).toEqual({
      x: ["b", "c"],
    });
  });
  it("matches things with an id by id: new, gone, moved, changed", () => {
    const shot = (id: number, x: number) => ({ id, x, owner: "p1" });
    expect(
      through(
        [shot(1, 0), shot(2, 0), shot(3, 0)],
        [shot(3, 0), shot(2, 5), shot(4, 1)],
      ),
    ).toEqual({
      o: [3, 2, 4],
      a: [shot(4, 1)],
      u: [[1, { s: { x: 5 } }]],
    });
    // The usual tick: the same things in the same places.
    expect(through([shot(1, 0), shot(2, 0)], [shot(1, 0), shot(2, 9)])).toEqual(
      { u: [[1, { s: { x: 9 } }]] },
    );
    expect(through([shot(1, 0)], [])).toEqual({ o: [] });
    expect(through([], [shot(1, 0)])).toEqual({ o: [1], a: [shot(1, 0)] });
  });
  it("tells id 1 from id '1'", () => {
    through(
      [
        { id: 1, v: "n" },
        { id: "1", v: "s" },
      ],
      [
        { id: "1", v: "s2" },
        { id: 1, v: "n" },
      ],
    );
  });
  it("sends other lists whole, and only when they differ", () => {
    expect(through([0, 0, 1.5], [0, 0, 1.5])).toBeUndefined();
    expect(through([0, 0, 1.5], [0, 2, 1.5])).toEqual([0, 2, 1.5]);
    expect(through([[1, 2]], [[1, 3]])).toEqual([[1, 3]]);
    // Two things sharing an id cannot be matched by it.
    expect(
      through([{ id: 1 }, { id: 1 }], [{ id: 1 }, { id: 2, a: 1 }, { id: 1 }]),
    ).toEqual([{ id: 1 }, { id: 2, a: 1 }, { id: 1 }]);
    expect(
      through([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 1 }, { id: 2 }]),
    ).toEqual([{ id: 1 }, { id: 1 }, { id: 2 }]);
  });
  it("compares as JSON writes: NaN and Infinity are null, -0 is 0", () => {
    expect(
      through({ a: null, b: 0, c: [null] }, { a: NaN, b: -0, c: [Infinity] }),
    ).toBeUndefined();
    expect(through({ a: 1 }, { a: NaN })).toEqual({ s: { a: null } });
    expect(through([1, 2], [1, undefined])).toEqual([1, null]);
  });
  it("keys named like what every object inherits are ordinary keys", () => {
    expect(
      through({ a: 1 }, { a: 1, constructor: { x: 1 }, toString: 2 }, false),
    ).toEqual({ s: { constructor: { x: 1 }, toString: 2 } });
    expect(
      through(
        { constructor: { x: 1 }, valueOf: 1 },
        { constructor: { x: 2 } },
        false,
      ),
    ).toEqual({ d: { constructor: { s: { x: 2 } } }, x: ["valueOf"] });
    expect(through([1], [1, "constructor"])).toEqual([1, "constructor"]);
  });
  it("a key called __proto__ is never sent and changes nothing it should not", () => {
    const encoder = new SnapshotDeltaEncoder();
    const decoder = new SnapshotDeltaDecoder();
    const evil = (n: number, x: number) =>
      JSON.parse(
        `{"code":"X","n":${n},"v":{"x":${x},"__proto__":{"polluted":${x}}}}`,
      ) as WireSnapshot;
    encoder.encode(evil(1, 1));
    decoder.full(evil(1, 1));
    const d = encoder.encode(evil(2, 2))!;
    expect(JSON.stringify(d)).not.toContain("__proto__");
    const got = decoder.delta(sent({ code: "X", n: 2, d }));
    expect(got).toStrictEqual({ code: "X", n: 2, v: { x: 2 } });
    // A delta naming it (no server of ours sends one) is not applied as a
    // prototype either.
    const hostile = JSON.parse(
      '{"code":"X","n":3,"d":{"s":{"n":3,"__proto__":{"polluted":3}}}}',
    );
    const after = decoder.delta(hostile)!;
    expect(Object.getPrototypeOf(after)).toBe(Object.prototype);
    expect(({} as { polluted?: number }).polluted).toBeUndefined();
    expect((after as { polluted?: number }).polluted).toBeUndefined();
  });
  it("handles a value changing kind", () => {
    through(
      { a: [1], b: { x: 1 }, c: 1, d: null },
      { a: { x: 1 }, b: [1], c: { y: 2 }, d: [3] },
    );
    through({ a: { x: 1 } }, { a: null });
    through([{ id: 1 }], [1, 2]);
    through([1, 2], [{ id: 1 }]);
  });
  it("never lets the game's copy reach the decoder's own", () => {
    const decoder = new SnapshotDeltaDecoder();
    const encoder = new SnapshotDeltaEncoder();
    const one = {
      code: "X",
      n: 1,
      players: [{ id: "a", stats: { hits: 1 }, x: 0 }],
    };
    const two = {
      code: "X",
      n: 2,
      players: [{ id: "a", stats: { hits: 1 }, x: 1 }],
    };
    const three = {
      code: "X",
      n: 3,
      players: [{ id: "a", stats: { hits: 1 }, x: 2 }],
    };
    encoder.encode(one as never);
    decoder.full(sent(one) as never);
    const got = decoder.delta(
      sent({ code: "X", n: 2, d: encoder.encode(two as never)! }),
    )!;
    // The game changes what it was handed (prediction does).
    (got.players[0] as unknown as { stats: { hits: number } }).stats.hits = 99;
    got.players.length = 0;
    expect(
      decoder.delta(
        sent({ code: "X", n: 3, d: encoder.encode(three as never)! }),
      ),
    ).toStrictEqual(three);
  });
  it("cloneData copies deeply", () => {
    const v = { a: [1, { b: [2] }], c: null, d: "x" };
    const c = cloneData(v);
    expect(c).toStrictEqual(v);
    expect(c.a[1]).not.toBe(v.a[1]);
  });
});

describe("a delta that does not follow is refused, never half applied", () => {
  const snap = (n: number, x: number, code = "ROOM01") =>
    ({ code, n, x, list: [{ id: 1, x }] }) as unknown as WireSnapshot;
  const pair = () => {
    const encoder = new SnapshotDeltaEncoder();
    const decoder = new SnapshotDeltaDecoder();
    encoder.encode(snap(1, 0));
    decoder.full(sent(snap(1, 0)));
    return { encoder, decoder };
  };
  const message = (
    encoder: SnapshotDeltaEncoder,
    n: number,
    x: number,
    code?: string,
  ) =>
    sent({ code: code ?? "ROOM01", n, d: encoder.encode(snap(n, x, code))! });

  it("a missed delta: the next is refused, and so is every one until a whole snapshot", () => {
    const { encoder, decoder } = pair();
    message(encoder, 2, 1); // lost
    expect(decoder.delta(message(encoder, 3, 2))).toBeUndefined();
    expect(decoder.ready).toBe(false);
    expect(decoder.delta(message(encoder, 4, 3))).toBeUndefined();
    decoder.full(sent(snap(4, 3)));
    expect(decoder.delta(message(encoder, 5, 4))).toStrictEqual(snap(5, 4));
  });
  it("the same delta twice", () => {
    const { encoder, decoder } = pair();
    const m = message(encoder, 2, 1);
    expect(decoder.delta(m)).toStrictEqual(snap(2, 1));
    expect(decoder.delta(m)).toBeUndefined();
  });
  it("another room's delta", () => {
    const { decoder } = pair();
    const other = new SnapshotDeltaEncoder();
    other.encode(snap(1, 0, "ROOM02"));
    expect(decoder.delta(message(other, 2, 1, "ROOM02"))).toBeUndefined();
    // It is not shown, and what we hold of our own room still stands.
    expect(decoder.ready).toBe(true);
    const { encoder } = pair();
    expect(decoder.delta(message(encoder, 2, 5))).toStrictEqual(snap(2, 5));
  });
  it("before any whole snapshot, and after one without a number", () => {
    const encoder = new SnapshotDeltaEncoder();
    encoder.encode(snap(1, 0));
    const decoder = new SnapshotDeltaDecoder();
    expect(decoder.delta(message(encoder, 2, 1))).toBeUndefined();
    // An older server's snapshot (no `n`): nothing is kept.
    const { n: _n, ...old } = snap(2, 1);
    decoder.full(old as WireSnapshot);
    expect(decoder.ready).toBe(false);
    expect(decoder.delta(message(encoder, 3, 2))).toBeUndefined();
  });
  it.each<[string, ObjectDelta | unknown]>([
    [
      "a member that is not there",
      { d: { list: { u: [[3, { s: { x: 1 } }]] } }, s: { n: 2 } },
    ],
    ["an unknown id", { d: { list: { o: [1, 7] } }, s: { n: 2 } }],
    [
      "members left over",
      { d: { list: { o: [1], a: [{ id: 9 }] } }, s: { n: 2 } },
    ],
    ["a patch for a number", { d: { x: { s: { y: 1 } } }, s: { n: 2 } }],
    [
      "a patch for a missing key",
      { d: { nope: { s: { y: 1 } } }, s: { n: 2 } },
    ],
    ["a number that disagrees with the message", { s: { n: 5 } }],
    ["no delta at all", null],
    ["a list as the delta", [1]],
  ])("garbage: %s", (_name, d) => {
    const { decoder } = pair();
    expect(
      decoder.delta({ code: "ROOM01", n: 2, d: d as ObjectDelta }),
    ).toBeUndefined();
    expect(decoder.ready).toBe(false);
  });
  it("the encoder starts over after reset", () => {
    const { encoder } = pair();
    encoder.reset();
    expect(encoder.encode(snap(2, 1))).toBeUndefined();
    expect(sent(encoder.encode(snap(3, 1)))).toEqual({ s: { n: 3 } });
  });
});
