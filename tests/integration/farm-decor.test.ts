import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  CROPS,
  DECOR_AREA,
  DECOR_SETS,
  FARM_DECOR,
  charmBonus,
  decorCap,
  decorCharm,
  decorFits,
  decorSeasonsOn,
  type FarmDecorPiece,
} from "../../packages/shared/src/farm";

// Decorations and Charm (migration 048), standing anywhere since
// 20261116120000_farm_free_decor.sql; groups, paths, seasons and
// collections since 20261117120000_farm_decor_catalog.sql.
const FREE = "20261116120000_farm_free_decor.sql";
let db: PGlite;
const player = "00000000-0000-4000-8000-000000000481";
const login = (who = player) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${who}',false);set role authenticated`,
  );
const farm = async () => {
  await login();
  return (await db.query<{ f: any }>("select public.arena_farm() f")).rows[0].f;
};
const act = async (actions: object[]) => {
  await login();
  return (
    await db.query<{ r: any }>("select public.arena_farm_act($1,$2::jsonb) r", [
      randomUUID(),
      JSON.stringify(actions),
    ])
  ).rows[0].r;
};
const owner = async (sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(sql, params)).rows;
};
const place = async (item: string, x: number, y: number, flip = false) =>
  (await act([{ a: "decor-place", item, x, y, flip }])).results[0];
const level = (lv: number) =>
  owner("update public.arena_farms set level = $2 where player_id = $1", [
    player,
    lv,
  ]);
const clear = () =>
  Promise.all([
    owner("delete from public.arena_farm_decor_pieces where player_id = $1", [
      player,
    ]),
    owner("delete from public.arena_farm_decor_credits where player_id = $1", [
      player,
    ]),
  ]);

async function freshDb(upTo?: string) {
  const d = new PGlite();
  await d.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await d.exec("select set_config('arena.farm_bugs', 'off', false)");
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (upTo && f >= upTo) break;
    await d.exec(await readFile("supabase/migrations/" + f, "utf8"));
  }
  return d;
}
async function newPlayer(d: PGlite, id: string, name: string) {
  await d.exec(
    `reset role;insert into auth.users values('${id}','{"display_name":"${name}"}')`,
  );
  await d.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
  await d.query("select public.arena_me()");
  await d.query("select public.arena_farm()");
  await d.exec("reset role");
}

beforeAll(async () => {
  db = await freshDb();
  await newPlayer(db, player, "Decor tester");
  for (const ref of ["decor-1", "decor-2"])
    await owner(
      "select public.arena_grant_leaves($1, 100000, 'test', $2, public.arena_today())",
      [player, ref],
    );
}, 90000);
afterAll(async () => db.close());

it("sells the shared decorations at their level, price, Charm, size, group, layer and season", async () => {
  const items = await owner(
    "select id, name, price, charm, level, w, d, decor_group, ground, season from public.arena_farm_decor_items order by level, id",
  );
  expect(items).toEqual(
    [...FARM_DECOR]
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
      .map(
        ({ id, name, price, charm, level, w, d, group, ground, season }) => ({
          id,
          name,
          price,
          charm,
          level,
          w,
          d,
          decor_group: group,
          ground: !!ground,
          season: season ?? null,
        }),
      ),
  );
  expect(FARM_DECOR.length).toBeGreaterThanOrEqual(19 + 30);
  const sets = await owner(
    `select s.id, s.name, s.charm, array_agg(i.item order by i.item) items
       from public.arena_farm_decor_sets s join public.arena_farm_decor_set_items i on i.set_id = s.id
      group by s.id order by s.id`,
  );
  expect(sets).toEqual(
    [...DECOR_SETS]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, name, charm, items }) => ({
        id,
        name,
        charm,
        items: [...items].sort(),
      })),
  );
  expect(await farm()).toMatchObject({ decor: [], charm: 0, decorCredits: {} });
});

