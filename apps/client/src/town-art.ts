import type Phaser from "phaser";
import { CHARACTERS } from "@arena/shared";
import { TOWN, TOWN_OBSTACLES, TOWN_PORTALS, type TownObstacle, type TownPortal } from "../../../packages/shared/src/town";
/**
 * Elemental Plaza art. The floor is painted once into a texture; props
 * (trees, pillars, stones, fountain, portals) are separate objects sorted by
 * height on screen, so fighters can walk behind them.
 */
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const num = (css: string) => parseInt(css.slice(1), 16);
/** Deterministic scatter so the floor looks the same for everyone. */
const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export function paintTownFloor(ctx: CanvasRenderingContext2D) {
  const { width: W, height: H } = TOWN,
    { x: cx, y: cy, r: R } = TOWN.plaza;
  ctx.fillStyle = "#4f6b3a";
  ctx.fillRect(0, 0, W, H);
  // Grass texture: short blades in three shades.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = ["#5b7a42", "#46612f", "#61834a"][i % 3];
    ctx.fillRect(rnd(i) * W, rnd(i + 0.5) * H, 2.5, 6);
  }
  // Flower specks.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = ["#f4d35e", "#ffb3c7", "#ffffff"][i % 3];
    ctx.beginPath();
    ctx.arc(rnd(i * 3 + 7) * W, rnd(i * 5 + 2) * H, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stone paths from the plaza to each portal.
  ctx.lineCap = "round";
  for (const p of TOWN_PORTALS) {
    for (const [w, c] of [[124, "#857c6c"], [104, "#a59b88"]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y + 10);
      ctx.stroke();
    }
    // Paving joints along the path.
    const len = Math.hypot(p.x - cx, p.y - cy),
      ux = (p.x - cx) / len,
      uy = (p.y - cy) / len;
    ctx.strokeStyle = "rgba(90,80,64,0.3)";
    ctx.lineWidth = 2;
    for (let d = R; d < len - 20; d += 34) {
      const mx = cx + ux * d,
        my = cy + uy * d;
      ctx.beginPath();
      ctx.moveTo(mx - uy * 50, my + ux * 50);
      ctx.lineTo(mx + uy * 50, my - ux * 50);
      ctx.stroke();
    }
  }
  // The plaza: rings of cobbles.
  ctx.fillStyle = "#968b76";
  ctx.beginPath();
  ctx.ellipse(cx, cy, R + 18, (R + 18) * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b3a891";
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,80,64,0.32)";
  ctx.lineWidth = 2;
  for (let ring = 60; ring < R; ring += 44) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, ring, ring * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    const n = Math.round(ring / 9);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring * 0.78);
      ctx.lineTo(cx + Math.cos(a) * Math.min(R, ring + 44), cy + Math.sin(a) * Math.min(R, ring + 44) * 0.78);
      ctx.stroke();
    }
  }
}

const shadow = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a = 0.22) =>
  g.fillStyle(0x000000, a).fillEllipse(x, y, w, h);

