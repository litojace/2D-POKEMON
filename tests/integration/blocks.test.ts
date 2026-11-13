import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 110: blocking a player ends the friendship, stops requests both
// ways (quietly for the blocked player) and lists who you blocked.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000020a1";
const ben = "00000000-0000-4000-8000-0000000020b1";
const cy = "00000000-0000-4000-8000-0000000020c1";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const one = async <T>(sql: string, args: unknown[] = []) =>
  (await db.query<{ v: T }>(sql, args)).rows[0].v;
async function relation(x: string, y: string) {
  await db.exec("reset role");
  return one<string>(
    `select case
      when exists(select 1 from public.arena_friendships where a=least($1::uuid,$2::uuid) and b=greatest($1::uuid,$2::uuid)) then 'friends'
      when exists(select 1 from public.arena_friend_requests where from_id=$1 and to_id=$2) then 'x asked'
      when exists(select 1 from public.arena_friend_requests where from_id=$2 and to_id=$1) then 'y asked'
      else 'none' end as v`,
    [x, y],
  );
}
const request = async (from: string, to: string) => {
  await as(from);
  return one<string>("select public.arena_friend_request(null,$1) as v", [to]);
};
const block = async (by: string, who: string, on = true) => {
  await as(by);
  await db.query("select public.arena_block_player($1,$2)", [who, on]);
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
  await db.exec(
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}'),('${cy}','{"display_name":"Cy"}')`,
  );
  for (const id of [ana, ben, cy]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 120000);
afterAll(async () => db.close());

it("ends a friendship and lists the blocked player", async () => {
  expect(await request(ana, ben)).toBe("requested");
  expect(await request(ben, ana)).toBe("friends");
  expect(await relation(ana, ben)).toBe("friends");
  await block(ana, ben);
  expect(await relation(ana, ben)).toBe("none");
  await as(ana);
  expect(
    await one<{ id: string; name: string }[]>(
      "select public.arena_blocked_players() as v",
    ),
  ).toEqual([{ id: ben, name: "Ben" }]);
  // Blocking twice is fine; Ben's own list is empty.
  await block(ana, ben);
  await as(ben);
  expect(await one("select public.arena_blocked_players() as v")).toEqual([]);
});

it("drops the blocked player's request quietly, and asks the blocker to unblock", async () => {
  // Ben is told "requested", as for anyone, but nothing reaches Ana.
  expect(await request(ben, ana)).toBe("requested");
  expect(await relation(ben, ana)).toBe("none");
  await as(ana);
  await expect(
    db.query("select public.arena_friend_request(null,$1)", [ben]),
  ).rejects.toThrow("You blocked this player");
  // Others are untouched.
  expect(await request(cy, ana)).toBe("requested");
  expect(await relation(cy, ana)).toBe("x asked");
});

it("removes a pending request when blocking", async () => {
  expect(await relation(cy, ana)).toBe("x asked");
  await block(ana, cy);
  expect(await relation(cy, ana)).toBe("none");
});

it("unblocks: requests work again", async () => {
  await block(ana, ben, false);
  await as(ana);
  expect(
    (
      await one<{ id: string }[]>("select public.arena_blocked_players() as v")
    ).map((b) => b.id),
  ).toEqual([cy]);
  expect(await request(ben, ana)).toBe("requested");
  expect(await relation(ben, ana)).toBe("x asked");
});

it("refuses yourself, unknown players and anonymous callers", async () => {
  await as(ana);
  await expect(
    db.query("select public.arena_block_player($1,true)", [ana]),
  ).rejects.toThrow("yourself");
  await expect(
    db.query("select public.arena_block_player($1,true)", [
      "00000000-0000-4000-8000-0000000020ff",
    ]),
  ).rejects.toThrow("not found");
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select public.arena_block_player($1,true)", [ben]),
  ).rejects.toThrow();
  // Players can't read or write the table directly.
  await as(ana);
  await expect(db.query("select * from public.arena_blocks")).rejects.toThrow();
});
