import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 057: daily seed gifts, friendship days and farm invites.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000571";
const ben = "00000000-0000-4000-8000-000000000572";
const cat = "00000000-0000-4000-8000-000000000573"; // Ann's friend, no farm
const dan = "00000000-0000-4000-8000-000000000574"; // a stranger
const newbies = [5, 6, 7, 8, 9, 10].map(
  (n) => `00000000-0000-4000-8000-0000000005${String(70 + n).padStart(2, "0")}`,
);
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
const seeds = async (id: string, crop: string) =>
  Number(
    (
      await sql(
        "select coalesce((select qty from public.arena_farm_seeds where player_id = $1 and crop = $2), 0) n",
        [id, crop],
      )
    )[0].n,
  );
const code = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

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
    [cat, "Cat"],
    [dan, "Dan"],
    ...newbies.map((id, k) => [id, `New${k}`]),
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  await sql(
    "insert into public.arena_friendships(a, b) values ($1, $2), ($1, $3)",
    [ann, ben, cat],
  );
  for (const id of [ann, ben]) await call(id, "public.arena_farm()");
}, 60000);
afterAll(async () => db.close());

it("lists friends with a farm, and only friends trade gifts", async () => {
  const s = await call(ann, "public.arena_farm_gifts()");
  expect(s.friends).toEqual([
    expect.objectContaining({
      id: ben,
      name: "Ben",
      days: 0,
      bond: 0,
      sent: false,
      waiting: 0,
    }),
  ]);
  expect(s.invites).toMatchObject({ code: code(ann), joined: 0, counted: 0 });
  await expect(
    call(dan, "public.arena_farm_gift_send($1)", [ann]),
  ).rejects.toThrow(/Only friends/);
  await expect(
    call(ann, "public.arena_farm_gift_send($1)", [cat]),
  ).rejects.toThrow(/no farm yet/);
});

it("sends one parcel a day; opening it gives seeds and a friendship day", async () => {
  let r = await call(ann, "public.arena_farm_gift_send($1)", [ben]);
  expect(r.ok).toBe(true);
  expect(r.state.friends[0].sent).toBe(true);
  r = await call(ann, "public.arena_farm_gift_send($1)", [ben]);
  expect(r).toMatchObject({ ok: false, error: /already sent/ });
  const [g] = await sql(
    "select crop, qty from public.arena_farm_gifts where sender = $1",
    [ann],
  );
  // Level 1 farms only get seeds they can plant.
  expect(["wheat", "carrot"]).toContain(g.crop);
  expect(g.qty).toBe(3);
  const before = await seeds(ben, g.crop);
  let s = await call(ben, "public.arena_farm_gifts()");
  expect(s.friends[0]).toMatchObject({ id: ann, waiting: 1 });
  r = await call(ben, "public.arena_farm_gift_open($1)", [ann]);
  expect(r).toMatchObject({ ok: true, crop: g.crop, qty: 3 });
  expect(await seeds(ben, g.crop)).toBe(before + 3);
  expect(r.state.friends[0]).toMatchObject({ waiting: 0, days: 1, bond: 0 });
  r = await call(ben, "public.arena_farm_gift_open($1)", [ann]);
  expect(r).toMatchObject({ ok: false, error: "No gift to open" });
  // Ben's parcel back the same day adds no second friendship day.
  await call(ben, "public.arena_farm_gift_send($1)", [ann]);
  r = await call(ann, "public.arena_farm_gift_open($1)", [ben]);
  expect(r.ok).toBe(true);
  expect(r.state.friends[0]).toMatchObject({ days: 1 });
  // Three days of gifts: Bud.
  await sql(
    "update public.arena_farm_bonds set days = 2, last_day = public.arena_today() - 1",
  );
  await sql(
    "insert into public.arena_farm_gifts(sender, receiver, day, crop, qty) values ($1, $2, public.arena_today() - 1, 'wheat', 3)",
    [ann, ben],
  );
  r = await call(ben, "public.arena_farm_gift_open($1)", [ann]);
  expect(r.state.friends[0]).toMatchObject({ days: 3, bond: 1 });
  // Parcels older than 7 days can't be opened.
  await sql(
    "insert into public.arena_farm_gifts(sender, receiver, day, crop, qty) values ($1, $2, public.arena_today() - 9, 'wheat', 3)",
    [ann, ben],
  );
  r = await call(ben, "public.arena_farm_gift_open($1)", [ann]);
  expect(r.ok).toBe(false);
});

