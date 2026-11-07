import { describe, expect, it } from "vitest";
import {
  COLS,
  COUNTER_SLOTS,
  DISHES,
  DISH_BY_ID,
  DOOR,
  PERFECT_BONUS,
  PERFECT_FROM,
  ROWS,
  addXp,
  blockedGrid,
  buyItem,
  buyStove,
  buyStyle,
  canPlace,
  cookProgress,
  defaultState,
  findPath,
  hire,
  upgradeStaff,
  setCookDish,
  candidates,
  autoKitchen,
  simulateAway,
  buyKitchen,
  buyShift,
  cookMs,
  nextHire,
  staffOf,
  SHIFT_HOURS,
  AWAY_MIN_MS,
  inPerfectWindow,
  payment,
  pickOrder,
  pickupTile,
  planWorks,
  plate,
  putAway,
  rate,
  sanitize,
  seats,
  servingsLeft,
  startCooking,
  stir,
  takeServing,
  todaySpecial,
  tryPlace,
  unlockedDishes,
  xpToNext,
} from "../../apps/client/src/bistro/bistro-model";

const T0 = 1_800_000_000_000;

describe("bistro: the starting restaurant", () => {
  it("has a working floor plan: three tables, six seats, a way to every seat", () => {
    const s = defaultState();
    expect(planWorks(s.items).ok).toBe(true);
    expect(seats(s.items)).toHaveLength(6);
    expect(s.stoves).toHaveLength(2);
    expect(servingsLeft(s)).toBe(6);
  });
  it("chairs seat a guest only next to a table, facing it", () => {
    const s = defaultState();
    for (const seat of seats(s.items)) {
      const dx = seat.table.x - seat.chair.x,
        dy = seat.table.y - seat.chair.y;
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
      expect(seat.dir).toBe(dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);
    }
    // A lone chair seats nobody.
    const lone = [
      ...s.items,
      { id: 99, kind: "chair" as const, x: 10, y: 3, rot: 0 },
    ];
    expect(seats(lone)).toHaveLength(6);
  });
});

describe("bistro: cooking", () => {
  it("costs coins, takes the dish's time and puts its servings on the counter", () => {
    const s = defaultState();
    s.counter = [null, null, null, null];
    const coins = s.coins;
    expect(startCooking(s, 0, "banhmi", T0).ok).toBe(true);
    expect(s.coins).toBe(coins - DISH_BY_ID.banhmi.cost);
    expect(startCooking(s, 0, "goicuon", T0).ok).toBe(false); // busy
    expect(plate(s, 0, T0 + 10_000).ok).toBe(false); // not ready
    expect(cookProgress(s.stoves[0], T0 + 15_000)).toBeCloseTo(0.5);
    const r = plate(s, 0, T0 + 30_000);
    expect(r.ok).toBe(true);
    expect(s.counter[0]).toEqual({
      dish: "banhmi",
      servings: 8,
      perfect: false,
    });
    expect(s.stoves[0].dish).toBeNull();
  });
  it("refuses dishes above your level and dishes you can't pay for", () => {
    const s = defaultState();
    expect(startCooking(s, 0, "lau", T0)).toMatchObject({ ok: false });
    s.coins = 5;
    expect(startCooking(s, 0, "goicuon", T0)).toMatchObject({ ok: false });
    expect(s.stoves[0].dish).toBeNull();
  });
  it("a tap in the golden part of the bar makes it perfect: more servings", () => {
    const s = defaultState();
    s.counter = [null, null, null, null];
    s.level = 2;
    expect(startCooking(s, 1, "pho", T0).ok).toBe(true);
    const ms = DISH_BY_ID.pho.seconds * 1000;
    expect(stir(s, 1, T0 + ms * 0.5)).toBe(false); // too early
    expect(inPerfectWindow(s.stoves[1], T0 + ms * (PERFECT_FROM + 0.01))).toBe(
      true,
    );
    expect(stir(s, 1, T0 + ms * (PERFECT_FROM + 0.01))).toBe(true);
    expect(stir(s, 1, T0 + ms * (PERFECT_FROM + 0.02))).toBe(false); // once
    plate(s, 1, T0 + ms);
    expect(s.counter[0]?.servings).toBe(
      DISH_BY_ID.pho.servings + PERFECT_BONUS,
    );
    expect(s.counter[0]?.perfect).toBe(true);
  });
  it("the same dish stacks on one counter spot; a full counter refuses a new dish", () => {
    const s = defaultState();
    s.level = 7;
    s.coins = 10_000;
    s.counter = [
      { dish: "goicuon", servings: 2, perfect: false },
      { dish: "pho", servings: 1, perfect: false },
      { dish: "che", servings: 1, perfect: false },
      { dish: "lau", servings: 1, perfect: false },
    ];
    startCooking(s, 0, "goicuon", T0);
    expect(plate(s, 0, T0 + 60_000).ok).toBe(true);
    expect(s.counter[0]?.servings).toBe(8);
    startCooking(s, 0, "banhmi", T0);
    expect(plate(s, 0, T0 + 60_000)).toMatchObject({ ok: false });
    expect(s.stoves[0].dish).toBe("banhmi"); // still on the stove
  });
});

