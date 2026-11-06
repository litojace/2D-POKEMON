/*
 * Element Bistro: keeping the scene and the server in step (migration 068).
 * The server owns the bistro: its clock, its coins, its rules. The scene
 * shows each action at once by running the same rules
 * (packages/shared/src/bistro.ts) on a local copy, and sends the actions in
 * small batches. Each answer is the server's whole bistro: the local copy
 * becomes that, then the actions not yet answered are run again on top, and
 * so are the servings guests have ordered but not yet paid for.
 */
import {
  addXp,
  buyItem,
  buyExpand,
  buyKitchen,
  buyShift,
  buyStove,
  buyStyle,
  hire,
  payment,
  plate,
  putAway,
  rate,
  sanitize,
  setCookDish,
  startCooking,
  stir,
  takeServing,
  tryPlace,
  upgradeStaff,
  BISTRO_TRADE,
  inRush,
  isDish,
  type AwayReport,
  type BistroState,
  type DishId,
  type ItemKind,
  type Role,
} from "./bistro-model";

export type BistroAction =
  | { a: "cook"; stove: number; dish: DishId }
  | { a: "stir"; stove: number }
  | { a: "plate"; stove: number }
  | {
      a: "serve";
      dish: DishId;
      vip: boolean;
      combo: number;
      hearts: number;
      quick: boolean;
    }
  | { a: "leave" }
  | {
      a: "place";
      kind: ItemKind;
      x: number;
      y: number;
      rot: number;
      id?: number;
    }
  | { a: "store"; id: number }
  | { a: "buy"; kind: ItemKind }
  | { a: "style"; kind: "floor" | "wall"; id: string }
  | { a: "stove" }
  | { a: "kitchen" }
  | { a: "shift" }
  | { a: "expand" }
  | { a: "hire"; role: Role; char: string }
  | { a: "train"; id: number }
  | { a: "cookdish"; id: number; dish: DishId }
  | { a: "chef"; id: string }
  | { a: "trade"; lots: number }
  | { a: "sync" };
export interface FriendGuest {
  name: string;
  fighter: string;
  dish: DishId;
}
/** What the server sends besides the bistro itself. */
export interface BistroExtras {
  special: DishId;
  chef: string;
  likes: number;
  leaves: number;
  tradedToday: number;
  friendGuests: FriendGuest[];
  dinesToday: number;
}
/** What a page was still waiting to send (kept in this browser). */
export interface SyncSnapshot {
  pending: { id: string; actions: BistroAction[] } | null;
  outbox: BistroAction[];
  reserved: [number, DishId][];
}
export interface BistroApi {
  load(): Promise<unknown>;
  act(request: string, actions: BistroAction[]): Promise<unknown>;
}
export interface ActResult {
  ok: boolean;
  error?: string;
}

/** Run one action on the local copy (the server runs the same rules). */
export function applyLocal(
  s: BistroState,
  x: BistroAction,
  now: number,
  extras?: BistroExtras,
): ActResult {
  const r = (v: { ok: boolean; error?: string }) =>
    v.ok ? { ok: true } : { ok: false, error: v.error };
  switch (x.a) {
    case "cook":
      return r(startCooking(s, x.stove, x.dish, now));
    case "stir":
      return stir(s, x.stove, now)
        ? { ok: true }
        : { ok: false, error: "Not the golden moment." };
    case "plate":
      return r(plate(s, x.stove, now));
    case "serve": {
      if (takeServing(s, x.dish) < 0)
        return { ok: false, error: "None left on the counter." };
      const bill = payment(x.dish, {
        vip: x.vip,
        combo: x.combo,
        hearts: x.hearts,
        quick: x.quick,
        special: x.dish === extras?.special,
        rush: inRush(now),
      });
      s.coins += bill.total;
      s.served++;
      s.rating = rate(s.rating, x.hearts === 3 ? 5 : x.hearts === 2 ? 4 : 2.5);
      addXp(s, x.vip ? 3 : 1);
      return { ok: true };
    }
    case "leave":
      s.rating = rate(s.rating, 0.5);
      return { ok: true };
    case "place": {
      const moving = x.id ? s.items.find((i) => i.id === x.id) : undefined;
      if (x.id && !moving) return { ok: false, error: "Nothing there." };
      return r(tryPlace(s, x.kind, x.x, x.y, x.rot, moving));
    }
    case "store":
      return r(putAway(s, x.id));
    case "buy":
      return r(buyItem(s, x.kind));
    case "style":
      return r(buyStyle(s, x.kind, x.id));
    case "stove":
      return r(buyStove(s));
    case "kitchen":
      return r(buyKitchen(s));
    case "shift":
      return r(buyShift(s));
    case "expand":
      return r(buyExpand(s));
    case "hire":
      return r(hire(s, x.role, x.char));
    case "train":
      return r(upgradeStaff(s, x.id));
    case "cookdish":
      return r(setCookDish(s, x.id, x.dish));
    case "chef":
      if (extras) extras.chef = x.id;
      return { ok: true };
    case "trade": {
      const leaves = x.lots * BISTRO_TRADE.leaves;
      if (s.coins < x.lots * BISTRO_TRADE.coins)
        return {
          ok: false,
          error: `You need ${x.lots * BISTRO_TRADE.coins} coins.`,
        };
      if (extras && extras.tradedToday + leaves > BISTRO_TRADE.dailyLeaves)
        return {
          ok: false,
          error: `You can trade for at most ${BISTRO_TRADE.dailyLeaves} Gold Leaves a day.`,
        };
      s.coins -= x.lots * BISTRO_TRADE.coins;
      if (extras) {
        extras.leaves += leaves;
        extras.tradedToday += leaves;
      }
      return { ok: true };
    }
    case "sync":
      return { ok: true };
  }
}

