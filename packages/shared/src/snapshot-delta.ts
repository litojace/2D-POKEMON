/**
 * Battle snapshots as changes (performance sweep S7; network-performance.md
 * section 21).
 *
 * Two thirds to three quarters of a snapshot repeats the one before it:
 * cooldowns, statuses, match statistics, scores, the raid's fixed parts.
 * A client that says it understands deltas is sent a whole snapshot once (a
 * keyframe: the usual `state` message, numbered `n`) and after that only
 * what changed since the snapshot before (`state-delta`).
 *
 * Both ends keep the last snapshot as plain JSON data, the "base":
 *
 * - the server's `SnapshotDeltaEncoder` walks the new snapshot against its
 *   base once, writing the differences down and bringing the base up to
 *   date in the same pass (no stringify, no second copy);
 * - the client's `SnapshotDeltaDecoder` applies those differences to its own
 *   base and hands the game a fresh copy, exactly what parsing the whole
 *   snapshot would have given it. Nothing after this point knows deltas
 *   exist.
 *
 * WebSocket (and long-polling) deliver in order and never drop a message of
 * a live connection, and the server sends a delta only to a connection it
 * has sent every snapshot before it. The numbers are a second lock on that:
 * a delta that does not follow the base (`n` is not the base's + 1, another
 * room, or it does not fit) is thrown away with the base, the client asks
 * for a keyframe (`state-full`) and shows nothing until it arrives. A
 * half-applied or misapplied snapshot is never shown.
 *
 * The format follows the data, with no list of field names to keep up to
 * date when a snapshot gains a field:
 *
 * - an object's delta is `{ s, d, x }`: keys set to a new value, keys whose
 *   object or list changed inside (their own delta), keys that went away;
 * - a list of things with an `id` (fighters, shots, zones, events) is
 *   matched by id: `{ o, a, u }` is the new order of ids when members came,
 *   went or moved, the new members in full, and `[index, delta]` for each
 *   member that changed;
 * - any other list (cooldowns, scores) is sent whole when it differs.
 *
 * Values are compared as JSON would write them: a key that is `undefined`
 * is absent, a number that is not finite is `null`.
 */
import type { WireSnapshot } from "./index.js";

type Data = null | boolean | number | string | Data[] | { [key: string]: Data };
type Dict = { [key: string]: Data };
type Id = string | number;

export interface ObjectDelta {
  /** Keys set to a new value (new keys too). */
  s?: Dict;
  /** Keys whose object or list changed inside: an ObjectDelta or ListDelta. */
  d?: { [key: string]: ObjectDelta | ListDelta };
  /** Keys that are gone. */
  x?: string[];
}
export interface ListDelta {
  /** The ids in their new order, when members came, went or moved. */
  o?: Id[];
  /** New members, whole, in the order `o` names them. */
  a?: Dict[];
  /** Members that changed inside: their place in the new list and the delta. */
  u?: [number, ObjectDelta][];
}
/** The `state-delta` message. */
export interface WireSnapshotDelta {
  code: string;
  /** This snapshot's number: it applies to the room's snapshot `n - 1`. */
  n: number;
  d: ObjectDelta;
}

