import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { AVATAR_IDS } from "../../packages/shared/src/avatars";

// Player avatars (migration 20261119100000): a player sets their own avatar
// from the library, reads it back, and their friends see it.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000022a1";
const ben = "00000000-0000-4000-8000-0000000022a2";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}

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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${ben}','{"display_name":"Ben"}')`,
  );
  for (const id of [ana, ben]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_friendships(a,b) values('${ana}','${ben}')`,
  );
}, 120000);
afterAll(async () => db.close());

const mine = async () =>
  (await db.query<{ v: string | null }>("select public.arena_my_avatar() v"))
    .rows[0].v;

it("starts with no avatar; a player sets and reads their own", async () => {
  await as(ana);
  expect(await mine()).toBeNull();
  await db.query("select public.arena_set_avatar('ea-avatar-027')");
  expect(await mine()).toBe("ea-avatar-027");
  await as(ben);
  expect(await mine()).toBeNull();
});

it("takes only library avatars (the same 77 ids as avatars.ts)", async () => {
  // 52 first (20261119100000), the second batch's 25 since 20261119160000.
  expect(AVATAR_IDS).toHaveLength(77);
  await as(ana);
  for (const id of AVATAR_IDS)
    await db.query("select public.arena_set_avatar($1)", [id]);
  for (const bad of ["ea-avatar-078", "ea-avatar-000", "x", "", null])
    await expect(
      db.query("select public.arena_set_avatar($1)", [bad]),
    ).rejects.toThrow();
  await db.query("select public.arena_set_avatar('ea-avatar-012')");
});

it("shows a friend's avatar in the friends list", async () => {
  await as(ana);
  await db.query("select public.arena_set_avatar('ea-avatar-040')");
  await as(ben);
  const list = (
    await db.query<{
      v: { friends: { name: string; avatar: string | null }[] };
    }>("select public.arena_friends() v")
  ).rows[0].v;
  expect(list.friends.find((f) => f.name === "Ana")?.avatar).toBe(
    "ea-avatar-040",
  );
});

it("keeps the writes to the player's own row", async () => {
  await as(ben);
  await expect(
    db.query("update public.arena_profiles set avatar='ea-avatar-002'"),
  ).rejects.toThrow();
  await db.exec("reset role");
  const r = await db.query<{ avatar: string | null }>(
    "select avatar from public.arena_profiles where id=$1",
    [ana],
  );
  expect(r.rows[0].avatar).toBe("ea-avatar-040");
});