describe("bistro: orders and payment", () => {
  it("orders come from what is on the counter, one serving at a time", () => {
    const s = defaultState();
    s.counter = [
      { dish: "goicuon", servings: 1, perfect: false },
      null,
      null,
      null,
    ];
    expect(pickOrder(s, () => 0.5, null, false)).toBe("goicuon");
    expect(takeServing(s, "goicuon")).toBe(0);
    expect(s.counter[0]).toBeNull();
    expect(pickOrder(s, () => 0.5, null, false)).toBeNull();
    expect(takeServing(s, "goicuon")).toBe(-1);
  });
  it("a VIP orders today's special when it is on the counter", () => {
    const s = defaultState();
    s.counter = [
      { dish: "goicuon", servings: 50, perfect: false },
      { dish: "banhmi", servings: 1, perfect: false },
      null,
      null,
    ];
    expect(pickOrder(s, () => 0.99, "banhmi", true)).toBe("banhmi");
  });
  it("tips grow with the streak, the hearts, a quick tap and a rush hour", () => {
    const plain = payment("pho", { combo: 1, hearts: 1 });
    expect(plain).toEqual({ base: 8, tip: 0, total: 8 });
    expect(payment("pho", { special: true, hearts: 1 }).base).toBe(12);
    expect(payment("pho", { vip: true, hearts: 1 }).base).toBe(20);
    const streak = payment("pho", { combo: 5, hearts: 3 });
    expect(streak.tip).toBeGreaterThan(0);
    expect(
      payment("pho", { combo: 5, hearts: 3, rush: true }).tip,
    ).toBeGreaterThan(streak.tip);
    // The streak caps at ×5.
    expect(payment("pho", { combo: 9, hearts: 3 })).toEqual(streak);
  });
  it("the rating moves a little toward each verdict and stays in 0..5", () => {
    expect(rate(3, 5)).toBeGreaterThan(3);
    expect(rate(3, 0)).toBeLessThan(3);
    let r = 3;
    for (let i = 0; i < 500; i++) r = rate(r, 5);
    expect(r).toBeLessThanOrEqual(5);
    expect(r).toBeGreaterThan(4.9);
  });
  it("today's special is the same all day and is a dish you can cook", () => {
    const a = todaySpecial(1, new Date(2026, 10, 6, 8));
    expect(todaySpecial(1, new Date(2026, 10, 6, 23))).toBe(a);
    expect(unlockedDishes(2).map((d) => d.id)).toContain(a);
  });
});

describe("bistro: levels", () => {
  it("levels up through XP and pays a small gift", () => {
    const s = defaultState();
    const coins = s.coins;
    const gained = addXp(s, xpToNext(1) + xpToNext(2));
    expect(gained).toBe(2);
    expect(s.level).toBe(3);
    expect(s.xp).toBe(0);
    expect(s.coins).toBeGreaterThan(coins);
  });
  it("every dish opens at a level and costs less than it earns", () => {
    for (const d of DISHES) {
      expect(d.level).toBeGreaterThanOrEqual(1);
      expect(d.servings * d.price).toBeGreaterThan(d.cost);
    }
  });
});

