import { somnaraPattern, type DreamRune } from "./raid-somnara.js";
export * from "./raid-somnara.js";
import type { RaidBossId } from "./raid-roster.js";
import type { CharacterId } from "./index.js";
export * from "./raid-roster.js";
export const RAID = {
  name: "Grumblecrag",
  maxPeril: 3,
  timeLimit: 480,
  riteChoiceSeconds: 15,
  reviveSeconds: 3,
  reviveRange: 100,
  selfReviveDelay: 6,
  staggerSeconds: 6,
  /** Solo raiders get one self-revive up to this Peril; Peril 3 solo has none. */
  soloSelfReviveMaxPeril: 2,
  phases: ["Wake the mountain", "Break the armor", "Heart of the mountain"],
} as const;
export const RAID_CHAPTERS = [
  {
    name: "Wake the mountain",
    objective: "Bait charges into pillars. Jump the slam.",
    detail:
      "Learn the warning shapes: lead a charge into a pillar to expose the core, and hide behind a pillar from the rock volley.",
  },
  {
    name: "Break the armor",
    objective: "Break pillars. Stack up for shared hits.",
    detail:
      "A second slam follows the first, eruptions chase one raider, and a falling meteor marks another: gather on them to split the damage.",
  },
  {
    name: "Heart of the mountain",
    objective: "Strike the open core. Survive the combinations.",
    detail:
      "The core stays exposed, but attacks come faster and chain together: double slams into debris, volleys into eruptions.",
  },
] as const;
export interface RaidContribution {
  damage: number;
  revives: number;
  pillars: number;
  downs?: number;
}
/** Every boss attack, with the advice shown when it downs someone. */
export type RaidAttack =
  | "charge"
  | "slam"
  | "debris"
  | "volley"
  | "eruption"
  | "share"
  // Tidewyrm
  | "dive"
  | "wave"
  | "bubbles"
  | "hightide"
  | "undertow"
  | "prison"
  // Gloomshade
  | "lunge"
  | "hands"
  | "snuff"
  | "curse"
  | "split"
  | "pulse"
  // Somnara
  | "lullaby" | "tail-splash" | "dream-bubbles" | "falling-stars" | "whale-song" | "dream-sequence" | "nightmare";
export const RAID_ATTACKS: Record<
  RaidAttack,
  { name: string; tip: string; practice: string }
> = {
  charge: {
    name: "Mountain Charge",
    tip: "When you're targeted, stand so a pillar is between you and the boss, then step aside as the lane locks.",
    practice: "A lane locks onto you, then the boss rushes down it.",
  },
  slam: {
    name: "Ground Slam",
    tip: "Jump just as the ring fills, or walk out of the circle. From phase 2 a second slam follows.",
    practice: "A ring fills around the boss. Jump or leave it.",
  },
  debris: {
    name: "Falling Debris",
    tip: "Keep moving: debris lands where you were standing.",
    practice: "Rocks fall on everyone's position. Keep moving.",
  },
  volley: {
    name: "Rock Volley",
    tip: "Get out of the cone or put a pillar between you and the boss. Auralynx's Mirror Guard blocks it.",
    practice: "A cone of stones. Leave it or hide behind a pillar.",
  },
  eruption: {
    name: "Chasing Eruption",
    tip: "The eruptions follow one raider: keep running in one direction and don't drag them through your team.",
    practice: "Eruptions chase you three times. Keep running.",
  },
  share: {
    name: "Shared Meteor",
    tip: "Gather on the marked raider so the meteor's damage is split. Alone, step out of the circle once it locks.",
    practice: "A meteor marks you. Alone, leave the circle after it locks.",
  },
  dive: {
    name: "Dive & Surface",
    tip: "When the ripple follows you, lead it onto an island, then step off before it locks. It surfaces stranded on dry land.",
    practice: "A ripple follows you, then locks. Lead it onto an island and step off.",
  },
  wave: {
    name: "Tidal Wave",
    tip: "A low wave (chapter 1) can be jumped. A high wave can't: be standing on an island when it passes.",
    practice: "A wave sweeps the arena. Jump a low one; stand on an island for a high one.",
  },
  bubbles: {
    name: "Bubble Barrage",
    tip: "Step between the slow bubbles or pop them with your attacks. A hit roots you for a moment.",
    practice: "A fan of slow bubbles. Weave through or pop them.",
  },
  hightide: {
    name: "High Tide",
    tip: "Get onto an island before the water rises. Two fit on an island; a third gets pushed off.",
    practice: "The floor floods for a few seconds. Stand on an island.",
  },
  undertow: {
    name: "Undertow",
    tip: "Dash away from the whirlpool and keep walking outward. Touching its centre hurts.",
    practice: "A whirlpool pulls everyone to the centre. Walk and dash outward.",
  },
  prison: {
    name: "Bubble Prison",
    tip: "Teammates pop the bubble with three hits. Alone, mash your attack to break out before it reaches the boss's mouth.",
    practice: "A bubble seals you and drifts to the boss. Mash attack (or have friends pop it).",
  },
  lunge: {
    name: "Shadow Lunge",
    tip: "A dark line reaches you from the nearest shadow, not from the boss. Sidestep off the line.",
    practice: "A dark line from a shadow to you. Sidestep it.",
  },
  hands: {
    name: "Grasping Hands",
    tip: "Half the floor's tiles darken: stand on a lit tile. From Peril 2 the pattern flips once, so watch it.",
    practice: "Tiles darken in a checkerboard. Stand on a lit one.",
  },
  snuff: {
    name: "Lantern Snuff",
    tip: "A lantern dims and goes out. Hit it twice to relight it: lantern light is where the real Gloomshade casts a shadow.",
    practice: "A lantern goes out. Hit it twice to relight it.",
  },
  curse: {
    name: "Creeping Curse",
    tip: "Spread out: the curse spreads to anyone near a cursed raider. Three stacks haunts you. Stand in lantern light to cleanse it.",
    practice: "A curse marks you. Stand in lantern light to cleanse it.",
  },
  split: {
    name: "Mirror Split",
    tip: "Only the real Gloomshade casts a shadow in lantern light, and its moon tail flickers. Hitting a copy curses you.",
    practice: "It splits into copies. Find the one with a shadow in the light.",
  },
  pulse: {
    name: "Nightmare Pulse",
    tip: "Every copy sends a ring, but only the real one's hurts: jump it. The pulse also shows you which one is real.",
    practice: "Rings from every copy. Jump the real one's.",
  },
  lullaby: { name: "Lullaby Rings", tip: "Jump the expanding rings or keep out of their path. Three Drowsy stacks put you to sleep; a teammate can hit you awake without hurting you.", practice: "Jump the three soft rings. Each hit adds Drowsy." },
  "tail-splash": { name: "Tail Splash", tip: "Leave the marked rectangle before Somnara's tail splashes down.", practice: "A wide rectangle marks the tail's reach. Step outside it." },
  "dream-bubbles": { name: "Dream Bubbles", tip: "Pop the drifting bubbles with an attack or outrun them. Touching one adds Drowsy.", practice: "Slow bubbles follow you. Pop them or keep moving." },
  "falling-stars": { name: "Falling Stars", tip: "Remember the constellation and stand between the marked stars before they land.", practice: "A constellation flashes; stars land on each marked point." },
  "whale-song": { name: "Whale Song", tip: "Stay inside the moving teal Quiet Zone until the song ends. Everyone fits; it shrinks on higher Perils.", practice: "Follow the moving Quiet Zone for four seconds." },
  "dream-sequence": { name: "Dream Sequence", tip: "The Dreamer sees the runes privately. Call them with 1–4 or the rune buttons, then enter the matching pads in order. Leave a pad before entering it again. A backwards arrow means read right to left.", practice: "Read your private sequence and step on the pads in order. Solo gives you 14 seconds." },
  nightmare: { name: "Nightmare", tip: "A wrong rune or expired sequence bursts across the team. A fresh Dreamer gets a new sequence; listen for their calls.", practice: "Get the rune sequence right before its timer expires." },
};
/** Each boss's attacks, in the order the Hub and the practice room list them. */
export const RAID_BOSS_ATTACKS: Partial<Record<RaidBossId, RaidAttack[]>> = {
  grumblecrag: ["charge", "slam", "volley", "debris", "eruption", "share"],
  tidewyrm: ["dive", "wave", "bubbles", "hightide", "undertow", "prison"],
  gloomshade: ["lunge", "hands", "snuff", "curse", "split", "pulse"],
  somnara: ["lullaby", "tail-splash", "dream-bubbles", "falling-stars", "whale-song", "dream-sequence"],
};
export const raidAttacksOf = (boss: RaidBossId) => RAID_BOSS_ATTACKS[boss] ?? [];
/**
 * Grumblecrag's numbers in one place, so tuning (or a second boss) is a
 * matter of data. Damage is before the Peril multiplier.
 */
