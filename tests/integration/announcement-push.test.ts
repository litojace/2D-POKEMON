import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Announcements as notifications (migration 20261122140000): which devices
// want game news, set only for the player's own device, service role only.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000044a1";
const bo = "00000000-0000-4000-8000-0000000044a2";
const cy = "00000000-0000-4000-8000-0000000044a3";
const ep = (n: string) => `https://fcm.googleapis.com/fcm/send/${n}`;
async function service<T = any>(sql: string, args: unknown[] = []) {
  await db.exec("reset role;set role service_role;");
  const r = await db.query<{ r: T }>(`select ${sql} as r`, args);
  await db.exec("reset role");
  return r.rows[0].r;
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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${bo}','{"display_name":"Bo"}'),('${cy}','{"display_name":"Cy"}')`,
  );
  for (const id of [ana, bo, cy]) {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
    );
    await db.query("select public.arena_me()");
  }
  for (const [player, n] of [
    [ana, "a1"],
    [ana, "a2"],
    [bo, "b1"],
    [cy, "c1"],
  ])
    await service(
      "public.arena_push_save($1, $2, 'BNcRdreALRFXTkOO', 'tBHItJI5')",
      [player, ep(n)],
    );
}, 120000);
afterAll(async () => db.close());

it("sends game news to every device by default, a page at a time", async () => {
  expect(await service("public.arena_push_news_count()")).toBe(4);
  const first = await service("public.arena_push_news_page('', 3)");
  expect(first.map((d: any) => d.endpoint)).toEqual([
    ep("a1"),
    ep("a2"),
    ep("b1"),
  ]);
  expect(first[0]).toHaveProperty("p256dh");
  const next = await service("public.arena_push_news_page($1, 3)", [ep("b1")]);
  expect(next.map((d: any) => d.endpoint)).toEqual([ep("c1")]);
});

it("lets a player turn game news off on their own device only", async () => {
  expect(
    await service("public.arena_push_set_news($1, $2, false)", [ana, ep("a2")]),
  ).toBe(true);
  // Not Bo's device: nothing changes.
  expect(
    await service("public.arena_push_set_news($1, $2, false)", [bo, ep("c1")]),
  ).toBe(false);
  const page = await service("public.arena_push_news_page('', 10)");
  expect(page.map((d: any) => d.endpoint)).toEqual([
    ep("a1"),
    ep("b1"),
    ep("c1"),
  ]);
  // Saving the device again (turning notifications on again) keeps the choice.
  await service(
    "public.arena_push_save($1, $2, 'BNcRdreALRFXTkOO', 'tBHItJI5')",
    [ana, ep("a2")],
  );
  expect(await service("public.arena_push_news_count()")).toBe(3);
});

it("leaves out suspended players, and is for the game server only", async () => {
  await db.exec(
    `reset role;update public.arena_profiles set suspended = true where id = '${cy}'`,
  );
  const page = await service("public.arena_push_news_page('', 10)");
  expect(page.map((d: any) => d.endpoint)).toEqual([ep("a1"), ep("b1")]);
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${ana}',false);set role authenticated;`,
  );
  await expect(
    db.query("select public.arena_push_news_page('', 10)"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_push_news_count()"),
  ).rejects.toThrow();
  await db.exec("reset role");
});
