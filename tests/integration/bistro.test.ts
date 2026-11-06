import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BISTRO_TRADE,
  DISHES,
  ITEMS,
  HIRE_STEPS,
  KITCHEN_PRICES,
  SHIFT_PRICES,
  STOVE_PRICES,
  cookMs,
  defaultState,
  payment,
  sanitize,
  simulateAway,
  xpToNext,
  type BistroState,
  type DishId,
} from "../../packages/shared/src/bistro";

// Migration 067: the Element Bistro on the server.
let db: PGlite;
const ana = "00000000-0000-4000-8000-000000000671";
const ben = "00000000-0000-4000-8000-000000000672";
const cal = "00000000-0000-4000-8000-000000000673"; // not Ana's friend
const as = (id: string) =>
  db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
const sql = async (q: string, params: unknown[] = []) => {
  await db.exec("reset role");
  return (await db.query<any>(q, params)).rows;
};
const open = async (id: string) => {
  await as(id);
  return (await db.query<{ b: any }>("select public.arena_bistro() b")).rows[0]
    .b;
};
const act = async (id: string, actions: object[], request = randomUUID()) => {
  await as(id);
  return (
    await db.query<{ r: any }>(
      "select public.arena_bistro_act($1,$2::jsonb) r",
      [request, JSON.stringify(actions)],
    )
  ).rows[0].r;
};
const friendAct = async (id: string, friend: string, kind: string) => {
  await as(id);
  return (
    await db.query<{ r: any }>(
      "select public.arena_bistro_friend_act($1,$2,$3) r",
      [randomUUID(), friend, kind],
    )
  ).rows[0].r;
};
/** Move the bistro's clock: everything time-stamped shifts back by `s` seconds. */
const ago = async (id: string, s: number) => {
  await sql(
    "update public.arena_bistros set last_seen = last_seen - make_interval(secs => $2), sale_at = sale_at - make_interval(secs => $2) where player_id = $1",
    [id, s],
  );
  await sql(
    "update public.arena_bistro_stoves set started_at = started_at - make_interval(secs => $2) where player_id = $1 and started_at is not null",
    [id, s],
  );
};
const setCoins = (id: string, coins: number, level?: number) =>
  sql(
    "update public.arena_bistros set coins = $2, level = coalesce($3, level) where player_id = $1",
    [id, coins, level ?? null],
  );

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
    [cal, "Cal"],
  ]) {
    await sql(
      `insert into auth.users values($1, jsonb_build_object('display_name', $2::text))`,
      [id, name],
    );
    await as(id);
    await db.query("select public.arena_me()");
  }
  await sql("insert into public.arena_friendships(a, b) values ($1, $2)", [
    ana,
    ben,
  ]);
}, 90000);
afterAll(async () => db.close());

describe("the catalog matches packages/shared/src/bistro.ts", () => {
  it("dishes, items and the XP curve", async () => {
    const dishes = await sql(
      "select id, name, level, seconds, cost, servings, price, xp from public.arena_bistro_dishes order by ord",
    );
    expect(dishes).toEqual(
      DISHES.map(({ id, name, level, seconds, cost, servings, price, xp }) => ({
        id,
        name,
        level,
        seconds,
        cost,
        servings,
        price,
        xp,
      })),
    );
    const kinds = await sql(
      "select kind, name, price, level, charm, floor from public.arena_bistro_kinds order by kind",
    );
    expect(kinds).toEqual(
      [...ITEMS]
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map((i) => ({
          kind: i.kind,
          name: i.name,
          price: i.price,
          level: i.level,
          charm: i.charm,
          floor: !!i.floor,
        })),
    );
    for (let lv = 1; lv <= 30; lv++)
      expect(
        (await sql("select public.arena_bistro_need($1) n", [lv]))[0].n,
      ).toBe(xpToNext(lv));
  });
  it("bills and cooking times", async () => {
    for (const d of DISHES)
      for (const special of [false, true])
        for (const vip of [false, true])
          for (const combo of [1, 3, 5])
            for (const hearts of [1, 2, 3])
              for (const quick of [false, true])
                for (const rush of [false, true]) {
                  const [{ p }] = await sql(
                    "select public.arena_bistro_pay($1,$2,$3,$4,$5,$6,$7) p",
                    [d.price, special, vip, combo, hearts, quick, rush],
                  );
                  expect(p).toBe(
                    payment(d.id, { special, vip, combo, hearts, quick, rush })
                      .total,
                  );
                }
    const s = defaultState();
    for (const kitchen of [0, 1, 2, 3])
      for (const cook of [1, 3, 5]) {
        s.kitchenLv = kitchen;
        const [{ ms }] = await sql(
          "select public.arena_bistro_cook_ms($1,$2,$3) ms",
          [DISH_SECONDS.pho, kitchen, cook],
        );
        expect(ms).toBe(cookMs(s, "pho", cook));
      }
  });
});
const DISH_SECONDS = Object.fromEntries(DISHES.map((d) => [d.id, d.seconds]));