export const GRUMBLECRAG = {
  id: "grumblecrag",
  name: "Grumblecrag",
  health: { base: 1450, perExtraPlayer: 900, gilded: 1.12 },
  /** Boss damage at Peril 1, 2 and 3 (index = Peril). */
  perilDamage: [1, 1, 1.1, 1.2],
  /** Seconds between attacks, and the final phase's faster rhythm. */
  cadence: { normal: 5.2, restless: 4.4, finalPhase: 0.85 },
  charge: { damage: 28, width: 80, delay: 1.7, lock: 1, speed: 650 },
  slam: { damage: 27, radius: 240, finalRadius: 320, delay: 1.25 },
  debris: { damage: 20, radius: 95, delay: 1.65 },
  volley: { damage: 18, range: 560, spread: 0.9, delay: 1.4 },
  eruption: { damage: 22, radius: 100, delay: 1.25, gap: 0.75 },
  share: {
    damage: 66,
    soloDamage: 34,
    radius: 125,
    delay: 3.2,
    soloLock: 1.1,
    /** Ward (or any shield) inside the stack cuts everyone's share. */
    wardReduction: 0.35,
  },
} as const;
/**
 * Tidewyrm's numbers (docs/raid-roster-design.md §5.1). Damage is before the
 * Peril multiplier.
 */
export const TIDEWYRM = {
  id: "tidewyrm",
  name: "Tidewyrm",
  health: { base: 1350, perExtraPlayer: 850, gilded: 1.12 },
  perilDamage: [1, 1, 1.1, 1.2],
  cadence: { normal: 5, restless: 4.4, finalPhase: 0.85 },
  /** The Lagoon Court: four raised islands you can stand on. */
  islands: [
    { x: 470, y: 255 },
    { x: 1130, y: 255 },
    { x: 470, y: 645 },
    { x: 1130, y: 645 },
  ],
  islandRadius: 78,
  /** Spring Tide trait: bigger islands. */
  springIslandRadius: 92,
  /** How many raiders fit on an island during High Tide. */
  islandCapacity: 2,
  /** Where Tidewyrm rests between dives, and the whirlpool's centre. */
  home: { x: 800, y: 450 },
  dive: {
    follow: 1.4,
    lock: 0.8,
    damage: 26,
    radius: 110,
    /** Seconds stranded (exposed) on an island; longer on Peril 1. */
    strand: 5,
    strandPeril1: 7,
    strandStagger: 35,
    /** Strands an island survives before it sinks for the chapter. */
    cracks: 2,
  },
  wave: { delay: 1.4, speed: 520, ripSpeed: 400, width: 70, damage: 22 },
  bubbles: { delay: 0.9, speed: 150, radius: 20, damage: 10, root: 0.8, life: 5, spread: 0.9 },
  highTide: { delay: 2, seconds: 5, springSeconds: 7, dps: 7 },
  undertow: { delay: 1.2, seconds: 3, pull: 120, ripPull: 160, centreRadius: 75, damage: 24 },
  prison: { delay: 1, seconds: 6, hits: 3, presses: 8, radius: 34 },
  /** Peril 3, last chapter: an island sinks for good this often (min 2 left). */
  sinkEvery: 45,
  soloSinkEvery: 35,
  minIslands: 2,
  /** Voltkit's Static Lance on a stranded Tidewyrm (water conducts). */
  lanceStagger: 15,
} as const;
/**
 * Gloomshade's numbers (docs/raid-roster-design.md §5.2). Damage is before
 * the Peril multiplier.
 */
