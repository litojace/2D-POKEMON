/**
 * The Spire (docs: the lead's spire plan): a climb in the Raid Hub. Floors of
 * Echo waves, an elite on floor 5 of each zone and the zone's Ascendant boss
 * on floor 10. This file holds everything the server, the client and the
 * database agree on: floors, the one tuning table, blessings, rewards,
 * progress and the snapshot's `raid.spire`.
 *
 * Zone 1 is built: floors 1–9 in the Raid Coliseum and the Ascendant
 * Cragmuff on floor 10, fought in the same room (the Spire's arena turns the
 * Ascendant's rules on for that floor: apps/server/src/spire.ts). Clearing
 * floor 10 ends the climb with zone 1 conquered; the checkpoint at floor 11
 * is only granted once zone 2 exists (`spireStartCheckpoint`, and the
 * database's arena_record_spire_floor).
 */
import type { CharacterId } from "./index.js";
import type { RaidBossId } from "./raid-roster.js";

/** Season 0 for now (a reset would bump it). */
export const SPIRE_SEASON = 0;
/** Floors per zone; floor 10 of each is its boss, floor 5 its elite. */
export const SPIRE_ZONE_FLOORS = 10;
/** The highest floor that can be played today (zone 1's boss). */
export const SPIRE_BUILT_TOP = 10;
/** Party size, like raids. */
export const SPIRE_SEATS = 4;

export type SpireFloorKind = "wave" | "elite" | "boss";
/** Readable waves: a front-liner, a ranged caster, a skirmisher. */
export type SpireRole = "front" | "caster" | "skirmisher";
export const SPIRE_ROLES: Record<SpireRole, { name: string; text: string }> = {
  front: {
    name: "Front-liner",
    text: "Walks straight at you and hits hard up close.",
  },
  caster: { name: "Caster", text: "Keeps its distance and shoots." },
  skirmisher: { name: "Skirmisher", text: "Darts in, strikes and leaves." },
};
export interface SpireEcho {
  character: CharacterId;
  role: SpireRole;
}
export interface SpireZone {
  id: number;
  name: string;
  element: string;
  /** The raid boss of the zone: its clear opens floor 10, its arena is the court. */
  boss: RaidBossId;
  /** The arena the zone's floors are fought in. */
  court: "classic";
  /** Its Ascendant boss name (floor 10). */
  ascendant: string;
  /** The champions its waves lean on (the zone's own element and kin). */
  kin: readonly CharacterId[];
}
export const SPIRE_ZONES: Record<number, SpireZone> = {
  1: {
    id: 1,
    name: "Raid Coliseum",
    element: "Earth",
    boss: "grumblecrag",
    court: "classic",
    ascendant: "Ascendant Cragmuff",
    kin: ["terradon", "wombolder", "pangrove"],
  },
};
export interface SpireFloor {
  floor: number;
  zone: number;
  kind: SpireFloorKind;
  name: string;
  /** Optional encounter briefing shown by the Hub. Generic copy is the fallback. */
  description?: string;
  /** Wave floors: two or three waves (a big party adds the last one again). */
  waves: SpireEcho[][];
  /** Elite floors: the captain and the boss mechanic it borrowed. */
  elite?: {
    captain: SpireEcho;
    name: string;
    mechanic: "eruption";
    /** Escorts that join when the captain drops to half health. */
    escorts: SpireEcho[];
  };
  /** Boss floors: the raid boss whose Ascendant form is fought. */
  boss?: RaidBossId;
}
const e = (character: CharacterId, role: SpireRole): SpireEcho => ({
  character,
  role,
});
/**
 * Zone 1: Earth-leaning (Terradon, Wombolder, Pangrove) plus one off-element
 * champion per floor, roles mixed. Floors 6–9 are defined too (same shape);
 * floor 10 is the Ascendant Cragmuff.
 */