it("places, moves, mirrors and stores decorations anywhere that's free", async () => {
  await clear();
  await level(1);
  expect(await place("lamp", 100, 900)).toEqual({
    ok: false,
    error: "Unlocks at farm level 12",
  });
  expect(await place("throne", 100, 900)).toEqual({
    ok: false,
    error: "Unknown decoration",
  });
  await level(30);
  const f0 = await farm();
  const r = await act([
    { a: "decor-place", item: "lamp", x: 100, y: 900 },
    { a: "decor-place", item: "apple", x: 1600, y: 950, flip: true },
    // On the field, off the grid, off the farm, on top of the lamp.
    { a: "decor-place", item: "rock", x: 600, y: 500 },
    { a: "decor-place", item: "rock", x: 105, y: 900 },
    { a: "decor-place", item: "rock", x: 1750, y: 900 },
    { a: "decor-place", item: "rock", x: 110, y: 900 },
  ]);
  const [lamp, apple] = r.results;
  expect(lamp).toEqual({
    ok: true,
    decor: "lamp",
    piece: lamp.piece,
    x: 100,
    y: 900,
    cost: 1350,
  });
  expect(apple).toMatchObject({ ok: true, decor: "apple", cost: 4200 });
  expect(r.results.slice(2)).toEqual([
    { ok: false, error: "Something is in the way" },
    { ok: false, error: "Choose a spot on the farm" },
    { ok: false, error: "Choose a spot on the farm" },
    { ok: false, error: "Too close to another decoration" },
  ]);
  expect(f0.leaves - r.farm.leaves).toBe(1350 + 4200);
  expect(r.farm.decor).toEqual([
    { id: lamp.piece, item: "lamp", x: 100, y: 900, flip: false },
    { id: apple.piece, item: "apple", x: 1600, y: 950, flip: true },
  ]);
  expect(r.farm.charm).toBe(2 + 4);
  // Moving: where it fits, mirrored or not; it may overlap where it stood.
  const mv = await act([
    { a: "decor-move", piece: lamp.piece, x: 110, y: 900, flip: true },
    { a: "decor-move", piece: lamp.piece, x: 1600, y: 950 },
    { a: "decor-move", piece: 999999, x: 200, y: 900 },
  ]);
  expect(mv.results).toEqual([
    { ok: true, moved: lamp.piece, x: 110, y: 900 },
    { ok: false, error: "Too close to another decoration" },
    { ok: false, error: "Nothing there" },
  ]);
  expect(mv.farm.decor[0]).toEqual({
    id: lamp.piece,
    item: "lamp",
    x: 110,
    y: 900,
    flip: true,
  });
  expect(mv.farm.leaves).toBe(r.farm.leaves);
  // Putting one away: no leaves back, but it places again for free.
  const away = await act([
    { a: "decor-store", piece: apple.piece },
    { a: "decor-store", piece: apple.piece },
  ]);
  expect(away.results).toEqual([
    { ok: true, stored: "apple", piece: apple.piece },
    { ok: false, error: "Nothing there" },
  ]);
  expect(away.farm.decorCredits).toEqual({ apple: 1 });
  expect(away.farm.charm).toBe(2);
  const back = await act([
    { a: "decor-place", item: "apple", x: 1300, y: 1000 },
  ]);
  expect(back.results[0]).toMatchObject({ ok: true, cost: 0 });
  expect(back.farm.leaves).toBe(away.farm.leaves);
  expect(back.farm.decorCredits).toEqual({});
  // Storage lasts: a stored decoration places before its level, like a reward.
  await act([{ a: "decor-store", piece: lamp.piece }]);
  await level(1);
  expect(await place("lamp", 100, 900)).toMatchObject({ ok: true, cost: 0 });
  expect(await place("lamp", 200, 900)).toEqual({
    ok: false,
    error: "Unlocks at farm level 12",
  });
  // The old spot actions only ask for an update.
  const old = await act([{ a: "decor", slot: 0, item: "rock" }]);
  expect(old.results[0]).toEqual({
    ok: false,
    error: "Update the game to decorate",
  });
});