export const GLOOMSHADE = {
  id: "gloomshade",
  name: "Gloomshade",
  // Finding the real one costs a solo raider more time than a party, so
  // more of its health comes with each extra raider than for the others.
  health: { base: 1050, perExtraPlayer: 1000, gilded: 1.12 },
  perilDamage: [1, 1, 1.1, 1.2],
  cadence: { normal: 4.8, restless: 4.4, finalPhase: 0.85 },
  /** The Lantern Yard's four lanterns and how far their light reaches. */
  lanterns: [
    { x: 330, y: 210 },
    { x: 1270, y: 210 },
    { x: 330, y: 690 },
    { x: 1270, y: 690 },
  ],
  lightRadius: 150,
  /** Moonlit trait: a brighter yard (wider lantern light). */
  moonlitLightRadius: 185,
  /** Hits to relight an unlit lantern (1 with the Lamplighter rite). */
  relightHits: 2,
  home: { x: 800, y: 430 },
  /** Where Gloomshade and its copies drift between. */
  spots: [
    { x: 800, y: 430 },
    { x: 560, y: 300 },
    { x: 1040, y: 300 },
    { x: 560, y: 600 },
    { x: 1040, y: 600 },
    { x: 800, y: 210 },
    { x: 800, y: 690 },
  ],
  driftSpeed: 150,
  driftEvery: 3.5,
  lunge: { delay: 1.2, width: 34, length: 760, damage: 25 },
  /** Grasping Hands: the floor as a checkerboard of tiles. */
  hands: { cols: 8, rows: 5, delay: 1.6, shiftAt: 0.7, damage: 20 },
  snuff: { delay: 1.5, finalDelay: 0.75 },
  curse: { radius: 120, spreadSeconds: 2, restlessSpread: 3, haunted: 3, hauntSeconds: 6, dps: 5, cleanseSeconds: 2, soloStill: 2.5 },
  split: { delay: 1.2, copies: 3, peril3Copies: 4 },
  pulse: { delay: 1.4, radius: 260, damage: 24, pairGap: 1.2 },
  /** Hits on the real one in a row that expose it. */
  exposeHits: 6,
  exposeSeconds: 5,
  /** Voltkit's Ball Lightning lights its landing spot this long. */
  sparkLight: 3,
  /** Mystowl's Focus Ray and Duskveil's Curse Mark reveal the real one. */
  revealRay: 4,
  revealMark: 6,
} as const;
/** How far lantern light reaches this run (wider on Moonlit). */
export const lanternRadius = (trait: string) =>
  trait === "moonlit" ? GLOOMSHADE.moonlitLightRadius : GLOOMSHADE.lightRadius;
/** Grasping Hands: is the tile at (x, y) dark for this parity? */
export function handsTileDark(x: number, y: number, parity: number) {
  const { cols, rows } = GLOOMSHADE.hands;
  const col = Math.max(0, Math.min(cols - 1, Math.floor((x / 1600) * cols)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor((y / 900) * rows)));
  return (col + row) % 2 === parity;
}
/** Gloomshade's attack order for a chapter. */
export function gloomshadePattern(phase: number, peril: number, restless = false): RaidAttack[] {
  const hands: RaidAttack[] = restless ? ["hands"] : [];
  if (phase === 1)
    return [
      "lunge",
      "hands",
      "snuff",
      "lunge",
      ...(peril >= 3 ? (["pulse"] as RaidAttack[]) : []),
      "hands",
      ...hands,
    ];
  if (phase === 2) return ["split", "lunge", "curse", "hands", "snuff", "pulse", "lunge", ...hands];
  // Witching Hour: pulses come in pairs (the server adds the second).
  return ["pulse", "lunge", "curse", "snuff", "hands", "pulse", "lunge", ...hands];
}
/** Tidewyrm's attack order for a chapter. */
export function tidewyrmPattern(phase: number, peril: number): RaidAttack[] {
  if (phase === 1)
    return peril >= 3
      ? ["dive", "bubbles", "wave", "dive", "wave", "bubbles"]
      : ["dive", "bubbles", "wave", "dive", "bubbles"];
  if (phase === 2)
    return ["dive", "hightide", "bubbles", "prison", "dive", "undertow", "wave"];
  // Storm Surge: High Tide leads straight into a dive, Undertow into a wave.
  return ["hightide", "dive", "undertow", "prison", "bubbles", "dive"];
}
/** The attack order for a phase. Higher Perils add tougher combinations. */
export function raidPattern(
  phase: number,
  peril: number,
  partySize: number,
  boss: RaidBossId = "grumblecrag",
): RaidAttack[] {
  if (boss === "tidewyrm") return tidewyrmPattern(phase, peril);
  if (boss === "gloomshade") return gloomshadePattern(phase, peril);
  if (boss === "somnara") return somnaraPattern(phase);
  // A meteor needs friends to share it; alone it becomes a dodge.
  const meteor: RaidAttack = "share";
  if (phase === 1)
    return peril >= 3
      ? ["charge", "slam", "volley", "charge", "eruption", "debris"]
      : ["charge", "slam", "volley", "charge", "debris"];
  if (phase === 2)
    return partySize > 1 || peril >= 2
      ? ["charge", "slam", "eruption", "charge", meteor, "debris"]
      : ["charge", "slam", "eruption", "charge", "volley", "debris"];
  return ["charge", "slam", "volley", meteor, "charge", "eruption"];
}
/** How many eruptions chase their target. */
export const eruptionChain = (phase: number, peril: number) =>
  phase === 1 ? 2 : phase === 2 && peril < 2 ? 2 : 3;
/** Quick signals for teams without voice chat. */
export type RaidPingKind = "stack" | "revive" | "bait";
export const RAID_PINGS: Record<RaidPingKind, { label: string; key: string }> =
  {
    stack: { label: "Stack on me", key: "Z" },
    revive: { label: "Revive me", key: "X" },
    bait: { label: "Bait here", key: "C" },
  };
