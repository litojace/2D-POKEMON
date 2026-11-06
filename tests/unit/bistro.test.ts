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
  hireWaiter,
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
    expect(hireWaiter(s).ok).toBe(true);
    expect(hireWaiter(s)).toMatchObject({ ok: false });
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
