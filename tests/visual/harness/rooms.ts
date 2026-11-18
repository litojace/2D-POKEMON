// Builds real room snapshots with the server's own code.
import { Arena } from "../../../apps/server/src/simulation";
export { Arena };
export {
  CHARACTERS,
  maxHealth,
  packSnapshot,
  blankInput,
  MetaTracker,
} from "../../../packages/shared/src/index";
export { createRaidArena } from "../../../apps/server/src/raid-bosses";
import { createSpireArena } from "../../../apps/server/src/spire";
import {
  spireRewardsOf,
  spireZoneOf,
  spireZoneStart,
  spireZoneTop,
} from "../../../packages/shared/src/spire";
export { dressUp } from "../../../scripts/perf/workloads";
export { resultXp } from "../../../apps/client/src/adventure-ui";
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import {
  CHARACTERS,
  packSnapshot,
  picksHidden,
  veilPlayers,
  type ArenaId,
  type CharacterId,
  type RaidBossId,
} from "../../../packages/shared/src/index";

const w = window as unknown as Record<string, any>;
export interface RoomOptions {
  mode?: "duel" | "teams" | "ffa";
  seats?: number;
  phase?: "lobby" | "playing" | "briefing";
  arena?: ArenaId;
  boss?: RaidBossId;
  broken?: number[];
  pos?: [number, number, number, number];
  /** Practice: the player's fighter. */
  character?: CharacterId;
  /** Practice: the player's basic shots, frozen in flight at these points. */
  shots?: [number, number][];
  /** Spire: the floor, and how far into it (a real climb, run on the page). */
  floor?: number;
  stage?: "briefing" | "playing" | "intermission" | "finished";
  /** Spire: how high the party may climb (default: below the zone's boss floor). */
  ceiling?: number;
}
/**
 * A real Spire climb (the server's SpireArena on the page): the floor's
 * Echoes on the court after a few seconds, the blessing cards after it is
 * cleared, or the results after a defeat. window.__spireStep(seconds) runs
 * it on and pushes the new snapshot.
 */
function spire(o: RoomOptions) {
  let seed = 4242;
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = ((b: Uint32Array) => {
    for (let i = 0; i < b.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      b[i] = seed;
    }
    return b;
  }) as typeof crypto.getRandomValues;
  const floor = o.floor ?? 1;
  // The room climbs the floor's zone (zone 2 from floor 11, 3 from 21, 4 from 31, 5 from 41, 6 from 51, 7 from 61).
  const zone = spireZoneOf(floor);
  const a: any = createSpireArena("SPIRE42", zone);
  a.add("me", "tester", "voltkit");
  if ((o.seats ?? 1) > 1) a.add("p2", "Kai", "cindrake");
  if (floor === spireZoneTop(zone)) {
    spireBoss(a, o);
    crypto.getRandomValues = random;
    return a;
  }
  a.configureSpire({
    startFloor: Math.max(
      spireZoneStart(zone),
      Math.min(floor, o.stage === "intermission" ? floor - 1 : floor),
    ),
    ceiling: o.ceiling ?? spireZoneTop(zone) - 1,
  });
  a.start();
  crypto.getRandomValues = random;
  const stage = o.stage ?? "playing";
  if (stage === "briefing") return a;
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  const tick = (s: number) => {
    for (let t = 0; t < s; t += 1 / 30) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = Math.max(p.hp, 60);
      a.tick(1 / 30);
    }
  };
  while (a.phase !== "playing") a.tick(1 / 30);
  if (stage === "playing") {
    // The court a few seconds in: Echoes out, fighting.
    tick(3.2);
    const [me, kai] = a.heroes();
    Object.assign(me, { x: 660, y: 250 });
    if (kai) Object.assign(kai, { x: 640, y: 660 });
    tick(0.4);
  } else if (stage === "intermission") {
    for (let i = 0; i < 12 && a.phase === "playing"; i++) {
      tick(1);
      for (const p of a.players) if (p.echo) p.hp = 0;
      tick(1.8);
    }
    while (a.phase === "playing") tick(0.5);
    a.raid.spire.blessings.me = { keen: 1 };
  } else if (stage === "finished") {
    tick(2);
    a.raid.spire.best = Math.max(0, floor - 1);
    a.raid.spire.saves =
      floor > 1
        ? [
            {
              floor: floor - 1,
              status: "saved",
              claims: [{ playerId: "me", coins: 25, titles: [] }],
            },
          ]
        : [];
    a.raid.spire.blessings.me = { keen: 2, fleet: 1, leech: 1 };
    // Down for good (no self-revive this time).
    a.selfUsed = true;
    for (let i = 0; i < 600 && a.phase !== "finished"; i++) {
      for (const p of a.heroes())
        if (p.hp > 0)
          a.damage(
            p,
            999,
            a.players.find((e: any) => e.echo && e.hp > 0)?.id ?? "",
          );
      a.tick(1 / 30);
    }
  }
  w.__spireArena = a;
  w.__spireStep = (s: number) => {
    tick(s);
    w.__snap = packSnapshot(a.snapshot());
    w.__push();
  };
  return a;
}
/**
 * A boss floor (10: the Ascendant Cragmuff; 20: the Ascendant Tidelotl;
 * 30: the Ascendant Inkpurr, in the Lantern Yard; 40: the Ascendant
 * Snoozaku, on the Cloud Deck; 50: the Ascendant Prismell, in the Sun
 * Atrium; 60: the Ascendant Lumiwick, on the Sky Terrace; 70: the
 * Ascendant Storm Twins, in the Conductor Ring, the summit): a
 * real climb from the floor below (cleared), on to the Ascendant in the
 * same room: its briefing, the fight a few seconds in, or the results once
 * it falls (the zone conquered).
 */
