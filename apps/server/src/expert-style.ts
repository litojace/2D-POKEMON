import type { CharacterId } from "../../../packages/shared/src/index.js";
import type { Style } from "./bot.js";
/**
 * The expert bot's learned way of playing each champion (balance
 * measurement only). Written by scripts/balance/train-expert.ts; run it
 * again after a champion is added or changed. A champion missing here plays
 * by the rules as written.
 */
export const EXPERT_STYLE: Partial<Record<CharacterId, Style>> = {
  cindrake: {"engage":0.246,"retreat":0.401,"floor":3.354},
  auralynx: {"closeIn":2.378,"engage":0.153},
  lumoth: {"slots":[1,1,1.568,1.067],"retreat":0.403},
  astrabun: {"slots":[0.796,1,1,1],"sight":1.481,"closeIn":2.502},
  wombolder: {"slots":[1.144,1,1,1],"engage":0.078},
};
