import type { RaidBossId } from "../../../packages/shared/src/raid.js";
import { RaidArena } from "./raid.js";
import { TidewyrmArena } from "./raid-tidewyrm.js";

/** A raid room for a boss: each built boss has its own arena class. */
export function createRaidArena(code: string, boss: RaidBossId = "grumblecrag"): RaidArena {
  if (boss === "tidewyrm") return new TidewyrmArena(code, boss);
  return new RaidArena(code, boss);
}
