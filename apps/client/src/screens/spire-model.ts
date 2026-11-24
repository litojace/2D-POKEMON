/** Pure Spire presentation data. No DOM, markup or screen-size rules here. */
import type { CharacterId } from "@arena/shared";
import {
  RAID_BOSSES,
  type RaidProgress,
} from "../../../../packages/shared/src/raid";
import {
  SPIRE_BUILT_TOP,
  SPIRE_FLOORS,
  SPIRE_ZONES,
  SPIRE_REWARDS,
  SPIRE_SEASON,
  SPIRE_SEATS,
  spireResumeFloor,
  spireStartCheckpoint,
  spireZoneOf,
  spireZoneStart,
  spireZoneTop,
  type SpireFloor,
  type SpireProgress,
  type SpireZone,
  type SpireReward,
} from "../../../../packages/shared/src/spire";

/** Runtime content comes from shared gameplay data; tests can supply future zones. */
export interface SpireCatalogue {
  readonly floors: Readonly<Record<number, SpireFloor>>;
  readonly zones: Readonly<Record<number, SpireZone>>;
  readonly rewards: readonly SpireReward[];
  readonly builtTop: number;
  readonly season: number;
}
export const SPIRE_CATALOGUE: SpireCatalogue = {
  floors: SPIRE_FLOORS,
  zones: SPIRE_ZONES,
  rewards: SPIRE_REWARDS,
  builtTop: SPIRE_BUILT_TOP,
  season: SPIRE_SEASON,
};
export const builtFloors = (catalogue: SpireCatalogue = SPIRE_CATALOGUE) =>
  Object.values(catalogue.floors)
    .filter((f) => f.floor <= catalogue.builtTop)
    .sort((a, b) => a.floor - b.floor);
/** The zones that are released (every floor up to their boss is built), in order. */
export const builtZones = (catalogue: SpireCatalogue = SPIRE_CATALOGUE) =>
  Object.values(catalogue.zones)
    .filter((z) => spireZoneTop(z.id) <= catalogue.builtTop)
    .sort((a, b) => a.id - b.id);
export function spireEntryBoss(catalogue: SpireCatalogue = SPIRE_CATALOGUE) {
  const first = builtFloors(catalogue)[0];
  return RAID_BOSSES[catalogue.zones[first.zone].boss];
}
export type SpireTab = "climb" | "floors" | "blessings";
export const SPIRE_TABS: [SpireTab, string][] = [
  ["climb", "Climb"],
  ["floors", "Floors"],
  ["blessings", "Blessings"],
];
/** What the Spire page needs from the Raid Hub's data. */
export interface SpireData {
  progress: RaidProgress | null;
  spire?: SpireProgress | null;
  loading: boolean;
  me: { name: string; character: CharacterId };
  party: {
    id: string;
    name: string;
    character: CharacterId;
    leader: boolean;
    me: boolean;
  }[];
  leader: boolean;
  inRoom: boolean;
}
export interface SpireView {
  spireTab?: SpireTab;
  /** Floor preview only; starting a climb never uses it. */
  spireFloor?: number;
  /** The zone picked to climb (default: the highest open to you). */
  spireZone?: number;
  play: "solo" | "party";
  status: string;
}

/** The Spire opens with any Cragmuff clear. */
export function spireUnlocked(
  d: Pick<SpireData, "progress" | "spire">,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const boss = spireEntryBoss(catalogue).id;
  return (
    (d.spire?.clears?.[boss] ??
      d.progress?.bosses?.[boss]?.clears ??
      d.progress?.clears ??
      0) > 0
  );
}
/**
 * Your climb so far (nothing saved yet: floor 0, checkpoint 1). The
 * checkpoint is where a climb starts: the first floor of the highest zone
 * open to you that is built (after zone 1's boss, floor 1 until zone 2
 * exists), or the floor after its elite once you have beaten it
 * (spireResumeFloor). Zones open from it: a zone's first floor at or below.
 */
export function spireStanding(
  d: Pick<SpireData, "spire">,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const s = d.spire;
  const highest = s?.highestFloor ?? 0;
  const zoneStart = spireStartCheckpoint(
    s?.checkpoint ?? 1,
    catalogue.builtTop,
  );
  return {
    highest,
    checkpoint: Math.max(
      zoneStart,
      Math.min(
        catalogue.builtTop,
        spireResumeFloor(spireZoneOf(zoneStart), highest),
      ),
    ),
    attempts: s?.attempts ?? 0,
    claimed: new Set(s?.claimed ?? []),
  };
}
/**
 * The zone a climb will be for: the one picked if it is open to you, else
 * the highest open one. Zone 1 always is; a later released zone once its
 * first floor is your checkpoint (zone 2 from checkpoint 11).
 */
