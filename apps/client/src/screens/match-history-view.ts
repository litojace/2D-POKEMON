/**
 * Match history (docs/match-history.md): the Matches tab of your player
 * card and of a friend's. Markup and rules only (no DOM); match-history.ts
 * loads the pages and wires the taps.
 *
 * On top, the recent form: the last ten results as chips, the record and
 * win rate over them, and the fighter played most. Below, a row per match,
 * newest first: the result, the fighter, the mode and who it was against,
 * each round won or lost, knock-outs and damage, and the rating it moved.
 * A tap opens the full board of everyone in it, MVP marked. All, Players
 * and Bots filter the list; More loads the next page.
 */
import {
  ARENAS,
  CHARACTERS,
  normalizeCharacterId,
  type ArenaId,
} from "../../../../packages/shared/src/index";
import type {
  MatchHistory,
  MatchHistoryEntry,
  MatchHistoryKind,
  MatchHistoryPlayer,
} from "../../../../packages/shared/src/accounts";
import { fighterPortrait } from "../fighter-art";
import { avatarImage } from "../portraits";
import { serverNow } from "../server-clock";
import { avatar, button, emptyState, esc, segmented } from "../ui/components";

export interface HistoryState {
  kind: MatchHistoryKind;
  /** The matches loaded so far (null before the first page arrives). */
  matches: MatchHistoryEntry[] | null;
  next: MatchHistory["next"];
  totals: MatchHistory["totals"];
  rating: MatchHistory["rating"];
  /** A page is on its way. */
  loading: boolean;
  /** Why the last page didn't load. */
  problem: string;
  /** The match whose board is open. */
  open: string | null;
}
export const historyState = (): HistoryState => ({
  kind: "all",
  matches: null,
  next: null,
  totals: null,
  rating: null,
  loading: false,
  problem: "",
  open: null,
});

const KINDS: [MatchHistoryKind, string][] = [
  ["all", "All"],
  ["pvp", "Players"],
  ["bot", "Bots"],
];
const MODE: Record<MatchHistoryEntry["mode"], string> = {
  duel: "Duel",
  teams: "Teams",
  ffa: "Free-for-all",
};
const RESULT: Record<MatchHistoryEntry["result"], string> = {
  win: "Victory",
  loss: "Defeat",
  draw: "Draw",
};
const SHORT: Record<MatchHistoryEntry["result"], string> = {
  win: "W",
  loss: "L",
  draw: "D",
};
const num = (n: number) => n.toLocaleString("en-US");
const fighterName = (id: string) =>
  CHARACTERS[normalizeCharacterId(id) ?? "voltkit"]?.name ?? id;
export const arenaName = (id: string) => ARENAS[id as ArenaId]?.name ?? "Arena";

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
export function playedAgo(at: string, now = serverNow()) {
  const t = Date.parse(at);
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(t).getFullYear() === new Date(now).getFullYear()
        ? undefined
        : "numeric",
  });
}

/** Who the match was against, in a few words. */
export function opponents(m: MatchHistoryEntry) {
  const others = m.players.filter((p) => p.team !== m.team);
  if (m.bot) return `vs ${m.bot[0].toUpperCase()}${m.bot.slice(1)} bot`;
  if (!others.length) return "";
  if (others.length === 1) return `vs ${others[0].name}`;
  return `vs ${others[0].name} +${others.length - 1}`;
}

/** The recent form: the last ten results, the record and the favourite. */
export function recentForm(matches: MatchHistoryEntry[]) {
  const last = matches.slice(0, 10);
  const wins = last.filter((m) => m.result === "win").length;
  const losses = last.filter((m) => m.result === "loss").length;
  const count = new Map<string, number>();
  for (const m of last)
    count.set(m.character, (count.get(m.character) ?? 0) + 1);
  let favourite: string | null = null;
  for (const [id, n] of count)
    if (!favourite || n > count.get(favourite)!) favourite = id;
  return {
    last,
    wins,
    losses,
    rate: last.length ? Math.round((100 * wins) / last.length) : 0,
    favourite,
  };
}

