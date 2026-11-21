import type Phaser from "phaser";
import type { FxParticle } from "./skin-fx";

/**
 * The two collection pieces a match's rig draws itself rather than
 * collection-fx.ts: Mountainborn's pebble burst (an entrance) and Rockslide
 * Flex's rock pile (a victory). Places with no rig (the item thumbnails,
 * the Plaza) draw these stand-ins. `x`, `ground`: where the feet meet the
 * ground; `sc`: the drawing's scale (a rig unit).
 */
export function rigEntrance(
  emit: (p: FxParticle) => void,
  id: string,
  x: number,
  ground: number,
  sc = 1,
) {
  if (id !== "mountainborn") return false;
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI * (0.1 + Math.random() * 0.8);
    const speed = 90 + Math.random() * 150;
    emit({
      x: x + (Math.random() - 0.5) * 30 * sc,
      y: ground,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 60,
      life: 0.8 + Math.random() * 0.4,
      size: (2.5 + Math.random() * 2.5) * sc,
      color: [0x8a7a68, 0xa99782, 0x6f6152, 0xffc46b][i % 4],
      shape: "pebble",
    });
  }
  return true;
}
/** A pile of rocks rises under the fighter, `t` seconds into the finale. */
export function rigVictory(
  g: Phaser.GameObjects.Graphics,
  id: string,
  x: number,
  ground: number,
  sc: number,
  t: number,
) {
  if (id !== "rockslide-flex") return false;
  const rise = Math.min(1, t / 0.35);
  for (let i = 0; i < 7; i++) {
    const px = x + (i - 3) * 16 * sc,
      h = (18 + (3 - Math.abs(i - 3)) * 9) * rise * sc;
    g.fillStyle(i % 2 ? 0x8a7458 : 0x6f5c45, 1).fillTriangle(
      px - 14 * sc,
      ground,
      px + 14 * sc,
      ground,
      px,
      ground - h,
    );
  }
  return true;
}