describe("bistro: the floor plan", () => {
  it("finds a path from the door to every counter pickup spot", () => {
    const s = defaultState();
    const g = blockedGrid(s.items);
    for (let i = 0; i < COUNTER_SLOTS; i++)
      expect(findPath(g, DOOR, pickupTile(i))).not.toBeNull();
  });
  it("keeps the kitchen, the doorway and the pickup spots clear", () => {
    const s = defaultState();
    expect(canPlace(s.items, "plant", 2, 1).ok).toBe(false);
    expect(canPlace(s.items, "plant", DOOR.x, DOOR.y).ok).toBe(false);
    expect(
      canPlace(s.items, "plant", pickupTile(0).x, pickupTile(0).y).ok,
    ).toBe(false);
    expect(canPlace(s.items, "plant", COLS, 4).ok).toBe(false);
    expect(canPlace(s.items, "plant", 4, 5).ok).toBe(false); // the table is there
    expect(canPlace(s.items, "plant", 1, 4).ok).toBe(true);
  });
  it("rugs lie under furniture but not under each other", () => {
    const s = defaultState();
    expect(canPlace(s.items, "rug", 7, 3).ok).toBe(true);
    expect(canPlace(s.items, "rug", 4, 6).ok).toBe(false); // overlaps the rug at 3,5
    expect(canPlace(s.items, "rug", COLS - 1, ROWS - 1).ok).toBe(false); // 2 × 2 runs off
  });
  it("refuses a placement that walls off the counter", () => {
    const s = defaultState();
    s.items = s.items.filter((i) => i.kind === "plant");
    s.stored = { plant: 20 };
    // A row of plants across the room on row 4, x 0..10 (the door is below it).
    let refused = false;
    for (let x = 0; x < COLS; x++) {
      const r = tryPlace(s, "plant", x, 4, 0);
      if (!r.ok) refused = true;
    }
    expect(refused).toBe(true);
    expect(planWorks(s.items).ok).toBe(true);
  });
  it("moves, places from storage and puts away", () => {
    const s = defaultState();
    const plant = s.items.find((i) => i.kind === "plant")!;
    expect(tryPlace(s, "plant", 1, 4, 0, plant).ok).toBe(true);
    expect(s.items.find((i) => i.id === plant.id)).toMatchObject({
      x: 1,
      y: 4,
    });
    expect(tryPlace(s, "lamp", 1, 5, 0)).toMatchObject({ ok: false }); // none stored
    expect(putAway(s, plant.id).ok).toBe(true);
    expect(s.stored.plant).toBe(1);
    expect(tryPlace(s, "plant", 1, 5, 0).ok).toBe(true);
    expect(s.stored.plant).toBeUndefined();
  });
});

describe("bistro: the shop", () => {
  it("buys items into storage, stoves up to four and one more waiter", () => {
    const s = defaultState();
    s.coins = 5000;
    s.level = 5;
    expect(buyItem(s, "aquarium").ok).toBe(true);
    expect(s.stored.aquarium).toBe(1);
    expect(buyItem(s, "fountain")).toMatchObject({ ok: false }); // level 6
    expect(buyStove(s).ok).toBe(true);
    expect(buyStove(s).ok).toBe(true);
    expect(buyStove(s)).toMatchObject({ ok: false });
    expect(s.stoves).toHaveLength(4);
    expect(buyKitchen(s).ok).toBe(true);
    expect(cookMs(s, "pho")).toBe(54_000);
    expect(buyShift(s).ok).toBe(true);
    expect(SHIFT_HOURS[s.shiftLv]).toBe(4);
    expect(buyStyle(s, "floor", "wood").ok).toBe(true);
    expect(s.floor).toBe("wood");
    const left = s.coins;
    expect(buyStyle(s, "floor", "checker").ok).toBe(true); // owned: free
    expect(buyStyle(s, "floor", "wood").ok).toBe(true);
    expect(s.coins).toBe(left);
  });
});

