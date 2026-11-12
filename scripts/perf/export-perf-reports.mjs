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
    "rttP50",
    "rttP95",
    "lead",
    "snapGapP95",
    "snapLate",
    "corrections",
    "correctionMax",
    "confirmP50",
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
    "opponents",
    "botLevel",
    "match",
    "correctionsHit",
    "correctionsStatus",
    "correctionsMove",
    "correctionsOther",
    "hitsFar",
    "hitGapMax",
    "errors",
    "build",
    "os",
    "app",
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

/** The ping cell: the match's median round trip (and its slowest 5%). */
export function pingCell(r) {
  const p50 = typeof r.rttP50 === "number" && r.rttP50 > 0 ? r.rttP50 : r.ping;
  const label = pingLabel(p50);
  return typeof r.rttP95 === "number" && r.rttP95 > 0
    ? `${label} (${r.rttP95})`
    : label;
}
/** Jumps a minute, the largest, and how many had no reason (a prediction fault). */
const jumps = (r) => {
  if (typeof r.corrections !== "number") return "–";
  let out = `${r.corrections}/min`;
  if (r.correctionMax) out += ` (max ${r.correctionMax} px)`;
  if (r.correctionsOther) out += `, ⚠️ ${r.correctionsOther} unexplained`;
  return out;
};
const numbers = (rows, field) =>
  rows.map((r) => r[field]).filter((v) => typeof v === "number");
const when = (r) => r.at.slice(0, 16).replace("T", " ");
const against = (r) => {
  const who = Array.isArray(r.opponents) ? r.opponents.join(", ") : "";
  if (r.boss !== undefined) return `${r.boss} (raid boss)`;
  if (r.bots)
    return `${who || "?"} (bot${r.botLevel ? `, ${r.botLevel}` : ""})`;
  return who || "–";
};
const mode = (r) =>
  r.boss !== undefined
    ? "raid"
    : `${r.mode ?? "?"}${r.bots && r.mode !== "raid" ? " vs bot" : ""}`;
const device = (r) =>
  [
    r.os ? `${r.os}${r.app ? " app" : ""}` : "",
    r.cores !== undefined ? `${r.cores} cores` : "",
    r.memory !== undefined ? `${r.memory} GB` : "",
  ]
    .filter(Boolean)
    .join(", ") || "–";
const hitsOff = (r) =>
  typeof r.hitsFar !== "number"
    ? "–"
    : r.hitsFar
      ? `⚠️ ${r.hitsFar} (max ${r.hitGapMax} px)`
      : "0";

/**
 * The newest build: the one that first appeared last (a deploy shows up
 * after the one before it), and when. A report after that from another
 * build is a phone still running a cached game. (The build of the newest
 * report would not do: that report can come from the stale phone.)
 */
export function newestBuild(reports) {
  const first = new Map();
  for (const r of reports)
    if (r.kind === "arena-perf" && r.build && r.build !== "dev")
      if (!first.has(r.build) || r.at < first.get(r.build))
        first.set(r.build, r.at);
  let best;
  for (const [build, since] of first)
    if (!best || since > best.since) best = { build, since };
  return best;
}

/**
 * What in one match needs looking into, each with where to start. Empty when
 * the match was fine. The thresholds are where a player notices.
 */