export const RAID_PING_SECONDS = 3.5;
/** The third signal means something different on each boss. */
export function raidPingLabel(kind: RaidPingKind, boss: RaidBossId = "grumblecrag") {
  if (kind === "bait" && boss === "tidewyrm") return "Island here";
  if (kind === "bait" && boss === "somnara") return "Rune here";
  if (kind === "bait" && boss === "gloomshade") return "That's the real one";
  return RAID_PINGS[kind].label;
}
/** What some champions' skills do against Grumblecrag (see RAID_BOSS_PERKS). */
export const RAID_PERKS: Partial<
  Record<
    "auralynx" | "mystowl" | "terradon" | "lumoth",
    { skill: string; text: string }
  >
> = {
  auralynx: {
    skill: "Mirror Guard",
    text: "Blocks Rock Volley completely and staggers the boss.",
  },
  mystowl: {
    skill: "Ward",
    text: "Up inside a Shared Meteor, it cuts the damage for everyone by 35%.",
  },
  terradon: {
    skill: "Stone shell",
    text: "Stops a charge head-on, taking half damage and staggering the boss.",
  },
  lumoth: {
    skill: "Kindle",
    text: "Cast beside a fallen ally to fill half of their revive at once.",
  },
};
/** Champion tricks per boss (docs/raid-roster-design.md §6). */
export const RAID_BOSS_PERKS: Partial<
  Record<RaidBossId, Partial<Record<CharacterId, { skill: string; text: string }>>>
> = {
  grumblecrag: RAID_PERKS,
  tidewyrm: {
    voltkit: {
      skill: "Static Lance",
      text: "Hits on a stranded Tidewyrm add extra stagger (water conducts).",
    },
    cindrake: {
      skill: "Magma Bomb",
      text: "Pops a Bubble Prison in one hit.",
    },
    tidefin: {
      skill: "Mirror Mist",
      text: "While your clone is out, the dive ripple follows the clone instead of you.",
    },
    terradon: {
      skill: "Tremor",
      text: "Pops every bubble nearby and frees a raider from a Bubble Prison.",
    },
  },
  gloomshade: {
    voltkit: {
      skill: "Ball Lightning",
      text: "Lights up where it bursts for 3 seconds, showing true shadows.",
    },
    lumoth: {
      skill: "Radiant Flare",
      text: "Relights lanterns nearby and cleanses curses from allies around you.",
    },
    mystowl: {
      skill: "Focus Ray",
      text: "Passes through copies: aimed at the real Gloomshade, it marks it for everyone.",
    },
    duskveil: {
      skill: "Curse Mark",
      text: "Aimed at the real Gloomshade, it reveals it to the team for 6 seconds.",
    },
  },
  somnara: {
    cindrake: { skill: "Ember Gust", text: "Wakes every sleeping ally caught in the cone, without hurting them." },
    tidefin: { skill: "Mirror Mist", text: "Your clone can enter a rune pad and count as a step." },
    mystowl: { skill: "Thoughtstrike", text: "Reveals the current dream sequence to the whole team." },
    duskveil: { skill: "Shade Crawl", text: "Leaves a shadow trail that pops Dream Bubbles." },
  },
};
export const raidPerksOf = (boss: RaidBossId) => RAID_BOSS_PERKS[boss] ?? {};
/** Chapter names and goals per boss. */
export const RAID_BOSS_CHAPTERS: Partial<
  Record<RaidBossId, readonly { name: string; objective: string; detail: string }[]>
> = {
  grumblecrag: RAID_CHAPTERS,
  tidewyrm: [
    {
      name: "Low Tide",
      objective: "Lead the dive onto an island. Jump the low wave.",
      detail:
        "When a ripple follows you, walk it onto an island and step off: Tidewyrm surfaces stranded on dry land, open to attack. Jump the low waves and weave through bubbles.",
    },
    {
      name: "Turning Tide",
      objective: "Share the islands. Pop trapped friends out.",
      detail:
        "High Tide floods the floor (two raiders fit on an island), the Undertow pulls everyone in, and a Bubble Prison carries one raider to the boss's mouth: pop it with three hits. Waves are high now: stand on an island.",
    },
    {
      name: "Storm Surge",
      objective: "Keep stranding it. Survive the combinations.",
      detail:
        "The rhythm quickens: High Tide leads straight into a dive, and the Undertow into a wave. On Peril 3 an island sinks for good every 45 seconds.",
    },
  ],
  gloomshade: [
    {
      name: "Dusk",
      objective: "Keep the lanterns lit. Stand on lit tiles.",
      detail:
        "Shadow Lunges come from the nearest shadow, not from Gloomshade. Grasping Hands darken half the floor: stand on a lit tile. When a lantern goes out, hit it twice to relight it. Keep hitting Gloomshade to fill its stagger bar and expose its core.",
    },
    {
      name: "Midnight",
      objective: "Find the real one. Spread out from curses.",
      detail:
        "It splits into copies: only the real Gloomshade casts a shadow in lantern light, and its moon tail flickers. Hitting a copy curses you; six hits on the real one in a row exposes it. Creeping Curse spreads between raiders who stand close: lantern light cleanses it.",
    },
    {
      name: "Witching Hour",
      objective: "Relight fast. Jump the real pulse.",
      detail:
        "Lanterns go out twice as fast, the copies come back after every exposure, and Nightmare Pulses come in pairs.",
    },
  ],
  somnara: [
    { name: "Dozing", objective: "Read the dream. Step the runes in order.", detail: "Only the Dreamer sees the sequence. Call Circle, Star, Moon and Wave with 1–4 or the rune buttons, then enter the pads in order to expose Somnara for 6 seconds. Jump Lullaby Rings and pop Dream Bubbles. Three Drowsy stacks put you to sleep; allies can tap you awake." },
    { name: "Deep Sleep", objective: "Remember the stars. Follow the Quiet Zone.", detail: "Sequences get longer. Falling Stars land at the constellation points, and Whale Song hurts everyone outside its moving teal Quiet Zone. Solo sequences are shorter and give you 14 seconds." },
    { name: "Waking Dream", objective: "Call clearly. Solve the dream through the attacks.", detail: "Attacks continue while the sequence is active. On Peril 3 some dreams are displayed backwards: the arrow means read right to left. Spread out for stars, then gather in the Quiet Zone." },
  ],
};
export const raidChapters = (boss: RaidBossId) =>
  RAID_BOSS_CHAPTERS[boss] ?? RAID_CHAPTERS;
