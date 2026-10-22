import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  MISSIONS,
  type ActivityPlayer,
  type ActivityReceipt,
  type Mission,
} from "../../packages/shared/src/shop";

let db: PGlite;
const player = "00000000-0000-4000-8000-000000000101";
const peer = "00000000-0000-4000-8000-000000000102";
let serial = 0;
const login = (id = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const today = async () => {
  await db.exec("reset role");
  return (await db.query<{ d: string }>("select public.arena_today()::text d"))
    .rows[0].d;
};
const give = async (ids: string[]) => {
  await db.exec("reset role");
  await db.query(
    "select public.arena_ensure_missions($1,public.arena_today())",
    [player],
  );
  for (const [slot, id] of ids.entries())
    await db.query(
      "update public.arena_mission_progress set mission_id=$2,progress=0,done=false where player_id=$1 and day=public.arena_today() and slot=$3",
      [player, id, slot],
    );
};
const progress = async () => {
  await db.exec("reset role");
  return (
    await db.query<{ mission_id: string; progress: number; done: boolean }>(
      "select mission_id,progress,done from public.arena_mission_progress where player_id=$1 and day=public.arena_today() order by slot",
      [player],
    )
  ).rows;
};
const receipt = async (
  kind: ActivityReceipt["kind"] = "match",
  fields: Partial<ActivityPlayer> = {},
  party = false,
): Promise<ActivityReceipt> => {
  const p: ActivityPlayer = {
    accountId: player,
    character: "voltkit",
    won: true,
    vsPeople: false,
    botLevel: "hard",
    mode: "duel",
    knockedOut: false,
    skillUses: 0,
    ults: 0,
    activeSeconds: 90,
    participated: true,
    abandoned: false,
    ...fields,
  };
  return {
    id: `mission-audit-${++serial}`,
    kind,
    day: await today(),
    players: party ? [p, { ...p, accountId: peer }] : [p],
  };
};
const raidFields = (
  changes: Partial<NonNullable<ActivityPlayer["raid"]>> = {},
): Partial<ActivityPlayer> => ({
  mode: "raid",
  botLevel: null,
  raid: {
    cleared: true,
    peril: 1,
    daily: false,
    flawless: false,
    feat: false,
    revives: 0,
    ...changes,
  },
});
const record = async (p: ActivityReceipt) => {
  await db.exec("reset role;set role service_role");
  await db.query("select public.arena_record_activity($1::jsonb)", [
    JSON.stringify(p),
  ]);
};
const qualifying = async (m: Mission) => {
  const fields: Partial<ActivityPlayer> = {};
  let kind: ActivityReceipt["kind"] = "match";
  const raidMetrics = [
    "raid-clear",
    "daily-clear",
    "revives",
    "raid-peril3",
    "raid-flawless",
    "feat",
    "raid-play",
    "raid-solo",
    "raid-solo-p2",
    "raid-party",
  ];
  if (raidMetrics.includes(m.metric)) {
    kind = "raid";
    Object.assign(fields, raidFields());
  }
  if (["pvp-wins", "teams-unharmed", "ffa-wins"].includes(m.metric))
    Object.assign(fields, { vsPeople: true, botLevel: null });
  if (m.metric === "skill-uses") fields.skillUses = 1;
  if (m.metric === "ults") fields.ults = 1;
  if (m.metric === "minutes") fields.activeSeconds = 60;
  if (m.metric === "wins-with") fields.character = m.champions![0];
  if (m.metric === "teams-unharmed") fields.mode = "teams";
  if (m.metric === "ffa-wins") fields.mode = "ffa";
  if (m.metric === "play") fields.won = false;
  if (fields.raid) {
    if (m.metric === "daily-clear") fields.raid.daily = true;
    if (m.metric === "revives") fields.raid.revives = 1;
    if (m.metric === "raid-peril3") fields.raid.peril = 3;
    if (m.metric === "raid-solo-p2") fields.raid.peril = 2;
    if (m.metric === "raid-flawless") fields.raid.flawless = true;
    if (m.metric === "feat") fields.raid.feat = true;
    if (m.metric === "raid-play") {
      fields.raid.cleared = false;
      fields.won = false;
    }
  }
  return receipt(kind, fields, ["revives", "raid-party"].includes(m.metric));
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const id of [player, peer]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      { display_name: "Mission audit" },
    ]);
    await login(id);
    await db.query("select public.arena_me()");
    await db.exec("reset role");
  }
}, 60000);
beforeEach(async () => {
  await db.exec("begin");
  await give(["skills-30", "bot-wins-3", "minutes-30"]);
});
afterEach(async () => db.exec("rollback;reset role"));
afterAll(async () => db.close());

