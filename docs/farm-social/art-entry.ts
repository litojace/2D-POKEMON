// Bundles the game's own art for demo.html (see README.md for the command).
import { GFX } from "../../apps/client/src/farm/farm-gfx";
import { cropFieldSvg, cropItemSvg } from "../../apps/client/src/farm/crop-art";
import { CROPS } from "../../packages/shared/src/farm";
import { creatureSvg } from "../../apps/client/src/creature-design";
(window as unknown as { ART: unknown }).ART = {
  GFX,
  cropFieldSvg,
  cropItemSvg,
  CROPS,
  creatureSvg,
};