function spireBoss(a: any, o: RoomOptions) {
  const top = spireZoneTop(a.zone);
  a.configureSpire({ startFloor: top - 1, ceiling: top });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  const tick = (s: number) => {
    for (let t = 0; t < s; t += 1 / 30) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = Math.max(p.hp, 60);
      a.tick(1 / 30);
    }
  };
  while (a.phase !== "playing") a.tick(1 / 30);
  for (let i = 0; i < 20 && a.raid.spire.floor === top - 1; i++) {
    tick(1);
    for (const p of a.players) if (p.echo) p.hp = 0;
    tick(1.8);
  }
  a.raid.spire.blessings.me = { keen: 1, fleet: 1 };
  if (a.raid.spire.saves[0]) {
    a.raid.spire.saves[0].status = "saved";
    a.raid.spire.saves[0].claims = [{ playerId: "me", coins: 35, titles: [] }];
  }
  const stage = o.stage ?? "playing";
  w.__spireArena = a;
  w.__spireStep = (s: number) => {
    tick(s);
    w.__snap = packSnapshot(a.snapshot());
    w.__push();
  };
  if (stage === "briefing") return a;
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  for (const p of a.heroes()) {
    const offer = a.raid.spire.offers[p.id];
    if (offer?.[0]) a.pickRite(p.id, offer[0]);
  }
  while (a.phase !== "playing") a.tick(1 / 30);
  const [me, kai] = a.heroes();
  Object.assign(me, { x: 760, y: 300 });
  if (kai) Object.assign(kai, { x: 700, y: 620 });
  tick(o.stage === "finished" ? 2 : 6);
  if (stage === "finished") {
    // (Tidelotl may be under water: it surfaces to fall.)
    a.raid.submerged = false;
    // (Every body of it: the Storm Twins are two.)
    for (const p of a.players) if (p.raidBoss) p.hp = 0;
    tick(3);
    a.raid.spire.saves.at(-1).status = "saved";
    // What the boss floor pays on a first clear (the shared reward table).
    const paid = spireRewardsOf(top);
    a.raid.spire.saves.at(-1).claims = [
      {
        playerId: "me",
        coins: paid
          .filter((r) => r.kind === "coins")
          .reduce((n, r) => n + r.amount, 0),
        titles: paid.filter((r) => r.kind === "title").map((r) => r.item),
      },
    ];
  }
  return a;
}
function room(kind: "practice" | "raid" | "pvp" | "spire", o: RoomOptions) {
  if (kind === "spire") return spire(o);
  if (kind === "raid") {
    const a: any = createRaidArena("RAID42", o.boss ?? "grumblecrag");
    a.add("me", "tester", "voltkit");
    a.add("p2", "Kai", "cindrake");
    a.configure(1, false);
    a.start();
    a.phase = "playing";
    for (const i of o.broken ?? [])
      if (a.raid.pillars[i]) a.raid.pillars[i].broken = true;
    if (o.pos) {
      const h = a.heroes();
      [h[0].x, h[0].y, h[1].x, h[1].y] = o.pos;
    }
    return a;
  }
  if (kind === "pvp") {
    const a = new Arena("PVP123", o.mode ?? "ffa");
    a.add("me", "tester", "voltkit");
    a.add("p2", "Kai", "cindrake");
    if (o.mode !== "duel") {
      a.add("p3", "Rae", "tidefin");
      if (o.seats !== 3) a.add("p4", "Mina", "lumoth");
    }
    a.start();
    a.phase = o.phase ?? "lobby";
    // The others have picked; you have just come in (Lock in is yours).
    for (const p of a.players) p.locked = p.id !== "me";
    if (o.arena) a.arenaId = o.arena;
    if (o.pos)
      [a.players[0].x, a.players[0].y, a.players[1].x, a.players[1].y] = o.pos;
    return a;
  }
  const a: any = new Arena("ABC123");
  a.practice = { unlimitedCooldowns: false, targetAttacks: false };
  a.add("me", "tester", o.character ?? "voltkit");
  a.add("target-ABC123", "Training target");
  a.resetPractice();
  if (o.arena) a.arenaId = o.arena;
  if (o.pos)
    [a.players[0].x, a.players[0].y, a.players[1].x, a.players[1].y] = o.pos;
  const me = a.players[0],
    basic = CHARACTERS[me.character as CharacterId].basic;
  a.projectiles = (o.shots ?? []).map(([x, y], i) => ({
    id: 900 + i,
    owner: me.id,
    x,
    y,
    // Barely moving, so the shot stays where the test put it.
    vx: 1,
    vy: 0,
    remaining: 400,
    ability: basic,
    color: CHARACTERS[me.character as CharacterId].color,
  }));
  return a;
}
/** Prepare a room; the next create/practice request joins it. */
w.__room = (
  kind: "practice" | "raid" | "pvp" | "spire",
  o: RoomOptions = {},
) => {
  const a = room(kind, o);
  w.__reply = (ev: string, data: unknown) => {
    if (ev === "select") {
      const me = w.__snap.players.find((p: any) => p.id === "me");
      me.character = data;
      me.ready = false;
      me.locked = true;
      delete me.browse;
      queueMicrotask(() => w.__push());
      return { ok: true };
    }
    if (ev === "browse") {
      const me = w.__snap.players.find((p: any) => p.id === "me");
      if (w.__snap.mode === "raid" || !w.__snap.mode) me.character = data;
      else me.browse = data;
      queueMicrotask(() => w.__push());
      return { ok: true };
    }
    if (ev === "ready") {
      const me = w.__snap.players.find((p: any) => p.id === "me");
      me.ready = !me.ready;
      if (me.ready && !me.locked) {
        me.character = me.browse ?? me.character;
        me.locked = true;
        delete me.browse;
      }
      queueMicrotask(() => w.__push());
      return { ok: true };
    }
    return ev === "create" || ev === "join" || ev === "practice"
      ? { ok: true, id: "me", token: "t", code: a.code }
      : { ok: true };
  };
  w.__snap = packSnapshot(a.snapshot());
};
/**
 * Like the server, a PvP lobby never shows another side's pick
 * (docs/hidden-picks.md): the snapshot is sent veiled for "me".
 */
w.__push = () => {
  const snap = w.__snap;
  if (!snap || !picksHidden(snap)) return w.__sock.fire("state", snap);
  const team = (id: string) =>
    snap.players.find((p: any) => p.id === id)?.team ?? -1;
  w.__sock.fire("state", {
    ...snap,
    players: veilPlayers(snap.players, "me", (x, y) => team(x) === team(y)),
  });
};
