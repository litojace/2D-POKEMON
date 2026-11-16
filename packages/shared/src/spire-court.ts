/**
 * The Spire's court: the stone platform at the top of the tower that wave
 * and elite floors are fought on (the zone's boss floor keeps its raid's own
 * court). One definition for the server (collision, Echo spawns, where the
 * raiders stand) and the client (prediction and the painted pieces), so
 * every hitbox is exactly the stone you see.
 *
 * The court's bounds are the arena's (RULES.width × RULES.height); what
 * changes per floor is the cover on it: a preset layout chosen by the floor
 * (the same for every zone, so later zones only bring a new look), plus the
 * stairs to the next floor at the left edge, behind where the raiders stand.
 */
import type { Rect } from "./index.js";
import type { SpireFloorKind, SpireRole } from "./spire.js";

export type SpireCourtLayoutId =
  "gates" | "walls" | "crystals" | "pylons" | "captain";
export interface SpireCourtLayout {
  id: SpireCourtLayoutId;
  name: string;
  /** The cover: blocks that stop fighters and shots (solid footprints). */
  blocks: readonly Rect[];
}
/** The stairs up (solid: a flight of steps and the arch at its top). */
export const SPIRE_STAIRS: Rect = { x: 0, y: 372, w: 104, h: 156 };
/** The rune ring carved in the middle (kept clear of cover so the floor number shows). */
export const SPIRE_RING = { x: 800, y: 450, r: 168 };

const block = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
});
/**
 * The layouts. Fair by construction (tests/unit/spire-court.test.ts checks):
 * cover stays out of the raiders' corner at the stairs, out of the Echoes'
 * spawn bands on the far side and the top and bottom edges, and off the rune
 * ring; every spot on the court can still be walked to.
 */
export const SPIRE_COURT_LAYOUTS: Record<SpireCourtLayoutId, SpireCourtLayout> =
  {
    // Floor 1, 6: four standing stones around the ring, like gates.
    gates: {
      id: "gates",
      name: "Four Gates",
      blocks: [
        block(520, 392, 90, 116),
        block(990, 392, 90, 116),
        block(740, 132, 72, 100),
        block(740, 668, 72, 100),
      ],
    },
    // Floor 2, 7: two long walls either side of the ring.
    walls: {
      id: "walls",
      name: "Twin Walls",
      blocks: [block(486, 320, 72, 260), block(1040, 320, 72, 260)],
    },
    // Floor 3, 8: six small crystal outcrops in a ring.
    crystals: {
      id: "crystals",
      name: "Crystal Ring",
      blocks: [
        block(486, 196, 70, 96),
        block(486, 608, 70, 96),
        block(744, 140, 70, 96),
        block(744, 664, 70, 96),
        block(1060, 236, 70, 96),
        block(1060, 568, 70, 96),
      ],
    },
    // Floor 4 ("Pillar Hall"), 9: four tall pylons.
    pylons: {
      id: "pylons",
      name: "Pillar Hall",
      blocks: [
        block(500, 214, 84, 116),
        block(500, 570, 84, 116),
        block(1016, 228, 84, 116),
        block(1016, 570, 84, 116),
      ],
    },
    // The elite floor: open, so the captain's eruptions have room; two
    // outcrops near the raiders' side for a breather.
    captain: {
      id: "captain",
      name: "The Captain's Ring",
      blocks: [block(540, 168, 70, 96), block(540, 636, 70, 96)],
    },
  };
/** Wave floors cycle through these, by their place in the zone. */
export const SPIRE_WAVE_LAYOUTS: readonly SpireCourtLayoutId[] = [
  "gates",
  "walls",
  "crystals",
  "pylons",
];
/**
 * The court's layout for a floor, or undefined for a boss floor (fought on
 * its raid's own court). Deterministic: the floor's place in its zone picks
 * it, so floor 3 and floor 13 share a layout.
 */
export function spireCourtLayout(
  floor: number,
  kind: SpireFloorKind,
): SpireCourtLayout | undefined {
  if (kind === "boss") return undefined;
  if (kind === "elite") return SPIRE_COURT_LAYOUTS.captain;
  const inZone = (((Math.max(1, Math.floor(floor)) - 1) % 10) + 10) % 10;
  // The wave floors' order in the zone: 1–4, then 6–9 (5 is the elite).
  const index = inZone < 4 ? inZone : inZone - 1;
  return SPIRE_COURT_LAYOUTS[
    SPIRE_WAVE_LAYOUTS[index % SPIRE_WAVE_LAYOUTS.length]
  ];
}
const WALLS = new Map<SpireCourtLayoutId, readonly Rect[]>();
/**
 * What stops fighters and shots on a floor's court: its layout's blocks and
 * the stairs. The same array every time (bots cache their corners by it).
 * Undefined on a boss floor: its raid's own walls apply.
 */
export function spireCourtWalls(
  spire: { floor: number; kind: SpireFloorKind } | undefined,
): readonly Rect[] | undefined {
  if (!spire) return undefined;
  const layout = spireCourtLayout(spire.floor, spire.kind);
  if (!layout) return undefined;
  let list = WALLS.get(layout.id);
  if (!list) {
    list = Object.freeze([...layout.blocks, SPIRE_STAIRS]);
    WALLS.set(layout.id, list);
  }
  return list;
}
/** Where the raiders stand at the start of each floor (by seat), by the stairs. */
export function spireRaiderSpawn(seat: number) {
  return { x: 260 + (seat % 2) * 85, y: 330 + Math.floor(seat / 2) * 160 };
}
/**
 * One candidate spot for an Echo to appear (the server tries a few and
 * keeps the best clear one): the far side by role (front-liners nearer,
 * casters at the back, skirmishers at the top or bottom edge). `j(k)` is a
 * seeded number in [0, 1).
 */
export function spireEchoSpawnCandidate(
  role: SpireRole,
  elite: boolean,
  j: (k: number) => number,
) {
  const x = elite
    ? 1150 + j(1) * 150
    : role === "front"
      ? 1100 + j(1) * 220
      : role === "caster"
        ? 1330 + j(1) * 170
        : 850 + j(1) * 550;
  const y =
    role === "skirmisher" && !elite
      ? j(2) < 0.5
        ? 120 + j(3) * 60
        : 720 + j(3) * 60
      : 160 + j(2) * 580;
  return { x, y };
}