/** Separate appearance slots; each is cosmetic only. */
export type RaidSlot = "skin" | "aura" | "entrance" | "frame" | "victory";
export const RAID_SLOTS: RaidSlot[] = [
  "skin",
  "aura",
  "entrance",
  "frame",
  "victory",
];
export type RaidCosmetic =
  | "cragbound"
  | "cragstone"
  | "mountain-aura"
  | "mountainborn"
  | "conqueror"
  | "rockslide-flex"
  | "seafoam"
  | "pearlscale"
  | "riptide"
  | "reef"
  | "tidal-aura"
  | "splashdown"
  | "dusk-colors"
  | "moonlit-skin"
  | "shadowstep"
  | "crescent"
  | "nightmote"
  | "crescent-bow"
  | "twilight-colors" | "starlit-skin" | "dreamdrift" | "moonglass" | "lullaby-aura" | "sweet-dreams";
/** A raid reward or a Shop collection piece (see shop.ts LOOK_ITEMS). */
export type AppearanceItem = RaidCosmetic | (string & {});
export type RaidLoadout = Partial<Record<RaidSlot, AppearanceItem | null>>;
/**
 * How a reward is earned. The same rules are seeded into the database
 * (migration 009, `arena_raid_rewards`), which is what actually grants them;
 * a unit test keeps the two lists identical.
 */
export type RaidRule =
  | { kind: "clears"; n: number }
  | { kind: "peril"; n: number }
  | { kind: "flawless"; peril: number }
  | { kind: "solo"; peril: number }
  | { kind: "speed"; peril: number; party: number; seconds: number }
  | { kind: "gilded" }
  | { kind: "feat" }
  | { kind: "stat"; stat: "pillars" | "revives"; n: number }
  | { kind: "total-clears"; n: number };
