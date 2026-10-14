import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { friendCode } from "../../packages/shared/src/accounts";

let db: PGlite;
const ana = "a1a1a1a1-0000-4000-8000-000000000001",
  ben = "b2b2b2b2-0000-4000-8000-000000000002",
  cy = "c3c3c3c3-0000-4000-8000-000000000003";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
type List = {
  code: string;
  friends: { id: string; name: string }[];
  incoming: { id: string }[];
  outgoing: { id: string }[];
};
async function list(id: string) {
  await as(id);
  return (await db.query<{ v: List }>("select public.arena_friends() as v"))
    .rows[0].v;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}'),('${cy}','{"display_name":"Cy"}');`,
  );
  for (const m of [
    "001_arena_accounts.sql",
    "002_admin_cleanup_reports.sql",
    "003_titles.sql",
    "004_matches_achievements.sql",
    "005_friends.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${m}`, "utf8"));
  for (const id of [ana, ben, cy]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

it("gives everyone the same friend code the client computes", async () => {
  expect((await list(ana)).code).toBe(friendCode(ana));
  expect(friendCode(ana)).toBe("A1A1A1A1");
});

it("requests by code, accepts, and lists both sides", async () => {
  await as(ana);
  const sent = await db.query<{ v: string }>(
    "select public.arena_friend_request($1, null) as v",
    [friendCode(ben).toLowerCase()],
  );
  expect(sent.rows[0].v).toBe("requested");
  expect((await list(ana)).outgoing.map((r) => r.id)).toEqual([ben]);
  expect((await list(ben)).incoming.map((r) => r.id)).toEqual([ana]);
  await as(ben);
  await db.query("select public.arena_friend_respond($1, true)", [ana]);
  expect((await list(ana)).friends.map((f) => f.name)).toEqual(["Ben"]);
  expect((await list(ben)).friends.map((f) => f.name)).toEqual(["Ana"]);
  expect((await list(ben)).incoming).toEqual([]);
  await as(ana);
  const again = await db.query<{ v: string }>(
    "select public.arena_friend_request(null, $1) as v",
    [ben],
  );
  expect(again.rows[0].v).toBe("already");
});

it("asking someone who already asked you makes you friends", async () => {
  await as(cy);
  await db.query("select public.arena_friend_request(null, $1)", [ana]);
  await as(ana);
  const both = await db.query<{ v: string }>(
    "select public.arena_friend_request(null, $1) as v",
    [cy],
  );
  expect(both.rows[0].v).toBe("friends");
  expect((await list(cy)).friends.map((f) => f.name)).toEqual(["Ana"]);
});

it("removes friends, refuses yourself and unknown codes, and keeps tables private", async () => {
  await as(ana);
  await db.query("select public.arena_friend_remove($1)", [cy]);
  expect((await list(ana)).friends.map((f) => f.name)).toEqual(["Ben"]);
  await expect(
    db.query("select public.arena_friend_request($1, null)", [friendCode(ana)]),
  ).rejects.toThrow("own friend code");
  await expect(
    db.query("select public.arena_friend_request('FFFFFFFF', null)"),
  ).rejects.toThrow("No player");
  await expect(db.query("select * from public.arena_friendships")).rejects.toThrow();
  await as(ben);
  await expect(
    db.query("select public.arena_friend_respond($1, true)", [cy]),
  ).rejects.toThrow("gone");
});
