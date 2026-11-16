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
  spireStartCheckpoint,
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
  /** Floor preview only; starting a climb always uses the checkpoint. */
  spireFloor?: number;
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
 * checkpoint is where a climb starts: a zone that is built (after zone 1's
 * boss, floor 1 until zone 2 exists).
 */
export function spireStanding(
  d: Pick<SpireData, "spire">,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const s = d.spire;
  return {
    highest: s?.highestFloor ?? 0,
    checkpoint: spireStartCheckpoint(s?.checkpoint ?? 1, catalogue.builtTop),
    attempts: s?.attempts ?? 0,
    claimed: new Set(s?.claimed ?? []),
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
  const { checkpoint } = spireStanding(d, catalogue);
  const reason = !spireUnlocked(d, catalogue)
    ? `Clear ${spireEntryBoss(catalogue).name} once to open the Spire.`
    : d.inRoom
      ? "Leave your current room first."
      : !d.leader
        ? "Your party leader starts the climb."
        : "";
  const from = checkpoint;
  const note = reason
    ? reason
    : play === "solo"
      ? `Just you · from floor ${from} · one self-revive a floor`
      : size > 1
        ? `${size} of ${SPIRE_SEATS} seats · from your party's lowest checkpoint`
        : `A room for up to ${SPIRE_SEATS} · invite friends there`;
  return { play, ok: !reason, reason, note, soloLocked: size > 1 };
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
  const selected =
    floors.find((f) => f.floor === view.spireFloor) ??
    next ??
    floors[floors.length - 1];
  return { floors, next, selected };
}
export function floorState(
  f: SpireFloor,
  d: SpireData,
  catalogue: SpireCatalogue = SPIRE_CATALOGUE,
) {
  const { highest, claimed } = spireStanding(d, catalogue);
  if (f.kind === "boss" && f.floor > catalogue.builtTop)
    return { key: "soon", label: "Coming soon" };
  if (claimed.has(f.floor) || f.floor <= highest)
    return { key: "done", label: "Cleared" };
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
          ? "Ascendant boss encounter"
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
  const groups = [...new Set(floors.map((f) => f.zone.id))].map((id) => ({
    zone: catalogue.zones[id],
    floors: floors.filter((f) => f.zone.id === id),
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
    start: spireStartState(view, d, catalogue),
  };
}
export type SpireModel = ReturnType<typeof spireModel>;