/** The server's bistro as the scene's state, and what came with it. */
export function readServer(raw: unknown): {
  state: BistroState;
  extras: BistroExtras;
  now: number;
  away: AwayReport | null;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  const state = sanitize(r);
  const num = (v: unknown, d = 0) =>
    typeof v === "number"
      ? v
      : typeof v === "string" && v !== ""
        ? Number(v)
        : d;
  // Big integers (timestamps) may come as strings.
  if (Array.isArray(r.stoves))
    state.stoves = state.stoves.map((st, i) => {
      const src = (r.stoves as Record<string, unknown>[])[i] ?? {};
      return { ...st, start: num(src.start, st.start) };
    });
  state.lastSeen = num(r.lastSeen);
  const guests = Array.isArray(r.friendGuests)
    ? (r.friendGuests as FriendGuest[])
    : [];
  const away =
    r.away && typeof r.away === "object" ? (r.away as AwayReport) : null;
  return {
    state,
    extras: {
      special: isDish(r.special) ? r.special : "goicuon",
      chef: typeof r.chef === "string" ? r.chef : "voltkit",
      likes: num(r.likes),
      leaves: num(r.leaves),
      tradedToday: num(r.tradedToday),
      friendGuests: guests.filter((g) => g && isDish(g.dish)),
      dinesToday: num(r.dinesToday),
    },
    now: num(r.now, Date.now()),
    away,
  };
}

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );

/**
 * The local copy and the queue to the server. `onAdopt` runs after each of
 * the server's answers (the scene redraws its HUD, shows errors, a report).
 */
