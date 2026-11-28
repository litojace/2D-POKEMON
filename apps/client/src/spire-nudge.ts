/**
 * The Spire on the Lobby: a card in the right column and a badge on the
 * Raids rail button, only while there is something new to climb. The rule
 * is pure (spireNudge); what the player has seen is kept per account on
 * this device, like Getting started (getting-started.ts).
 *
 * Something new: the Spire is open (a Cragmuff clear) and the highest zone
 * open to you has none of its floors cleared yet — the Spire itself right
 * after the first Cragmuff clear, and each later zone once its checkpoint
 * is earned (or once it is released, for a player already there). Opening
 * the Spire page (or starting a climb from it) marks that zone seen: it is
 * never shown again, even if you leave it unclimbed.
 */
import type { RaidBossId } from "../../../packages/shared/src/raid";
import {
  SPIRE_REWARDS,
  spireZoneStart,
  type SpireProgress,
} from "../../../packages/shared/src/spire";
import {
  SPIRE_CATALOGUE,
  spireEntryBoss,
  spireStanding,
  spireZoneChoice,
  type SpireCatalogue,
} from "./screens/spire-model";

export interface SpireNudge {
  /** One per season and zone: what "seen" remembers. */
  key: string;
  zone: number;
  /** The floor a climb in that zone starts on. */
  from: number;
  title: string;
  note: string;
}
export interface SpireNudgeFacts {
  /** The account's climb (GET /api/spire); null while unknown. */
  spire: SpireProgress | null | undefined;
  /** Raid clears the account loaded otherwise (GET /api/raids). */
  clears?: Partial<Record<RaidBossId, number>>;
  /** Keys already seen (spireSeenKeys). */
  seen: readonly string[];
}

const keyOf = (season: number, zone: number) => `s${season}-z${zone}`;

/** The open zones' keys: what opening the Spire page marks seen. */
export function spireSeenKeys(
  spire: SpireProgress | null | undefined,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  if (!spire) return [];
  const season = spire.season ?? catalogue.season;
  return spireZoneChoice({}, { spire }, catalogue).open.map((z) =>
    keyOf(season, z),
  );
}

/** The card and badge to show now, or null (nothing new, or not open yet). */
export function spireNudge(
  f: SpireNudgeFacts,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
): SpireNudge | null {
  // Unknown climb (not loaded, or the server has no Spire yet): quiet.
  if (!f.spire) return null;
  const entry = spireEntryBoss(catalogue).id;
  const unlocked =
    Math.max(f.spire.clears?.[entry] ?? 0, f.clears?.[entry] ?? 0) > 0;
  if (!unlocked) return null;
  const { highest } = spireStanding({ spire: f.spire }, catalogue);
  const { open } = spireZoneChoice({}, { spire: f.spire }, catalogue);
  const zone = open[open.length - 1];
  const from = spireZoneStart(zone);
  // Already climbing in it (a floor of it cleared).
  if (highest >= from) return null;
  const key = keyOf(f.spire.season ?? catalogue.season, zone);
  if (f.seen.includes(key)) return null;
  const name = catalogue.zones[zone]?.name;
  return {
    key,
    zone,
    from,
    title: zone === 1 ? "The Spire is open" : `Zone ${zone} is open`,
    note:
      zone === 1
        ? "Climb from floor 1"
        : `Climb from floor ${from}${name ? ` · ${name}` : ""}`,
  };
}