export function spireZoneChoice(
  view: Pick<SpireView, "spireZone">,
  d: Pick<SpireData, "spire">,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const { checkpoint, highest } = spireStanding(d, catalogue);
  const zones = builtZones(catalogue);
  const open = zones
    .filter((z) => spireZoneStart(z.id) <= checkpoint)
    .map((z) => z.id);
  if (!open.length) open.push(zones[0]?.id ?? 1);
  const zone = open.includes(view.spireZone ?? 0)
    ? view.spireZone!
    : open[open.length - 1];
  // Where a climb of it starts: past its elite while it is your frontier.
  return {
    zones,
    open,
    zone,
    start: Math.max(spireZoneStart(zone), spireResumeFloor(zone, highest)),
  };
}
/** Start climb: whether it can go now, and what it will do. */
export function spireStartState(
  view: SpireView,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const size = Math.max(1, d.party.length);
  const play: SpireView["play"] = size > 1 ? "party" : view.play;
  const { zone, start } = spireZoneChoice(view, d, catalogue);
  const reason = !spireUnlocked(d, catalogue)
    ? `Clear ${spireEntryBoss(catalogue).name} once to open the Spire.`
    : d.inRoom
      ? "Leave your current room first."
      : !d.leader
        ? "Your party leader starts the climb."
        : "";
  const from = start;
  const first = spireZoneStart(zone);
  // A party starts past the elite only if everyone has beaten it (the
  // server checks each climber): the note says so rather than promise it.
  const where =
    from > first
      ? `zone ${zone} · floor ${from} if all have beaten its elite, else ${first}`
      : `zone ${zone} from floor ${from}`;
  const note = reason
    ? reason
    : play === "solo"
      ? `Just you · zone ${zone} from floor ${from} · one self-revive a floor`
      : size > 1
        ? from === first && first > 1
          ? `${size} of ${SPIRE_SEATS} seats · ${where} · everyone needs checkpoint ${first}`
          : `${size} of ${SPIRE_SEATS} seats · ${where}`
        : `A room for up to ${SPIRE_SEATS} · ${where}`;
  return {
    play,
    ok: !reason,
    reason,
    note,
    soloLocked: size > 1,
    zone,
    from,
  };
}

/** The champions a floor fields (each once), in order of appearance. */
export function floorRoster(f: SpireFloor): CharacterId[] {
  const all = [
    ...f.waves.flat(),
    ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
  ].map((e) => e.character);
  return [...new Set(all)];
}
export function spirePreview(
  view: SpireView,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const floors = builtFloors(catalogue);
  const { highest } = spireStanding(d, catalogue);
  const next = floors.find((f) => f.floor > highest);
  // Previews stay in the zone picked to climb: a picked floor of it, else
  // its next uncleared floor, else its first (where the climb starts).
  const { zone } = spireZoneChoice(view, d, catalogue);
  const inZone = floors.filter((f) => f.zone === zone);
  const selected =
    inZone.find((f) => f.floor === view.spireFloor) ??
    inZone.find((f) => f.floor > highest) ??
    inZone[0] ??
    next ??
    floors[floors.length - 1];
  return { floors, next, selected, zone };
}
export function floorState(
  f: SpireFloor,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const { highest, claimed, checkpoint } = spireStanding(d, catalogue);
  if (f.kind === "boss" && f.floor > catalogue.builtTop)
    return { key: "soon", label: "Coming soon" };
  if (claimed.has(f.floor) || f.floor <= highest)
    return { key: "done", label: "Cleared" };
  // A later zone opens once the one below it is conquered.
  if (spireZoneStart(f.zone) > checkpoint)
    return { key: "locked", label: `Conquer zone ${f.zone - 1} first` };
  // A boss floor also needs that boss's raid cleared (the server checks too).
  const boss = f.kind === "boss" ? f.boss : undefined;
  if (
    boss &&
    !(d.spire?.clears?.[boss] ?? d.progress?.bosses?.[boss]?.clears ?? 0)
  )
    return { key: "locked", label: "Clear its raid first" };
  if (f.floor === highest + 1) return { key: "next", label: "Next" };
  return { key: "locked", label: `Clear floor ${f.floor - 1} first` };
}

export function floorKind(f: SpireFloor) {
  return f.kind === "boss"
    ? "Boss"
    : f.kind === "elite"
      ? "Elite"
      : `${f.waves.length} waves`;
}
export interface SpireFloorModel {
  floor: SpireFloor;
  zone: SpireZone;
  state: ReturnType<typeof floorState>;
  kind: string;
  roster: CharacterId[];
  description: string;
  coins: number;
  title?: string;
  claimed: boolean;
}
export function spireModel(
  view: SpireView,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const standing = spireStanding(d, catalogue);
  const preview = spirePreview(view, d, catalogue);
  const floors: SpireFloorModel[] = preview.floors.map((floor) => {
    const rewards = catalogue.rewards.filter(
      (r) => r.season === catalogue.season && r.floor === floor.floor,
    );
    return {
      floor,
      zone: catalogue.zones[floor.zone],
      state: floorState(floor, d, catalogue),
      kind: floorKind(floor),
      roster: floorRoster(floor),
      description:
        floor.description ??
        (floor.kind === "boss"
          ? `${catalogue.zones[floor.zone].ascendant} encounter`
          : floor.elite
            ? `${floor.elite.name} · captain and reinforcements`
            : "Defeat every Echo wave to open the stairs"),
      coins: rewards
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0),
      title: rewards.find((r) => r.kind === "title")?.item,
      claimed: standing.claimed.has(floor.floor),
    };
  });
  const next = floors.find((f) => f.floor === preview.next);
  const selected = floors.find((f) => f.floor === preview.selected)!;
  const choice = spireZoneChoice(view, d, catalogue);
  const groups = [...new Set(floors.map((f) => f.zone.id))].map((id) => ({
    zone: catalogue.zones[id],
    floors: floors.filter((f) => f.zone.id === id),
    /** Open to climb (zone 1 always; a later one from its checkpoint). */
    open: choice.open.includes(id),
  }));
  return {
    ...standing,
    floors,
    next,
    selected,
    groups,
    activeGroup: groups.find((g) => g.zone.id === selected.zone.id)!,
    total: catalogue.builtTop,
    cleared: Math.min(catalogue.builtTop, Math.max(0, standing.highest)),
    complete: !next,
    climbZone: choice.zone,
    start: spireStartState(view, d, catalogue),
  };
}
export type SpireModel = ReturnType<typeof spireModel>;
