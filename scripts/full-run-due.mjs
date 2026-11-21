// Starts main's full run (verify and the 18 visual shards) when it is due,
// from a push to main (.github/workflows/ci.yml, the `full-run-due` job).
//
// Main's full run is scheduled every three hours, but GitHub drops scheduled
// runs when it is busy: on 21 Nov 2026 none of the 09:17 or 12:17 runs
// started, and the Match reports schedule lost two in a row too. Merges keep
// coming, so each push to main asks: is a full run of main waiting or
// running? If not, did one start in the last DUE_HOURS? If not, it starts one
// (Run workflow on main), which joins main's own full-run group, so no merge
// replaces it.
//
//   node scripts/full-run-due.mjs     (in CI: GH_TOKEN, GH_REPO)
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** A full run of main this old or older is due again. */
export const DUE_HOURS = 3;

const going = new Set([
  "queued",
  "in_progress",
  "waiting",
  "requested",
  "pending",
]);

/**
 * Whether main's full run is due, from its recent runs (scheduled, or by
 * hand on main: `{ status, created_at }`, any order) at `now` (ms).
 */
export function fullRunDue(runs, now, hours = DUE_HOURS) {
  if (runs.some((r) => going.has(r.status)))
    return {
      due: false,
      why: "a full run of main is already waiting or running",
    };
  const last = Math.max(
    ...runs.map((r) => Date.parse(r.created_at)).filter(Number.isFinite),
  );
  if (!Number.isFinite(last))
    return { due: true, why: "main has no full run yet" };
  const age = (now - last) / 3_600_000;
  return age >= hours
    ? { due: true, why: `main's last full run started ${age.toFixed(1)} h ago` }
    : {
        due: false,
        why: `main's last full run started ${age.toFixed(1)} h ago`,
      };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const repo = process.env.GH_REPO;
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
  const runs = ["schedule", "workflow_dispatch"].flatMap((event) =>
    JSON.parse(
      gh(
        "api",
        `repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=${event}&per_page=10`,
        "--jq",
        "[.workflow_runs[] | {status, created_at}]",
      ),
    ),
  );
  const r = fullRunDue(runs, Date.now());
  console.log(`${r.due ? "Due" : "Not due"}: ${r.why}.`);
  if (r.due) {
    gh("workflow", "run", "ci.yml", "--repo", repo, "--ref", "main");
    console.log("Started main's full run.");
  }
}
