import { describe, expect, it } from "vitest";
import {
  CHUNK,
  MAX_SHARED,
  sessionCookieStorage,
  sharesSession,
} from "../../packages/shared/src/session-cookie";

/** A Storage, for the origin's own copy. */
function store() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

/**
 * A browser's `document.cookie` on one host, enough for these checks: a
 * Domain cookie and a host-only cookie of the same name are two cookies, and
 * both are listed (host-only first, like a longer path would be).
 */
function jar() {
  const cookies = new Map<string, { value: string; attrs: string }>();
  const hostOnly = new Map<string, string>();
  return {
    cookies,
    hostOnly,
    get cookie() {
      return [
        ...[...hostOnly].map(([n, v]) => `${n}=${v}`),
        ...[...cookies].map(([n, c]) => `${n}=${c.value}`),
      ].join("; ");
    },
    set cookie(line: string) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const maxAge = attrs.find((a) => a.startsWith("Max-Age="));
      const gone = !!maxAge && Number(maxAge.slice(8)) <= 0;
      if (!attrs.some((a) => a.startsWith("Domain="))) {
        if (gone) hostOnly.delete(name);
        else hostOnly.set(name, pair.slice(eq + 1));
      } else if (gone) cookies.delete(name);
      else
        cookies.set(name, {
          value: pair.slice(eq + 1),
          attrs: attrs.join("; "),
        });
    },
  };
}

// A typical Supabase session: two JWTs and the user, ~4 KB encoded.
const session = JSON.stringify({
  access_token: "eyJ" + "a".repeat(1100),
  refresh_token: "r".repeat(40),
  user: {
    id: "u1",
    email: "player@example.com",
    user_metadata: { full_name: "Nguyễn Văn A ✨" },
  },
  pad: "x%y;z=,".repeat(250),
});
// An OAuth user with a lot of metadata: far over what may ride on every request.
const oauth = JSON.stringify({
  access_token: "eyJ" + "a".repeat(1400),
  refresh_token: "r".repeat(40),
  user: {
    identities: Array.from({ length: 3 }, (_, i) => ({
      provider: "apple",
      identity_data: {
        sub: `s${i}`,
        email: "x@privaterelay.appleid.com",
        picture: "https://example.com/" + "p".repeat(400),
      },
    })),
    user_metadata: { full_name: "Ăn Uống Chơi Đùa ".repeat(60) },
  },
});