export const SPIRE_FLOORS: Record<number, SpireFloor> = {
  1: {
    floor: 1,
    zone: 1,
    kind: "wave",
    name: "The Echoing Gate",
    waves: [
      [e("terradon", "front")],
      [e("wombolder", "front"), e("voltkit", "caster")],
    ],
  },
  2: {
    floor: 2,
    zone: 1,
    kind: "wave",
    name: "Dust Rows",
    waves: [
      [e("pangrove", "front"), e("terradon", "front")],
      [e("wombolder", "front"), e("cindrake", "skirmisher")],
    ],
  },
  3: {
    floor: 3,
    zone: 1,
    kind: "wave",
    name: "Shale Steps",
    waves: [
      [e("terradon", "front"), e("tidefin", "caster")],
      [e("pangrove", "front"), e("wombolder", "front")],
      [e("terradon", "front"), e("tidefin", "caster")],
    ],
  },
  4: {
    floor: 4,
    zone: 1,
    kind: "wave",
    name: "Pillar Hall",
    waves: [
      [e("wombolder", "front"), e("lumoth", "caster")],
      [e("pangrove", "front"), e("terradon", "front"), e("lumoth", "caster")],
      [e("wombolder", "front"), e("pangrove", "skirmisher")],
    ],
  },
  5: {
    floor: 5,
    zone: 1,
    kind: "elite",
    name: "The Captain's Ring",
    description: "Echo Captain Wombolder · reinforcements and eruption attacks",
    waves: [],
    elite: {
      captain: e("wombolder", "front"),
      name: "Echo Captain Wombolder",
      mechanic: "eruption",
      escorts: [e("pangrove", "front")],
    },
  },
  6: {
    floor: 6,
    zone: 1,
    kind: "wave",
    name: "Cracked Terrace",
    waves: [
      [e("terradon", "front"), e("mystowl", "caster")],
      [
        e("wombolder", "front"),
        e("pangrove", "skirmisher"),
        e("mystowl", "caster"),
      ],
      [e("terradon", "front"), e("wombolder", "front")],
    ],
  },
  7: {
    floor: 7,
    zone: 1,
    kind: "wave",
    name: "Boulder Run",
    waves: [
      [e("wombolder", "front"), e("duskveil", "skirmisher")],
      [
        e("pangrove", "front"),
        e("terradon", "front"),
        e("duskveil", "skirmisher"),
      ],
      [
        e("wombolder", "front"),
        e("pangrove", "skirmisher"),
        e("terradon", "front"),
      ],
    ],
  },
  8: {
    floor: 8,
    zone: 1,
    kind: "wave",
    name: "Echo Choir",
    waves: [
      [
        e("terradon", "front"),
        e("glacelle", "caster"),
        e("pangrove", "skirmisher"),
      ],
      [e("wombolder", "front"), e("glacelle", "caster")],
      [
        e("terradon", "front"),
        e("wombolder", "front"),
        e("pangrove", "skirmisher"),
      ],
    ],
  },
  9: {
    floor: 9,
    zone: 1,
    kind: "wave",
    name: "Stair of Stone",
    waves: [
      [
        e("pangrove", "front"),
        e("wombolder", "front"),
        e("coilemur", "skirmisher"),
      ],
      [
        e("terradon", "front"),
        e("coilemur", "skirmisher"),
        e("pangrove", "skirmisher"),
      ],
      [e("wombolder", "front"), e("pangrove", "front"), e("terradon", "front")],
    ],
  },
  // The Ascendant Cragmuff, in the climb's own room (SpireArena turns the
  // Ascendant's rules on for this floor).
  10: {
    floor: 10,
    zone: 1,
    kind: "boss",
    name: "Ascendant Cragmuff",
    description: "New attacks: Avalanche Charge, Twin Slam",
    waves: [],
    boss: "grumblecrag",
  },
};
export const spireFloor = (floor: number): SpireFloor | undefined =>
  SPIRE_FLOORS[floor];
export const spireZoneOf = (floor: number) =>
  Math.floor((Math.max(1, floor) - 1) / SPIRE_ZONE_FLOORS) + 1;
/** The checkpoint a climb starts from after reaching `floor`: the zone's first floor. */
export const spireCheckpoint = (floor: number) =>
  (spireZoneOf(floor) - 1) * SPIRE_ZONE_FLOORS + 1;