it("has room for 10 + the farm's level decorations, up to 60", async () => {
  await clear();
  await level(2);
  expect(decorCap(2)).toBe(12);
  expect(decorCap(80)).toBe(60);
  await owner(
    `insert into public.arena_farm_decor_pieces(player_id, item, x, y)
     select $1, 'rock', 40 + (k % 24) * 60, 1000 + (k / 24) * 0 from generate_series(0, 11) k`,
    [player],
  );
  expect(await place("rock", 100, 600)).toEqual({
    ok: false,
    error: "Your farm has room for 12 decorations",
  });
  await level(3);
  expect(await place("rock", 100, 600)).toMatchObject({ ok: true });
});

it("checks the same boxes as the shared rules (decorFits)", async () => {
  await clear();
  const placed: FarmDecorPiece[] = [];
  const rows = await owner(
    `insert into public.arena_farm_decor_pieces(player_id, item, x, y) values
     ($1, 'tower', 1200, 980), ($1, 'bench', 560, 900), ($1, 'pine', 1620, 560),
     ($1, 'plum', 300, 460), ($1, 'lamp', 1000, 160), ($1, 'pathstone', 700, 960),
     ($1, 'pathbrick', 1300, 900), ($1, 'picket', 160, 880) returning id, item, x, y`,
    [player],
  );
  for (const r of rows)
    placed.push({ id: Number(r.id), item: r.item, x: r.x, y: r.y });
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const checks: [string, number, number, number | null][] = [];
  const flat = FARM_DECOR.filter((d) => d.ground);
  for (let i = 0; i < 1400; i++) {
    // Every third check is a path (they may overlap each other).
    const item =
      i % 3 === 0
        ? flat[Math.floor(rnd() * flat.length)].id
        : FARM_DECOR[Math.floor(rnd() * FARM_DECOR.length)].id;
    const x =
      Math.round((DECOR_AREA.x0 - 40 + rnd() * 1800) / 10) * 10 +
      (i % 50 === 0 ? 5 : 0);
    const y = Math.round((DECOR_AREA.y0 - 40 + rnd() * 1020) / 10) * 10;
    checks.push([
      item,
      x,
      y,
      i % 9 === 0 ? placed[i % placed.length].id : null,
    ]);
  }
  const sql = await owner(
    `select c.ord, public.arena_farm_decor_fits($1, c.item, c.x, c.y, c.ex) e
       from jsonb_to_recordset($2::jsonb) c(ord int, item text, x int, y int, ex bigint) order by c.ord`,
    [
      player,
      JSON.stringify(
        checks.map(([item, x, y, ex], ord) => ({ ord, item, x, y, ex })),
      ),
    ],
  );
  const shared = checks.map(
    ([item, x, y, ex]) =>
      decorFits(item, x, y, placed, ex ?? undefined) ?? null,
  );
  expect(sql.map((r: any) => r.e)).toEqual(shared);
  // Paths overlapping paths were in the sample, and passed.
  expect(
    checks.some(
      ([item, x, y], k) =>
        shared[k] === null &&
        FARM_DECOR.find((d) => d.id === item)?.ground &&
        decorFits("rock", x, y, placed) === "Too close to another decoration",
    ),
  ).toBe(true);
  // The sample covers every answer.
  expect(new Set(shared)).toEqual(
    new Set([
      null,
      "Choose a spot on the farm",
      "Something is in the way",
      "Too close to another decoration",
    ]),
  );
});

it("adds 1% farm XP for every 2 Charm, up to 25%", async () => {
  await clear();
  const xpAfter = async (add: number) => {
    await owner(
      "update public.arena_farms set level = 45, xp = 0 where player_id = $1",
      [player],
    );
    await owner("select public.arena_farm_add_xp($1, $2)", [player, add]);
    return Number(
      (
        await owner("select xp from public.arena_farms where player_id = $1", [
          player,
        ])
      )[0].xp,
    );
  };
  await level(45);
  await place("rock", 100, 900);
  expect(await xpAfter(100)).toBe(100);
  await place("tower", 1200, 980);
  expect((await farm()).charm).toBe(11);
  expect(charmBonus(11)).toBe(5);
  expect(await xpAfter(100)).toBe(105);
  await owner(
    `insert into public.arena_farm_decor_pieces(player_id, item, x, y)
     select $1, 'statue', 40 + k * 60, 600 from generate_series(0, 3) k`,
    [player],
  );
  expect((await farm()).charm).toBeGreaterThan(50);
  expect(await xpAfter(100)).toBe(125);
});

