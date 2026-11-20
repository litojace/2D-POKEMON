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
};
