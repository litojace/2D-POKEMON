import type { CharacterId } from "../../../packages/shared/src/index.js";
import type { Style } from "./bot.js";
/**
 * The expert bot's learned way of playing each champion (balance
 * measurement only). Written by scripts/balance/train-expert.ts; run it
 * again after a champion is added or changed. A champion missing here plays
 * by the rules as written.
 */
export const EXPERT_STYLE: Partial<Record<CharacterId, Style>> = {
  astrabun: {"slots":[0.796,1,1.506,0.659],"sight":1.481,"closeIn":2.502,"engage":0.133},
  wombolder: {"slots":[1.144,1,1,1],"engage":0.078},
  glacelle: {"slots":[1.112,1,1,1],"circle":0.961,"engage":0.318,"sight":1.047,"range":1.006},
  halcyra: {"slots":[1.285,0.418,1,1],"kite":0.862,"floor":0.589},
  mossloth: {"slots":[1,0.977,1,1],"circle":0.884,"sight":0.977},
  shadopus: {"slots":[1.33,0.949,1,1],"closeIn":2.213},
  coilemur: {"slots":[1,1,1,1.902],"floor":0,"reach":54.217},
  pyranda: {"engage":0.157,"sight":0.958},
};
