/**
 * The Spire (docs: the lead's spire plan): a climb in the Raid Hub. Floors of
 * Echo waves, an elite on floor 5 of each zone and the zone's Ascendant boss
 * on floor 10. This file holds everything the server, the client and the
 * database agree on: floors, the one tuning table, blessings, rewards,
 * progress and the snapshot's `raid.spire`.
 *
 * Zones 1 to 4 are built. One climb is one zone: a room is made for a
 * zone (its first floor is the start) and its boss floor ends the climb.
 * Zone 1: floors 1–9 on the Spire's court and the Ascendant Cragmuff on
 * floor 10. Zone 2: floors 11–19 (Water) and the Ascendant Tidelotl on
 * floor 20, in the lagoon. Zone 3: floors 21–29 (Shadow) and the Ascendant
 * Inkpurr on floor 30, in the Lantern Yard. Zone 4: floors 31–39 (Psychic)
 * and the Ascendant Snoozaku on floor 40, on the Cloud Deck. Each boss is fought in the same room (the zone's
 * arena turns the Ascendant's rules on for that floor:
 * apps/server/src/spire.ts). Clearing zone 1's boss grants checkpoint 11
 * (`spireStartCheckpoint`, and the database's arena_record_spire_floor).
 */
import type { CharacterId } from "./index.js";
import type { RaidAttack } from "./raid.js";
import type { RaidBossId } from "./raid-roster.js";

/** Season 0 for now (a reset would bump it). */
export const SPIRE_SEASON = 0;
/** Floors per zone; floor 10 of each is its boss, floor 5 its elite. */
export const SPIRE_ZONE_FLOORS = 10;
/** The highest floor that can be played today (zone 4's boss). */
export const SPIRE_BUILT_TOP = 40;
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
  /** The raid boss of the zone: its clear opens the boss floor; its arena is the boss floor's court. */
  boss: RaidBossId;
  /** The arena the zone's boss floor is fought in (wave floors: the Spire's court). */
  court: "classic" | "lagoon" | "lantern-yard" | "cloud-deck";
  /** Its Ascendant boss name (the boss floor). */
  ascendant: string;
  /** The Ascendant's new attacks (the boss floor's briefing and the Floors list). */
  ascendantMoves: readonly RaidAttack[];
  /** The boss floor's briefing: what its raid asked, and how the Ascendant reads you. */
  bossLead: string;
  bossReads: string;
  /** Short name of the boss in its raid ("Cragmuff"). */
  bossName: string;
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
    ascendantMoves: ["avalanche", "fissure", "twin-slam"],
    bossName: "Cragmuff",
    bossLead:
      "Cragmuff, evolved. Its raid's rules still hold (bait charges into pillars, hit the core when it opens), pushed further: new attacks, combos and fewer openings.",
    bossReads:
      "Eruptions land where you usually dodge, standing still to attack draws a stomp, a slam may turn into another attack halfway (shown in full), and it hunts whoever kneels to revive.",
    kin: ["terradon", "wombolder", "pangrove"],
  },
  2: {
    id: 2,
    name: "Lagoon",
    element: "Water",
    boss: "tidewyrm",
    court: "lagoon",
    ascendant: "Ascendant Tidelotl",
    ascendantMoves: ["breaker", "geyser"],
    bossName: "Tidelotl",
    bossLead:
      "Tidelotl, evolved. Its raid's rules still hold (lure its dive onto an island, share the islands when the tide rises, pop bubbles), pushed further: new attacks, combos and fewer openings.",
    bossReads:
      "Geysers rise where you usually dodge, standing still to attack draws a Geyser Line, a dive may sink away and become geysers (shown in full), and it hunts whoever kneels to revive.",
    // Water (Tidefin, Glacelle) and their marsh kin, Mossloth.
    kin: ["tidefin", "glacelle", "mossloth"],
  },
  3: {
    id: 3,
    name: "Lantern Yard",
    element: "Shadow",
    boss: "gloomshade",
    court: "lantern-yard",
    ascendant: "Ascendant Inkpurr",
    ascendantMoves: ["nightfall", "pounce"],
    bossName: "Inkpurr",
    bossLead:
      "Inkpurr, evolved. Its raid's rules still hold (find the real one by its shadow in lantern light, keep the lanterns lit, never hit a copy), pushed further: new attacks, combos and fewer openings.",
    bossReads:
      "Pounces land where you usually dodge and its moonlight pools sit away from there, standing still to attack draws a pounce, a lunge may sink into the dark and become a pounce (shown in full), and it hunts whoever kneels to revive.",
    // Shadow (Duskveil, Shadopus) and their night kin, Mystowl: the owl
    // that hunts in the dark (its Third-Eye Ray is Inkpurr's own counter).
    kin: ["duskveil", "shadopus", "mystowl"],
  },
  4: {
    id: 4,
    name: "Cloud Deck",
    element: "Psychic",
    boss: "somnara",
    court: "cloud-deck",
    ascendant: "Ascendant Snoozaku",
    ascendantMoves: ["twin-dream", "dream-tide"],
    bossName: "Snoozaku",
    bossLead:
      "Snoozaku, evolved. Its raid's rules still hold (the Dreamer calls the runes, step the pads in order, jump the lullaby rings, wake whoever falls asleep), pushed further: two Dreamers who each see half the runes, a Dream Tide only the Seer can read (they call the one awake pad), combos and fewer openings.",
    bossReads:
      "Stars land where you usually dodge, standing still to attack draws stars, a Trunk Slam may turn into Falling Stars (shown in full), and it hunts whoever kneels to revive.",
    // Psychic (Mystowl, Astrabun: their Mind Maze and Moon Hop are
    // Snoozaku's own counters in its raid) and their kin of the mind,
    // Auralynx, the aura-reading lynx.
    kin: ["mystowl", "astrabun", "auralynx"],
  },
};
/** The first floor of each built zone: where a climb may start. */
export const spireZoneStart = (zone: number) =>
  (Math.max(1, zone) - 1) * SPIRE_ZONE_FLOORS + 1;