it.each(MISSIONS)(
  "completes $id and pays its reward exactly once",
  async (m) => {
    const slot = ["easy", "medium", "hard"].indexOf(m.tier);
    await db.query(
      "update public.arena_mission_progress set mission_id=$2 where player_id=$1 and day=public.arena_today() and slot=$3",
      [player, m.id, slot],
    );
    for (let n = 1; n <= m.target; n++) {
      const p = await qualifying(m);
      await record(p);
      await record(p);
      expect((await progress())[slot]).toMatchObject({
        progress: n,
        done: n === m.target,
      });
    }
    await record(await qualifying(m));
    expect((await progress())[slot]).toMatchObject({
      progress: m.target,
      done: true,
    });
    const coins = await db.query<{ amount: number }>(
      "select amount from public.arena_coin_ledger where player_id=$1 and reason='mission' and ref=public.arena_today()::text||':'||$2::text",
      [player, slot],
    );
    expect(coins.rows).toEqual([{ amount: m.coins }]);
    const xp = await db.query<{ amount: number }>(
      "select amount from public.arena_xp_ledger where player_id=$1 and source='mission' and ref=public.arena_today()::text||':'||$2::text",
      [player, slot],
    );
    expect(xp.rows).toEqual([{ amount: 50 }]);
  },
);

it("carries leftover seconds across short bot matches, raids and Boss Rush", async () => {
  await give(["minutes-10", "ults-8", "minutes-30"]);
  for (let n = 0; n < 3; n++)
    await record(await receipt("match", { activeSeconds: 12.5 }));
  await record(
    await receipt("raid", {
      ...raidFields({ cleared: false }),
      activeSeconds: 22.499,
    }),
  );
  expect((await progress()).map((p) => p.progress)).toEqual([0, 0, 0]);
  await record(
    await receipt("expedition", {
      mode: "raid",
      botLevel: null,
      expedition: { completed: 0 },
      activeSeconds: 0.001,
    }),
  );
  expect((await progress()).map((p) => p.progress)).toEqual([1, 0, 1]);
  // A second full minute is earned from three more 20-second matches.
  for (let n = 0; n < 3; n++)
    await record(await receipt("match", { activeSeconds: 20 }));
  expect((await progress()).map((p) => p.progress)).toEqual([2, 0, 2]);
});

it("counts Boss Rush skills and ultimates once without granting ordinary raid clears", async () => {
  await give(["skills-30", "ults-8", "raid-p3"]);
  const p = await receipt("expedition", {
    mode: "raid",
    botLevel: null,
    skillUses: 15,
    ults: 4,
    activeSeconds: 120,
    expedition: { completed: 3 },
  });
  await record(p);
  await record(p);
  expect((await progress()).map((p) => p.progress)).toEqual([15, 4, 0]);
  await record(
    await receipt("expedition", {
      ...p.players[0],
      expedition: { completed: 1 },
    }),
  );
  expect((await progress()).map((p) => p.progress)).toEqual([30, 8, 0]);
  expect((await progress()).map((p) => p.done)).toEqual([true, true, false]);
  await give(["raid-1", "raid-solo-1", "feat-1"]);
  await record(await receipt("expedition", { ...p.players[0] }));
  expect((await progress()).map((p) => p.progress)).toEqual([0, 0, 0]);
});

it.each(["match", "raid", "expedition"] as const)(
  "excludes idle and abandoned %s results from every common counter",
  async (kind) => {
    await give(["skills-30", "ults-8", "minutes-30"]);
    for (const flags of [{ participated: false }, { abandoned: true }])
      await record(
        await receipt(kind, {
          ...raidFields(),
          skillUses: 30,
          ults: 8,
          activeSeconds: 1800,
          ...flags,
        }),
      );
    expect((await progress()).map((p) => p.progress)).toEqual([0, 0, 0]);
  },
);

