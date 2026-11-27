import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Render skips a commit that changes only these files (render.yaml's
 * buildFilter on the server; the same list on the Static Site 2D-POKEMON, in
 * Render's settings: docs/static-frontend.md, "Build filter"). That is safe
 * only while nothing the build or the running game reads lives there: a
 * change to such a file would then never reach players. So this fails when
 * build code starts pointing at a filtered path. Before taking a path off
 * this list or adding one, change the filter in Render too.
 */
const SAFE_IGNORED = [
  "docs/**",
  "tests/**",
  "apps/site/**",
  ".github/**",
  "**/*.md",
];

const root = join(__dirname, "../..");
const read = (file: string) => readFileSync(join(root, file), "utf8");

/** The element-arena service's buildFilter, read from render.yaml. */
function buildFilter() {
  const lines = read("render.yaml").split("\n");
  const start = lines.findIndex((l) => /^\s*buildFilter:\s*$/.test(l));
  if (start < 0) return null;
  const indent = lines[start].search(/\S/);
  const filter: Record<string, string[]> = {};
  let key = "";
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (line.search(/\S/) <= indent) break;
    const field = line.match(/^\s*(\w+):\s*$/);
    if (field) {
      key = field[1];
      filter[key] = [];
      continue;
    }
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!item || !key) throw new Error(`Unexpected buildFilter line: ${line}`);
    filter[key].push(item[1].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return filter;
}

/** Every file under `dir` (repo-relative) whose name matches `name`. */
function filesIn(dir: string, name: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    if (entry === "node_modules" || entry === "dist") continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory())
      out.push(...filesIn(rel, name));
    else if (name.test(entry)) out.push(rel);
  }
  return out;
}

/** Code without its comments (block, line and HTML), so notes may cite docs. */
function withoutComments(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** A path into a filtered folder, or a Markdown file, named in code. */
const FILTERED_REF =
  /(^|["'`/\s(])(docs|tests|\.github)\/|apps\/site\b|(^|[/"'`])site\/|\.md\b|\?raw\b/;

/**
 * Lines that name a filtered path in words only, never reading it: a message
 * pointing the person who set up the deploy at a doc.
 */
const MENTIONS = [/^\s*"SUPABASE_DB_URL .*\(?see docs\/auto-migrations\.md\b/i];

describe("Render build filter", () => {
  it("render.yaml ignores exactly the safe list on the server", () => {
    const services = read("render.yaml").match(/^\s*- type:/gm) ?? [];
    expect(services).toHaveLength(1);
    // No `paths`: every other file still deploys.
    expect(buildFilter()).toEqual({ ignoredPaths: SAFE_IGNORED });
  });

  it("the build and the server read nothing in the filtered paths", () => {
    const code = [
      ...filesIn("apps/client/src", /\.(ts|tsx|js|mjs|css|html|json)$/),
      ...filesIn("apps/server/src", /\.(ts|js|mjs|json)$/),
      ...filesIn("packages/shared/src", /\.(ts|js|mjs|json)$/),
      ...filesIn("apps/client", /^(index\.html|vite\.config\.ts)$/).filter(
        (f) => !f.slice("apps/client/".length).includes("/"),
      ),
      "apps/client/tsconfig.json",
      "apps/server/tsconfig.json",
      "packages/shared/tsconfig.json",
      "tsconfig.base.json",
      // What Render runs before the server starts (render.yaml).
      "scripts/migrate-production.mjs",
      "scripts/check-migrations.mjs",
    ].filter((f) => !/\.test\.ts$/.test(f));
    expect(code.length).toBeGreaterThan(100);
    const hits = code.flatMap((file) =>
      withoutComments(read(file))
        .split("\n")
        .flatMap((line, i) =>
          FILTERED_REF.test(line) && !MENTIONS.some((m) => m.test(line))
            ? [`${file}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );
    expect(hits).toEqual([]);
  });

  it("the build and start scripts stay out of the filtered paths", () => {
    const scripts = [
      "package.json",
      "apps/client/package.json",
      "apps/server/package.json",
      "packages/shared/package.json",
    ].flatMap((file) => {
      const pkg = JSON.parse(read(file));
      return ["build", "start", "postinstall", "prepare", "prebuild"]
        .filter((name) => pkg.scripts?.[name])
        .map((name) => `${file} ${name}: ${pkg.scripts[name]}`);
    });
    expect(scripts.length).toBeGreaterThan(3);
    expect(scripts.filter((s) => FILTERED_REF.test(s.split(": ")[1]))).toEqual(
      [],
    );
  });
});