describe("bistro: saved state", () => {
  it("survives a round trip and rejects junk field by field", () => {
    const s = defaultState();
    s.coins = 1234;
    startCooking(s, 0, "goicuon", T0);
    expect(sanitize(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const junk = sanitize({
      coins: "lots",
      level: 999,
      items: [
        { kind: "table", x: 2, y: 1 }, // the kitchen
        { kind: "dragon", x: 8, y: 8 },
        { kind: "plant", x: 8, y: 8, id: 5 },
        { kind: "plant", x: 8, y: 8, id: 6 }, // on top of the other
      ],
      stoves: [{ dish: "nope" }, { dish: "pho", start: T0 }, {}, {}, {}, {}],
      counter: [{ dish: "pho", servings: -3 }],
      floor: "gold",
    });
    expect(junk.coins).toBe(defaultState().coins);
    expect(junk.level).toBe(30);
    expect(junk.items).toEqual([{ id: 5, kind: "plant", x: 8, y: 8, rot: 0 }]);
    expect(junk.stoves).toHaveLength(4);
    expect(junk.stoves[0].dish).toBeNull();
    expect(junk.counter.every((c) => c === null)).toBe(true);
    expect(junk.floor).toBe("checker");
    expect(sanitize(null)).toEqual(defaultState());
  });
});

describe("bistro: staff", () => {
  it("hires cooks and waiters by level, up to the team's size, never twice", () => {
    const s = defaultState();
    s.coins = 10_000;
    expect(staffOf(s, "waiter")).toHaveLength(1);
    expect(hire(s, "cook", "pyranda")).toMatchObject({ ok: false }); // level 2
    s.level = 2;
    expect(hire(s, "cook", "pyranda").ok).toBe(true);
    expect(hire(s, "cook", "pyranda")).toMatchObject({ ok: false }); // already hired
    expect(hire(s, "waiter", "glacelle")).toMatchObject({ ok: false }); // level 3
    s.level = 9;
    expect(hire(s, "waiter", "glacelle").ok).toBe(true);
    expect(hire(s, "waiter", "lumoth").ok).toBe(true);
    expect(nextHire(s, "waiter")).toBeNull();
    expect(hire(s, "waiter", "mystowl")).toMatchObject({ ok: false });
    expect(hire(s, "cook", "nobody")).toMatchObject({ ok: false });
  });
  it("training makes staff faster; cooks cook the dish they are given", () => {
    const s = defaultState();
    s.coins = 10_000;
    s.level = 4;
    hire(s, "cook", "pyranda");
    const cook = staffOf(s, "cook")[0];
    expect(upgradeStaff(s, cook.id).ok).toBe(true);
    expect(cook.level).toBe(2);
    expect(cookMs(s, "pho", cook.level)).toBeLessThan(cookMs(s, "pho"));
    expect(setCookDish(s, cook.id, "lau")).toMatchObject({ ok: false }); // level 7
    expect(setCookDish(s, cook.id, "pho").ok).toBe(true);
  });
  it("a cook starts their dish on their stove and plates it when it is done", () => {
    const s = defaultState();
    s.coins = 1000;
    s.level = 2;
    s.counter = [null, null, null, null];
    hire(s, "cook", "pyranda");
    setCookDish(s, staffOf(s, "cook")[0].id, "pho");
    const ev = autoKitchen(s, T0);
    expect(ev).toMatchObject([{ kind: "start", stove: 1, dish: "pho" }]);
    expect(s.stoves[0].dish).toBeNull(); // the head chef's stove is left alone
    expect(autoKitchen(s, T0 + 30_000)).toEqual([]);
    const done = autoKitchen(s, T0 + 60_000);
    expect(done.map((e) => e.kind)).toEqual(["plate", "start"]);
    expect(s.counter[0]).toMatchObject({ dish: "pho", servings: 10 });
  });
  it("candidates are three creatures not on the team, the same all day", () => {
    const s = defaultState();
    const a = candidates(s, "voltkit", new Date(2026, 10, 6, 9));
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(a).not.toContain("voltkit");
    expect(a).not.toContain("sunbara");
    expect(candidates(s, "voltkit", new Date(2026, 10, 6, 22))).toEqual(a);
  });
});

describe("bistro: while you are away", () => {
  it("nothing happens for a short absence or a first visit", () => {
    const s = defaultState();
    expect(simulateAway(s, 0, T0)).toBeNull();
    expect(simulateAway(s, T0, T0 + AWAY_MIN_MS - 1)).toBeNull();
  });
  it("waiters sell what is on the counter, then the bistro waits for food", () => {
    const s = defaultState();
    const coins = s.coins;
    const r = simulateAway(s, T0, T0 + 3600_000)!;
    expect(r.served).toBe(6); // the starting spring rolls, no cook
    expect(r.batches).toBe(0);
    expect(s.coins).toBe(coins + r.coins);
    expect(r.coins).toBeGreaterThanOrEqual(6 * 4);
  });
  it("a cook keeps food coming; the shift caps the time worked", () => {
    const s = defaultState();
    s.coins = 500;
    s.level = 2;
    hire(s, "cook", "pyranda");
    const coins = s.coins;
    const r = simulateAway(s, T0, T0 + 10 * 3600_000)!;
    expect(r.capped).toBe(true);
    expect(r.worked).toBe(SHIFT_HOURS[0] * 3600_000);
    expect(r.batches).toBeGreaterThan(10);
    expect(r.served).toBeGreaterThan(50);
    expect(r.coins - r.spent).toBeGreaterThan(0);
    // Coins: what guests paid, less ingredients, plus any level-up gifts.
    expect(s.coins).toBeGreaterThanOrEqual(coins + r.coins - r.spent);
    // A longer shift works longer.
    const t = defaultState();
    t.coins = 5000;
    t.level = 2;
    hire(t, "cook", "pyranda");
    buyShift(t);
    expect(simulateAway(t, T0, T0 + 10 * 3600_000)!.worked).toBe(4 * 3600_000);
  });
  it("cooks stop when there are no coins for ingredients", () => {
    const s = defaultState();
    s.level = 2;
    s.coins = 250;
    hire(s, "cook", "pyranda");
    s.counter = [null, null, null, null];
    expect(s.coins).toBe(0);
    const r = simulateAway(s, T0, T0 + 3600_000)!;
    expect(r.batches).toBe(0);
    expect(r.served).toBe(0);
  });
});

describe("bistro: expanding the dining room", () => {
  it("grows by level and price, and furniture may use the new tiles", async () => {
    const { buyExpand, sizeOf, EXPAND_STEPS } =
      await import("../../apps/client/src/bistro/bistro-model");
    const s = defaultState();
    s.coins = 50000;
    s.stored = { plant: 2 };
    expect(tryPlace(s, "plant", 12, 4, 0)).toMatchObject({ ok: false });
    expect(buyExpand(s)).toMatchObject({ ok: false }); // level 4
    s.level = 20;
    for (const step of EXPAND_STEPS) {
      const coins = s.coins;
      expect(buyExpand(s).ok).toBe(true);
      expect(s.coins).toBe(coins - step.price);
    }
    expect(buyExpand(s)).toMatchObject({ ok: false });
    expect(sizeOf(s.sizeLv)).toEqual({ cols: 21, rows: 14 });
    expect(tryPlace(s, "plant", 20, 13, 0).ok).toBe(true);
    expect(tryPlace(s, "plant", 21, 13, 0)).toMatchObject({ ok: false });
    // The far corner is reachable: a seat there works.
    const g = blockedGrid(s.items, -1, sizeOf(s.sizeLv));
    expect(findPath(g, DOOR, { x: 15, y: 10 })).not.toBeNull();
    // A saved bigger room keeps its far furniture.
    expect(sanitize(JSON.parse(JSON.stringify(s))).items).toEqual(s.items);
  });
});

describe("bistro: popularity (docs/bistro-gdd.md §4)", () => {
  it("adds service, decor and friends, less the mess, kept within 0..50", async () => {
    const { popularity, charm } =
      await import("../../packages/shared/src/bistro");
    const s = defaultState();
    expect(charm(s.items)).toBe(8);
    const p = popularity(s);
    expect(p.service).toBe(18); // rating 3 × 6
    expect(p.decor).toBeCloseTo(8 / 3, 10);
    expect(p.social).toBe(0);
    expect(p.total).toBeCloseTo(18 + 8 / 3, 10);
    const q = popularity(s, { likesWeek: 3, dinedToday: 2, dirty: 4 });
    expect(q.social).toBe(2.5);
    expect(q.mess).toBe(2);
    expect(q.total).toBeCloseTo(p.total + 0.5, 10);
    // Caps: friends 4, decor 10, mess 8, the total 0..50.
    expect(popularity(s, { likesWeek: 40 }).social).toBe(4);
    expect(
      popularity(
        { ...s, rating: 5, items: Array(30).fill(s.items[10]) },
        {
          likesWeek: 9,
          gourmet: 999,
        },
      ).total,
    ).toBe(50);
    expect(popularity({ ...s, rating: 0 }, { trash: 20 }).total).toBe(0);
  });
  it("sets the arrivals, the queue and the VIP share", async () => {
    const { arrivalSeconds, queueMax, queuePatience, vipShare, popTier } =
      await import("../../packages/shared/src/bistro");
    expect(arrivalSeconds(0, false)).toBe(9);
    expect(arrivalSeconds(50, false)).toBeCloseTo(2.2, 10);
    expect(arrivalSeconds(50, true)).toBeCloseTo(2.2 * 0.45, 10);
    expect(arrivalSeconds(25, false)).toBeCloseTo(5.6, 10);
    expect([0, 9, 10, 29, 40, 50].map(queueMax)).toEqual([1, 1, 2, 3, 5, 6]);
    expect(queuePatience(20)).toBe(25);
    expect(vipShare(0, false)).toBeCloseTo(0.06, 10);
    expect(vipShare(50, false)).toBeCloseTo(0.14, 10);
    expect(vipShare(50, true)).toBeCloseTo(0.182, 10);
    expect([0, 9.4, 9.6, 20, 39, 50].map(popTier)).toEqual([
      "Quiet",
      "Quiet",
      "Local Pick",
      "Busy",
      "Hot Spot",
      "Legendary",
    ]);
  });
});

describe("bistro: the floor plan's walks (docs/bistro-gdd.md §3)", () => {
  it("measures steps from the door and the counter for every seat", async () => {
    const { seatWalks, layoutStats, distField, sizeOf } =
      await import("../../packages/shared/src/bistro");
    const s = defaultState();
    const z = sizeOf(0);
    const d = distField(blockedGrid(s.items, -1, z), [DOOR]);
    expect(d[DOOR.x][DOOR.y]).toBe(0);
    expect(d[1][7]).toBe(1);
    expect(d[0][0]).toBe(-1); // the kitchen
    expect(seatWalks(s.items, z)).toEqual([
      { chair: 3, table: 2, guest: 5, waiter: 2 },
      { chair: 4, table: 2, guest: 7, waiter: 2 },
      { chair: 6, table: 5, guest: 12, waiter: 6 },
      { chair: 7, table: 5, guest: 10, waiter: 8 },
      { chair: 9, table: 8, guest: 7, waiter: 12 },
      { chair: 10, table: 8, guest: 11, waiter: 14 },
    ]);
    const lay = layoutStats(s.items, z);
    expect(lay.tMeal).toBeCloseTo(44 / 6 / 2.8 + 5, 10);
    expect(lay.grade).toBe("B");
  });
  it("a table far from the counter grades the plan down and slows service", async () => {
    const { layoutStats, serviceRate, sizeOf, tryPlace } =
      await import("../../packages/shared/src/bistro");
    const near = defaultState();
    near.staff.push({
      id: 9,
      char: "pyranda",
      role: "waiter",
      level: 1,
      dish: "pho",
    });
    const far = JSON.parse(JSON.stringify(near)) as typeof near;
    far.level = 12;
    far.sizeLv = 3;
    // The table by the counter and its chairs go to the far corner.
    const move = (id: number, x: number, y: number) =>
      expect(
        tryPlace(
          far,
          far.items.find((i) => i.id === id)!.kind,
          x,
          y,
          0,
          far.items.find((i) => i.id === id),
        ).ok,
      ).toBe(true);
    move(2, 15, 10);
    move(3, 14, 10);
    move(4, 16, 10);
    const a = layoutStats(near.items, sizeOf(0));
    const b = layoutStats(far.items, sizeOf(3));
    expect(b.seats).toHaveLength(6);
    expect(b.tMeal).toBeGreaterThan(a.tMeal + 2);
    expect(serviceRate(far)).toBeLessThan(serviceRate(near));
  });
  it("a seat nobody can reach doesn't count", async () => {
    const { seatWalks, sizeOf } =
      await import("../../packages/shared/src/bistro");
    const s = defaultState();
    // Wall the far table's chair in with plants (straight into the list:
    // the shop's own checks would refuse this plan).
    let id = 100;
    for (const [x, y] of [
      [10, 7],
      [9, 6],
      [9, 8],
    ])
      s.items.push({ id: id++, kind: "plant", x, y, rot: 0 });
    expect(seatWalks(s.items, sizeOf(0)).map((w) => w.chair)).not.toContain(10);
  });
});

describe("bistro: staff energy, janitors and friends (docs/bistro-gdd.md §1)", () => {
  it("drains by the hour, slows a tired worker, never stops them", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const s = defaultState();
    const w = s.staff[0];
    expect(B.energyOf(w)).toBe(100);
    expect(B.energyMax(5)).toBe(140);
    expect([100, 50, 49.9, 20, 19.9, 0].map(B.mood)).toEqual([
      1, 1, 0.85, 0.85, 0.6, 0.6,
    ]);
    // A waiter loses 12 an hour; a cook 14 (3.6 h to Hungry, 5.7 h to Exhausted).
    expect(B.afterWork(w, 100, 3_600_000, 0)).toBe(88);
    const cook = { ...w, role: "cook" as const };
    expect(B.afterWork(cook, 100, 3.6 * 3_600_000, 0)).toBeCloseTo(49.6, 6);
    expect(B.afterWork(cook, 100, 5.8 * 3_600_000, 0)).toBeLessThan(20);
    expect(B.afterWork(cook, 10, 99 * 3_600_000, 0)).toBe(0);
    // Two Staff Corners take half off; a third adds nothing.
    expect(B.drainPerHour("cook", 2)).toBe(7);
    s.items.push(
      ...[1, 2, 3].map((n) => ({
        id: 90 + n,
        kind: "corner" as const,
        x: 9 + n,
        y: 0,
        rot: 0,
      })),
    );
    expect(B.cornerCount(s.items)).toBe(2);
    // Rest brings 15 an hour back, up to the top.
    expect(B.afterRest(w, 0, 2 * 3_600_000)).toBe(30);
    expect(B.afterRest(w, 90, 2 * 3_600_000)).toBe(100);
    // Tired and friendly paces.
    expect(B.workSpeed(w, 10)).toBeCloseTo(0.6, 10);
    expect(
      B.workSpeed({ ...w, friend: { id: "x", name: "X" } }, 100),
    ).toBeCloseTo(1.1, 10);
  });
  it("a staff meal takes a serving and gives 50, once in 10 minutes", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const s = defaultState();
    s.lastSeen = T0;
    s.staff[0].energy = 30;
    const now = T0 + 3_600_000; // an hour later: 18 left
    expect(B.energyNow(s, s.staff[0], now)).toBeCloseTo(18, 10);
    expect(B.feedStaff(s, 1, now).ok).toBe(true);
    expect(s.counter[0]!.servings).toBe(5);
    expect(B.energyNow(s, s.staff[0], now)).toBeCloseTo(68, 10);
    expect(B.feedStaff(s, 1, now + 60_000)).toMatchObject({ ok: false });
    expect(B.feedStaff(s, 1, now + 11 * 60_000).ok).toBe(true);
    expect(B.energyNow(s, s.staff[0], now + 11 * 60_000)).toBe(100);
    s.counter = [null, null, null, null];
    expect(B.feedStaff(s, 1, now + 30 * 60_000)).toMatchObject({
      ok: false,
      error: "Nothing on the counter to eat.",
    });
  });
  it("hires janitors from level 4, a third cook at 9, and friends for any role", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const s = defaultState();
    s.coins = 10000;
    s.level = 3;
    expect(hire(s, "janitor", "pyranda")).toMatchObject({
      ok: false,
      error: "Hire at level 4.",
    });
    s.level = 9;
    expect(hire(s, "janitor", "pyranda").ok).toBe(true);
    const friend = { id: "00000000-0000-4000-8000-000000000001", name: "Bo" };
    // A friend whose fighter is a creature already on the team is fine…
    expect(hire(s, "waiter", "pyranda", friend).ok).toBe(true);
    // …but not twice.
    expect(hire(s, "cook", "glacelle", friend)).toMatchObject({ ok: false });
    for (const c of ["glacelle", "wombolder", "tidefin"])
      expect(hire(s, "cook", c).ok).toBe(true);
    expect(B.nextHire(s, "cook")).toBeNull();
    // A save keeps friends and energy.
    s.staff[1].energy = 42;
    const back = sanitize(JSON.parse(JSON.stringify(s)));
    expect(back.staff.find((x) => x.friend)?.friend).toEqual(friend);
    expect(back.staff[1].energy).toBe(42);
  });
  it("while you are away: litter piles up without a janitor, tired waiters serve fewer", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const base = () => {
      const s = defaultState();
      s.coins = 20000;
      s.level = 9;
      hire(s, "cook", "pyranda");
      hire(s, "cook", "glacelle");
      hire(s, "waiter", "wombolder");
      s.shiftLv = 3;
      return s;
    };
    const plain = base();
    const r1 = simulateAway(plain, T0, T0 + 8 * 3600_000)!;
    expect(plain.trash).toBe(10);
    // The staff end the shift worn down (8 h of work, no rest).
    expect(plain.staff.find((x) => x.role === "cook")!.energy).toBe(0);
    const swept = base();
    hire(swept, "janitor", "tidefin");
    simulateAway(swept, T0, T0 + 8 * 3600_000);
    expect(swept.trash).toBeLessThan(3);
    const tired = base();
    for (const st of tired.staff) st.energy = 0;
    const r3 = simulateAway(tired, T0, T0 + 8 * 3600_000)!;
    expect(r3.served).toBeLessThan(r1.served);
    // A long time away: the rest after the shift fills them up again.
    const rested = base();
    rested.shiftLv = 0;
    simulateAway(rested, T0, T0 + 12 * 3600_000);
    expect(rested.staff[0].energy).toBe(100);
  });
});

