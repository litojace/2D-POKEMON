/**
 * Render runs the server with `npm run start` and stops it on a deploy with
 * SIGTERM (docs/server-updates.md). Without `exec`, npm quits at once on that
 * signal and the server under it never hears it: it never drains, and every
 * match in progress is lost. This runs the real start script through npm,
 * with a stand-in server, and checks the stand-in hears SIGTERM and npm waits
 * for it to finish.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const start: string = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf8"),
).scripts.start;

it("starts the server with exec, so npm hands it the deploy's SIGTERM", () => {
  expect(start).toMatch(/^exec node /);
});

it.skipIf(process.platform === "win32")(
  "lets the server drain on SIGTERM while npm waits for it",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "arena-start-"));
    // The handler goes in before "up": a SIGTERM that lands before it would
    // end the stand-in by default and fail the test by luck of timing.
    writeFileSync(
      join(dir, "server.js"),
      `process.on("SIGTERM", () => {
  console.log("draining");
  setTimeout(() => { console.log("drained"); process.exit(0); }, 400);
});
console.log("up");
setInterval(() => {}, 1000);`,
    );
    const script = start.replace(/\bnode \S+/, "node server.js");
    expect(script).toContain("node server.js");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "t",
        version: "1.0.0",
        scripts: { start: script },
      }),
    );
    const npm = spawn("npm", ["run", "start", "--silent"], { cwd: dir });
    let out = "";
    npm.stdout.on("data", (chunk) => (out += chunk));
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no start: ${out}`)), 15000);
      npm.stdout.on("data", () => {
        if (out.includes("up")) (clearTimeout(t), resolve());
      });
    });
    const sent = Date.now();
    npm.kill("SIGTERM");
    const code = await new Promise<number | null>((resolve) =>
      npm.on("exit", (c) => resolve(c)),
    );
    expect(out).toContain("draining");
    expect(out).toContain("drained");
    // npm stayed until the server had finished, not a moment after the signal.
    expect(Date.now() - sent).toBeGreaterThanOrEqual(350);
    expect(code).toBe(0);
  },
  20000,
);
