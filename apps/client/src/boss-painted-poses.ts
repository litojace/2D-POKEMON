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
export function paintedPrisma(g: G, o: Look) {
  return paintWholeBoss(g, "prismatail", {
    ...o,
    y: (o.groundY ?? o.y + 60) + 9,
  });
}
export function paintedTwin(g: G, o: Look & { blue: boolean; pulse: number }) {
  return paintWholeBoss(g, "storm-twins", { ...o, y: o.y + 85 });
}
