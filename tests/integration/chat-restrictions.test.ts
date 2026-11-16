import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Chat restrictions (migration 20261115200000): an admin stops a player
// typing in chat for a while; the game server reads until when.
let db: PGlite;
const rude = "00000000-0000-4000-8000-0000000011a1";
const ana = "00000000-0000-4000-8000-0000000011a2";
const admin = "00000000-0000-4000-8000-0000000011a3";
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
    `reset role;insert into auth.users values('${rude}','{"display_name":"Loud"}'),('${ana}','{"display_name":"Ana"}'),('${admin}','{"display_name":"Boss"}')`,
  );
  for (const id of [rude, ana, admin]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 120000);
afterAll(async () => db.close());

const stoppedUntil = async (id: string) => {
  await db.exec("reset role;set role service_role;");
  const r = await db.query<{ u: string | null }>(
    "select public.arena_chat_stopped_until($1) as u",
    [id],
  );
  await db.exec("reset role");
  return r.rows[0].u;
};

it("lets an admin stop a player chatting, and lift it", async () => {
  expect(await stoppedUntil(rude)).toBeNull();
  await as(admin);
  await db.query("select public.arena_admin_chat_ban($1, 24, 'Insults')", [
    rude,
  ]);
  const until = await stoppedUntil(rude);
  expect(until).not.toBeNull();
  const hours = (new Date(until!).getTime() - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23.9);
  expect(hours).toBeLessThanOrEqual(24);
  expect(await stoppedUntil(ana)).toBeNull();
  await as(admin);
  await db.query("select public.arena_admin_chat_ban($1, 0, null)", [rude]);
  expect(await stoppedUntil(rude)).toBeNull();
});

it("refuses players who aren't admins, and odd hours", async () => {
  await as(ana);
  await expect(
    db.query("select public.arena_admin_chat_ban($1, 24, 'x')", [rude]),
  ).rejects.toThrow();
  await as(admin);
  await expect(
    db.query("select public.arena_admin_chat_ban($1, -1, 'x')", [rude]),
  ).rejects.toThrow("Choose 0 to 8760 hours");
  await expect(
    db.query("select public.arena_admin_chat_ban($1, 1, 'x')", [
      "00000000-0000-4000-8000-0000000011ff",
    ]),
  ).rejects.toThrow("Player not found");
});

it("keeps the table and the server's read away from players", async () => {
  await as(ana);
  await expect(
    db.query("select * from public.arena_chat_restrictions"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_chat_stopped_until($1)", [ana]),
  ).rejects.toThrow();
});