/** A value JSON leaves out of an object (and writes as null in a list). */
const SKIP = Symbol("skip");
/** One value as JSON would write it; objects and lists are returned as is. */
function plain(v: unknown): unknown {
  switch (typeof v) {
    case "number":
      return Number.isFinite(v) ? v : null;
    case "string":
    case "boolean":
      return v;
    case "object": {
      if (v === null) return null;
      const toJSON = (v as { toJSON?: unknown }).toJSON;
      return typeof toJSON === "function"
        ? plain((v as { toJSON(): unknown }).toJSON())
        : v;
    }
    case "bigint":
      throw new TypeError("A snapshot cannot carry a BigInt");
    default:
      return SKIP;
  }
}
/** A copy of `v` (already `plain`) as parsing its JSON would build it. */
function copy(v: unknown): Data {
  if (v === null || typeof v !== "object") return v as Data;
  if (Array.isArray(v)) {
    const out = new Array<Data>(v.length);
    for (let i = 0; i < v.length; i++) {
      const e = plain(v[i]);
      out[i] = e === SKIP ? null : copy(e);
    }
    return out;
  }
  const out: Dict = {};
  for (const key of Object.keys(v)) {
    const e = plain((v as Record<string, unknown>)[key]);
    if (e !== SKIP) out[key] = copy(e);
  }
  return out;
}
/** A deep copy of JSON data (what the game is handed: it may keep or change it). */
export function cloneData<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = cloneData(v[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const key in v)
    out[key] = cloneData((v as Record<string, unknown>)[key]);
  return out as T;
}
const isDict = (v: unknown): v is Dict =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (v: unknown): Id | undefined => {
  if (!isDict(v)) return undefined;
  const id = (v as { id?: unknown }).id;
  return typeof id === "string" ||
    (typeof id === "number" && Number.isFinite(id))
    ? id
    : undefined;
};
/** Whether base data and a live value would be the same JSON. */
function same(base: Data, live: unknown): boolean {
  if (base === live) return true;
  if (base === null || typeof base !== "object") return false;
  if (live === null || typeof live !== "object") return false;
  if (Array.isArray(base)) {
    if (!Array.isArray(live) || live.length !== base.length) return false;
    for (let i = 0; i < base.length; i++) {
      const e = plain(live[i]);
      if (!same(base[i], e === SKIP ? null : e)) return false;
    }
    return true;
  }
  if (Array.isArray(live)) return false;
  let count = 0;
  for (const key of Object.keys(live)) {
    const e = plain((live as Record<string, unknown>)[key]);
    if (e === SKIP) continue;
    if (!(key in base) || !same(base[key], e)) return false;
    count++;
  }
  return count === Object.keys(base).length;
}

/** Marks a list that was replaced whole rather than patched. */
const REPLACED = Symbol("replaced");

/**
 * Bring `base` up to `live` and return what changed (undefined: nothing).
 * Values the delta carries are the base's own: write the delta out (JSON)
 * before the next call.
 */
function syncObject(base: Dict, live: object): ObjectDelta | undefined {
  let s: Dict | undefined,
    d: ObjectDelta["d"],
    x: string[] | undefined,
    kept = 0;
  const keys = Object.keys(live);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const v = plain((live as Record<string, unknown>)[key]);
    if (v === SKIP) continue;
    kept++;
    const old = base[key];
    if (old === v) {
      // The same number, string, true/false or null (an absent key is
      // undefined, and `v` never is).
      continue;
    }
    if (old === undefined && !(key in base)) {
      (s ??= {})[key] = base[key] = copy(v);
      continue;
    }
    if (v !== null && typeof v === "object") {
      if (Array.isArray(v)) {
        if (Array.isArray(old)) {
          const sub = syncList(old, v);
          if (sub === REPLACED) (s ??= {})[key] = base[key] = copy(v);
          else if (sub) (d ??= {})[key] = sub;
          continue;
        }
      } else if (isDict(old)) {
        const sub = syncObject(old, v);
        if (sub) (d ??= {})[key] = sub;
        continue;
      }
    }
    (s ??= {})[key] = base[key] = copy(v);
  }
  // A key the snapshot no longer has (rare: counted, then looked for).
  let had = 0;
  for (const _ in base) had++;
  if (had !== kept)
    for (const key of Object.keys(base))
      if (
        !Object.prototype.hasOwnProperty.call(live, key) ||
        plain((live as Record<string, unknown>)[key]) === SKIP
      ) {
        delete base[key];
        (x ??= []).push(key);
      }
  if (!s && !d && !x) return undefined;
  const out: ObjectDelta = {};
  if (s) out.s = s;
  if (d) out.d = d;
  if (x) out.x = x;
  return out;
}
function syncList(
  base: Data[],
  live: unknown[],
): ListDelta | typeof REPLACED | undefined {
  // The usual tick: the same things in the same places.
  let aligned = base.length === live.length;
  let keyed = true;
  for (let i = 0; i < live.length; i++) {
    const id = idOf(live[i]);
    if (id === undefined) {
      keyed = false;
      break;
    }
    if (aligned && idOf(base[i]) !== id) aligned = false;
  }
  if (!keyed) {
    // Numbers, strings, pairs: a short list, sent whole when it differs.
    return same(base, live) ? undefined : REPLACED;
  }
  let u: ListDelta["u"];
  if (aligned) {
    for (let i = 0; i < live.length; i++) {
      const sub = syncObject(base[i] as Dict, live[i] as object);
      if (sub) (u ??= []).push([i, sub]);
    }
    return u ? { u } : undefined;
  }
  // Members came, went or moved: match the rest by id.
  const old = new Map<Id, Dict>();
  for (const e of base) {
    const id = idOf(e);
    if (id === undefined || old.has(id)) return REPLACED;
    old.set(id, e as Dict);
  }
  const o: Id[] = [],
    seen = new Set<Id>();
  for (const e of live) {
    const id = idOf(e)!;
    if (seen.has(id)) return REPLACED;
    seen.add(id);
    o.push(id);
  }
  let a: Dict[] | undefined;
  base.length = live.length;
  for (let i = 0; i < live.length; i++) {
    const was = old.get(o[i]);
    if (was) {
      base[i] = was;
      const sub = syncObject(was, live[i] as object);
      if (sub) (u ??= []).push([i, sub]);
    } else (a ??= []).push((base[i] = copy(live[i]) as Dict));
  }
  const out: ListDelta = { o };
  if (a) out.a = a;
  if (u) out.u = u;
  return out;
}

