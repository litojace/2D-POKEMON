import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Friends' messages (migration 20261115230000): friends only, the last 200
// per pair, unread counts, gone with an account.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000012a1";
const bo = "00000000-0000-4000-8000-0000000012a2";
const cy = "00000000-0000-4000-8000-0000000012a3";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const server = async <T>(sql: string, args: unknown[] = []) => {
  await db.exec("reset role;set role service_role;");
  const r = await db.query<{ v: T }>(sql, args);
  await db.exec("reset role");
  return r.rows[0]?.v;
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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${bo}','{"display_name":"Bo"}'),('${cy}','{"display_name":"Cy"}')`,
  );
  for (const id of [ana, bo, cy]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  // Ana and Bo are friends; Cy is nobody's.
  await db.exec(
    `reset role;insert into public.arena_friendships(a,b) values(least('${ana}'::uuid,'${bo}'::uuid),greatest('${ana}'::uuid,'${bo}'::uuid))`,
  );
}, 120000);
afterAll(async () => db.close());

it("keeps messages between friends, oldest first, with unread counts", async () => {
  await server("select public.arena_dm_save($1,$2,'hi Bo',null) as v", [
    ana,
    bo,
  ]);
  await server("select public.arena_dm_save($1,$2,null,'gg') as v", [ana, bo]);
  const history = await server<
    { from: string; text: string | null; quick: string | null }[]
  >("select public.arena_dm_history($1,$2,50) as v", [bo, ana]);
  expect(history!.map((m) => [m.from, m.text, m.quick])).toEqual([
    [ana, "hi Bo", null],
    [ana, null, "gg"],
  ]);
  expect(await server("select public.arena_dm_unread($1) as v", [bo])).toEqual({
    [ana]: 2,
  });
  expect(await server("select public.arena_dm_unread($1) as v", [ana])).toEqual(
    {},
  );
  await server("select public.arena_dm_read($1,$2) as v", [bo, ana]);
  expect(await server("select public.arena_dm_unread($1) as v", [bo])).toEqual(
    {},
  );
});

it("refuses players who aren't friends", async () => {
  await db.exec("reset role;set role service_role;");
  await expect(
    db.query("select public.arena_dm_save($1,$2,'hey',null)", [cy, ana]),
  ).rejects.toThrow("Only friends can message");
  await db.exec("reset role");
});

it("keeps the last 200 of a pair", async () => {
  await db.exec("reset role;set role service_role;");
  for (let i = 0; i < 210; i++)
    await db.query("select public.arena_dm_save($1,$2,$3,null)", [
      bo,
      ana,
      `m${i}`,
    ]);
  await db.exec("reset role");
  const n = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_chat_dms",
    )
  ).rows[0].n;
  expect(n).toBe(200);
  const last = await server<{ text: string }[]>(
    "select public.arena_dm_history($1,$2,200) as v",
    [ana, bo],
  );
  expect(last!.at(-1)!.text).toBe("m209");
  expect(last![0].text).toBe("m10");
});

it("is the server's only: players can't read or call it", async () => {
  await as(ana);
  await expect(
    db.query("select * from public.arena_chat_dms"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_dm_history($1,$2,10)", [ana, bo]),
  ).rejects.toThrow();
});

it("goes with an account", async () => {
  await db.exec(
    `reset role;delete from public.arena_profiles where id='${bo}'`,
  );
  const n = (
    await db.query<{ n: number }>(
      "select count(*)::int as n from public.arena_chat_dms",
    )
  ).rows[0].n;
  expect(n).toBe(0);
});
