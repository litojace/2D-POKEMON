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
  auralynx: {"closeIn":2.378,"engage":0.153,"slots":[0.852,1,1,1],"retreat":0.384},
  lumoth: {"slots":[1,1,1.568,1.067],"retreat":0.403,"kite":0.994,"sight":0.894},
  astrabun: {"slots":[0.796,1,1,1],"sight":1.481,"closeIn":2.502},
  wombolder: {"slots":[1.144,1,1,1],"engage":0.078},
  voltkit: {"range":1.151},
  mystowl: {"floor":0,"range":0.866},
  terradon: {"slots":[0.881,1,1,1],"sight":0.617,"engage":0.226},
  duskveil: {"slots":[1,1.264,1,1],"retreat":0.414},
  glacelle: {"slots":[1.112,1,1,1],"circle":0.961,"engage":0.318},
  halcyra: {"slots":[1,0.418,1,1]},
  mossloth: {"slots":[1,0.977,1,1],"circle":0.884,"sight":0.977},
};
