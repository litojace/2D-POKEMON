// Posts the Instagram plan (scripts/instagram/plan.json) through Meta's
// Graph API, as the owner asked (docs/instagram.md, "Running the account").
//
//   node scripts/instagram/publish.mjs list          # the plan and what is on Instagram
//   node scripts/instagram/publish.mjs due [--dry]   # post what is due and not yet posted
//   node scripts/instagram/publish.mjs check <id>    # make one item's container, never publish it
//   node scripts/instagram/publish.mjs comments      # recent comments the account hasn't answered
//   node scripts/instagram/publish.mjs reply <comment-id> <text>
//   node scripts/instagram/publish.mjs hide <comment-id>
//
// The access token is a network secret on the cloud environment: its proxy
// adds it to every request to graph.facebook.com, so nothing here holds it.
// Elsewhere, IG_TOKEN in the environment is sent instead.
//
// Rules the script keeps, whoever runs it:
// - nothing goes out while the plan is paused, or before it is approved or
//   24 hours have passed since it was sent (the owner, 27 Nov: "both");
// - an item goes out once: a post, carousel or Reel whose caption's first
//   line is already on the account, or a story already up since its time,
//   is skipped;
// - a post, carousel or Reel more than 48 hours late, or a story more than
//   20 hours late, is left for the owner, never posted out of its moment.
// It needs only Node 18+ (fetch), no packages.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(readFileSync(path.join(HERE, "plan.json"), "utf8"));
const GRAPH = "https://graph.facebook.com/v23.0";
const IG = PLAN.account.igUserId;
const HOUR = 3600_000;
const LATE = {
  feed: 48 * HOUR,
  carousel: 48 * HOUR,
  reel: 48 * HOUR,
  story: 20 * HOUR,
};

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

/** Waits for Meta to fetch and process a container's media (a video takes a while). */
async function ready(id, label) {
  for (let i = 0; i < 60; i++) {
    const { status_code, status } = await graph("GET", id, {
      fields: "status_code,status",
    });
    if (status_code === "FINISHED") return id;
    if (status_code === "ERROR" || status_code === "EXPIRED")
      throw new Error(`${label}: container ${status_code}: ${status}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${label}: container still processing after 5 minutes`);
}

/** The container for one item: its media fetched by Meta from mediaBase. */
async function container(item) {
  const base = PLAN.mediaBase;
  if (item.kind === "carousel") {
    // A container per picture, then the carousel's own, which carries the caption.
    const children = [];
    for (const image of item.images) {
      const { id } = await graph("POST", `${IG}/media`, {
        image_url: base + image,
        is_carousel_item: "true",
      });
      children.push(await ready(id, `${item.id} ${image}`));
    }
    const { id } = await graph("POST", `${IG}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: item.caption,
    });
    return ready(id, item.id);
  }
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
  return ready(id, item.id);
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
      `${pt(Date.parse(item.at)).padEnd(24)} ${item.kind.padEnd(8)} ${item.id.padEnd(24)} ${done ? "on Instagram" : ""}`,
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

/**
 * The comments of the last two weeks' posts that the account has neither
 * answered nor hidden, oldest first, as JSON lines: what a session reads
 * before it replies or hides (docs/instagram.md, "Running the account").
 */
async function comments() {
  const since = Date.now() - 14 * 24 * HOUR;
  const media = await graph("GET", `${IG}/media`, {
    fields: "id,caption,timestamp,permalink,comments_count",
    limit: "50",
  });
  const out = [];
  for (const m of media.data) {
    if (Date.parse(m.timestamp) < since || !m.comments_count) continue;
    const { data } = await graph("GET", `${m.id}/comments`, {
      fields: "id,text,username,timestamp,hidden,replies{username}",
      limit: "100",
    });
    for (const c of data) {
      if (c.hidden || c.username === PLAN.account.username) continue;
      const answered = (c.replies?.data ?? []).some(
        (r) => r.username === PLAN.account.username,
      );
      if (!answered)
        out.push({
          id: c.id,
          post: firstLine(m.caption),
          permalink: m.permalink,
          from: c.username,
          at: c.timestamp,
          text: c.text,
        });
    }
  }
  out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const c of out) c.at = `${pt(Date.parse(c.at))} PT`;
  console.log(
    out.length
      ? out.map((c) => JSON.stringify(c)).join("\n")
      : "no comments to answer",
  );
}

async function reply(id, text) {
  if (!id || !text) throw new Error("usage: reply <comment-id> <text>");
  const { id: replyId } = await graph("POST", `${id}/replies`, {
    message: text,
  });
  console.log(`replied to ${id}: ${replyId}`);
}

async function hide(id) {
  if (!id) throw new Error("usage: hide <comment-id>");
  await graph("POST", id, { hide: "true" });
  console.log(`hid ${id}`);
}

const [command, arg, ...rest] = process.argv.slice(2);
const run = {
  list,
  due: () => due(arg === "--dry"),
  check: () => check(arg),
  comments,
  reply: () => reply(arg, rest.join(" ")),
  hide: () => hide(arg),
}[command];
if (!run) {
  console.error(
    "usage: publish.mjs list | due [--dry] | check <id> | comments | reply <comment-id> <text> | hide <comment-id>",
  );
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
