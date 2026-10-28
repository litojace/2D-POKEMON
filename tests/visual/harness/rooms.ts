// Builds real room snapshots with the server's own code.
import { Arena } from "../../../apps/server/src/simulation";
export { resultXp } from "../../../apps/client/src/adventure-ui";
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import {
  CHARACTERS,
  packSnapshot,
  type ArenaId,
  type CharacterId,
  type RaidBossId,
} from "../../../packages/shared/src/index";

const w = window as unknown as Record<string, any>;
export interface RoomOptions {
  mode?: "duel" | "teams" | "ffa";
  seats?: number;
  phase?: "lobby" | "playing";
  arena?: ArenaId;
  boss?: RaidBossId;
  broken?: number[];
  pos?: [number, number, number, number];
  /** Practice: the player's fighter. */
  character?: CharacterId;
  /** Practice: the player's basic shots, frozen in flight at these points. */
  shots?: [number, number][];
}
function room(kind: "practice" | "raid" | "pvp", o: RoomOptions) {
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
w.__room = (kind: "practice" | "raid" | "pvp", o: RoomOptions = {}) => {
  const a = room(kind, o);
  const inner = w.__reply;
  w.__reply = (ev: string, data: unknown) => {
    if (ev === "select") {
      w.__snap.players.find((p: any) => p.id === "me").character = data;
      w.__snap.players.find((p: any) => p.id === "me").ready = false;
      queueMicrotask(() => w.__push());
      return { ok: true };
    }
    if (ev === "ready") {
      const me = w.__snap.players.find((p: any) => p.id === "me");
      me.ready = !me.ready;
      queueMicrotask(() => w.__push());
      return { ok: true };
    }
    return ev === "create" || ev === "join" || ev === "practice"
      ? { ok: true, id: "me", token: "t", code: a.code }
      : ev.startsWith("town-")
        ? inner?.(ev, data)
        : { ok: true };
  };
  w.__snap = packSnapshot(a.snapshot());
};
w.__push = () => w.__sock.fire("state", w.__snap);
