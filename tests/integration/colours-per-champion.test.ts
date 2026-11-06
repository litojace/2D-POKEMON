import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LOOK_ITEM_BY_ID } from "../../packages/shared/src/shop";

// Migration 073: Shop Colors are bought for one champion; a collection set
// still gives its Colors to every fighter; older lone purchases become one
// champion's.
const BUYER = "00000000-0000-4000-8000-000000000721";
const SETTER = "00000000-0000-4000-8000-000000000722";
const LONE = "00000000-0000-4000-8000-000000000723";
const BUNDLED = "00000000-0000-4000-8000-000000000724";
const candy = LOOK_ITEM_BY_ID["candy-colours"].price;

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
const buy = (item: string, champion?: string) =>
  call("select public.arena_buy_item($1, $2) r", [item, champion ?? null]);
const wear = (champion: string, item: string | null) =>
  call("select public.arena_equip_champion_colours($1, $2) r", [
    champion,
    item,
  ]);
const balance = async (id: string) =>
  (
    await owner(
      "select balance from public.arena_wallets where player_id = $1",
      [id],
    )
  )[0]?.balance;
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
  // Everything before 073, then two players who bought Colors the old way.
  await migrations((n) => n < 73);
  for (const id of [BUYER, SETTER, LONE, BUNDLED]) {
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
  // LONE bought Candy colors on their own and wears them; its farmer is Cindrake.
  await owner(
    "update public.arena_farms set farmer = 'cindrake' where player_id = $1",
    [LONE],
  );
  await as(LONE);
  await db.query("select public.arena_buy_item('candy-colours')");
  await db.query(
    "select public.arena_equip_raid_slot('skin', 'candy-colours')",
  );
  // BUNDLED bought the whole Galaxy set and wears its Colors.
  await as(BUNDLED);
  await db.query("select public.arena_buy_item('galaxy-set')");
  await db.query(
    "select public.arena_equip_raid_slot('skin', 'galaxy-colours')",
  );
  await db.exec("reset role");
  await migrations((n) => n >= 73);
}, 60000);
afterAll(async () => db.close());

describe("Colors bought for one champion", () => {
  it("need the champion, charge for it, and unlock only that champion", async () => {
    await as(BUYER);
    await expect(buy("candy-colours")).rejects.toThrow(/Choose the fighter/);
    const e = await buy("candy-colours", "voltkit");
    expect(e.owned).not.toContain("candy-colours");
    expect(e.colourUnlocks).toEqual({ "candy-colours": ["voltkit"] });
    expect(await balance(BUYER)).toBe(50000 - candy);
    await as(BUYER);
    await expect(buy("candy-colours", "voltkit")).rejects.toThrow(
      /already own these colors/,
    );
    // Another champion pays again, at the same price.
    const again = await buy("candy-colours", "pangrove");
    expect(again.colourUnlocks["candy-colours"]).toEqual([
      "pangrove",
      "voltkit",
    ]);
    expect(await balance(BUYER)).toBe(50000 - 2 * candy);
  });

  it("are worn on that champion only, over the all-fighter Skin slot", async () => {
    await as(BUYER);
    await wear("voltkit", "candy-colours");
    await expect(wear("cindrake", "candy-colours")).rejects.toThrow(
      /do not own these colors/,
    );
    // Not in the all-fighter slot: that would dress every champion.
    await expect(
      db.query("select public.arena_equip_raid_slot('skin', 'candy-colours')"),
    ).rejects.toThrow(/not earned/);
    const progress = await call("select public.arena_raid_progress() r");
    expect(progress.loadout.colours).toEqual({ voltkit: "candy-colours" });
    await wear("voltkit", null);
    expect(
      (await call("select public.arena_raid_progress() r")).loadout.colours,
    ).toEqual({});
    // Only Shop Colors go in the per-champion slot.
    await expect(wear("voltkit", "candy-aura")).rejects.toThrow(
      /not Shop colors/,
    );
  });

  it("from a collection set are for every fighter", async () => {
    await as(SETTER);
    const e = await buy("candy-set");
    expect(e.owned).toContain("candy-colours");
    await expect(buy("candy-colours", "lumoth")).rejects.toThrow(
      /already own these colors/,
    );
    await wear("lumoth", "candy-colours");
    await wear("mossloth", "candy-colours");
    await db.query(
      "select public.arena_equip_raid_slot('skin', 'candy-colours')",
    );
    const progress = await call("select public.arena_raid_progress() r");
    expect(progress.loadout.skin).toBe("candy-colours");
    expect(progress.loadout.colours).toEqual({
      lumoth: "candy-colours",
      mossloth: "candy-colours",
    });
  });

  it("bought on their own before 073 became the Lobby fighter's, still worn there", async () => {
    await as(LONE);
    const e = await call("select public.arena_economy() r");
    expect(e.owned).not.toContain("candy-colours");
    expect(e.colourUnlocks).toEqual({ "candy-colours": ["cindrake"] });
    const look = (await call("select public.arena_raid_progress() r")).loadout;
    expect(look.skin).toBeNull();
    expect(look.colours).toEqual({ cindrake: "candy-colours" });
  });

  it("that came with their set before 073 stay for every fighter", async () => {
    await as(BUNDLED);
    const e = await call("select public.arena_economy() r");
    expect(e.owned).toContain("galaxy-colours");
    expect(e.colourUnlocks).toEqual({});
    const look = (await call("select public.arena_raid_progress() r")).loadout;
    expect(look.skin).toBe("galaxy-colours");
  });

  it("are private: players can't read or write the tables directly", async () => {
    await as(BUYER);
    await expect(
      db.query("select * from public.arena_colour_unlocks"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "insert into public.arena_champion_colours values ($1, 'voltkit', 'galaxy-colours')",
        [BUYER],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
