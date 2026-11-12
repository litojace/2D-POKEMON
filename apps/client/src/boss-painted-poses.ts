import type Phaser from "phaser";
import type { BossLifePose } from "./raid-boss-life";
import { paintWholeBoss } from "./boss-painted-rig";
type G = Phaser.GameObjects.Graphics;
interface Look {
  x: number;
  y: number;
  groundX?: number;
  groundY?: number;
  life: BossLifePose;
  alpha?: number;
  gilded?: boolean;
  hurt?: boolean;
  exposed?: boolean;
  dead?: boolean;
  key?: string;
  stagger?: boolean;
}
export function paintedGloom(
  g: G,
  o: Look & { facing: number; flicker: boolean; motion: number },
) {
  return paintWholeBoss(g, "gloomshade", { ...o, y: o.y + 46 });
}
export function paintedSomnara(g: G, o: Look) {
  return paintWholeBoss(g, "somnara", { ...o, y: o.y + 72 });
}
export function paintedEmber(g: G, o: Look & { flight: number }) {
  return paintWholeBoss(g, "emberwing", {
    ...o,
    y: o.flight < 0.1 && o.groundY !== undefined ? o.groundY + 12 : o.y + 76,
  });
}
export function paintedTwin(g: G, o: Look & { blue: boolean; pulse: number }) {
  return paintWholeBoss(g, "storm-twins", { ...o, y: o.y + 85 });
}
