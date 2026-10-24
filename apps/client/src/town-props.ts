import { rnd, type Ctx, type Sprite } from "./town-art";

/**
 * Street furniture and shops for Elemental Plaza, in the same ¾ view as the
 * buildings: fronts stand upright, tops are seen from above, light comes
 * from the upper left (shaded faces on the right) and each piece stands on
 * a footing so it meets the ground. Every sprite keeps the anchor its
 * obstacle expects: lamps keep the lantern where the glow sits (108 above
 * the foot) and plaza stones keep their gem socket 32 above the foot.
 */

const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
};
const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
/** A horizontal gradient across [x0, x1] (lit left, shaded right). */
const across = (ctx: Ctx, x0: number, x1: number, stops: string[]) => {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
const down = (ctx: Ctx, y0: number, y1: number, stops: string[]) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
const poly = (ctx: Ctx, pts: number[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
};
const line = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 1) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const WOOD = { light: "#c49a66", mid: "#a47a4a", dark: "#7a5532", deep: "#523820", line: "rgba(60,36,16,0.35)" };
const IRON = ["#5d6673", "#343a44", "#1d2129"];
const STONE = { top: "#d9cfba", light: "#c4b89c", mid: "#a89c80", dark: "#7e735c", line: "rgba(70,58,40,0.35)" };

/** A plank-faced wooden box: top face from y−depth to y, front from y to y+h. */
function crateBox(ctx: Ctx, x: number, y: number, w: number, h: number, depth: number, seed: number) {
  // Top.
  ctx.fillStyle = down(ctx, y - depth, y, [WOOD.light, "#b88c58"]);
  ctx.fillRect(x, y - depth, w, depth);
  for (let k = 1; k < 3; k++) line(ctx, x, y - depth + (depth * k) / 3, x + w, y - depth + (depth * k) / 3, WOOD.line);
  // Front planks.
  ctx.fillStyle = across(ctx, x, x + w, [WOOD.mid, WOOD.dark]);
  ctx.fillRect(x, y, w, h);
  const planks = Math.max(2, Math.round(h / 11));
  for (let k = 1; k < planks; k++) line(ctx, x, y + (h * k) / planks, x + w, y + (h * k) / planks, WOOD.line);
  for (let k = 0; k < planks; k++) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + rnd(seed + k) * 0.05})`;
    ctx.fillRect(x + 2, y + (h * k) / planks + 1, w - 4, 2);
  }
  // Corner battens and a diagonal brace.
  ctx.fillStyle = WOOD.deep;
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.strokeStyle = WOOD.deep;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 3);
  ctx.lineTo(x + w - 4, y + 3);
  ctx.stroke();
  ctx.fillStyle = "#3a3228";
  for (const [nx, ny] of [[x + 2, y + 2], [x + w - 2, y + 2], [x + 2, y + h - 2], [x + w - 2, y + h - 2]]) {
    ellipse(ctx, nx, ny, 1.2, 1.2);
    ctx.fill();
  }
  // Edge between top and front catches the light.
  line(ctx, x, y, x + w, y, "rgba(255,240,210,0.5)");
}

/** An upright barrel with iron hoops; (cx, foot) is the middle of its base. */
function barrel(ctx: Ctx, cx: number, foot: number, r: number, h: number) {
  const top = foot - h;
  ctx.fillStyle = across(ctx, cx - r, cx + r, ["#8a5a32", "#b07a46", "#7a4c28", "#5a361c"]);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.9, top);
  ctx.quadraticCurveTo(cx - r * 1.08, (top + foot) / 2, cx - r * 0.9, foot);
  ctx.ellipse(cx, foot, r * 0.9, r * 0.3, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r * 0.9, foot);
  ctx.quadraticCurveTo(cx + r * 1.08, (top + foot) / 2, cx + r * 0.9, top);
  ctx.closePath();
  ctx.fill();
  // Staves.
  for (let k = -2; k <= 2; k++) line(ctx, cx + k * r * 0.34, top + 2, cx + k * r * 0.36, foot - 1, "rgba(50,28,12,0.3)");
  // Hoops.
  for (const t of [0.14, 0.42, 0.62, 0.9]) {
    const y = top + h * t,
      w = r * (0.9 + 0.18 * Math.sin(Math.PI * t));
    ctx.strokeStyle = "#3b3f46";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, y, w, r * 0.3, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, y - 1, w, r * 0.3, 0, Math.PI * 0.55, Math.PI * 0.95);
    ctx.stroke();
  }
  // Lid.
  ctx.fillStyle = "#b8895a";
  ellipse(ctx, cx, top, r * 0.9, r * 0.3);
  ctx.fill();
  ctx.strokeStyle = "#3b3f46";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  line(ctx, cx - r * 0.6, top - 1, cx + r * 0.6, top + 1, "rgba(80,50,24,0.4)");
}

/** A burlap sack slumped on the ground. */
function sack(ctx: Ctx, cx: number, foot: number, s: number) {
  ctx.fillStyle = across(ctx, cx - 14 * s, cx + 14 * s, ["#e2cc98", "#c9ae76", "#a68a56"]);
  ctx.beginPath();
  ctx.moveTo(cx - 14 * s, foot);
  ctx.quadraticCurveTo(cx - 17 * s, foot - 18 * s, cx - 7 * s, foot - 26 * s);
  ctx.lineTo(cx - 4 * s, foot - 32 * s);
  ctx.lineTo(cx + 5 * s, foot - 31 * s);
  ctx.lineTo(cx + 7 * s, foot - 25 * s);
  ctx.quadraticCurveTo(cx + 17 * s, foot - 16 * s, cx + 14 * s, foot);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6a3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 7 * s, foot - 25 * s);
  ctx.quadraticCurveTo(cx, foot - 22 * s, cx + 7 * s, foot - 25 * s);
  ctx.stroke();
  for (let k = 0; k < 3; k++) line(ctx, cx - 9 * s + k * 7 * s, foot - 14 * s, cx - 6 * s + k * 7 * s, foot - 4 * s, "rgba(120,90,50,0.35)");
}

/** A round stone footing seen from above-front (top ellipse + a short front band). */
function footing(ctx: Ctx, cx: number, foot: number, rx: number, h: number) {
  const ry = rx * 0.36;
  ctx.fillStyle = across(ctx, cx - rx, cx + rx, [STONE.light, STONE.mid, STONE.dark]);
  ctx.beginPath();
  ctx.ellipse(cx, foot - ry, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, foot - ry - h);
  ctx.ellipse(cx, foot - ry - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = STONE.top;
  ellipse(ctx, cx, foot - ry - h, rx, ry);
  ctx.fill();
  ctx.strokeStyle = STONE.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function propSprite(kind: string): Sprite {
  switch (kind) {
    case "lamp":
      // Cast-iron street lamp. Foot at (32, 146); lantern centre 108 above it.
      return {
        w: 64,
        h: 152,
        ax: 32,
        ay: 146,
        draw(ctx) {
          const cx = 32,
            foot = 146;
          footing(ctx, cx, foot, 15, 5);
          // Stepped iron base.
          ctx.fillStyle = across(ctx, cx - 11, cx + 11, IRON);
          poly(ctx, [cx - 11, foot - 12, cx + 11, foot - 12, cx + 8, foot - 22, cx - 8, foot - 22]);
          ctx.fill();
          ctx.fillStyle = across(ctx, cx - 7, cx + 7, IRON);
          poly(ctx, [cx - 7, foot - 22, cx + 7, foot - 22, cx + 4, foot - 34, cx - 4, foot - 34]);
          ctx.fill();
          // Fluted post, tapering upward.
          ctx.fillStyle = across(ctx, cx - 4, cx + 4, IRON);
          poly(ctx, [cx - 4, foot - 34, cx + 4, foot - 34, cx + 3, foot - 92, cx - 3, foot - 92]);
          ctx.fill();
          line(ctx, cx - 1, foot - 36, cx - 1, foot - 90, "rgba(255,255,255,0.18)");
          // Collars.
          for (const y of [foot - 34, foot - 60, foot - 92]) {
            ctx.fillStyle = across(ctx, cx - 6, cx + 6, IRON);
            rr(ctx, cx - 6, y - 3, 12, 5, 2);
            ctx.fill();
          }
          // Scroll brackets under the lantern.
          ctx.strokeStyle = IRON[1];
          ctx.lineWidth = 2.2;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx, foot - 86);
            ctx.bezierCurveTo(cx + s * 4, foot - 92, cx + s * 14, foot - 88, cx + s * 12, foot - 96);
            ctx.stroke();
            ellipse(ctx, cx + s * 10.5, foot - 95.5, 2, 2);
            ctx.stroke();
          }
          // Lantern: tapered glass box with a frame, cap and finial.
          const lt = foot - 124,
            lb = foot - 96;
          ctx.fillStyle = IRON[2];
          poly(ctx, [cx - 8, lb, cx + 8, lb, cx + 5, lb + 5, cx - 5, lb + 5]);
          ctx.fill();
          const glow = ctx.createRadialGradient(cx - 2, (lt + lb) / 2, 1, cx, (lt + lb) / 2, 14);
          glow.addColorStop(0, "#fffbe8");
          glow.addColorStop(0.5, "#ffe39a");
          glow.addColorStop(1, "#f2b452");
          ctx.fillStyle = glow;
          poly(ctx, [cx - 11, lt, cx + 11, lt, cx + 8, lb, cx - 8, lb]);
          ctx.fill();
          // Frame bars and panes.
          ctx.strokeStyle = IRON[1];
          ctx.lineWidth = 2;
          poly(ctx, [cx - 11, lt, cx + 11, lt, cx + 8, lb, cx - 8, lb]);
          ctx.stroke();
          line(ctx, cx, lt, cx, lb, IRON[1], 1.6);
          line(ctx, cx - 10, lt + 13, cx + 10, lt + 13, IRON[1], 1.2);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          poly(ctx, [cx - 8, lt + 2, cx - 5, lt + 2, cx - 6, lb - 3, cx - 7, lb - 3]);
          ctx.fill();
          // Cap.
          ctx.fillStyle = across(ctx, cx - 14, cx + 14, IRON);
          poly(ctx, [cx - 14, lt + 1, cx + 14, lt + 1, cx + 6, lt - 9, cx - 6, lt - 9]);
          ctx.fill();
          ctx.fillStyle = IRON[1];
          rr(ctx, cx - 7, lt - 12, 14, 4, 2);
          ctx.fill();
          ellipse(ctx, cx, lt - 15, 2.6, 2.6);
          ctx.fill();
          line(ctx, cx - 13, lt + 1, cx + 13, lt + 1, "rgba(255,255,255,0.25)");
        },
      };
    case "stone":
      // Carved bollard around the fountain; the gem (drawn live) sits 32 above the foot.
      return {
        w: 48,
        h: 64,
        ax: 24,
        ay: 58,
        draw(ctx) {
          const cx = 24,
            foot = 58;
          footing(ctx, cx, foot, 18, 4);
          // Body: a rounded-top post.
          ctx.fillStyle = across(ctx, cx - 12, cx + 12, [STONE.top, STONE.light, STONE.mid, STONE.dark]);
          ctx.beginPath();
          ctx.moveTo(cx - 12, foot - 10);
          ctx.lineTo(cx - 12, foot - 40);
          ctx.quadraticCurveTo(cx - 12, foot - 52, cx, foot - 53);
          ctx.quadraticCurveTo(cx + 12, foot - 52, cx + 12, foot - 40);
          ctx.lineTo(cx + 12, foot - 10);
          ctx.ellipse(cx, foot - 10, 12, 4, 0, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
          // A band and the gem socket.
          ctx.fillStyle = "rgba(70,58,40,0.18)";
          ctx.fillRect(cx - 12, foot - 18, 24, 3);
          ctx.fillStyle = "#6f6450";
          ellipse(ctx, cx, foot - 32, 9.5, 9.5);
          ctx.fill();
          ctx.fillStyle = "#4d4436";
          ellipse(ctx, cx + 1, foot - 31, 8, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,248,230,0.45)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, foot - 32, 9.5, Math.PI * 0.9, Math.PI * 1.6);
          ctx.stroke();
          // Weathering.
          ctx.fillStyle = "rgba(110,140,80,0.35)";
          ellipse(ctx, cx - 7, foot - 13, 4, 2);
          ctx.fill();
        },
      };
    case "crates":
      // A stack of crates, a barrel and a sack (obstacle box 60×30; foot = its front edge).
      return {
        w: 120,
        h: 104,
        ax: 60,
        ay: 96,
        draw(ctx) {
          crateBox(ctx, 10, 58, 46, 38, 12, 1);
          crateBox(ctx, 16, 26, 34, 28, 10, 4);
          barrel(ctx, 80, 92, 15, 46);
          sack(ctx, 102, 97, 0.85);
        },
      };
    case "well":
      // Round stone well with a shingled roof, winch and bucket.
      return {
        w: 124,
        h: 156,
        ax: 62,
        ay: 146,
        draw(ctx) {
          const cx = 62,
            foot = 146,
            rx = 42,
            ry = 15,
            rimY = 104;
          // Back of the rim (seen inside), then the water.
          ctx.fillStyle = STONE.dark;
          ellipse(ctx, cx, rimY, rx, ry);
          ctx.fill();
          ctx.fillStyle = down(ctx, rimY - ry, rimY + ry, ["#1c2c3a", "#2c4a5e"]);
          ellipse(ctx, cx, rimY + 2, rx - 8, ry - 5);
          ctx.fill();
          ctx.fillStyle = "rgba(190,230,255,0.35)";
          ellipse(ctx, cx - 10, rimY + 1, 9, 2);
          ctx.fill();
          // Posts behind the wall's front.
          for (const px of [cx - 34, cx + 34]) {
            ctx.fillStyle = across(ctx, px - 4, px + 4, [WOOD.light, WOOD.dark]);
            ctx.fillRect(px - 4, 44, 8, rimY - 40);
          }
          // Winch: axle, rope, bucket and crank.
          ctx.fillStyle = down(ctx, 62, 72, [WOOD.light, WOOD.deep]);
          rr(ctx, cx - 30, 62, 60, 10, 5);
          ctx.fill();
          ctx.fillStyle = "#c9b088";
          for (let k = 0; k < 6; k++) ctx.fillRect(cx - 9 + k * 3, 62, 2, 10);
          line(ctx, cx, 72, cx, 86, "#8a7350", 1.5);
          ctx.fillStyle = across(ctx, cx - 7, cx + 7, ["#9a7048", "#6a4628"]);
          poly(ctx, [cx - 7, 86, cx + 7, 86, cx + 5, 97, cx - 5, 97]);
          ctx.fill();
          line(ctx, cx - 7, 89, cx + 7, 89, "#3b3f46", 1.6);
          ctx.strokeStyle = "#3b3f46";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + 34, 67);
          ctx.lineTo(cx + 42, 67);
          ctx.lineTo(cx + 42, 76);
          ctx.stroke();
          // Front wall of the well: a curved band of stones.
          const wallH = foot - rimY - ry * 0.4;
          ctx.fillStyle = across(ctx, cx - rx, cx + rx, [STONE.light, STONE.mid, STONE.mid, STONE.dark]);
          ctx.beginPath();
          ctx.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI);
          ctx.lineTo(cx - rx, rimY + wallH);
          ctx.ellipse(cx, rimY + wallH, rx, ry, 0, Math.PI, 0, true);
          ctx.closePath();
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = STONE.line;
          ctx.lineWidth = 1;
          for (let r = 1; r < 4; r++) {
            ctx.beginPath();
            ctx.ellipse(cx, rimY + (wallH * r) / 4, rx, ry, 0, 0, Math.PI);
            ctx.stroke();
          }
          for (let r = 0; r < 4; r++)
            for (let k = 0; k < 7; k++) {
              const a = Math.PI * ((k + (r % 2) * 0.5) / 7),
                x = cx + Math.cos(a) * rx,
                y = rimY + (wallH * r) / 4 + Math.sin(a) * ry;
              line(ctx, x, y, x, y + wallH / 4, STONE.line);
            }
          ctx.restore();
          // Rim cap.
          ctx.strokeStyle = STONE.top;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(cx, rimY, rx - 2, ry - 1, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = STONE.line;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(cx, rimY, rx + 1, ry + 2, 0, 0, Math.PI);
          ctx.stroke();
          // Roof: gable over the posts, front slope seen from above.
          const roofL = cx - 50,
            roofR = cx + 50,
            eave = 50,
            ridge = 18;
          ctx.fillStyle = down(ctx, ridge, eave, ["#b9584a", "#8f3c32"]);
          poly(ctx, [roofL + 6, ridge, roofR - 6, ridge, roofR, eave, roofL, eave]);
          ctx.fill();
          ctx.save();
          ctx.clip();
          for (let r = 1; r < 4; r++) {
            const y = ridge + ((eave - ridge) * r) / 4;
            line(ctx, roofL + 6 - (6 * r) / 4, y, roofR - 6 + (6 * r) / 4, y, "rgba(60,20,16,0.35)");
            for (let k = 0; k < 9; k++) {
              const x = roofL + 8 + k * 11 + (r % 2) * 5;
              line(ctx, x, y - (eave - ridge) / 4, x, y, "rgba(60,20,16,0.25)");
            }
          }
          ctx.restore();
          ctx.fillStyle = "#6e2c24";
          ctx.fillRect(roofL, eave, roofR - roofL, 4);
          ctx.fillStyle = "#d77a62";
          rr(ctx, roofL + 4, ridge - 4, roofR - roofL - 8, 6, 3);
          ctx.fill();
        },
      };
    case "dummy":
      // Straw training dummy on a stake.
      return {
        w: 80,
        h: 124,
        ax: 40,
        ay: 116,
        draw(ctx) {
          const cx = 40,
            foot = 116;
          // Dirt mound and stake.
          ctx.fillStyle = "#8a6a44";
          ellipse(ctx, cx, foot - 3, 14, 5);
          ctx.fill();
          ctx.fillStyle = across(ctx, cx - 3, cx + 3, [WOOD.light, WOOD.deep]);
          ctx.fillRect(cx - 3, foot - 40, 6, 38);
          // Crossbar arms with straw ends.
          ctx.fillStyle = down(ctx, 50, 56, [WOOD.light, WOOD.dark]);
          rr(ctx, cx - 30, 50, 60, 6, 3);
          ctx.fill();
          const straw = (x: number, y: number, dir: number) => {
            for (let k = 0; k < 7; k++) line(ctx, x, y + (k - 3) * 1.6, x + dir * (8 + rnd(k + x) * 5), y + (k - 3) * 2.6, k % 2 ? "#e6c66a" : "#c9a24a", 1.4);
          };
          straw(cx - 30, 53, -1);
          straw(cx + 30, 53, 1);
          // Burlap body, bound with rope.
          const body = ctx.createRadialGradient(cx - 6, 62, 2, cx, 70, 24);
          body.addColorStop(0, "#e9d4a0");
          body.addColorStop(0.6, "#cfb27a");
          body.addColorStop(1, "#a68a56");
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(cx - 14, 46);
          ctx.quadraticCurveTo(cx - 22, 70, cx - 14, 90);
          ctx.lineTo(cx + 14, 90);
          ctx.quadraticCurveTo(cx + 22, 70, cx + 14, 46);
          ctx.closePath();
          ctx.fill();
          for (let k = 0; k < 9; k++) line(ctx, cx - 14 + k * 3.5, 48, cx - 15 + k * 3.7, 88, "rgba(140,110,60,0.25)");
          for (const y of [52, 86]) {
            ctx.strokeStyle = "#7a5a32";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx - 16, y);
            ctx.quadraticCurveTo(cx, y + 3, cx + 16, y);
            ctx.stroke();
          }
          // Painted target.
          for (const [r, c] of [[10, "#f4ead2"], [7.5, "#c43c2a"], [5, "#f4ead2"], [2.6, "#c43c2a"]] as const) {
            ctx.fillStyle = c;
            ellipse(ctx, cx, 69, r, r * 0.95);
            ctx.fill();
          }
          // Straw spilling at the bottom and neck.
          for (let k = 0; k < 9; k++) line(ctx, cx - 12 + k * 3, 90, cx - 13 + k * 3.2 + (rnd(k) - 0.5) * 4, 96 + rnd(k + 9) * 4, k % 2 ? "#e6c66a" : "#c9a24a", 1.3);
          // Sack head tied at the neck.
          const head = ctx.createRadialGradient(cx - 4, 28, 2, cx, 32, 15);
          head.addColorStop(0, "#efdcaa");
          head.addColorStop(1, "#b39565");
          ctx.fillStyle = head;
          ellipse(ctx, cx, 32, 13, 14);
          ctx.fill();
          ctx.strokeStyle = "#7a5a32";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - 8, 45);
          ctx.lineTo(cx + 8, 45);
          ctx.stroke();
          for (let k = 0; k < 5; k++) line(ctx, cx - 4 + k * 2, 18, cx - 6 + k * 3, 12 + rnd(k + 3) * 3, "#d9b860", 1.3);
          // Stitched face.
          ctx.strokeStyle = "#5a3e22";
          ctx.lineWidth = 1.6;
          for (const ex of [cx - 5, cx + 5]) {
            line(ctx, ex - 2.5, 29, ex + 2.5, 34, "#5a3e22", 1.6);
            line(ctx, ex + 2.5, 29, ex - 2.5, 34, "#5a3e22", 1.6);
          }
          ctx.beginPath();
          ctx.moveTo(cx - 5, 39);
          ctx.quadraticCurveTo(cx, 41, cx + 5, 39);
          ctx.stroke();
        },
      };
    case "mirror":
      // The Wardrobe's standing mirror: an oval glass in a gilded frame, on a carved wooden stand.
      return {
        w: 104,
        h: 176,
        ax: 52,
        ay: 168,
        draw(ctx) {
          const cx = 52,
            foot = 168,
            my = 76;
          // Feet: two runners going back, seen from above.
          for (const s of [-1, 1]) {
            ctx.fillStyle = down(ctx, foot - 14, foot, [WOOD.mid, WOOD.deep]);
            poly(ctx, [cx + s * 30 - 5, foot, cx + s * 30 + 5, foot, cx + s * 26 + 4, foot - 14, cx + s * 26 - 4, foot - 14]);
            ctx.fill();
          }
          // Uprights with turned finials.
          for (const s of [-1, 1]) {
            const px = cx + s * 29;
            ctx.fillStyle = across(ctx, px - 4, px + 4, [WOOD.light, WOOD.dark]);
            ctx.fillRect(px - 3.5, 52, 7, foot - 60);
            ctx.fillStyle = across(ctx, px - 6, px + 6, [WOOD.light, WOOD.dark]);
            ellipse(ctx, px, 50, 5, 5);
            ctx.fill();
            rr(ctx, px - 5, foot - 22, 10, 6, 2);
            ctx.fill();
          }
          // Crossbar low between the uprights.
          ctx.fillStyle = down(ctx, foot - 30, foot - 25, [WOOD.light, WOOD.dark]);
          ctx.fillRect(cx - 26, foot - 30, 52, 5);
          // Gilded oval frame.
          const gold = ctx.createLinearGradient(cx - 26, my - 60, cx + 26, my + 60);
          gold.addColorStop(0, "#fff0b0");
          gold.addColorStop(0.35, "#e8b84a");
          gold.addColorStop(0.7, "#b8862a");
          gold.addColorStop(1, "#7a5418");
          ctx.fillStyle = gold;
          ellipse(ctx, cx, my, 25, 58);
          ctx.fill();
          // Glass: a sky-and-grass reflection with a bright streak.
          const glass = down(ctx, my - 50, my + 50, ["#dff4ff", "#a6d6ef", "#8cc4e0", "#7fb46a", "#5f9a4c"]);
          ctx.fillStyle = glass;
          ellipse(ctx, cx, my, 19.5, 51);
          ctx.fill();
          ctx.save();
          ellipse(ctx, cx, my, 19.5, 51);
          ctx.clip();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          poly(ctx, [cx - 16, my - 10, cx - 6, my - 40, cx - 1, my - 40, cx - 11, my - 10]);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          poly(ctx, [cx - 6, my + 6, cx + 4, my - 22, cx + 7, my - 22, cx - 3, my + 6]);
          ctx.fill();
          ctx.restore();
          // Pivot knobs and a little crest.
          for (const s of [-1, 1]) {
            ctx.fillStyle = "#e8b84a";
            ellipse(ctx, cx + s * 27, my, 3.5, 3.5);
            ctx.fill();
          }
          ctx.fillStyle = gold;
          poly(ctx, [cx, my - 72, cx + 7, my - 60, cx, my - 55, cx - 7, my - 60]);
          ctx.fill();
          ctx.strokeStyle = "rgba(90,60,16,0.5)";
          ctx.lineWidth = 1;
          ellipse(ctx, cx, my, 25, 58);
          ctx.stroke();
        },
      };
    case "obelisk":
      // The Champions' Obelisk, turned so two faces catch the light.
      return {
        w: 116,
        h: 322,
        ax: 58,
        ay: 312,
        draw(ctx) {
          const cx = 58,
            foot = 312;
          // A round, three-tier plinth (like the tower's and the fountain's),
          // each tier's top face visible from above.
          const tier = (bottomCentre: number, rx: number, h: number) => {
            const ry = rx * 0.36;
            footing(ctx, cx, bottomCentre + ry, rx, h);
            return bottomCentre - h;
          };
          let top1 = tier(foot - 54 * 0.36, 54, 12);
          top1 = tier(top1, 43, 12);
          top1 = tier(top1, 32, 14);
          const base = top1 - 4;
          // Shaft: a square rotated 45°, left face lit, right face in shade.
          const bw = 22,
            tw = 13,
            top = 52;
          ctx.fillStyle = down(ctx, top, base, ["#b9b2d4", "#9890b8"]);
          poly(ctx, [cx - bw, base, cx, base + 6, cx, top + 4, cx - tw, top]);
          ctx.fill();
          ctx.fillStyle = down(ctx, top, base, ["#6e6890", "#4e4870"]);
          poly(ctx, [cx, base + 6, cx + bw, base, cx + tw, top, cx, top + 4]);
          ctx.fill();
          line(ctx, cx, top + 4, cx, base + 6, "rgba(255,255,255,0.35)", 1.2);
          // Engraved names on the lit face, a gold emblem near the top.
          ctx.fillStyle = "rgba(255,226,140,0.75)";
          for (let k = 0; k < 8; k++) {
            const y = 100 + k * 18,
              t = (y - top) / (base - top),
              half = tw + (bw - tw) * t;
            ctx.fillRect(cx - half + 5, y, half - 9 - (k % 3) * 2, 2.4);
          }
          ctx.fillStyle = "#ffe08a";
          poly(ctx, [cx - 8, 76, cx - 3, 68, cx, 76, cx - 3, 84]);
          ctx.fill();
          // Gold pyramidion.
          ctx.fillStyle = "#ffe9a0";
          poly(ctx, [cx - tw, top, cx, top + 4, cx, 18]);
          ctx.fill();
          ctx.fillStyle = "#c9962c";
          poly(ctx, [cx, top + 4, cx + tw, top, cx, 18]);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ellipse(ctx, cx - 3, 26, 2, 4);
          ctx.fill();
        },
      };
    case "board":
      // Notice Board: a roofed board on two posts in stone footings (obstacle box 280×30).
      return {
        w: 336,
        h: 232,
        ax: 168,
        ay: 222,
        draw(ctx) {
          const cx = 168,
            foot = 222,
            L = 34,
            R = 302;
          // Posts in footings.
          for (const px of [L + 6, R - 6]) {
            footing(ctx, px, foot, 13, 6);
            ctx.fillStyle = across(ctx, px - 6, px + 6, [WOOD.light, WOOD.mid, WOOD.deep]);
            ctx.fillRect(px - 6, 44, 12, foot - 56);
          }
          // Board: a frame with depth, cork-brown panel inside.
          const by = 66,
            bh = 106;
          ctx.fillStyle = WOOD.light;
          ctx.fillRect(L - 4, by - 8, R - L + 8, 8);
          ctx.fillStyle = across(ctx, L, R, [WOOD.mid, WOOD.dark]);
          ctx.fillRect(L - 4, by, R - L + 8, bh);
          ctx.fillStyle = down(ctx, by, by + bh, ["#b98d5c", "#9c7246"]);
          ctx.fillRect(L + 6, by + 8, R - L - 12, bh - 16);
          ctx.fillStyle = "rgba(60,36,16,0.25)";
          ctx.fillRect(L + 6, by + 8, R - L - 12, 4);
          for (let k = 0; k < 80; k++) {
            ctx.fillStyle = `rgba(70,40,16,${0.08 + rnd(k) * 0.1})`;
            ctx.fillRect(L + 8 + rnd(k + 1) * (R - L - 16), by + 10 + rnd(k + 2) * (bh - 20), 2, 2);
          }
          // Pinned notices.
          const notes = ["#fff8e6", "#eaffde", "#fff1c0", "#e9eeff", "#ffe6ee", "#fffbea"];
          for (let k = 0; k < 7; k++) {
            ctx.save();
            ctx.translate(L + 22 + k * 36, by + 16 + (k % 2) * 34 + rnd(k + 5) * 6);
            ctx.rotate((rnd(k) - 0.5) * 0.22);
            ctx.fillStyle = "rgba(40,24,8,0.25)";
            ctx.fillRect(2, 2, 28, 34);
            ctx.fillStyle = notes[k % notes.length];
            ctx.fillRect(0, 0, 28, 34);
            ctx.fillStyle = "rgba(60,40,20,0.45)";
            ctx.fillRect(4, 7, 20, 2.5);
            for (let l = 0; l < 4; l++) ctx.fillRect(4, 13 + l * 5, 18 - (l % 2) * 6, 1.6);
            ctx.fillStyle = ["#c43c2a", "#2a6ac4", "#2a9a4a"][k % 3];
            ellipse(ctx, 14, 2.5, 2.8, 2.8);
            ctx.fill();
            ctx.restore();
          }
          // Shingled roof, front slope seen from above.
          const ridge = 16,
            eave = 54;
          ctx.fillStyle = down(ctx, ridge, eave, ["#5f9a56", "#3f7240"]);
          poly(ctx, [L - 4, ridge, R + 4, ridge, R + 18, eave, L - 18, eave]);
          ctx.fill();
          ctx.save();
          ctx.clip();
          for (let r = 1; r < 4; r++) {
            const y = ridge + ((eave - ridge) * r) / 4,
              inset = 14 * (1 - r / 4);
            line(ctx, L - 18 + inset, y, R + 18 - inset, y, "rgba(20,50,20,0.35)");
            for (let k = 0; k < 24; k++) {
              const x = L - 10 + k * 13 + (r % 2) * 6;
              line(ctx, x, y - (eave - ridge) / 4, x, y, "rgba(20,50,20,0.22)");
            }
          }
          ctx.restore();
          ctx.fillStyle = "#2f5a30";
          ctx.fillRect(L - 18, eave, R - L + 36, 5);
          ctx.fillStyle = "#7fb872";
          rr(ctx, L - 6, ridge - 5, R - L + 12, 7, 3);
          ctx.fill();
          // Shade under the eave on the board.
          ctx.fillStyle = "rgba(30,20,8,0.22)";
          ctx.fillRect(L - 4, by - 8, R - L + 8, 10);
          void cx;
        },
      };
  }
  throw new Error(`No prop ${kind}`);
}

/** Goods laid out on a stall counter, by shop: gems, potions or folded cloth. */
function stallGoods(ctx: Ctx, kind: number, x0: number, x1: number, y: number) {
  const palette = ["#ff7a9b", "#7fe7ff", "#ffd65b", "#b59bff", "#9be07a", "#ff9b6a"];
  // Two baskets/trays.
  const tray = (tx: number, tw: number) => {
    ctx.fillStyle = down(ctx, y - 8, y + 2, ["#c9a46a", "#8a6a3a"]);
    rr(ctx, tx, y - 8, tw, 10, 3);
    ctx.fill();
    for (let k = 1; k < tw / 6; k++) line(ctx, tx + k * 6, y - 7, tx + k * 6, y + 1, "rgba(80,50,20,0.3)");
  };
  const span = x1 - x0;
  if (kind % 3 === 0) {
    // Gems in two trays.
    tray(x0 + 4, span * 0.42);
    tray(x0 + span * 0.54, span * 0.42);
    for (let k = 0; k < 12; k++) {
      const gx = x0 + 10 + (k % 6) * (span * 0.075) + (k >= 6 ? span * 0.5 : 0),
        gy = y - 10 - (k % 2) * 3;
      ctx.fillStyle = palette[(k + kind) % palette.length];
      poly(ctx, [gx, gy - 6, gx + 5, gy, gx, gy + 4, gx - 5, gy]);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      poly(ctx, [gx, gy - 6, gx - 2, gy - 1, gx - 5, gy]);
      ctx.fill();
    }
  } else if (kind % 3 === 1) {
    // Rows of potion bottles.
    for (let k = 0; k < 9; k++) {
      const bx = x0 + 10 + k * (span - 20) / 8,
        by = y,
        tall = k % 2 ? 18 : 14;
      ctx.fillStyle = palette[(k + kind) % palette.length];
      rr(ctx, bx - 5, by - tall, 10, tall, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(bx - 3, by - tall + 3, 2, tall - 6);
      ctx.fillStyle = "#e9dcc0";
      ctx.fillRect(bx - 2, by - tall - 5, 4, 5);
      ctx.fillStyle = "#8a5a32";
      ctx.fillRect(bx - 2.5, by - tall - 7, 5, 3);
    }
  } else {
    // Folded cloth in stacks.
    for (let k = 0; k < 5; k++) {
      const sx = x0 + 6 + k * (span - 12) / 5,
        w = (span - 12) / 5 - 6;
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = palette[(k * 2 + l + kind) % palette.length];
        rr(ctx, sx, y - 6 - l * 6, w, 6, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(sx, y - 1 - l * 6, w, 1);
      }
    }
  }
}

/**
 * A market stall: a plank counter (top seen from above, front facing us)
 * dressed with a cloth in the shop's colour, goods on the counter, and a
 * sloping striped awning on four posts. Foot = the counter's front edge.
 */
export function stallSprite(color: string, goods: number): Sprite {
  return {
    w: 220,
    h: 196,
    ax: 110,
    ay: 186,
    draw(ctx) {
      const L = 22,
        R = 198,
        foot = 186,
        counterTop = 124,
        depth = 22;
      // Back posts and a back shelf with more goods.
      for (const px of [L + 8, R - 8]) {
        ctx.fillStyle = across(ctx, px - 3, px + 3, [WOOD.mid, WOOD.deep]);
        ctx.fillRect(px - 3, 40, 6, counterTop - depth - 36);
      }
      ctx.fillStyle = down(ctx, 74, 102, [WOOD.dark, WOOD.deep]);
      ctx.fillRect(L + 8, 74, R - L - 16, 28);
      ctx.fillStyle = WOOD.light;
      ctx.fillRect(L + 8, 97, R - L - 16, 4);
      stallGoods(ctx, goods + 1, L + 14, R - 14, 97);
      // Counter top (seen from above) and goods.
      ctx.fillStyle = down(ctx, counterTop - depth, counterTop, ["#c9a06a", "#b08454"]);
      ctx.fillRect(L, counterTop - depth, R - L, depth);
      for (let k = 1; k < 3; k++) line(ctx, L, counterTop - depth + (depth * k) / 3, R, counterTop - depth + (depth * k) / 3, WOOD.line);
      stallGoods(ctx, goods, L + 6, R - 6, counterTop - 6);
      // Counter front: planks.
      ctx.fillStyle = across(ctx, L, R, [WOOD.mid, WOOD.dark]);
      ctx.fillRect(L, counterTop, R - L, foot - counterTop);
      for (let k = 1; k < 8; k++) line(ctx, L + ((R - L) * k) / 8, counterTop, L + ((R - L) * k) / 8, foot, WOOD.line);
      line(ctx, L, counterTop, R, counterTop, "rgba(255,240,210,0.55)");
      // Cloth draped across the front in the shop's colour, scalloped hem.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(L, counterTop + 2);
      ctx.lineTo(R, counterTop + 2);
      ctx.lineTo(R, counterTop + 20);
      for (let k = 7; k >= 0; k--) {
        const x0 = L + ((R - L) * (k + 1)) / 8,
          x1 = L + ((R - L) * k) / 8;
        ctx.quadraticCurveTo((x0 + x1) / 2, counterTop + 34, x1, counterTop + 20);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(L, counterTop + 2, R - L, 4);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let k = 0; k < 8; k++) ctx.fillRect(L + ((R - L) * k) / 8 + 10, counterTop + 8, 2, 16);
      // Base kick-board and feet.
      ctx.fillStyle = WOOD.deep;
      ctx.fillRect(L - 2, foot - 6, R - L + 4, 6);
      // Front posts.
      for (const px of [L + 2, R - 2]) {
        ctx.fillStyle = across(ctx, px - 4, px + 4, [WOOD.light, WOOD.mid, WOOD.deep]);
        ctx.fillRect(px - 4, 52, 8, counterTop - 52);
      }
      // Awning: canvas sloping down toward us, stripes converging slightly to the back.
      const backY = 22,
        frontY = 60,
        bL = L + 6,
        bR = R - 6,
        fL = L - 12,
        fR = R + 12,
        n = 9;
      for (let k = 0; k < n; k++) {
        const t0 = k / n,
          t1 = (k + 1) / n;
        ctx.fillStyle = k % 2 ? "#fff6e8" : color;
        poly(ctx, [bL + (bR - bL) * t0, backY, bL + (bR - bL) * t1, backY, fL + (fR - fL) * t1, frontY, fL + (fR - fL) * t0, frontY]);
        ctx.fill();
      }
      // Light falls on the canvas from the upper left.
      const sheen = ctx.createLinearGradient(fL, backY, fR, frontY);
      sheen.addColorStop(0, "rgba(255,255,255,0.18)");
      sheen.addColorStop(1, "rgba(0,0,0,0.14)");
      ctx.fillStyle = sheen;
      poly(ctx, [bL, backY, bR, backY, fR, frontY, fL, frontY]);
      ctx.fill();
      // Scalloped valance hanging from the front edge.
      for (let k = 0; k < n; k++) {
        const x0 = fL + ((fR - fL) * k) / n,
          x1 = fL + ((fR - fL) * (k + 1)) / n;
        ctx.fillStyle = k % 2 ? "#efe4d0" : color;
        ctx.beginPath();
        ctx.moveTo(x0, frontY);
        ctx.lineTo(x1, frontY);
        ctx.lineTo(x1, frontY + 8);
        ctx.quadraticCurveTo((x0 + x1) / 2, frontY + 20, x0, frontY + 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(fL, frontY, fR - fL, 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(bL, backY - 2, bR - bL, 3);
      // Shade the awning casts on the counter top.
      ctx.fillStyle = "rgba(30,20,8,0.16)";
      ctx.fillRect(L, counterTop - depth, R - L, 8);
      // A small lantern hanging from the right front corner.
      line(ctx, R - 2, frontY + 6, R - 2, frontY + 18, IRON[1], 1.5);
      ctx.fillStyle = "#ffe39a";
      rr(ctx, R - 7, frontY + 18, 10, 13, 3);
      ctx.fill();
      ctx.strokeStyle = IRON[1];
      ctx.lineWidth = 1.5;
      ctx.stroke();
    },
  };
}