/** The Lobby's Spire card: a shortcut to the climb, kept above Missions. */
export interface SpireLobbyCard {
  /** What the Lobby re-renders on: changes whenever the words do. */
  key: string;
  title: string;
  note: string;
  /** Something new (spireNudge): the card glows and Raids gets a dot. */
  fresh: boolean;
  /**
   * The climb to the next title, when one is within the floors released:
   * the floors after the last title floor up to the next, and how far the
   * player has cleared. The card draws them as a small ladder.
   */
  ladder?: SpireLadder;
}
export interface SpireLadder {
  /** The first floor after the last title floor (or floor 1). */
  from: number;
  /** The next floor that gives a title. */
  to: number;
  /** The highest floor cleared. */
  cleared: number;
}
/** The next title floor above `highest`, with the floors that lead to it. */
export function spireLadder(
  highest: number,
  season: number,
  top: number,
): SpireLadder | undefined {
  const floors = SPIRE_REWARDS.filter(
    (r) => r.kind === "title" && r.season === season,
  )
    .map((r) => r.floor)
    .sort((a, b) => a - b);
  const to = floors.find((f) => f > highest);
  // None left, or it sits above the floors that can be climbed yet.
  if (to === undefined || to > top) return undefined;
  const last = floors.filter((f) => f <= highest).pop() ?? 0;
  return { from: last + 1, to, cleared: highest };
}
/**
 * The card once the Spire is open (a Cragmuff clear), every time: the news
 * while a zone is new to climb, else your best floor and where a climb
 * starts. Nothing before it opens or while the climb is unknown.
 */
export function spireLobbyCard(
  f: SpireNudgeFacts,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
): SpireLobbyCard | null {
  const nudge = spireNudge(f, catalogue);
  const ladder = f.spire
    ? spireLadder(
        spireStanding({ spire: f.spire }, catalogue).highest,
        f.spire.season ?? catalogue.season,
        catalogue.builtTop,
      )
    : undefined;
  if (nudge)
    return {
      key: `new:${nudge.key}`,
      title: nudge.title,
      // The news keeps the headline; the next title is the reason to go.
      note: ladder ? `Floor ${ladder.to} → new title` : nudge.note,
      fresh: true,
      ladder,
    };
  if (!f.spire) return null;
  const entry = spireEntryBoss(catalogue).id;
  if (Math.max(f.spire.clears?.[entry] ?? 0, f.clears?.[entry] ?? 0) <= 0)
    return null;
  const { highest } = spireStanding({ spire: f.spire }, catalogue);
  const { zone, start } = spireZoneChoice({}, { spire: f.spire }, catalogue);
  const name = catalogue.zones[zone]?.name;
  // Every released floor cleared; the summit too (no floor above it at
  // all): every zone conquered, the whole Spire.
  const title =
    highest >= catalogue.builtTop
      ? catalogue.floors[catalogue.builtTop + 1]
        ? "Every floor cleared"
        : "The Spire is yours"
      : highest > 0
        ? `Best: floor ${highest}`
        : "Start your climb";
  const climb = `Climb from floor ${start}${name ? ` · ${name}` : ""}`;
  // A title within reach is the headline (a reason to tap, where "Best:
  // floor 9" was only a fact), with how far it is and the best floor.
  if (ladder && highest > 0) {
    const left = ladder.to - highest;
    const note = `${left} floor${left === 1 ? "" : "s"} to go · best ${highest}`;
    const goal = `Floor ${ladder.to} → title`;
    return { key: `${goal}|${note}`, title: goal, note, fresh: false, ladder };
  }
  const note = ladder ? `Floor ${ladder.to} → new title` : climb;
  return { key: `${title}|${note}`, title, note, fresh: false, ladder };
}

const KEY = (account: string) => `arena-spire-seen:${account}`;
/** This session's marks too, for a device that can't store them. */
const marked = new Map<string, string[]>();
export function loadSpireSeen(account: string | undefined): string[] {
  if (!account) return [];
  let stored: string[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(account)) ?? "[]");
    if (Array.isArray(raw))
      stored = raw.filter((k): k is string => typeof k === "string");
  } catch {
    /* Private mode: this session's marks only. */
  }
  return [...new Set([...stored, ...(marked.get(account) ?? [])])];
}
/** Remember these keys as seen; true if any was new. */
export function markSpireSeen(
  account: string | undefined,
  keys: readonly string[],
) {
  if (!account || !keys.length) return false;
  const seen = loadSpireSeen(account);
  const fresh = keys.filter((k) => !seen.includes(k));
  if (!fresh.length) return false;
  marked.set(account, [...(marked.get(account) ?? []), ...fresh]);
  try {
    localStorage.setItem(KEY(account), JSON.stringify([...seen, ...fresh]));
  } catch {
    /* Private mode: the card comes back on reload, until seen again. */
  }
  return true;
}
