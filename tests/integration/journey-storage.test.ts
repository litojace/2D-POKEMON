import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  JOURNEY_ITEMS,
  levelThreshold,
  playerLevel,
  seasonTheme,
} from "../../packages/shared/src/journey";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000071",
  other = "00000000-0000-4000-8000-000000000072",
  admin = "00000000-0000-4000-8000-000000000073";
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const journey = async () =>
  (await db.query<{ j: any }>("select public.arena_journey() as j")).rows[0].j;
const today = async () => {
  await db.exec("reset role");
  return (
    await db.query<{ d: string }>("select public.arena_today()::text as d")
  ).rows[0].d;
};
let serial = 0;
const receipt = async (kind = "match", fields: object = {}, pid = player) => ({
  id: "journey-" + ++serial,
  kind,
  day: await today(),
  players: [
    {
      accountId: pid,
      character: "voltkit",
      won: false,
      vsPeople: true,
      botLevel: null,
      mode: "duel",
      skillUses: 0,
      ults: 0,
      activeSeconds: 90,
      participated: true,
      ...fields,
    },
  ],
});
const record = async (p: object) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify(p),
  ]);
};
const grant = async (
  amount: number,
  ref: string,
  pid = other,
  day?: string,
) => {
  const d = day ?? (await today());
  await db.exec("reset role");
  await db.query("select public.arena_add_xp($1,$2,$3,$4,$5)", [
    pid,
    amount,
    "test",
    ref,
    d,
  ]);
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const id of [player, other, admin]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"Journey tester"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 60000);
afterAll(async () => db.close());
it("starts at level one and exposes only the caller’s XP", async () => {
  const forged = await receipt();
  await login();
  expect((await journey()).xp).toBe(0);
  await expect(
    db.query("select * from public.arena_player_xp"),
  ).rejects.toThrow("permission");
  await expect(
    db.query(
      "select public.arena_add_xp($1,1000,'test','forged',public.arena_today())",
      [player],
    ),
  ).rejects.toThrow("permission");
  await expect(
    db.query("select public.arena_record_activity($1::jsonb)", [
      JSON.stringify(forged),
    ]),
  ).rejects.toThrow("permission");
});
it("awards verified PvP, AI, raid and partial-raid XP once per result", async () => {
  for (const [kind, fields, amount] of [
    ["match", { won: true }, 75],
    ["match", { vsPeople: false, botLevel: "easy" }, 25],
    ["raid", { raid: { cleared: true, peril: 3 } }, 200],
    ["raid", { raid: { cleared: false, phaseReached: 2 } }, 40],
  ] as const) {
    const p = await receipt(kind, fields);
    await record(p);
    await record(p);
    await login();
    expect(
      (await journey()).recent.find((r: any) => r.ref === p.id),
    ).toMatchObject({ amount });
  }
});
it("rejects instant, abandoned and idle results for XP and weekly goals", async () => {
  for (const fields of [
    { activeSeconds: 10 },
    { abandoned: true },
    { participated: false },
    { vsPeople: false, botLevel: null },
  ]) {
    const p = await receipt("match", fields);
    await record(p);
    await login();
    expect((await journey()).recent.some((r: any) => r.ref === p.id)).toBe(
      false,
    );
  }
});
it("crosses level and season boundaries atomically and unlocks the correct slot", async () => {
  await grant(levelThreshold(10), "level-ten");
  await login(other);
  const j = await journey();
  expect(playerLevel(j.xp).level).toBe(10);
  expect(j.unlocked).toContain("wayfarer-frame");
  await db.query(
    "select public.arena_equip_raid_slot('frame','wayfarer-frame')",
  );
  await expect(
    db.query("select public.arena_equip_raid_slot('aura','wayfarer-frame')"),
  ).rejects.toThrow("another slot");
  await expect(
    db.query("select public.arena_equip_raid_slot('aura','astral-aura')"),
  ).rejects.toThrow("not earned");
  await db.exec("reset role");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.arena_coin_ledger where player_id=$1 and reason='level'",
        [other],
      )
    ).rows[0].n,
  ).toBe(9);
  await grant(levelThreshold(10), "level-ten");
  await login(other);
  expect((await journey()).xp).toBe(levelThreshold(10));
});
it("caps the displayed level at 50 while retaining XP, and grants every milestone exactly once", async () => {
  for (let i = 0; i < 4; i++) await grant(10000, "cap-" + i);
  await login(other);
  const j = await journey();
  expect(playerLevel(j.xp).level).toBe(50);
  for (const item of JOURNEY_ITEMS.filter((i) => !i.id.startsWith("season-")))
    expect(j.unlocked).toContain(item.id);
  const e = (await db.query<{ e: any }>("select public.arena_economy() e"))
    .rows[0].e;
  expect(e.journey.xp).toBe(j.xp);
  const titles = (
    await db.query<{ m: any }>("select public.arena_me() m")
  ).rows[0].m.ownedTitles.map((t: any) => t.name);
  expect(titles).toEqual(
    expect.arrayContaining([
      "Rising Spark",
      "Arena Vanguard",
      "Elemental Legend",
    ]),
  );
});
it("completes weekly goals once and grants all twenty free season tiers automatically", async () => {
  for (let i = 0; i < 5; i++)
    await record(
      await receipt("match", { arcade: "crown-chase", skillUses: 10 }, admin),
    );
  for (let i = 0; i < 2; i++)
    await record(
      await receipt("raid", { raid: { cleared: true, peril: 1 } }, admin),
    );
  await login(admin);
  const j = await journey();
  expect(j.season.completed.sort()).toEqual([
    "arcade",
    "play",
    "raids",
    "skills",
  ]);
  await grant(8000, "full-season", admin);
  await login(admin);
  const full = await journey(),
    theme = seasonTheme(full.season.id);
  for (const suffix of ["frame", "aura", "colors", "victory"])
    expect(full.unlocked).toContain(`season-${theme}-${suffix}`);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.arena_coin_ledger where player_id=$1 and reason='season'",
        [admin],
      )
    ).rows[0].n,
  ).toBe(20);
});
it("gives partial Boss Rush completion its own XP and limited coin rewards", async () => {
  const p = await receipt("expedition", {
    vsPeople: false,
    expedition: { completed: 2 },
  });
  await record(p);
  await record(p);
  await login();
  expect(
    (await journey()).recent.find((r: any) => r.ref === p.id)?.amount,
  ).toBe(180);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ amount: number }>(
        "select amount from public.arena_coin_ledger where player_id=$1 and reason='expedition' and ref=$2",
        [player, p.id],
      )
    ).rows,
  ).toEqual([{ amount: 60 }]);
});
it("does not let admins mint earned levels, and preserves progress when the migration is reapplied", async () => {
  await login(admin);
  const before = await journey();
  await expect(
    db.query(
      "select public.arena_add_xp($1,1000,'test','admin-forged',public.arena_today())",
      [admin],
    ),
  ).rejects.toThrow("permission");
  await db.exec(
    "reset role;" +
      (await readFile("supabase/migrations/022_player_journey.sql", "utf8")),
  );
  await login(admin);
  expect(await journey()).toEqual(before);
  const e = (await db.query<{ e: any }>("select public.arena_economy() e"))
    .rows[0].e;
  expect(e.unlimitedCoins).toBe(true);
  expect(e.mythicTesting).toBe(true);
  await expect(
    db.query("select public.arena_buy_item('wayfarer-frame')"),
  ).rejects.toThrow("not for sale");
});
it("awards a daily mission’s XP once, without resetting levels or seasons", async () => {
  const d = await today();
  await login(other);
  const before = await journey();
  await db.exec("reset role");
  for (let i = 0; i < 2; i++)
    await db.query(
      "select public.arena_grant($1,40,'mission','xp-trigger-check',$2)",
      [other, d],
    );
  await login(other);
  const after = await journey();
  expect(after.xp - before.xp).toBe(50);
  expect(after.season.xp - before.season.xp).toBe(50);
  expect(
    after.recent.filter((r: any) => r.ref === "xp-trigger-check"),
  ).toHaveLength(1);
});
it("keeps old seasonal cosmetics while a new month starts from its own XP total", async () => {
  const d = await today(),
    past = new Date(d + "T12:00:00Z");
  past.setUTCDate(1);
  past.setUTCDate(0);
  const oldDay = past.toISOString().slice(0, 10),
    oldTheme = seasonTheme(oldDay.slice(0, 7));
  await login(player);
  const before = await journey();
  await grant(8000, "past-season", player, oldDay);
  await login(player);
  const after = await journey();
  expect(after.season.xp).toBe(before.season.xp);
  expect(after.xp - before.xp).toBe(8000);
  for (const suffix of ["frame", "aura", "colors", "victory"])
    expect(after.unlocked).toContain(`season-${oldTheme}-${suffix}`);
});
it("seeds every shared progression cosmetic as an earned-only item in its real equipment slot", async () => {
  await db.exec("reset role");
  for (const item of JOURNEY_ITEMS) {
    const rows = (
      await db.query<{ slot: string; active: boolean }>(
        "select slot,active from public.arena_shop_items where id=$1",
        [item.id],
      )
    ).rows;
    expect(rows).toEqual([{ slot: item.slot, active: false }]);
  }
});
it("does not award mission XP indirectly to an idle winning seat", async () => {
  const d = await today();
  await db.exec("reset role");
  await db.query("select public.arena_ensure_missions($1,$2)", [player, d]);
  await db.query(
    "update public.arena_mission_progress set mission_id='win-1',progress=0,done=false where player_id=$1 and day=$2 and slot=0",
    [player, d],
  );
  await login();
  const before = (await journey()).xp;
  await record(await receipt("match", { won: true, participated: false }));
  await login();
  expect((await journey()).xp).toBe(before);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ done: boolean }>(
        "select done from public.arena_mission_progress where player_id=$1 and day=$2 and slot=0",
        [player, d],
      )
    ).rows[0].done,
  ).toBe(false);
});
it("keeps the real co-op party size when excluding an idle teammate from mission rewards", async () => {
  const d = await today();
  await db.exec("reset role");
  await db.query("select public.arena_ensure_missions($1,$2)", [player, d]);
  await db.query(
    "update public.arena_mission_progress set mission_id='raid-party',progress=0,done=false where player_id=$1 and day=$2 and slot=1",
    [player, d],
  );
  const p = await receipt("raid", { raid: { cleared: true, peril: 1 } });
  p.players.push({ ...p.players[0], accountId: other, participated: false });
  await record(p);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ done: boolean }>(
        "select done from public.arena_mission_progress where player_id=$1 and day=$2 and slot=1",
        [player, d],
      )
    ).rows[0].done,
  ).toBe(true);
});