/**
 * Where a new climb starts after reaching `floor`: its zone's first floor,
 * but only a zone that is built and open (below `ceiling`). Clearing zone 1's
 * boss reaches floor 11: until zone 2 exists, the climb starts at floor 1.
 */
export const spireStartCheckpoint = (
  floor: number,
  ceiling: number = SPIRE_BUILT_TOP,
) => {
  const at = spireCheckpoint(floor);
  return at > ceiling ? spireCheckpoint(Math.max(1, ceiling)) : at;
};
/** Every champion a zone's floors can field (loaded before the climb starts). */
export function spireRoster(zone: number): CharacterId[] {
  const out = new Set<CharacterId>();
  for (const f of Object.values(SPIRE_FLOORS)) {
    if (f.zone !== zone) continue;
    for (const w of f.waves) for (const x of w) out.add(x.character);
    if (f.elite) {
      out.add(f.elite.captain.character);
      for (const x of f.elite.escorts) out.add(x.character);
    }
  }
  return [...out];
}

/**
 * The one tuning table (floor by floor). Echoes are normal champions driven
 * by the PvP bot: `difficulty` is the bot's level, `power` multiplies the
 * damage an Echo deals and `armour` the damage it takes (below 1: tougher).
 * `limit` is the floor's time limit in seconds. Tuned by simulation
 * (tests/unit/spire.test.ts "play-test"): a solo Normal bot raider with an
 * average champion clears floor 1 nearly always, and less often each floor.
 */
export const SPIRE_TUNING: Record<
  number,
  {
    difficulty: "easy" | "normal" | "hard";
    power: number;
    armour: number;
    limit: number;
  }
> = {
  1: { difficulty: "easy", power: 0.4, armour: 1.5, limit: 180 },
  2: { difficulty: "easy", power: 0.45, armour: 1.35, limit: 180 },
  3: { difficulty: "easy", power: 0.5, armour: 1.25, limit: 180 },
  4: { difficulty: "easy", power: 0.45, armour: 1.2, limit: 180 },
  5: { difficulty: "normal", power: 0.4, armour: 0.7, limit: 240 },
  6: { difficulty: "easy", power: 0.55, armour: 1.1, limit: 180 },
  7: { difficulty: "normal", power: 0.4, armour: 1.1, limit: 180 },
  8: { difficulty: "normal", power: 0.45, armour: 1.05, limit: 180 },
  9: { difficulty: "normal", power: 0.5, armour: 1, limit: 180 },
  // The boss floor: the raid's own time limit (no extra wave for big parties).
  10: { difficulty: "hard", power: 1, armour: 1, limit: 600 },
};
/** Party scaling, and the cap on fighters on the court. */
export const SPIRE_PARTY = {
  /** Each raider past the first makes Echoes this much tougher. */
  toughness: 0.55,
  /** Each raider past the first makes Echoes hit this much harder. */
  power: 0.06,
  /** Fighters on the court at once (raiders + Echoes): more waves, not more Echoes. */
  court: 6,
  /** Parties of this size or more fight the floor's last wave again. */
  extraWaveFrom: 3,
  /** Seconds of harmless "materialise" warning before an Echo appears. */
  materialise: 0.8,
  /** A beaten Echo fades out after this long. */
  fade: 1.2,
  /** Between two waves. */
  waveGap: 1.6,
  /** From the last Echo falling to the next floor's blessings. */
  cleared: 2.5,
  /** The elite floor's borrowed mechanic: seconds between its casts. */
  eliteCadence: 6.5,
  /** The elite's stagger: per point of damage it takes, and seconds stunned. */
  eliteStagger: 0.09,
  eliteStun: 2.5,
  /**
   * The captain is drawn this much bigger than a champion, and its hit area
   * grows with it (SpireArena.hitRadius), so what you see is what you hit.
   */
  eliteScale: 1.25,
  /** Seconds to read a boss floor's briefing before it goes on without you. */
  bossBriefing: 45,
};
export function spireScale(floor: number, partySize: number) {
  const t = SPIRE_TUNING[floor] ?? SPIRE_TUNING[SPIRE_BUILT_TOP];
  const extra = Math.max(0, partySize - 1);
  return {
    difficulty: t.difficulty,
    power: t.power * (1 + SPIRE_PARTY.power * extra),
    armour: t.armour / (1 + SPIRE_PARTY.toughness * extra),
    // A big party fights one more wave: it gets a minute more.
    limit:
      t.limit +
      (partySize >= SPIRE_PARTY.extraWaveFrom &&
      SPIRE_FLOORS[floor]?.kind !== "boss"
        ? 60
        : 0),
  };
}
/** The waves a party of this size fights on a floor (big parties: one more). */
export function spireWaves(floor: number, partySize: number): SpireEcho[][] {
  const f = SPIRE_FLOORS[floor];
  if (!f || f.kind !== "wave") return [];
  const waves = f.waves.map((w) => [...w]);
  if (partySize >= SPIRE_PARTY.extraWaveFrom && waves.length)
    waves.push([...waves[waves.length - 1]]);
  return waves;
}
/** Echoes on the court at once for this party (the rest of a wave waits). */
export const spireCourtCap = (partySize: number) =>
  Math.max(1, SPIRE_PARTY.court - Math.max(1, partySize));