/** "+16", "−12" or "±0" for the rating a match moved. */
export function ratingDelta(r: MatchHistoryEntry["rating"]) {
  if (!r) return null;
  const d = r.after - r.before;
  return {
    text: d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0",
    cls: d > 0 ? "is-up" : d < 0 ? "is-down" : "",
  };
}

const portrait = (id: string, size: number) => {
  const c = normalizeCharacterId(id);
  return c
    ? avatar(fighterPortrait(c), { element: CHARACTERS[c].element, size })
    : avatar("", { size });
};

function form(s: HistoryState, whose: string) {
  const list = s.matches ?? [];
  if (!list.length) return "";
  const f = recentForm(list);
  const chips = f.last
    .map(
      (m) =>
        `<i class="mh-chip is-${m.result}" title="${esc(RESULT[m.result])}">${SHORT[m.result]}</i>`,
    )
    .join("");
  const fav = f.favourite
    ? `<span class="mh-fav">${portrait(f.favourite, 28)}<span><small class="ui-note">Most played</small><b>${esc(fighterName(f.favourite))}</b></span></span>`
    : "";
  return `<div class="mh-form" aria-label="${esc(`${whose} last ${f.last.length}: ${f.wins} won, ${f.losses} lost`)}"><span class="mh-form-text"><small class="ui-note">Last ${f.last.length}</small><b class="ui-num">${f.wins}W ${f.losses}L <span class="mh-rate">${f.rate}%</span></b></span><span class="mh-chips" aria-hidden="true">${chips}</span>${fav}</div>`;
}

function rounds(m: MatchHistoryEntry) {
  if (!m.rounds.length) return "";
  const won = m.rounds.filter((r) => r === "win").length;
  const lost = m.rounds.filter((r) => r === "loss").length;
  return `<span class="mh-rounds" aria-label="${esc(`Rounds ${won} to ${lost}`)}">${m.rounds
    .map((r) => `<i class="is-${r}"></i>`)
    .join("")}</span>`;
}

function boardRow(p: MatchHistoryPlayer, canOpen: boolean) {
  const who = p.bot
    ? portrait(p.character, 26)
    : `<span class="mh-face" aria-hidden="true">${avatarImage(p.avatar)}</span>`;
  const name =
    canOpen && p.id && !p.owner
      ? `<button type="button" class="mh-name is-link" data-history-player="${esc(p.id)}" data-history-name="${esc(p.name)}">${esc(p.name)}</button>`
      : `<span class="mh-name">${esc(p.name)}</span>`;
  return `<li class="${p.owner ? "is-owner" : ""}">${who}<span class="mh-who">${name}<small class="ui-note">${esc(fighterName(p.character))}</small></span><span class="mh-mvp-slot">${p.mvp ? '<span class="ui-tag mh-mvp">MVP</span>' : ""}</span><span class="mh-cell"><b class="ui-num">${num(p.kos)}</b><small>KO</small></span><span class="mh-cell"><b class="ui-num">${num(p.dealt)}</b><small>Dmg</small></span><span class="mh-cell"><b class="ui-num">${num(p.combos)}</b><small>Combo</small></span></li>`;
}

/** Everyone in the match, side by side: yours first. */
function board(m: MatchHistoryEntry, canOpen: (id: string) => boolean) {
  const teams = [...new Set(m.players.map((p) => p.team))];
  const sides = teams
    .map((t) => {
      const mine = t === m.team;
      const label =
        m.mode === "ffa"
          ? ""
          : `<small class="ui-kicker">${mine ? "Your side" : "Opponents"}</small>`;
      return `${label}<ul class="mh-board">${m.players
        .filter((p) => p.team === t)
        .map((p) => boardRow(p, !!p.id && canOpen(p.id)))
        .join("")}</ul>`;
    })
    .join("");
  const when = new Date(m.playedAt);
  return `<div class="mh-detail" id="mh-detail-${esc(m.id)}"><p class="ui-note mh-detail-head">${esc(MODE[m.mode])} · ${esc(arenaName(m.arena))} · <time datetime="${when.toISOString()}">${esc(when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</time></p>${sides}</div>`;
}