describe("a new bistro", () => {
  it("opens with the starting room, the same as the client's", async () => {
    const b = await open(ana);
    const local = defaultState();
    expect(b.items).toEqual(local.items);
    expect(b.counter).toEqual(local.counter);
    expect(b.staff).toEqual(local.staff);
    expect(b.coins).toBe(local.coins);
    expect(b.stoves).toHaveLength(2);
    expect(b.away).toBeNull();
    // The client reads it as its own state.
    const parsed = sanitize(b);
    expect(parsed.items).toEqual(local.items);
    expect(parsed.counter).toEqual(local.counter);
  });
});

describe("cooking", () => {
  it("costs coins, takes the server's time, a golden tap, plates to the counter", async () => {
    await setCoins(ana, 500);
    let r = await act(ana, [{ a: "cook", stove: 0, dish: "goicuon" }]);
    expect(r.results).toEqual([{ ok: true }]);
    expect(r.bistro.coins).toBe(490);
    expect(r.bistro.stoves[0]).toMatchObject({ dish: "goicuon", dur: 15000 });
    r = await act(ana, [
      { a: "plate", stove: 0 },
      { a: "stir", stove: 0 },
    ]);
    expect(r.results[0]).toMatchObject({ ok: false, error: "Not ready yet." });
    expect(r.results[1]).toMatchObject({ ok: false });
    await ago(ana, 12.5); // 83% done: the golden moment
    r = await act(ana, [{ a: "stir", stove: 0 }]);
    expect(r.results).toEqual([{ ok: true }]);
    await ago(ana, 5);
    r = await act(ana, [{ a: "plate", stove: 0 }]);
    expect(r.results[0]).toMatchObject({ ok: true, slot: 0, servings: 8 });
    expect(r.bistro.counter[0]).toEqual({
      dish: "goicuon",
      servings: 14,
      perfect: true,
    });
  });
  it("refuses dishes above your level", async () => {
    const r = await act(ana, [{ a: "cook", stove: 1, dish: "lau" }]);
    expect(r.results[0].error).toMatch(/opens at level 7/);
  });
  it("answers a retried request without applying it twice", async () => {
    const req = randomUUID();
    const a = await act(ana, [{ a: "cook", stove: 1, dish: "banhmi" }], req);
    const b = await act(ana, [{ a: "cook", stove: 1, dish: "banhmi" }], req);
    expect(a.results).toEqual([{ ok: true }]);
    expect(b.repeated).toBe(true);
    expect(b.bistro.coins).toBe(a.bistro.coins);
  });
});

describe("guests", () => {
  it("a sale needs a serving and pays the server's price", async () => {
    const before = (await open(ana)).coins;
    const r = await act(ana, [
      { a: "serve", dish: "goicuon", combo: 1, hearts: 3 },
      { a: "serve", dish: "pho", hearts: 3 },
    ]);
    const special = r.bistro.special as DishId;
    const rush = Math.floor(Number(r.bistro.now) / 1000) % 240 < 35;
    const bill = payment("goicuon", {
      special: special === "goicuon",
      combo: 1,
      hearts: 3,
      rush,
    }).total;
    expect(r.results[0]).toMatchObject({ ok: true, coins: bill, vip: false });
    expect(r.results[1]).toMatchObject({
      ok: false,
      error: "None left on the counter.",
    });
    expect(r.bistro.coins).toBe(before + bill);
    expect(r.bistro.counter[0].servings).toBe(13);
  });
  it("sales are limited by the seats; VIPs by their own allowance", async () => {
    // Six seats: at most 6 + 4 at once.
    const sales = Array.from({ length: 13 }, () => ({
      a: "serve",
      dish: "goicuon",
      vip: true,
      hearts: 3,
    }));
    const r = await act(ana, sales);
    const ok = r.results.filter((x: any) => x.ok);
    expect(ok.length).toBeLessThanOrEqual(10);
    expect(
      r.results.some((x: any) => x.error === "Too many guests at once."),
    ).toBe(true);
    const vips = ok.filter((x: any) => x.vip).length;
    expect(vips).toBeLessThanOrEqual(3);
    expect(vips).toBeGreaterThanOrEqual(1);
  });
});

