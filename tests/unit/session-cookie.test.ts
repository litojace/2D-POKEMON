import { describe, expect, it } from "vitest";
import {
  CHUNK,
  sessionCookieStorage,
  sharesSession,
} from "../../packages/shared/src/session-cookie";

/** A browser's `document.cookie` for one site, enough for these checks. */
function jar() {
  const cookies = new Map<string, { value: string; attrs: string }>();
  return {
    cookies,
    get cookie() {
      return [...cookies].map(([n, c]) => `${n}=${c.value}`).join("; ");
    },
    set cookie(line: string) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const maxAge = attrs.find((a) => a.startsWith("Max-Age="));
      if (maxAge && Number(maxAge.slice(8)) <= 0) cookies.delete(name);
      else
        cookies.set(name, {
          value: pair.slice(eq + 1),
          attrs: attrs.join("; "),
        });
    },
  };
}

// A Supabase session is a JSON string of a few KB (two JWTs and the user).
const session = JSON.stringify({
  access_token: "eyJ" + "a".repeat(1200),
  refresh_token: "r".repeat(40),
  user: {
    id: "u1",
    email: "player@example.com",
    user_metadata: { full_name: "Nguyễn Văn A ✨" },
  },
  pad: "x%y;z=,".repeat(600),
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

  it("round-trips a session larger than one cookie, in chunks", () => {
    const j = jar();
    const s = sessionCookieStorage(j);
    s.setItem("parena-auth", session);
    expect(j.cookies.size).toBeGreaterThan(2);
    for (const [, c] of j.cookies) {
      expect(c.value.length).toBeLessThanOrEqual(CHUNK);
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

  it("a torn value reads as signed out and is cleared", () => {
    const j = jar();
    j.cookie = "parena-auth.0=%E0%A4; Max-Age=60";
    const s = sessionCookieStorage(j);
    expect(s.getItem("parena-auth")).toBeNull();
    expect(j.cookies.size).toBe(0);
  });
});
