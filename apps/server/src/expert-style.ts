import type { CharacterId } from "../../../packages/shared/src/index.js";
import type { Style } from "./bot.js";
/**
 * The expert bot's learned way of playing each champion (balance
 * measurement only). Written by scripts/balance/train-expert.ts; run it
 * again after a champion is added or changed. A champion missing here plays
 * by the rules as written.
 */
export const EXPERT_STYLE: Partial<Record<CharacterId, Style>> = {
  lumoth: { floor: 4.06, circle: 0.662, kite: 0.774, retreat: 0.299 },
  shadopus: { slots: [2.093, 0.844, 1, 1], reach: 57.293, circle: 0.888 },
  mossloth: { slots: [1, 1, 2.299, 1], range: 0.735 },
  mystowl: { slots: [1, 0.721, 1, 1], retreat: 0.317, range: 0.691 },
};