describe("the floor plan", () => {
  it("moves furniture, refuses the kitchen, the doorway and a blocked seat", async () => {
    await setCoins(ana, 1000);
    let r = await act(ana, [
      { a: "place", id: 11, kind: "plant", x: 2, y: 1 },
      { a: "place", id: 11, kind: "plant", x: 0, y: 7 },
      { a: "place", id: 11, kind: "plant", x: 9, y: 3 },
    ]);
    expect(r.results[0].error).toBe("The kitchen stays clear.");
    expect(r.results[1].error).toBe("Keep the doorway and the counter clear.");
    expect(r.results[2]).toEqual({ ok: true });
    expect(r.bistro.items.find((i: any) => i.id === 11)).toMatchObject({
      x: 9,
      y: 3,
    });
    // Box the chair at (8, 3) in: its neighbours (7,3) and (8,2) and (9,3).
    r = await act(ana, [
      { a: "buy", kind: "plant" },
      { a: "buy", kind: "plant" },
      { a: "place", kind: "plant", x: 7, y: 3 },
      { a: "place", kind: "plant", x: 8, y: 2 },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, true, true, false]);
    expect(r.results[3].error).toBe("That would block a seat.");
    expect(r.bistro.stored).toEqual({ plant: 1 });
    expect(r.bistro.items.some((i: any) => i.x === 8 && i.y === 2)).toBe(false);
    // Put it away and back.
    const id = r.bistro.items.find((i: any) => i.x === 7 && i.y === 3).id;
    r = await act(ana, [{ a: "store", id }]);
    expect(r.bistro.stored).toEqual({ plant: 2 });
    r = await act(ana, [{ a: "place", kind: "rug", x: 4, y: 6 }]);
    expect(r.results[0].error).toBe("None in storage.");
  });
});