const rejected: [
  string,
  ActivityReceipt["kind"],
  Partial<ActivityPlayer>,
  boolean?,
][] = [
  ["bot-wins-3", "match", { vsPeople: true, botLevel: null }],
  ["hard-bot", "match", { botLevel: "easy" }],
  ["hard-bots-3", "match", { botLevel: "normal" }],
  ["pvp-wins-2", "match", { vsPeople: false, botLevel: "hard" }],
  [
    "pvp-wins-5",
    "match",
    { vsPeople: true, botLevel: null, activeSeconds: 19.99 },
  ],
  ["earth-water", "match", { character: "voltkit" }],
  ["fire-light", "match", { character: "tidefin" }],
  ["electric-aura", "match", { character: "mystowl" }],
  ["psychic-shadow", "match", { character: "auralynx" }],
  [
    "teams-unharmed",
    "match",
    { mode: "teams", vsPeople: true, botLevel: null, knockedOut: true },
  ],
  ["teams-unharmed", "match", { mode: "duel", vsPeople: true, botLevel: null }],
  ["ffa-win", "match", { mode: "ffa", vsPeople: false, botLevel: "hard" }],
  ["ffa-win", "match", { mode: "duel", vsPeople: true, botLevel: null }],
  ["raid-1", "raid", raidFields({ cleared: false })],
  ["daily-1", "raid", raidFields({ daily: false })],
  ["revives-3", "raid", raidFields({ revives: 0 })],
  ["raid-p3", "raid", raidFields({ peril: 2 })],
  ["raid-flawless", "raid", raidFields({ flawless: false })],
  ["feat-1", "raid", raidFields({ feat: false })],
  ["raid-solo-1", "raid", raidFields(), true],
  ["raid-solo-p2", "raid", raidFields({ peril: 1 })],
  ["raid-solo-p2", "raid", raidFields({ peril: 2 }), true],
  ["raid-party", "raid", raidFields()],
];
it.each(rejected)(
  "does not credit %s from an ineligible %s result (%#)",
  async (id, kind, fields, party) => {
    const m = MISSIONS.find((m) => m.id === id)!;
    const slot = ["easy", "medium", "hard"].indexOf(m.tier);
    await db.query(
      "update public.arena_mission_progress set mission_id=$2 where player_id=$1 and day=public.arena_today() and slot=$3",
      [player, id, slot],
    );
    await record(await receipt(kind, fields, party));
    expect((await progress())[slot]).toMatchObject({
      progress: 0,
      done: false,
    });
  },
);

it("retains per-slot leftover time on replay and migration reapplication, and resets only the changed slot", async () => {
  await give(["minutes-10", "bot-wins-3", "minutes-30"]);
  const p = await receipt("match", { activeSeconds: 45 });
  await record(p);
  await record(p);
  await db.exec("reset role");
  const migration = await readFile(
    "supabase/migrations/025_mission_completion.sql",
    "utf8",
  );
  await db.exec(migration.replace(/^begin;|^commit;/gm, ""));
  const remaining = async () => {
    await db.exec("reset role");
    return (
      await db.query<{ time_remainder_ms: number }>(
        "select time_remainder_ms from public.arena_mission_progress where player_id=$1 and day=public.arena_today() order by slot",
        [player],
      )
    ).rows.map((p) => p.time_remainder_ms);
  };
  expect(await remaining()).toEqual([45000, 0, 45000]);
  await login();
  await db.query("select public.arena_reroll_mission(0)");
  expect(await remaining()).toEqual([0, 0, 45000]);
  await record(await receipt("match", { activeSeconds: 15 }));
  expect((await progress())[2].progress).toBe(1);
  expect(await remaining()).toEqual([0, 0, 0]);
});

it("keeps earlier whole-minute progress while accumulating new fractions and respecting the per-result cap", async () => {
  await give(["minutes-10", "bot-wins-3", "minutes-30"]);
  await db.query(
    "update public.arena_mission_progress set progress=4 where player_id=$1 and day=public.arena_today() and slot=0",
    [player],
  );
  for (let n = 0; n < 3; n++)
    await record(await receipt("match", { activeSeconds: 20 }));
  expect((await progress()).map((p) => p.progress)).toEqual([5, 3, 1]);
  await record(await receipt("match", { activeSeconds: 1e9 }));
  expect((await progress()).map((p) => p.progress)).toEqual([10, 3, 30]);
});

