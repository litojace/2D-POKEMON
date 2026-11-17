import { StormTwinsArena } from "./raid-storm-twins.js";
import { EmberwingArena } from "./raid-emberwing.js";
import { PrismatailArena } from "./raid-prismatail.js";
import type {
  RaidBossId,
  RaidVariant,
} from "../../../packages/shared/src/raid.js";
import { RaidArena } from "./raid.js";
import { TidewyrmArena } from "./raid-tidewyrm.js";
import { SomnaraArena } from "./raid-somnara.js";
import { GloomshadeArena } from "./raid-gloomshade.js";
import { AscendantCragmuffArena } from "./raid-ascendant-cragmuff.js";
import { AscendantTidelotlArena } from "./raid-ascendant-tidelotl.js";
import { AscendantInkpurrArena } from "./raid-ascendant-inkpurr.js";

/**
 * A raid room for a boss: each built boss has its own arena class. An
 * Ascendant variant (the Spire's boss floors) is its own class too; a boss
 * without one plays its ordinary raid.
 */
export function createRaidArena(
  code: string,
  boss: RaidBossId = "grumblecrag",
  opts: { variant?: RaidVariant } = {},
): RaidArena {
  if (opts.variant === "ascendant" && boss === "grumblecrag")
    return new AscendantCragmuffArena(code);
  if (opts.variant === "ascendant" && boss === "tidewyrm")
    return new AscendantTidelotlArena(code);
  if (opts.variant === "ascendant" && boss === "gloomshade")
    return new AscendantInkpurrArena(code);
  if (boss === "storm-twins") return new StormTwinsArena(code, boss);
  if (boss === "emberwing") return new EmberwingArena(code, boss);
  if (boss === "prismatail") return new PrismatailArena(code, boss);
  if (boss === "somnara") return new SomnaraArena(code, boss);
  if (boss === "tidewyrm") return new TidewyrmArena(code, boss);
  if (boss === "gloomshade") return new GloomshadeArena(code, boss);
  return new RaidArena(code, boss);
}
