import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  PLAZA_FISH,
  PLAZA_FISH_FIRST_MAX,
  PLAZA_FISH_RARITY,
  PLAZA_FISH_TITLE,
  PLAZA_FISHING,
  PLAZA_QUESTS,
} from "../../packages/shared/src/plaza";

// Migration 20261120180000_plaza_fishing: the game server reports each catch
// (arena_plaza_record, kind "fish"); at most PLAZA_FISHING.perDay count a
// day, toward the "Catch 3 fish" quest and the Fish book.
let db: PGlite;
const angler = "00000000-0000-4000-8000-000000000391",
  other = "00000000-0000-4000-8000-000000000392",
  banned = "00000000-0000-4000-8000-000000000393";
const login = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const record = async (p: Record<string, unknown>) => {
  await db.exec("reset role;set role service_role");
  return (
    await db.query<{ v: any }>("select public.arena_plaza_record($1) v", [
      JSON.stringify(p),
    ])
  ).rows[0].v;
};
const progress = async (id: string) => {
  await login(id);
  return (await db.query<{ v: any }>("select public.arena_plaza() v")).rows[0]
    .v;
};
const coins = async (id: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ n: number }>(
      "select coalesce((select balance from public.arena_wallets where player_id = $1), 0)::int n",
      [id],
    )
  ).rows[0].n;
};
const fishQuest = PLAZA_QUESTS.find((q) => q.id === "fish")!;

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
    [angler, "Angler"],
    [other, "Other"],
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

it("has the fish quest in the database's list, as in the shared one", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ id: string; needed: number; coins: number }>(
      "select * from public.arena_plaza_quests() where id = 'fish'",
    )
  ).rows;
  expect(rows).toEqual([
    { id: "fish", needed: fishQuest.max, coins: fishQuest.coins },
  ]);
  // Every shared fish id passes the database's check.
  for (const f of PLAZA_FISH) expect(f.id).toMatch(/^[a-z][a-z0-9-]{1,31}$/);
});

it("counts catches toward the quest, pays it once, and fills the Fish book", async () => {
  let p = await progress(angler);
  expect(p.fishToday).toBe(0);
  expect(p.fishBook).toEqual({});
  expect(p.quests.fish).toEqual({ n: 0, done: false });
  const c0 = await coins(angler);
  await record({ player: angler, kind: "fish", ref: "tide-guppy" });
  p = await record({ player: angler, kind: "fish", ref: "tide-guppy" });
  expect(p.quests.fish).toEqual({ n: 2, done: false });
  expect(await coins(angler)).toBe(c0);
  p = await record({ player: angler, kind: "fish", ref: "zap-eel" });
  expect(p.quests.fish).toEqual({ n: 3, done: true });
  expect(p.fishToday).toBe(3);
  expect(p.fishBook).toEqual({ "tide-guppy": 2, "zap-eel": 1 });
  expect(await coins(angler)).toBe(c0 + fishQuest.coins);
  // Paid once a day.
  p = await record({ player: angler, kind: "fish", ref: "ember-minnow" });
  expect(p.quests.fish).toEqual({ n: 3, done: true });
  expect(await coins(angler)).toBe(c0 + fishQuest.coins);
  // Only the angler's book.
  expect((await progress(other)).fishBook).toEqual({});
});

it(`counts at most ${PLAZA_FISHING.perDay} catches a day; a new fish past the cap still enters the book`, async () => {
  for (let i = 0; i < PLAZA_FISHING.perDay + 5; i++)
    await record({ player: other, kind: "fish", ref: "pebble-carp" });
  let p = await progress(other);
  expect(p.fishToday).toBe(PLAZA_FISHING.perDay);
  expect(p.fishBook).toEqual({ "pebble-carp": PLAZA_FISHING.perDay });
  p = await record({ player: other, kind: "fish", ref: "starlight-sturgeon" });
  expect(p.fishToday).toBe(PLAZA_FISHING.perDay);
  expect(p.fishBook["starlight-sturgeon"]).toBe(0);
  // Tomorrow counts again.
  await db.exec(
    `reset role;update public.arena_plaza_days set day = day - 1 where player_id = '${other}'`,
  );
  p = await record({ player: other, kind: "fish", ref: "starlight-sturgeon" });
  expect(p.fishToday).toBe(1);
  expect(p.fishBook["starlight-sturgeon"]).toBe(1);
});

const ledger = async (id: string, reason: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ n: number; s: number }>(
      "select count(*)::int n, coalesce(sum(amount),0)::int s from public.arena_coin_ledger where player_id=$1 and reason=$2",
      [id, reason],
    )
  ).rows[0];
};
/** What the game server sends for a catch (server.ts). */
const caught = (player: string, ref: string) =>
  record({
    player,
    kind: "fish",
    ref,
    coins:
      PLAZA_FISH_RARITY[PLAZA_FISH.find((f) => f.id === ref)!.rarity]
        .firstCoins,
    bookSize: PLAZA_FISH.length,
  });