export interface RaidReward {
  id: string;
  /** null = earned across every boss. */
  boss: RaidBossId | null;
  slot: RaidSlot | "title";
  name: string;
  description: string;
  goal: string;
  rule: RaidRule;
}
export const RAID_REWARDS: RaidReward[] = [
  { id: "cragbreaker", boss: "grumblecrag", slot: "title", name: "Cragbreaker", description: "Title", goal: "First clear", rule: { kind: "clears", n: 1 } },
  { id: "cragbound", boss: "grumblecrag", slot: "skin", name: "Cragbound colors", description: "Earthy gold colors", goal: "5 clears", rule: { kind: "clears", n: 5 } },
  { id: "cragstone", boss: "grumblecrag", slot: "skin", name: "Cragstone skin", description: "Stone markings with glowing amber cracks", goal: "10 clears", rule: { kind: "clears", n: 10 } },
  { id: "mountainborn", boss: "grumblecrag", slot: "entrance", name: "Mountainborn entrance", description: "Arrive in a burst of pebbles each round", goal: "Clear Peril 2", rule: { kind: "peril", n: 2 } },
  { id: "mountain-conqueror", boss: "grumblecrag", slot: "title", name: "Mountain Conqueror", description: "Title", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "conqueror", boss: "grumblecrag", slot: "frame", name: "Conqueror frame", description: "A carved stone portrait frame with a glowing core", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "mountain-aura", boss: "grumblecrag", slot: "aura", name: "Mountain aura", description: "A golden ring beneath your fighter", goal: "Clear Peril 3 with no downs", rule: { kind: "flawless", peril: 3 } },
  { id: "rockslide-flex", boss: "grumblecrag", slot: "victory", name: "Rockslide Flex", description: "Leap onto a rising pile of rocks and flex as pebbles bounce away", goal: "Feat: every charge in a run hits a pillar (3+ charges)", rule: { kind: "feat" } },
  { id: "avalanche", boss: "grumblecrag", slot: "title", name: "Avalanche", description: "Title", goal: "Clear Peril 2 solo in under 3:30", rule: { kind: "speed", peril: 2, party: 1, seconds: 210 } },
  { id: "lone-mountain", boss: "grumblecrag", slot: "title", name: "Lone Mountain", description: "Title", goal: "Clear Peril 3 solo (no self-revive)", rule: { kind: "solo", peril: 3 } },
  { id: "gilded-cragbreaker", boss: "grumblecrag", slot: "title", name: "Gilded Cragbreaker", description: "Title", goal: "Defeat a rare Gilded Grumblecrag", rule: { kind: "gilded" } },
  { id: "pillar-breaker", boss: "grumblecrag", slot: "title", name: "Pillar Breaker", description: "Title", goal: "Bait 25 charges into pillars (wins and losses)", rule: { kind: "stat", stat: "pillars", n: 25 } },
  { id: "mountain-guardian", boss: "grumblecrag", slot: "title", name: "Mountain Guardian", description: "Title", goal: "Help revive teammates 20 times (wins and losses)", rule: { kind: "stat", stat: "revives", n: 20 } },
  { id: "tidebreaker", boss: "tidewyrm", slot: "title", name: "Tidebreaker", description: "Title", goal: "First clear", rule: { kind: "clears", n: 1 } },
  { id: "seafoam", boss: "tidewyrm", slot: "skin", name: "Seafoam colors", description: "Sea-glass teal and foam white", goal: "5 clears", rule: { kind: "clears", n: 5 } },
  { id: "pearlscale", boss: "tidewyrm", slot: "skin", name: "Pearlscale skin", description: "Shimmering scales with pearl freckles", goal: "10 clears", rule: { kind: "clears", n: 10 } },
  { id: "riptide", boss: "tidewyrm", slot: "entrance", name: "Riptide entrance", description: "Burst up out of a splash each round", goal: "Clear Peril 2", rule: { kind: "peril", n: 2 } },
  { id: "leviathans-bane", boss: "tidewyrm", slot: "title", name: "Leviathan's Bane", description: "Title", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "reef", boss: "tidewyrm", slot: "frame", name: "Reef frame", description: "A coral portrait frame with a pearl", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "tidal-aura", boss: "tidewyrm", slot: "aura", name: "Tidal aura", description: "A rolling ring of water beneath your fighter", goal: "Clear Peril 3 with no downs", rule: { kind: "flawless", peril: 3 } },
  { id: "splashdown", boss: "tidewyrm", slot: "victory", name: "Splashdown", description: "A wave rises and crashes in a burst of spray behind you", goal: "Feat: strand Tidewyrm 4 times in one run", rule: { kind: "feat" } },
  { id: "flash-flood", boss: "tidewyrm", slot: "title", name: "Flash Flood", description: "Title", goal: "Clear Peril 2 solo in under 4:00", rule: { kind: "speed", peril: 2, party: 1, seconds: 240 } },
  { id: "lone-current", boss: "tidewyrm", slot: "title", name: "Lone Current", description: "Title", goal: "Clear Peril 3 solo (no self-revive)", rule: { kind: "solo", peril: 3 } },
  { id: "shipwright", boss: "tidewyrm", slot: "title", name: "Shipwright", description: "Title", goal: "Strand Tidewyrm 30 times (wins and losses)", rule: { kind: "stat", stat: "pillars", n: 30 } },
  { id: "lightbringer", boss: "gloomshade", slot: "title", name: "Lightbringer", description: "Title", goal: "First clear", rule: { kind: "clears", n: 1 } },
  { id: "dusk-colors", boss: "gloomshade", slot: "skin", name: "Dusk colors", description: "Twilight violet and lantern gold", goal: "5 clears", rule: { kind: "clears", n: 5 } },
  { id: "moonlit-skin", boss: "gloomshade", slot: "skin", name: "Moonlit skin", description: "A silver moon-glow with drifting stars", goal: "10 clears", rule: { kind: "clears", n: 10 } },
  { id: "shadowstep", boss: "gloomshade", slot: "entrance", name: "Shadowstep entrance", description: "Rise out of a pool of shadow each round", goal: "Clear Peril 2", rule: { kind: "peril", n: 2 } },
  { id: "nights-end", boss: "gloomshade", slot: "title", name: "Night's End", description: "Title", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "crescent", boss: "gloomshade", slot: "frame", name: "Crescent frame", description: "A night-blue portrait frame with a golden moon", goal: "Clear Peril 3", rule: { kind: "peril", n: 3 } },
  { id: "nightmote", boss: "gloomshade", slot: "aura", name: "Nightmote aura", description: "Fireflies of lantern light circle beneath you", goal: "Clear Peril 3 with no downs", rule: { kind: "flawless", peril: 3 } },
  { id: "crescent-bow", boss: "gloomshade", slot: "victory", name: "Crescent Bow", description: "A crescent moon rises behind you as you take a bow", goal: "Feat: nobody hits a copy all run", rule: { kind: "feat" } },
  { id: "moonrunner", boss: "gloomshade", slot: "title", name: "Moonrunner", description: "Title", goal: "Clear Peril 2 solo in under 4:00", rule: { kind: "speed", peril: 2, party: 1, seconds: 240 } },
  { id: "lone-lantern", boss: "gloomshade", slot: "title", name: "Lone Lantern", description: "Title", goal: "Clear Peril 3 solo (no self-revive)", rule: { kind: "solo", peril: 3 } },
  { id: "lamplighter-title", boss: "gloomshade", slot: "title", name: "Lamplighter", description: "Title", goal: "Relight 50 lanterns (wins and losses)", rule: { kind: "stat", stat: "pillars", n: 50 } },
  { id: "boss-hunter", boss: null, slot: "title", name: "Boss Hunter", description: "Title", goal: "100 raid clears across every boss", rule: { kind: "total-clears", n: 100 } },
  {"id": "dreamwaker", "boss": "somnara", "slot": "title", "name": "Dreamwaker", "description": "Title", "goal": "First clear", "rule": {"kind": "clears", "n": 1}},
  {"id": "twilight-colors", "boss": "somnara", "slot": "skin", "name": "Twilight colors", "description": "Lavender dusk with soft rose highlights", "goal": "5 clears", "rule": {"kind": "clears", "n": 5}},
  {"id": "starlit-skin", "boss": "somnara", "slot": "skin", "name": "Starlit skin", "description": "Midnight lavender with twinkling star flecks", "goal": "10 clears", "rule": {"kind": "clears", "n": 10}},
  {"id": "dreamdrift", "boss": "somnara", "slot": "entrance", "name": "Dreamdrift entrance", "description": "Arrive on a cloud of shimmering dream bubbles", "goal": "Clear Peril 2", "rule": {"kind": "peril", "n": 2}},
  {"id": "lucid-legend", "boss": "somnara", "slot": "title", "name": "Lucid Legend", "description": "Title", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "moonglass", "boss": "somnara", "slot": "frame", "name": "Moonglass frame", "description": "A glassy lavender frame with a silver crescent", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "lullaby-aura", "boss": "somnara", "slot": "aura", "name": "Lullaby aura", "description": "Floating musical notes circle beneath your fighter", "goal": "Clear Peril 3 with no downs", "rule": {"kind": "flawless", "peril": 3}},
  {"id": "sweet-dreams", "boss": "somnara", "slot": "victory", "name": "Sweet Dreams", "description": "A little dream whale swims through a starry cloud behind you", "goal": "Feat: solve a dream and finish with no wrong runes or timeouts", "rule": {"kind": "feat"}},
  {"id": "daydream-dash", "boss": "somnara", "slot": "title", "name": "Daydream Dash", "description": "Title", "goal": "Clear Peril 2 solo in under 4:00", "rule": {"kind": "speed", "peril": 2, "party": 1, "seconds": 240}},
  {"id": "lone-dreamer", "boss": "somnara", "slot": "title", "name": "Lone Dreamer", "description": "Title", "goal": "Clear Peril 3 solo (no self-revive)", "rule": {"kind": "solo", "peril": 3}},
  {"id": "dream-weaver", "boss": "somnara", "slot": "title", "name": "Dream Weaver", "description": "Title", "goal": "Step 60 correct runes (wins and losses)", "rule": {"kind": "stat", "stat": "pillars", "n": 60}},
];
export const RAID_COSMETICS = Object.fromEntries(
  RAID_REWARDS.filter((r) => r.slot !== "title").map((r) => [
    r.id,
    {
      slot: r.slot as RaidSlot,
      name: r.name,
      description: r.description,
      goal: r.goal,
      boss: r.boss,
    },
  ]),
) as Record<
  RaidCosmetic,
  {
    slot: RaidSlot;
    name: string;
    description: string;
    goal: string;
    boss: RaidBossId | null;
  }
