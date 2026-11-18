import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Players' own pictures (migrations 20261119110000 and 20261119120000):
// the private Storage bucket, who may keep a picture (the game server saves
// it with the service role after the upload), reports hiding a picture at
// three reporters, and an admin keeping or removing it. The files
// themselves are in Storage: tests/integration/avatar-photo-store.test.ts.
let db: PGlite;
const ids = {
  ana: "00000000-0000-4000-8000-0000000033a1",
  ben: "00000000-0000-4000-8000-0000000033a2",
  cy: "00000000-0000-4000-8000-0000000033a3",
  dee: "00000000-0000-4000-8000-0000000033a4",
  guest: "00000000-0000-4000-8000-0000000033a5",
  boss: "00000000-0000-4000-8000-0000000033a6",
  sus: "00000000-0000-4000-8000-0000000033a7",
};
const SETUP = `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`;
// The two Storage tables the migration touches, as on Supabase (in part).
const STORAGE = `create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);`;
const migrations = async () =>
  (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

async function as(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function service() {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role;",
  );
}
let n = 0;
const newId = () => `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
/** What the game server does after putting the file in the bucket. */
const save = async (player: string, type = "image/webp", id = newId()) => {
  await service();
  return {
    id,
    ...(
      await db.query<{ v: { avatar: string; old: string | null } }>(
        "select public.arena_save_avatar_photo($1,$2,$3) v",
        [player, id, type],
      )
    ).rows[0].v,
  };
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SETUP + STORAGE);
  for (const f of await migrations())
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
    `reset role;update public.arena_profiles set guest=true where id='${ids.guest}';update public.arena_profiles set suspended=true where id='${ids.sus}';insert into public.arena_admins values('${ids.boss}')`,
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
    await db.query<{ v: { type: string; path: string } | null }>(
      "select public.arena_avatar_photo($1) v",
      [photo],
    )
  ).rows[0].v;
};

it("makes a private bucket for WebP and JPEG files of 64 KB at most", async () => {
  await db.exec("reset role");
  const b = await db.query("select * from storage.buckets");
  expect(b.rows).toEqual([
    {
      id: "avatar-photos",
      name: "avatar-photos",
      public: false,
      file_size_limit: 65536,
      allowed_mime_types: ["image/webp", "image/jpeg"],
    },
  ]);
  // The bytes left the database.
  const cols = await db.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema='public' and table_name='arena_avatar_photos' order by 1",
  );
  expect(cols.rows.map((r) => r.column_name)).toEqual([
    "content_type",
    "created_at",
    "hidden",
    "id",
    "path",
    "user_id",
  ]);
});

let anaPhoto = "";
it("the server keeps a player's picture; it becomes their avatar and its file is served", async () => {
  const first = await save(ids.ana);
  expect(first.avatar).toBe(`photo:${first.id}`);
  expect(first.old).toBeNull();
  expect(await avatarOf(ids.ana)).toBe(first.avatar);
  expect(await served(first.id)).toEqual({
    type: "image/webp",
    path: `photos/${first.id}.webp`,
  });
  // A new picture replaces it: a new id, the old one gone, its file named
  // for the server to delete.
  const next = await save(ids.ana, "image/jpeg");
  expect(next.old).toBe(`photos/${first.id}.webp`);
  expect(await served(first.id)).toBeNull();
  expect((await served(next.id))?.path).toBe(`photos/${next.id}.jpg`);
  anaPhoto = next.id;
  await service();
  const path = await db.query<{ v: string }>(
    "select public.arena_avatar_photo_path_of($1) v",
    [ids.ana],
  );
  expect(path.rows[0].v).toBe(`photos/${next.id}.jpg`);
});

it("refuses guests, suspended players, unknown players and other types", async () => {
  await expect(save(ids.guest)).rejects.toThrow(/Make an account/);
  await expect(save(ids.sus)).rejects.toThrow(/Login required/);
  await expect(save("00000000-0000-4000-8000-00000000ffff")).rejects.toThrow(
    /Login required/,
  );
  await expect(save(ids.ben, "image/png")).rejects.toThrow(/WebP or JPEG/);
  expect(await avatarOf(ids.ben)).toBeNull();
});

it("keeps the pictures away from players: only the server saves and reads them", async () => {
  await as(ids.ben);
  await expect(
    db.query("select * from public.arena_avatar_photos"),
  ).rejects.toThrow();
  // A player can't record a file of their choosing as their picture.
  await expect(
    db.query("select public.arena_save_avatar_photo($1,$2,'image/webp')", [
      ids.ben,
      newId(),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_avatar_photo($1)", [anaPhoto]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_avatar_photo_path_of($1)", [ids.ana]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.arena_admin_avatar_photo($1, false)", [anaPhoto]),
  ).rejects.toThrow();
  // The old way in, the bytes through the API, is gone.
  await db.exec("reset role");
  const old = await db.query(
    "select 1 from pg_proc where proname='arena_set_avatar_photo'",
  );
  expect(old.rows).toHaveLength(0);
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
  // An admin sees it (its file), and keeps it: shown again.
  await as(ids.boss);
  const seen = await db.query<{ v: { hidden: boolean; path: string } }>(
    "select public.arena_admin_avatar_photo_image($1) v",
    [anaPhoto],
  );
  expect(seen.rows[0].v).toMatchObject({
    hidden: true,
    type: "image/jpeg",
    path: `photos/${anaPhoto}.jpg`,
  });
  const kept = await db.query<{ v: unknown }>(
    "select public.arena_admin_avatar_photo($1, true) v",
    [anaPhoto],
  );
  expect(kept.rows[0].v).toEqual({ owner: ids.ana, path: null });
  expect(await served(anaPhoto)).not.toBeNull();
});

it("an admin removes a picture: its file is named for deleting, the player is back on the default and waits 7 days", async () => {
  await as(ids.boss);
  const removed = await db.query<{ v: unknown }>(
    "select public.arena_admin_avatar_photo($1, false) v",
    [anaPhoto],
  );
  expect(removed.rows[0].v).toEqual({
    owner: ids.ana,
    path: `photos/${anaPhoto}.jpg`,
  });
  expect(await served(anaPhoto)).toBeNull();
  expect(await avatarOf(ids.ana)).toBeNull();
  await expect(save(ids.ana)).rejects.toThrow(/removed/);
  // The library is still theirs.
  await as(ids.ana);
  await db.query("select public.arena_set_avatar('ea-avatar-005')");
  expect(await avatarOf(ids.ana)).toBe("ea-avatar-005");
});

describe("pictures the database kept before Storage", () => {
  // If 20261119110000 reached production on its own and players added
  // pictures, 20261119120000 must not drop them: it waits for their files.
  let old: PGlite;
  const photo = "20000000-0000-4000-8000-000000000001";
  afterAll(async () => old?.close());
  it("stops until each picture is in the bucket, then drops the bytes", async () => {
    old = new PGlite();
    await old.exec(SETUP + STORAGE);
    const files = await migrations();
    const storage = "20261119120000_avatar_photo_storage.sql";
    for (const f of files.slice(0, files.indexOf(storage)))
      await old.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await old.exec(
      `insert into auth.users values ('${ids.ana}','{"display_name":"ana"}');select set_config('request.jwt.claim.sub','${ids.ana}',false);set role authenticated;select public.arena_me();reset role;insert into public.arena_avatar_photos(id,user_id,image,content_type) values ('${photo}','${ids.ana}',decode(repeat('ab',100),'hex'),'image/webp')`,
    );
    const sql = await readFile("supabase/migrations/" + storage, "utf8");
    await expect(old.exec(sql)).rejects.toThrow(
      /not in the avatar-photos bucket/,
    );
    await old.exec("rollback");
    // Nothing of it was applied.
    const still = await old.query(
      "select image is not null as kept from public.arena_avatar_photos",
    );
    expect(still.rows).toEqual([{ kept: true }]);
    // scripts/avatar-photos-to-storage.mjs copied the file:
    await old.exec(
      `insert into storage.objects(bucket_id,name) values ('avatar-photos','photos/${photo}.webp')`,
    );
    await old.exec(sql);
    const moved = await old.query(
      "select id, path from public.arena_avatar_photos",
    );
    expect(moved.rows).toEqual([{ id: photo, path: `photos/${photo}.webp` }]);
  }, 120000);
});