/** A zone's boss floor (its top). */
export const spireZoneTop = (zone: number) =>
  Math.max(1, zone) * SPIRE_ZONE_FLOORS;
export const SPIRE_BUILT_ZONES = Object.values(SPIRE_ZONES)
  .map((z) => z.id)
  .filter((id) => spireZoneTop(id) <= SPIRE_BUILT_TOP)
  .sort((a, b) => a - b);
/** The zone whose boss is this raid boss (each zone has its own). */
export const spireZoneOfBoss = (boss: RaidBossId) =>
  Object.values(SPIRE_ZONES).find((z) => z.boss === boss)?.id;
/**
 * The boss mechanic an elite captain borrows: its raid's attack, played
 * through the raid warning system, and how the briefing names it.
 */
export const SPIRE_ELITE_MECHANICS = {
  eruption: {
    attack: "eruption",
    boss: "Cragmuff",
    name: "eruptions",
    hint: "they chase you: keep moving",
    cue: "Eruptions chase you — keep moving!",
  },
  bubbles: {
    attack: "bubbles",
    boss: "Tidelotl",
    name: "bubble volleys",
    hint: "weave between the slow bubbles or pop them: a hit roots you",
    cue: "Bubbles coming — weave through or pop them!",
  },
  // The whole court darkens in a checkerboard: every raider has a lit tile
  // next to them. On the Spire the board never flips (the raid's trick);
  // the dark tiles are the ones the party stands on, so it makes you move.
  hands: {
    attack: "hands",
    boss: "Inkpurr",
    name: "grasping hands",
    hint: "the floor darkens in a checkerboard: step onto a lit tile before the hands close",
    cue: "Grasping Hands — step onto a lit tile!",
  },
  // A constellation of star marks falls with its first star on a raider:
  // step out of the circle under you (the middle and the gaps are safe).
  // On the Spire no star is laid under a phone's touch controls.
  stars: {
    attack: "falling-stars",
    boss: "Snoozaku",
    name: "falling stars",
    hint: "a ring of star marks falls with one star on you: step out of its circle before it lands",
    cue: "Falling Stars — step out of the star under you!",
  },
} as const satisfies Record<
  string,
  {
    attack: RaidAttack;
    boss: string;
    name: string;
    hint: string;
    cue: string;
  }
