import { CHAMPION_SKINS } from "../../../../packages/shared/src/shop";
import type { CharacterId } from "@arena/shared";

export type EpicFamily =
  "signature" | "cyber" | "abyssal" | "carnival" | "vanguard";
export interface EpicSignature {
  id: string;
  champion: CharacterId;
  family: EpicFamily;
  title: string;
  ordinal: number;
}
/** Per-champion concepts, ordered classic / mecha / diving / carnival / hero.
 * Geometry and choreography live in epic-glyphs / epic-skin-fx. */
export const EPIC_CONCEPTS = {
  voltkit: [
    "Pixel lightning",
    "Induction circuit",
    "Electric sonar",
    "Jester sparks",
    "Pulse chevrons",
  ],
  cindrake: [
    "Forge embers",
    "Reactor exhaust",
    "Thermal plume",
    "Fire-fan sparks",
    "Solar furnace",
  ],
  tidefin: [
    "Glacier shards",
    "Hydro turbine",
    "Reef currents",
    "Pearl-shell dance",
    "Riptide foil",
  ],
  auralynx: [
    "Stained-glass facets",
    "Prism array",
    "Cryo sonar",
    "Acrobat diamonds",
    "Prism shield",
  ],
  lumoth: [
    "Aurora ribbons",
    "Photon grid",
    "Abyssal lanterns",
    "Ribbonwing bow",
    "Lumen beacons",
  ],
  mystowl: [
    "Clockwork orbit",
    "Psi radar",
    "Sonar feather",
    "Ringmaster wand",
    "Star-chart relay",
  ],
  terradon: [
    "Geode crystals",
    "Tank treads",
    "Reef bastion",
    "Carousel lights",
    "Seed bulwark",
  ],
  duskveil: [
    "Candle wisps",
    "Ghost terminal",
    "Diving-bell echoes",
    "Marionette strings",
    "Echo beacon",
  ],
  coilemur: [
    "Tesla arcs",
    "Magnetic coils",
    "Cable currents",
    "Juggling hoops",
    "Flux loops",
  ],
  pyranda: [
    "Stitched embers",
    "Afterburner fins",
    "Coral rescue",
    "Scarlet fan",
    "Healing seedlings",
  ],
  glacelle: [
    "Jellyfish pulses",
    "Cryo lattice",
    "Bathyal bell",
    "Ballet bells",
    "Ice weaving",
  ],
  halcyra: [
    "Origami flight",
    "Scope lock",
    "Current compass",
    "Opera feathers",
    "Gale slipstream",
  ],
  sunbara: [
    "Sunflower petals",
    "Solar panels",
    "Buoy waves",
    "Honey lanterns",
    "Dawn canopy",
  ],
  astrabun: [
    "Comet trail",
    "Warp brackets",
    "Lunar sonar",
    "Mochi harlequin",
    "Comet glide",
  ],
  wombolder: [
    "Gold nuggets",
    "Hydraulic pistons",
    "Trench drill",
    "Parade drums",
    "Quake compressor",
  ],
  shadopus: [
    "Angler lights",
    "Cloaking grid",
    "Nautilus spiral",
    "Eight-bell jester",
    "Oracle pearls",
  ],
  pangrove: [
    "Amber sap",
    "Scale rotor",
    "Kelp current",
    "Leaf masquerade",
    "Briar lattice",
  ],
  mossloth: [
    "Bonsai seedlings",
    "Growth circuits",
    "Coral garden",
    "Dreamcap stars",
    "Cloud cushions",
  ],
} as const satisfies Record<
  CharacterId,
  readonly [string, string, string, string, string]
>;
const families: EpicFamily[] = [
  "signature",
  "cyber",
  "abyssal",
  "carnival",
  "vanguard",
];
export const EPIC_SIGNATURES: Record<string, EpicSignature> =
  Object.fromEntries(
    CHAMPION_SKINS.filter((s) => s.rarity === "epic").map((s) => {
      const family: EpicFamily =
        s.collection === "cyber"
          ? "cyber"
          : s.collection === "abyssal-expedition"
            ? "abyssal"
            : s.collection === "dream-carnival"
              ? "carnival"
              : s.collection === "nova-vanguard"
                ? "vanguard"
                : "signature";
      return [
        s.id,
        {
          id: s.id,
          champion: s.champion,
          family,
          title: EPIC_CONCEPTS[s.champion][families.indexOf(family)],
          ordinal: Object.keys(EPIC_CONCEPTS).indexOf(s.champion),
        },
      ];
    }),
  );
