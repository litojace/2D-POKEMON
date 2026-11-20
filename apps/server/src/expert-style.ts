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
  glacelle: { slots: [1, 1, 1.241, 1], range: 0.89 },
  sunbara: { slots: [1, 0.905, 1, 1.1], sight: 1.117, retreat: 0.397 },
  shadopus: { slots: [2.093, 0.844, 1, 1], reach: 57.293, circle: 0.888 },
  pangrove: { slots: [1, 1, 1, 1.198], reach: 64.468, circle: 1.241 },
  mossloth: { slots: [1, 1, 2.299, 1], range: 0.735 },
  mystowl: { slots: [1, 0.721, 1, 1], retreat: 0.317, range: 0.691 },
  coilemur: {
    slots: [0.754, 1, 1.693, 0.958],
    floor: 0,
    engage: 0.345,
    closeIn: 3.186,
  },
  pyranda: {
    slots: [1, 1, 1.718, 1],
    retreat: 0.375,
    range: 1.103,
    circle: 0.776,
    floor: 0,
  },
  wombolder: { slots: [0.801, 1, 1, 1.359], circle: 1.024 },
  tidefin: { slots: [0.828, 1, 1, 1], circle: 0.78, floor: 0 },
  halcyra: { slots: [1.413, 1, 1, 1], circle: 1.063 },
  auralynx: { slots: [0.767, 1, 1, 1], floor: 5.212 },
  duskveil: { slots: [1, 1, 0.966, 1], sight: 1.043 },
};
