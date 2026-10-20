import { afterEach, it, expect, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../../apps/server/src/server";
import { fakeAccounts } from "../helpers/accounts";
import { RaidArena } from "../../apps/server/src/raid";
import { RAID_FUNCTIONS_MIGRATION } from "../../apps/server/src/accounts";
import { TidewyrmArena } from "../../apps/server/src/raid-tidewyrm";
import { SomnaraArena } from "../../apps/server/src/raid-somnara";
import { GloomshadeArena } from "../../apps/server/src/raid-gloomshade";
import { blankInput, type Reply } from "@arena/shared";
import { raidDay } from "../../packages/shared/src/raid";
let server: ReturnType<typeof createArenaServer> | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
});
const emit = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((resolve, reject) =>
    s
      .timeout(2000)
      .emit(event, data, (err: Error | null, r: Reply) =>
        err ? reject(err) : resolve(r),
      ),
  );
const setup = async () => {
  const accounts = fakeAccounts(),
    recordRaid = vi.fn(async () => {});
  accounts.provider.recordRaid = recordRaid;
  accounts.provider.rpc = async (_token, name) =>
    name === "arena_raid_progress"
      ? { highestPeril: 0, clears: 0, cosmetics: [], weekly: [] }
      : null;
  server = createArenaServer({ accounts: accounts.provider, autoTick: false });
  await new Promise<void>((r) => server!.http.listen(0, "127.0.0.1", r));
  const addr = server.http.address() as { port: number };
  const connect = async () => {
    const user = accounts.add(false);
    const socket = io(`http://127.0.0.1:${addr.port}`, {
      auth: { accessToken: user.token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return socket;
  };
  return { connect, recordRaid, accounts };
};
it("starts a regular-player solo raid, enforces Peril unlocks, and records a verified victory once outside Elo", async () => {
  const { connect, recordRaid } = await setup(),
    host = await connect();
  // Only bosses that are built can be raided.
  expect(
    (await emit(host, "create", { name: "Raider", mode: "raid", boss: "storm-twins" })).ok,
  ).toBe(false);
  const created = await emit(host, "create", { name: "Raider", mode: "raid", boss: "grumblecrag" });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(a).toBeInstanceOf(RaidArena);
  expect(a.raid.boss).toBe("grumblecrag");
  expect(
    (await emit(host, "raid-config", { peril: 3, daily: false })).ok,
  ).toBe(false);
  expect(
    (await emit(host, "raid-config", { peril: 1, daily: false })).ok,
  ).toBe(true);
  await emit(host, "ready");
  expect(a.phase).toBe("briefing");
  await emit(host, "instructions-ready");
  expect(a.phase).toBe("intermission");
  await emit(host, "rite", { id: a.raid.offers[created.id!][0] });
  for (let i = 0; i < 125; i++) server!.step();
  expect(a.phase).toBe("playing");
  for (let stage = 1; stage <= 3; stage++) {
    a.damage(a.boss()!, 100000, created.id!);
    server!.step();
    if (stage < 3) {
      await emit(host, "rite", { id: a.raid.offers[created.id!][0] });
      for (let i = 0; i < 125; i++) server!.step();
    }
  }
  server!.step();
  await new Promise((r) => setTimeout(r, 20));
  expect(a.raid.result).toBe("victory");
  expect(recordRaid).toHaveBeenCalledTimes(1);
  expect(recordRaid.mock.calls[0][0]).toMatchObject({
    boss: "grumblecrag",
    partySize: 1,
    peril: 1,
    daily: false,
    weekly: false,
    feat: false,
  });
  // The day a run counts for is a real calendar date.
  expect(recordRaid.mock.calls[0][0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(a.matchId).toBeNull();
  expect(a.raid.rewardStatus).toBe("saved");
  await emit(host, "rematch");
  expect(a.phase).toBe("intermission");
  expect(a.raid.result).toBeNull();
  expect(a.players).toHaveLength(2);
});
it("lets the host leave a daily raid after returning to the lobby without regular Peril 2 unlocked", async () => {
  const { connect, accounts } = await setup(), host = await connect();
  accounts.provider.rpc = async () => ({ highestPeril: 0, clears: 1, cosmetics: [], weekly: [] });
  const created = await emit(host, "create", { name: "Raider", mode: "raid", boss: raidDay().boss });
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect((await emit(host, "raid-config", { peril: 2, daily: true })).ok).toBe(true);
  await emit(host, "ready");
  expect(a.phase).toBe("briefing");
  a.forfeit(created.id!);
  expect(a.phase).toBe("finished");
  expect((await emit(host, "lobby")).ok).toBe(true);
  expect(a.raid.daily).toBe(true);
  expect(a.raid.peril).toBe(2);
  // Daily access does not unlock regular Peril 2; the client must request Peril 1.
  expect((await emit(host, "raid-config", { peril: 2, daily: false })).ok).toBe(false);
  expect((await emit(host, "raid-config", { peril: 1, daily: false })).ok).toBe(true);
  expect(a.raid.daily).toBe(false);
  expect(a.raid.peril).toBe(1);
  expect(a.heroes()).toHaveLength(1);
  expect(a.heroes()[0].ready).toBe(false);
});

it("synchronizes four teammates against the same boss and preserves disconnect recovery", async () => {
  const { connect } = await setup();
  const host = await connect();
  const created = await emit(host, "create", { name: "Host", mode: "raid" });
  const peers = [host];
  for (let i = 0; i < 3; i++) {
    const p = await connect();
    expect(
      (await emit(p, "join", { name: "Friend", code: created.code })).ok,
    ).toBe(true);
    peers.push(p);
  }
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(
    (await emit(peers[1], "raid-config", { peril: 1, daily: true })).ok,
  ).toBe(false);
  for (const s of peers) await emit(s, "ready");
  expect(a.heroes()).toHaveLength(4);
  expect(a.players).toHaveLength(5);
  expect(a.enemiesOf(a.heroes()[0])).toEqual([a.boss()]);
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  a.phase = "playing";
  const target = a.heroes()[1],
    before = target.hp;
  a.damage(target, 50, a.heroes()[0].id);
  expect(target.hp).toBe(before);
  const dropped = a.heroes()[3].id;
  peers[3].disconnect();
  await new Promise((r) => setTimeout(r, 20));
  // An AI stand-in plays the dropped raider instead of pausing everyone.
  expect(a.phase).toBe("playing");
  expect(a.raid.standIns).toContain(dropped);
  expect(a.bots.has(dropped)).toBe(true);
  expect((await emit(host, "leave")).ok).toBe(true);
  expect(a.players[0].out).toBe(true);
});

it("broadcasts an equipped cosmetic and its removal to an existing room immediately", async () => {
  const { connect, accounts } = await setup();
  let equipped: string | null = null;
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_equip_raid_cosmetic") {
      equipped = (args as { p_cosmetic: string | null }).p_cosmetic;
      return null;
    }
    return {
      highestPeril: 3,
      clears: 5,
      cosmetics: ["cragbound", "mountain-aura"],
      weekly: [],
      equipped,
    };
  };
  const host = await connect();
  const created = await emit(host, "create", { name: "Raider", mode: "raid" });
  const address = server!.http.address() as { port: number };
  for (const cosmetic of ["cragbound", null]) {
    const update = new Promise<void>((resolve) => {
      const listener = (state: any) => {
        if (
          (state.players.find((p: any) => p.id === created.id)?.raidLook
            ?.skin ?? null) === cosmetic
        ) {
          host.off("state", listener);
          resolve();
        }
      };
      host.on("state", listener);
    });
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/raids/cosmetic`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(host.auth as { accessToken: string }).accessToken}`,
        },
        body: JSON.stringify({ cosmetic }),
      },
    );
    expect(response.ok).toBe(true);
    await update;
    expect(
      server!.rooms.get(created.code!)!.players.find((p) => p.id === created.id)
        ?.raidLook?.skin ?? null,
    ).toBe(cosmetic);
  }
});

