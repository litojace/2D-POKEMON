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
  inRush,
  payment,
  popularity,
  sanitize,
  seatWalks,
  serviceRate,
  simulateAway,
  sizeOf,
  xpToNext,
  type BistroState,
  type DishId,
} from "../../packages/shared/src/bistro";

// Migration 068: the Element Bistro on the server.
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
    // A fresh waiter, full of energy (migration 073), never fed.
    expect(b.staff).toEqual(
      local.staff.map((x) => ({ ...x, energy: 100, fedAt: 0 })),
    );
    expect(sanitize(b).staff).toEqual(
      local.staff.map((x) => ({ ...x, energy: 100 })),
    );
    expect(b.trash).toBe(0);
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
    // Rush hours follow the server's clock: the time of this request.
    const rush = inRush(Number(r.bistro.now));
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
      { likesWeek: before.likesWeek, dinedToday: before.friendGuests.length },
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
    await setCoins(cal, 60000, 20);
    r = await act(cal, [
      { a: "expand" },
      { a: "place", kind: "plant", x: 12, y: 9 },
      { a: "expand" },
      { a: "expand" },
      { a: "expand" },
      { a: "expand" },
      { a: "expand" },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(r.results[6].error).toBe("The dining room is as big as it gets.");
    expect(r.bistro.sizeLv).toBe(5);
    expect(r.bistro.coins).toBe(60000 - 800 - 2500 - 6000 - 12000 - 20000);
    // The far corner of the biggest room (20, 13) takes a table and chairs.
    r = await act(cal, [
      { a: "buy", kind: "table" },
      { a: "buy", kind: "chair" },
      { a: "place", kind: "table", x: 20, y: 13 },
      { a: "place", kind: "chair", x: 19, y: 13, rot: 0 },
      { a: "place", kind: "chair", x: 21, y: 13, rot: 2 },
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

describe("popularity and the floor plan (migration 070)", () => {
  /** The server's numbers for a bistro next to the shared rules' own. */
  const compare = async (id: string) => {
    const b = await open(id);
    const local = sanitize(b);
    const pop = { likesWeek: b.likesWeek, dinedToday: b.friendGuests.length };
    const walks = await sql(
      "select chair, tbl as table, guest, waiter from public.arena_bistro_walks($1)",
      [id],
    );
    expect(walks).toEqual(seatWalks(local.items, sizeOf(local.sizeLv)));
    const [{ p, r }] = await sql(
      "select public.arena_bistro_popularity($1) p, public.arena_bistro_service_rate($1) r",
      [id],
    );
    // The client sees the rating to 3 decimals.
    expect(p).toBeCloseTo(popularity(local, pop).total, 1);
    expect(r).toBeCloseTo(serviceRate(local, pop), 3);
    return { b, walks, p };
  };
  it("measures the same walks, popularity and service rate as the client", async () => {
    // Ana: friends ate there today and liked it this week.
    const a = await compare(ana);
    expect(a.b.likesWeek).toBe(1);
    expect(a.b.friendGuests).toHaveLength(1);
    expect(a.walks.length).toBeGreaterThan(0);
    // Cal: the biggest room, furniture in the far corner.
    const c = await compare(cal);
    expect(c.b.sizeLv).toBe(5);
    expect(c.walks.some((w: any) => w.waiter >= 20)).toBe(true);
  });
  it("a plan with the tables far from the counter serves fewer guests while away", async () => {
    const [{ r: before }] = await sql(
      "select public.arena_bistro_service_rate($1) r",
      [cal],
    );
    // Every table and chair of Cal's to the far side of the room.
    const items = await sql(
      "select id, kind from public.arena_bistro_items where player_id = $1 and kind in ('table', 'chair') order by id",
      [cal],
    );
    await sql(
      "delete from public.arena_bistro_items where player_id = $1 and kind in ('table', 'chair')",
      [cal],
    );
    const tables = items.filter((i: any) => i.kind === "table");
    for (const [n, t] of tables.entries())
      await sql(
        "insert into public.arena_bistro_items(player_id, id, kind, x, y, rot) values ($1, $2, 'table', 15, $3, 0), ($1, $4, 'chair', 16, $3, 2)",
        [cal, t.id, 1 + 2 * n, 1000 + n],
      );
    const [{ r: after }] = await sql(
      "select public.arena_bistro_service_rate($1) r",
      [cal],
    );
    expect(after).toBeLessThan(before);
    await compare(cal);
  });
  it("friends see each other's popularity", async () => {
    await as(ben);
    const list = (
      await db.query<{ f: any }>("select public.arena_bistro_friends() f")
    ).rows[0].f;
    const [{ p }] = await sql("select public.arena_bistro_popularity($1) p", [
      ana,
    ]);
    expect(list[0].popularity).toBeCloseTo(p, 1);
  });
});

describe("staff energy, janitors and friends (migration 073)", () => {
  it("tired staff, litter and janitors work the time away like the shared rules", async () => {
    await setCoins(ben, 20000, 9);
    let r = await act(ben, [
      { a: "hire", role: "janitor", char: "glacelle" },
      { a: "hire", role: "cook", char: "wombolder" },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, true]);
    // Worn-down staff, a clean start.
    await sql(
      "update public.arena_bistro_staff set energy = case role when 'waiter' then 30 else 60 end where player_id = $1",
      [ben],
    );
    await sql(
      "update public.arena_bistro_stoves set dish = null, started_at = null, dur_ms = null, perfect = false where player_id = $1",
      [ben],
    );
    await sql(
      "update public.arena_bistros set trash = 4 where player_id = $1",
      [ben],
    );
    const before = await open(ben);
    expect(before.trash).toBe(4);
    const local = sanitize(before);
    await ago(ben, 3 * 3600);
    const b = await open(ben);
    const lastSeen = Number(before.lastSeen);
    const rep = simulateAway(
      local,
      lastSeen,
      lastSeen + b.away.away,
      before.special,
      {
        likesWeek: before.likesWeek,
        dinedToday: before.friendGuests.length,
      },
    )!;
    expect(b.away.served).toBe(rep.served);
    expect(b.away.batches).toBe(rep.batches);
    expect(b.away.coins).toBe(rep.coins);
    expect(b.away.spent).toBe(rep.spent);
    expect(b.trash).toBe(local.trash);
    expect(b.away.served).toBeGreaterThan(50);
    for (const st of b.staff)
      expect(st.energy).toBeCloseTo(
        local.staff.find((x) => x.id === st.id)!.energy!,
        3,
      );
    // Three hours of work: the waiter (30, −12 an hour) is exhausted.
    expect(b.staff.find((x: any) => x.role === "waiter").energy).toBeCloseTo(
      0,
      3,
    );
  });
  it("a staff meal takes a serving and gives 50, once in 10 minutes; litter is swept", async () => {
    await sql(
      "update public.arena_bistro_counter set dish = case slot when 0 then 'pho' else null end, servings = case slot when 0 then 9 else 0 end where player_id = $1",
      [ben],
    );
    await sql(
      "update public.arena_bistro_staff set energy = 10, fed_at = null where player_id = $1 and role = 'waiter'",
      [ben],
    );
    await sql(
      "update public.arena_bistros set trash = 1 where player_id = $1",
      [ben],
    );
    const waiter = (await open(ben)).staff.find(
      (x: any) => x.role === "waiter",
    );
    let r = await act(ben, [
      { a: "feed", id: waiter.id },
      { a: "feed", id: waiter.id },
      { a: "sweep" },
      { a: "sweep" },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, false, true, false]);
    expect(r.results[1].error).toMatch(/just ate/);
    const w = r.bistro.staff.find((x: any) => x.id === waiter.id);
    expect(w.energy).toBeCloseTo(60, 1);
    expect(w.fedAt).toBeGreaterThan(0);
    expect(r.bistro.counter[0].servings).toBe(8);
    expect(r.bistro.trash).toBe(0);
  });
  it("friends work at your bistro: faster, paid in XP once a day, refilled by their meal there", async () => {
    await setCoins(ana, 5000, 6);
    let r = await act(ana, [
      { a: "hire", role: "waiter", friend: ben },
      { a: "hire", role: "waiter", friend: cal },
      { a: "hire", role: "cook", friend: ben },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, false, false]);
    expect(r.results[1].error).toBe("Only friends can work here.");
    expect(r.results[2].error).toBe("Already on your team.");
    const [{ fighter }] = await sql(
      "select portrait_character fighter from public.arena_profiles where id = $1",
      [ben],
    );
    const staff = r.bistro.staff.find((x: any) => x.friend);
    expect(staff).toMatchObject({
      role: "waiter",
      char: fighter,
      friend: { id: ben, name: "Ben" },
    });
    expect(sanitize(r.bistro).staff.find((x) => x.friend)?.friend).toEqual({
      id: ben,
      name: "Ben",
    });
    // Ben's payday: 3 XP for working at Ana's, once a day.
    await sql("delete from public.arena_bistro_paydays where worker = $1", [
      ben,
    ]);
    const unpaid = await sql(
      "select xp, level from public.arena_bistros where player_id = $1",
      [ben],
    );
    const paid = await open(ben);
    expect(paid.payday).toEqual({ xp: 3, bistros: 1 });
    if (paid.level === unpaid[0].level)
      expect(Number(paid.xp)).toBe(Number(unpaid[0].xp) + 3);
    expect((await open(ben)).payday).toBeNull();
    // Ben eats at Ana's: his energy there fills up.
    await sql(
      "update public.arena_bistro_staff set energy = 5 where player_id = $1 and friend_id = $2",
      [ana, ben],
    );
    await sql("delete from public.arena_bistro_dines where diner = $1", [ben]);
    await sql(
      "update public.arena_bistro_counter set dish = 'goicuon', servings = 6 where player_id = $1 and slot = 0",
      [ana],
    );
    expect((await friendAct(ben, ana, "dine")).ok).toBe(true);
    const [{ e }] = await sql(
      "select energy e from public.arena_bistro_staff where player_id = $1 and friend_id = $2",
      [ana, ben],
    );
    expect(e).toBe(100);
    // No longer friends: he stays on as a creature.
    await sql(
      "delete from public.arena_friendships where (a = $1 and b = $2) or (a = $2 and b = $1)",
      [ana, ben],
    );
    const after = await open(ana);
    const was = after.staff.find((x: any) => x.id === staff.id);
    expect(was.friend).toBeUndefined();
    expect(was.char).toBe(fighter);
    await sql("insert into public.arena_friendships(a, b) values ($1, $2)", [
      ana,
      ben,
    ]);
  });
});

describe("dish levels, ingredients, the Market and the Farm (migration 074)", () => {
  it("the Market sells the same four ingredients at the same prices", async () => {
    const { marketOffers, BASE_INGREDIENTS } =
      await import("../../packages/shared/src/bistro");
    for (const ms of [
      0,
      1_800_000_000_000,
      1_800_000_000_000 + 4 * 3600_000 * 7 + 5,
      1_900_123_456_789,
    ]) {
      const offers = marketOffers(ms);
      expect(new Set(offers.map((o) => o.id)).size).toBe(4);
      for (const id of BASE_INGREDIENTS) {
        const [{ p }] = await sql(
          "select public.arena_bistro_market_price(to_timestamp($1::double precision / 1000), $2) p",
          [ms, id],
        );
        expect(p).toBe(offers.find((o) => o.id === id)?.price ?? null);
      }
    }
  });
  it("cooking builds mastery; a level-up takes ingredients and coins; plates sell for more", async () => {
    await setCoins(cal, 50000, 12);
    await sql("delete from public.arena_bistro_dish_lv where player_id = $1", [
      cal,
    ]);
    await sql(
      "update public.arena_bistro_stoves set dish = null, started_at = null, dur_ms = null, perfect = false where player_id = $1",
      [cal],
    );
    await sql(
      "update public.arena_bistro_counter set dish = null, servings = 0, perfect = false where player_id = $1",
      [cal],
    );
    // Five batches of Pho: five points of mastery.
    for (let n = 0; n < 5; n++) {
      await act(cal, [{ a: "cook", stove: 0, dish: "pho" }]);
      await sql(
        "update public.arena_bistro_stoves set started_at = started_at - interval '2 minutes' where player_id = $1 and idx = 0",
        [cal],
      );
      const r = await act(cal, [{ a: "plate", stove: 0 }]);
      expect(r.results[0].ok).toBe(true);
    }
    let b = await open(cal);
    expect(b.dishLv.pho).toEqual({ lv: 1, mastery: 5 });
    await sql("delete from public.arena_bistro_pantry where player_id = $1", [
      cal,
    ]);
    let r = await act(cal, [{ a: "dishup", dish: "pho" }]);
    expect(r.results[0].error).toBe("You need 1 Flour.");
    await sql(
      "insert into public.arena_bistro_pantry(player_id, ingredient, qty) values ($1, 'flour', 3), ($1, 'herbs', 3)",
      [cal],
    );
    const local = sanitize(await open(cal));
    const coins = local.coins;
    r = await act(cal, [
      { a: "dishup", dish: "pho" },
      { a: "dishup", dish: "pho" },
    ]);
    expect(r.results[0].ok).toBe(true);
    expect(r.results[1].error).toBe("Cook 10 more batches of Pho first.");
    const { dishUp, payment, priceAt, servingsAt } =
      await import("../../packages/shared/src/bistro");
    expect(dishUp(local, "pho").ok).toBe(true);
    expect(r.bistro.coins).toBe(coins - 40 * 2);
    expect(r.bistro.dishLv.pho).toEqual({ lv: 2, mastery: 0 });
    expect(r.bistro.pantry).toEqual({ flour: 2, herbs: 2 });
    expect(sanitize(r.bistro).pantry).toEqual(local.pantry);
    // A level-2 Pho: 9 coins a plate (8 × 1.12), the same on both sides.
    expect(priceAt("pho", 2)).toBe(9);
    expect(servingsAt("pho", 4)).toBe(11);
    const counter = r.bistro.counter.find((c: any) => c?.dish === "pho");
    expect(counter.servings).toBeGreaterThan(0);
    const before = r.bistro.coins;
    r = await act(cal, [
      {
        a: "serve",
        dish: "pho",
        vip: false,
        combo: 1,
        hearts: 3,
        quick: false,
      },
    ]);
    expect(r.results[0].ok).toBe(true);
    expect(r.bistro.coins - before).toBe(
      payment("pho", {
        hearts: 3,
        level: 2,
        special: r.bistro.special === "pho",
        // A serve inside a rush hour (by the server's clock) doubles the tip.
        rush: inRush(Number(r.bistro.now)),
      }).total,
    );
    // Gourmet points count toward popularity.
    const [{ g, p }] = await sql(
      "select public.arena_bistro_gourmet($1) g, public.arena_bistro_popularity($1) p",
      [cal],
    );
    expect(g).toBe(2); // (2 − 1) × Pho's level 2
    b = await open(cal);
    expect(p).toBeCloseTo(
      popularity(sanitize(b), {
        likesWeek: b.likesWeek,
        dinedToday: b.friendGuests.length,
      }).total,
      1,
    );
  });
  it("buys at the Market (5 of each a day), brings Farm crops (3 for 1, 30 a day), and level-ups give ingredients", async () => {
    const { marketOffers, levelIngredients } =
      await import("../../packages/shared/src/bistro");
    await setCoins(cal, 50000, 12);
    await sql("delete from public.arena_bistro_pantry where player_id = $1", [
      cal,
    ]);
    const [{ now }] = await sql(
      "select (extract(epoch from now()) * 1000)::bigint now",
    );
    const offer = marketOffers(Number(now))[0];
    let r = await act(cal, [
      { a: "market", id: offer.id, qty: 4 },
      { a: "market", id: offer.id, qty: 2 },
      { a: "market", id: offer.id, qty: 1 },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, false, true]);
    expect(r.results[1].error).toMatch(/^At most 5 /);
    expect(r.bistro.pantry[offer.id]).toBe(5);
    expect(r.bistro.marketBought[offer.id]).toBe(5);
    const missing = [
      "rice",
      "flour",
      "herbs",
      "pork",
      "egg",
      "beans",
      "coconut",
      "coffee",
      "milk",
      "chili",
    ].find((x) => !marketOffers(Number(now)).some((o) => o.id === x))!;
    r = await act(cal, [{ a: "market", id: missing, qty: 1 }]);
    expect(r.results[0].error).toBe("That's not at the Market right now.");
    // The Farm: 7 plain wheat (and a golden one) make 2 flour.
    await sql(
      "insert into public.arena_farm_barn(player_id, crop, mutation, qty) values ($1, 'wheat', '', 7), ($1, 'wheat', 'gold', 4) on conflict (player_id, crop, mutation) do update set qty = excluded.qty",
      [cal],
    );
    expect((await open(cal)).farmCrops).toMatchObject({ wheat: 7 });
    r = await act(cal, [
      { a: "farm", id: "wheat", qty: 3 },
      { a: "farm", id: "wheat", qty: 2 },
      { a: "farm", id: "carrot", qty: 1 },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([false, true, false]);
    expect(r.results[0].error).toBe("You need 9 in the Farm's barn.");
    expect(r.bistro.pantry.flour).toBe(2);
    expect(r.bistro.farmSent).toBe(2);
    const barn = await sql(
      "select mutation, qty from public.arena_farm_barn where player_id = $1 and crop = 'wheat' order by mutation",
      [cal],
    );
    expect(barn).toEqual([
      { mutation: "", qty: 1 },
      { mutation: "gold", qty: 4 },
    ]);
    // A level-up: three ingredients.
    await sql("delete from public.arena_bistro_pantry where player_id = $1", [
      cal,
    ]);
    await sql(
      "update public.arena_bistros set level = 13, xp = 0 where player_id = $1",
      [cal],
    );
    const [{ need }] = await sql("select public.arena_bistro_need(13) need");
    await sql("select public.arena_bistro_add_xp($1, $2)", [cal, need]);
    const pantry = Object.fromEntries(
      (
        await sql(
          "select ingredient, qty from public.arena_bistro_pantry where player_id = $1",
          [cal],
        )
      ).map((x: any) => [x.ingredient, x.qty]),
    );
    expect(pantry).toEqual(Object.fromEntries(levelIngredients(14)));
  });
  it("a meal at a friend's bistro pays its level's price and gives an ingredient to take home", async () => {
    await sql("delete from public.arena_bistro_dines where diner = $1", [ben]);
    await sql(
      "update public.arena_bistro_counter set dish = case slot when 0 then 'pho' else null end, servings = case slot when 0 then 9 else 0 end where player_id = $1",
      [ana],
    );
    await sql(
      "insert into public.arena_bistro_dish_lv(player_id, dish, lv, mastery) values ($1, 'pho', 4, 0) on conflict (player_id, dish) do update set lv = 4",
      [ana],
    );
    await sql("delete from public.arena_bistro_pantry where player_id = $1", [
      ben,
    ]);
    const r = await friendAct(ben, ana, "dine");
    expect(r).toMatchObject({ ok: true, dish: "pho" });
    // 8 × 1.36 = 11, and a 50% tip.
    expect(r.paid).toBe(11 + 6);
    expect(["flour", "herbs", "spice"]).toContain(r.ingredient);
    const [{ q }] = await sql(
      "select qty q from public.arena_bistro_pantry where player_id = $1 and ingredient = $2",
      [ben, r.ingredient],
    );
    expect(q).toBe(1);
    // A visitor doesn't see their pantry.
    expect(r.bistro.pantry).toBeUndefined();
  });
});

describe("the long game (migration 100)", () => {
  it("prices with dish levels and stars, events by date, regulars' stories: the same as the shared rules", async () => {
    const B = await import("../../packages/shared/src/bistro");
    for (const p of [4, 5, 8, 13, 30, 70])
      for (const lv of [1, 2, 5, 10])
        for (const st of [0, 1, 3, 5]) {
          const [{ v }] = await sql(
            "select public.arena_bistro_price_at($1, $2, $3) v",
            [p, lv, st],
          );
          const d = B.DISHES.find((x) => x.price === p) ?? B.DISHES[0];
          expect(v).toBe(
            Math.round((p * (100 + 12 * (lv - 1)) * (10 + st)) / 1000),
          );
          if (d.price === p) expect(v).toBe(B.priceAt(d.id, lv, st));
        }
    for (const day of [
      "2026-01-05",
      "2026-02-28",
      "2026-03-01",
      "2026-09-14",
      "2026-09-15",
      "2026-11-30",
      "2026-12-01",
      "2026-12-15",
      "2026-07-04",
    ]) {
      const [{ e }] = await sql(
        "select public.arena_bistro_event($1::date) e",
        [day],
      );
      expect(e).toBe(B.eventOn(day)?.id ?? null);
    }
    const steps = await sql(
      "select rid, level, name, step, dish, qty from public.arena_bistro_regular_steps order by rid, step",
    );
    const mine = B.REGULARS.flatMap((g) =>
      g.steps.map((st, i) => ({
        rid: g.id,
        level: g.level,
        name: g.name,
        step: i,
        dish: st.dish,
        qty: st.qty,
      })),
    ).sort((a, b) =>
      a.rid < b.rid ? -1 : a.rid > b.rid ? 1 : a.step - b.step,
    );
    expect(steps).toEqual(mine);
  });
  it("catering orders: posted by level, filled from the counter, paid 1.6 times; a skip waits longer", async () => {
    const B = await import("../../packages/shared/src/bistro");
    await setCoins(ana, 50000, 12);
    let b = await open(ana);
    expect(b.orders).toHaveLength(3);
    const o = b.orders.find((x: any) => x.dishes)!;
    expect(o.dishes.length).toBeGreaterThan(0);
    let pay = 0;
    for (const d of o.dishes)
      pay += d.qty * B.priceAt(d.dish, b.dishLv[d.dish]?.lv ?? 1, b.stars);
    expect(o.coins).toBe(Math.round(pay * 1.6));
    expect(o.expires - b.now).toBeGreaterThan(5.9 * 3600_000);
    // Not enough on the counter yet.
    await sql(
      "update public.arena_bistro_counter set dish = null, servings = 0, perfect = false where player_id = $1",
      [ana],
    );
    let r = await act(ana, [{ a: "order", slot: o.slot }]);
    expect(r.results[0].error).toBe(
      "Nothing for this order on the counter yet.",
    );
    // Stock the counter (one slot a dish) and fill it.
    for (const [i, d] of o.dishes.entries())
      await sql(
        "update public.arena_bistro_counter set dish = $2, servings = $3 where player_id = $1 and slot = $4",
        [ana, d.dish, d.qty + 2, i],
      );
    b = await open(ana);
    const local = sanitize(b);
    const lo = (b.orders as any[]).find((x) => x.slot === o.slot);
    expect(B.fillOrder(local, lo).ok).toBe(true);
    r = await act(ana, [{ a: "order", slot: o.slot }]);
    expect(r.results[0].ok).toBe(true);
    expect(r.bistro.coins).toBe(local.coins);
    expect(r.bistro.counter).toEqual(local.counter);
    const done = r.bistro.orders.find((x: any) => x.slot === o.slot);
    expect(done.dishes).toBeNull();
    expect(done.next - r.bistro.now).toBeGreaterThan(14 * 60_000);
    // Skip another: back in 30 minutes.
    const other = r.bistro.orders.find((x: any) => x.dishes)!;
    r = await act(ana, [
      { a: "skip", slot: other.slot },
      { a: "skip", slot: other.slot },
    ]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, false]);
    expect(
      r.bistro.orders.find((x: any) => x.slot === other.slot).next -
        r.bistro.now,
    ).toBeGreaterThan(29 * 60_000);
    // Ten league points for the order.
    expect(
      r.bistro.league.week.find((x: any) => x.me).points,
    ).toBeGreaterThanOrEqual(10);
  });
  it("catering orders fill as you go (migration 102): put aside, kept from guests, paid when complete", async () => {
    const B = await import("../../packages/shared/src/bistro");
    await setCoins(ben, 50000, 12);
    await open(ben);
    // One order of 10 Pho, nothing put aside yet.
    await sql(
      "update public.arena_bistro_orders set dishes = '[{\"dish\": \"pho\", \"qty\": 10}]'::jsonb, coins = 160, xp = 20, tokens = 0, filled = '{}'::jsonb, expires_at = now() + interval '6 hours', next_at = null where player_id = $1 and slot = 0",
      [ben],
    );
    const stock = (servings: number) =>
      sql(
        "update public.arena_bistro_counter set dish = case slot when 0 then 'pho' end, servings = case slot when 0 then $2 else 0 end, perfect = false where player_id = $1",
        [ben, servings],
      );
    await stock(6);
    let b = await open(ben);
    const coins = b.coins;
    // The shared rules, on the same state.
    const local = sanitize(b);
    const lo = JSON.parse(
      JSON.stringify(b.orders.find((x: any) => x.slot === 0)),
    );
    const res = B.fillOrder(local, lo);
    expect(res).toEqual({ ok: true, done: false, put: 6 });
    let r = await act(ben, [{ a: "order", slot: 0 }]);
    expect(r.results[0].ok).toBe(true);
    let o = r.bistro.orders.find((x: any) => x.slot === 0);
    expect(o.filled).toEqual({ pho: 6 });
    expect(o.filled).toEqual(lo.filled);
    expect(r.bistro.counter).toEqual(local.counter);
    expect(r.bistro.coins).toBe(coins);
    // Put aside is off the counter: a guest can't buy it.
    r = await act(ben, [{ a: "serve", dish: "pho", hearts: 3 }]);
    expect(r.results[0].ok).toBe(false);
    // Another batch: 6 more, only 4 are needed; it is delivered and paid.
    await stock(6);
    r = await act(ben, [{ a: "order", slot: 0 }]);
    expect(r.results[0].ok).toBe(true);
    o = r.bistro.orders.find((x: any) => x.slot === 0);
    expect(o.dishes).toBeNull();
    expect(o.filled).toEqual({});
    expect(r.bistro.coins).toBe(coins + 160);
    expect(r.bistro.counter[0]).toEqual({
      dish: "pho",
      servings: 2,
      perfect: false,
    });
    // A skip gives back what was put aside.
    await sql(
      'update public.arena_bistro_orders set dishes = \'[{"dish": "pho", "qty": 10}]\'::jsonb, filled = \'{"pho": 5}\'::jsonb, expires_at = now() + interval \'6 hours\', next_at = null where player_id = $1 and slot = 0',
      [ben],
    );
    await stock(1);
    r = await act(ben, [{ a: "skip", slot: 0 }]);
    expect(r.results[0].ok).toBe(true);
    expect(r.bistro.counter[0]).toEqual({
      dish: "pho",
      servings: 6,
      perfect: false,
    });
    // So does an order that expires.
    await sql(
      'update public.arena_bistro_orders set dishes = \'[{"dish": "pho", "qty": 10}]\'::jsonb, filled = \'{"pho": 3}\'::jsonb, expires_at = now() - interval \'1 minute\', next_at = null where player_id = $1 and slot = 1',
      [ben],
    );
    await stock(0);
    b = await open(ben);
    expect(b.counter[0]).toEqual({ dish: "pho", servings: 3, perfect: false });
    expect(b.orders.find((x: any) => x.slot === 1).filled).toEqual({});
  });
  it("a regular's three visits: thanks each time, a Golden Plate at the end", async () => {
    const B = await import("../../packages/shared/src/bistro");
    await setCoins(ana, 50000, 12);
    await sql("delete from public.arena_bistro_regulars where player_id = $1", [
      ana,
    ]);
    let r = await act(ana, [
      { a: "regular", id: "nobody" },
      { a: "regular", id: "sage" },
    ]);
    expect(r.results[0].error).toBe("Nobody by that name.");
    expect(r.results[1].error).toBe("Sage comes by at level 20.");
    const g = B.REGULAR_BY_ID.mira;
    for (const [i, st] of g.steps.entries()) {
      await sql(
        "update public.arena_bistro_counter set dish = case slot when 0 then $2 else null end, servings = case slot when 0 then $3 else 0 end where player_id = $1",
        [ana, st.dish, st.qty],
      );
      const local = sanitize(await open(ana));
      const ev =
        B.eventOn((await sql("select public.arena_today()::text d"))[0].d)
          ?.id ?? null;
      expect(B.fillRegular(local, "mira", ev).ok).toBe(true);
      r = await act(ana, [{ a: "regular", id: "mira" }]);
      expect(r.results[0].ok).toBe(true);
      expect(r.bistro.coins).toBe(local.coins);
      expect(r.bistro.tokens).toBe(local.tokens);
      expect(r.bistro.regulars.mira).toBe(i + 1);
    }
    expect(r.bistro.stored.trophy).toBeGreaterThanOrEqual(1);
    r = await act(ana, [{ a: "regular", id: "mira" }]);
    expect(r.results[0].error).toBe("Mira's story is complete.");
  });
  it("event items for tokens while the event is on; gifts are never sold", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const [{ d }] = await sql("select public.arena_today()::text d");
    const ev = B.eventOn(d);
    await sql(
      "update public.arena_bistros set tokens = 100, token_event = public.arena_bistro_event(public.arena_today()) where player_id = $1",
      [ana],
    );
    const kind = ev ? ev.items[0] : "pumpkin";
    const other = ev?.id === "harvest" ? "lantern" : "pumpkin";
    const r = await act(ana, [
      { a: "buy", kind },
      { a: "buy", kind: other },
      { a: "buy", kind: "trophy" },
    ]);
    expect(r.results[0].ok).toBe(!!ev);
    expect(r.results[1].error).toBe("Only during its event.");
    expect(r.results[2].error).toBe("That one is a gift from a regular.");
    if (ev) expect(r.bistro.tokens).toBe(100 - B.ITEM_BY_KIND[kind].tokens!);
  });
  it("last week's league: claimed once, by your place among friends", async () => {
    await sql("delete from public.arena_bistro_league_claims");
    await sql(
      `insert into public.arena_bistro_week(player_id, week, points) values
        ($1, (date_trunc('week', public.arena_today()) - interval '7 days')::date, 120),
        ($2, (date_trunc('week', public.arena_today()) - interval '7 days')::date, 300)
       on conflict (player_id, week) do update set points = excluded.points`,
      [ana, ben],
    );
    const b = await open(ana);
    expect(b.league.last).toEqual({ points: 120, rank: 2, claimed: false });
    const coins = b.coins;
    const r = await act(ana, [{ a: "league" }, { a: "league" }]);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, false]);
    expect(r.bistro.coins).toBe(coins + 1200);
    expect(r.bistro.league.last.claimed).toBe(true);
  });
  it("a new branch at level 30: start over with a star, the furniture in storage, dishes kept", async () => {
    const B = await import("../../packages/shared/src/bistro");
    await setCoins(cal, 1000, 29);
    let r = await act(cal, [{ a: "branch" }]);
    expect(r.results[0].error).toBe("Open a new branch at level 30.");
    await setCoins(cal, 1000, 30);
    await sql(
      "insert into public.arena_bistro_dish_lv(player_id, dish, lv, mastery) values ($1, 'goicuon', 5, 0) on conflict (player_id, dish) do update set lv = 5",
      [cal],
    );
    const before = sanitize(await open(cal));
    const local = JSON.parse(JSON.stringify(before));
    expect(B.openBranch(local).ok).toBe(true);
    r = await act(cal, [{ a: "branch" }]);
    expect(r.results[0].ok).toBe(true);
    const after = sanitize(r.bistro);
    for (const k of [
      "level",
      "xp",
      "coins",
      "stars",
      "sizeLv",
      "kitchenLv",
      "shiftLv",
      "items",
      "staff",
      "stored",
      "dishLv",
    ] as const)
      expect(k === "staff" ? after.staff.map((x) => x.char) : after[k]).toEqual(
        k === "staff" ? local.staff.map((x: any) => x.char) : local[k],
      );
    expect(after.stars).toBe(1);
    expect(after.dishLv.goicuon?.lv).toBe(5);
    // Plates now sell at the star's price.
    expect(B.priceAt("goicuon", 5, 1)).toBe(Math.round((4 * 148 * 11) / 1000));
  });
});

describe("the cooks in step (migration 101)", () => {
  it("online, a cook's dish done since the last request is plated and the next started now", async () => {
    await open(cal);
    await setCoins(cal, 5000, 5);
    const [{ c }] = await sql("select (public.arena_champion_ids())[3] c");
    await sql(
      "delete from public.arena_bistro_staff where player_id = $1 and role = 'cook'",
      [cal],
    );
    await sql(
      "insert into public.arena_bistro_staff(player_id, id, creature, role, dish) values ($1, 50, $2, 'cook', 'goicuon')",
      [cal, c],
    );
    // The cook runs the last stove. Their batch was started 13 s ago and
    // takes 10 s; the request before was 5 s ago, when it wasn't done yet.
    await sql(
      "update public.arena_bistro_stoves set dish = 'goicuon', started_at = now() - interval '13 seconds', dur_ms = 10000, perfect = false where player_id = $1 and idx = (select max(idx) from public.arena_bistro_stoves where player_id = $1)",
      [cal],
    );
    await sql(
      "update public.arena_bistro_counter set dish = null, servings = 0, perfect = false where player_id = $1",
      [cal],
    );
    await sql(
      "update public.arena_bistros set last_seen = now() - interval '5 seconds' where player_id = $1",
      [cal],
    );
    const b = await open(cal);
    const last = b.stoves[b.stoves.length - 1];
    // Plated, and the next batch started now, as the scene's own cooks do
    // it: the answer doesn't take back what the scene shows.
    expect(
      b.counter.find((x: any) => x?.dish === "goicuon")?.servings,
    ).toBeGreaterThan(0);
    expect(last.dish).toBe("goicuon");
    expect(Math.abs(Number(last.start) - Number(b.now))).toBeLessThan(2000);
  });
});
