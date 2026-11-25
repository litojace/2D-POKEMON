import { isIP } from "node:net";

/**
 * Who a request really comes from, for the rate limits.
 *
 * In production the server sits behind the host's proxies (Render, with
 * Cloudflare in front), so the connection's own address is a proxy's: every
 * player looked like one client and shared one allowance (found 25 Nov 2026).
 * The proxies append what they saw to `X-Forwarded-For`, so a genuine
 * request arrives with a fixed number of entries, the player's first:
 *
 *     X-Forwarded-For: <player>, <proxy>, ...     (N entries)
 *
 * A client can send that header itself, but the proxies only append to it,
 * so a forged list is longer, never shorter, and the player's real address
 * is still the Nth entry from the right. N is not published and may change,
 * so it is learned: the shortest list seen from a proxy. A forged header
 * therefore never moves a client into another bucket. `TRUST_PROXY_HOPS`
 * pins N instead (render.yaml does not set it).
 *
 * The header is read only when the connection itself comes from a private
 * address (a proxy in the host's network, or a test's). A direct connection
 * from the internet is its own address, whatever it claims.
 */
export class ClientAddresses {
  private learned = Infinity;
  private readonly fixed: number | null;
  constructor(
    hops: number | string | undefined = process.env.TRUST_PROXY_HOPS,
    /** Told when the learned length changes (lengths and kinds, no address). */
    private readonly onLearn: (
      details: Record<string, unknown>,
    ) => void = () => {},
  ) {
    const n = Number(hops);
    this.fixed =
      hops !== undefined && hops !== "" && n >= 1 ? Math.floor(n) : null;
  }
  /** A key for this client's allowance: its address (IPv6 by /64). */
  of(
    peer: string | undefined,
    forwarded: string | string[] | undefined,
  ): string {
    const direct = normalise(peer);
    const list = (
      Array.isArray(forwarded) ? forwarded.join(",") : (forwarded ?? "")
    )
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!list.length || !direct || !isPrivate(direct))
      return bucket(direct) ?? "unknown";
    if (this.fixed === null && list.length < this.learned) {
      this.learned = list.length;
      this.onLearn({
        forwarded: list.length,
        kinds: list.map((entry) => kind(normalise(entry))),
      });
    }
    const hops = Math.min(this.fixed ?? this.learned, list.length);
    return (
      bucket(normalise(list[list.length - hops])) ?? bucket(direct) ?? "unknown"
    );
  }
  /**
   * The same, or null when all that is known is a private address (a proxy
   * that passed no client address on): many players may be behind it, so a
   * limit that locks an address out must not act on it.
   */
  ofPublic(
    peer: string | undefined,
    forwarded: string | string[] | undefined,
  ): string | null {
    const key = this.of(peer, forwarded);
    return key === "unknown" || isPrivate(key) ? null : key;
  }
}

/** `::ffff:1.2.3.4` and `[::1]` as plain addresses; "" when not an address. */
function normalise(address: string | undefined): string {
  let a = (address ?? "").trim().toLowerCase();
  if (a.startsWith("[") && a.endsWith("]")) a = a.slice(1, -1);
  if (a.startsWith("::ffff:") && isIP(a.slice(7)) === 4) a = a.slice(7);
  return isIP(a) ? a : "";
}
function kind(address: string) {
  return !address ? "invalid" : isPrivate(address) ? "private" : "public";
}
function isPrivate(a: string): boolean {
  if (isIP(a) === 4) {
    const [x, y] = a.split(".").map(Number);
    return (
      x === 10 ||
      x === 127 ||
      (x === 172 && y >= 16 && y <= 31) ||
      (x === 192 && y === 168) ||
      (x === 169 && y === 254) ||
      // Carrier-grade NAT range, which hosts also use between their proxies.
      (x === 100 && y >= 64 && y <= 127)
    );
  }
  return a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
}
/** One allowance per IPv4 address, and per IPv6 /64 (one home or phone). */
function bucket(a: string): string | null {
  if (!a) return null;
  if (isIP(a) === 4) return a;
  const [head, tail = ""] = a.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = a.includes("::")
    ? [
        ...left,
        ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"),
        ...right,
      ]
    : left;
  return (
    groups
      .slice(0, 4)
      .map((g) => g.replace(/^0+(?=.)/, ""))
      .join(":") + "::/64"
  );
}

/**
 * So many events per key in each window. `take` counts one and says whether
 * it is still within the allowance; `over` only looks.
 */
export class WindowLimits {
  private readonly counts = new Map<string, { count: number; until: number }>();
  private swept = 0;
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}
  private entry(key: string, now: number) {
    // Forget finished windows now and then, not on every request.
    if (now - this.swept > 5000) {
      this.swept = now;
      for (const [id, c] of this.counts)
        if (c.until < now) this.counts.delete(id);
    }
    let c = this.counts.get(key);
    if (!c || c.until < now)
      this.counts.set(key, (c = { count: 0, until: now + this.windowMs }));
    return c;
  }
  take(key: string, now = Date.now()): boolean {
    return ++this.entry(key, now).count <= this.limit;
  }
  over(key: string, now = Date.now()): boolean {
    return this.entry(key, now).count >= this.limit;
  }
}

/**
 * A ceiling on everything one connection sends, whatever the event: a game
 * sends about 30 inputs a second and a few commands, so past `perSecond`
 * the rest of that second is dropped (a command waiting for an answer is
 * told so), and a connection still flooding `strikes` seconds in a row is
 * closed. Each event's own smaller limit still applies below this.
 */
export function floodGuard(
  drop: () => void,
  perSecond = 300,
  strikes = 10,
): (packet: unknown[], next: (error?: Error) => void) => void {
  let from = Date.now(),
    count = 0,
    hot = 0,
    closed = false;
  return (packet, next) => {
    const now = Date.now();
    if (now - from > 1000) {
      // A quiet second (or a pause) forgives; only an unbroken flood closes.
      hot = count > perSecond && now - from <= 2000 ? hot + 1 : 0;
      from = now;
      count = 0;
    }
    if (++count <= perSecond) return next();
    if (count === perSecond + 1 && hot + 1 >= strikes && !closed) {
      closed = true;
      drop();
      return;
    }
    const cb = packet[packet.length - 1];
    if (typeof cb === "function")
      cb({ ok: false, error: "Too many requests." });
  };
}