it("waits for both teammates before quick retry and preserves the party's picks", async () => {
  const { connect } = await setup();
  const host = await connect(),
    friend = await connect();
  const created = await emit(host, "create", { name: "Host", mode: "raid" });
  await emit(friend, "join", { name: "Friend", code: created.code });
  await emit(host, "ready");
  await emit(friend, "ready");
  const a = server!.rooms.get(created.code!) as RaidArena;
  const picks = a.heroes().map((p) => p.character);
  a.forfeit(a.heroes()[0].id);
  a.heroes().forEach((p) => (p.ready = false));
  expect((await emit(host, "rematch")).ok).toBe(true);
  expect(a.phase).toBe("finished");
  expect(a.heroes().filter((p) => p.ready)).toHaveLength(1);
  expect((await emit(friend, "rematch")).ok).toBe(true);
  expect(a.phase).toBe("intermission");
  expect(a.heroes().map((p) => p.character)).toEqual(picks);
  expect(Object.keys(a.raid.offers)).toHaveLength(2);
});

it("only reports an equipped slot after the database really kept it", async () => {
  const { connect, accounts } = await setup();
  let stored: Record<string, string | null> = {};
  let upToDate = true;
  accounts.provider.rpc = async (_token, name, args) => {
    if (name === "arena_equip_raid_slot") {
      const a = args as { p_slot: string; p_item: string | null };
      stored = { ...stored, [a.p_slot]: a.p_item };
      return null;
    }
    // An outdated progress function (e.g. 007 run again after 008) has no loadout.
    return {
      highestPeril: 3,
      clears: 5,
      cosmetics: ["cragbound", "mountain-aura"],
      weekly: [],
      ...(upToDate ? { loadout: stored } : { equipped: null }),
    };
  };
  const host = await connect();
  await emit(host, "create", { name: "Raider", mode: "raid" });
  const address = server!.http.address() as { port: number };
  const equip = (body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/raids/equip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(host.auth as { accessToken: string }).accessToken}`,
      },
      body: JSON.stringify(body),
    });
  const ok = await equip({ slot: "aura", item: "mountain-aura" });
  expect(ok.ok).toBe(true);
  expect((await ok.json()).progress.loadout.aura).toBe("mountain-aura");
  expect((await equip({ slot: "aura", item: "cragbound" })).status).toBe(400);
  upToDate = false;
  const stale = await equip({ slot: "skin", item: "cragbound" });
  expect(stale.status).toBe(503);
  expect((await stale.json()).error).toContain(RAID_FUNCTIONS_MIGRATION);
});
it("opens Tidewyrm in its own arena and checks practice attacks belong to the boss", async () => {
  const { connect } = await setup(),
    host = await connect();
  const created = await emit(host, "create", { name: "Raider", mode: "raid", boss: "tidewyrm" });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(a).toBeInstanceOf(TidewyrmArena);
  expect(a.raid.boss).toBe("tidewyrm");
  // Grumblecrag's charge can't be practised here; Tidewyrm's dive can.
  expect((await emit(host, "raid-drill", { kind: "charge" })).ok).toBe(false);
  expect((await emit(host, "raid-drill", { kind: "dive" })).ok).toBe(true);
  expect(a.raid.drill).toBe("dive");
  expect(a.arenaId).toBe("lagoon");
});
it("opens Gloomshade in the Lantern Yard and practises its own attacks", async () => {
  const { connect } = await setup(),
    host = await connect();
  const created = await emit(host, "create", { name: "Raider", mode: "raid", boss: "gloomshade" });
  expect(created.ok).toBe(true);
  const a = server!.rooms.get(created.code!) as RaidArena;
  expect(a).toBeInstanceOf(GloomshadeArena);
  expect((await emit(host, "raid-drill", { kind: "dive" })).ok).toBe(false);
  expect((await emit(host, "raid-drill", { kind: "split" })).ok).toBe(true);
  expect(a.raid.drill).toBe("split");
  expect(a.arenaId).toBe("lantern-yard");
});

it("sends Somnara's dream only to its authenticated Dreamer, with Lucid/reveal exceptions and no spectator leak", async () => {
  const { connect, accounts } = await setup();
  accounts.provider.rpc = async () => ({ clears: 1, highestPeril: 3, cosmetics: [], weekly: [], bosses: { grumblecrag: { clears: 1, highestPeril: 3 } } });
  const host = await connect(), peer = await connect(), watcher = await connect();
  const created = await emit(host, "create", { name: "Dream host", mode: "raid", boss: "somnara" });
  expect(created.ok).toBe(true);
  const joined = await emit(peer, "join", { name: "Dream friend", code: created.code }); expect(joined.ok).toBe(true);
  expect((await emit(watcher, "watch", { code: created.code })).ok).toBe(true);
  const a = server!.rooms.get(created.code!) as SomnaraArena;
  expect(a).toBeInstanceOf(SomnaraArena); a.start(); a.phase = "playing";
  (a as any).started = true; (a as any).nextAttack = Infinity;
  (a as any).startAttack("dream-sequence", a.heroes()[0]);
  const d = a.raid.dream!;
  const socketById = new Map([[created.id!, host], [joined.id!, peer]]);
  const dreamer = socketById.get(d.dreamerId)!, other = dreamer === host ? peer : host;
  const otherId = dreamer === host ? joined.id! : created.id!;
  const state = (socket: Socket, predicate: (s: any) => boolean) => new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off("state", onState); reject(new Error("No matching Somnara snapshot")); }, 2000);
    const onState = (snapshot: any) => { if (!predicate(snapshot)) return; clearTimeout(timeout); socket.off("state", onState); resolve(snapshot); };
    socket.on("state", onState);
  });
  let pending = [dreamer, other, watcher].map(s => state(s, v => v.raid?.dream?.id === d.id));
  for (let i = 0; i < 6; i++) server!.step();
  let [own, ally, publicView] = await Promise.all(pending);
  expect(own.raidDream.full).toBe(true); expect(own.raidDream.runes).toHaveLength(d.length);
  expect(ally.raidDream).toBeUndefined(); expect(publicView.raidDream).toBeUndefined();
  expect(JSON.stringify(ally)).not.toContain('"runes"'); expect(JSON.stringify(publicView)).not.toContain('"runes"');
  expect((await emit(other, "raid-rune", { rune: "circle" })).ok).toBe(false);
  expect((await emit(other, "raid-rune", { rune: "circle", playerId: d.dreamerId })).ok).toBe(false);
  expect((await emit(dreamer, "raid-rune", { rune: "circle" })).ok).toBe(true);
  a.raid.rites[otherId] = ["lucid"];
  pending = [state(other, v => v.raidDream?.id === d.id && !v.raidDream.full)];
  for (let i = 0; i < 6; i++) server!.step();
  ally = (await Promise.all(pending))[0]; expect(ally.raidDream.runes).toHaveLength(1);
  a.heroes()[0].character = "mystowl";
  const { CHARACTERS } = await import("@arena/shared");
  a.cast(a.heroes()[0], CHARACTERS.mystowl.skills.find(s => s.id === "thoughtstrike")!);
  pending = [state(other, v => v.raidDream?.full), state(watcher, v => v.raid?.dream?.id === d.id)];
  for (let i = 0; i < 6; i++) server!.step();
  [ally, publicView] = await Promise.all(pending);
  expect(ally.raidDream.runes).toHaveLength(d.length); expect(publicView.raidDream).toBeUndefined();
  a.heroes()[0].character = "voltkit";
  a.raid.rites[otherId] = [];
  (a as any).beginDream(); const next = a.raid.dream!;
  const newOther = socketById.get(a.heroes().find(p => p.id !== next.dreamerId)!.id)!;
  pending = [state(newOther, v => v.raid?.dream?.id === next.id), state(watcher, v => v.raid?.dream?.id === next.id)];
  for (let i = 0; i < 6; i++) server!.step();
  [ally, publicView] = await Promise.all(pending);
  expect(ally.raidDream).toBeUndefined(); expect(publicView.raidDream).toBeUndefined();
});

it("opens Prismatail for a co-op party, validates its drills, and broadcasts the relay state", async () => {
  const {connect,accounts}=await setup();accounts.provider.rpc=async()=>({clears:1,highestPeril:3,cosmetics:[],weekly:[],bosses:{grumblecrag:{clears:1,highestPeril:3}}});
  const host=await connect(),peer=await connect();
  const created=await emit(host,'create',{name:'Light host',mode:'raid',boss:'prismatail'});expect(created.ok).toBe(true);
  const joined=await emit(peer,'join',{name:'Light friend',code:created.code});expect(joined.ok).toBe(true);
  const a=server!.rooms.get(created.code!) as RaidArena;expect(a.constructor.name).toBe('PrismatailArena');
  expect((await emit(peer,'raid-drill',{kind:'light-relay'})).ok).toBe(false);
  expect((await emit(host,'raid-drill',{kind:'dream-sequence'})).ok).toBe(false);
  expect((await emit(host,'raid-drill',{kind:'light-relay'})).ok).toBe(true);
  a.phase='playing';a.raid.phase=3;a.heroes().forEach((p,i)=>{p.x=470;p.y=i?600:300});(a as any).started=true;(a as any).nextAttack=Infinity;
  const pending=new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No Prismatail relay snapshot')),2000);peer.on('state',s=>{if(s.raid?.lightLinks?.length){clearTimeout(timer);resolve(s);}})});
  for(let i=0;i<70;i++)server!.step();const snapshot=await pending;
  expect(snapshot.arena).toBe('sun-atrium');expect(snapshot.raid.mirrors).toHaveLength(4);expect(snapshot.raid.lightLinks.some((s:any)=>s.beam===1)).toBe(true);expect(snapshot.raidDream).toBeUndefined();
  expect((await emit(host,'raid-drill',{kind:null})).ok).toBe(true);
});

it("creates Emberwing in the Sky Terrace, restricts practice to the host, and sends airborne brazier state",async()=>{
 const {connect,accounts}=await setup();accounts.provider.rpc=async()=>({clears:1,highestPeril:3,cosmetics:[],weekly:[],bosses:{grumblecrag:{clears:1,highestPeril:3}}});
 const host=await connect(),peer=await connect();const created=await emit(host,'create',{name:'Fire host',mode:'raid',boss:'emberwing'});expect(created.ok).toBe(true);
 expect((await emit(peer,'join',{name:'Fire friend',code:created.code})).ok).toBe(true);
 const a=server!.rooms.get(created.code!)as RaidArena;expect(a.constructor.name).toBe('EmberwingArena');
 expect((await emit(peer,'raid-drill',{kind:'brazier-lighting'})).ok).toBe(false);expect((await emit(host,'raid-drill',{kind:'light-relay'})).ok).toBe(false);
 expect((await emit(host,'raid-drill',{kind:'brazier-lighting'})).ok).toBe(true);a.phase='playing';a.raid.phase=2;(a as any).started=true;(a as any).nextAttack=Infinity;
 const pending=new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No Emberwing snapshot')),2000);peer.on('state',s=>{if(s.raid?.airborne&&s.raid?.braziers?.length===3){clearTimeout(timer);resolve(s);}})});
 for(let i=0;i<10;i++)server!.step();const snapshot=await pending;expect(snapshot.arena).toBe('sky-terrace');expect(snapshot.raid.braziers.every((b:any)=>Number.isFinite(b.progress))).toBe(true);expect(snapshot.raidDream).toBeUndefined();
 expect((await emit(host,'raid-drill',{kind:null})).ok).toBe(true);expect(a.raid.airborne).toBe(false);
});