/** One prop, drawn into its own graphics so it sorts with the fighters. */
export function drawProp(g: Phaser.GameObjects.Graphics, o: TownObstacle, index: number) {
  const { x, y } = o;
  if (o.kind === "tree") {
    shadow(g, x + 6, y + 8, o.rx * 2.4, o.ry * 1.4);
    g.fillStyle(0x5a3e28, 1).fillRect(x - 5, y - 18, 10, 22);
    g.fillStyle(0x34502a, 1).fillCircle(x, y - 46, 36);
    g.fillStyle(0x3f5a2d, 1).fillCircle(x + 10, y - 40, 28);
    g.fillStyle(0x56763c, 1).fillCircle(x - 9, y - 54, 24);
    g.fillStyle(0x6b8f4a, 1).fillCircle(x - 14, y - 60, 11);
  } else if (o.kind === "pillar") {
    shadow(g, x + 4, y + 4, 30, 12);
    g.fillStyle(0x4a4436, 1).fillRect(x - 9, y - 84, 18, 88);
    g.fillStyle(0x625a48, 1).fillRect(x - 9, y - 84, 7, 88);
  } else if (o.kind === "stone") {
    const c = Object.values(CHARACTERS)[index % 8].color;
    shadow(g, x, y + 8, 40, 14);
    g.fillStyle(0x6e6657, 1).fillRoundedRect(x - 14, y - 30, 28, 36, 5);
    g.fillStyle(0x857c6c, 1).fillRoundedRect(x - 14, y - 30, 12, 36, { tl: 5, bl: 5, tr: 0, br: 0 });
    g.fillStyle(c, 0.95).fillCircle(x, y - 14, 7);
    g.fillStyle(0xffffff, 0.6).fillCircle(x - 2, y - 16, 2.5);
  } else {
    // Fountain: basin, water and a floating element crystal.
    shadow(g, x, y + 18, o.rx * 2.1, o.ry * 1.1, 0.25);
    g.fillStyle(0x6e6657, 1).fillEllipse(x, y + 4, o.rx * 2, o.ry * 2);
    g.fillStyle(0x857c6c, 1).fillEllipse(x, y, o.rx * 2, o.ry * 2);
    g.fillStyle(0x3a8fc2, 1).fillEllipse(x, y - 4, o.rx * 1.7, o.ry * 1.6);
    g.fillStyle(0x6cc7ec, 1).fillEllipse(x, y - 8, o.rx * 1.3, o.ry * 1.15);
    g.fillStyle(0xbfeeff, 0.7).fillEllipse(x - 20, y - 18, 30, 10);
  }
}
/** The crystal above the fountain bobs gently. */
export function drawCrystal(g: Phaser.GameObjects.Graphics, x: number, y: number, now: number) {
  const bob = Math.sin(now / 700) * 5,
    cy = y - 90 + bob;
  g.clear();
  g.fillStyle(0xfff0be, 0.22).fillCircle(x, cy, 46);
  g.fillStyle(0x000000, 0.12).fillEllipse(x, y - 10, 40 - bob, 10);
  g.fillStyle(0xe9f7ff, 1).fillTriangle(x, cy - 34, x + 22, cy, x, cy + 34);
  g.fillStyle(0xbfe8ff, 1).fillTriangle(x, cy - 34, x - 22, cy, x, cy + 34);
  g.fillStyle(0x9fd9ff, 1).fillTriangle(x, cy - 34, x + 22, cy, x + 6, cy);
}
/** A portal: a swirling doorway between its pillars, under a lintel. */
export function drawPortal(g: Phaser.GameObjects.Graphics, p: TownPortal, now: number) {
  const c = num(p.color),
    pulse = 0.8 + Math.sin(now / 500 + p.x) * 0.2,
    { x, y } = p;
  g.clear();
  // Light spilling onto the path.
  g.fillStyle(c, 0.16 * pulse).fillEllipse(x, y + 6, 150, 40);
  // The doorway: a dark core with the element colour swirling into it.
  g.fillStyle(0x10121c, 0.92).fillRoundedRect(x - 38, y - 80, 76, 84, { tl: 38, tr: 38, bl: 0, br: 0 });
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.22,
      spin = now / (900 - i * 120) + i * 1.7;
    g.lineStyle(4 - i * 0.6, c, 0.85 - i * 0.15);
    g.beginPath();
    g.arc(x, y - 38, 30 * k, spin, spin + Math.PI * 1.3);
    g.strokePath();
  }
  g.fillStyle(c, 0.3 * pulse).fillCircle(x, y - 38, 14);
  g.fillStyle(0xffffff, 0.8 * pulse).fillCircle(x, y - 38, 4);
  g.lineStyle(3, c, 0.9).strokeRoundedRect(x - 38, y - 80, 76, 84, { tl: 38, tr: 38, bl: 0, br: 0 });
  g.fillStyle(0x4a4436, 1).fillRect(x - 66, y - 98, 132, 20);
  g.fillStyle(0x625a48, 1).fillRect(x - 66, y - 98, 132, 7);
  g.fillStyle(c, 1).fillCircle(x, y - 88, 5);
}
export { hex };
