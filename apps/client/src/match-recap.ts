import {
  CHARACTERS,
  type Fighter,
  type Snapshot,
} from "../../../packages/shared/src/index";
import type { MatchReportReply } from "../../../packages/shared/src/accounts";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Most valuable player: most damage dealt, KOs breaking ties. */
export function mvpOf(players: Fighter[]) {
  return [...players].sort(
    (a, b) =>
      b.stats.dealt - a.stats.dealt || (b.stats.kos ?? 0) - (a.stats.kos ?? 0),
  )[0];
}

/**
 * The post-match table: one row per fighter (you first, then your side),
 * with damage dealt and taken, knockouts and signature combos.
 */
export function recapMarkup(state: Snapshot, myId: string) {
  const me = state.players.find((p) => p.id === myId);
  const team = (p: Fighter) =>
    p.team ?? (state.players.indexOf(p) % 2 === 0 ? 0 : 1);
  const order = [...state.players].sort(
    (a, b) =>
      Number(b.id === myId) - Number(a.id === myId) ||
      Number(me ? team(b) === team(me) : 0) -
        Number(me ? team(a) === team(me) : 0),
  );
  const mvp = mvpOf(state.players);
  // Teams: a firmer line where your side ends and theirs begins.
  const firstRival = me ? order.find((p) => team(p) !== team(me)) : undefined;
  const row = (p: Fighter) => {
    const c = CHARACTERS[p.character];
    const tags = [
      p.id === myId ? "<small>you</small>" : "",
      p.id === mvp?.id && p.stats.dealt > 0 ? '<em class="mvp">MVP</em>' : "",
    ].join("");
    return `<tr class="${p.id === myId ? "me" : ""}${p === firstRival && order.indexOf(p) > 1 ? " split" : ""} side-${team(p)}"><th scope="row"><i style="background:${hex(c.color)}"></i><span><b>${escape(p.name)}</b>${tags}<small class="who">${c.name}</small></span></th><td>${Math.round(p.stats.dealt)}</td><td>${Math.round(p.stats.received)}</td><td>${p.stats.kos ?? 0}</td><td>${p.stats.combos ?? 0}</td></tr>`;
  };
  return `<table class="recap"><thead><tr><th scope="col"><span class="sr-only">Player</span></th><th scope="col" title="Damage dealt">DMG</th><th scope="col" title="Damage taken">TAKEN</th><th scope="col" title="Knockouts">KO</th><th scope="col" title="Signature combos">COMBO</th></tr></thead><tbody>${order.map(row).join("")}</tbody></table>`;
}

export type RecordState =
  | { status: "pending" }
  | { status: "done"; reply: MatchReportReply }
  | { status: "unavailable"; message: string };

/** Your all-time record against each opponent (and with each partner). */
export function recordsMarkup(record: RecordState | undefined) {
  if (!record) return "";
  if (record.status === "pending")
    return '<p class="records muted">Saving to your records…</p>';
  if (record.status === "unavailable")
    return `<p class="records muted">${escape(record.message)}</p>`;
  const { reply } = record;
  const lines = reply.records.map((r) => {
    if (!r.wins && !r.losses && r.together)
      return `<span>With ${escape(r.name)}: <b>${r.together}</b> ${r.together === 1 ? "match" : "matches"} together</span>`;
    return `<span>You vs ${escape(r.name)}: <b>${r.wins}–${r.losses}</b> all time</span>`;
  });
  const note = reply.confirmed
    ? ""
    : '<span class="muted">Counts once everyone’s game has saved it.</span>';
  return lines.length || note
    ? `<p class="records">${lines.join("")}${note}</p>`
    : "";
}
