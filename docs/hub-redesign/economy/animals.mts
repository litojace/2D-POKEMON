/**
 * Animals vs the field (20261117100000_farm_coop_cows.sql, cows from 20261117170000): Gold Leaves a day
 * from crops, the cows and the hens at each farm level, from the live shared
 * rules (packages/shared/src/farm.ts). Run from the repo root:
 *   node --experimental-strip-types docs/hub-redesign/economy/animals.mts
 * A player checks in `checks` times a day; crops now ripen in minutes, so
 * every plot gives one harvest of its best crop per check, and each animal
 * gives one round per check (milk and eggs refill in 2 h). Orders add 10%
 * to crops, as in farm_model.py. Optimistic for crops (seed stock is shared
 * and limited), so the animals' share is if anything a little high.
 */
import * as F from "../../../packages/shared/src/farm.ts";

const ARCH = { casual: 2, regular: 4, hardcore: 9 };
const plots = (L: number) => 15 + F.LAND_LEVEL.filter((l) => l <= L).length;
const cropsDay = (L: number, checks: number) => {
  const av = F.CROPS.filter((c) => c.level <= L && c.rarity !== "legendary");
  const best = Math.max(...av.map((c) => 2 * c.sell - c.seedCost));
  return plots(L) * best * checks * 1.1;
};
const hens = (L: number) =>
  L < F.COOP.level
    ? 0
    : F.COOP.hens + F.COOP.henLevels.filter((l) => l <= L).length;
const cows = (L: number) =>
  L < F.PASTURE.level
    ? 0
    : 1 + F.PASTURE.cowLevels.filter((l) => l <= L).length;
// An egg pays its price less the 2 wheat it eats (about one wheat seed, 5).
const EGG_NET = F.EGG.sell - 5;
const MILK_ROUND = F.PASTURE.milk * F.MILK.sell;

const rows = [];
for (const L of [
  9, 14, 17, 20, 24, 28, 32, 36, 40, 42, 50, 55, 60, 68, 75, 100,
]) {
  const n = ARCH.regular,
    crop = cropsDay(L, n),
    milk = cows(L) * MILK_ROUND * n,
    eggs = hens(L) * EGG_NET * n;
  rows.push({
    L,
    crops: Math.round(crop),
    cows: cows(L),
    milk,
    hens: hens(L),
    eggs,
    "animals / crops": `${Math.round(((milk + eggs) / crop) * 100)}%`,
  });
}
console.log("Regular player (4 check-ins a day), Gold Leaves a day:");
console.table(rows);
