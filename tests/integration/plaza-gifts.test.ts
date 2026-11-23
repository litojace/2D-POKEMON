import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PLAZA_GIFT, plazaGiftsLeft } from "../../packages/shared/src/plaza";

// Migration 20261123120000_plaza_gifts: gift boxes in place of the treats.
// PLAZA_GIFT.freeDaily a Pacific day, one more per Plaza quest paid today,
// one per Rare or Legendary fish caught today (at most PLAZA_GIFT.fishDaily);
// each toss takes one, once per request.
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000461",
  ben = "00000000-0000-4000-8000-000000000462",
  banned = "00000000-0000-4000-8000-000000000463";
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
const toss = async (id: string, ref = randomUUID()) => {
  await login(id);
  return (
    await db.query<{ v: any }>("select public.arena_plaza_gift($1::uuid) v", [
      ref,
    ])
  ).rows[0].v;
};
const gifts = async (id: string) => {
  await login(id);
  return (await db.query<{ v: any }>("select public.arena_plaza() v")).rows[0].v
    .gifts as number;
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
  for (const [id, name] of [
    [ana, "Ana"],
    [ben, "Ben"],
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

it("starts the day with the free boxes, as in the shared rules", async () => {
  expect(await gifts(ana)).toBe(PLAZA_GIFT.freeDaily);
  expect(plazaGiftsLeft(0, 0, 0)).toBe(PLAZA_GIFT.freeDaily);
});

it("takes one box a toss, once per request, and stops at none", async () => {
  const ref = randomUUID();
  expect(await toss(ana, ref)).toMatchObject({
    ok: true,
    left: PLAZA_GIFT.freeDaily - 1,
  });
  // The same request again (a retry) takes nothing more.
  expect(await toss(ana, ref)).toMatchObject({
    ok: true,
    left: PLAZA_GIFT.freeDaily - 1,
  });
  for (let i = 1; i < PLAZA_GIFT.freeDaily; i++)
    expect((await toss(ana)).ok).toBe(true);
  const none = await toss(ana);
  expect(none).toMatchObject({ ok: false, left: 0 });
  expect(none.error).toMatch(/No gift boxes left/);
  expect(await gifts(ana)).toBe(0);
});

it("earns a box for each Plaza quest done and each rare fish, rare fish capped", async () => {
  // A quest done (the photo): one more box.
  await record({ player: ben, kind: "photo" });
  expect(await gifts(ben)).toBe(PLAZA_GIFT.freeDaily + 1);
  // A common fish: none. Rare and Legendary ones: one each, at most fishDaily.
  await record({ player: ben, kind: "fish", ref: "reed-perch" });
  expect(await gifts(ben)).toBe(PLAZA_GIFT.freeDaily + 1);
  for (let i = 0; i < PLAZA_GIFT.fishDaily + 2; i++)
    await record({ player: ben, kind: "fish", ref: "volt-shiner", gift: true });
  expect(await gifts(ben)).toBe(
    PLAZA_GIFT.freeDaily + 1 + PLAZA_GIFT.fishDaily,
  );
  expect(plazaGiftsLeft(1, PLAZA_GIFT.fishDaily + 2, 0)).toBe(
    PLAZA_GIFT.freeDaily + 1 + PLAZA_GIFT.fishDaily,
  );
});

it("starts fresh the next day", async () => {
  await db.exec(
    `reset role;update public.arena_plaza_days set day = day - 1 where player_id = '${ana}'`,
  );
  expect(await gifts(ana)).toBe(PLAZA_GIFT.freeDaily);
});

it("refuses players who are suspended or signed out", async () => {
  await expect(toss(banned)).rejects.toThrow(/Not signed in/);
  await db.exec("reset role;set role authenticated");
  await db.exec("select set_config('request.jwt.claim.sub','',false)");
  await expect(
    db.query("select public.arena_plaza_gift($1::uuid)", [randomUUID()]),
  ).rejects.toThrow(/Not signed in/);
});