export class BistroSync {
  S: BistroState;
  extras: BistroExtras;
  /** Server time minus this device's time (ms). */
  offset = 0;
  ready = false;
  private outbox: BistroAction[] = [];
  /**
   * The batch sent and not yet answered, with its request id. A retry sends
   * the same id, so the server applies it once even if the first try got
   * through (or the page closed before the answer came).
   */
  private pending: { id: string; actions: BistroAction[] } | null = null;
  private sending = false;
  /** Servings guests ordered, not yet paid for: guest id → dish. */
  private reserved = new Map<number, DishId>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  constructor(
    private api: BistroApi,
    private hooks: {
      onAdopt(info: {
        away: AwayReport | null;
        errors: { action: BistroAction; error: string }[];
      }): void;
      onFail(error: unknown): void;
    },
    initial?: { state: BistroState; extras: BistroExtras },
  ) {
    this.S = initial?.state ?? sanitize(null);
    this.extras = initial?.extras ?? {
      special: "goicuon",
      chef: "voltkit",
      likes: 0,
      leaves: 0,
      tradedToday: 0,
      friendGuests: [],
      dinesToday: 0,
    };
  }
  now() {
    return Date.now() + this.offset;
  }
  async load() {
    const raw = await this.api.load();
    if (this.closed) return;
    this.adopt(raw, []);
  }
  /** Run an action now and queue it for the server. */
  do(x: BistroAction): ActResult {
    const r = applyLocal(this.S, x, this.now(), this.extras);
    if (r.ok || x.a === "serve" || x.a === "leave") this.outbox.push(x);
    this.schedule(
      x.a === "serve" || x.a === "leave" || x.a === "sync" ? 800 : 150,
    );
    return r;
  }
  /** A guest's order: their serving leaves the counter until they pay or leave. */
  reserve(guest: number, dish: DishId): boolean {
    if (takeServing(this.S, dish) < 0) return false;
    this.reserved.set(guest, dish);
    return true;
  }
  release(guest: number) {
    const dish = this.reserved.get(guest);
    if (!dish) return;
    this.reserved.delete(guest);
    this.giveBack(dish);
  }
  /** The guest paid: their sale goes to the server. */
  pay(guest: number, sale: Omit<Extract<BistroAction, { a: "serve" }>, "a">) {
    const dish = this.reserved.get(guest) ?? sale.dish;
    this.reserved.delete(guest);
    this.giveBack(dish);
    return this.do({ a: "serve", ...sale, dish });
  }
  /** Orders still waiting to be paid (they keep their servings). */
  reservedCount() {
    return this.reserved.size;
  }
  private giveBack(dish: DishId) {
    let slot = this.S.counter.findIndex((c) => c?.dish === dish);
    if (slot < 0) slot = this.S.counter.findIndex((c) => !c);
    if (slot < 0) return;
    const c = this.S.counter[slot];
    this.S.counter[slot] = c
      ? { ...c, servings: c.servings + 1 }
      : { dish, servings: 1, perfect: false };
  }
  private schedule(ms: number) {
    if (this.closed) return;
    if (this.timer) {
      if (ms > 200) return; // a sooner flush is already coming
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, ms);
  }
  /** Send what is queued (one request at a time). */
  async flush() {
    if (this.sending || this.closed) return;
    if (!this.pending) {
      if (!this.outbox.length) return;
      this.pending = { id: uuid(), actions: this.outbox.splice(0, 40) };
    }
    const batch = this.pending;
    this.sending = true;
    try {
      const raw = (await this.api.act(batch.id, batch.actions)) as {
        bistro?: unknown;
        results?: ActResult[];
        away?: unknown;
      };
      this.sending = false;
      if (this.closed) return;
      const errors = (raw.results ?? [])
        .map((r, i) =>
          r && !r.ok && r.error
            ? { action: batch.actions[i], error: r.error }
            : null,
        )
        .filter((e): e is { action: BistroAction; error: string } => !!e);
      this.pending = null;
      this.adopt({ ...(raw.bistro as object), away: raw.away ?? null }, errors);
    } catch (e) {
      // Not answered: try the same batch again (same request id) shortly.
      this.sending = false;
      this.hooks.onFail(e);
      if (!this.closed) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.flush();
        }, 4000);
      }
      return;
    }
    if (this.outbox.length) this.schedule(150);
  }
  /** What is waiting to reach the server: kept with the bistro in this browser. */
  snapshot(): SyncSnapshot {
    return {
      pending: this.pending,
      outbox: [...this.outbox],
      reserved: [...this.reserved],
    };
  }
  /** Take back what a closed page was still waiting to send (see snapshot). */
  restore(snap: SyncSnapshot | undefined) {
    if (!snap) return;
    if (
      snap.pending &&
      Array.isArray(snap.pending.actions) &&
      typeof snap.pending.id === "string"
    )
      this.pending = snap.pending;
    if (Array.isArray(snap.outbox)) this.outbox.push(...snap.outbox);
    if (Array.isArray(snap.reserved))
      for (const [guest, dish] of snap.reserved)
        if (isDish(dish)) this.reserved.set(guest, dish);
    if (this.pending || this.outbox.length) this.schedule(150);
  }
  /** Take the server's bistro, then run again what it hasn't seen yet. */
  private adopt(
    raw: unknown,
    errors: { action: BistroAction; error: string }[],
  ) {
    const got = readServer(raw);
    this.offset = got.now - Date.now();
    this.S = got.state;
    this.extras = {
      ...got.extras,
      chef: this.extras.chef && this.ready ? this.extras.chef : got.extras.chef,
    };
    const now = this.now();
    // Sent and not yet answered, then queued: run again on top.
    for (const x of [...(this.pending?.actions ?? []), ...this.outbox])
      applyLocal(this.S, x, now, this.extras);
    for (const [guest, dish] of [...this.reserved])
      if (takeServing(this.S, dish) < 0) this.reserved.delete(guest);
    this.ready = true;
    this.hooks.onAdopt({ away: got.away, errors });
  }
  /** Keep "last seen" fresh while the bistro is open. */
  ping() {
    if (!this.outbox.length && !this.pending) this.do({ a: "sync" });
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
    // Whatever is still queued goes now (paid guests, a last move); the
    // same ids as kept in this browser, so a later retry can't double it.
    if (!this.sending && this.pending)
      void this.api.act(this.pending.id, this.pending.actions).catch(() => {});
    else if (!this.sending && this.outbox.length) {
      this.pending = { id: uuid(), actions: this.outbox.splice(0, 40) };
      void this.api.act(this.pending.id, this.pending.actions).catch(() => {});
    }
  }
}
