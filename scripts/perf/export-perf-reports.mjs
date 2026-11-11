#!/usr/bin/env node
/**
 * Match reports from the game server's log, as files to read on GitHub.
 *
 * At the end of every match each player's device sends "battle-perf" and
 * the server logs one `arena-perf` line: ping, how far ahead of the server
 * your fighter is drawn (lead), frame rate, slow frames, graphics level,
 * device cores and memory, mode and champion. Dropped connections are
 * logged as `arena-disconnect`. Render keeps logs for a few days only, so
 * `.github/workflows/perf-reports.yml` runs this every few hours and
 * commits what it finds to the `perf-reports` branch:
 *
 *   reports/<day>.jsonl  one line per report, for scripts
 *   README.md            the latest matches and a summary per day
 *
 * The repository is public: only technical numbers are kept. Accounts,
 * names and room codes never leave the log (see KEEP below).
 *
 *   RENDER_API_KEY=... node scripts/perf/export-perf-reports.mjs <out-dir>
 *
 * Optional: RENDER_OWNER_ID, RENDER_SERVICE_ID (default: this game's
 * server), PERF_SINCE (an ISO time to start from; default: an hour before
 * the newest report already saved, or 7 days ago).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OWNER = process.env.RENDER_OWNER_ID || "tea-db09pdlg1s2s73d5rtn0";
const SERVICE = process.env.RENDER_SERVICE_ID || "srv-db6h8trl550s73ass0tg";
const API = "https://api.render.com/v1/logs";

/** Fields copied out of each log line; everything else stays in the log. */
export const KEEP = {
  "arena-perf": [
    "ping",
    "lead",
    "fps",
    "frameP95",
    "jank",
    "stalls",
    "seconds",
    "frames",
    "quality",
    "setting",
    "density",
    "memory",
    "cores",
    "mode",
    "players",
    "bots",
    "boss",
    "character",
  ],
  "arena-disconnect": [
    "reason",
    "transport",
    "replaced",
    "mode",
    "phase",
    "connectedFor",
  ],
};

