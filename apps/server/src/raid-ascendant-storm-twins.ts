/**
 * Ascendant Storm Twins: the evolved thunder-jellies on the Spire's
 * seventieth floor, its summit (docs/spire: "Ascendant bosses"). The raid's
 * Fizz and Crackle pushed further through the same warning and honesty
 * machinery, built from their own rules: two bodies tied by a link beam,
 * opposite charges and a finish that must come together.
 *
 * - New moves (ASCENDANT_STORM_TWINS): Mirror Charge (Fizz +, Crackle -,
 *   every raider + or -: only the opposite sign discharges a twin, and both
 *   must be discharged before the charge runs out) and Short Circuit (an
 *   overcharged Link Beam the party stands on together to share its shock).
 *
 * The rules are a layer (`AscendantStormTwinsRules`) over a Storm Twins
 * arena, on while the raid is the twins' Ascendant form (`isAscendant`) and
 * the raid's own hooks otherwise. `AscendantStormTwinsArena` is that layer
 * always on: createRaidArena(code, "storm-twins", { variant: "ascendant" })
 * (server code and tests only: clients can't ask for a variant).
 *
 * (Skeleton: the layer's hooks are filled in on work/z7-boss.)
 */
import { StormTwinsArena } from "./raid-storm-twins.js";
import {
  ASCENDANT_STORM_TWINS as A,
  RAID_TRAITS,
  isAscendant,
} from "../../../packages/shared/src/raid.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwinsClass = new (...args: any[]) => StormTwinsArena;

/** Ascendant Storm Twins' rules over `Base`, on while the raid is its Ascendant form. */
export function AscendantStormTwinsRules<B extends TwinsClass>(Base: B) {
  return class AscendantStormTwinsRules extends Base {
    /** How often each read and new move was played this run (tests and balance logs). */
    twinReads = {
      habits: 0,
      anchors: 0,
      revivers: 0,
      feints: 0,
      mirrors: 0,
      overloads: 0,
      shorts: 0,
      shared: 0,
      arced: 0,
      combos: 0,
    };
    /** Are the Ascendant's rules on? (Off: every hook is the raid's own.) */
    protected twinsAscendant() {
      return isAscendant(this.raid, "storm-twins");
    }
    /** A new fight: forget the last one's reads. */
    resetTwinReads() {
      for (const k of Object.keys(this.twinReads))
        this.twinReads[k as keyof typeof this.twinReads] = 0;
    }
  };
}

/** The Ascendant Storm Twins' own raid: the layer always on. */
export class AscendantStormTwinsArena extends AscendantStormTwinsRules(
  StormTwinsArena,
) {
  constructor(code: string) {
    super(code, "storm-twins");
    this.raid.variant = "ascendant";
    this.raid.name = A.name;
  }

  override start() {
    super.start();
    const r = this.raid;
    r.variant = "ascendant";
    r.name = A.name;
    this.resetTwinReads();
    r.message = `${RAID_TRAITS[r.trait].name} ${A.name} · ${RAID_TRAITS[r.trait].text}`;
  }

  protected override finishMessage(won: boolean): string {
    return won
      ? "Two storms fall silent at once. The Spire's summit is yours!"
      : "The Ascendant Storm Twins still crackle at the summit. Pair your charges and climb again.";
  }
}
