import { stormTwinsPattern } from "./raid-storm-twins.js";
export * from "./raid-storm-twins.js";
import { emberwingPattern } from "./raid-emberwing.js";
export * from "./raid-emberwing.js";
import { prismatailPattern } from "./raid-prismatail.js";
export * from "./raid-prismatail.js";
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
  | "lullaby" | "tail-splash" | "dream-bubbles" | "falling-stars" | "whale-song" | "dream-sequence" | "nightmare"
  | "prism-lance" | "fan-display" | "glare" | "refraction" | "halo-crush" | "light-relay"
  | "dive-bomb" | "ember-rain" | "wing-gust" | "flame-ring" | "scorched-earth" | "heat-mark" | "brazier-lighting"
  | "link-beam" | "chain-lightning" | "static-field" | "twin-rush" | "polarity" | "thunderclap";
export const RAID_ATTACKS: Record<
  RaidAttack,
  { name: string; tip: string; practice: string }
> = {
  "prism-lance": { name: "Prism Lance", tip: "Sidestep the thin red lane after it locks.", practice: "A locked straight beam. Step sideways." },
  "fan-display": { name: "Fan Display", tip: "The numbered colour on the crest is the only cone that fires. Leave that cone.", practice: "Six numbered cones appear; only the crest\u2019s matching colour fires." },
  "glare": { name: "Glare", tip: "Aim away from the boss when the eye warning fills. On touch, hold Look away. Mystowl\u2019s Ward protects allies inside.", practice: "Turn away before the white crest flashes to avoid 1.5 seconds of blindness." },
  "refraction": { name: "Refraction", tip: "Lances bounce off mirror posts. Both segments are marked before they fire.", practice: "Leave both marked beam segments." },
  "halo-crush": { name: "Halo Crush", tip: "The ring closes around the marked point. Move through the teal gap or dash clear.", practice: "A closing halo has one marked safe gap." },
  "light-relay": { name: "Light Relay", tip: "Stand between the skylight and a mirror. Hit mirrors to rotate them 45\u00b0. Chain light into the heart. In the final phase, solo holds one beam for 2 seconds; teams need both paths within 3 seconds.", practice: "Connect skylight \u2192 raider \u2192 mirrors \u2192 heart. Hit a mirror to turn its arrow." },
  "dive-bomb": {"name": "Dive Bomb", "tip": "Sidestep the locked lane. The dive leaves a burning trail for 4 seconds. Auralynx can reflect it with Mirror Guard.", "practice": "A locked lane marks the dive. Step sideways; avoid the burning trail."},
  "ember-rain": {"name": "Ember Rain", "tip": "Keep moving between the small marked circles. Each ember lands separately.", "practice": "Embers rain down on staggered circles. Step between them."},
  "wing-gust": {"name": "Wing Gust", "tip": "Leave the arrow cone or dash into the gust to resist its push. Avoid being pushed into fire.", "practice": "The cone pushes you away. Dash toward the boss as it lands."},
  "flame-ring": {"name": "Flame Ring", "tip": "Jump as the expanding edge reaches you. Standing inside the ring after it passes is safe.", "practice": "Jump over the expanding ring of fire."},
  "scorched-earth": {"name": "Scorched Earth", "tip": "Avoid growing fire patches. Grounding Emberwing shrinks all fire; Tidefin\u2019s Whirlpool extinguishes nearby patches.", "practice": "Fire patches grow over time. Ground the boss to shrink them."},
  "heat-mark": {"name": "Heat Mark", "tip": "Spread out from marked allies before the 3-second timer expires. Each marked raider takes their own hit; standing in another blast adds damage.", "practice": "A blast follows you for 3 seconds. Spread out, then stay clear of other marked raiders."},
  "brazier-lighting": {"name": "Brazier Lighting", "tip": "Stand inside a brazier ring for 1.5 seconds. Light all three together to ground Emberwing. Solo flames last 12 seconds (8 on Peril 3). Fireproof halves the lighting time.", "practice": "Run the triangle and light all three braziers before the first goes out."},
  "link-beam": {"name": "Link Beam", "tip": "Jump across the bright ribbon or leave its path. From phase 2 copper posts bend it. Mirror Guard reflects it into a twin.", "practice": "The ribbon brightens, then sweeps. Jump across it or stay clear."},
  "chain-lightning": {"name": "Chain Lightning", "tip": "Spread more than 200px apart. The strike jumps up to three raiders. Voltkit absorbs it for 15 ultimate charge; Grounded prevents it jumping from you.", "practice": "A marked raider starts a chain. Spread out so it cannot jump."},
  "static-field": {"name": "Static Field", "tip": "Avoid the crackling circle or jump across it. Standing inside hurts and slows you.", "practice": "A static field remains on the floor. Jump while crossing it."},
  "twin-rush": {"name": "Twin Rush", "tip": "Leave both locked lanes before the twins rush through. The crossing point is dangerous.", "practice": "Two lanes cross. Sidestep before both twins dash."},
  "polarity": {"name": "Polarity", "tip": "Stand within 125px of an opposite sign before the 4-second timer ends. Same signs together take double damage. Solo: enter your opposite-sign floor pad. Terradon\u2019s Hibernate blocks the blast.", "practice": "Pair with an opposite sign. Solo: reach the matching floor pad."},
  "thunderclap": {"name": "Thunderclap", "tip": "The twin with less health marks a circle. Jump as it fills or step outside.", "practice": "A ring fills around the weaker twin. Jump or leave it."},
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
/** Six attacks per boss, in Hub/practice order. Brazier lighting is an arena mechanic. */
export const RAID_BOSS_ATTACKS: Record<RaidBossId, RaidAttack[]> = {
  "storm-twins": ["link-beam", "chain-lightning", "static-field", "twin-rush", "polarity", "thunderclap"],
  emberwing: ["dive-bomb", "ember-rain", "wing-gust", "flame-ring", "scorched-earth", "heat-mark"],
  prismatail: ["prism-lance", "fan-display", "glare", "refraction", "halo-crush", "light-relay"],
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
  if (boss === "prismatail") return prismatailPattern(phase);
  if (boss === "emberwing") return emberwingPattern(phase);
  if (boss === "storm-twins") return stormTwinsPattern(phase);
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
  if (kind === "bait" && boss === "storm-twins") return "Focus here";
  if (kind === "bait" && boss === "emberwing") return "Brazier here";
  if (kind === "bait" && boss === "prismatail") return "Relay here";
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
  prismatail: {
    cindrake: { skill: "Sunfire Pillar", text: "Your pillar relays the sunbeam for 4 seconds." },
    lumoth: { skill: "Radiant Flare", text: "For 4 seconds, light reaching you fans out through nearby allies." },
    mystowl: { skill: "Ward", text: "Your ward protects nearby allies from Glare." },
    duskveil: { skill: "Void Orb", text: "A Void Orb on a lance lane swallows that segment." },
  },
  emberwing: {
    cindrake: { skill: "Blaze Whirl", text: "Your flames light any brazier they touch, including while you move." },
    tidefin: { skill: "Whirlpool", text: "Your water extinguishes fire patches and dive trails where it lands." },
    auralynx: { skill: "Mirror Guard", text: "Reflecting a Dive Bomb adds 20 stagger to Emberwing." },
    lumoth: { skill: "Starfall Spray", text: "Your stars deal full damage to an airborne Emberwing." },
  },
  "storm-twins": {
    voltkit: { skill: "Electric affinity", text: "Absorb Chain Lightning: it stops on you and grants 15 ultimate charge." },
    auralynx: { skill: "Mirror Guard", text: "Reflect Link Beam into a twin for 20 extra stagger." },
    terradon: { skill: "Hibernate", text: "Your sleeping shell blocks Polarity damage." },
    duskveil: { skill: "Void Orb", text: "A hit pulls that twin toward its partner, shortening the Link Beam." },
  },
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
  prismatail: [
    { name: "Dawn", objective: "Carry skylight through mirrors into the shielded heart.", detail: "Stand within the skylight ring to take the beam. Light travels up to 300px between raiders and mirror posts, and 260px into the heart. Hit a mirror to turn its arrow 45°. A connected chain shatters the shield for 6 seconds. Carrying light burns 3 health per second." },
    { name: "High Noon", objective: "Follow reflected lanes. Escape through the halo gap.", detail: "Prismatail moves farther from the skylight. Refraction shows both sides of the bounce before firing. The closing halo leaves a teal gap. The Polished rite prevents beam burn and extends your relay range." },
    { name: "Solar Crown", objective: "Complete both light paths within 3 seconds.", detail: "Teams connect two skylights to the heart within 3 seconds; mirrors can carry either path. Solo needs one continuous connection for 2 seconds. Turn your aim away from Glare, or hold Look away on touch. Save ultimates for the exposed heart." },
  ],
  emberwing: [
    { name: "Takeoff", objective: "Sidestep dives. Jump the expanding flame ring.", detail: "Emberwing stays on the ground while you learn its attacks. Avoid the locked dive lane and its burning trail, step between falling embers, and dash toward the boss to resist Wing Gust." },
    { name: "High Flight", objective: "Light all three braziers together to ground Emberwing.", detail: "Stand on a brazier for 1.5 seconds. Team flames last 6 seconds; solo flames last 12 seconds (8 on Peril 3). Grounding exposes Emberwing for 6 seconds and shrinks fire patches. Melee cannot hit it in the air; ranged damage is halved. Spread out for Heat Marks." },
    { name: "Blazing Sky", objective: "Ground it twice to keep the heart open.", detail: "Team braziers stay lit for 4 seconds, while solo keeps the longer timer. Fire spreads faster. Bring Emberwing down twice this chapter and it stays grounded, exposed for the rest of the fight. Fireproof halves lighting time and reduces floor-fire damage by 50%." },
  ],
  "storm-twins": [
    { name: "Spark", objective: "Watch both health bars. Jump the link and spread from chains.", detail: "Fizz and Crackle have separate health and stagger. Split your damage between them. Their combined health opens rites at 67% and 33%; the finishing blows unlock in Supercell. Jump across Link Beam and leave both Twin Rush lanes." },
    { name: "Storm", objective: "Pair opposite signs. Follow the beam around copper posts.", detail: "Polarity marks everyone for 4 seconds: stand near an opposite sign to cancel it. Same signs together take double damage. Solo gets an opposite-sign floor pad. Static Fields slow and hurt; jump while crossing them. Each twin staggers separately." },
    { name: "Supercell", objective: "Bring both low, then defeat them within the countdown.", detail: "When one twin falls, finish the other within 15/12/8 seconds on Peril 1/2/3. Solo gets 3 more seconds. If time expires, the fallen twin returns at 35% health. Keep both low before dealing a finishing blow. Touch players can tap Fizz or Crackle to switch targets." },
  ],
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
  | "twilight-colors" | "starlit-skin" | "dreamdrift" | "moonglass" | "lullaby-aura" | "sweet-dreams"
  | "dawn-colors" | "prismatic-skin" | "sunburst" | "stained-glass" | "halo-aura" | "rainbow-fan"
  | "ember-colors" | "cinderplume" | "firefall" | "brazier-frame" | "ember-aura" | "feather-fall"
  | "static-colors" | "thundercell" | "lightning-strike" | "conductor-frame" | "spark-aura" | "twin-spark";
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
  {"id": "stormsplitter", "boss": "storm-twins", "slot": "title", "name": "Stormsplitter", "description": "Title", "goal": "First clear", "rule": {"kind": "clears", "n": 1}},
  {"id": "static-colors", "boss": "storm-twins", "slot": "skin", "name": "Static colors", "description": "Storm blue with sunny yellow highlights", "goal": "5 clears", "rule": {"kind": "clears", "n": 5}},
  {"id": "thundercell", "boss": "storm-twins", "slot": "skin", "name": "Thundercell skin", "description": "Cloud-white markings with electric blue lightning flecks", "goal": "10 clears", "rule": {"kind": "clears", "n": 10}},
  {"id": "lightning-strike", "boss": "storm-twins", "slot": "entrance", "name": "Lightning-strike entrance", "description": "Arrive between twin bolts of yellow and blue light", "goal": "Clear Peril 2", "rule": {"kind": "peril", "n": 2}},
  {"id": "eye-of-the-storm", "boss": "storm-twins", "slot": "title", "name": "Eye of the Storm", "description": "Title", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "conductor-frame", "boss": "storm-twins", "slot": "frame", "name": "Conductor frame", "description": "Copper corners linked by yellow and blue arcs", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "spark-aura", "boss": "storm-twins", "slot": "aura", "name": "Spark aura", "description": "Yellow and blue sparks orbit beneath your fighter", "goal": "Clear Peril 3 with no downs", "rule": {"kind": "flawless", "peril": 3}},
  {"id": "twin-spark", "boss": "storm-twins", "slot": "victory", "name": "Twin Spark", "description": "Two little thunder-jellies meet in a shower of sparks", "goal": "Feat: defeat both twins within 2 seconds of each other", "rule": {"kind": "feat"}},
  {"id": "flashpoint", "boss": "storm-twins", "slot": "title", "name": "Flashpoint", "description": "Title", "goal": "Clear Peril 2 solo in under 4:00", "rule": {"kind": "speed", "peril": 2, "party": 1, "seconds": 240}},
  {"id": "lone-conductor", "boss": "storm-twins", "slot": "title", "name": "Lone Conductor", "description": "Title", "goal": "Clear Peril 3 solo (no self-revive)", "rule": {"kind": "solo", "peril": 3}},
  {"id": "perfect-pair", "boss": "storm-twins", "slot": "title", "name": "Perfect Pair", "description": "Title", "goal": "Cancel 40 polarity marks with an opposite sign (wins and losses)", "rule": {"kind": "stat", "stat": "pillars", "n": 40}},

  {"id": "skyfeller", "boss": "emberwing", "slot": "title", "name": "Skyfeller", "description": "Title", "goal": "First clear", "rule": {"kind": "clears", "n": 1}},
  {"id": "ember-colors", "boss": "emberwing", "slot": "skin", "name": "Ember colors", "description": "Burnished orange with warm golden highlights", "goal": "5 clears", "rule": {"kind": "clears", "n": 5}},
  {"id": "cinderplume", "boss": "emberwing", "slot": "skin", "name": "Cinderplume skin", "description": "Charcoal feathers with glowing ember flecks", "goal": "10 clears", "rule": {"kind": "clears", "n": 10}},
  {"id": "firefall", "boss": "emberwing", "slot": "entrance", "name": "Firefall entrance", "description": "Arrive in a shower of glowing feathers", "goal": "Clear Peril 2", "rule": {"kind": "peril", "n": 2}},
  {"id": "wingbreaker", "boss": "emberwing", "slot": "title", "name": "Wingbreaker", "description": "Title", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "brazier-frame", "boss": "emberwing", "slot": "frame", "name": "Brazier frame", "description": "A dark bronze frame with burning corners", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "ember-aura", "boss": "emberwing", "slot": "aura", "name": "Ember aura", "description": "Warm embers drift around a glowing ring", "goal": "Clear Peril 3 with no downs", "rule": {"kind": "flawless", "peril": 3}},
  {"id": "feather-fall", "boss": "emberwing", "slot": "victory", "name": "Feather Fall", "description": "Fiery feathers fan out and drift gently around you", "goal": "Feat: ground Emberwing within 20 seconds of takeoff three times", "rule": {"kind": "feat"}},
  {"id": "flashfire", "boss": "emberwing", "slot": "title", "name": "Flashfire", "description": "Title", "goal": "Clear Peril 2 solo in under 4:00", "rule": {"kind": "speed", "peril": 2, "party": 1, "seconds": 240}},
  {"id": "lone-phoenix", "boss": "emberwing", "slot": "title", "name": "Lone Phoenix", "description": "Title", "goal": "Clear Peril 3 solo (no self-revive)", "rule": {"kind": "solo", "peril": 3}},
  {"id": "torchbearer", "boss": "emberwing", "slot": "title", "name": "Torchbearer", "description": "Title", "goal": "Light 60 braziers (wins and losses)", "rule": {"kind": "stat", "stat": "pillars", "n": 60}},

  {"id": "prismbreaker", "boss": "prismatail", "slot": "title", "name": "Prismbreaker", "description": "Title", "goal": "First clear", "rule": {"kind": "clears", "n": 1}},
  {"id": "dawn-colors", "boss": "prismatail", "slot": "skin", "name": "Dawn colors", "description": "Warm gold with rose and peach highlights", "goal": "5 clears", "rule": {"kind": "clears", "n": 5}},
  {"id": "prismatic-skin", "boss": "prismatail", "slot": "skin", "name": "Prismatic skin", "description": "Crystal-white skin edged in rainbow light", "goal": "10 clears", "rule": {"kind": "clears", "n": 10}},
  {"id": "sunburst", "boss": "prismatail", "slot": "entrance", "name": "Sunburst entrance", "description": "Arrive in a burst of golden rays", "goal": "Clear Peril 2", "rule": {"kind": "peril", "n": 2}},
  {"id": "sunshatter", "boss": "prismatail", "slot": "title", "name": "Sunshatter", "description": "Title", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "stained-glass", "boss": "prismatail", "slot": "frame", "name": "Stained-glass frame", "description": "A rainbow crystal portrait frame", "goal": "Clear Peril 3", "rule": {"kind": "peril", "n": 3}},
  {"id": "halo-aura", "boss": "prismatail", "slot": "aura", "name": "Halo aura", "description": "A golden halo with orbiting prism crystals", "goal": "Clear Peril 3 with no downs", "rule": {"kind": "flawless", "peril": 3}},
  {"id": "rainbow-fan", "boss": "prismatail", "slot": "victory", "name": "Rainbow Fan", "description": "A fan of rainbow crystal feathers blooms behind you", "goal": "Feat: shatter the shield within 8 seconds three times", "rule": {"kind": "feat"}},
  {"id": "sunbeam-sprint", "boss": "prismatail", "slot": "title", "name": "Sunbeam Sprint", "description": "Title", "goal": "Clear Peril 2 solo in under 4:00", "rule": {"kind": "speed", "peril": 2, "party": 1, "seconds": 240}},
  {"id": "lone-sun", "boss": "prismatail", "slot": "title", "name": "Lone Sun", "description": "Title", "goal": "Clear Peril 3 solo (no self-revive)", "rule": {"kind": "solo", "peril": 3}},
  {"id": "lightkeeper", "boss": "prismatail", "slot": "title", "name": "Lightkeeper", "description": "Title", "goal": "Relay light 80 times (wins and losses)", "rule": {"kind": "stat", "stat": "pillars", "n": 80}},

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
  bickering: { name: "Bickering", text: "The twins drift farther apart, but Link Beam deals less damage." },
  "in-sync": { name: "In Sync", text: "Both twins cast together, but the finishing window lasts 3 seconds longer." },
  overloaded: { name: "Overloaded", text: "More Static Fields, but each twin staggers 20% faster." },
  updraft: { name: "Updraft", text: "A longer opening flight, but grounding exposes the heart for 2 extra seconds." },
  smouldering: { name: "Smouldering", text: "Fire patches last longer, but less Ember Rain falls." },
  molting: { name: "Molting", text: "Dives come more often, but fallen feathers grant 10 ultimate charge." },
  dazzling: { name: "Dazzling", text: "More Glare, but relay range grows by 60px." },
  overcast: { name: "Overcast", text: "Light needs an extra relay link, but fewer lances fire." },
  kaleidoscope: { name: "Kaleidoscope", text: "Eight fan cones, but the heart stays exposed a second longer." },
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
  prismatail: ["dazzling", "overcast", "kaleidoscope"],
  "storm-twins": ["bickering", "in-sync", "overloaded"],
  emberwing: ["updraft", "smouldering", "molting"],
  somnara: ["deep-slumber", "restless-dream", "starry-night"],
};
export const raidTraitFor = (boss: RaidBossId, seed: number) => {
  const list = RAID_BOSS_TRAITS[boss] ?? RAID_BOSS_TRAITS.grumblecrag!;
  return list[seed % list.length];
};
export const RAID_RITES = {
  grounded: { name: "Grounded", text: "Chain Lightning cannot jump from you. A Polarity mismatch deals normal damage to you.", icon: "Storm Grid" },
  fireproof: { name: "Fireproof", text: "Take 50% less damage from burning ground and light braziers twice as fast.", icon: "Blaze Whirl" },
  polished: { name: "Polished", text: "Carry sunlight without burning. Your relay range grows by 60px.", icon: "Mirror Guard" },
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
/**
 * Rites are chosen once, before the fight: each raider picks this many from
 * RAID_RITE_OFFER options (their boss's own rite among them). Nothing is
 * chosen mid-fight; instead every rite grows a step when the boss enters
 * chapter 2 and again at chapter 3 (RITE_TIERS).
 */
export const RAID_RITE_PICKS = 2;
export const RAID_RITE_OFFER = 5;
/** Each rite's number in chapters 1, 2 and 3 (the text shows chapter 1's). */
export const RITE_TIERS = {
  /** Allies near a dash ward take this much less damage. */
  shelter: [0.25, 0.3, 0.35],
  /** Ultimate charge given to nearby allies per energy pickup. */
  sharing: [12, 15, 18],
  /** Extra damage on the exposed core, once a second. */
  core: [8, 10, 12],
  /** Faster revives. */
  rescue: [0.35, 0.45, 0.55],
  /** Extra damage below half health. */
  courage: [0.2, 0.25, 0.3],
  /** Allies healed by your ultimate (share of their health). */
  mending: [0.12, 0.15, 0.18],
  /** Less damage from burning ground. */
  fireproof: [0.5, 0.6, 0.7],
  /** Extra relay range (px). */
  polished: [60, 80, 100],
  /** Faster through water. */
  footing: [0.15, 0.2, 0.25],
  /** Health healed per second in lantern light (share). */
  lamplighter: [0.01, 0.015, 0.02],
} as const satisfies Partial<Record<RaidRite, readonly [number, number, number]>>;
/** Helping Paws: extra health on revive, by chapter. */
export const RESCUE_HEALTH = [0.15, 0.2, 0.25] as const;
export type TieredRite = keyof typeof RITE_TIERS;
const chapterIndex = (chapter: number) => Math.max(0, Math.min(2, Math.round(chapter) - 1));
/** A rite's number in the given chapter (1-3). */
export function riteValue(rite: TieredRite, chapter: number): number {
  return RITE_TIERS[rite][chapterIndex(chapter)];
}
/** "25% → 30% → 35%": how a rite grows over the fight (for its card). */
export function riteGrowth(rite: RaidRite): string | undefined {
  if (!(rite in RITE_TIERS)) return undefined;
  const values = RITE_TIERS[rite as TieredRite];
  const percent = rite !== "sharing" && rite !== "core" && rite !== "polished";
  const show = (v: number) =>
    percent ? `${Math.round(v * 1000) / 10}%` : rite === "polished" ? `${v}px` : String(v);
  return values.map(show).join(" → ");
}
/** Themed rites only offered against their own boss. */
export const RAID_BOSS_RITES: Partial<Record<RaidRite, RaidBossId>> = {
  footing: "tidewyrm",
  lamplighter: "gloomshade",
  lucid: "somnara",
  polished: "prismatail",
  fireproof: "emberwing",
  grounded: "storm-twins",
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
  prismIndex?: number;
  prismCount?: number;
  gapAngle?: number;
  casterId?: string;
  beamPost?: number;
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
  /** Legacy receipt compatibility; new runs are always ordinary raids. */
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
  twins?: import("./raid-storm-twins.js").StormTwin[];
  twinRevivals?: number;
  stormBeam?: { points:import("./raid-storm-twins.js").StormPoint[]; post?:number; until:number };
  stormFields?: { id:number; x:number; y:number; radius:number; until:number; casterId:string }[];
  stormRushes?: { id:string; x:number; y:number; tx:number; ty:number; until:number }[];
  stormChain?: { points:import("./raid-storm-twins.js").StormPoint[]; until:number };
  polarities?: { playerId:string; sign:1|-1; until:number; cancelled:boolean }[];
  polarityPad?: { x:number; y:number; sign:1|-1; until:number };
  airborne?: boolean;
  braziers?: import("./raid-emberwing.js").RaidBrazier[];
  emberPatches?: import("./raid-emberwing.js").EmberPatch[];
  emberTrails?: import("./raid-emberwing.js").EmberTrail[];
  flameRings?: { id:number; x:number; y:number; radius:number; startedAt:number }[];
  emberFeathers?: { id:number; x:number; y:number; until:number }[];
  emberDive?: { x:number; y:number; tx:number; ty:number; startedAt:number; until:number };
  groundings?: number;
  quickGroundings?: number;
  chapterGroundings?: number;
  permanentGround?: boolean;
  takeoffAt?: number;
  mirrors?: import("./raid-prismatail.js").PrismMirror[];
  lightLinks?: import("./raid-prismatail.js").LightLink[];
  lightStartedAt?: number;
  lightHold?: number;
  lightArrivals?: number[];
  shieldBreaks?: number;
  quickBreaks?: number;
  blinded?: Record<string, number>;
  sunPillars?: { x: number; y: number; until: number; owner: string }[];
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
  /** Per-boss records and earned rewards. */
  bosses?: Partial<Record<RaidBossId, RaidBossProgress>>;
  earned?: string[];
  stats?: Partial<Record<RaidBossId, { pillars: number; revives: number; feats: number }>>;
  totalClears?: number;
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