it("opens at most 20 parcels a day", async () => {
  await sql(
    "update public.arena_farm_gifts set opened_at = now() where receiver = $1",
    [ben],
  );
  const opened = Number(
    (
      await sql(
        "select count(*) n from public.arena_farm_gifts where receiver = $1 and (opened_at at time zone 'America/Los_Angeles')::date = public.arena_today()",
        [ben],
      )
    )[0].n,
  );
  // Pad today's opened count to 20 with old parcels opened today.
  for (let k = 0; k < 20 - opened; k++)
    await sql(
      "insert into public.arena_farm_gifts(sender, receiver, day, crop, qty, opened_at) values ($1, $2, public.arena_today() - $3::int, 'wheat', 1, now())",
      [ann, ben, 20 + k],
    );
  await sql(
    "insert into public.arena_farm_gifts(sender, receiver, day, crop, qty) values ($1, $2, public.arena_today() - 2, 'wheat', 3)",
    [ann, ben],
  );
  const r = await call(ben, "public.arena_farm_gift_open($1)", [ann]);
  expect(r).toMatchObject({ ok: false, error: /20 gifts today/ });
});

it("an invite link makes friends, and counts once the new player reaches farm level 10", async () => {
  const [n1, n2, n3, n4, n5, n6] = newbies;
  let r = await call(n1, "public.arena_farm_invite_claim($1)", [code(ann)]);
  expect(r).toEqual({ ok: true, inviter: "Ann" });
  expect(
    (
      await sql(
        "select count(*) n from public.arena_friendships where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)",
        [n1, ann],
      )
    )[0].n,
  ).toBe(1);
  r = await call(n1, "public.arena_farm_invite_claim($1)", [code(ben)]);
  expect(r).toMatchObject({ ok: false, error: /already joined/ });
  r = await call(ann, "public.arena_farm_invite_claim($1)", [code(ann)]);
  expect(r).toMatchObject({ ok: false, error: /own invite/ });
  r = await call(n2, "public.arena_farm_invite_claim($1)", ["ZZZZ"]);
  expect(r).toMatchObject({ ok: false, error: /broken/ });
  // Old accounts can't claim.
  await sql(
    "update public.arena_profiles set created_at = now() - interval '30 days' where id = $1",
    [n6],
  );
  r = await call(n6, "public.arena_farm_invite_claim($1)", [code(ann)]);
  expect(r).toMatchObject({ ok: false, error: /new players/ });

  for (const n of [n2, n3, n4, n5])
    await call(n, "public.arena_farm_invite_claim($1)", [code(ann)]);
  // Nobody counts until they reach farm level 10.
  for (const n of [n1, n2, n3, n4, n5]) await call(n, "public.arena_farm()");
  const ann0 = await leaves(ann);
  let s = await call(ann, "public.arena_farm_gifts()");
  expect(s.invites).toMatchObject({ joined: 5, counted: 0, claimed: [] });
  expect(await leaves(ann)).toBe(ann0);
  // One reaches level 10: Ann gets the first step, the new player 200.
  await sql("update public.arena_farms set level = 10 where player_id = $1", [
    n1,
  ]);
  const n10 = await leaves(n1);
  s = await call(ann, "public.arena_farm_gifts()");
  expect(s.invites).toMatchObject({ counted: 1, claimed: [1] });
  expect((await leaves(ann)) - ann0).toBe(200);
  await call(n1, "public.arena_farm_gifts()");
  await call(n1, "public.arena_farm_gifts()");
  expect((await leaves(n1)) - n10).toBe(200);
  // Three, then five: 300 leaves and a Gold Fertilizer, then 1,000. Paid once.
  await sql(
    "update public.arena_farms set level = 12 where player_id = any($1::uuid[])",
    [[n2, n3, n4, n5]],
  );
  const gold0 = (
    await sql("select fert_gold from public.arena_farms where player_id = $1", [
      ann,
    ])
  )[0].fert_gold;
  s = await call(ann, "public.arena_farm_gifts()");
  await call(ann, "public.arena_farm_gifts()");
  expect(s.invites).toMatchObject({ counted: 5, claimed: [1, 3, 5] });
  expect((await leaves(ann)) - ann0).toBe(200 + 300 + 1000);
  expect(
    (
      await sql(
        "select fert_gold from public.arena_farms where player_id = $1",
        [ann],
      )
    )[0].fert_gold,
  ).toBe(gold0 + 1);
  expect((await call(n1, "public.arena_farm_gifts()")).invites.invitedBy).toBe(
    "Ann",
  );
});
