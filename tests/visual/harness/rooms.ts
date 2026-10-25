// Builds real room snapshots with the server's own code.
import { Arena } from "../../../apps/server/src/simulation";
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import { packSnapshot, type ArenaId, type RaidBossId } from "../../../packages/shared/src/index";

const w = window as unknown as Record<string, any>;
export interface RoomOptions {
  arena?: ArenaId;
  boss?: RaidBossId;
  broken?: number[];
  pos?: [number, number, number, number];
}
function room(kind: "practice" | "raid", o: RoomOptions) {
  if (kind === "raid") {
    const a: any = createRaidArena("RAID42", o.boss ?? "grumblecrag");
    a.add("me", "tester", "voltkit");
    a.add("p2", "Kai", "cindrake");
    a.configure(1, false);
    a.start();
    a.phase = "playing";
    for (const i of o.broken ?? []) if (a.raid.pillars[i]) a.raid.pillars[i].broken = true;
    if (o.pos) {
      const h = a.heroes();
      [h[0].x, h[0].y, h[1].x, h[1].y] = o.pos;
    }
    return a;
  }
  const a: any = new Arena("ABC123");
  a.practice = { unlimitedCooldowns: false, targetAttacks: false };
  a.add("me", "tester", "voltkit");
  a.add("target-ABC123", "Training target");
  a.resetPractice();
  if (o.arena) a.arenaId = o.arena;
  if (o.pos) [a.players[0].x, a.players[0].y, a.players[1].x, a.players[1].y] = o.pos;
  return a;
}
/** Prepare a room; the next create/practice request joins it. */
w.__room = (kind: "practice" | "raid", o: RoomOptions = {}) => {
  const a = room(kind, o);
  const inner = w.__reply;
  w.__reply = (ev: string, data: unknown) =>
    ev === "create" || ev === "join" || ev === "practice"
      ? { ok: true, id: "me", token: "t", code: a.code }
      : ev.startsWith("town-")
        ? inner?.(ev, data)
        : { ok: true };
  w.__snap = packSnapshot(a.snapshot());
};
w.__push = () => w.__sock.fire("state", w.__snap);