it("gives the Golden Voltkit Statue for 15 crops, placeable before level 75", async () => {
  await clear();
  await level(20);
  expect(await place("statue", 100, 900)).toEqual({
    ok: false,
    error: "Unlocks at farm level 75",
  });
  await owner(
    `insert into public.arena_farm_harvests(player_id, crop, harvests)
     select $1, c, 1 from unnest($2::text[]) c on conflict do nothing`,
    [player, CROPS.slice(0, 15).map((c) => c.id)],
  );
  await owner("select public.arena_farm_book_rewards($1)", [player]);
  let f = await farm();
  expect(f.bookRewards).toEqual([5, 10, 15]);
  expect(f.decorCredits).toEqual({ statue: 1 });
  const r = await act([{ a: "decor-place", item: "statue", x: 100, y: 900 }]);
  expect(r.results[0]).toMatchObject({ ok: true, decor: "statue", cost: 0 });
  expect(r.farm.leaves).toBe(f.leaves);
  expect(r.farm.decorCredits).toEqual({});
  expect(r.farm.charm).toBe(15);
  expect(await place("statue", 300, 900)).toEqual({
    ok: false,
    error: "Unlocks at farm level 75",
  });
  await owner("select public.arena_farm_book_rewards($1)", [player]);
  f = await farm();
  expect(f.decorCredits).toEqual({});
});

it("moves what stood in the 8 spots to the same places, once", async () => {
  const d = await freshDb(FREE);
  try {
    const p2 = "00000000-0000-4000-8000-000000000482";
    await newPlayer(d, p2, "Spots");
    await d.query(
      `insert into public.arena_farm_decor(player_id, slot, item) values
       ($1, 0, 'lamp'), ($1, 4, 'rock'), ($1, 6, null), ($1, 7, 'apple')`,
      [p2],
    );
    const sql = await readFile("supabase/migrations/" + FREE, "utf8");
    await d.exec(sql);
    await d.exec(sql);
    await d.exec(
      `reset role;select set_config('request.jwt.claim.sub','${p2}',false);set role authenticated`,
    );
    const f = (await d.query<{ f: any }>("select public.arena_farm() f"))
      .rows[0].f;
    expect(
      f.decor.map(({ item, x, y, flip }: any) => ({ item, x, y, flip })),
    ).toEqual([
      { item: "lamp", x: 80, y: 830, flip: false },
      { item: "rock", x: 70, y: 540, flip: false },
      { item: "apple", x: 390, y: 890, flip: false },
    ]);
    expect(f.charm).toBe(2 + 1 + 4);
  } finally {
    await d.close();
  }
}, 90000);

it("lets paths overlap each other, never anything standing", async () => {
  await clear();
  await level(30);
  const r = await act([
    { a: "decor-place", item: "pathstone", x: 600, y: 950 },
    { a: "decor-place", item: "pathgravel", x: 610, y: 950 },
    { a: "decor-place", item: "pathstone", x: 600, y: 950 },
    // A bench on the path, a path under the bench: no.
    { a: "decor-place", item: "bench", x: 600, y: 950 },
    { a: "decor-place", item: "bench", x: 600, y: 920 },
    { a: "decor-place", item: "pathbrick", x: 610, y: 920 },
    // Fences side by side, 50 px apart, touch without overlapping.
    { a: "decor-place", item: "picket", x: 1100, y: 900 },
    { a: "decor-place", item: "picket", x: 1150, y: 900 },
    { a: "decor-place", item: "gate", x: 1200, y: 900 },
    { a: "decor-place", item: "picket", x: 1240, y: 900 },
  ]);
  expect(r.results.map((x: any) => x.ok || x.error)).toEqual([
    true,
    true,
    true,
    "Too close to another decoration",
    true,
    "Too close to another decoration",
    true,
    true,
    true,
    "Too close to another decoration",
  ]);
});

