import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { COLLECTION_FRAMES } from "../../packages/shared/src/journey";

// Migrations 071 and 072: owning every Void Knight, Cyber Mecha or Arcade
// skin earns that collection's reward frame, which is never sold.
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000711";
const player = "00000000-0000-4000-8000-000000000712";
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const owned = async () =>
  (await db.query<{ e: any }>("select public.arena_economy() e")).rows[0].e
    .owned as string[];
const buy = (id: string) => db.query("select public.arena_buy_item($1)", [id]);
const skins = (collection: string) =>
  CHAMPION_SKINS.filter((s) => s.collection === collection).map((s) => s.id);

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
    [admin, "Frame admin"],
    [player, "Frame player"],
  ]) {
    await db.exec(
      `reset role;insert into auth.users values('${id}', jsonb_build_object('display_name', '${name}'::text))`,
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  // An admin buys without coins or Mythic Trials (016, 017).
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 60000);
afterAll(async () => db.close());

it("seeds each reward frame as a never-sold frame of its collection", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<any>(
      "select id, slot, collection, price, active from public.arena_shop_items where id = any($1::text[]) order by id",
      [COLLECTION_FRAMES.map((f) => f.id)],
    )
  ).rows;
  expect(rows).toEqual(
    COLLECTION_FRAMES.map((f) => ({
      id: f.id,
      slot: "frame",
      collection: f.collection,
      price: 0,
      active: false,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  );
  // Each collection is the sixteen skins the client knows.
  for (const f of COLLECTION_FRAMES) {
    const n = (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.arena_shop_items where kind = 'champion' and active and collection = $1",
        [f.collection],
      )
    ).rows[0].n;
    expect(n, f.collection).toBe(skins(f.collection).length);
    expect(n, f.collection).toBe(f.collection === "arcade" ? 8 : 16);
  }
});

it("grants the frame with the last skin of the set, not before", async () => {
  await as(admin);
  const voidKnights = skins("void");
  for (const id of voidKnights.slice(0, -1)) await buy(id);
  expect(await owned()).not.toContain("void-frame");
  await buy(voidKnights.at(-1)!);
  expect(await owned()).toContain("void-frame");
  expect(await owned()).not.toContain("cyber-frame");
  for (const id of skins("cyber")) await buy(id);
  expect(await owned()).toContain("cyber-frame");
  expect(await owned()).not.toContain("arcade-frame");
  for (const id of skins("arcade")) await buy(id);
  expect(await owned()).toContain("arcade-frame");
  // It equips in the frame slot like any owned frame.
  await db.query("select public.arena_equip_raid_slot('frame', 'void-frame')");
  const look = (
    await db.query<{ p: any }>("select public.arena_raid_progress() p")
  ).rows[0].p;
  expect(JSON.stringify(look)).toContain("void-frame");
});

it("never sells a reward frame, and doesn't give it for one skin", async () => {
  await db.exec(
    `reset role;insert into public.arena_wallets(player_id, balance) values('${player}', 100000) on conflict (player_id) do update set balance = 100000`,
  );
  await as(player);
  for (const f of COLLECTION_FRAMES)
    await expect(buy(f.id)).rejects.toThrow("not for sale");
  await buy(skins("cyber")[0]);
  expect(await owned()).not.toContain("cyber-frame");
  await expect(
    db.query("select public.arena_equip_raid_slot('frame', 'cyber-frame')"),
  ).rejects.toThrow("not earned");
});