/** A log entry from Render's API as a report, or null if it isn't one. */
export function toReport(entry) {
  const message = String(entry?.message ?? "");
  const kind = Object.keys(KEEP).find((k) => message.startsWith(`${k} `));
  if (!kind) return null;
  let data;
  try {
    data = JSON.parse(message.slice(kind.length + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const report = { id: String(entry.id), at: String(entry.timestamp), kind };
  for (const field of KEEP[kind])
    if (data[field] !== undefined && data[field] !== null)
      report[field] = data[field];
  return report;
}

const day = (at) => at.slice(0, 10);

/** Every report already saved, by id. */
export function readSaved(dir) {
  const saved = new Map();
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return saved;
  }
  for (const f of files)
    for (const line of readFileSync(join(dir, f), "utf8").split("\n"))
      if (line.trim()) {
        const r = JSON.parse(line);
        saved.set(r.id, r);
      }
  return saved;
}

/** Reports from Render's log between two times, oldest first. */
async function fetchReports(key, start, end) {
  const out = [];
  for (const text of Object.keys(KEEP)) {
    let from = start,
      to = end;
    for (let page = 0; page < 200; page++) {
      const query = new URLSearchParams({
        ownerId: OWNER,
        resource: SERVICE,
        text,
        startTime: from,
        endTime: to,
        direction: "forward",
        limit: "100",
      });
      const response = await fetch(`${API}?${query}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(
          `Render logs: ${response.status} ${await response.text()}`,
        );
      const body = await response.json();
      for (const entry of body.logs ?? []) {
        const r = toReport(entry);
        if (r) out.push(r);
      }
      if (!body.hasMore || !body.nextStartTime) break;
      from = body.nextStartTime;
      to = body.nextEndTime ?? to;
    }
  }
  return out;
}

const median = (xs) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};
const quantile = (xs, q) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
};
const cell = (v, unit = "") =>
  v === undefined || v === null || Number.isNaN(v) ? "–" : `${v}${unit}`;
const pct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "–");
const round = (v) => (typeof v === "number" ? Math.round(v) : undefined);

/** How a ping reads, as the in-battle badge colours it. */
export const pingLabel = (ms) =>
  typeof ms !== "number"
    ? "–"
    : ms < 80
      ? `${ms} ms 🟢`
      : ms < 150
        ? `${ms} ms 🟡`
        : `${ms} ms 🔴`;

/** The README: newest matches first, then a summary for each day. */
export function renderReadme(reports) {
  const perf = reports
    .filter((r) => r.kind === "arena-perf")
    .sort((a, b) => b.at.localeCompare(a.at));
  const drops = reports.filter((r) => r.kind === "arena-disconnect");
  const lines = [
    "# Match reports",
    "",
    `Newest report: ${perf[0] ? perf[0].at.slice(0, 16).replace("T", " ") + " UTC" : "none yet"}. From the game server's log ` +
      "(`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's " +
      "device per match; times are UTC. No accounts or names are kept.",
    "",
    "- **Ping**: round trip to the server (the badge in battle): 🟢 under 80 ms, 🟡 under 150, 🔴 above.",
    "- **Lead**: how far ahead of the last server update your fighter (and the shots around it) is drawn, on average.",
    "- **FPS**: frames per second at the median frame. **Slowest 5%**: the 95th percentile frame time.",
    "- **Stutter**: share of the time in frames that missed 30 fps. **Stalls**: frames over 250 ms.",
    "- Ping and Lead are reported from the 10 Nov 2026 update (23:23 UTC) on; older rows show –.",
    "",
    "## Latest matches",
    "",
    "| Time (UTC) | Mode | Champion | Ping | Lead | FPS | Slowest 5% | Stutter | Stalls | Graphics | Device |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of perf.slice(0, 50)) {
    const mode =
      r.boss !== undefined
        ? `raid (${r.boss})`
        : `${r.mode ?? "?"}${r.bots ? ` vs bot` : ""}`;
    const device = [
      r.cores !== undefined ? `${r.cores} cores` : "",
      r.memory !== undefined ? `${r.memory} GB` : "",
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `| ${r.at.slice(0, 16).replace("T", " ")} | ${mode} | ${cell(r.character)} | ${pingLabel(r.ping)} | ${cell(r.lead, " ms")} | ${cell(r.fps)} | ${cell(r.frameP95, " ms")} | ${pct(r.jank)} | ${cell(r.stalls)} | ${cell(r.quality)} (${cell(r.setting)}) | ${device || "–"} |`,
    );
  }
  if (!perf.length) lines.push("| – | | | | | | | | | | |");
  lines.push(
    "",
    "## By day",
    "",
    "| Day (UTC) | Reports | Ping, median | Ping, worst 10% | Lead, median | FPS, median | Stutter, median | Dropped connections |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  const days = [...new Set(reports.map((r) => day(r.at)))].sort().reverse();
  for (const d of days) {
    const today = perf.filter((r) => day(r.at) === d);
    const pings = today.map((r) => r.ping).filter((v) => typeof v === "number");
    const leads = today.map((r) => r.lead).filter((v) => typeof v === "number");
    const reasons = new Map();
    for (const r of drops)
      if (day(r.at) === d)
        reasons.set(r.reason ?? "?", (reasons.get(r.reason ?? "?") ?? 0) + 1);
    const dropped = [...reasons]
      .sort((a, b) => b[1] - a[1])
      .map(([why, n]) => `${n} ${why}`)
      .join(", ");
    lines.push(
      `| ${d} | ${today.length} | ${cell(round(median(pings)), " ms")} | ${cell(round(quantile(pings, 0.9)), " ms")} | ${cell(round(median(leads)), " ms")} | ${cell(median(today.map((r) => r.fps).filter((v) => typeof v === "number")))} | ${pct(median(today.map((r) => r.jank).filter((v) => typeof v === "number")))} | ${dropped || "0"} |`,
    );
  }
  lines.push(
    "",
    "Every report is in `reports/<day>.jsonl` (one JSON object per line).",
    "",
  );
  return lines.join("\n");
}

async function main() {
  const out = process.argv[2];
  const key = process.env.RENDER_API_KEY;
  if (!out || !key) {
    console.error(
      "Usage: RENDER_API_KEY=... node scripts/perf/export-perf-reports.mjs <out-dir>",
    );
    process.exit(2);
  }
  const dir = join(out, "reports");
  mkdirSync(dir, { recursive: true });
  const saved = readSaved(dir);
  const newest = [...saved.values()]
    .map((r) => r.at)
    .sort()
    .pop();
  const now = new Date();
  const start =
    process.env.PERF_SINCE ||
    new Date(
      newest
        ? Date.parse(newest) - 3600_000
        : now.getTime() - 7 * 24 * 3600_000,
    ).toISOString();
  const found = await fetchReports(key, start, now.toISOString());
  let added = 0;
  for (const r of found)
    if (!saved.has(r.id)) {
      saved.set(r.id, r);
      added++;
    }
  const all = [...saved.values()].sort((a, b) => a.at.localeCompare(b.at));
  const byDay = new Map();
  for (const r of all) {
    const d = day(r.at);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(JSON.stringify(r));
  }
  for (const [d, rows] of byDay)
    writeFileSync(join(dir, `${d}.jsonl`), rows.join("\n") + "\n");
  writeFileSync(join(out, "README.md"), renderReadme(all));
  console.log(
    `${added} new report(s) since ${start}; ${all.length} saved in total.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