function row(
  m: MatchHistoryEntry,
  open: boolean,
  canOpen: (id: string) => boolean,
  now: number,
) {
  const delta = ratingDelta(m.rating);
  const label = `${RESULT[m.result]}, ${MODE[m.mode]} ${opponents(m)}, ${playedAgo(m.playedAt, now)}`;
  return `<li class="mh-row is-${m.result}${open ? " is-open" : ""}"><button type="button" class="mh-sum" data-history-match="${esc(m.id)}" aria-expanded="${open}" aria-controls="mh-detail-${esc(m.id)}" aria-label="${esc(label)}"><span class="mh-result"><b>${esc(RESULT[m.result])}</b><small>${esc(MODE[m.mode])}</small></span>${portrait(m.character, 34)}<span class="mh-main"><b>${esc(opponents(m) || fighterName(m.character))}</b><small><time datetime="${esc(m.playedAt)}">${esc(playedAgo(m.playedAt, now))}</time> · ${esc(arenaName(m.arena))}</small></span>${rounds(m)}<span class="mh-kda"><b class="ui-num">${num(m.kos)} KO</b><small class="ui-num">${num(m.dealt)} dmg</small></span><span class="mh-delta ui-num ${delta?.cls ?? "is-none"}">${delta ? esc(delta.text) : "–"}</span></button>${open ? board(m, canOpen) : ""}</li>`;
}

export interface HistoryOptions {
  /** "Your" or "Ana's", for the words around the list. */
  whose: string;
  /** Players whose card can be opened from the board (your friends). */
  canOpen?: (id: string) => boolean;
  now?: number;
}

/** The Matches tab: filter, recent form, the list and More. */
export function historyMarkup(s: HistoryState, o: HistoryOptions) {
  const now = o.now ?? serverNow();
  const canOpen = o.canOpen ?? (() => false);
  const filter = segmented(
    KINDS.map(([id, label]) => ({ id, label, selected: s.kind === id })),
    "Show matches",
    "history-kind",
  );
  let body: string;
  if (s.matches === null)
    body = s.problem
      ? emptyState(
          "Matches didn't load",
          s.problem,
          button("Try again", {
            icon: "again",
            size: "s",
            attrs: { "data-history-retry": true },
          }),
        )
      : `<p class="ui-note mh-loading" role="status">Loading matches…</p>`;
  else if (!s.matches.length)
    body = emptyState(
      "No matches yet",
      s.kind === "bot"
        ? "Matches against bots show up here."
        : s.kind === "pvp"
          ? "Matches against other players show up here."
          : "Finished matches show up here, newest first.",
    );
  else {
    const more = s.next
      ? button(s.loading ? "Loading…" : "More matches", {
          size: "s",
          icon: "more",
          disabled: s.loading,
          attrs: {
            "data-history-more": true,
            "aria-busy": s.loading ? "true" : undefined,
          },
        })
      : "";
    body = `${form(s, o.whose)}<ul class="mh-list" aria-label="${esc(`${o.whose} matches`)}">${s.matches
      .map((m) => row(m, s.open === m.id, canOpen, now))
      .join(
        "",
      )}</ul>${more || s.problem ? `<div class="mh-foot">${more}${s.problem ? `<p class="ui-note" role="status">${esc(s.problem)}</p>` : ""}</div>` : ""}`;
  }
  return `<div class="mh" data-history><div class="mh-head"><span class="mh-title"><h3 class="ui-h" id="mh-h">Match history</h3><small class="ui-note">Tap a match for everyone's numbers</small></span>${filter}</div>${body}</div>`;
}