describe("session cookie", () => {
  it("is shared only on elementarenausa.com and its subdomains", () => {
    expect(sharesSession("elementarenausa.com")).toBe(true);
    expect(sharesSession("play.elementarenausa.com")).toBe(true);
    expect(sharesSession("PLAY.ElementArenaUSA.com")).toBe(true);
    expect(sharesSession("evil-elementarenausa.com")).toBe(false);
    expect(sharesSession("elementarenausa.com.evil.io")).toBe(false);
    expect(sharesSession("parena.litojace.com")).toBe(false);
    expect(sharesSession("localhost")).toBe(false);
  });

  it("round-trips a session larger than one cookie, in two chunks at most", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    expect(encodeURIComponent(session).length).toBeGreaterThan(CHUNK);
    expect(encodeURIComponent(session).length).toBeLessThanOrEqual(MAX_SHARED);
    s.setItem("parena-auth", session);
    expect(j.cookies.size).toBe(2);
    for (const [, c] of j.cookies) {
      expect(c.value.length).toBeLessThanOrEqual(CHUNK + 9); // + the "<check>:" prefix
      expect(c.attrs).toContain("Domain=elementarenausa.com");
      expect(c.attrs).toContain("Secure");
      expect(c.attrs).toContain("SameSite=Lax");
      expect(c.attrs).toContain("Path=/");
    }
    expect(s.getItem("parena-auth")).toBe(session);
    // The other site reads the same cookies: one session for both.
    expect(sessionCookieStorage(j).getItem("parena-auth")).toBe(session);
  });

  it("a shorter session clears the chunks it no longer needs", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    s.setItem("parena-auth", session);
    s.setItem("parena-auth", '{"short":true}');
    expect(j.cookies.size).toBe(1);
    expect(s.getItem("parena-auth")).toBe('{"short":true}');
  });

  it("signing out removes every chunk", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    s.setItem("parena-auth", session);
    s.removeItem("parena-auth");
    expect(j.cookies.size).toBe(0);
    expect(s.getItem("parena-auth")).toBeNull();
  });

  it("is a browser-session cookie unless Remember me is on", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    s.setItem("parena-auth", "{}");
    expect(j.cookies.get("parena-auth.0")!.attrs).not.toContain("Max-Age");
    s.remember(true, "parena-auth");
    expect(s.remembered()).toBe(true);
    expect(j.cookies.get("parena-auth.0")!.attrs).toContain("Max-Age=34560000");
    expect(s.getItem("parena-auth")).toBe("{}");
    s.remember(false, "parena-auth");
    expect(s.remembered()).toBe(false);
    expect(j.cookies.get("parena-auth.0")!.attrs).not.toContain("Max-Age");
  });

  it("a value that isn't ours reads as signed out", () => {
    const j = jar();
    j.cookie =
      "parena-auth.0=nothash:%7B%7D; Domain=elementarenausa.com; Max-Age=60";
    expect(sessionCookieStorage(j).getItem("parena-auth")).toBeNull();
    j.cookie = "parena-auth.0=%E0%A4; Domain=elementarenausa.com; Max-Age=60";
    expect(sessionCookieStorage(j).getItem("parena-auth")).toBeNull();
  });

  it("a session too big to share stays in this origin's storage (no 431 lockout)", () => {
    const j = jar();
    const own = store();
    const s = sessionCookieStorage(j, own);
    expect(encodeURIComponent(oauth).length).toBeGreaterThan(MAX_SHARED);
    s.setItem("parena-auth", session);
    expect(j.cookies.size).toBe(2);
    s.setItem("parena-auth", oauth);
    expect(j.cookies.size).toBe(0); // nothing big rides on every request
    expect(own.m.get("parena-auth")).toBe(oauth);
    expect(s.getItem("parena-auth")).toBe(oauth);
    // Smaller again (a refresh after metadata shrank): shared again, local copy gone.
    s.setItem("parena-auth", session);
    expect(own.m.has("parena-auth")).toBe(false);
    expect(s.getItem("parena-auth")).toBe(session);
    s.removeItem("parena-auth");
    expect(j.cookies.size + own.m.size).toBe(0);
  });

  it("every value up to the cap fits in two chunks, escapes included", () => {
    // Seeded mixes of plain, %-escaped and multi-byte characters, filled to
    // exactly the cap or just under, put escapes across every cut point.
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let trial = 0; trial < 300; trial++) {
      for (const room of [0, 1, 2]) {
        const bits: string[] = [];
        let size = 0; // encoded length so far
        while (size < MAX_SHARED - 12) {
          const c = ["a", "%", "é", "✨", ";"][Math.floor(rand() * 5)];
          bits.push(c);
          size += encodeURIComponent(c).length;
        }
        const cut = bits.join("") + "a".repeat(MAX_SHARED - room - size);
        const j = jar();
        const own = store();
        const s = sessionCookieStorage(j, own);
        s.setItem("k", cut);
        expect(s.getItem("k")).toBe(cut);
        expect(j.cookies.size).toBeLessThanOrEqual(2);
        const total = [...j.cookies.values()].reduce(
          (a, c) => a + c.value.length,
          0,
        );
        expect(total).toBeLessThanOrEqual(MAX_SHARED + 9);
      }
    }
  });

  it("a planted copy under our name (cookie tossing) is cleared, never trusted", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    s.setItem("parena-auth", '{"victim":true}');
    // Another subdomain plants a host-only copy with the attacker's session.
    const attacker = jar();
    sessionCookieStorage(attacker).setItem("parena-auth", '{"attacker":true}');
    j.hostOnly.set(
      "parena-auth.0",
      attacker.cookies.get("parena-auth.0")!.value,
    );
    expect(s.getItem("parena-auth")).toBeNull();
    expect(j.hostOnly.size + j.cookies.size).toBe(0); // both copies cleared
    // Signed out, a planted copy alone is still only one: it would be read,
    // so the hosts send HSTS (README) and no subdomain serves others' code.
  });

  it("chunks from two different writes read as signed out, without deleting", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    const a = JSON.stringify({ v: "a".repeat(4000) });
    const b = JSON.stringify({ v: "b".repeat(4000) });
    s.setItem("k", a);
    const firstOfA = j.cookies.get("k.0")!.value;
    s.setItem("k", b);
    j.cookies.get("k.0")!.value = firstOfA; // the other site read mid-write
    expect(s.getItem("k")).toBeNull();
    expect(j.cookies.size).toBe(2); // nothing deleted: the next write fixes it
    s.setItem("k", b);
    expect(s.getItem("k")).toBe(b);
  });
});
