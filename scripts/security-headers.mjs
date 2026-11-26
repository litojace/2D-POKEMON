// The game's response headers, from apps/client/security-headers.json (the
// source of truth; docs/static-frontend.md, "Security headers"). Shared by
// tests/unit/security-headers.test.ts and scripts/check-live-headers.mjs.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const CONFIG_PATH = new URL(
  "../apps/client/security-headers.json",
  import.meta.url,
);

export function loadConfig(path = CONFIG_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** The Content-Security-Policy value, as pasted into Render. */
export function cspText(csp) {
  return Object.entries(csp)
    .map(([k, v]) => [k, ...v].join(" "))
    .join("; ");
}

/** Every header the Static Site should send, CSP included. */
export function expectedHeaders(config) {
  return {
    ...config.headers,
    "Content-Security-Policy": cspText(config.csp),
  };
}

/** The bodies of the page's inline scripts (no src). */
export function inlineScripts(html) {
  return [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);
}

/** A script body's CSP source expression, 'sha256-…'. */
export function scriptHash(body) {
  return `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
}

/** One directive's sources from a CSP header value. */
export function directive(policy, name) {
  for (const part of policy.split(";")) {
    const [key, ...sources] = part.trim().split(/\s+/);
    if (key === name) return sources;
  }
  return null;
}

/**
 * Compare what a page serves with the repo. Returns a list of problems
 * (empty when it matches). `served` maps lower-case header names to values.
 * The CSP may be enforcing or report-only, but not both and not missing;
 * `requireEnforcing` refuses report-only.
 */
export function compareHeaders(config, served, html, o = {}) {
  const problems = [];
  const want = expectedHeaders(config);
  for (const [name, value] of Object.entries(want)) {
    if (name === "Content-Security-Policy") continue;
    const got = served[name.toLowerCase()];
    if (got !== value)
      problems.push({ header: name, expected: value, served: got ?? null });
  }
  const enforcing = served["content-security-policy"];
  const reportOnly = served["content-security-policy-report-only"];
  const policy = enforcing ?? reportOnly;
  const csp = want["Content-Security-Policy"];
  if (!policy)
    problems.push({
      header: "Content-Security-Policy",
      expected: csp,
      served: null,
    });
  else if (policy !== csp)
    problems.push({
      header: enforcing
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
      expected: csp,
      served: policy,
    });
  if (o.requireEnforcing && !enforcing)
    problems.push({
      header: "Content-Security-Policy",
      expected: "enforcing",
      served: reportOnly ? "report-only only" : null,
    });
  // The page's own inline scripts must be allowed by the policy it is sent
  // with, whatever the repo says: this catches an HTML/header mismatch.
  if (policy && html) {
    const allowed = directive(policy, "script-src") ?? [];
    for (const body of inlineScripts(html)) {
      const h = scriptHash(body);
      if (!allowed.includes(h))
        problems.push({
          header: "script-src",
          expected: `an inline script's hash ${h}`,
          served: "not allowed",
        });
    }
  }
  return problems;
}
