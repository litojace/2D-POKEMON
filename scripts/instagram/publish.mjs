// Posts the Instagram plan (scripts/instagram/plan.json) through Meta's
// Graph API, as the owner asked (docs/instagram.md, "Running the account").
//
//   node scripts/instagram/publish.mjs list          # the plan and what is on Instagram
//   node scripts/instagram/publish.mjs due [--dry]   # post what is due and not yet posted
//   node scripts/instagram/publish.mjs check <id>    # make one item's container, never publish it
//
// The access token is a network secret on the cloud environment: its proxy
// adds it to every request to graph.facebook.com, so nothing here holds it.
// Elsewhere, IG_TOKEN in the environment is sent instead.
//
// Rules the script keeps, whoever runs it:
// - nothing goes out while the plan is paused, or before it is approved or
//   24 hours have passed since it was sent (the owner, 27 Nov: "both");
// - an item goes out once: a post or Reel whose caption's first line is
//   already on the account, or a story already up since its time, is skipped;
// - a post more than 48 hours late, or a story more than 20 hours late, is
//   left for the owner, never posted out of its moment.
// It needs only Node 18+ (fetch), no packages.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(readFileSync(path.join(HERE, "plan.json"), "utf8"));
const GRAPH = "https://graph.facebook.com/v23.0";
const IG = PLAN.account.igUserId;
const HOUR = 3600_000;
const LATE = { feed: 48 * HOUR, reel: 48 * HOUR, story: 20 * HOUR };

async function graph(method, route, params = {}) {
  const query = new URLSearchParams(params);
  if (process.env.IG_TOKEN) query.set("access_token", process.env.IG_TOKEN);
  const url = `${GRAPH}/${route}`;
  const res =
    method === "GET"
      ? await fetch(`${url}?${query}`)
      : await fetch(url, { method, body: query });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error)
    throw new Error(
      `${method} ${route}: ${res.status} ${JSON.stringify(body.error ?? body)}`,
    );
  return body;
}

const firstLine = (caption = "") => caption.split("\n")[0].trim();
const pt = (ms) =>
  new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

/** What is on the account: posts' and Reels' first lines, and live stories' times. */
async function onInstagram() {
  const media = await graph("GET", `${IG}/media`, {
    fields: "id,caption,timestamp,media_product_type,permalink",
    limit: "100",
  });
  const stories = await graph("GET", `${IG}/stories`, {
    fields: "id,timestamp",
  });
  return {
    captions: new Set(media.data.map((m) => firstLine(m.caption))),
    media: media.data,
    stories: stories.data.map((s) => Date.parse(s.timestamp)),
  };
}

function approved(now) {
  const a = PLAN.approval;
  if (a.approvedAt) return true;
  return now >= Date.parse(a.sentAt) + 24 * HOUR;
}

/** The container for one item: its media fetched by Meta from mediaBase. */
async function container(item) {
  const base = PLAN.mediaBase;
  const params =
    item.kind === "reel"
      ? {
          media_type: "REELS",
          video_url: base + item.video,
          cover_url: base + item.cover,
          share_to_feed: "true",
          caption: item.caption,
        }
      : item.kind === "story"
        ? { media_type: "STORIES", image_url: base + item.image }
        : { image_url: base + item.image, caption: item.caption };
  const { id } = await graph("POST", `${IG}/media`, params);
  // Meta fetches and processes the file; a video takes a while.
  for (let i = 0; i < 60; i++) {
    const { status_code, status } = await graph("GET", id, {
      fields: "status_code,status",
    });
    if (status_code === "FINISHED") return id;
    if (status_code === "ERROR" || status_code === "EXPIRED")
      throw new Error(`${item.id}: container ${status_code}: ${status}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${item.id}: container still processing after 5 minutes`);
}

async function due(dry) {
  // PUBLISH_NOW tries the plan at another time, in a dry run only.
  const now =
    dry && process.env.PUBLISH_NOW
      ? Date.parse(process.env.PUBLISH_NOW)
      : Date.now();
  if (PLAN.paused) return console.log("paused: nothing posted (plan.json)");
  if (!approved(now))
    return console.log(
      `waiting: the plan is not approved, and its 24 hours end ${pt(Date.parse(PLAN.approval.sentAt) + 24 * HOUR)} PT`,
    );
  const ig = await onInstagram();
  const report = [];
  // Stories due in one slot: those already up since the slot count as posted, in order.
  const storiesUp = (at) => ig.stories.filter((t) => t >= at - 5 * 60_000);
  const slotDone = new Map();
  for (const item of PLAN.posts) {
    const at = Date.parse(item.at);
    if (at > now) continue;
    if (item.kind !== "story" && ig.captions.has(firstLine(item.caption)))
      continue;
    if (item.kind === "story") {
      const done = slotDone.get(at) ?? storiesUp(at).length;
      if (done > 0) {
        slotDone.set(at, done - 1);
        continue;
      }
      slotDone.set(at, 0);
    }
    if (now - at > LATE[item.kind]) {
      // Said for a week, so the owner hears of it, then dropped.
      if (now - at < 7 * 24 * HOUR)
        report.push(`LATE, not posted: ${item.id} (was due ${pt(at)} PT)`);
      continue;
    }
    if (dry) {
      report.push(`would post: ${item.id} (${item.kind}, due ${pt(at)} PT)`);
      continue;
    }
    const creation = await container(item);
    const { id } = await graph("POST", `${IG}/media_publish`, {
      creation_id: creation,
    });
    const { permalink } = await graph("GET", id, { fields: "permalink" });
    report.push(`posted: ${item.id} (${item.kind}) ${permalink ?? id}`);
  }
  console.log(report.length ? report.join("\n") : "nothing due");
}

async function list() {
  const ig = await onInstagram();
  const now = Date.now();
  console.log(
    `@${PLAN.account.username}: ${ig.media.length} posts, ${ig.stories.length} live stories; ` +
      `approval ${PLAN.approval.approvedAt ? "given" : approved(now) ? "by 24 h silence" : "pending"}; ` +
      `${PLAN.paused ? "PAUSED" : "running"}`,
  );
  for (const item of PLAN.posts) {
    const done =
      item.kind !== "story" && ig.captions.has(firstLine(item.caption));
    console.log(
      `${pt(Date.parse(item.at)).padEnd(24)} ${item.kind.padEnd(5)} ${item.id.padEnd(24)} ${done ? "on Instagram" : ""}`,
    );
  }
}

async function check(id) {
  const item = PLAN.posts.find((p) => p.id === id);
  if (!item) throw new Error(`no item ${id} in plan.json`);
  const creation = await container(item);
  console.log(
    `${id}: Meta fetched and processed its media (container ${creation}). Not published; the container expires on its own in 24 hours.`,
  );
}

const [command, arg] = process.argv.slice(2);
const run = { list, due: () => due(arg === "--dry"), check: () => check(arg) }[
  command
];
if (!run) {
  console.error("usage: publish.mjs list | due [--dry] | check <id>");
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