// ------------------------------------------------------------- Blessings
export type SpireBlessingId =
  | "keen"
  | "stoneskin"
  | "leech"
  | "fleet"
  | "focus"
  | "surge"
  | "rally"
  | "harvest"
  | "bastion"
  | "wake";
export interface SpireBlessing {
  name: string;
  /** `{v}` is replaced by the value at the next stack. */
  text: string;
  /** A short label for the card's corner (what kind of help it is). */
  tag: string;
  /** Values by stack (index 0 = one stack); its length is the most stacks. */
  values: readonly number[];
  /** How `{v}` reads. */
  unit: "percent" | "flat";
}
export const SPIRE_BLESSINGS: Record<SpireBlessingId, SpireBlessing> = {
  keen: {
    name: "Keen Edge",
    text: "Deal {v} more damage to Echoes and bosses.",
    tag: "Damage",
    values: [0.1, 0.18, 0.25],
    unit: "percent",
  },
  stoneskin: {
    name: "Stoneskin",
    text: "Take {v} less damage.",
    tag: "Defence",
    values: [0.1, 0.18, 0.25],
    unit: "percent",
  },
  leech: {
    name: "Leeching Strikes",
    text: "Heal for {v} of the damage you deal.",
    tag: "Healing",
    values: [0.05, 0.09, 0.12],
    unit: "percent",
  },
  fleet: {
    name: "Fleet Step",
    text: "Your dash comes back {v} sooner.",
    tag: "Dash",
    values: [0.2, 0.32, 0.4],
    unit: "percent",
  },
  focus: {
    name: "Focus",
    text: "Your skills cool down {v} faster.",
    tag: "Cooldown",
    values: [0.1, 0.17, 0.22],
    unit: "percent",
  },
  surge: {
    name: "Surge",
    text: "Charge your ultimate {v} faster.",
    tag: "Ultimate",
    values: [0.25, 0.4, 0.5],
    unit: "percent",
  },
  rally: {
    name: "Rally",
    text: "Revive teammates {v} faster.",
    tag: "Revive",
    values: [0.3, 0.5, 0.65],
    unit: "percent",
  },
  harvest: {
    name: "Harvest",
    text: "Heal {v} of your health each time you finish an Echo.",
    tag: "Healing",
    values: [0.06, 0.1, 0.13],
    unit: "percent",
  },
  bastion: {
    name: "Bastion",
    text: "Once a floor, a shield guards you for {v} s when your health drops below 30%.",
    tag: "Defence",
    values: [3, 4, 5],
    unit: "flat",
  },
  wake: {
    name: "Static Wake",
    text: "Dashing leaves a crackling trail: Echoes touching it take {v} damage.",
    tag: "Damage",
    values: [6, 9, 12],
    unit: "flat",
  },
};
export const SPIRE_BLESSING_IDS = Object.keys(
  SPIRE_BLESSINGS,
) as SpireBlessingId[];
/** Options on each blessing card choice. */
export const SPIRE_OFFER = 3;
/** Seconds to choose before the first option is taken. */
export const SPIRE_CHOICE_SECONDS = 20;
/** Bastion's health threshold. */
export const SPIRE_BASTION_AT = 0.3;
export type SpireBlessings = Partial<Record<SpireBlessingId, number>>;
/** A blessing's value with `stacks` stacks (0 when none). */
export function spireBlessingValue(
  id: SpireBlessingId,
  stacks: number | undefined,
) {
  const v = SPIRE_BLESSINGS[id].values;
  if (!stacks || stacks <= 0) return 0;
  return v[Math.min(v.length, stacks) - 1];
}
/** The card text with the value it would have after one more stack. */
export function spireBlessingText(id: SpireBlessingId, stacks = 0) {
  const b = SPIRE_BLESSINGS[id];
  const v = b.values[Math.min(b.values.length - 1, stacks)];
  return b.text.replace(
    "{v}",
    b.unit === "percent" ? `${Math.round(v * 100)}%` : String(v),
  );
}
/** A repeatable 0–1 value (same seed, same answer). */
function hash01(...parts: number[]) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
/**
 * The three blessings a seat is offered before `floor`: seeded by the climb,
 * the floor and the seat (teammates see different cards), never one already
 * at its most stacks. Stacking a blessing you hold is allowed.
 */