export function attention(r, newest) {
  const out = [];
  const ping = r.rttP50 || r.ping,
    slow = r.rttP95 || r.ping;
  if (typeof slow === "number" && slow >= 150)
    out.push(
      `slow connection: ping ${ping} ms, slowest 5% ${slow} ms. The player's network: compare other players at the same time before changing the game.`,
    );
  if (typeof r.snapLate === "number" && r.snapLate >= 0.05)
    out.push(
      `${pct(r.snapLate)} of the server's updates came late (Wi-Fi hiccups). If every player at that time shows it, it is the server: run it with ARENA_DIAGNOSTICS=60.`,
    );
  if (
    (typeof r.fps === "number" && r.fps < 45) ||
    (typeof r.jank === "number" && r.jank >= 0.05)
  )
    out.push(
      `drawing slow: ${cell(r.fps)} fps, ${pct(r.jank)} stutter at ${cell(r.quality)} graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.`,
    );
  if (typeof r.stalls === "number" && r.stalls >= 3)
    out.push(
      `${r.stalls} freezes over 250 ms (loading mid-fight, or the phone too busy).`,
    );
  if (typeof r.correctionsOther === "number" && r.correctionsOther >= 3)
    out.push(
      `${r.correctionsOther} unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with \`npx tsx scripts/perf/correction-sim.ts 120 ${Math.round((ping || 66) / 2)} ${r.character ?? "tidefin"} ${(r.opponents ?? [])[0] ?? "cindrake"}\`.`,
    );
  if (typeof r.hitsFar === "number" && r.hitsFar > 0)
    out.push(
      `${r.hitsFar} hit(s) landed while you were drawn over 24 px away (largest ${r.hitGapMax} px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.`,
    );
  if (typeof r.errors === "number" && r.errors > 0)
    out.push(
      `${r.errors} script error(s) during the match: check the browser console.`,
    );
  if (
    typeof r.confirmP50 === "number" &&
    typeof ping === "number" &&
    r.confirmP50 >= ping + 150
  )
    out.push(
      `skills took ${r.confirmP50} ms to confirm with a ${ping} ms ping: check the server's tick timing (ARENA_DIAGNOSTICS=60).`,
    );
  if (
    newest &&
    r.build &&
    r.build !== "dev" &&
    r.build !== newest.build &&
    r.at > newest.since
  )
    out.push(
      `old build ${r.build} (the newest is ${newest.build}): the phone still runs a cached game. Close it fully and open it again.`,
    );
  return out;
}

