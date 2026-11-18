import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

// Players' own pictures (migration 20261119110000): who may set one, what
// the database takes, reports hiding a picture at three reporters, and an
// admin keeping or removing it.
let db: PGlite;
const ids = {
  ana: "00000000-0000-4000-8000-0000000033a1",
  ben: "00000000-0000-4000-8000-0000000033a2",
  cy: "00000000-0000-4000-8000-0000000033a3",
  dee: "00000000-0000-4000-8000-0000000033a4",
  guest: "00000000-0000-4000-8000-0000000033a5",
  boss: "00000000-0000-4000-8000-0000000033a6",
};
async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function service() {
  await db.exec("reset role;set role service_role;");
}
/** A tiny but well-formed-looking WebP / JPEG (the magic bytes the database checks). */
const webp = () =>
  Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("WEBPVP8 "),
    Buffer.alloc(200, 7),
  ]).toString("base64");
const jpeg = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.alloc(200, 9),
  ]).toString("base64");
const setPhoto = (image: string, type = "image/webp") =>
  db.query<{ v: string }>("select public.arena_set_avatar_photo($1,$2) v", [
    image,
    type,
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
    `reset role;insert into auth.users values ${Object.entries(ids)
      .map(([n, id]) => `('${id}','{"display_name":"${n}"}')`)
      .join(",")}`,
  );
  for (const id of Object.values(ids)) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;update public.arena_profiles set guest=true where id='${ids.guest}';insert into public.arena_admins values('${ids.boss}')`,
  );
}, 120000);
afterAll(async () => db.close());

const avatarOf = async (id: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ avatar: string | null }>(
      "select avatar from public.arena_profiles where id=$1",
      [id],
    )
  ).rows[0].avatar;
};
const served = async (photo: string) => {
  await service();
  return (
    await db.query<{ v: { type: string; data: string } | null }>(
      "select public.arena_avatar_photo($1) v",
      [photo],
    )
  ).rows[0].v;
};

let anaPhoto = "";
it("a player sets a picture; it becomes their avatar and anyone can be served it", async () => {
  await as(ids.ana);
  const v = (await setPhoto(webp())).rows[0].v;
  expect(v).toMatch(/^photo:[0-9a-f-]{36}$/);
  anaPhoto = v.slice(6);
  expect(await avatarOf(ids.ana)).toBe(v);
  expect((await served(anaPhoto))?.type).toBe("image/webp");
  // A new picture replaces it: a new id, the old one gone.
  await as(ids.ana);
  const next = (await setPhoto(jpeg(), "image/jpeg")).rows[0].v.slice(6);
  expect(next).not.toBe(anaPhoto);
  expect(await served(anaPhoto)).toBeNull();
  anaPhoto = next;
});

it("refuses guests, odd files and big ones", async () => {
  await as(ids.guest);
  await expect(setPhoto(webp())).rejects.toThrow(/Make an account/);
  await as(ids.ben);
  await expect(setPhoto(webp(), "image/png")).rejects.toThrow(/WebP or JPEG/);
  // Says WebP, is a JPEG: refused.
  await expect(setPhoto(jpeg(), "image/webp")).rejects.toThrow(
    /could not be read/,
  );
  await expect(setPhoto("not base64 !!!")).rejects.toThrow();
  const big = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.alloc(70000),
  ]).toString("base64");
  await expect(setPhoto(big, "image/jpeg")).rejects.toThrow(/too large/);
});

it("keeps the pictures away from players: only the server reads them", async () => {
  await as(ids.ben);
  await expect(
    db.query("select * from public.arena_avatar_photos"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_avatar_photo($1)", [anaPhoto]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_admin_avatar_photo($1, false)", [anaPhoto]),
  ).rejects.toThrow();
});

it("three reporters hide a picture until an admin keeps it", async () => {
  await as(ids.ana);
  await expect(
    db.query("select public.arena_report_avatar_photo($1,'')", [anaPhoto]),
  ).rejects.toThrow(/your own/);
  for (const who of [ids.ben, ids.ben, ids.cy]) {
    await as(who);
    await db.query("select public.arena_report_avatar_photo($1,'')", [
      anaPhoto,
    ]);
  }
  // Ben twice counts once: two reporters, still shown.
  expect(await served(anaPhoto)).not.toBeNull();
  await as(ids.dee);
  const r = await db.query<{ v: { hidden: boolean } }>(
    "select public.arena_report_avatar_photo($1,'rude') v",
    [anaPhoto],
  );
  expect(r.rows[0].v.hidden).toBe(true);
  expect(await served(anaPhoto)).toBeNull();
  // The admins have a report for each reporter.
  await db.exec("reset role");
  const reports = await db.query(
    "select 1 from public.arena_reports where context->>'avatarPhoto'=$1",
    [anaPhoto],
  );
  expect(reports.rows).toHaveLength(3);
  // An admin sees it, and keeps it: shown again.
  await as(ids.boss);
  const seen = await db.query<{ v: { hidden: boolean } }>(
    "select public.arena_admin_avatar_photo_image($1) v",
    [anaPhoto],
  );
  expect(seen.rows[0].v.hidden).toBe(true);
  await db.query("select public.arena_admin_avatar_photo($1, true)", [
    anaPhoto,
  ]);
  expect(await served(anaPhoto)).not.toBeNull();
});

it("an admin removes a picture: the player is back on the default and waits 7 days", async () => {
  await as(ids.boss);
  const owner = await db.query<{ v: string }>(
    "select public.arena_admin_avatar_photo($1, false) v",
    [anaPhoto],
  );
  expect(owner.rows[0].v).toBe(ids.ana);
  expect(await served(anaPhoto)).toBeNull();
  expect(await avatarOf(ids.ana)).toBeNull();
  await as(ids.ana);
  await expect(setPhoto(webp())).rejects.toThrow(/removed/);
  // The library is still theirs.
  await db.query("select public.arena_set_avatar('ea-avatar-005')");
  expect(await avatarOf(ids.ana)).toBe("ea-avatar-005");
});