describe("staff, upgrades and the time away", () => {
  it("hires by level and price, trains, and upgrades", async () => {
    await setCoins(ben, 5000, 1);
    await open(ben);
    let r = await act(ben, [{ a: "hire", role: "cook", char: "pyranda" }]);
    expect(r.results[0].error).toBe("Hire at level 2.");
    await setCoins(ben, 5000, 2);
    r = await act(ben, [
      { a: "hire", role: "cook", char: "pyranda" },
      { a: "hire", role: "cook", char: "lumoth" },
      { a: "hire", role: "waiter", char: "nobody" },
      { a: "train", id: 2 },
      { a: "cookdish", id: 2, dish: "goicuon" },
      { a: "stove" },
      { a: "kitchen" },
      { a: "shift" },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([
      true,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    const spent =
      HIRE_STEPS.cook[0].price +
      150 +
      STOVE_PRICES[2] +
      KITCHEN_PRICES[0] +
      SHIFT_PRICES[0];
    expect(r.bistro.coins).toBe(5000 - spent);
    expect(r.bistro.staff[1]).toMatchObject({
      char: "pyranda",
      role: "cook",
      level: 2,
      dish: "goicuon",
    });
    expect(r.bistro).toMatchObject({ kitchenLv: 1, shiftLv: 1 });
    expect(r.bistro.stoves).toHaveLength(3);
  });
  it("works the time away like the shared rules, and reports it once", async () => {
    // Ben's cook has run the last stove since the hire; start clean.
    await sql(
      "update public.arena_bistro_stoves set dish = null, started_at = null, dur_ms = null, perfect = false where player_id = $1",
      [ben],
    );
    await sql(
      "update public.arena_bistro_counter set dish = null, servings = 0, perfect = false where player_id = $1",
      [ben],
    );
    await setCoins(ben, 800);
    const before = await open(ben);
    const local: BistroState = sanitize(before);
    await ago(ben, 5 * 3600);
    const b = await open(ben);
    expect(b.away).toBeTruthy();
    // The same morning, run by the shared rules.
    const lastSeen = Number(before.lastSeen);
    const rep = simulateAway(
      local,
      lastSeen,
      lastSeen + b.away.away,
      before.special,
    )!;
    expect(b.away.capped).toBe(true);
    expect(b.away.worked).toBe(4 * 3600 * 1000); // shift level 1
    expect(b.away.batches).toBe(rep.batches);
    expect(b.away.served).toBe(rep.served);
    expect(b.away.coins).toBe(rep.coins);
    expect(b.away.spent).toBe(rep.spent);
    expect(b.coins).toBe(local.coins);
    expect(b.served).toBe(local.served);
    expect(b.away.served).toBeGreaterThan(100);
    expect((await open(ben)).away).toBeNull();
  });
});

describe("trade and friends", () => {
  it("trades bistro coins for Gold Leaves up to the daily cap", async () => {
    await setCoins(ana, 10000);
    const leaves = (await open(ana)).leaves;
    let r = await act(ana, [{ a: "trade", lots: 10 }]);
    expect(r.results[0]).toEqual({ ok: true, leaves: 200 });
    expect(r.bistro.leaves).toBe(leaves + 200);
    expect(r.bistro.coins).toBe(10000 - 1000);
    r = await act(ana, [{ a: "trade", lots: 6 }]);
    expect(r.results[0].error).toMatch(/300 Gold Leaves a day/);
    r = await act(ana, [{ a: "trade", lots: 5 }]);
    expect(r.results[0].ok).toBe(true);
    expect(r.bistro.tradedToday).toBe(BISTRO_TRADE.dailyLeaves);
  });
  it("friends visit, eat once a day and like once a week; strangers can't", async () => {
    await as(cal);
    await expect(
      db.query("select public.arena_bistro_friend($1)", [ana]),
    ).rejects.toThrow(/Only friends/);
    await as(ben);
    const list = (
      await db.query<{ f: any }>("select public.arena_bistro_friends() f")
    ).rows[0].f;
    expect(list.map((x: any) => x.name)).toEqual(["Ana"]);
    const view = (
      await db.query<{ v: any }>("select public.arena_bistro_friend($1) v", [
        ana,
      ])
    ).rows[0].v;
    expect(view).toMatchObject({ name: "Ana", dined: false, liked: false });
    expect(view.coins).toBeUndefined();
    const anaBefore = (await open(ana)).coins;
    const servings = (await open(ana)).counter[0].servings;
    let r = await friendAct(ben, ana, "dine");
    expect(r).toMatchObject({ ok: true, dish: "goicuon", paid: 6, coins: 10 });
    expect(r.bistro.dined).toBe(true);
    r = await friendAct(ben, ana, "dine");
    expect(r).toMatchObject({
      ok: false,
      error: "You already ate here today.",
    });
    const anaAfter = await open(ana);
    expect(anaAfter.coins).toBe(anaBefore + 6);
    expect(anaAfter.counter[0].servings).toBe(servings - 1);
    expect(anaAfter.friendGuests).toEqual([
      expect.objectContaining({ name: "Ben", dish: "goicuon" }),
    ]);
    r = await friendAct(ben, ana, "like");
    expect(r).toMatchObject({ ok: true, xp: 2 });
    expect(r.bistro.likes).toBe(1);
    r = await friendAct(ben, ana, "like");
    expect(r).toMatchObject({ ok: false });
  });
});

describe("expanding the dining room", () => {
  it("grows the grid by level and price; furniture may then use the new tiles", async () => {
    await setCoins(cal, 20000, 3);
    await open(cal);
    let r = await act(cal, [
      { a: "expand" },
      { a: "buy", kind: "plant" },
      { a: "place", kind: "plant", x: 12, y: 4 },
    ]);
    expect(r.results[0].error).toBe("Expand at level 4.");
    expect(r.results[2].error).toBe("That's outside the restaurant.");
    await setCoins(cal, 20000, 12);
    r = await act(cal, [
      { a: "expand" },
      { a: "place", kind: "plant", x: 12, y: 9 },
      { a: "expand" },
      { a: "expand" },
      { a: "expand" },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(r.results[4].error).toBe("The dining room is as big as it gets.");
    expect(r.bistro.sizeLv).toBe(3);
    expect(r.bistro.coins).toBe(20000 - 800 - 2500 - 6000);
    // The far corner of the biggest room (16, 11) takes a table and chairs.
    r = await act(cal, [
      { a: "buy", kind: "table" },
      { a: "buy", kind: "chair" },
      { a: "place", kind: "table", x: 16, y: 11 },
      { a: "place", kind: "chair", x: 15, y: 11, rot: 0 },
      { a: "place", kind: "chair", x: 17, y: 11, rot: 2 },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    const [{ n }] = await sql(
      "select count(*)::int n from public.arena_bistro_seats($1)",
      [cal],
    );
    expect(n).toBe(7);
  });
});
