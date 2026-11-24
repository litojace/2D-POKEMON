/**
 * The game server for `server-load.ts`, run as a child process so its CPU,
 * memory and event loop are measured apart from the simulated players.
 *
 * Accounts are fake (any `load-<n>` token signs in) but every fighter gets a
 * fully equipped appearance through the same RPC path as production.
 * Controlled over IPC by the driver; never used by the real server.
 */
import { createArenaServer } from "../../apps/server/src/server.js";
import type { AccountProvider } from "../../apps/server/src/accounts.js";
import type { Account } from "../../packages/shared/src/accounts.js";
import { CHARACTERS } from "../../packages/shared/src/index.js";
import { RaidArena } from "../../apps/server/src/raid.js";
import { dressUp } from "./workloads.js";

const users = new Map<string, Account>();
const looks = new Map<string, ReturnType<typeof appearance>>();
function appearance(seat: number) {
  const p = { championLooks: {}, raidLook: {}, raidClears: {} } as never as {
    championLooks: unknown;
    raidLook: unknown;
    raidClears: Record<string, number>;
  };
  dressUp(p as never, seat);
  return p;
}
const provider: AccountProvider = {
  async authenticate(token) {
    if (!token?.startsWith("load-")) return null;
    let user = users.get(token);
    if (!user) {
      const n = Number(token.slice(5)) || 0;
      user = {
        id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        displayName: `Load ${n}`,
        isAdmin: false,
        suspended: false,
        title: "Raid Veteran",
        titleColor: "#fbbf24",
        ownedTitles: [],
      };
      users.set(token, user);
      looks.set(token, appearance(n % 4));
    }
    return user;
  },
  async rpc(token, name) {
    const look = looks.get(token ?? "") ?? appearance(0);
    if (name === "arena_my_looks") return look.championLooks;
    if (name === "arena_raid_progress")
      return {
        loadout: look.raidLook,
        bosses: Object.fromEntries(
          Object.entries(look.raidClears).map(([b, clears]) => [b, { clears }]),
        ),
      };
    throw new Error(`No ${name} in the load test`);
  },
};

const server = createArenaServer({
  accounts: provider,
  diagnostics: true,
  reconnectMs: 5000,
});
let immortal: NodeJS.Timeout | undefined;
server.http.listen(0, "127.0.0.1", () => {
  const address = server.http.address();
  process.send!({
    type: "ready",
    port: typeof address === "object" && address ? address.port : 0,
  });
});
process.on("message", (message: { cmd: string; [key: string]: unknown }) => {
  if (message.cmd === "fight") {
    // Skip lobby/briefing/countdown: every room fights right away.
    for (const a of server.rooms.values()) {
      if (a.phase === "playing") continue;
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 10_000;
    }
    if (message.immortal && !immortal)
      immortal = setInterval(() => {
        for (const a of server.rooms.values())
          for (const p of a.players)
            if (!p.raidBoss && !p.out)
              p.hp = Math.max(p.hp, CHARACTERS[p.character].health * 0.5);
        // Raids: keep bosses alive too so the fight continues.
        for (const a of server.rooms.values())
          if (a instanceof RaidArena)
            for (const p of a.players) if (p.raidBoss) p.hp = Math.max(p.hp, 1);
      }, 250);
    process.send!({ type: "fighting", rooms: server.rooms.size });
  } else if (message.cmd === "mortal") {
    if (immortal) clearInterval(immortal);
    immortal = undefined;
  } else if (message.cmd === "report") {
    if (message.gc && global.gc) global.gc();
    process.send!({
      type: "report",
      report: server.diagnostics.report({
        rooms: server.rooms.size,
        sessions: server.sessions.size,
        sockets: server.io.engine.clientsCount,
        heapAfterGcMB: global.gc
          ? Math.round((process.memoryUsage().heapUsed / 2 ** 20) * 100) / 100
          : -1,
      }),
    });
  } else if (message.cmd === "close")
    void server.close().then(() => process.exit(0));
});
