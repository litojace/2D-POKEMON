import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  NAME_PART_WORDS,
  NAME_WHOLE_WORDS,
  nameAllowed,
} from "../../packages/shared/src/name-filter";

// Migration 110: the database refuses names on the list, and the client's
// copy (packages/shared/src/name-filter.ts) agrees with it.
let db: PGlite;
const ana = "00000000-0000-4000-8000-0000000010a1";
const rude = "00000000-0000-4000-8000-0000000010a2";
const admin = "00000000-0000-4000-8000-0000000010a3";
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
    `reset role;insert into auth.users values('${ana}','{"display_name":"Ana"}'),('${rude}','{"display_name":"Big Sh1t"}'),('${admin}','{"display_name":"Boss"}')`,
  );
  for (const id of [ana, rude, admin]) {
    await as(id);
    await db.query("select public.arena_me()");
  }
  await db.exec(
    `reset role;insert into public.arena_admins values('${admin}')`,
  );
}, 120000);
afterAll(async () => db.close());

const allowedInDb = async (name: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ ok: boolean }>(
      "select public.arena_name_allowed($1) as ok",
      [name],
    )
  ).rows[0].ok;
};
const nameOf = async (id: string) => {
  await db.exec("reset role");
  return (
    await db.query<{ n: string }>(
      "select display_name as n from public.arena_profiles where id=$1",
      [id],
    )
  ).rows[0].n;
};

it("keeps the same words as the client's copy", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ word: string; whole: boolean }>(
      "select word, whole from public.arena_name_words order by word",
    )
  ).rows;
  expect(rows.filter((r) => !r.whole).map((r) => r.word)).toEqual(
    [...NAME_PART_WORDS].sort(),
  );
  expect(rows.filter((r) => r.whole).map((r) => r.word)).toEqual(
    [...NAME_WHOLE_WORDS].sort(),
  );
});

const SAMPLES: [string, boolean][] = [
  ["Ana", true],
  ["Nova Star", true],
  ["Bénédicte", true],
  ["ClassAct", true],
  ["Peacock", true],
  ["Grape Juice", true],
  ["The Therapist", true],
  ["Nazir", true],
  ["Assassin", true],
  ["Dickens", true],
  ["Hancock 42", true],
  ["Badminton Ace", true],
  ["Cocktail", true],
  ["Shadopus Main", true],
  ["fuck", false],
  ["FUCK", false],
  ["f.u c-k", false],
  ["Fü¢k", true], // ¢ isn't a look-alike: allowed (only the listed ones are read)
  ["Sh1t Happens", false],
  ["$hitlord", false],
  ["b1tch", false],
  ["ass", false],
  ["Big Ass", false],
  ["Dick Moves", false],
  ["cocks", false],
  ["4dmin", false],
  ["Admin Team", false],
  ["Official", false],
  ["Element Arena", false],
  ["N4zi", false],
  ["xX_Hitler_Xx", false],
];

it("refuses and allows the same names in the database and in the client", async () => {
  for (const [name, ok] of SAMPLES) {
    expect([name, nameAllowed(name)]).toEqual([name, ok]);
    expect([name, await allowedInDb(name)]).toEqual([name, ok]);
  }
});

it("turns a refused sign-up name into Trainer", async () => {
  expect(await nameOf(rude)).toBe("Trainer");
  expect(await nameOf(ana)).toBe("Ana");
});

it("refuses a name change to a refused name, and allows a fine one", async () => {
  await as(ana);
  await expect(
    db.query("select public.arena_change_name('Dick Moves')"),
  ).rejects.toThrow("That name isn't allowed");
  expect(await nameOf(ana)).toBe("Ana");
  await db.query("select public.arena_change_name('Nova Star')");
  expect(await nameOf(ana)).toBe("Nova Star");
});

it("refuses an admin's rename too, and leaves old names alone otherwise", async () => {
  await as(admin);
  await expect(
    db.query("select public.arena_admin_update_player($1,'Sh1t',false)", [ana]),
  ).rejects.toThrow("That name isn't allowed");
  // A name from before the filter stays, and the admin can still suspend.
  await db.exec(
    `reset role;alter table public.arena_profiles disable trigger arena_profiles_name_filter;update public.arena_profiles set display_name='Old Shit' where id='${rude}';alter table public.arena_profiles enable trigger arena_profiles_name_filter;`,
  );
  await as(admin);
  await db.query(
    "select public.arena_admin_update_player($1,'Old Shit',true)",
    [rude],
  );
  expect(await nameOf(rude)).toBe("Old Shit");
});
