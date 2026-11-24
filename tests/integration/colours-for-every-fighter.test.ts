import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 073 made Shop Colors per champion; 075 undoes it. After both,
// buying Colors dresses every fighter again, the functions are as before 073,
// and anything bought or worn under 073 became the old kind.
const BUYER = "00000000-0000-4000-8000-000000000751";
const WEARER = "00000000-0000-4000-8000-000000000752";

let db: PGlite;
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const call = async (sql: string, params: unknown[] = []) =>
  (await db.query<{ r: any }>(sql, params)).rows[0]?.r;
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const migrations = async (keep: (n: number) => boolean) => {
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f) && keep(Number(f.slice(0, 3))))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await db.exec("select set_config('arena.farm_bugs', 'off', false)");
  await migrations((n) => n < 75);
  for (const id of [BUYER, WEARER]) {
    await owner(
      `insert into auth.users values('${id}','{"display_name":"Colors ${id.slice(-3)}"}')`,
    );
    await as(id);
    await db.query("select public.arena_me()");
    await db.query("select public.arena_farm()");
    await owner(
      "insert into public.arena_wallets(player_id, balance) values ($1, 50000) on conflict (player_id) do update set balance = 50000",
      [id],
    );
  }
  // Under 073 (only where 073 is the newest Colors migration): one bought
  // Candy colors for Voltkit and wears them there.
  await as(WEARER);
  await db.query("select public.arena_buy_item('candy-colours', 'voltkit')");
  await db.query(
    "select public.arena_equip_champion_colours('voltkit', 'candy-colours')",
  );
  await db.exec("reset role");
  await migrations((n) => n >= 75);
}, 60000);
afterAll(async () => db.close());

it("buys Colors once, for every fighter, with the pre-073 function", async () => {
  await as(BUYER);
  const e = await call("select public.arena_buy_item('retro-colours') r");
  expect(e.owned).toContain("retro-colours");
  expect(e).not.toHaveProperty("colourUnlocks");
  await expect(
    db.query("select public.arena_buy_item('retro-colours')"),
  ).rejects.toThrow(/already own/);
  await db.query(
    "select public.arena_equip_raid_slot('skin', 'retro-colours')",
  );
  const look = (await call("select public.arena_raid_progress() r")).loadout;
  expect(look.skin).toBe("retro-colours");
  expect(look).not.toHaveProperty("colours");
  const args = await owner(
    "select pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'arena_buy_item'",
  );
  expect(args).toEqual([{ a: "p_item text" }]);
});

it("drops 073's functions and tables", async () => {
  const left = await owner(
    "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('arena_equip_champion_colours', 'arena_colours_for', 'arena_is_champion_colours') union all select table_name from information_schema.tables where table_schema = 'public' and table_name in ('arena_colour_unlocks', 'arena_champion_colours')",
  );
  expect(left).toEqual([]);
});

it("turns Colors bought and worn under 073 into Colors for every fighter, still worn", async () => {
  await as(WEARER);
  const e = await call("select public.arena_economy() r");
  expect(e.owned).toContain("candy-colours");
  const look = (await call("select public.arena_raid_progress() r")).loadout;
  expect(look.skin).toBe("candy-colours");
});