it("sells seasonal decorations only in their season, by the server's game day", async () => {
  // Every day of a year (and a leap day) against the shared table.
  const days: string[] = [];
  for (let t = Date.UTC(2027, 0, 1); t <= Date.UTC(2028, 2, 1); t += 86400e3)
    days.push(new Date(t).toISOString().slice(0, 10));
  const sql = await owner(
    "select public.arena_farm_decor_seasons(d) s from unnest($1::date[]) d order by d",
    [days],
  );
  expect(sql.map((r: any) => r.s)).toEqual(days.map((d) => decorSeasonsOn(d)));
  expect(decorSeasonsOn("2026-10-31")).toEqual(["halloween"]);
  expect(decorSeasonsOn("2026-12-31")).toEqual(["christmas"]);
  expect(decorSeasonsOn("2027-01-03")).toEqual(["christmas"]);
  expect(decorSeasonsOn("2027-02-06")).toEqual(["lunar"]);
  expect(decorSeasonsOn("2027-07-04")).toEqual([]);
  const today = (await owner("select public.arena_today()::text d"))[0].d;
  expect((await farm()).decorSeasons).toEqual(decorSeasonsOn(today));

  await clear();
  await level(20);
  const buy = async (item: string, day: string, x = 600) =>
    (
      await owner(
        `select err, gained from public.arena_farm_act_more($1, $2::jsonb, $3, now(), $4::date)`,
        [
          player,
          JSON.stringify({ a: "decor-place", item, x, y: 950 }),
          randomUUID(),
          day,
        ],
      )
    )[0];
  expect((await buy("pumpkin", "2027-07-04")).err).toBe(
    "On sale only for Halloween",
  );
  expect((await buy("snowman", "2027-10-20")).err).toBe(
    "On sale only for Christmas",
  );
  expect((await buy("redlantern", "2027-12-20")).err).toBe(
    "On sale only for Lunar New Year",
  );
  const p = await buy("pumpkin", "2027-10-20");
  expect(p.err).toBeNull();
  expect(p.gained).toMatchObject({ decor: "pumpkin", cost: 600 });
  // Bought once, it is kept: put away, it places again out of season.
  await act([{ a: "decor-store", piece: p.gained.piece }]);
  const again = await buy("pumpkin", "2027-07-04", 700);
  expect(again.err).toBeNull();
  expect(again.gained).toMatchObject({ decor: "pumpkin", cost: 0 });
  // Not seasonal: any day.
  expect((await buy("tulips", "2027-07-04", 800)).err).toBeNull();
});

it("adds a collection's Charm once every piece of it stands on the farm", async () => {
  await clear();
  await level(30);
  const set = DECOR_SETS.find((s) => s.id === "cottage")!;
  const spots = [
    [100, 900],
    [1100, 900],
    [1250, 900],
    [1400, 900],
    [600, 950],
  ];
  const r = await act(
    set.items.slice(0, 4).map((item, k) => ({
      a: "decor-place",
      item,
      x: spots[k][0],
      y: spots[k][1],
    })),
  );
  expect(r.results.every((x: any) => x.ok)).toBe(true);
  const base = set.items
    .slice(0, 4)
    .reduce((a, i) => a + FARM_DECOR.find((d) => d.id === i)!.charm, 0);
  expect(r.farm.charm).toBe(base);
  const done = await act([
    { a: "decor-place", item: set.items[4], x: 600, y: 950 },
  ]);
  expect(done.results[0]).toMatchObject({ ok: true });
  const all = base + FARM_DECOR.find((d) => d.id === set.items[4])!.charm;
  expect(done.farm.charm).toBe(all + set.charm);
  expect(decorCharm(done.farm.decor)).toBe(done.farm.charm);
  // A second copy adds only its own Charm; putting one away breaks the set.
  const two = await act([
    { a: "decor-place", item: "tulips", x: 1550, y: 950 },
  ]);
  expect(two.farm.charm).toBe(all + set.charm + 1);
  const piece = done.farm.decor.find((p: any) => p.item === set.items[4]).id;
  const away = await act([{ a: "decor-store", piece }]);
  expect(away.farm.charm).toBe(base + 1);
  expect(decorCharm(away.farm.decor)).toBe(away.farm.charm);
});
