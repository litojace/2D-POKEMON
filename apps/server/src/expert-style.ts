import type { CharacterId } from "../../../packages/shared/src/index.js";
import type { Style } from "./bot.js";
/**
 * The expert bot's learned way of playing each champion (balance
 * measurement only). Written by scripts/balance/train-expert.ts; run it
 * again after a champion is added or changed. A champion missing here plays
 * by the rules as written.
 */
export const EXPERT_STYLE: Partial<Record<CharacterId, Style>> = {
  voltkit: { sight: 1.211, floor: 1.661 },
  tidefin: { circle: 0.677 },
  mystowl: { retreat: 0.281, reach: 62.079 },
  duskveil: { kite: 1, sight: 1.316 },
  coilemur: { circle: 1.088, retreat: 0.397 },
  pangrove: { sight: 1.172, range: 1.106 },
};
