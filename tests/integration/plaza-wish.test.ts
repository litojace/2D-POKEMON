import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PLAZA_WISH } from "../../packages/shared/src/plaza";

// Migration 20261120130000_plaza_wishing_fountain: a full wish meter in the
// Plaza pays each wisher PLAZA_WISH.coins, once per fill (its ref), at most
// PLAZA_WISH.perDay fills a Pacific day. Only the game server may call it.
let db: PGlite;
const ann = "00000000-0000-4000-8000-000000000391",
  ben = "00000000-0000-4000-8000-000000000392",
  banned = "00000000-0000-4000-8000-000000000393";
const fill = (n: number) =>
  `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb${String(n).padStart(2, "0")}`;
const login = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
/** What the game server does: report a fill with the service role. */
const wish = async (player: string, ref: string) => {
  await db.exec("reset role;set role service_role");
  return (
    await db.query<{ v: any }>("select public.arena_plaza_wish($1) v", [
      JSON.stringify({ player, ref }),
    ])
  ).rows[0].v;
};
const coins = async (id: string) => {
  await db.exec("reset role");
  const r = await db.query<{ n: number; s: number; b: number }>(
    `select count(*)::int n, coalesce(sum(amount),0)::int s,
       (select coalesce(balance,0) from public.arena_wallets where player_id=$1)::int b
     from public.arena_coin_ledger where player_id=$1 and reason='plaza-wish'`,
    [id],
  );
  return r.rows[0];
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
  for (const [id, name] of [
    [ann, "Ann"],
    [ben, "Ben"],
    [banned, "Banned"],
  ]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}','{"display_name":"${name}"}')`,
    );
    await login(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;update public.arena_profiles set suspended=true where id='${banned}'`,
  );
}, 60000);
afterAll(async () => db.close());

it("matches the shared reward and daily cap", async () => {
  await db.exec("reset role");
  const src = (
    await db.query<{ s: string }>(
      "select prosrc s from pg_proc where proname='arena_plaza_wish'",
    )
  ).rows[0].s;
  expect(src).toMatch(
    new RegExp(`v_coins constant integer = ${PLAZA_WISH.coins};`),
  );
  expect(src).toMatch(
    new RegExp(`v_cap constant integer = ${PLAZA_WISH.perDay};`),
  );
});

it("pays each wisher once per fill, however often the server retries", async () => {
  const before = await coins(ann);
  expect(await wish(ann, fill(1))).toEqual({
    paid: true,
    coins: PLAZA_WISH.coins,
    today: 1,
  });
  expect(await wish(ann, fill(1))).toEqual({ paid: false, coins: 0, today: 1 });
  // Another wisher of the same fill is paid too.
  expect((await wish(ben, fill(1))).paid).toBe(true);
  const after = await coins(ann);
  expect(after.n).toBe(before.n + 1);
  expect(after.b - before.b).toBe(PLAZA_WISH.coins);
});

it("stops paying after the day's cap", async () => {
  for (let i = 2; i <= PLAZA_WISH.perDay; i++)
    expect((await wish(ann, fill(i))).paid).toBe(true);
  const capped = await wish(ann, fill(50));
  expect(capped).toEqual({ paid: false, coins: 0, today: PLAZA_WISH.perDay });
  const c = await coins(ann);
  expect(c.n).toBe(PLAZA_WISH.perDay);
  expect(c.s).toBe(PLAZA_WISH.perDay * PLAZA_WISH.coins);
  // Ben's own cap is his.
  expect((await wish(ben, fill(2))).paid).toBe(true);
});

it("pays the cap again the next Pacific day", async () => {
  await db.exec(
    `reset role;update public.arena_coin_ledger set day = day - 1 where player_id='${ann}' and reason='plaza-wish'`,
  );
  expect((await wish(ann, fill(60))).paid).toBe(true);
  // An old fill's ref still pays nothing more.
  expect((await wish(ann, fill(1))).paid).toBe(false);
});

it("refuses suspended, unknown or malformed callers, and players themselves", async () => {
  expect(await wish(banned, fill(70))).toBeNull();
  expect(
    await wish("00000000-0000-4000-8000-000000000999", fill(70)),
  ).toBeNull();
  await expect(wish(ann, "not-a-uuid")).rejects.toThrow(/Bad wish/);
  await expect(wish("nope", fill(70))).rejects.toThrow(/Bad player/);
  await login(ann);
  await expect(
    db.query("select public.arena_plaza_wish($1)", [
      JSON.stringify({ player: ann, ref: fill(71) }),
    ]),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select public.arena_plaza_wish($1)", [
      JSON.stringify({ player: ann, ref: fill(72) }),
    ]),
  ).rejects.toThrow(/permission denied/);
  expect((await coins(banned)).n).toBe(0);
});
