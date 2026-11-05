import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 060: co-ops and the weekly Valley Cup.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000601";
const ben = "00000000-0000-4000-8000-000000000602";
const dan = "00000000-0000-4000-8000-000000000603";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const call = async (id: string, q: string, params: unknown[] = []) => {
  await as(id);
  return (await db.query<{ r: any }>(`select ${q} r`, params)).rows[0].r;
};
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const leaves = async (id: string) =>
  Number(
    (
      await sql(
        "select coalesce((select balance from public.arena_leaf_wallets where player_id = $1), 0) b",
        [id],
      )
    )[0].b,
  );
const extra = Array.from(
  { length: 9 },
  (_, k) => `00000000-0000-4000-8000-0000000006${String(10 + k)}`,
);
const cup = (id: string, kind: string, arg: string | null = null) =>
  call(id, "public.arena_farm_cup_act($1, $2, $3)", [randomUUID(), kind, arg]);
const harvest = (id: string, n: number) =>
  sql(
    "insert into public.arena_farm_harvests(player_id, crop, harvests) values ($1, 'wheat', $2) on conflict (player_id, crop) do update set harvests = public.arena_farm_harvests.harvests + $2",
    [id, n],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const [id, name] of [
    [ann, "Ann"],
    [ben, "Ben"],
    [dan, "Dan"],
    ...extra.map((id, k) => [id, `Extra${k}`]),
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
  }
}, 60000);
afterAll(async () => db.close());

it("makes a co-op with a code; friends join it with the code, up to 10", async () => {
  let r = await cup(ann, "create", "x");
  expect(r).toMatchObject({ ok: false, error: /3 to 24/ });
  r = await cup(ann, "create", "  Thunder   Sprouts ");
  expect(r.ok).toBe(true);
  const coop = r.cup.coop;
  expect(coop).toMatchObject({ name: "Thunder Sprouts" });
  expect(coop.code).toMatch(/^[A-Z2-9]{6}$/);
  r = await cup(ann, "create", "Another");
  expect(r).toMatchObject({ ok: false, error: /Leave your co-op/ });
  r = await cup(ben, "join", "ZZZZZZ");
  expect(r).toMatchObject({ ok: false, error: /No co-op/ });
  r = await cup(ben, "join", coop.code.toLowerCase());
  expect(r.ok).toBe(true);
  expect(r.cup.coop.members.map((m: any) => m.name)).toEqual(["Ann", "Ben"]);
  for (const id of extra.slice(0, 8))
    expect((await cup(id, "join", coop.code)).ok).toBe(true);
  r = await cup(extra[8], "join", coop.code);
  expect(r).toMatchObject({ ok: false, error: /full/ });
});

it("a task counts what you do after taking it; done, its points go to the co-op", async () => {
  await harvest(ann, 50); // before taking the task: doesn't count
  let r = await cup(ann, "take", "harvest");
  expect(r.ok).toBe(true);
  expect(r.cup.active).toMatchObject({
    task: "harvest",
    goal: 30,
    progress: 0,
  });
  r = await cup(ann, "take", "orders");
  expect(r).toMatchObject({ ok: false, error: /Finish or drop/ });
  await harvest(ann, 12);
  let s = await call(ann, "public.arena_farm_cup()");
  expect(s.active.progress).toBe(12);
  expect(s.pts).toBe(0);
  await harvest(ann, 20);
  s = await call(ann, "public.arena_farm_cup()");
  expect(s.active).toBeNull();
  expect(s).toMatchObject({ pts: 320, done: 1, taken: 1, rank: 1, coops: 1 });
  expect(s.coop.members.find((m: any) => m.name === "Ann").pts).toBe(320);
  // Dan can't take tasks without a co-op.
  r = await cup(dan, "take", "harvest");
  expect(r).toMatchObject({ ok: false, error: /Join a co-op/ });
});

it("drops count toward the 9 tasks a week", async () => {
  for (let k = 0; k < 8; k++) {
    expect((await cup(ben, "take", "gifts")).ok).toBe(true);
    expect((await cup(ben, "drop")).ok).toBe(true);
  }
  expect((await call(ben, "public.arena_farm_cup()")).taken).toBe(8);
  // The ninth is the last.
  expect((await cup(ben, "take", "gifts")).ok).toBe(true);
  expect((await cup(ben, "drop")).ok).toBe(true);
  const r = await cup(ben, "take", "gifts");
  expect(r).toMatchObject({ ok: false, error: /9 tasks this week/ });
  expect((await cup(ben, "drop")).ok).toBe(false);
});

it("tiers: members who finished a task claim each reached tier once", async () => {
  // Give the co-op 4,200 points this week.
  const coop = (await call(ann, "public.arena_farm_cup()")).coop.id;
  await sql(
    "insert into public.arena_farm_cup_tasks(player_id, week, n, coop_id, task, base, goal, pts, done_at) values ($1, public.arena_farm_cup_week(), 9, $2, 'harvest', 0, 1, 3880, now())",
    [extra[0], coop],
  );
  let s = await call(ann, "public.arena_farm_cup()");
  expect(s.pts).toBe(4200);
  expect(s.tiers.map((t: any) => t.reached)).toEqual([true, true, false]);
  const [{ fert_super: f0 }] = await sql(
    "select fert_super from public.arena_farms where player_id = $1",
    [ann],
  );
  let r = await cup(ann, "claim", "1");
  expect(r).toMatchObject({
    ok: true,
    gained: { fertilizer: "super", qty: 3 },
  });
  const [{ fert_super: f1 }] = await sql(
    "select fert_super from public.arena_farms where player_id = $1",
    [ann],
  );
  expect(f1).toBe(f0 + 3);
  r = await cup(ann, "claim", "1");
  expect(r).toMatchObject({ ok: false, error: "Already claimed" });
  r = await cup(ann, "claim", "2");
  expect(r).toMatchObject({ ok: true, gained: { qty: 5 } });
  r = await cup(ann, "claim", "3");
  expect(r).toMatchObject({ ok: false, error: /reached that yet/ });
  // Ben dropped everything: no finished task, no share.
  r = await cup(ben, "claim", "1");
  expect(r).toMatchObject({ ok: false, error: /Finish a task/ });
});

it("leaving keeps the points with the co-op; co-ops are ranked", async () => {
  const before = (await call(ann, "public.arena_farm_cup()")).pts;
  await cup(ann, "leave");
  let s = await call(ben, "public.arena_farm_cup()");
  expect(s.pts).toBe(before);
  expect(s.coop.members.map((m: any) => m.name)).not.toContain("Ann");
  // Ann's new co-op ranks below.
  await cup(ann, "create", "Moon Diggers");
  s = await call(ann, "public.arena_farm_cup()");
  expect(s.pts).toBe(0);
  expect(s.ranking.map((r: any) => [r.rank, r.name, r.me])).toEqual([
    [1, "Thunder Sprouts", false],
    [2, "Moon Diggers", true],
  ]);
});