export function spireBlessingOffer(
  seed: number,
  floor: number,
  seat: number,
  owned: SpireBlessings = {},
): SpireBlessingId[] {
  const open = SPIRE_BLESSING_IDS.filter(
    (id) => (owned[id] ?? 0) < SPIRE_BLESSINGS[id].values.length,
  );
  return open
    .map((id, i) => ({ id, k: hash01(seed, floor, seat, i) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, SPIRE_OFFER)
    .map((x) => x.id);
}

// --------------------------------------------------------------- Rewards
/**
 * One-time first-clear rewards per floor (season 0). Kept identical to the
 * database's `arena_spire_rewards` rows (tests/unit/spire.test.ts compares).
 * Coins go through the coin ledger once per player and floor; titles too.
 */
export interface SpireReward {
  season: number;
  floor: number;
  kind: "coins" | "title";
  item: string;
  amount: number;
}
export const SPIRE_REWARDS: SpireReward[] = [
  { season: 0, floor: 1, kind: "coins", item: "coins", amount: 20 },
  { season: 0, floor: 2, kind: "coins", item: "coins", amount: 20 },
  { season: 0, floor: 3, kind: "coins", item: "coins", amount: 25 },
  { season: 0, floor: 4, kind: "coins", item: "coins", amount: 25 },
  { season: 0, floor: 5, kind: "coins", item: "coins", amount: 60 },
  { season: 0, floor: 5, kind: "title", item: "Echo Breaker", amount: 0 },
  { season: 0, floor: 6, kind: "coins", item: "coins", amount: 30 },
  { season: 0, floor: 7, kind: "coins", item: "coins", amount: 30 },
  { season: 0, floor: 8, kind: "coins", item: "coins", amount: 35 },
  { season: 0, floor: 9, kind: "coins", item: "coins", amount: 35 },
  { season: 0, floor: 10, kind: "coins", item: "coins", amount: 120 },
  {
    season: 0,
    floor: 10,
    kind: "title",
    item: "Earthshaker of the Spire",
    amount: 0,
  },
];
export const spireRewardsOf = (floor: number, season = SPIRE_SEASON) =>
  SPIRE_REWARDS.filter((r) => r.floor === floor && r.season === season);

// -------------------------------------------------------------- Progress
/** A player's saved climb (GET /api/spire). */
export interface SpireProgress {
  season: number;
  highestFloor: number;
  checkpoint: number;
  attempts: number;
  /** Floors whose first-clear reward is claimed. */
  claimed: number[];
  /** Raid clears that open the Spire (Cragmuff) and its boss floors. */
  clears?: Partial<Record<RaidBossId, number>>;
}
/** What the server reads for each climber before a climb starts. */
export interface SpireMember {
  checkpoint: number;
  clears: Partial<Record<RaidBossId, number>>;
}
/**
 * Where a party may climb: from the lowest checkpoint among its members, up
 * to the lowest ceiling (each boss floor needs every member to have cleared
 * that boss's raid once; nothing is open above SPIRE_BUILT_TOP). The
 * Spire opens with a Cragmuff clear.
 */
export function spireStartFrom(members: readonly SpireMember[]): {
  ok: boolean;
  startFloor: number;
  ceiling: number;
  reason?: string;
} {
  if (!members.length)
    return { ok: true, startFloor: 1, ceiling: SPIRE_BUILT_TOP };
  if (members.some((m) => !(m.clears.grumblecrag ?? 0)))
    return {
      ok: false,
      startFloor: 1,
      ceiling: 0,
      reason: "Every climber must clear Cragmuff once to enter the Spire.",
    };
  let ceiling = SPIRE_BUILT_TOP;
  for (const zone of Object.values(SPIRE_ZONES)) {
    const bossFloor = zone.id * SPIRE_ZONE_FLOORS;
    if (members.some((m) => !(m.clears[zone.boss] ?? 0))) {
      ceiling = Math.min(ceiling, bossFloor - 1);
      break;
    }
  }
  const startFloor = Math.max(
    1,
    Math.min(
      ...members.map((m) =>
        spireStartCheckpoint(Math.max(1, m.checkpoint), ceiling),
      ),
    ),
  );
  return { ok: true, startFloor: Math.min(startFloor, ceiling), ceiling };
}
/** One cleared floor, saved at once (even if the climb fails later). */
export interface SpireFloorReceipt {
  runId: string;
  season: number;
  floor: number;
  startFloor: number;
  partySize: number;
  /** Seconds the climb has run so far. */
  seconds: number;
  blessings: Record<string, SpireBlessings>;
  players: { accountId: string; character: string }[];
}
/** The database's answer: rewards newly claimed by each player. */
export interface SpireFloorResult {
  newClaims: {
    accountId: string;
    floor: number;
    coins: number;
    titles: string[];
  }[];
}

// -------------------------------------------------------------- Snapshot
/** `raid.spire` in a snapshot: everything the client shows of a climb. */
export interface SpireState {
  season: number;
  /** The floor being fought (or next, between floors). */
  floor: number;
  startFloor: number;
  ceiling: number;
  kind: SpireFloorKind;
  /** Current wave (1-based) and how many this floor has. */
  wave: number;
  waves: number;
  /** Echoes still to beat this wave (on the court or about to appear). */
  echoesLeft: number;
  /** Champions this climb's floors use: loaded before the fight. */
  roster: CharacterId[];
  /** Echoes about to appear: a harmless violet ring, then the Echo. */
  spawns: {
    id: number;
    x: number;
    y: number;
    at: number;
    character: CharacterId;
  }[];
  /** Blessings by raider (stacks per blessing). */
  blessings: Record<string, SpireBlessings>;
  /** Cards on offer, by raider (empty once picked). */
  offers: Record<string, SpireBlessingId[]>;
  /** Highest floor cleared this climb (0: none yet). */
  best: number;
  /** Server time the floor's last Echo fell (the stairs open). */
  clearedAt?: number;
  /** Seconds the floor may last. */
  limit: number;
  /** The elite captain's fighter id (elite floors). */
  eliteId?: string;
  /** Climb seconds across floors. */
  climbSeconds: number;
  /** Saving each cleared floor, and what it earned the viewer's party. */
  saves: {
    floor: number;
    status: "saving" | "saved" | "unavailable";
    /** First-clear rewards it earned, by fighter id (only new ones). */
    claims?: { playerId: string; coins: number; titles: string[] }[];
  }[];
  /** Why the climb could not start (a member without a Cragmuff clear…). */
  problem?: string;
}
