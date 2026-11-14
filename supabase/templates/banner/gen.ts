import { creatureSvg } from "../../../apps/client/src/creature-design";
import { writeFileSync } from "fs";
const out = process.argv[2] ?? new URL(".", import.meta.url).pathname;
const cast: [string, any, any, string | null, number?][] = [
  ["voltkit", "down", "happy", null],
  ["cindrake", "right", "focus", "cindrake-blue-flame"],
  ["coilemur", "left", "hurt", "coilemur-firecracker"],
  ["tidefin", "down", "happy", "tidefin-koi-pond"],
  ["terradon", "down", "dizzy", "terradon-snowball"],
  ["mystowl", "left", "focus", "mystowl-witchs-familiar"],
  ["lumoth", "down", "happy", "lumoth-paper-lantern"],
  ["duskveil", "down", "happy", "duskveil-pumpkin-lantern"],
  ["pyranda", "right", "happy", "pyranda-harvest-moon"],
  ["auralynx", "right", "happy", "auralynx-cherry-blossom"],
];
for (const [id, dir, mood, skin, stage] of cast) {
  const svg = creatureSvg(
    id as any,
    dir,
    undefined,
    undefined,
    mood,
    skin ? { skin, stage } : null,
  );
  writeFileSync(`${out}/${id}.svg`, svg);
}
console.log("ok");