/** The README: what needs attention, the newest matches, then each day. */
export function renderReadme(reports) {
  const perf = reports
    .filter((r) => r.kind === "arena-perf")
    .sort((a, b) => b.at.localeCompare(a.at));
  const drops = reports.filter((r) => r.kind === "arena-disconnect");
  const newest = newestBuild(reports);
  const recent = perf.slice(0, 50);
  const lines = [
    "# Match reports",
    "",
    `Newest report: ${perf[0] ? when(perf[0]) + " UTC" : "none yet"}. From the game server's log ` +
      "(`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's " +
      "device per match; times are UTC. No accounts or names are kept.",
    "",
    "## Needs attention",
    "",
  ];
  let flagged = 0;
  for (const r of recent) {
    const issues = attention(r, newest);
    if (!issues.length) continue;
    flagged++;
    lines.push(
      `- **${when(r)}**, ${r.character ?? "?"}${against(r) === "–" ? "" : ` against ${against(r)}`}${r.match ? ` (match \`${r.match}\`)` : ""}:`,
      ...issues.map((i) => `  - ${i}`),
    );
  }
  if (!flagged) lines.push("Nothing in the latest 50 matches.");
  lines.push(
    "",
    "## Latest matches",
    "",
    "| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of recent)
    lines.push(
      `| ${when(r)} | ${r.match ? `\`${r.match}\`` : "–"} | ${mode(r)} | ${cell(r.character)} | ${against(r)} | ${pingCell(r)} | ${cell(r.lead, " ms")} | ${pct(r.snapLate)} | ${jumps(r)} | ${hitsOff(r)} | ${cell(r.confirmP50, " ms")} | ${cell(r.fps)} | ${pct(r.jank)} | ${cell(r.quality)} (${cell(r.setting)}) | ${device(r)} | ${cell(r.build)} |`,
    );
  if (!perf.length) lines.push("| – |" + " |".repeat(15));
  lines.push(
    "",
    "## By day",
    "",
    "| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  const days = [...new Set(reports.map((r) => day(r.at)))].sort().reverse();
  for (const d of days) {
    const today = perf.filter((r) => day(r.at) === d);
    const pings = today
      .map((r) => r.rttP50 || r.ping)
      .filter((v) => typeof v === "number");
    const reasons = new Map();
    for (const r of drops)
      if (day(r.at) === d)
        reasons.set(r.reason ?? "?", (reasons.get(r.reason ?? "?") ?? 0) + 1);
    const dropped = [...reasons]
      .sort((a, b) => b[1] - a[1])
      .map(([why, n]) => `${n} ${why}`)
      .join(", ");
    const needs = today.filter((r) => attention(r, newest).length).length;
    lines.push(
      `| ${d} | ${today.length} | ${needs} | ${cell(round(median(pings)), " ms")} | ${cell(round(quantile(pings, 0.9)), " ms")} | ${cell(round(median(numbers(today, "lead"))), " ms")} | ${cell(median(numbers(today, "corrections")))} | ${cell(round(median(numbers(today, "confirmP50"))), " ms")} | ${cell(median(numbers(today, "fps")))} | ${pct(median(numbers(today, "jank")))} | ${dropped || "0"} |`,
    );
  }
  lines.push(
    "",
    "## What the columns mean",
    "",
    "- **Match**: a random tag shared by every player's row of the same match, so both sides read together.",
    "- **Ping**: the match's median round trip to the server (the badge in battle), and in brackets its slowest 5%: 🟢 under 80 ms, 🟡 under 150, 🔴 above.",
    "- **Lead**: how far ahead of the last server update your fighter, and the shots around it, are drawn.",
    "- **Late updates**: share of the server's 15-a-second updates that came over 120 ms apart (Wi-Fi hiccups).",
    "- **Jumps**: times a minute your own fighter was moved over 4 px when a server update disagreed with the phone's guess, and the largest. Hits that push you and stuns always cause some (the phone cannot know a hit is coming); **unexplained** ones mean the prediction is wrong somewhere.",
    "- **Hits off-screen**: hits on you that landed while you were drawn over 24 px from where the server hit you: hits that looked like a miss.",
    "- **Skill confirm**: median time from pressing a skill to the server confirming it.",
    "- **FPS**: frames per second at the median frame. **Stutter**: share of the time in frames that missed 30 fps.",
    "- **Build**: the version of the game the device ran (its commit).",
    "- Columns a device did not report show –: Ping and Lead since 10 Nov 2026 (23:23 UTC); Late updates, Jumps and Skill confirm since 11 Nov; Match, Against, Hits off-screen, Build and the system since the update after that.",
    "",
    "## How to investigate",
    "",
    "| Symptom | Start here |",
    "| --- | --- |",
    "| Shots hit after you stepped out, or skills look late | `docs/network-performance.md` sections 9 and 11; `tests/visual/shot-timeline.spec.ts` |",
    "| Unexplained jumps | `npx tsx scripts/perf/correction-sim.ts <seconds> <one-way ms> <you> <bot>`: names each jump's cause with the real server and bot |",
    "| Opponents move jerkily, or freeze on a bad link | `npx tsx scripts/perf/net-sim.ts 120` (prediction and smoothing under modelled latency, jitter and stalls) |",
    "| Low FPS or stutter when skills go off | `tests/visual/effect-budget.spec.ts` (`EFFECT_BUDGET_MEASURE=1` prints each champion's cost); `?perf=1` in the game |",
    "| Late updates or slow confirms for everyone | the server: run it with `ARENA_DIAGNOSTICS=60`; `npx tsx scripts/perf/server-load.ts` |",
    "| Many dropped connections | the `arena-disconnect` reasons in `reports/<day>.jsonl` (`ping timeout`: the phone went quiet; `transport close`: the connection closed) |",
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
  for (const r of found) {
    // A report read again replaces the saved one: a newer version of this
    // script may keep more of its fields.
    if (!saved.has(r.id)) added++;
    saved.set(r.id, r);
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