>;
export const RAID_TRAITS = {
  "deep-slumber": { name: "Deep Slumber", text: "One more rune in each sequence, but exposure lasts 2 seconds longer." },
  "restless-dream": { name: "Restless Dream", text: "More Dream Bubbles, but one fewer rune per sequence." },
  "starry-night": { name: "Starry Night", text: "More Falling Stars, but a larger Quiet Zone." },
  restless: {
    name: "Restless",
    text: "Faster attacks, but the exposed core takes extra damage.",
  },
  fractured: {
    name: "Fractured",
    text: "More falling debris; pillars break armor for longer.",
  },
  ancient: { name: "Ancient", text: "Slower charges and wider shockwaves." },
  murky: { name: "Murky", text: "Dive ripples are harder to see, but strands last a second longer." },
  "rip-current": { name: "Rip Current", text: "A stronger Undertow, but slower waves." },
  "spring-tide": { name: "Spring Tide", text: "High Tide lasts longer, but the islands are bigger." },
  moonlit: { name: "Moonlit", text: "A brighter yard, but one extra copy." },
  "restless-spirits": { name: "Restless Spirits", text: "Grasping Hands come more often, but curses spread slower." },
  hollow: { name: "Hollow", text: "Fewer copies, but the real one's shadow is fainter." },
} as const;
export type RaidTrait = keyof typeof RAID_TRAITS;
/** Each boss's three traits; a run rolls one from its seed. */
export const RAID_BOSS_TRAITS: Partial<Record<RaidBossId, RaidTrait[]>> = {
  grumblecrag: ["restless", "fractured", "ancient"],
  tidewyrm: ["murky", "rip-current", "spring-tide"],
  gloomshade: ["moonlit", "restless-spirits", "hollow"],
  somnara: ["deep-slumber", "restless-dream", "starry-night"],
};
export const raidTraitFor = (boss: RaidBossId, seed: number) => {
  const list = RAID_BOSS_TRAITS[boss] ?? RAID_BOSS_TRAITS.grumblecrag!;
  return list[seed % list.length];
};
export const RAID_RITES = {
  lucid: { name: "Lucid", text: "Dream Bubbles cannot make you Drowsy. See the first rune of every sequence, even when someone else is the Dreamer.", icon: "Rest" },
  shelter: {
    name: "Sheltering Step",
    text: "Dashing leaves a ward. Nearby allies take 25% less damage for 3 seconds.",
    icon: "Dash",
  },
  sharing: {
    name: "Shared Spark",
    text: "Energy pickups give nearby allies 12 ultimate charge.",
    icon: "Overcharge",
  },
  core: {
    name: "Core Seeker",
    text: "Hits on the exposed core trigger an extra 8 damage once per second.",
    icon: "Static Lance",
  },
  rescue: {
    name: "Helping Paws",
    text: "Revive 35% faster and restore an extra 15% health.",
    icon: "Jump",
  },
  courage: {
    name: "Last Light",
    text: "Deal 20% more damage while below half health.",
    icon: "Spark Dart",
  },
  mending: {
    name: "Mending Pulse",
    text: "Using your ultimate heals nearby allies for 12% health.",
    icon: "Rest",
  },
  footing: {
    name: "Sure Footing",
    text: "Bubbles can't root you, and you move 15% faster through water.",
    icon: "Dash",
  },
  lamplighter: {
    name: "Lamplighter",
    text: "One hit relights a lantern, and standing in lantern light heals 1% health a second.",
    icon: "Rest",
  },
} as const;
export type RaidRite = keyof typeof RAID_RITES;
/** Themed rites only offered against their own boss. */
export const RAID_BOSS_RITES: Partial<Record<RaidRite, RaidBossId>> = {
  footing: "tidewyrm",
  lamplighter: "gloomshade",
  lucid: "somnara",
};
/** The rites a boss's runs can offer: the shared six plus its own. */
export const ritesFor = (boss: RaidBossId) =>
  (Object.keys(RAID_RITES) as RaidRite[]).filter(
    (id) => !RAID_BOSS_RITES[id] || RAID_BOSS_RITES[id] === boss,
  );
