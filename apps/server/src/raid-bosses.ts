import { PrismatailArena } from "./raid-prismatail.js";
import type { RaidBossId } from "../../../packages/shared/src/raid.js";
import { RaidArena } from "./raid.js";
import { TidewyrmArena } from "./raid-tidewyrm.js";
import { SomnaraArena } from "./raid-somnara.js";
import { GloomshadeArena } from "./raid-gloomshade.js";

/** A raid room for a boss: each built boss has its own arena class. */
export function createRaidArena(code: string, boss: RaidBossId = "grumblecrag"): RaidArena {
  if (boss === "prismatail") return new PrismatailArena(code, boss);
  if (boss === "somnara") return new SomnaraArena(code, boss);
  if (boss === "tidewyrm") return new TidewyrmArena(code, boss);
  if (boss === "gloomshade") return new GloomshadeArena(code, boss);
  return new RaidArena(code, boss);
}
