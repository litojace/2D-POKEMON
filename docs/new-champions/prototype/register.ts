/**
 * Registers the eight prototype champions where the real code looks them up,
 * for the balance tools (`--prototype`) until they ship. The mechanics they
 * use (pull, blink, rush, veil, healing zones, farBonus) and the bot rules for
 * them are real now: apps/server/src/simulation.ts and bot.ts.
 */
import {
  CHARACTERS,
  COMBOS,
  RITES,
  RITE_BY_ID,
} from "../../../packages/shared/src/index.ts";
import { NEW_CHARACTERS, NEW_COMBOS, NEW_RITES } from "./new-champions.ts";

Object.assign(CHARACTERS, NEW_CHARACTERS);
Object.assign(COMBOS, NEW_COMBOS);
for (const r of NEW_RITES) {
  RITES.push(r);
  RITE_BY_ID[r.id] = r;
}