it("pays each fish's first catch once, by rarity, capped", async () => {
  const who = banned.replace("393", "394");
  await db.exec(
    `reset role;insert into auth.users values('${who}','{"display_name":"First"}')`,
  );
  await login(who);
  await db.query("select public.arena_me()");
  const legendary = PLAZA_FISH.find((f) => f.rarity === "legendary")!;
  const common = PLAZA_FISH.find((f) => f.rarity === "common")!;
  const c0 = await coins(who);
  await caught(who, common.id);
  await caught(who, common.id);
  await caught(who, legendary.id);
  expect(await ledger(who, "plaza-fish-first")).toEqual({
    n: 2,
    s:
      PLAZA_FISH_RARITY.common.firstCoins +
      PLAZA_FISH_RARITY.legendary.firstCoins,
  });
  // Three catches also finish the day's fish quest.
  expect(await coins(who)).toBe(
    c0 +
      PLAZA_FISH_RARITY.common.firstCoins +
      PLAZA_FISH_RARITY.legendary.firstCoins +
      fishQuest.coins,
  );
  // A bad amount is capped, never negative; a missing one pays nothing.
  await record({ player: who, kind: "fish", ref: "zap-eel", coins: 9999 });
  await record({ player: who, kind: "fish", ref: "tide-guppy", coins: -50 });
  await record({ player: who, kind: "fish", ref: "reed-perch" });
  expect((await ledger(who, "plaza-fish-first")).s).toBe(
    PLAZA_FISH_RARITY.common.firstCoins +
      PLAZA_FISH_RARITY.legendary.firstCoins +
      PLAZA_FISH_FIRST_MAX,
  );
  for (const r of Object.values(PLAZA_FISH_RARITY))
    expect(r.firstCoins).toBeLessThanOrEqual(PLAZA_FISH_FIRST_MAX);
});

it(`gives the title "${PLAZA_FISH_TITLE.name}" for every fish in the book, once`, async () => {
  const who = banned.replace("393", "395");
  await db.exec(
    `reset role;insert into auth.users values('${who}','{"display_name":"Angler 2"}')`,
  );
  await login(who);
  await db.query("select public.arena_me()");
  await db.exec("reset role");
  const title = (
    await db.query<any>(
      "select name, description, color, active from public.arena_titles where name = $1",
      [PLAZA_FISH_TITLE.name],
    )
  ).rows;
  expect(title).toEqual([{ ...PLAZA_FISH_TITLE, active: true }]);
  let p;
  for (const f of PLAZA_FISH.slice(0, -1)) p = await caught(who, f.id);
  expect(p.fishTitle).toBe(false);
  // A tiny book size never hands it out.
  p = await record({
    player: who,
    kind: "fish",
    ref: "tide-guppy",
    bookSize: 2,
  });
  expect(p.fishTitle).toBe(false);
  p = await caught(who, PLAZA_FISH.at(-1)!.id);
  expect(p.fishTitle).toBe(true);
  p = await caught(who, PLAZA_FISH[0].id);
  expect(p.fishTitle).toBe(true);
  await db.exec("reset role");
  const held = (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.arena_player_titles pt join public.arena_titles t on t.id = pt.title_id where pt.player_id = $1 and t.name = $2",
      [who, PLAZA_FISH_TITLE.name],
    )
  ).rows[0].n;
  expect(held).toBe(1);
  expect((await progress(who)).fishTitle).toBe(true);
  expect((await progress(other)).fishTitle).toBe(false);
});

it("rejects bad fish, ignores suspended players, and only the game server records", async () => {
  for (const ref of [undefined, "", "Zap Eel", "x", "a".repeat(40), "1fish"])
    await expect(record({ player: angler, kind: "fish", ref })).rejects.toThrow(
      /Bad fish/,
    );
  expect(
    await record({ player: banned, kind: "fish", ref: "tide-guppy" }),
  ).toBeNull();
  await login(angler);
  await expect(
    db.query("select public.arena_plaza_record($1)", [
      JSON.stringify({ player: angler, kind: "fish", ref: "tide-guppy" }),
    ]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select * from public.arena_plaza_fish_book"),
  ).rejects.toThrow(/permission denied/);
});

it("deletes the Fish book with the account", async () => {
  await db.exec("reset role");
  await db.query("delete from public.arena_profiles where id = $1", [angler]);
  const n = (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.arena_plaza_fish_book where player_id = $1",
      [angler],
    )
  ).rows[0].n;
  expect(n).toBe(0);
});
