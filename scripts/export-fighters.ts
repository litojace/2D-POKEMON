import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { FIGHTER_IDS } from "../packages/shared/src/index";
import { creatureSvg } from "../apps/client/src/creature-design";
for (const id of FIGHTER_IDS) {
  const folder = resolve("apps/client/public/assets/fighters", id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, "portrait.svg"), creatureSvg(id));
  writeFileSync(resolve(folder, "selection.svg"), creatureSvg(id));
  if (!existsSync(resolve(folder, "animations.json")))
    writeFileSync(
      resolve(folder, "animations.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          kind: "layered",
          portrait: "portrait.svg",
          selection: "selection.svg",
          artStatus:
            "Original articulated vector prototype; production rendered frames not yet supplied",
        },
        null,
        2,
      ) + "\n",
    );
}
console.log(`Exported ${FIGHTER_IDS.length} original creature asset folders.`);