export interface RaidWarning {
  id: number;
  kind: RaidAttack;
  /** Volley: half-width of the cone, in radians. */
  spread?: number;
  /** Shared meteor: how many raiders are standing in it. */
  sharers?: number;
  /** Eruption: how many more follow this one. */
  chain?: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  radius: number;
  at: number;
  /** Server start time lets clients animate the warning without guessing its duration. */
  startedAt?: number;
  targetId?: string;
  lockAt?: number;
  followUp?: boolean;
  teach?: boolean;
  /** Tidal Wave: a high wave (island only) rather than a low one (jump). */
  high?: boolean;
  /** Grasping Hands: which checkerboard parity is dark (it may flip at `shiftAt`). */
  parity?: number;
  shiftAt?: number;
  /** Lantern Snuff: which lantern dims. */
  lantern?: number;
  /** Tail Splash: full rectangle width. */
  width?: number;
}
/** Tidewyrm's raised islands (walkable). */
export interface RaidIsland {
  x: number;
  y: number;
  radius: number;
  /** Strands it has taken this chapter. */
  cracks: number;
  /** Under water until the next chapter. */
  sunk: boolean;
  /** Peril 3, last chapter: sunk for good. */
  gone?: boolean;
}
/** A Tidal Wave band sweeping across the arena. */
export interface RaidWave {
  id: number;
  axis: "x" | "y";
  dir: 1 | -1;
  /** Where the band's centre is now, along its axis. */
  pos: number;
  speed: number;
  width: number;
  high: boolean;
}
export interface RaidState {
  /** The boss entity's player id. */
  bossId: string;
  /** Which boss this raid is (Grumblecrag, …). */
  boss: RaidBossId;
  name: string;
  peril: number;
  trait: RaidTrait;
  gilded: boolean;
  phase: number;
  maxHp: number;
  stagger: number;
  staggerUntil: number;
  exposedUntil: number;
  warnings: RaidWarning[];
  pillars: { x: number; y: number; broken: boolean }[];
  downed: Record<
    string,
    { progress: number; self: boolean; cause?: RaidAttack }
  >;
  /** Quick team signals (Stack on me, Revive me, Bait here). */
  pings?: { id: number; playerId: string; kind: RaidPingKind; until: number }[];
  /** Practice: the boss repeats one attack, and hits only count. */
  drill?: RaidAttack | null;
  drillStats?: { hits: number; dodges: number };
  /** Heroes an AI is playing for while their player reconnects. */
  standIns?: string[];
  wards: { x: number; y: number; until: number }[];
  rites: Record<string, RaidRite[]>;
  offers: Record<string, RaidRite[]>;
  /** Raid of the Day: today's featured boss at Peril 2, shared seed. */
  daily: boolean;
  /** Pacific calendar date (YYYY-MM-DD) the run counts for. */
  day: string;
  seed: number;
  partySize: number;
  elapsed: number;
  result: "victory" | "defeat" | null;
  revives: number;
  downs: number;
  closingRadius?: number;
  /** Tidewyrm: the islands of the Lagoon Court. */
  islands?: RaidIsland[];
  /** Tidewyrm is under water (can't be hit). */
  submerged?: boolean;
  /** High Tide: the floor is flooded until this time. */
  floodUntil?: number;
  waves?: RaidWave[];
  bubbles?: { id: number; x: number; y: number; vx: number; vy: number; until: number }[];
  /** Raiders sealed in a Bubble Prison, drifting to the boss's mouth. */
  prisons?: { playerId: string; x: number; y: number; hits: number; presses: number; until: number; startedAt: number }[];
  /** The Undertow's whirlpool, while it pulls. */
  undertow?: { x: number; y: number; until: number; radius: number };
  /** Times Tidewyrm has been stranded this run (its feat). */
  strands?: number;
  /** Gloomshade: the Lantern Yard's lanterns. */
  lanterns?: { x: number; y: number; lit: boolean; hits: number }[];
  /** Gloomshade's copies (the real one is the boss entity). */
  decoys?: { id: number; x: number; y: number }[];
  /** Creeping Curse stacks per raider, and who is Haunted until when. */
  curses?: Record<string, { stacks: number; hauntedUntil: number }>;
  /** Short-lived light (Voltkit's Ball Lightning). */
  lights?: { x: number; y: number; radius: number; until: number }[];
  /** The real Gloomshade is marked for everyone until this time. */
  revealUntil?: number;
  /** Hits on the real Gloomshade in a row (6 exposes it). */
  streak?: number;
  /** Somnara: public progress only; the sequence lives on the server. */
  dream?: { id: number; dreamerId: string; step: number; length: number; until: number; startedAt: number; backwards: boolean };
  dreamRings?: { id: number; x: number; y: number; radius: number; startedAt: number }[];
  dreamBubbles?: { id: number; x: number; y: number; until: number }[];
  quietZone?: { x: number; y: number; radius: number; startedAt: number; until: number };
  drowsy?: Record<string, { stacks: number; sleepUntil: number }>;
  runeCalls?: { id: number; playerId: string; rune: DreamRune; step: number; until: number }[];
  dreamTrails?: { x: number; y: number; until: number }[];
  dreamsSolved?: number;
  dreamMistakes?: number;
  message: string;
  resultId?: string;
  rewardStatus?: "saving" | "saved" | "unavailable";
  contributions?: Record<string, RaidContribution>;
}
export interface RaidReceipt {
  id: string;
  boss: RaidBossId;
  peril: number;
  trait: RaidTrait;
  gilded: boolean;
  /** Kept false for databases that only have migration 008. */
  weekly: boolean;
  week: string;
  daily?: boolean;
  day?: string;
  /** The boss's feat was achieved in this run (e.g. every charge baited). */
  feat?: boolean;
  seed: number;
  partySize: number;
  seconds: number;
  downs: number;
  revives: number;
  /** Defeats are saved too: they count towards titles and balance data. */
  result?: "victory" | "defeat";
  phaseReached?: number;
  /** Downs by attack, for tuning. */
  downCauses?: Partial<Record<RaidAttack, number>>;
  players: {
    accountId: string;
    character: string;
    damage?: number;
    revives?: number;
    pillars?: number;
    downs?: number;
  }[];
}
export interface RaidBossProgress {
  clears: number;
  highestPeril: number;
  bestSeconds: number | null;
  runs: number;
}
export interface RaidBoardRow {
  partySize: number;
  seconds: number;
  names: string[];
  peril: number;
}
export interface RaidProgress {
  /** Before migration 008: one cosmetic for everything. */
  equipped?: "cragbound" | "mountain-aura" | null;
  /** From migration 008: one item per slot. */
  loadout?: RaidLoadout;
  /** Lifetime totals across wins and losses (migration 008). */
  runs?: number;
  pillars?: number;
  revives?: number;
  clears: number;
  highestPeril: number;
  bestSeconds: number | null;
  titles: string[];
  cosmetics: string[];
  /** Pre-009 weekly board (empty from migration 009). */
  weekly: RaidBoardRow[];
  /** From migration 009: per-boss records, earned reward ids, today's board. */
  bosses?: Partial<Record<RaidBossId, RaidBossProgress>>;
  earned?: string[];
  stats?: Partial<Record<RaidBossId, { pillars: number; revives: number; feats: number }>>;
  totalClears?: number;
  today?: { day: string; boss: RaidBossId; cleared: boolean; board: RaidBoardRow[] };
  /** Days this Pacific week (Sun–Sat) with a Raid of the Day clear. */
  dailyClears?: string[];
}
export function raidWeek(date = new Date()) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start.toISOString().slice(0, 10);
}

/** The equipped look from saved progress (also reads the pre-008 format). */
export function raidLookOf(
  progress: Pick<RaidProgress, "loadout" | "equipped"> | null | undefined,
): RaidLoadout {
  if (!progress) return {};
  if (progress.loadout) return { ...progress.loadout };
  if (progress.equipped === "cragbound") return { skin: "cragbound" };
  if (progress.equipped === "mountain-aura") return { aura: "mountain-aura" };
  return {};
}