/** The server's side: one per room. */
export class SnapshotDeltaEncoder {
  private base: Dict | undefined;
  /** Forget the base: the next snapshot has no delta (a keyframe for all). */
  reset() {
    this.base = undefined;
  }
  /**
   * What changed since the snapshot before, or undefined when there was
   * none to compare with. Either way the snapshot becomes the base. The
   * delta shares its values with the base: send it (or write it out) before
   * encoding the next one.
   */
  encode(wire: WireSnapshot): ObjectDelta | undefined {
    if (!this.base) {
      this.base = copy(wire) as Dict;
      return undefined;
    }
    return syncObject(this.base, wire) ?? {};
  }
}

function applyObject(base: Dict, delta: ObjectDelta) {
  if (!isDict(base)) throw new Error("delta: not an object");
  if (delta.s) for (const key in delta.s) base[key] = delta.s[key];
  if (delta.x) for (const key of delta.x) delete base[key];
  if (delta.d)
    for (const key in delta.d) {
      const target = base[key],
        sub = delta.d[key];
      if (Array.isArray(target)) applyList(target, sub as ListDelta);
      else applyObject(target as Dict, sub as ObjectDelta);
    }
}
function applyList(base: Data[], delta: ListDelta) {
  if (delta.o) {
    const old = new Map<Id, Data>();
    for (const e of base) old.set(idOf(e)!, e);
    let added = 0;
    base.length = delta.o.length;
    for (let i = 0; i < delta.o.length; i++) {
      const e = old.get(delta.o[i]) ?? delta.a?.[added++];
      if (e === undefined) throw new Error("delta: unknown member");
      base[i] = e;
    }
    if (added !== (delta.a?.length ?? 0))
      throw new Error("delta: members left over");
  }
  if (delta.u)
    for (const [i, sub] of delta.u) {
      if (i >= base.length) throw new Error("delta: no such member");
      applyObject(base[i] as Dict, sub);
    }
}

/** The client's side: one per connection. */
export class SnapshotDeltaDecoder {
  private base: (Dict & { code?: string; n?: number }) | undefined;
  /**
   * A whole snapshot arrived. It becomes the base when the server numbers
   * its snapshots (an older server, or one with deltas off, does not: then
   * nothing is kept and nothing is copied).
   */
  full(wire: WireSnapshot) {
    this.base =
      typeof wire.n === "number"
        ? (cloneData(wire) as unknown as Dict)
        : undefined;
  }
  /**
   * The whole snapshot a delta stands for, as a copy the game may keep; or
   * undefined when the delta does not follow what we have. The caller then
   * asks the server for a whole one (`state-full`) and waits for it.
   */
  delta(message: WireSnapshotDelta): WireSnapshot | undefined {
    const base = this.base;
    if (
      !base ||
      !message ||
      base.code !== message.code ||
      (base.n as number) + 1 !== message.n ||
      !isDict(message.d)
    ) {
      this.base = undefined;
      return undefined;
    }
    try {
      applyObject(base, message.d);
    } catch {
      this.base = undefined;
      return undefined;
    }
    if (base.n !== message.n || base.code !== message.code) {
      this.base = undefined;
      return undefined;
    }
    return cloneData(base) as unknown as WireSnapshot;
  }
  /** Whether a delta could be applied right now. */
  get ready() {
    return !!this.base;
  }
}