describe("bistro: dish levels and ingredients (docs/bistro-gdd.md §2)", () => {
  it("a level raises the price 12% and adds a serving every three", async () => {
    const B = await import("../../packages/shared/src/bistro");
    expect([1, 2, 5, 10].map((l) => B.priceAt("pho", l))).toEqual([
      8, 9, 12, 17,
    ]);
    expect([1, 3, 4, 7, 10].map((l) => B.servingsAt("pho", l))).toEqual([
      10, 10, 11, 12, 13,
    ]);
    expect(B.dishUpCost("pho", 1)).toEqual({
      mastery: 5,
      coins: 80,
      each: 1,
      spice: 0,
    });
    expect(B.dishUpCost("pho", 9)).toEqual({
      mastery: 45,
      coins: 2400,
      each: 9,
      spice: 3,
    });
    expect(B.dishUpCost("pho", 10)).toBeNull();
    expect(payment("pho", { level: 10, hearts: 1 }).base).toBe(17);
  });
  it("mastery comes from cooking; a level-up takes it, the ingredients and coins", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const s = defaultState();
    s.level = 3;
    s.coins = 10000;
    for (let i = 0; i < 4; i++) {
      B.startCooking(s, 0, "pho", T0);
      if (i === 0) s.stoves[0].perfect = true;
      expect(B.plate(s, 0, T0 + 3_600_000).ok).toBe(true);
    }
    expect(s.dishLv.pho).toEqual({ lv: 1, mastery: 5 });
    expect(B.dishUp(s, "pho")).toMatchObject({
      ok: false,
      error: "You need 1 Flour.",
    });
    s.pantry = { flour: 1, herbs: 1 };
    const coins = s.coins;
    expect(B.dishUp(s, "pho").ok).toBe(true);
    expect(s.coins).toBe(coins - 80);
    expect(s.pantry).toEqual({ flour: 0, herbs: 0 });
    expect(s.dishLv.pho).toEqual({ lv: 2, mastery: 0 });
    expect(B.gourmetOf(s)).toBe(2);
    expect(B.dishUp(s, "pho")).toMatchObject({
      ok: false,
      error: "Cook 10 more batches of Pho first.",
    });
    // Gourmet adds popularity (one point for every 40, up to 6).
    s.dishLv = Object.fromEntries(
      B.DISHES.map((d) => [d.id, { lv: 10, mastery: 0 }]),
    );
    expect(B.gourmetOf(s)).toBe(1215);
    expect(B.popularity(s).gourmet).toBe(6);
  });
  it("the Market: four different ingredients every four hours, 20 to 60 coins", async () => {
    const B = await import("../../packages/shared/src/bistro");
    for (let slot = 0; slot < 200; slot++) {
      const o = B.marketOffers(slot * B.MARKET_PERIOD_MS + 1);
      expect(new Set(o.map((x) => x.id)).size).toBe(4);
      for (const x of o)
        (expect(x.price).toBeGreaterThanOrEqual(20),
          expect(x.price).toBeLessThanOrEqual(60));
    }
    const now = 1_800_000_000_000;
    expect(B.marketNext(now) - now).toBeLessThanOrEqual(B.MARKET_PERIOD_MS);
    const s = defaultState();
    s.coins = 1000;
    const o = B.marketOffers(now)[0];
    expect(B.buyIngredient(s, o.id, 3, now, 0).ok).toBe(true);
    expect(s.pantry[o.id]).toBe(3);
    expect(s.coins).toBe(1000 - 3 * o.price);
    expect(B.buyIngredient(s, o.id, 3, now, 3)).toMatchObject({ ok: false });
  });
  it("Farm crops: three for one, 30 a day; level-ups give three ingredients", async () => {
    const B = await import("../../packages/shared/src/bistro");
    const s = defaultState();
    expect(B.fromFarm(s, "wheat", 2, 6, 0).ok).toBe(true);
    expect(s.pantry.flour).toBe(2);
    expect(B.fromFarm(s, "wheat", 3, 8, 0)).toMatchObject({
      error: "You need 9 in the Farm's barn.",
    });
    expect(B.fromFarm(s, "milk", 1, 3, 30)).toMatchObject({ ok: false });
    expect(B.fromFarm(s, "carrot", 1, 9, 0)).toMatchObject({ ok: false });
    const t = defaultState();
    addXp(t, 40); // level 2
    expect(t.level).toBe(2);
    expect(t.pantry).toEqual(Object.fromEntries(B.levelIngredients(2)));
  });
  it("while you are away, a levelled dish earns more", async () => {
    const run = (lv: number) => {
      const s = defaultState();
      s.coins = 5000;
      s.level = 9;
      hire(s, "cook", "pyranda");
      s.staff[1].dish = "pho";
      s.dishLv = { pho: { lv, mastery: 0 } };
      return simulateAway(s, T0, T0 + 2 * 3600_000)!;
    };
    expect(run(8).coins).toBeGreaterThan(run(1).coins);
  });
});

describe("meals", () => {
  it("guests sit longer over dishes that take longer to cook (the dearer ones)", async () => {
    const { mealSeconds, DISHES, SEAT_BASE } =
      await import("../../packages/shared/src/bistro");
    expect(mealSeconds("goicuon")).toBe(10);
    expect(mealSeconds("pho")).toBe(14);
    expect(mealSeconds("phoenix")).toBeCloseTo(22.6, 1);
    const bySeconds = [...DISHES].sort((a, b) => a.seconds - b.seconds);
    for (let i = 1; i < bySeconds.length; i++)
      expect(mealSeconds(bySeconds[i].id)).toBeGreaterThanOrEqual(
        mealSeconds(bySeconds[i - 1].id),
      );
    // No meal keeps a seat much past the server's turn of a seat.
    for (const d of DISHES)
      expect(mealSeconds(d.id)).toBeLessThan(SEAT_BASE + 5);
  });
});
