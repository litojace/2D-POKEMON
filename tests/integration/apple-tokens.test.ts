import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Migration 111: Apple refresh tokens, readable and writable only by the
// game server's service key, and gone with the account.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000030a1";
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
const service = () => db.exec("reset role;set role service_role");
const save = (token: string) =>
  db.query(
    "select public.arena_apple_token_save($1,'sub-1','com.example.arena',$2)",
    [ana, token],
  );
const tokenOf = async () =>
  (
    await db.query<{ v: unknown }>(
      "select public.arena_apple_token_of($1) as v",
      [ana],
    )
  ).rows[0].v;

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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}')`,
  );
  await as(ana);
  await db.query("select public.arena_me()");
}, 120000);
afterAll(async () => db.close());

it("lets the server keep and read a token, replacing an older one", async () => {
  await service();
  expect(await tokenOf()).toBeNull();
  await save("refresh-1");
  await save("refresh-2");
  expect(await tokenOf()).toEqual({
    sub: "sub-1",
    clientId: "com.example.arena",
    refreshToken: "refresh-2",
  });
});

it("never lets players read or write tokens, not even their own", async () => {
  await as(ana);
  await expect(tokenOf()).rejects.toThrow();
  await expect(save("mine")).rejects.toThrow();
  await expect(
    db.query("select * from public.arena_apple_tokens"),
  ).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(tokenOf()).rejects.toThrow();
});

it("goes with the account", async () => {
  await as(ana);
  await db.query("select public.arena_delete_my_account()");
  await db.exec("reset role");
  expect(
    (await db.query("select 1 from public.arena_apple_tokens")).rows,
  ).toEqual([]);
});
