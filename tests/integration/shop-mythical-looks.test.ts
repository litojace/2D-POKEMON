import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CHAMPION_SKINS, LOOK_ITEMS } from "../../packages/shared/src/shop";

/**
 * The Mythic Trial (win 30 matches or raids with a champion) opens that
 * champion's Void Knight skin. A Mythical Look piece belongs to no champion:
 * no number of wins could open it, so it sells like any other piece. Every
 * migration runs, in order, as production has them.
 */
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000477";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${player}','{"display_name":"Collector"}');`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
  await db.query("select public.arena_me()");
  await db.exec("reset role");
  await db.exec(
    `insert into public.arena_wallets(player_id, balance) values ('${player}', 100000) on conflict (player_id) do update set balance = 100000`,
  );
  await db.exec(
    `select set_config('request.jwt.claim.sub','${player}',false);set role authenticated`,
  );
}, 60000);
afterAll(async () => db.close());

const economy = async () =>
  (await db.query<{ e: any }>("select public.arena_economy() as e")).rows[0].e;

it("sells every Mythical Look piece on its own, at its own price", async () => {
  const mythical = LOOK_ITEMS.filter((i) => i.rarity === "mythical");
  // Galaxy's four pieces and Borealis's four (and any added since).
  expect(mythical.length).toBeGreaterThanOrEqual(8);
  for (const item of mythical) {
    const before = (await economy()).balance;
    await db.query("select public.arena_buy_item($1)", [item.id]);
    const after = await economy();
    expect(after.owned, item.id).toContain(item.id);
    expect(before - after.balance, item.id).toBe(item.price);
  }
});

it("still keeps a Void Knight skin behind its champion's Mythic Trial", async () => {
  const knight = CHAMPION_SKINS.find((s) => s.rarity === "mythical")!;
  await expect(
    db.query("select public.arena_buy_item($1)", [knight.id]),
  ).rejects.toThrow("Mythic Trial");
});
