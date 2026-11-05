/**
 * Write tuned duel factors into the champions' own numbers in
 * packages/shared/src/index.ts: health × f and basic-attack interval ÷ √f
 * (rounded to 5 ms), the same as factors.ts applies during a round robin.
 *
 *   npx tsx scripts/balance/apply-factors.ts <factors.json>
 *
 * Prints each change. Champions whose numbers do not move are left alone.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  CHARACTERS,
  type CharacterId,
} from "../../packages/shared/src/index.ts";
import { scaled } from "./factors.ts";

const file = "packages/shared/src/index.ts";
const factors: Record<string, number> = JSON.parse(
  readFileSync(process.argv[2], "utf8"),
);
let src = readFileSync(file, "utf8");
for (const [id, f] of Object.entries(factors)) {
  const c = CHARACTERS[id as CharacterId];
  if (!c) continue;
  const ms = Math.round((c.basic.interval ?? 0) * 1000);
  const s = scaled(c.health, ms, f);
  // The champion's block: from `id: "<id>",` to its basic() call's interval.
  const start = src.indexOf(`    id: "${id}",`);
  if (start < 0) throw new Error(`no block for ${id}`);
  const health = src.indexOf(`    health: ${c.health},`, start);
  const basicAt = src.indexOf("    basic: basic(", start);
  if (health < 0 || basicAt < 0 || health > basicAt)
    throw new Error(`no health/basic for ${id}`);
  // basic(id, name, kind, damage, intervalMs, ...): the fifth argument.
  const args = src.slice(basicAt).split("\n").slice(1, 6);
  const intervalLine = args[4];
  if (intervalLine.trim() !== `${ms},`)
    throw new Error(`${id}: expected interval ${ms}, found ${intervalLine}`);
  const lineStart =
    basicAt + src.slice(basicAt).split("\n").slice(0, 5).join("\n").length + 1;
  src =
    src.slice(0, lineStart) +
    intervalLine.replace(`${ms},`, `${s.intervalMs},`) +
    src.slice(lineStart + intervalLine.length);
  src =
    src.slice(0, health) +
    `    health: ${s.health},` +
    src.slice(health + `    health: ${c.health},`.length);
  console.log(
    `${id.padEnd(10)} ×${f}  health ${c.health} → ${s.health}, basic ${ms} → ${s.intervalMs} ms`,
  );
}
writeFileSync(file, src);