it("starts the next Pacific day without carrying yesterday's partial minute", async () => {
  await give(["minutes-10", "bot-wins-3", "minutes-30"]);
  await record(await receipt("match", { activeSeconds: 45 }));
  const d = await today();
  await db.exec(
    `create or replace function public.arena_today() returns date language sql stable as $$select '${d}'::date+1$$;`,
  );
  await give(["minutes-10", "bot-wins-3", "minutes-30"]);
  await record(await receipt("match", { activeSeconds: 15 }));
  expect((await progress()).map((p) => p.progress)).toEqual([0, 1, 0]);
});

it("keeps co-op classification with an idle or departed teammate without rewarding that seat", async () => {
  await give(["raid-1", "raid-party", "raid-solo-p2"]);
  const p = await receipt("raid", raidFields({ peril: 2 }), true);
  p.players[1].abandoned = true;
  await record(p);
  expect((await progress()).map((p) => p.progress)).toEqual([1, 1, 0]);
  const coins = await db.query<{ n: number }>(
    "select count(*)::int n from public.arena_coin_ledger where player_id=$1 and day=public.arena_today()",
    [peer],
  );
  expect(coins.rows[0].n).toBe(0);
});

it("completes all four weekly goals once from eligible results, including Boss Rush legs", async () => {
  for (let n = 0; n < 3; n++) {
    const p = await receipt("match", {
      arcade: "crown-chase",
      skillUses: 10,
      activeSeconds: 20,
    });
    await record(p);
    await record(p);
  }
  const rush = await receipt("expedition", {
    mode: "raid",
    botLevel: null,
    skillUses: 20,
    activeSeconds: 120,
    expedition: { completed: 2 },
  });
  await record(rush);
  await record(rush);
  await record(
    await receipt("raid", {
      ...raidFields({ cleared: false }),
      won: false,
      activeSeconds: 20,
    }),
  );
  await login();
  const j = (await db.query<{ j: any }>("select public.arena_journey() j"))
    .rows[0].j;
  expect(j.season.goals).toEqual({ play: 5, skills: 50, raids: 2, arcade: 3 });
  expect(j.season.completed.sort()).toEqual([
    "arcade",
    "play",
    "raids",
    "skills",
  ]);
  await db.exec("reset role");
  const awards = await db.query<{ n: number }>(
    "select count(*)::int n from public.arena_season_ledger where player_id=$1 and ref like 'weekly:%'",
    [player],
  );
  expect(awards.rows[0].n).toBe(4);
});

it("pays the all-three and seventh-day streak bonuses once and keeps all mission writes private", async () => {
  const d = await today();
  for (let n = 1; n <= 6; n++)
    await db.query(
      "insert into public.arena_mission_days(player_id,day,bonus) values($1,$2::date-$3::int,true)",
      [player, d, n],
    );
  await give(["skills-30", "ults-8", "minutes-30"]);
  const p = await receipt("expedition", {
    mode: "raid",
    botLevel: null,
    skillUses: 30,
    ults: 8,
    activeSeconds: 1800,
    expedition: { completed: 0 },
  });
  await record(p);
  await record(p);
  await db.exec("reset role");
  const coins = await db.query<{ reason: string; amount: number }>(
    "select reason,amount from public.arena_coin_ledger where player_id=$1 and reason in ('missions-bonus','streak') order by reason",
    [player],
  );
  expect(coins.rows).toEqual([
    { reason: "missions-bonus", amount: 50 },
    { reason: "streak", amount: 300 },
  ]);
  const allowed = await db.query<{ write: boolean }>(
    "select has_column_privilege('authenticated','public.arena_mission_progress','time_remainder_ms','update') as write",
  );
  expect(allowed.rows[0].write).toBe(false);
  const functions = await db.query<{ allowed: boolean }>(
    "select has_function_privilege('authenticated','public.arena_record_activity(jsonb)','execute') or has_function_privilege('service_role','public.arena_record_activity_before_journey(jsonb)','execute') or has_function_privilege('authenticated','public.arena_mission_bump(uuid,date,text,integer,text)','execute') as allowed",
  );
  expect(functions.rows[0].allowed).toBe(false);
});
