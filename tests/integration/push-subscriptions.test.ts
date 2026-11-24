import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Push subscriptions (migration 20261116100000): the game server's only,
// a device moves to whoever turned it on last, 10 per player, gone with the
// account.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000013a1";
const bo = "00000000-0000-4000-8000-0000000013a2";
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
const save = (player: string, n: number) =>
  server("select public.arena_push_save($1,$2,$3,$4)::text as v", [
    player,
    `https://push.example/send/${n}`,
    `key-p256dh-${n}`,
    `auth-${n}`,
  ]);
const list = (player: string) =>
  server<{ endpoint: string }[]>("select public.arena_push_list($1) as v", [
    player,
  ]);

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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${bo}','{"display_name":"Bo"}')`,
  );
  for (const id of [ana, bo]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
}, 120000);
afterAll(async () => db.close());

it("keeps a player's devices, newest first, and forgets one on request", async () => {
  await save(ana, 1);
  await save(ana, 2);
  expect((await list(ana))!.map((s) => s.endpoint)).toEqual([
    "https://push.example/send/2",
    "https://push.example/send/1",
  ]);
  await server("select public.arena_push_remove($1)::text as v", [
    "https://push.example/send/1",
  ]);
  expect((await list(ana))!.map((s) => s.endpoint)).toEqual([
    "https://push.example/send/2",
  ]);
});

it("a device moves to whoever turned it on last", async () => {
  await save(bo, 2);
  expect(await list(ana)).toEqual([]);
  expect((await list(bo))!.map((s) => s.endpoint)).toEqual([
    "https://push.example/send/2",
  ]);
});

it("keeps at most 10 devices a player", async () => {
  for (let n = 10; n < 23; n++) await save(ana, n);
  const kept = (await list(ana))!.map((s) => s.endpoint);
  expect(kept).toHaveLength(10);
  expect(kept[0]).toBe("https://push.example/send/22");
});

it("players can't read or call any of it themselves", async () => {
  await as(ana);
  await expect(
    db.query("select * from public.arena_push_subscriptions"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_push_list($1)", [ana]),
  ).rejects.toThrow();
  await db.exec("reset role");
});

it("deleting the account deletes its devices", async () => {
  await db.exec(
    `reset role;delete from public.arena_profiles where id='${ana}'`,
  );
  expect(await list(ana)).toEqual([]);
  expect(await list(bo)).toHaveLength(1);
});
