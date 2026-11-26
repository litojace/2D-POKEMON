import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  compareHeaders,
  cspText,
  expectedHeaders,
  inlineScripts,
  scriptHash as sha,
} from "../../scripts/security-headers.mjs";

// The game's response headers (apps/client/security-headers.json) live in
// Render's dashboard, where nothing checks them. These tests keep the file
// in step with the code: every inline script hashed, every host the client
// calls allowed, and docs/static-frontend.md showing the same text.

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const config = JSON.parse(read("apps/client/security-headers.json")) as {
  headers: Record<string, string>;
  csp: Record<string, string[]>;
};

describe("game security headers", () => {
  test("every inline script in the served pages is hashed, and nothing else runs inline", () => {
    const pages = [
      "apps/client/index.html",
      ...readdirSync(path.join(ROOT, "apps/client/public"))
        .filter((f) => f.endsWith(".html"))
        .map((f) => `apps/client/public/${f}`),
    ];
    const hashes = pages.flatMap((p) => inlineScripts(read(p)).map(sha));
    const allowed = config.csp["script-src"];
    for (const h of hashes) expect(allowed, `missing ${h}`).toContain(h);
    // No stale hashes, no blanket inline or eval.
    expect(allowed.filter((s) => s.startsWith("'sha256-")).sort()).toEqual(
      [...new Set(hashes)].sort(),
    );
    expect(allowed).not.toContain("'unsafe-inline'");
    expect(allowed).not.toContain("'unsafe-eval'");
    // Inline event handlers (onclick="…") would need 'unsafe-hashes'.
    for (const p of pages) expect(read(p), p).not.toMatch(/<[^>]+\son[a-z]+="/);
  });

  test("the game server and Supabase are allowed where the client uses them", () => {
    const server = read("docs/static-frontend.md").match(
      /VITE_SERVER_URL=(https:\/\/[^\s`]+)/,
    )?.[1];
    expect(server).toBeTruthy();
    const origin = new URL(server!).origin;
    expect(config.csp["connect-src"]).toContain(origin);
    expect(config.csp["connect-src"]).toContain(
      origin.replace("https:", "wss:"),
    );
    // Portraits and avatar photos load from the server (portraits.ts).
    expect(config.csp["img-src"]).toContain(origin);
    expect(
      config.csp["connect-src"].some((s) =>
        /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(s),
      ),
    ).toBe(true);
    // Canvas exports, the share card and fighter art use data: and blob:.
    expect(config.csp["img-src"]).toEqual(
      expect.arrayContaining(["data:", "blob:"]),
    );
  });

  test("no host in the client code is left out", () => {
    // Links the player follows (not fetched), XML namespaces, a test URL.
    const notFetched = new Set([
      "http://www.w3.org",
      "https://github.com",
      "https://x.invalid",
      "https://play.elementarenausa.com",
      "https://elementarenausa.com",
    ]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|html)$/.test(f)) files.push(p);
      }
    };
    walk(path.join(ROOT, "apps/client/src"));
    const allowed = new Set([
      ...config.csp["connect-src"],
      ...config.csp["img-src"],
    ]);
    for (const f of files)
      for (const m of readFileSync(f, "utf8").matchAll(
        /\bhttps?:\/\/[a-zA-Z0-9.-]+\.[a-z]{2,}/g,
      ))
        if (!notFetched.has(m[0]))
          expect(allowed, `${path.relative(ROOT, f)}: ${m[0]}`).toContain(m[0]);
  });

  test("the low-risk headers stay strict", () => {
    expect(config.headers["X-Frame-Options"]).toBe("DENY");
    expect(config.csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(config.headers["Strict-Transport-Security"]).toMatch(
      /max-age=31536000; includeSubDomains/,
    );
    expect(config.csp["object-src"]).toEqual(["'none'"]);
  });

  test("docs/static-frontend.md shows exactly these headers", () => {
    const docs = read("docs/static-frontend.md");
    expect(docs).toContain(cspText(config.csp));
    for (const [k, v] of Object.entries(config.headers))
      expect(docs).toContain(`${k}: ${v}`);
  });

  test("the live check spots drift (scripts/check-live-headers.mjs)", () => {
    const want = expectedHeaders(config);
    const served = Object.fromEntries(
      Object.entries(want).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const html = read("apps/client/index.html");
    expect(compareHeaders(config, served, html)).toEqual([]);
    // Report-only passes unless enforcing is required.
    const reportOnly = { ...served };
    reportOnly["content-security-policy-report-only"] =
      reportOnly["content-security-policy"];
    delete reportOnly["content-security-policy"];
    expect(compareHeaders(config, reportOnly, html)).toEqual([]);
    expect(
      compareHeaders(config, reportOnly, html, { requireEnforcing: true }),
    ).toHaveLength(1);
    // An inline script edited without updating Render is not allowed.
    const edited = html.replace("ipad-gate", "ipad-gate-x");
    expect(
      compareHeaders(config, served, edited).map((p) => p.header),
    ).toContain("script-src");
    // A missing or changed header is named.
    const noFrame = { ...served };
    delete noFrame["x-frame-options"];
    expect(compareHeaders(config, noFrame, html)[0]).toMatchObject({
      header: "X-Frame-Options",
      served: null,
    });
  });
});