>;
export type SpireEliteMechanic = keyof typeof SPIRE_ELITE_MECHANICS;
/**
 * The court under a phone's touch controls (world px: x0, y0, x1, y1): the
 * joystick, dash, jump, the three skills, the ultimate and the attack
 * button, each control's box at 667x375 and 844x390 together (measured in
 * the visual harness for ASCENDANT_INKPURR.nightfall.phoneControls; phones
 * have no target row any more). The elite's falling stars are never laid
 * within `SPIRE_CONTROL_MARGIN` of one: a warning under a thumb can't be read.
 */
export const SPIRE_PHONE_CONTROLS: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [-260, 560, 183, 835],
  [1528, 455, 1868, 600],
  [1534, 630, 1874, 774],
  [1124, 686, 1486, 848],
  [1078, 497, 1440, 660],
  [1188, 337, 1550, 501],
  [1381, 305, 1750, 479],
  [1269, 497, 1714, 745],
];
export const SPIRE_CONTROL_MARGIN = 12;
/** Is a disc (centre, radius) within `margin` of a phone's touch controls? */
export function spireUnderControls(
  x: number,
  y: number,
  radius = 0,
  margin = SPIRE_CONTROL_MARGIN,
) {
  return SPIRE_PHONE_CONTROLS.some(([x0, y0, x1, y1]) => {
    const dx = Math.max(x0 - x, 0, x - x1),
      dy = Math.max(y0 - y, 0, y - y1);
    return (dx === 0 && dy === 0) || Math.hypot(dx, dy) < radius + margin;
  });
}
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
    mechanic: SpireEliteMechanic;
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
  // Zone 2, the Lagoon: Water-leaning (Tidefin, Glacelle) with their marsh
  // kin Mossloth, plus one off-element champion per floor.
  11: {
    floor: 11,
    zone: 2,
    kind: "wave",
    name: "The Tidegate",
    waves: [
      [e("mossloth", "front"), e("glacelle", "caster")],
      [e("tidefin", "skirmisher"), e("shadopus", "skirmisher")],
      [e("mossloth", "front"), e("tidefin", "front")],
    ],
  },
  12: {
    floor: 12,
    zone: 2,
    kind: "wave",
    name: "Brine Steps",
    waves: [
      [e("tidefin", "front"), e("mossloth", "front")],
      [e("glacelle", "caster"), e("sunbara", "front")],
      [e("mossloth", "front"), e("tidefin", "skirmisher")],
    ],
  },
  13: {
    floor: 13,
    zone: 2,
    kind: "wave",
    name: "Kelp Hollow",
    waves: [
      [e("mossloth", "front"), e("pyranda", "caster")],
      [e("tidefin", "skirmisher"), e("glacelle", "caster")],
      [e("mossloth", "front"), e("tidefin", "front"), e("pyranda", "caster")],
    ],
  },
  14: {
    floor: 14,
    zone: 2,
    kind: "wave",
    name: "Coral Gallery",
    waves: [
      [e("mossloth", "front"), e("terradon", "front"), e("glacelle", "caster")],
      [e("tidefin", "skirmisher"), e("mossloth", "front")],
      [e("tidefin", "front"), e("terradon", "front"), e("glacelle", "caster")],
    ],
  },
  15: {
    floor: 15,
    zone: 2,
    kind: "elite",
    name: "The Drowned Ring",
    description: "Echo Captain Glacelle · reinforcements and bubble volleys",
    waves: [],
    elite: {
      captain: e("glacelle", "front"),
      name: "Echo Captain Glacelle",
      mechanic: "bubbles",
      escorts: [e("tidefin", "skirmisher")],
    },
  },
  16: {
    floor: 16,
    zone: 2,
    kind: "wave",
    name: "Mist Terrace",
    waves: [
      [e("mossloth", "front"), e("coilemur", "skirmisher")],
      [e("tidefin", "skirmisher"), e("glacelle", "caster")],
      [
        e("mossloth", "front"),
        e("tidefin", "front"),
        e("coilemur", "skirmisher"),
      ],
    ],
  },
  17: {
    floor: 17,
    zone: 2,
    kind: "wave",
    name: "Riptide Run",
    waves: [
      [
        e("glacelle", "caster"),
        e("mossloth", "front"),
        e("cindrake", "skirmisher"),
      ],
      [
        e("tidefin", "skirmisher"),
        e("mossloth", "front"),
        e("tidefin", "front"),
      ],
      [e("glacelle", "caster"), e("cindrake", "skirmisher")],
    ],
  },
  18: {
    floor: 18,
    zone: 2,
    kind: "wave",
    name: "Pearl Choir",
    waves: [
      [e("mossloth", "front"), e("auralynx", "front"), e("glacelle", "caster")],
      [
        e("tidefin", "skirmisher"),
        e("auralynx", "front"),
        e("tidefin", "skirmisher"),
      ],
      [
        e("mossloth", "front"),
        e("glacelle", "caster"),
        e("tidefin", "skirmisher"),
      ],
    ],
  },
  19: {
    floor: 19,
    zone: 2,
    kind: "wave",
    name: "Stair of Spray",
    waves: [
      [
        e("mossloth", "front"),
        e("tidefin", "skirmisher"),
        e("wombolder", "front"),
      ],
      [
        e("glacelle", "caster"),
        e("wombolder", "front"),
        e("tidefin", "skirmisher"),
      ],
      [e("mossloth", "front"), e("mossloth", "front"), e("glacelle", "caster")],
    ],
  },
  // The Ascendant Tidelotl, in the lagoon, in the climb's own room.
  20: {
    floor: 20,
    zone: 2,
    kind: "boss",
    name: "Ascendant Tidelotl",
    description: "New attacks: Breaker Wall, Geyser Line",
    waves: [],
    boss: "tidewyrm",
  },
  // Zone 3, the Lantern Yard: Shadow-leaning (Duskveil, Shadopus) with their
  // night kin Mystowl, plus one off-element champion per floor.
  21: {
    floor: 21,
    zone: 3,
    kind: "wave",
    name: "The Dusk Gate",
    waves: [
      [e("duskveil", "front"), e("mystowl", "caster")],
      [e("shadopus", "skirmisher"), e("astrabun", "skirmisher")],
      [e("duskveil", "front"), e("shadopus", "skirmisher")],
    ],
  },
  22: {
    floor: 22,
    zone: 3,
    kind: "wave",
    name: "Lantern Rows",
    waves: [
      [e("shadopus", "skirmisher"), e("duskveil", "front")],
      [e("mystowl", "caster"), e("lumoth", "caster")],
      [e("duskveil", "front"), e("shadopus", "skirmisher")],
    ],
  },
  23: {
    floor: 23,
    zone: 3,
    kind: "wave",
    name: "Ink Stair",
    waves: [
      [e("duskveil", "front"), e("wombolder", "front")],
      [e("mystowl", "caster"), e("shadopus", "skirmisher")],
      [e("wombolder", "front"), e("duskveil", "front"), e("mystowl", "caster")],
    ],
  },
  24: {
    floor: 24,
    zone: 3,
    kind: "wave",
    name: "Hall of Whispers",
    waves: [
      [
        e("duskveil", "front"),
        e("shadopus", "skirmisher"),
        e("halcyra", "caster"),
      ],
      [e("mystowl", "caster"), e("duskveil", "front")],
      [
        e("shadopus", "skirmisher"),
        e("halcyra", "caster"),
        e("duskveil", "front"),
      ],
    ],
  },
  25: {
    floor: 25,
    zone: 3,
    kind: "elite",
    name: "The Lightless Ring",
    description: "Echo Captain Duskveil · reinforcements and grasping hands",
    waves: [],
    elite: {
      captain: e("duskveil", "front"),
      name: "Echo Captain Duskveil",
      mechanic: "hands",
      escorts: [e("shadopus", "skirmisher")],
    },
  },
  26: {
    floor: 26,
    zone: 3,
    kind: "wave",
    name: "Gloam Terrace",
    waves: [
      [e("duskveil", "front"), e("auralynx", "front")],
      [e("shadopus", "skirmisher"), e("mystowl", "caster")],
      [
        e("auralynx", "front"),
        e("duskveil", "front"),
        e("shadopus", "skirmisher"),
      ],
    ],
  },
  27: {
    floor: 27,
    zone: 3,
    kind: "wave",
    name: "Umbral Run",
    waves: [
      [
        e("mystowl", "caster"),
        e("duskveil", "front"),
        e("coilemur", "skirmisher"),
      ],
      [
        e("shadopus", "skirmisher"),
        e("duskveil", "front"),
        e("shadopus", "skirmisher"),
      ],
      [e("mystowl", "caster"), e("coilemur", "skirmisher")],
    ],
  },
  28: {
    floor: 28,
    zone: 3,
    kind: "wave",
    name: "Midnight Choir",
    waves: [
      [
        e("duskveil", "front"),
        e("pyranda", "caster"),
        e("shadopus", "skirmisher"),
      ],
      [
        e("shadopus", "skirmisher"),
        e("duskveil", "front"),
        e("shadopus", "skirmisher"),
      ],
      [e("mystowl", "caster"), e("pyranda", "caster"), e("duskveil", "front")],
    ],
  },
  29: {
    floor: 29,
    zone: 3,
    kind: "wave",
    name: "Stair of Night",
    waves: [
      [
        e("duskveil", "front"),
        e("shadopus", "skirmisher"),
        e("terradon", "front"),
      ],
      [
        e("mystowl", "caster"),
        e("terradon", "front"),
        e("shadopus", "skirmisher"),
      ],
      [e("duskveil", "front"), e("duskveil", "front"), e("mystowl", "caster")],
    ],
  },
  // The Ascendant Inkpurr, in the Lantern Yard, in the climb's own room.
  30: {
    floor: 30,
    zone: 3,
    kind: "boss",
    name: "Ascendant Inkpurr",
    description: "New attacks: Nightfall, Shade Pounce",
    waves: [],
    boss: "gloomshade",
  },
  // Zone 4, the Cloud Deck: Psychic-leaning (Mystowl, Astrabun) with their
  // kin of the mind Auralynx, plus one off-element champion per floor.
  31: {
    floor: 31,
    zone: 4,
    kind: "wave",
    name: "The Drowsy Gate",
    waves: [
      [e("auralynx", "front"), e("mystowl", "caster")],
      [e("astrabun", "skirmisher"), e("lumoth", "caster")],
      [e("auralynx", "front"), e("astrabun", "skirmisher")],
    ],
  },
  32: {
    floor: 32,
    zone: 4,
    kind: "wave",
    name: "Pillow Steps",
    waves: [
      [e("astrabun", "skirmisher"), e("auralynx", "front")],
      [e("mystowl", "caster"), e("pangrove", "front")],
      [e("auralynx", "front"), e("astrabun", "skirmisher")],
    ],
  },
  33: {
    floor: 33,
    zone: 4,
    kind: "wave",
    name: "Moonlit Rows",
    waves: [
      [e("auralynx", "front"), e("shadopus", "skirmisher")],
      [e("mystowl", "caster"), e("astrabun", "skirmisher")],
      [
        e("shadopus", "skirmisher"),
        e("auralynx", "front"),
        e("mystowl", "caster"),
      ],
    ],
  },
  34: {
    floor: 34,
    zone: 4,
    kind: "wave",
    name: "Hall of Murmurs",
    waves: [
      [
        e("auralynx", "front"),
        e("astrabun", "skirmisher"),
        e("glacelle", "caster"),
      ],
      [e("mystowl", "caster"), e("auralynx", "front")],
      [
        e("astrabun", "skirmisher"),
        e("glacelle", "caster"),
        e("auralynx", "front"),
      ],
    ],
  },
  35: {
    floor: 35,
    zone: 4,
    kind: "elite",
    name: "The Starfall Ring",
    description: "Echo Captain Mystowl · reinforcements and falling stars",
    waves: [],
    elite: {
      captain: e("mystowl", "front"),
      name: "Echo Captain Mystowl",
      mechanic: "stars",
      escorts: [e("astrabun", "skirmisher")],
    },
  },
  36: {
    floor: 36,
    zone: 4,
    kind: "wave",
    name: "Reverie Terrace",
    waves: [
      [e("auralynx", "front"), e("terradon", "front")],
      [e("astrabun", "skirmisher"), e("mystowl", "caster")],
      [
        e("terradon", "front"),
        e("auralynx", "front"),
        e("astrabun", "skirmisher"),
      ],
    ],
  },
  37: {
    floor: 37,
    zone: 4,
    kind: "wave",
    name: "Lullaby Run",
    waves: [
      [
        e("mystowl", "caster"),
        e("auralynx", "front"),
        e("cindrake", "skirmisher"),
      ],
      [
        e("astrabun", "skirmisher"),
        e("auralynx", "front"),
        e("astrabun", "skirmisher"),
      ],
      [e("mystowl", "caster"), e("cindrake", "skirmisher")],
    ],
  },
  38: {
    floor: 38,
    zone: 4,
    kind: "wave",
    name: "Dreamer's Choir",
    waves: [
      [
        e("auralynx", "front"),
        e("halcyra", "caster"),
        e("astrabun", "skirmisher"),
      ],
      [
        e("astrabun", "skirmisher"),
        e("auralynx", "front"),
        e("astrabun", "skirmisher"),
      ],
      [e("mystowl", "caster"), e("halcyra", "caster"), e("auralynx", "front")],
    ],
  },
  39: {
    floor: 39,
    zone: 4,
    kind: "wave",
    name: "Stair of Stars",
    waves: [
      [
        e("auralynx", "front"),
        e("astrabun", "skirmisher"),
        e("mossloth", "front"),
      ],
      [
        e("mystowl", "caster"),
        e("mossloth", "front"),
        e("astrabun", "skirmisher"),
      ],
      [e("auralynx", "front"), e("auralynx", "front"), e("mystowl", "caster")],
    ],
  },
  // The Ascendant Snoozaku, on the Cloud Deck, in the climb's own room.
  40: {
    floor: 40,
    zone: 4,
    kind: "boss",
    name: "Ascendant Snoozaku",
    description: "New attacks: Twin Dream, Dream Tide",
    waves: [],
    boss: "somnara",
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
  // Zone 2: a climb starts at 11 with no blessings, against champions far
  // deadlier per point than zone 1's Earth front-liners (casters, an
  // assassin, a controller), so the numbers start below floor 9's and each
  // Echo grows a little stronger floor by floor (on 16–19, as in zone 3,
  // its toughness follows its floor's line-up: floor 16's is the easiest).
  // By simulation (tests/unit/spire-zone2.test.ts; 96 seeds) a solo bot
  // clears floor 11 about four times in five, floor 16 about two in five,
  // falling smoothly to about one in five on floor 19; floor 9 one in three.
  11: { difficulty: "normal", power: 0.44, armour: 1.36, limit: 180 },
  12: { difficulty: "normal", power: 0.45, armour: 1.34, limit: 180 },
  13: { difficulty: "normal", power: 0.46, armour: 1.32, limit: 180 },
  14: { difficulty: "normal", power: 0.47, armour: 1.3, limit: 180 },
  15: { difficulty: "normal", power: 0.55, armour: 0.58, limit: 240 },
  16: { difficulty: "normal", power: 0.48, armour: 1.02, limit: 180 },
  17: { difficulty: "normal", power: 0.49, armour: 1.35, limit: 180 },
  18: { difficulty: "normal", power: 0.5, armour: 1.29, limit: 180 },
  19: { difficulty: "normal", power: 0.52, armour: 1.18, limit: 180 },
  20: { difficulty: "hard", power: 1, armour: 1, limit: 600 },
  // Zone 3: a climb starts at 21 with no blessings, against Shadow Echoes
  // (an assassin, a trickster, a duelist) and one off-element champion a
  // floor. Each Echo hits a little harder floor by floor; how much damage
  // it takes follows its floor's line-up (two casters on 24 and 28 make
  // those floors' Echoes softer, not the floors easier). By simulation
  // (tests/unit/spire-zone3.test.ts; a solo Normal bot raider, 96 seeds)
  // floor 21 is cleared about two times in three, falling smoothly to
  // about one in three on floor 29.
  21: { difficulty: "normal", power: 0.48, armour: 1.6, limit: 180 },
  22: { difficulty: "normal", power: 0.49, armour: 1.3, limit: 180 },
  23: { difficulty: "normal", power: 0.5, armour: 1.35, limit: 180 },
  24: { difficulty: "normal", power: 0.51, armour: 1.85, limit: 180 },
  25: { difficulty: "normal", power: 0.58, armour: 0.54, limit: 240 },
  26: { difficulty: "normal", power: 0.52, armour: 0.97, limit: 180 },
  27: { difficulty: "normal", power: 0.53, armour: 1.36, limit: 180 },
  28: { difficulty: "normal", power: 0.54, armour: 1.68, limit: 180 },
  29: { difficulty: "normal", power: 0.55, armour: 1.08, limit: 180 },
  30: { difficulty: "hard", power: 1, armour: 1, limit: 600 },
  // Zone 4: a climb starts at 31 with no blessings, against Psychic Echoes
  // (a duelist owl, a blinking rabbit, a counter lynx) and one off-element
  // champion a floor. As in zone 3, each Echo hits a little harder floor by
  // floor and its toughness follows its floor's line-up. By simulation
  // (tests/unit/spire-zone4.test.ts; a solo Normal bot raider, 96 seeds)
  // floor 31 is cleared about two times in three, falling smoothly to
  // about one in three on floors 38 and 39.
  31: { difficulty: "normal", power: 0.56, armour: 1.66, limit: 180 },
  32: { difficulty: "normal", power: 0.57, armour: 1.39, limit: 180 },
  33: { difficulty: "normal", power: 0.58, armour: 1.72, limit: 180 },
  34: { difficulty: "normal", power: 0.59, armour: 1.62, limit: 180 },
  35: { difficulty: "normal", power: 0.62, armour: 0.57, limit: 240 },
  36: { difficulty: "normal", power: 0.6, armour: 1.14, limit: 180 },
  37: { difficulty: "normal", power: 0.61, armour: 1.29, limit: 180 },
  38: { difficulty: "normal", power: 0.62, armour: 1.93, limit: 180 },
  39: { difficulty: "normal", power: 0.63, armour: 1.39, limit: 180 },
  40: { difficulty: "hard", power: 1, armour: 1, limit: 600 },
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
  // Zone 2 (migration 20261116180000_spire_zone2.sql).
  { season: 0, floor: 11, kind: "coins", item: "coins", amount: 40 },
  { season: 0, floor: 12, kind: "coins", item: "coins", amount: 40 },
  { season: 0, floor: 13, kind: "coins", item: "coins", amount: 45 },
  { season: 0, floor: 14, kind: "coins", item: "coins", amount: 45 },
  { season: 0, floor: 15, kind: "coins", item: "coins", amount: 100 },
  { season: 0, floor: 16, kind: "coins", item: "coins", amount: 50 },
  { season: 0, floor: 17, kind: "coins", item: "coins", amount: 50 },
  { season: 0, floor: 18, kind: "coins", item: "coins", amount: 55 },
  { season: 0, floor: 19, kind: "coins", item: "coins", amount: 55 },
  { season: 0, floor: 20, kind: "coins", item: "coins", amount: 200 },
  {
    season: 0,
    floor: 20,
    kind: "title",
    item: "Tidecaller of the Spire",
    amount: 0,
  },
  // Zone 3 (migration 20261117090000_spire_zone3.sql).
  { season: 0, floor: 21, kind: "coins", item: "coins", amount: 55 },
  { season: 0, floor: 22, kind: "coins", item: "coins", amount: 55 },
  { season: 0, floor: 23, kind: "coins", item: "coins", amount: 60 },
  { season: 0, floor: 24, kind: "coins", item: "coins", amount: 60 },
  { season: 0, floor: 25, kind: "coins", item: "coins", amount: 130 },
  { season: 0, floor: 26, kind: "coins", item: "coins", amount: 65 },
  { season: 0, floor: 27, kind: "coins", item: "coins", amount: 65 },
  { season: 0, floor: 28, kind: "coins", item: "coins", amount: 70 },
  { season: 0, floor: 29, kind: "coins", item: "coins", amount: 70 },
  { season: 0, floor: 30, kind: "coins", item: "coins", amount: 250 },
  {
    season: 0,
    floor: 30,
    kind: "title",
    item: "Lanternbane of the Spire",
    amount: 0,
  },
  // Zone 4 (migration 20261117150000_spire_zone4.sql).
  { season: 0, floor: 31, kind: "coins", item: "coins", amount: 70 },
  { season: 0, floor: 32, kind: "coins", item: "coins", amount: 70 },
  { season: 0, floor: 33, kind: "coins", item: "coins", amount: 75 },
  { season: 0, floor: 34, kind: "coins", item: "coins", amount: 75 },
  { season: 0, floor: 35, kind: "coins", item: "coins", amount: 160 },
  { season: 0, floor: 36, kind: "coins", item: "coins", amount: 80 },
  { season: 0, floor: 37, kind: "coins", item: "coins", amount: 80 },
  { season: 0, floor: 38, kind: "coins", item: "coins", amount: 85 },
  { season: 0, floor: 39, kind: "coins", item: "coins", amount: 85 },
  { season: 0, floor: 40, kind: "coins", item: "coins", amount: 300 },
  {
    season: 0,
    floor: 40,
    kind: "title",
    item: "Dreambreaker of the Spire",
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
 * Where a party may climb. The Spire opens with a Cragmuff clear; each boss
 * floor needs every member to have cleared that boss's raid once (the
 * ceiling stops below the first boss floor someone hasn't unlocked), and
 * nothing is open above SPIRE_BUILT_TOP.
 *
 * One climb is one zone. With `zone` (a room made for that zone) the climb
 * starts at the zone's first floor, never past its boss, and every member
 * must have earned that checkpoint (a party climbs at its lowest
 * checkpoint: a zone above someone's is refused, never started lower in
 * the wrong zone's room). Without it, the lowest checkpoint among the party.
 */
export function spireStartFrom(
  members: readonly SpireMember[],
  zone?: number,
): {
  ok: boolean;
  startFloor: number;
  ceiling: number;
  reason?: string;
} {
  const from = zone === undefined ? 1 : spireZoneStart(zone);
  const top =
    zone === undefined
      ? SPIRE_BUILT_TOP
      : Math.min(SPIRE_BUILT_TOP, spireZoneTop(zone));
  if (zone !== undefined && !SPIRE_BUILT_ZONES.includes(zone))
    return {
      ok: false,
      startFloor: 1,
      ceiling: 0,
      reason: "That part of the Spire isn't open yet.",
    };
  if (!members.length) return { ok: true, startFloor: from, ceiling: top };
  if (members.some((m) => !(m.clears.grumblecrag ?? 0)))
    return {
      ok: false,
      startFloor: 1,
      ceiling: 0,
      reason: "Every climber must clear Cragmuff once to enter the Spire.",
    };
  let ceiling = top;
  for (const z of Object.values(SPIRE_ZONES).sort((a, b) => a.id - b.id)) {
    // A zone's room only climbs its own boss floor: the bosses of the
    // zones below it never close it (the checkpoint already says they fell).
    if (zone !== undefined && z.id < zone) continue;
    if (members.some((m) => !(m.clears[z.boss] ?? 0))) {
      ceiling = Math.min(ceiling, spireZoneTop(z.id) - 1);
      break;
    }
  }
  const lowest = Math.max(
    1,
    Math.min(
      ...members.map((m) => spireStartCheckpoint(Math.max(1, m.checkpoint))),
    ),
  );
  if (zone !== undefined) {
    if (lowest < from)
      return {
        ok: false,
        startFloor: 1,
        ceiling: 0,
        reason: `Every climber must reach floor ${from} first: conquer zone ${zone - 1}.`,
      };
    return { ok: true, startFloor: from, ceiling: Math.max(from, ceiling) };
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
/**
 * The zones a player may start a climb in (zone 1 always; a later zone
 * once its checkpoint is earned and it is built).
 */
export function spireZonesOpen(checkpoint: number) {
  const cp = spireStartCheckpoint(Math.max(1, checkpoint));
  return SPIRE_BUILT_ZONES.filter((z) => spireZoneStart(z) <= cp);
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
  /** The zone this climb (and room) is for: its first floor is the start. */
  zone: number;
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
