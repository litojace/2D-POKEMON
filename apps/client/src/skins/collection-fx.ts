import { WORLD_ART, groundHeight } from "../../../../packages/shared/src/world-art";
import { JOURNEY_ITEM_BY_ID } from "../../../../packages/shared/src/journey";
import type Phaser from "phaser";
import type { FxParticle } from "./skin-fx";
import { sparkle } from "./skin-fx";
import { auraFlourish, entranceFlourish, victoryFlourish } from "./tier-fx";

/**
 * The Shop's all-fighter collection pieces in play: auras under the fighter,
 * entrances at round start and victory finales. Frames and Colours are drawn
 * elsewhere (CSS portraits and the rig's restyled textures).
 */
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;

/**
 * How high above the ground the aura's items circle (aura units): just off
 * the floor, around the shadow, so the near half passes in front of the feet
 * and the far half behind them.
 */
export const AURA_LIFT = 3;
/**
 * Auras: a ring on the ground plus items circling the fighter. Pass `front`
 * (a layer drawn over the fighter) and the items come round in front of the
 * fighter on the near half of the circle, a little larger, and pass behind
 * it on the far half, a little smaller and fainter, so the ring has depth.
 * Without it everything draws on `g`. Returns false if the id is unknown.
 */
/** The piece's own ring and items, without its rarity flourish. */
export function drawCollectionAuraBase(g: G, id: string, x: number, y: number, now: number, reduced: boolean, front?: G, flat: number = WORLD_ART.groundY, lift = AURA_LIFT) {
  const t = reduced ? 0 : now;
  /** Height of a floor ellipse this wide, on the aura's plane. */
  const groundHeight = (w: number) => w * flat;
  /** Each item gets its layer, a size factor `d` and an opacity factor `f`. */
  const ring = (
    n: number,
    rx: number,
    _legacyRy: number,
    speed: number,
    draw: (gg: G, px: number, py: number, i: number, a: number, d: number, f: number) => void,
    itemLift = lift,
  ) => {
    for (let i = 0; i < n; i++) {
      const a = t / speed + (i / n) * TAU;
      const near = Math.sin(a);
      draw(
        front && near > 0 ? front : g,
        x + Math.cos(a) * rx,
        y - itemLift + near * rx * flat,
        i,
        a,
        1 + 0.16 * near,
        0.82 + 0.18 * near,
      );
    }
  };
  if (id === "solar-aura") {
    // Lv 80: a sun on the ground. A blazing ring, corona rays turning round
    // it (long gold and short orange in turn) and three small suns in orbit.
    const turn = t / 2600;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 420);
    g.fillStyle(0xffb347, 0.2 + 0.08 * pulse).fillEllipse(x, y, 96, groundHeight(96));
    // The long rays reach past the Mythical prismatic rings (radius 52–60).
    for (const long of [true, false]) {
      g.fillStyle(long ? 0xffd36b : 0xff8a4c, long ? 0.85 : 0.75);
      for (let i = long ? 0 : 1; i < 12; i += 2) {
        const a = turn + (i / 12) * TAU,
          w = long ? 0.12 : 0.1,
          r0 = 44,
          r1 = long ? 66 + 4 * pulse : 56;
        g.fillTriangle(
          x + Math.cos(a - w) * r0,
          y + Math.sin(a - w) * r0 * flat,
          x + Math.cos(a + w) * r0,
          y + Math.sin(a + w) * r0 * flat,
          x + Math.cos(a) * r1,
          y + Math.sin(a) * r1 * flat,
        );
      }
    }
    g.lineStyle(3, 0xffc85a, 0.9).strokeEllipse(x, y, 92, groundHeight(92));
    g.lineStyle(1.2, 0xfff1c4, 0.75).strokeEllipse(x, y, 84, groundHeight(84));
    ring(3, 49, 20, 5200, (gg, px, py, i, _a, d, f) => {
      const flare = (reduced ? 1 : 0.8 + 0.2 * Math.sin(now / 260 + i * 2)) * d;
      gg.fillStyle(0xff8a4c, 0.3 * f).fillCircle(px, py - 4 * d, 7.5 * flare);
      gg.fillStyle(0xfff1c4, 0.95 * f).fillCircle(px, py - 4 * d, 3 * flare);
    });
    return true;
  }
  const journey=JOURNEY_ITEM_BY_ID[id];
  if (journey?.slot === 'aura') {
    const color=parseInt(journey.color.slice(1),16), accent=parseInt(journey.accent.slice(1),16);
    g.lineStyle(1.6,color,.7).strokeEllipse(x,y,102,groundHeight(102));
    g.lineStyle(1,accent,.4).strokeEllipse(x,y,114,groundHeight(114));
    ring(id==='astral-aura'?8:6,49,20,6200,(gg,px,py,i,_a,d,f)=>{
      const c=i%2?color:accent;
      gg.fillStyle(c,.9*f).fillTriangle(px,py-5*d,px+3*d,py,px,py+5*d).fillTriangle(px,py-5*d,px-3*d,py,px,py+5*d);
    });
    return true;
  }
  switch (id) {
    case "candy-aura": {
      const colors = [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a, 0xc89aff];
      ring(16, 46, 20, 3000, (gg, px, py, i, a, d, f) =>
        gg.lineStyle(3 * d, colors[i % colors.length], 0.9 * f).lineBetween(px - Math.cos(a + i) * 3 * d, py - Math.sin(a + i) * 2 * d, px + Math.cos(a + i) * 3 * d, py + Math.sin(a + i) * 2 * d),
        0,
      );
      return true;
    }
    case "galaxy-aura": {
      // A nebula on the ground, its violet and pink clouds turning slowly;
      // stars circle on it, and two small worlds orbit with them, a ringed
      // one and a blue one, passing in front of the fighter and behind.
      const k = reduced ? 0.5 : 0.5 + Math.sin(now / 900) * 0.5;
      g.fillStyle(0x4a3a9a, 0.2 + k * 0.08).fillEllipse(x, y, 108, groundHeight(108));
      g.fillStyle(0xc86bff, 0.16).fillEllipse(x + Math.cos(t / 1800) * 12, y, 72, groundHeight(72));
      g.fillStyle(0xff7fd0, 0.12).fillEllipse(x - Math.cos(t / 2300) * 14, y, 54, groundHeight(54));
      g.lineStyle(1.4, 0x9fd8ff, 0.45 + 0.2 * k).strokeEllipse(x, y, 100, groundHeight(100));
      ring(6, 48, 19, 5000, (gg, px, py, _i, _a, d, f) => sparkle(gg, px, py, 2.4 * d, 0xffffff, 0.85 * f));
      ring(2, 48, 19, 7000, (gg, px, py, i, _a, d, f) => {
        // On the ring's plane, like the stars: in front on the near half.
        const cy = py;
        if (i === 0) {
          gg.fillStyle(0xffc46b, 0.95 * f).fillCircle(px, cy, 4.6 * d);
          gg.lineStyle(1.3 * d, 0xffe7a3, 0.9 * f).strokeEllipse(px, cy, 15 * d, 4.4 * d);
        } else {
          gg.fillStyle(0x6fb6ff, 0.95 * f).fillCircle(px, cy, 3.8 * d);
          gg.fillStyle(0xeafcff, 0.7 * f).fillCircle(px - 1.2 * d, cy - 1.2 * d, 1.2 * d);
        }
      });
      return true;
    }
    case "retro-aura":
      ring(8, 46, 19, 3600, (gg, px, py, _i, _a, d, f) => {
        // A tiny pixel heart.
        const u = 1.6 * d;
        gg.fillStyle(0xff3a5a, 0.95 * f);
        for (const [dx, dy] of [[-2, -1], [-1, -2], [1, -2], [2, -1], [-2, 0], [-1, 0], [0, -1], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]])
          gg.fillRect(px + dx * u, py + dy * u, u, u);
      });
      return true;
    case "festival-aura":
      ring(5, 44, 18, 4200, (gg, px, py, i, _a, d, f) => {
        const bob = reduced ? 0 : Math.sin(now / 400 + i) * 2;
        gg.fillStyle(0xd8262a, 0.95 * f).fillEllipse(px, py + (-8 + bob) * d, 9 * d, 11 * d);
        gg.fillStyle(0xffd65b, 0.9 * f).fillRect(px - 3 * d, py + (-14 + bob) * d, 6 * d, 1.6 * d).fillRect(px - 3 * d, py + (-3 + bob) * d, 6 * d, 1.6 * d);
        gg.fillStyle(0xffd65b, 0.25 * f).fillCircle(px, py + (-8 + bob) * d, 9 * d);
      });
      return true;
    case "garden-aura":
      ring(10, 46, 19, 4600, (gg, px, py, i, a, d, f) => {
        const dx = Math.cos(a * 2 + i) * 4 * d,
          dy = Math.sin(a * 2 + i) * 2 * d;
        gg.fillStyle(i % 2 ? 0xffb3cf : 0xfff0f5, 0.95 * f).fillTriangle(px - dx, py - dy, px + dx, py + dy, px - dy, py + dx * 0.6);
      });
      return true;
    case "tidal-aura": {
      // Tidewyrm's reward: a rolling ring of water with foam crests.
      g.fillStyle(0x1f8fa6, 0.18).fillEllipse(x, y, 104, groundHeight(104));
      g.lineStyle(3, 0x7fe9ff, 0.8).strokeEllipse(x, y, 96, groundHeight(96));
      ring(10, 48, 20, 2600, (gg, px, py, i, _a, d, f) =>
        gg.fillStyle(i % 2 ? 0xffffff : 0xbff6ff, 0.9 * f).fillCircle(px, py - 2 * d, 3.4 * d),
        0,
      );
      return true;
    }
    case "spark-aura": {
      g.lineStyle(1.5,0x9fe4ff,.55).strokeEllipse(x,y,100,groundHeight(100));
      ring(8,48,19,5200,(gg,px,py,i,_a,d,f)=>{const color=i%2?0x8edfff:0xffe18b;gg.lineStyle(2*d,color,.95*f).lineBetween(px-3*d,py-5*d,px+1*d,py).lineBetween(px+1*d,py,px-2*d,py+5*d);});
      return true;
    }
    case "ember-aura": {
      g.lineStyle(2,0xffa66c,.8).strokeEllipse(x,y,100,groundHeight(100));
      g.fillStyle(0xff8558,.1).fillEllipse(x,y,110,groundHeight(110));
      ring(8,48,19,6200,(gg,px,py,i,_a,d,f)=>{const rise=reduced?0:Math.sin(now/1000+i)*5;gg.fillStyle(i%2?0xffd28b:0xff8765,.85*f).fillEllipse(px,py+(-5+rise)*d,3*d,6*d);});
      return true;
    }
    case "halo-aura": {
      g.lineStyle(3,0xffe5a0,.85).strokeEllipse(x,y,100,groundHeight(100));
      g.lineStyle(1,0xfff3cf,.4).strokeEllipse(x,y,112,groundHeight(112));
      ring(6,50,20,6500,(gg,px,py,i,_a,d,f)=>{ const color=[0xff899e,0xffd778,0x9aefb5,0x80e1ff,0xa5adff,0xe5a0ff][i];gg.fillStyle(color,.9*f).fillTriangle(px,py-6*d,px+4*d,py,px,py+6*d).fillTriangle(px,py-6*d,px-4*d,py,px,py+6*d); });
      return true;
    }
    case "lullaby-aura": {
      g.fillStyle(0x8977c5, 0.12).fillEllipse(x, y, 102, groundHeight(102));
      g.lineStyle(1.5, 0xc9a3ff, 0.45).strokeEllipse(x, y, 98, groundHeight(98));
      ring(6, 46, 19, 6000, (gg, px, py, i, _a, d, f) => {
        const bob = (reduced ? 0 : Math.sin(now / 750 + i) * 3) * d;
        const c = i % 2 ? 0xc9a3ff : 0xffdf8d;
        gg.fillStyle(c, 0.9 * f).fillEllipse(px, py + bob, 5 * d, 3 * d);
        gg.lineStyle(1.4 * d, c, 0.9 * f).lineBetween(px + 2 * d, py + bob, px + 2 * d, py - 10 * d + bob).lineBetween(px + 2 * d, py - 10 * d + bob, px + 7 * d, py - 7 * d + bob);
      });
      return true;
    }
    case "nightmote": {
      // Gloomshade's reward: fireflies of lantern light circling beneath you.
      g.fillStyle(0x2b2245, 0.22).fillEllipse(x, y, 100, groundHeight(100));
      ring(7, 46, 19, 4400, (gg, px, py, i, _a, d, f) => {
        const bob = reduced ? 0 : Math.sin(now / 350 + i * 1.3) * 4;
        const blink = (reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now / 500 + i * 2.1))) * f;
        gg.fillStyle(0xffd27a, 0.25 * blink).fillCircle(px, py + (-6 + bob) * d, 7 * d);
        gg.fillStyle(0xfff1c2, 0.95 * blink).fillCircle(px, py + (-6 + bob) * d, 2.6 * d);
      });
      return true;
    }
    case "mountain-aura": {
      // Grumblecrag's reward: a golden ring of carved stone chips.
      g.lineStyle(3, 0xffd28c, 0.75).strokeEllipse(x, y, 98, groundHeight(98));
      g.lineStyle(1, 0xb88a52, 0.5).strokeEllipse(x, y, 110, groundHeight(110));
      ring(8, 50, 20, 7000, (gg, px, py, i, _a, d, f) => {
        const s = (i % 2 ? 4.2 : 3.2) * d;
        gg.fillStyle(i % 2 ? 0x9b8466 : 0xc8a06a, 0.95 * f).fillTriangle(px - s, py, px, py - s * 1.1, px + s, py).fillTriangle(px - s, py, px, py + s * 0.6, px + s, py);
        gg.fillStyle(0xffd28c, 0.8 * f).fillCircle(px, py - s * 0.3, 1.1 * d);
      });
      return true;
    }
    case "seaside-aura": {
      // A ring of sea foam on the sand, and shells and starfish circling.
      g.lineStyle(2.4, 0xffffff, 0.55).strokeEllipse(x, y, 100, groundHeight(100));
      g.lineStyle(1.2, 0x7fe0d8, 0.6).strokeEllipse(x, y, 110, groundHeight(110));
      ring(6, 47, 19, 5200, (gg, px, py, i, _a, d, f) => {
        const cy = py - 6 * d;
        d *= 1.25;
        if (i % 2) {
          // A starfish: five arms, turning a little as it goes.
          const turn = reduced ? 0 : Math.sin(now / 900 + i) * 0.25;
          gg.fillStyle(0xff8a6a, 0.95 * f);
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI / 2 + (k / 5) * TAU + turn;
            gg.fillTriangle(px + Math.cos(a) * 6.8 * d, cy + Math.sin(a) * 6.8 * d, px + Math.cos(a + 1.9) * 2.4 * d, cy + Math.sin(a + 1.9) * 2.4 * d, px + Math.cos(a - 1.9) * 2.4 * d, cy + Math.sin(a - 1.9) * 2.4 * d);
          }
          gg.fillStyle(0xffd1b8, 0.9 * f).fillCircle(px, cy, 1.5 * d);
        } else {
          // A scallop shell: a ribbed fan on a small hinge.
          gg.fillStyle(0xffb7a0, 0.96 * f).fillTriangle(px - 3.2 * d, cy + 3 * d, px + 3.2 * d, cy + 3 * d, px, cy + 6.4 * d);
          gg.fillStyle(0xffe6d6, 0.96 * f).fillEllipse(px, cy - 1 * d, 12.5 * d, 10 * d);
          gg.lineStyle(0.9 * d, 0xe88a78, 0.85 * f);
          for (const u of [-0.72, -0.26, 0.26, 0.72]) gg.lineBetween(px, cy + 3.6 * d, px + u * 6 * d, cy - (5 - Math.abs(u) * 2.4) * d);
        }
      });
      return true;
    }
    case "steamworks-aura": {
      // A clock face on the ground: a brass rim and twelve ticks, the
      // quarters longer. Gears turn round it, each against its neighbour.
      g.lineStyle(2.2, 0xe0a23a, 0.8).strokeEllipse(x, y, 104, groundHeight(104));
      g.lineStyle(1.1, 0xffe6a6, 0.7);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU,
          r0 = i % 3 ? 47 : 43;
        g.lineBetween(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * flat, x + Math.cos(a) * 51, y + Math.sin(a) * 51 * flat);
      }
      ring(5, 47, 19, 6400, (gg, px, py, i, _a, d, f) => {
        const cy = py - 7 * d,
          r = (i % 2 ? 6 : 7.6) * d,
          spin = (reduced ? 0 : now / (i % 2 ? -700 : 900)) + i;
        gg.fillStyle(i % 2 ? 0xc8862a : 0xe0a23a, 0.96 * f);
        for (let k = 0; k < 8; k++) {
          const a = spin + (k / 8) * TAU;
          gg.fillTriangle(px + Math.cos(a - 0.24) * r, cy + Math.sin(a - 0.24) * r, px + Math.cos(a + 0.24) * r, cy + Math.sin(a + 0.24) * r, px + Math.cos(a) * (r + 2.8 * d), cy + Math.sin(a) * (r + 2.8 * d));
        }
        gg.fillCircle(px, cy, r);
        gg.fillStyle(0x4a2f14, 0.9 * f).fillCircle(px, cy, r * 0.36);
        gg.lineStyle(0.9 * d, 0xffe6a6, 0.8 * f).strokeCircle(px, cy, r * 0.7);
      });
      return true;
    }
    case "firefly-aura": {
      // A summer evening: fireflies drift round you in a loose ring at three
      // heights, up to your shoulders, each blinking at its own pace over a
      // faint warm glow on the ground.
      g.fillStyle(0x3a4a1a, 0.2).fillEllipse(x, y, 104, groundHeight(104));
      g.lineStyle(1.2, 0xd8ff7a, 0.4).strokeEllipse(x, y, 100, groundHeight(100));
      ring(8, 66, 20, 7400, (gg, px, py, i, _a, d, f) => {
        const bob = reduced ? 0 : Math.sin(now / 640 + i * 1.9) * 6;
        const cy = py - (14 + (i % 3) * 24 + bob) * d;
        const blink = reduced ? 1 : 0.45 + 0.55 * Math.max(0, Math.sin(now / 380 + i * 2.3)) ** 2;
        gg.fillStyle(0xe6ff8a, 0.2 * blink * f).fillCircle(px, cy, 10 * d);
        gg.fillStyle(0xf4ffa8, 0.45 * blink * f).fillCircle(px, cy, 5.6 * d);
        gg.fillStyle(0xffffe0, blink * f).fillCircle(px, cy, 2.8 * d);
        // The beetle itself: a small dark head ahead of its lit tail.
        gg.fillStyle(0x3a2a14, 0.9 * f).fillEllipse(px - 3.8 * d, cy - 1.6 * d, 3.6 * d, 2.6 * d);
      });
      return true;
    }
    case "crystal-aura": {
      // A ring of cut-glass light on the ground, and crystals that turn as
      // they orbit, violet and ice blue, each catching a glint in turn.
      g.lineStyle(2, 0xb48cff, 0.7).strokeEllipse(x, y, 102, groundHeight(102));
      g.lineStyle(1, 0xe6dcff, 0.6).strokeEllipse(x, y, 92, groundHeight(92));
      ring(6, 47, 19, 6000, (gg, px, py, i, _a, d, f) => {
        const cy = py - (11 + (reduced ? 0 : Math.sin(now / 700 + i) * 3)) * d;
        const h = (i % 2 ? 9 : 11.5) * d;
        const turn = reduced ? 1 : Math.cos(now / 520 + i * 1.3);
        const w = h * 0.5 * (0.35 + 0.65 * Math.abs(turn));
        gg.fillStyle(i % 2 ? 0x8ff0ff : 0xb48cff, 0.94 * f)
          .fillTriangle(px - w, cy, px, cy - h, px + w, cy)
          .fillTriangle(px - w, cy, px, cy + h * 0.55, px + w, cy);
        // The facet facing the light, on the side the crystal has turned to.
        const side = turn > 0 ? -w : w;
        gg.fillStyle(0xffffff, 0.4 * f).fillTriangle(px + side, cy, px, cy - h, px, cy);
        if (!reduced && Math.sin(now / 900 + i * 1.05) > 0.94) sparkle(gg, px, cy - h * 0.6, 3.2 * d, 0xffffff, 0.95 * f);
      });
      return true;
    }
    case "music-aura": {
      // Music notes bob round you to a beat: eighth notes in pink, ice blue
      // and gold hop on each beat over a ring of staff lines.
      g.lineStyle(1, 0xffffff, 0.35).strokeEllipse(x, y, 96, groundHeight(96));
      g.lineStyle(1, 0xffffff, 0.25).strokeEllipse(x, y, 106, groundHeight(106));
      const beat = reduced ? 0 : Math.abs(Math.sin((now / 500) * Math.PI));
      const notes = [0xff6fa8, 0x6fd6ff, 0xffd65b];
      ring(6, 52, 20, 6400, (gg, px, py, i, _a, d, f) => {
        const hop = (i % 2 ? beat : 1 - beat) * 6 * d,
          hy = py - hop,
          c = notes[i % 3];
        gg.fillStyle(c, 0.95 * f).fillEllipse(px, hy, 6 * d, 4.6 * d);
        gg.lineStyle(1.4 * d, c, 0.95 * f).lineBetween(px + 2.6 * d, hy, px + 2.6 * d, hy - 12 * d);
        gg.fillStyle(c, 0.95 * f).fillTriangle(px + 2.6 * d, hy - 12 * d, px + 7 * d, hy - 8 * d, px + 2.6 * d, hy - 8 * d);
      });
      return true;
    }
    case "rune-aura": {
      // A magic circle on the ground: two gold rings with runes between
      // them, turning slowly, and four violet sparks circling above it.
      const turn = t / 9000;
      const k = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 700);
      g.fillStyle(0x6a3aff, 0.2 + 0.08 * k).fillEllipse(x, y, 108, groundHeight(108));
      g.lineStyle(2.4, 0xffd36b, 0.95).strokeEllipse(x, y, 108, groundHeight(108));
      g.lineStyle(1.6, 0xffd36b, 0.85).strokeEllipse(x, y, 80, groundHeight(80));
      g.lineStyle(1.8, 0xe6d6ff, 0.75 + 0.25 * k);
      for (let i = 0; i < 10; i++) {
        const a = turn * TAU + (i / 10) * TAU,
          cx = x + Math.cos(a) * 46,
          cy = y + Math.sin(a) * 46 * flat,
          u = 4,
          v = 4 * flat * 2.4;
        // Each rune: a stroke and one of three marks across it.
        g.lineBetween(cx, cy - v, cx, cy + v);
        if (i % 3 === 0) g.lineBetween(cx - u, cy - v * 0.4, cx + u, cy + v * 0.4);
        else if (i % 3 === 1) g.lineBetween(cx, cy - v, cx + u, cy).lineBetween(cx + u, cy, cx, cy + v * 0.3);
        else g.lineBetween(cx - u, cy, cx + u, cy).lineBetween(cx - u, cy - v * 0.6, cx - u, cy + v * 0.6);
      }
      ring(4, 50, 20, 4200, (gg, px, py, i, _a, d, f) => {
        const cy = py - (reduced ? 0 : Math.sin(now / 380 + i * 1.6) * 3) * d;
        gg.fillStyle(0xb48cff, 0.28 * f).fillCircle(px, cy, 7 * d);
        gg.fillStyle(0xf0e6ff, 0.95 * f).fillCircle(px, cy, 2.4 * d);
      });
      return true;
    }
    case "borealis-aura": {
      // Curtains of light: rays stand round a ring of light on the ice,
      // each swaying and rising at its own pace, green at the foot and
      // violet at the crest.
      const k = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1100);
      g.fillStyle(0x0f3a4a, 0.22).fillEllipse(x, y, 108, groundHeight(108));
      g.lineStyle(1.6, 0x4dffb8, 0.55 + 0.2 * k).strokeEllipse(x, y, 100, groundHeight(100));
      ring(12, 48, 19, 9000, (gg, px, py, i, _a, d, f) => {
        // Tall behind and beside the fighter; short on the near half, which
        // draws in front, so the light never veils its body.
        const h = (34 + 20 * (reduced ? 0.5 : Math.sin(now / 520 + i * 1.7) * 0.5 + 0.5)) * d * (d > 1.04 ? 0.55 : 1),
          w = 5 * d,
          lean = reduced ? 0 : Math.sin(now / 800 + i) * 2.6 * d;
        gg.fillStyle(0x4dffb8, 0.5 * f).fillTriangle(px - w, py, px + w, py, px + lean, py - h);
        gg.fillStyle(0xb48cff, 0.42 * f).fillTriangle(px - w * 0.6 + lean * 0.5, py - h * 0.5, px + w * 0.6 + lean * 0.5, py - h * 0.5, px + lean * 1.4, py - h * 1.5);
        gg.fillStyle(0xeafff6, 0.8 * f).fillCircle(px, py, 1.1 * d);
      }, 0);
      return true;
    }
    case "winter-aura":
      ring(8, 46, 19, 5200, (gg, px, py, i, _a, d, f) => {
        const s = 4 * d;
        gg.lineStyle(1.4 * d, i % 2 ? 0xffffff : 0xbfe8ff, 0.95 * f)
          .lineBetween(px - s, py, px + s, py)
          .lineBetween(px - s / 2, py - s * 0.86, px + s / 2, py + s * 0.86)
          .lineBetween(px - s / 2, py + s * 0.86, px + s / 2, py - s * 0.86);
      });
      return true;
  }
  return false;
}

type Emit = (p: FxParticle) => void;
/** Eclipse finale: when the moon covers the sun (seconds into the finale). */
export const ECLIPSE_TOTALITY = 1.3;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** A rainbow's bands, outside in. */
const RAINBOW = [0xff4f5a, 0xff9f43, 0xffe066, 0x5fdc7a, 0x4fb6ff, 0xa77bff];

/** A one-off burst when the round greeting starts. Returns false if unknown. */
function baseEntrance(emit: Emit, id: string, x: number, y: number, sc: number) {
  const burst = (n: number, make: (i: number) => Omit<FxParticle, "x" | "y"> & { x?: number; y?: number }) => {
    for (let i = 0; i < n; i++) {
      const p = make(i);
      emit({ x: x, y: y, ...p } as FxParticle);
    }
  };
  if (id === "nova-entrance") {
    // Lv 65: starlight rushes into a point and bursts into a nova: stars
    // fall inward from a wide ring as a white flash, three rings of light
    // and streaks of starlight burst out of the centre.
    const cy = y - 40 * sc;
    burst(16, (i) => {
      const a = (i / 16) * TAU;
      return { x: x + Math.cos(a) * 78 * sc, y: cy + Math.sin(a) * 52 * sc, vx: -Math.cos(a) * 210, vy: -Math.sin(a) * 140, life: 0.36, size: (i % 2 ? 3 : 4.6) * sc, color: i % 2 ? 0xb6a0ff : 0xffe7a3, shape: "star" };
    });
    emit({ x, y: cy, vx: 0, vy: 0, life: 0.5, size: 13 * sc, color: 0xffffff, shape: "star" });
    emit({ x, y: cy, vx: 0, vy: 0, life: 0.6, size: 8 * sc, color: 0xffffff, shape: "ring" });
    emit({ x, y: cy, vx: 0, vy: 0, life: 0.85, size: 13 * sc, color: 0xffe7a3, shape: "ring" });
    emit({ x, y: cy, vx: 0, vy: 0, life: 1.1, size: 18 * sc, color: 0xb6a0ff, shape: "ring" });
    burst(18, (i) => {
      const a = (i / 18) * TAU + 0.17;
      const speed = i % 2 ? 230 : 330;
      return { x, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.8, life: 0.5, size: (i % 2 ? 5 : 7) * sc, color: [0xffe7a3, 0xb6a0ff, 0x9ff3d8][i % 3], shape: "ray" };
    });
    burst(14, (i) => {
      const a = (i / 14) * TAU;
      return { x, y: cy, vx: Math.cos(a) * rnd(70, 130), vy: Math.sin(a) * rnd(60, 110) - 30, life: rnd(0.9, 1.3), size: (i % 3 ? 2.8 : 4.4) * sc, color: [0xffe7a3, 0xb6a0ff, 0x9ff3d8][i % 3], shape: "star", spin: i % 2 ? 3 : -3 };
    });
    return true;
  }
  if (id==='comet-arrival') {
    burst(18,i=>({x:x+(i-9)*3*sc,y:y-60*sc,vx:(i-9)*9,vy:-40+Math.abs(i-9)*10,life:.7+(i%3)*.15,size:(i%4===0?5:2)*sc,color:i%2?0xffd991:0x9ff3d8,shape:'star',spin:i%2?2:-2}));
    return true;
  }
  switch (id) {
    case "candy-entrance": {
      // A pink gift box round the fighter bursts open: its walls, tied with
      // a gold ribbon, fly apart from where they stood, the lid and its bow
      // pop up, and confetti showers from the top. The pieces start on the
      // box's outline, not over the face, and carry no halo.
      const hw = 30 * sc,
        top = y - 58 * sc,
        bot = y + 2 * sc;
      for (let k = 0; k <= 6; k++) {
        const f = k / 6;
        for (const side of [-1, 1]) {
          const px = x + side * hw,
            py = top + (bot - top) * f,
            ribbon = k === 3;
          // Slow enough that the box still stands at 0.2 s, the moment a
          // catalogue tile shows (cosmetic-fx-preview.ts FROZEN_AT).
          emit({ x: px, y: py, vx: side * rnd(55, 90), vy: rnd(-50, 10), life: rnd(0.55, 0.75), size: 4.4 * sc, color: ribbon ? 0xffd65b : f < 0.5 ? 0xff8fbe : 0xff6fa8, shape: "pixel", glow: false, drag: 1.2 });
        }
        const px = x - hw + 2 * hw * f;
        emit({ x: px, y: bot, vx: (px - x) * 1.8, vy: rnd(-30, -10), life: 0.6, size: 4 * sc, color: k === 3 ? 0xffd65b : 0xff6fa8, shape: "pixel", glow: false, drag: 2 });
      }
      // The lid: a wide band that flips as it flies up, and its bow.
      for (let k = -2; k <= 2; k++)
        emit({ x: x + k * 8 * sc, y: top, vx: k * 18, vy: -110, life: 0.8, size: 5 * sc, color: k === 0 ? 0xffd65b : 0xff4f9a, shape: "pixel", glow: false, drag: 0.6 });
      for (const side of [-1, 1]) emit({ x: x + side * 6 * sc, y: top - 8 * sc, vx: side * 30, vy: -130, life: 0.85, size: 6 * sc, color: 0xffd65b, shape: "leaf", spin: side * 6, glow: false });
      emit({ x, y: y - 28 * sc, vx: 0, vy: 0, life: 0.45, size: 16 * sc, color: 0xffd2e4, shape: "shock" });
      // 29 box pieces and a ring so far: 18 confetti keeps it in budget.
      burst(18, (i) => ({ x: x + rnd(-24, 24) * sc, y: top, vx: rnd(-150, 150), vy: rnd(-260, -120), life: rnd(0.9, 1.3), size: 2.6 * sc, color: [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a][i % 4], shape: "confetti", spin: rnd(-12, 12) }));
      return true;
    }
    case "galaxy-entrance":
      // Rings fall inward like a tunnel of stars.
      for (let k = 0; k < 4; k++) emit({ x, y: y - 10 * sc, vx: 0, vy: 0, life: 0.3 + k * 0.12, size: (14 - k * 3) * sc, color: k % 2 ? 0x9fd8ff : 0xc86bff, shape: "ring" });
      burst(20, (i) => {
        const a = (i / 20) * TAU;
        return { x: x + Math.cos(a) * 60 * sc, y: y - 10 * sc + Math.sin(a) * 30 * sc, vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 75, life: 0.4, size: 2.4 * sc, color: 0xffffff, shape: "star" };
      });
      return true;
    case "retro-entrance": {
      // Player One spawns: a column of pixels drops onto the spot as a
      // blocky beam, a ring of pixels skids out over the ground and a few
      // bright blocks blink round the fighter's outline.
      const cols = [0x2ff3ff, 0xff4fd8, 0xffffff, 0x8fe06a];
      for (let k = 0; k < 14; k++)
        emit({ x: x + ((k % 7) - 3) * 7 * sc, y: y - (120 + Math.floor(k / 7) * 26) * sc, vx: 0, vy: 520, life: 0.24 + Math.floor(k / 7) * 0.05, size: 3.4 * sc, color: cols[k % 4], shape: "pixel", glow: false });
      emit({ x, y, vx: 0, vy: 0, life: 0.5, size: 8 * sc, color: 0x2ff3ff, shape: "beam" });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        emit({ x: x + Math.cos(a) * 18 * sc, y: y + Math.sin(a) * 7 * sc, vx: Math.cos(a) * 170, vy: Math.sin(a) * 66, life: 0.55, size: 3 * sc, color: cols[i % 4], shape: "pixel", drag: 2.2, glow: false });
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        emit({ x: x + Math.cos(a) * 36 * sc, y: y - 32 * sc + Math.sin(a) * 40 * sc, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: rnd(0.4, 0.8), size: 2.6 * sc, color: cols[(i + 1) % 4], shape: "pixel" });
      }
      return true;
    }
    case "festival-entrance": {
      // Firecrackers pop in a ring round the fighter, each a small flash
      // with sparks; red paper scraps flutter down and a little smoke
      // drifts off low at either side, clear of the face.
      // Five pops of six particles and two puffs: 32, with the Epic
      // flourish's 13 inside the entrance budget.
      const spots = [[-42, -8], [42, -8], [-46, -44], [46, -44], [0, -82]] as const;
      spots.forEach(([dx, dy], k) => {
        const px = x + dx * sc,
          py = y + dy * sc;
        emit({ x: px, y: py, vx: 0, vy: 0, life: 0.3, size: 4 * sc, color: k % 2 ? 0xffd65b : 0xff4f4f, shape: "shock" });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + k + 0.4;
          emit({ x: px, y: py, vx: Math.cos(a) * rnd(110, 170), vy: Math.sin(a) * rnd(110, 170), life: 0.35, size: 4 * sc, color: i % 2 ? 0xffd65b : 0xff6a3a, shape: "spark" });
        }
        emit({ x: px, y: py, vx: rnd(-40, 40), vy: rnd(-90, -30), life: rnd(0.9, 1.3), size: 2.6 * sc, color: 0xd8262a, shape: "confetti", spin: rnd(-10, 10), glow: false });
      });
      burst(2, (i) => ({ x: x + (i % 2 ? 1 : -1) * rnd(40, 52) * sc, y: y + 2 * sc, vx: (i % 2 ? 1 : -1) * rnd(30, 60), vy: rnd(-30, -10), life: rnd(0.6, 0.8), size: 2.6 * sc, color: 0xd9d4cc, shape: "puff", grow: 1.3, fadeIn: 0.2, glow: false }));
      return true;
    }
    case "garden-entrance": {
      // A flower opens round the fighter's feet: two rings of big petals
      // spread out from under it and settle, a green ring of leaves lies
      // round them, and pollen rises from the heart of the flower.
      for (let ring = 0; ring < 2; ring++)
        for (let i = 0; i < 8; i++) {
          const a = ((i + ring * 0.5) / 8) * TAU;
          emit({ x: x + Math.cos(a) * 10 * sc, y: y + Math.sin(a) * 4 * sc, vx: Math.cos(a) * (ring ? 150 : 110), vy: Math.sin(a) * (ring ? 56 : 42) - 20, life: ring ? 0.85 : 1, size: (ring ? 6.5 : 8) * sc, color: ring ? 0xffd0e2 : 0xff7fae, shape: "leaf", spin: 0, drag: 3.2, glow: false });
        }
      for (let i = 0; i < 6; i++) {
        const a = ((i + 0.25) / 6) * TAU;
        emit({ x, y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 70, life: 0.8, size: 5 * sc, color: 0x6fcf5a, shape: "leaf", drag: 3.6, glow: false });
      }
      burst(14, () => ({ x: x + rnd(-10, 10) * sc, y: y - rnd(0, 8) * sc, vx: rnd(-30, 30), vy: rnd(-150, -70), life: rnd(0.8, 1.2), size: 1.8 * sc, color: 0xffe066, shape: "dot", drag: 1.2 }));
      burst(10, (i) => ({ x: x + rnd(-30, 30) * sc, y: y - rnd(10, 60) * sc, vx: rnd(-40, 40), vy: rnd(-40, 0), life: rnd(1, 1.4), size: 3 * sc, color: i % 2 ? 0xffb3cf : 0xfff0f5, shape: "leaf", spin: rnd(-6, 6) }));
      return true;
    }
    case "lightning-strike":
      burst(20,i=>({x:x+(i%2?18:-18)*sc,y:y-rnd(10,80)*sc,vx:rnd(-45,45),vy:rnd(30,100),life:.6,size:3*sc,color:i%2?0x8edfff:0xffe18b,shape:"spark"}));
      emit({x,y,vx:0,vy:0,life:.7,size:22*sc,color:0x9fe4ff,shape:"ring"});
      return true;
    case "firefall":
      burst(22,i=>({x:x+rnd(-45,45)*sc,y:y-rnd(40,100)*sc,vx:rnd(-30,30),vy:rnd(25,70),life:rnd(.8,1.3),size:3*sc,color:i%2?0xffd28b:0xff8765,shape:"leaf",spin:rnd(-3,3)}));
      return true;
    case "sunburst":
      burst(24,i=>{const a=i/24*TAU;return {x,y:y-20*sc,vx:Math.cos(a)*170,vy:Math.sin(a)*130,life:.75,size:4*sc,color:i%2?0xffe5a0:0xffffff,shape:"spark"};});
      emit({x,y,vx:0,vy:0,life:.8,size:24*sc,color:0xffd778,shape:"ring"});
      return true;
    case "dreamdrift":
      emit({ x, y, vx: 0, vy: -12, life: 1.2, size: 18 * sc, color: 0xc9a3ff, shape: "ring" });
      burst(20, i => ({ x: x + rnd(-36, 36) * sc, y: y + rnd(-12, 14) * sc, vx: rnd(-20, 20), vy: rnd(-90, -35), life: rnd(0.8, 1.4), size: (i % 3 ? 3 : 7) * sc, color: i % 2 ? 0xd1b2ff : 0x92efdb, shape: "ring" }));
      return true;
    case "riptide":
      // Tidewyrm's reward: burst up out of a splash.
      emit({ x, y: y - 6 * sc, vx: 0, vy: 0, life: 0.45, size: 14 * sc, color: 0x7fe9ff, shape: "ring" });
      burst(30, (i) => {
        const a = -Math.PI * (0.1 + (i / 30) * 0.8);
        return { y: y + 10 * sc, vx: Math.cos(a) * rnd(80, 190), vy: Math.sin(a) * rnd(150, 280), life: rnd(0.6, 1), size: rnd(2, 3.4) * sc, color: i % 3 ? 0xe6fbff : 0x7fe9ff, shape: "dot" };
      });
      return true;
    case "shadowstep":
      // Gloomshade's reward: rise out of a pool of shadow.
      emit({ x, y: y + 8 * sc, vx: 0, vy: 0, life: 0.6, size: 22 * sc, color: 0x2b2245, shape: "ring" });
      burst(26, (i) => {
        const a = (i / 26) * TAU;
        return { x: x + Math.cos(a) * 34 * sc, y: y + 8 * sc + Math.sin(a) * 12 * sc, vx: Math.cos(a) * rnd(10, 30), vy: -rnd(60, 140), life: rnd(0.6, 1), size: rnd(3, 5) * sc, color: i % 4 ? 0x4a3d72 : 0xffd65b, shape: i % 4 ? "puff" : "spark" };
      });
      return true;
    case "seaside-entrance":
      // The sandcastle bursts: sand flies, its little flags flutter off,
      // bubbles rise from the wet sand and a ring of foam spreads.
      burst(18, (i) => ({ y: y - 4 * sc, vx: rnd(-130, 130), vy: rnd(-230, -90), life: rnd(0.6, 1), size: rnd(2.2, 3.6) * sc, color: [0xf2c98a, 0xe2b06a, 0xfff1c9][i % 3], shape: "pebble", spin: rnd(-8, 8) }));
      burst(6, (i) => ({ y: y - 30 * sc, vx: (i - 2.5) * 34, vy: -150, life: 1.1, size: 3 * sc, color: i % 2 ? 0xff6a5a : 0x7fe0d8, shape: "confetti", spin: rnd(-10, 10) }));
      burst(8, (i) => ({ x: x + (i - 3.5) * 9 * sc, y: y + 2 * sc, vx: (i - 3.5) * 16, vy: rnd(-70, -30), life: rnd(0.7, 1.1), size: 3 * sc, color: 0xffffff, shape: "bubble" }));
      emit({ x, y, vx: 0, vy: 0, life: 0.6, size: 13 * sc, color: 0xffffff, shape: "shock" });
      return true;
    case "steamworks-entrance":
      // A valve opens: steam billows up and out, cogs spin off, sparks
      // fly and a brass ring rolls out over the ground.
      // The steam leaves to either side, so the face stays clear.
      burst(12, (i) => ({ x: x + (i % 2 ? 1 : -1) * rnd(34, 46) * sc, y: y - rnd(-2, 12) * sc, vx: (i % 2 ? 1 : -1) * rnd(80, 150), vy: rnd(-70, -20), life: rnd(0.7, 1), size: rnd(3.4, 5) * sc, color: i % 3 ? 0xf4f1e6 : 0xd8d2c0, shape: "puff", grow: 1.5, drag: 1.4, fadeIn: 0.15, glow: false }));
      burst(10, (i) => {
        const a = (i / 10) * TAU;
        return { y: y - 18 * sc, vx: Math.cos(a) * 150, vy: Math.sin(a) * 110 - 40, life: 0.8, size: 3.4 * sc, color: i % 2 ? 0xe0a23a : 0xffe6a6, shape: "coin", spin: i % 2 ? 9 : -9 };
      });
      burst(8, () => ({ y: y - 10 * sc, vx: rnd(-170, 170), vy: rnd(-200, -60), life: rnd(0.4, 0.7), size: 2.4 * sc, color: 0xffe6a6, shape: "spark" }));
      emit({ x, y, vx: 0, vy: 0, life: 0.55, size: 12 * sc, color: 0xe0a23a, shape: "shock" });
      return true;
    case "bubble-entrance":
      // A big soap bubble bursts round the fighter: its skin flashes as two
      // rings, small bubbles scatter up and away and droplets fall.
      emit({ x, y: y - 28 * sc, vx: 0, vy: 0, life: 0.35, size: 22 * sc, color: 0xcff6ff, shape: "ring" });
      emit({ x, y: y - 28 * sc, vx: 0, vy: 0, life: 0.5, size: 26 * sc, color: 0xffc8f0, shape: "ring" });
      burst(16, (i) => {
        const a = (i / 16) * TAU;
        return { x: x + Math.cos(a) * 26 * sc, y: y - 28 * sc + Math.sin(a) * 26 * sc, vx: Math.cos(a) * rnd(40, 90), vy: Math.sin(a) * rnd(30, 70) - 50, life: rnd(0.8, 1.3), size: rnd(2.4, 4.6) * sc, color: [0xffffff, 0xcff6ff, 0xffc8f0][i % 3], shape: "bubble" };
      });
      burst(10, () => ({ x: x + rnd(-24, 24) * sc, y: y - rnd(20, 50) * sc, vx: rnd(-30, 30), vy: rnd(20, 80), life: rnd(0.4, 0.7), size: 1.8 * sc, color: 0xcff6ff, shape: "dot" }));
      return true;
    case "portal-entrance":
      // A portal swirls open on the ground and the fighter steps out: rings
      // close in, sparks spiral out of its mouth, and a column of its light
      // stands for a moment.
      for (let k = 0; k < 3; k++) emit({ x, y, vx: 0, vy: 0, life: 0.45 + k * 0.15, size: (16 - k * 4) * sc, color: k % 2 ? 0x4de8d8 : 0x9a5cff, shape: "shock" });
      emit({ x, y, vx: 0, vy: 0, life: 0.7, size: 12 * sc, color: 0x9a5cff, shape: "beam" });
      burst(18, (i) => {
        const a = (i / 18) * TAU;
        return { x: x + Math.cos(a) * 30 * sc, y: y + Math.sin(a) * 10 * sc, vx: -Math.sin(a) * 150 + Math.cos(a) * 40, vy: (Math.cos(a) * 150 + Math.sin(a) * 40) * 0.35 - 90, life: rnd(0.5, 0.8), size: (i % 3 ? 2.6 : 3.6) * sc, color: [0x9a5cff, 0x4de8d8, 0xf0e6ff][i % 3], shape: i % 3 ? "spark" : "star", drag: 1.2 };
      });
      return true;
    case "smoke-entrance":
      // A smoke bomb: a flash at the feet, a ring of smoke rolls out low
      // and fast so the fighter shows through at once, and green leaves
      // whirl up and away as it clears.
      emit({ x, y, vx: 0, vy: 0, life: 0.3, size: 10 * sc, color: 0xffffff, shape: "shock" });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        emit({ x: x + Math.cos(a) * 26 * sc, y: y - 6 * sc + Math.sin(a) * 10 * sc, vx: Math.cos(a) * rnd(130, 190), vy: Math.sin(a) * rnd(40, 70) - 20, life: rnd(0.55, 0.8), size: rnd(3.6, 5) * sc, color: i % 3 ? 0x8a93a6 : 0xb7bfcc, shape: "puff", grow: 1.6, drag: 2.4, glow: false });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        emit({ x: x + Math.cos(a) * 20 * sc, y: y - 30 * sc + Math.sin(a) * 26 * sc, vx: -Math.sin(a) * 140, vy: Math.cos(a) * 90 - 80, life: rnd(0.8, 1.1), size: 3.6 * sc, color: i % 2 ? 0x5fbf4a : 0x9be07a, shape: "leaf", spin: i % 2 ? 9 : -9, drag: 1.2, glow: false });
      }
      return true;
    case "rainbow-entrance":
      // The arch itself draws over the greeting (DRAWN_ENTRANCES): this is
      // the fighter's arrival under it, a rainbow ripple over the floor and
      // stars in every band's colour fountaining up round the body.
      emit({ x, y, vx: 0, vy: 0, life: 0.5, size: 5 * sc, color: RAINBOW[0], shape: "shock" });
      emit({ x, y, vx: 0, vy: 0, life: 0.62, size: 9 * sc, color: RAINBOW[5], shape: "shock" });
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1,
          a = -Math.PI / 2 + side * (0.35 + (i >> 1) * 0.13);
        emit({ x: x + side * 14 * sc, y: y - 8 * sc, vx: Math.cos(a) * rnd(120, 170), vy: Math.sin(a) * rnd(150, 210), life: rnd(0.8, 1.05), size: (i % 3 ? 2.6 : 3.6) * sc, color: RAINBOW[i % 6], shape: "star", drag: 1.6, spin: side * 3 });
      }
      return true;
    case "borealis-entrance":
      // Ribbons of light fall from the sky onto the spot, green, ice blue
      // and violet; a column of light stands where they land and a ring
      // spreads over the ice, with a drift of stars after it.
      burst(9, (i) => ({ x: x + (i - 4) * 9 * sc, y: y - 150 * sc, vx: (4 - i) * 4, vy: 330 + (i % 3) * 40, life: 0.42 + (i % 3) * 0.05, size: (6 + (i % 2) * 2) * sc, color: [0x4dffb8, 0x8ff0ff, 0xb48cff][i % 3], shape: "ray" }));
      emit({ x, y, vx: 0, vy: 0, life: 0.9, size: 16 * sc, color: 0x4dffb8, shape: "beam" });
      emit({ x, y, vx: 0, vy: 0, life: 0.7, size: 10 * sc, color: 0xb48cff, shape: "beam" });
      emit({ x, y, vx: 0, vy: 0, life: 0.7, size: 14 * sc, color: 0x8ff0ff, shape: "shock" });
      burst(14, (i) => {
        const a = (i / 14) * TAU;
        return { y: y - 30 * sc, vx: Math.cos(a) * rnd(50, 110), vy: Math.sin(a) * rnd(40, 90) - 30, life: rnd(0.9, 1.4), size: (i % 3 ? 2.6 : 4) * sc, color: [0x4dffb8, 0xb48cff, 0xeafff6][i % 3], shape: "star", spin: i % 2 ? 3 : -3, drag: 1.2 };
      });
      return true;
    case "winter-entrance":
      burst(34, () => ({ x: x + rnd(-50, 50) * sc, y: y - rnd(10, 70) * sc, vx: rnd(-60, 60), vy: rnd(10, 60), life: rnd(0.8, 1.3), size: rnd(2, 3.5) * sc, color: 0xffffff, shape: "flake" }));
      return true;
  }
  return false;
}

/** Five-row pixel letters for "LEVEL UP!". */
const PIXEL_FONT: Record<string, string[]> = {
  L: ["100", "100", "100", "100", "111"],
  E: ["111", "100", "110", "100", "111"],
  V: ["101", "101", "101", "101", "010"],
  U: ["101", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  "!": ["1", "1", "1", "0", "1"],
  " ": ["0", "0", "0", "0", "0"],
};
function pixelText(g: G, text: string, cx: number, cy: number, px: number, color: number, alpha: number) {
  const width = [...text].reduce((w, ch) => w + (PIXEL_FONT[ch][0].length + 1) * px, -px);
  let x = cx - width / 2;
  for (const ch of text) {
    const rows = PIXEL_FONT[ch];
    rows.forEach((row, r) =>
      [...row].forEach((bit, c) => {
        if (bit === "1") {
          g.fillStyle(0x1a0b3d, alpha).fillRect(x + c * px + 1, cy + r * px + 1, px, px);
          g.fillStyle(color, alpha).fillRect(x + c * px, cy + r * px, px, px);
        }
      }),
    );
    x += (rows[0].length + 1) * px;
  }
}

/**
 * Victory finales, drawn every frame of the celebration (t seconds in).
 * The champion keeps its own victory move; these play around it, all of it
 * on the layer behind the fighter so nothing ever covers its face.
 */
function baseVictory(
  under: G,
  emit: Emit,
  chance: (rate: number, dt: number) => boolean,
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
  first: boolean,
) {
  if (t > 3) return false;
  const fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : 1;
  if (id === "eclipse-finale") {
    // Lv 85: a sun rises behind you, a dark moon slides across it, and at
    // totality its corona flares round you with a diamond-ring flash.
    const R = 38 * sc,
      rise = Math.min(1, t / 0.5),
      cx = x,
      cy = y - (20 + 36 * rise) * sc;
    const cover = Math.max(0, Math.min(1, (t - 0.45) / 0.85)),
      ease = 1 - (1 - cover) ** 3,
      total = t >= ECLIPSE_TOTALITY;
    under.fillStyle(0xffc85a, (total ? 0.12 : 0.28) * fade).fillCircle(cx, cy, R * 1.55);
    under.fillStyle(0xffe9a8, fade).fillCircle(cx, cy, R);
    under.fillStyle(0x161a30, fade).fillCircle(cx + (1 - ease) * R * 2.3, cy, R * 0.98);
    if (total) {
      const k = Math.min(1, (t - ECLIPSE_TOTALITY) / 0.3) * fade,
        turn = t * 0.35;
      for (const gold of [true, false]) {
        under.fillStyle(gold ? 0xffd27a : 0xb6a0ff, (gold ? 0.75 : 0.6) * k);
        for (let i = gold ? 0 : 1; i < 16; i += 2) {
          const a = turn + (i / 16) * TAU,
            w = 0.07,
            r1 = R * (gold ? 1.9 : 1.5);
          under.fillTriangle(
            cx + Math.cos(a - w) * R,
            cy + Math.sin(a - w) * R,
            cx + Math.cos(a + w) * R,
            cy + Math.sin(a + w) * R,
            cx + Math.cos(a) * r1,
            cy + Math.sin(a) * r1,
          );
        }
      }
      under.lineStyle(2.4 * sc, 0xfff1c4, 0.9 * k).strokeCircle(cx, cy, R * 1.02);
      // Stars come out in the darkened sky.
      under.fillStyle(0xfff1c4, 0.85 * k);
      for (let i = 0; i < 7; i++) {
        const a = -2.9 + i * 0.97;
        under.fillCircle(cx + Math.cos(a) * R * 2.25, cy + Math.sin(a) * R * 1.6, (1.2 + (i % 3) * 0.5) * sc);
      }
    }
    // The diamond ring: one bead of sunlight on the rim, just at totality.
    const flash = t > ECLIPSE_TOTALITY - 0.08 && t < ECLIPSE_TOTALITY + 0.5 ? Math.sin(((t - ECLIPSE_TOTALITY + 0.08) / 0.58) * Math.PI) : 0;
    if (flash > 0) {
      const fx = cx + Math.cos(-2.3) * R,
        fy = cy + Math.sin(-2.3) * R;
      under.fillStyle(0xfff1c4, 0.35 * flash * fade).fillCircle(fx, fy, 9 * sc * flash);
      sparkle(under, fx, fy, 11 * sc * flash, 0xffffff, flash * fade);
    }
    if (first)
      for (let i = 0; i < 12; i++)
        emit({ x, y: y - 40 * sc, vx: (i - 5.5) * 16, vy: -60 - Math.random() * 40, life: 1, size: 2.4 * sc, color: i % 2 ? 0xffd27a : 0xb6a0ff, shape: "star" });
    if (t >= ECLIPSE_TOTALITY && t - dt < ECLIPSE_TOTALITY)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        emit({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.8, size: (i % 2 ? 2.4 : 3.4) * sc, color: i % 2 ? 0xb6a0ff : 0xfff1c4, shape: "star" });
      }
    return true;
  }
  const journey=JOURNEY_ITEM_BY_ID[id];
  if (journey?.slot==='victory') {
    const color=parseInt(journey.color.slice(1),16), accent=parseInt(journey.accent.slice(1),16);
    for(let i=0;i<3;i++) {
      const k=Math.max(0,Math.min(1,(t-i*.25)/.65));
      if(t<i*.25)continue;
      const sx=x+(i-1)*48*sc, sy=y-100*sc+k*82*sc;
      under.lineStyle(3*sc,i%2?color:accent,.55*fade).lineBetween(sx+24*sc,sy-50*sc,sx,sy);
      sparkle(under,sx,sy,5*sc,i%2?color:accent,fade);
      if(k===1)under.lineStyle(2*sc,color,(1-Math.min(1,(t-i*.25-.65)/1.2))*fade).strokeEllipse(sx,y+8*sc,42*sc,16*sc);
    }
    if(first)for(let i=0;i<12;i++)emit({x,y:y-40*sc,vx:(i-5.5)*18,vy:-70-Math.random()*40,life:1,size:2.5*sc,color:i%2?color:accent,shape:'star'});
    return true;
  }
  switch (id) {
    case "candy-victory": {
      // A three-tier party cake rises up behind the fighter, its base
      // hidden behind the feet: frosting drips over each tier, sprinkles
      // dot it, and its candles light above the head, then confetti bursts
      // from the top. (The old cake stood below the feet, like a pink step.)
      const rise = Math.min(1, t / 0.45),
        ease = 1 - (1 - rise) ** 3;
      const tiers = [[52, 26, 0xff9ec8, 0xffe1ee], [41, 24, 0xfff0f8, 0xff9ec8], [30, 22, 0xffc2dc, 0xffffff]] as const;
      let cy = y - 4 * sc;
      tiers.forEach(([hw, h, body, icing], i) => {
        const th = h * sc * ease,
          w = hw * sc;
        const r = Math.min(4 * sc, th / 2);
        under.fillStyle(body, fade).fillRoundedRect(x - w, cy - th, w * 2, th, r);
        // Its edges: the sides and a shadow at its foot (lines and rects only:
        // the Shop's canvas previews draw these too, with no rounded stroke).
        under.lineStyle(1.6 * sc, 0xd85a90, 0.8 * fade).lineBetween(x - w, cy - th + r, x - w, cy - r).lineBetween(x + w, cy - th + r, x + w, cy - r);
        under.fillStyle(0xd85a90, 0.55 * fade).fillRect(x - w + r, cy - 2 * sc, w * 2 - r * 2, 2 * sc);
        if (ease > 0.6) {
          // Icing along the top, dripping down in round drops.
          under.fillStyle(icing, fade).fillRect(x - w, cy - th, w * 2, 5 * sc);
          for (let k = 0; k < Math.round(hw / 6); k++) {
            const dx = x - w + (k + 0.5) * ((w * 2) / Math.round(hw / 6));
            under.fillCircle(dx, cy - th + 5 * sc, (k % 2 ? 3 : 4.2) * sc);
          }
          const sprinkles = [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a];
          for (let k = 0; k < 6; k++) under.fillStyle(sprinkles[(k + i) % 4], fade).fillRect(x - w * 0.8 + k * w * 0.32, cy - th * 0.45 + ((k % 2) - 0.5) * 4 * sc, 3 * sc, 1.4 * sc);
        }
        cy -= th;
      });
      if (ease >= 1) {
        // Five candles, their flames flickering.
        for (let k = -2; k <= 2; k++) {
          const cx = x + k * 11 * sc,
            flick = Math.sin(t * 18 + k * 1.7) * 0.8 * sc;
          under.fillStyle([0x6fd6ff, 0xffd65b, 0xff6fa8][(k + 3) % 3], fade).fillRect(cx - 1.6 * sc, cy - 12 * sc, 3.2 * sc, 12 * sc);
          under.fillStyle(0xffb347, 0.35 * fade).fillCircle(cx + flick, cy - 16 * sc, 5 * sc);
          under.fillStyle(0xfff3a0, fade).fillEllipse(cx + flick, cy - 16 * sc, 3.6 * sc, 6 * sc);
        }
      }
      if (t >= 0.5 && t - dt < 0.5) {
        emit({ x, y: cy - 10 * sc, vx: 0, vy: 0, life: 0.5, size: 12 * sc, color: 0xffd2e4, shape: "ring" });
        for (let i = 0; i < 30; i++)
          emit({ x: x + rnd(-20, 20) * sc, y: cy - 14 * sc, vx: rnd(-170, 170), vy: rnd(-280, -110), life: rnd(1, 1.5), size: 2.6 * sc, color: [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a][i % 4], shape: "confetti", spin: rnd(-12, 12) });
      } else if (t > 0.6 && chance(5, dt)) {
        emit({ x: x + rnd(-50, 50) * sc, y: cy - rnd(0, 40) * sc, vx: 0, vy: -12, life: 0.6, size: 2.2 * sc, color: 0xffffff, shape: "star", fadeIn: 0.2 });
      }
      return true;
    }
    case "galaxy-victory": {
      // A supernova behind the fighter, centred above its head so the bloom
      // frames it rather than tinting it: a white-gold core flashes, a
      // shell of gas in violet, pink and ice blue swells round it, a bright
      // shock ring races out and star-streaks fly off.
      const k = Math.min(1, t / 0.8),
        ease = 1 - (1 - k) ** 2,
        cx = x,
        cy = y - 64 * sc;
      const shell = [[0x5a2a9a, 74, 0.32], [0xc86bff, 58, 0.3], [0xff7fd0, 44, 0.22], [0x9fd8ff, 30, 0.3]] as const;
      for (const [c, r, a] of shell) under.fillStyle(c, a * fade).fillCircle(cx, cy, r * sc * (0.35 + 0.65 * ease));
      const flash = t < 0.35 ? 1 - t / 0.35 : 0;
      under.fillStyle(0xfff3c4, (0.55 + 0.4 * flash) * fade).fillCircle(cx, cy, (10 + 8 * flash) * sc);
      under.fillStyle(0xffffff, (0.7 + 0.3 * flash) * fade).fillCircle(cx, cy, 5 * sc);
      if (t < 1.2) under.lineStyle(3 * sc, 0xffe7a3, 0.8 * (1 - t / 1.2) * fade).strokeCircle(cx, cy, (16 + t * 90) * sc);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t * 0.3,
          r0 = 18 * sc * ease,
          r1 = (40 + (i % 2) * 18) * sc * ease;
        under.lineStyle(1.8 * sc, i % 2 ? 0xffe7a3 : 0xffffff, 0.6 * fade).lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      if (first) for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        emit({ x: cx, y: cy, vx: Math.cos(a) * rnd(160, 240), vy: Math.sin(a) * rnd(160, 240), life: 0.7, size: 4.6 * sc, color: [0xffe7a3, 0xc86bff, 0x9fd8ff][i % 3], shape: "ray", drag: 1.2 });
      }
      if (chance(10, dt)) emit({ x: x + rnd(-70, 70) * sc, y: cy + rnd(-50, 50) * sc, vx: 0, vy: -10, life: 0.6, size: 2.4 * sc, color: 0xffffff, shape: "star" });
      return true;
    }
    case "retro-victory": {
      const pop = t < 0.25 ? t / 0.25 : 1;
      const blink = Math.floor(t * 6) % 2 ? 0xffd65b : 0x2ff3ff;
      pixelText(under, "LEVEL UP!", x, y - 86 * sc - (1 - pop) * 10 * sc, 3 * sc, blink, fade);
      if (chance(14, dt)) emit({ x: x + rnd(-40, 40) * sc, y: y - rnd(0, 60) * sc, vx: 0, vy: -40, life: 0.5, size: 2.4 * sc, color: [0xff4fd8, 0x2ff3ff, 0xffd65b][Math.floor(rnd(0, 3))], shape: "pixel" });
      return true;
    }
    case "festival-victory":
      // Fireworks: a shell bursts every 0.45 s.
      if (first || Math.floor(t / 0.45) > Math.floor((t - dt) / 0.45)) {
        const fx = x + rnd(-60, 60) * sc,
          fy = y - rnd(70, 110) * sc,
          color = [0xff4f4f, 0xffd65b, 0x7ff3ff, 0xff8fd8][Math.floor(rnd(0, 4))];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU;
          emit({ x: fx, y: fy, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 0.7, size: 4 * sc, color, shape: "spark" });
        }
      }
      return true;
    case "garden-victory":
      if (chance(26, dt))
        emit({ x: x + rnd(-80, 80) * sc, y: y - rnd(80, 120) * sc, vx: rnd(-20, 20), vy: rnd(40, 80), life: rnd(1.2, 1.8), size: 3 * sc, color: [0xffb3cf, 0xff6fa0, 0xfff0f5, 0xffd65b][Math.floor(rnd(0, 4))], shape: "leaf", spin: rnd(-6, 6) });
      return true;
    case "splashdown": {
      // Tidewyrm's reward: a wave rises behind you and crashes in spray.
      const rise = Math.min(1, t / 0.5),
        crash = t > 0.9 ? Math.min(1, (t - 0.9) / 0.4) : 0;
      const h = 90 * sc * rise * (1 - crash * 0.8);
      under.fillStyle(0x1f8fa6, 0.7 * fade).fillEllipse(x, y + 10 * sc, 150 * sc, 34 * sc);
      under.fillStyle(0x3fb3c9, 0.85 * fade).fillTriangle(x - 70 * sc, y + 12 * sc, x + 70 * sc, y + 12 * sc, x + 20 * sc * (1 - crash), y + 12 * sc - h);
      under.fillStyle(0xe6fbff, 0.9 * fade).fillCircle(x + 20 * sc * (1 - crash), y + 12 * sc - h, 10 * sc);
      if (t > 0.9 && t - dt <= 0.9)
        for (let i = 0; i < 34; i++)
          emit({ x: x + rnd(-40, 40) * sc, y: y - 50 * sc, vx: rnd(-170, 170), vy: rnd(-260, -60), life: rnd(0.7, 1.1), size: rnd(2, 3.5) * sc, color: i % 3 ? 0xe6fbff : 0x7fe9ff, shape: "dot" });
      return true;
    }
    case "twin-spark": {
      const close=Math.min(1,t/.9),distance=(70-45*close)*sc;
      for(const side of [-1,1]){
        const jx=x+side*distance,jy=y-(75+Math.sin(t*2+side)*6)*sc,color=side<0?0xffe18b:0x8edfff;
        under.fillStyle(color,fade).fillEllipse(jx,jy,40*sc,30*sc);
        under.fillStyle(0xe7f5ff,fade).fillCircle(jx-10*sc,jy-13*sc,8*sc).fillCircle(jx+3*sc,jy-16*sc,10*sc).fillCircle(jx+13*sc,jy-10*sc,7*sc);
        for(let j=0;j<3;j++)under.lineStyle(2*sc,color,fade).lineBetween(jx+(j-1)*11*sc,jy+12*sc,jx+(j-1)*11*sc+Math.sin(t*2+j)*4*sc,jy+27*sc);
      }
      if(t>.8&&t<1.7&&chance(20,dt))emit({x:x+rnd(-20,20)*sc,y:y-80*sc,vx:rnd(-60,60),vy:rnd(-50,20),life:.6,size:2.5*sc,color:Math.random()<.5?0xffe18b:0x8edfff,shape:"star"});
      return true;
    }
    case "feather-fall": {
      const spread=Math.min(1,t/.65);
      for(let i=0;i<9;i++){
        const a=-Math.PI+i*Math.PI/8,px=x+Math.cos(a)*85*sc*spread,py=y-25*sc+Math.sin(a)*70*sc*spread+Math.max(0,t-.8)*20*sc;
        under.fillStyle(i%2?0xffd28b:0xe77f5c,fade).fillEllipse(px,py,12*sc,32*sc);
        under.lineStyle(1.3*sc,0xffe8bc,fade).lineBetween(px,py-12*sc,px,py+14*sc);
      }
      return true;
    }
    case "rainbow-fan": {
      const spread=Math.min(1,t/.7), colors=[0xff899e,0xffd778,0x9aefb5,0x80e1ff,0xa5adff,0xe5a0ff];
      for(let i=0;i<9;i++){
        const a=-Math.PI+(i/8)*Math.PI,reach=100*sc*spread,px=x+Math.cos(a)*reach,py=y-25*sc+Math.sin(a)*reach;
        under.lineStyle(5*sc,colors[i%6],.6*fade).lineBetween(x,y,px,py);
        under.fillStyle(colors[i%6],.8*fade).fillTriangle(px,py-18*sc,px-12*sc,py,px,py+18*sc).fillTriangle(px,py-18*sc,px+12*sc,py,px,py+18*sc);
        under.fillStyle(0xfff9ed,fade).fillCircle(px,py,3*sc);
      }
      return true;
    }
    case "sweet-dreams": {
      // Snoozaku's reward: a little dream baku in a nightcap drifts up behind you.
      const rise = Math.min(1, t / 0.8), wx = x + Math.sin(t * 1.8) * 30 * sc, wy = y - (45 + rise * 65) * sc;
      under.fillStyle(0xc9a3ff, 0.18 * fade).fillEllipse(x, y + 6 * sc, 136 * sc, 34 * sc);
      under.fillStyle(0x9a91e0, fade).fillEllipse(wx - 6 * sc, wy + 4 * sc, 62 * sc, 36 * sc);
      under.fillStyle(0xf6e6c8, fade).fillEllipse(wx - 12 * sc, wy + 4 * sc, 20 * sc, 34 * sc);
      under.fillStyle(0x9a91e0, fade).fillCircle(wx + 20 * sc, wy - 8 * sc, 17 * sc);
      under.fillStyle(0xfff1dc, fade).fillCircle(wx + 8 * sc, wy - 18 * sc, 6 * sc);
      under.fillStyle(0x9a91e0, fade).fillCircle(wx + 34 * sc, wy - 2 * sc, 6 * sc).fillCircle(wx + 37 * sc, wy + 5 * sc, 5.5 * sc);
      under.fillStyle(0xe7b8dc, fade).fillCircle(wx + 38 * sc, wy + 10 * sc, 4.5 * sc);
      under.fillStyle(0x433d9a, fade).fillTriangle(wx + 6 * sc, wy - 20 * sc, wx + 34 * sc, wy - 22 * sc, wx + 8 * sc, wy - 46 * sc);
      under.fillStyle(0xfff4dc, fade).fillCircle(wx + 6 * sc, wy - 46 * sc, 4.5 * sc).fillEllipse(wx + 20 * sc, wy - 21 * sc, 30 * sc, 8 * sc);
      under.lineStyle(1.5 * sc, 0x283452, fade).lineBetween(wx + 20 * sc, wy - 8 * sc, wx + 27 * sc, wy - 7 * sc);
      if (chance(12, dt)) emit({ x: wx + rnd(-50, 50) * sc, y: wy + rnd(-30, 25) * sc, vx: rnd(-15, 15), vy: rnd(-35, -10), life: 1, size: 2.5 * sc, color: 0xffdf8d, shape: "star" });
      return true;
    }
    case "crescent-bow": {
      // Gloomshade's reward: a crescent moon rises behind you as you bow.
      const rise = Math.min(1, t / 0.8);
      const mx = x + 26 * sc,
        my = y - (40 + 70 * rise) * sc,
        mr = 30 * sc;
      under.fillStyle(0xffd65b, 0.16 * fade).fillCircle(mx, my, mr * 1.8);
      under.fillStyle(0xffd65b, 0.95 * fade).fillCircle(mx, my, mr);
      // The bite that makes it a crescent: the night sky behind it.
      under.fillStyle(0x161a30, fade).fillCircle(mx + mr * 0.5, my - mr * 0.2, mr * 0.85);
      if (chance(10, dt)) emit({ x: x + rnd(-80, 80) * sc, y: y - rnd(70, 140) * sc, vx: 0, vy: rnd(-10, 10), life: rnd(0.8, 1.2), size: 2.4 * sc, color: 0xfff1c2, shape: "star" });
      return true;
    }
    case "seaside-victory": {
      // The sun sinks behind the fighter, rays fanned over it, and three
      // lines of waves roll under it.
      const rise = Math.min(1, t / 0.5);
      const sy = y - (34 - 14 * Math.min(1, t / 3)) * sc;
      under.fillStyle(0xff8a4c, 0.22 * fade).fillCircle(x, sy, 58 * sc * rise);
      under.fillStyle(0xffb347, 0.5 * fade).fillCircle(x, sy, 42 * sc * rise);
      under.fillStyle(0xffe08a, 0.85 * fade).fillCircle(x, sy, 31 * sc * rise);
      under.lineStyle(2 * sc, 0xffd36b, 0.5 * fade);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI + Math.sin(t * 0.8) * 0.05,
          r0 = 46 * sc * rise,
          r1 = (60 + (i % 2) * 9) * sc * rise;
        under.lineBetween(x + Math.cos(a) * r0, sy + Math.sin(a) * r0, x + Math.cos(a) * r1, sy + Math.sin(a) * r1);
      }
      for (let w = 0; w < 3; w++) {
        const wy = y + (8 + w * 9) * sc,
          half = (62 - w * 6) * sc,
          sway = Math.sin(t * 2.2 + w * 1.3) * 5 * sc;
        under.fillStyle([0x2f9ec4, 0x4fc3d8, 0x8fe6e8][w], (0.8 - w * 0.1) * fade * rise).fillEllipse(x + sway, wy, half * 2, 10 * sc);
        under.lineStyle(1.4 * sc, 0xffffff, 0.7 * fade * rise).beginPath();
        under.arc(x + sway - half * 0.3 + w * 14 * sc, wy - 1 * sc, 9 * sc, Math.PI * 1.15, Math.PI * 1.85);
        under.strokePath();
      }
      if (chance(8, dt)) emit({ x: x + rnd(-50, 50) * sc, y: y + rnd(0, 20) * sc, vx: rnd(-10, 10), vy: rnd(-50, -25), life: rnd(0.8, 1.2), size: 2.6 * sc, color: 0xffffff, shape: "bubble" });
      return true;
    }
    case "steamworks-victory": {
      // A great clock rises behind the fighter: a toothed brass rim that
      // turns, a cream face, hands that sweep round to twelve and a chime
      // of sparks and cogs when they meet.
      const rise = Math.min(1, t / 0.35),
        cy = y - 30 * sc,
        R = 46 * sc * (0.6 + 0.4 * rise);
      under.fillStyle(0xc8862a, fade);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * 0.5;
        under.fillTriangle(x + Math.cos(a - 0.1) * R, cy + Math.sin(a - 0.1) * R, x + Math.cos(a + 0.1) * R, cy + Math.sin(a + 0.1) * R, x + Math.cos(a) * (R + 7 * sc), cy + Math.sin(a) * (R + 7 * sc));
      }
      under.fillStyle(0xe0a23a, fade).fillCircle(x, cy, R);
      under.fillStyle(0xfff6dc, 0.96 * fade).fillCircle(x, cy, R * 0.84);
      under.lineStyle(1.6 * sc, 0x6a4418, 0.9 * fade);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU,
          r0 = R * (i % 3 ? 0.72 : 0.64);
        under.lineBetween(x + Math.cos(a) * r0, cy + Math.sin(a) * r0, x + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
      }
      const k = Math.min(1, t / 1.1),
        left = (1 - k) ** 3,
        minute = -Math.PI / 2 - left * TAU * 2,
        hour = -Math.PI / 2 - left * TAU * 0.4;
      under.lineStyle(3.2 * sc, 0x4a2f14, fade).lineBetween(x, cy, x + Math.cos(hour) * R * 0.42, cy + Math.sin(hour) * R * 0.42);
      under.lineStyle(2.2 * sc, 0x4a2f14, fade).lineBetween(x, cy, x + Math.cos(minute) * R * 0.66, cy + Math.sin(minute) * R * 0.66);
      under.fillStyle(0xe0a23a, fade).fillCircle(x, cy, 3.4 * sc);
      if (t >= 1.1 && t - dt < 1.1) {
        emit({ x, y: cy, vx: 0, vy: 0, life: 0.6, size: 15 * sc, color: 0xffe6a6, shape: "ring" });
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          emit({ x, y: cy, vx: Math.cos(a) * rnd(110, 190), vy: Math.sin(a) * rnd(110, 190), life: rnd(0.6, 1), size: (i % 2 ? 3.4 : 2.6) * sc, color: i % 2 ? 0xe0a23a : 0xffe6a6, shape: i % 2 ? "coin" : "spark", spin: i % 2 ? 9 : 0, drag: 1.4 });
        }
      } else if (t > 1.1 && chance(8, dt)) {
        const a = rnd(0, TAU);
        emit({ x: x + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 20, life: 0.5, size: 2.4 * sc, color: 0xffe6a6, shape: "spark" });
      }
      return true;
    }
    case "trophy-victory": {
      // A gold trophy rises from behind the fighter until its plinth is
      // clear of the head, a glint runs over its cup, and sparkles and
      // confetti burst once it is up. Cup, stem and plinth are one piece.
      const rise = Math.min(1, t / 0.6),
        ease = 1 - (1 - rise) ** 3,
        s = sc * (0.7 + 0.3 * ease),
        base = y - (10 + 60 * ease) * sc;
      under.fillStyle(0xffe08a, 0.2 * fade * ease).fillCircle(x, base - 28 * s, 44 * s);
      under.fillStyle(0x6a4a2a, fade).fillRect(x - 14 * s, base, 28 * s, 8 * s);
      under.fillStyle(0x8a6234, fade).fillRect(x - 10 * s, base - 4 * s, 20 * s, 5 * s);
      under.fillStyle(0xd9a33a, fade).fillRect(x - 3 * s, base - 16 * s, 6 * s, 13 * s);
      under.fillStyle(0xe0b048, fade).fillEllipse(x, base - 15 * s, 13 * s, 5 * s);
      // The cup: two handles, a bowl rounded at the bottom down onto the
      // stem, and its rim.
      under.lineStyle(3.2 * s, 0xd9a33a, fade);
      for (const d of [-1, 1]) {
        under.beginPath();
        under.arc(x + d * 19 * s, base - 37 * s, 7 * s, d < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, d < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
        under.strokePath();
      }
      under.fillStyle(0xf2c14e, fade).fillRect(x - 18 * s, base - 46 * s, 36 * s, 16 * s);
      under.fillEllipse(x, base - 30 * s, 36 * s, 26 * s);
      under.fillStyle(0xffe08a, fade).fillEllipse(x, base - 46 * s, 38 * s, 7 * s);
      under.fillStyle(0x8a5a1a, 0.9 * fade).fillEllipse(x, base - 46 * s, 30 * s, 4 * s);
      const g = (t % 1.4) / 1.4;
      under.fillStyle(0xffffff, 0.55 * fade * Math.sin(g * Math.PI)).fillRect(x - 15 * s + g * 26 * s, base - 43 * s, 3.4 * s, 22 * s);
      if (t >= 0.6 && t - dt < 0.6) {
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI * (0.08 + (i / 17) * 0.84);
          emit({ x, y: base - 48 * s, vx: Math.cos(a) * rnd(90, 170), vy: Math.sin(a) * rnd(120, 200), life: rnd(0.9, 1.3), size: 2.6 * sc, color: [0xf2c14e, 0xff6f8a, 0x6fd6ff, 0xffffff][i % 4], shape: "confetti", spin: rnd(-10, 10) });
        }
      } else if (t > 0.6 && chance(7, dt)) {
        emit({ x: x + rnd(-24, 24) * s, y: base - rnd(24, 54) * s, vx: 0, vy: rnd(-24, -8), life: 0.6, size: rnd(2, 3) * sc, color: 0xfff3c4, shape: "star", fadeIn: 0.2 });
      }
      return true;
    }
    case "meteor-victory": {
      // A meteor shower crosses the sky behind the fighter: streaks fall at
      // a slant, stars come out, and the largest meteor bursts overhead in
      // a crown of sparks.
      const rise = Math.min(1, t / 0.4);
      under.fillStyle(0x1a1f4a, 0.3 * fade * rise).fillCircle(x, y - 54 * sc, 92 * sc);
      under.fillStyle(0x3a2a6a, 0.22 * fade * rise).fillCircle(x, y - 70 * sc, 64 * sc);
      if (first || chance(9, dt)) {
        emit({ x: x + rnd(-30, 120) * sc, y: y - rnd(100, 145) * sc, vx: -rnd(260, 340), vy: rnd(170, 230), life: rnd(0.45, 0.7), size: rnd(4, 6.5) * sc, color: [0xffd36b, 0xff8a4c, 0x9fd8ff][Math.floor(rnd(0, 3))], shape: "ray" });
      }
      if (chance(10, dt)) emit({ x: x + rnd(-90, 90) * sc, y: y - rnd(50, 130) * sc, vx: 0, vy: rnd(-10, -2), life: rnd(0.5, 0.9), size: rnd(1.8, 3) * sc, color: 0xffffff, shape: "star", fadeIn: 0.25 });
      if (t >= 1.3 && t - dt < 1.3) {
        const cy = y - 100 * sc;
        emit({ x, y: cy, vx: 0, vy: 0, life: 0.6, size: 16 * sc, color: 0xffd36b, shape: "ring" });
        emit({ x, y: cy, vx: 0, vy: 0, life: 0.85, size: 22 * sc, color: 0x9fd8ff, shape: "ring" });
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          emit({ x, y: cy, vx: Math.cos(a) * rnd(120, 210), vy: Math.sin(a) * rnd(100, 180), life: rnd(0.6, 1), size: (i % 2 ? 4.6 : 3.2) * sc, color: i % 2 ? 0xffd36b : 0xffffff, shape: i % 2 ? "ray" : "star", drag: 1.3 });
        }
      }
      return true;
    }
    case "balloon-victory": {
      // Balloons rise from behind the fighter, one after another, swaying
      // on their strings; a little confetti pops as the first goes up.
      const cols = [0xff4f6a, 0xffd65b, 0x4fb6ff, 0x7ee06a, 0xff8fd0, 0xa77bff, 0xff9f43];
      for (let i = 0; i < 9; i++) {
        const t0 = i * 0.28,
          age = t - t0;
        if (age <= 0) continue;
        // Left and right in turn (the old formula sent the first five left).
        const side = [-0.4, 0.38, -0.12, 0.5, 0.08, -0.32, 0.24, -0.5, 0.14][i],
          bx = x + side * 80 * sc + Math.sin(age * 2.2 + i) * 6 * sc,
          by = y - (20 + age * (46 + (i % 3) * 12)) * sc;
        if (by < y - 190 * sc) continue;
        const c = cols[i % cols.length],
          r = (9 + (i % 2) * 2) * sc;
        under.lineStyle(1 * sc, 0xffffff, 0.55 * fade).lineBetween(bx, by + r * 1.15, bx - side * 6 * sc, by + r * 1.15 + 22 * sc);
        under.fillStyle(c, fade).fillEllipse(bx, by, r * 1.7, r * 2.1);
        under.fillTriangle(bx - 2 * sc, by + r * 1.15, bx + 2 * sc, by + r * 1.15, bx, by + r * 0.95);
        under.fillStyle(0xffffff, 0.55 * fade).fillEllipse(bx - r * 0.3, by - r * 0.4, r * 0.4, r * 0.6);
      }
      if (t >= 0.3 && t - dt < 0.3)
        for (let i = 0; i < 20; i++) emit({ x: x + rnd(-30, 30) * sc, y: y - 60 * sc, vx: rnd(-130, 130), vy: rnd(-200, -80), life: rnd(0.9, 1.3), size: 2.4 * sc, color: cols[i % cols.length], shape: "confetti", spin: rnd(-12, 12) });
      return true;
    }
    case "disco-victory": {
      // A disco ball drops in above the fighter on its cord and spins:
      // its mirror tiles glint, coloured beams sweep down to the floor and
      // spots of light chase round it.
      const drop = Math.min(1, t / 0.4),
        ease = 1 - (1 - drop) ** 3,
        bx = x,
        by = y - (150 - 66 * ease) * sc,
        r = 15 * sc,
        spin = t * 2.4;
      const beams = [0xff4fd8, 0x4fb6ff, 0xffe066, 0x5fdc7a];
      if (ease >= 1)
        beams.forEach((c, i) => {
          const a = spin * 0.8 + (i / 4) * TAU,
            fx = x + Math.cos(a) * 64 * sc,
            fy = y + 6 * sc + Math.sin(a) * 14 * sc;
          under.fillStyle(c, 0.16 * fade).fillTriangle(bx, by, fx - 10 * sc, fy, fx + 10 * sc, fy);
          under.fillStyle(c, 0.4 * fade).fillEllipse(fx, fy, 22 * sc, 7 * sc);
        });
      under.lineStyle(1.2 * sc, 0xd9d9e6, 0.8 * fade).lineBetween(bx, by - r, bx, y - 190 * sc);
      under.fillStyle(0x9aa3b8, fade).fillCircle(bx, by, r);
      // Mirror tiles: rows of small squares whose brightness turns with it.
      for (let row = -2; row <= 2; row++) {
        const ry = by + row * r * 0.36,
          half = Math.sqrt(1 - (row * 0.36) ** 2) * r;
        for (let col = 0; col < 6; col++) {
          const u = ((col + spin * 1.6) % 6) / 6,
            tx = bx - half + u * half * 2,
            lit = Math.sin(u * Math.PI);
          under.fillStyle(lit > 0.8 ? 0xffffff : 0xc9d1e6, (0.4 + 0.6 * lit) * fade).fillRect(tx - 1.6 * sc, ry - 1.6 * sc, 3.2 * sc, 3.2 * sc);
        }
      }
      under.fillStyle(0xffffff, 0.6 * fade).fillCircle(bx - r * 0.35, by - r * 0.4, r * 0.25);
      if (ease >= 1 && chance(8, dt)) emit({ x: bx + rnd(-r, r), y: by + rnd(-r, r), vx: rnd(-60, 60), vy: rnd(-30, 30), life: 0.5, size: 2.6 * sc, color: 0xffffff, shape: "star" });
      return true;
    }
    case "borealis-victory": {
      // Three curtains of light across the sky behind the fighter: each a
      // row of rays hanging from a line that ripples, brighter where the
      // ripple passes, with stars coming out between them.
      const rise = Math.min(1, t / 0.6);
      const bands = [[0xb48cff, -96, 40, 3.1], [0x4dffb8, -80, 54, 0], [0x8ff0ff, -62, 40, 1.7]] as const;
      const N = 22;
      for (const [color, top, h, ph] of bands) {
        let lx = 0,
          ly = 0;
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1) - 0.5,
            px = x + u * 164 * sc,
            py = y + (top + Math.sin(u * 6 + t * 1.6 + ph) * 9 - Math.cos(u * Math.PI) * 16) * sc,
            len = h * (0.55 + 0.45 * Math.sin(u * 9 + t * 2.3 + ph) ** 2) * sc * rise,
            edge = 1 - Math.abs(u) * 1.4,
            a = (0.16 + 0.22 * (0.5 + 0.5 * Math.sin(u * 11 - t * 2 + ph))) * fade * rise * Math.max(0, edge),
            w = 5.2 * sc;
          // A ray: full width at the line, thinning to a point below it.
          under.fillStyle(color, a).fillRect(px - w, py, w * 2, len * 0.35);
          under.fillTriangle(px - w, py + len * 0.35, px + w, py + len * 0.35, px, py + len);
          // The line the rays hang from, drawn from ray to ray.
          if (i) under.lineStyle(2.2 * sc, 0xeafff6, 0.75 * fade * rise * Math.max(0, edge)).lineBetween(lx, ly, px, py);
          lx = px;
          ly = py;
        }
      }
      if (chance(12, dt)) emit({ x: x + rnd(-80, 80) * sc, y: y - rnd(40, 110) * sc, vx: 0, vy: rnd(-14, -4), life: rnd(0.6, 1), size: rnd(2, 3.4) * sc, color: [0xeafff6, 0x4dffb8, 0xb48cff][Math.floor(rnd(0, 3))], shape: "star", fadeIn: 0.3 });
      return true;
    }
    case "winter-victory": {
      // A snow globe: a glassy dome with a swirl of snow.
      under.fillStyle(0xbfe8ff, 0.14 * fade).fillCircle(x, y - 18 * sc, 48 * sc);
      under.lineStyle(2 * sc, 0xffffff, 0.6 * fade).strokeCircle(x, y - 18 * sc, 48 * sc);
      under.lineStyle(3 * sc, 0xffffff, 0.35 * fade).beginPath();
      under.arc(x, y - 18 * sc, 42 * sc, -2.6, -1.9);
      under.strokePath();
      under.fillStyle(0x8a5a3a, fade).fillRoundedRect(x - 36 * sc, y + 24 * sc, 72 * sc, 10 * sc, 3 * sc);
      if (chance(30, dt)) {
        const a = rnd(0, TAU),
          r = rnd(0, 40) * sc;
        emit({ x: x + Math.cos(a) * r, y: y - 18 * sc + Math.sin(a) * r, vx: rnd(-30, 30), vy: rnd(-10, 30), life: 0.7, size: 2.2 * sc, color: 0xffffff, shape: "flake" });
      }
      return true;
    }
  }
  return false;
}

/**
 * Auras: the piece's own ring and items, then its rarity flourish
 * (tier-fx.ts). Returns false if the id is unknown.
 */
export function drawCollectionAura(g: G, id: string, x: number, y: number, now: number, reduced: boolean, front?: G, flat: number = WORLD_ART.groundY, lift = AURA_LIFT) {
  if (!drawCollectionAuraBase(g, id, x, y, now, reduced, front, flat, lift)) return false;
  auraFlourish(g, id, x, y, now, reduced, flat, front);
  return true;
}
/**
 * How many particles one entrance may emit: the fighter's rig keeps 48 and
 * drops the oldest for each new one (rig.ts MAX_PARTICLES). Emitting more
 * lost the piece's own burst, which goes first: a Mythical entrance's
 * flourish alone is 50, so Galaxy's star tunnel and Borealis's ribbons
 * never showed, and both looked the same.
 */
export const ENTRANCE_BUDGET = 48;
const STRUCTURAL = new Set(["shock", "beam", "ring"]);
/** Every n-th of a list, evenly spread, so rings of particles stay rings. */
const spread = <T,>(a: T[], n: number) => (n >= a.length ? a : Array.from({ length: n }, (_, i) => a[Math.floor((i * a.length) / n)]));
/**
 * Fit a burst into the budget: shockwaves, pillars and rings always stay;
 * the rest is thinned evenly, the piece's own burst ahead of its flourish.
 */
export function fitEntrance(own: FxParticle[], extra: FxParticle[], budget = ENTRANCE_BUDGET): FxParticle[] {
  if (own.length + extra.length <= budget) return [...own, ...extra];
  const keep = (a: FxParticle[]) => a.filter((p) => STRUCTURAL.has(p.shape));
  const rest = (a: FxParticle[]) => a.filter((p) => !STRUCTURAL.has(p.shape));
  const [keepO, keepE, restO, restE] = [keep(own), keep(extra), rest(own), rest(extra)];
  const room = Math.max(0, budget - keepO.length - keepE.length);
  const nO = Math.min(restO.length, Math.max(Math.ceil(room * 0.6), room - restE.length));
  return [...keepO, ...spread(restO, nO), ...keepE, ...spread(restE, Math.min(restE.length, room - nO))];
}
/** A one-off burst when the round greeting starts, plus its rarity flourish. */
export function playCollectionEntrance(emit0: Emit, id: string, x: number, y: number, sc: number, flourishOnly = false) {
  // A soft halo under each particle, unless it says otherwise (big pieces
  // such as a gift box's walls would turn into a blur).
  const own: FxParticle[] = [],
    extra: FxParticle[] = [];
  const known = flourishOnly || baseEntrance((p) => own.push({ glow: true, ...p }), id, x, y, sc);
  if (known) entranceFlourish((p) => extra.push({ glow: true, ...p }), id, x, y, sc);
  for (const p of fitEntrance(own, extra)) emit0(p);
  return known;
}
/** Rainbow entrance's arch, in seconds from the greeting. */
const ARCH = {
  /** It springs out of the left cloud and lands on the right one. */
  grow: 0.34,
  /** A sheen runs along it. */
  sheen: [0.75, 1.35],
  /** It rolls up into the right cloud, and the clouds puff away. */
  roll: [1.45, 1.9],
  clouds: [1.85, 2.15],
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
/** A pop with a little overshoot (0 → 1). */
const pop = (k: number) => (k >= 1 ? 1 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2);
/** A cartoon cloud standing on the floor at (cx, cy), `s` its scale. */
function cloud(g: G, cx: number, cy: number, s: number, alpha: number) {
  g.fillStyle(0xbcc9ec, 0.85 * alpha).fillEllipse(cx, cy + 2 * s, 42 * s, 11 * s);
  g.fillStyle(0xffffff, alpha)
    .fillCircle(cx - 11 * s, cy - 4 * s, 8 * s)
    .fillCircle(cx + 1 * s, cy - 10 * s, 11 * s)
    .fillCircle(cx + 12 * s, cy - 4 * s, 7.5 * s)
    .fillEllipse(cx, cy - 1 * s, 40 * s, 12 * s);
}
/**
 * Rainbow (Epic entrance): a six-band rainbow springs out of a cloud beside
 * the fighter, arcs over its head and lands on a cloud on the other side
 * with a burst of sparkles; a sheen runs along it and stars twinkle on the
 * bands, then it rolls up into the far cloud and the clouds puff away. All
 * behind the fighter, which stands framed under the arch.
 */
function drawRainbowArch(g: G, x: number, y0: number, sc: number, t: number) {
  // It stands on the floor, where the fighter's feet are.
  const y = y0 + WORLD_ART.fighterFeet * sc;
  const bw = 6 * sc,
    rOut = 112 * sc,
    rMid = rOut - 3 * bw;
  const head = easeOut(clamp01(t / ARCH.grow)),
    tail = clamp01((t - ARCH.roll[0]) / (ARCH.roll[1] - ARCH.roll[0])) ** 2;
  const a0 = Math.PI * (1 + tail),
    a1 = Math.PI * (1 + head);
  const at = (a: number, r: number) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  if (a1 - a0 > 0.01) {
    // The bands, and a bright rim.
    RAINBOW.forEach((c, i) => {
      g.lineStyle(bw + 0.8 * sc, c, 0.92).beginPath();
      g.arc(x, y, rOut - bw * (i + 0.5), a0, a1).strokePath();
    });
    g.lineStyle(1.6 * sc, 0xffffff, 0.6).beginPath();
    g.arc(x, y, rOut, a0, a1).strokePath();
    // The sheen: a band of light sweeping along the arch.
    const k = (t - ARCH.sheen[0]) / (ARCH.sheen[1] - ARCH.sheen[0]);
    if (k > 0 && k < 1) {
      const a = Math.PI * (1.04 + k * 0.92);
      g.lineStyle(bw * 6, 0xffffff, 0.42 * Math.sin(k * Math.PI)).beginPath();
      g.arc(x, y, rMid, Math.max(a0, a - 0.13), Math.min(a1, a + 0.13)).strokePath();
    }
    // Stars twinkle on the bands while it stands.
    if (t > ARCH.grow)
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.14 + i * 0.18);
        const blink = Math.max(0, Math.sin(t * 7 + i * 2.1)) ** 3;
        if (a > a0 && blink > 0.05) {
          const p = at(a, rOut - bw * (1 + (i % 3) * 2));
          sparkle(g, p.x, p.y, 4.5 * sc, 0xffffff, 0.95 * blink);
        }
      }
  }
  // A star rides the tip as it arcs over.
  if (t < ARCH.grow + 0.08) {
    const p = at(a1, rMid),
      fade = 1 - clamp01((t - ARCH.grow) / 0.08);
    g.fillStyle(0xffffff, 0.3 * fade).fillCircle(p.x, p.y, 13 * sc);
    sparkle(g, p.x, p.y, 9 * sc, 0xffffff, fade);
  }
  // Where it lands: a ring over the floor and sparkles in every colour.
  const landed = t - ARCH.grow * 0.92;
  if (landed > 0 && landed < 0.6) {
    const k = landed / 0.6,
      lx = x + rMid;
    g.lineStyle(2.2 * sc, 0xffffff, 0.7 * (1 - k)).strokeEllipse(lx, y, 40 * sc * (0.4 + k), 12 * sc * (0.4 + k));
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * (0.2 + (i / 7) * 0.6),
        d = 36 * sc * easeOut(k);
      sparkle(g, lx + Math.cos(a) * d, y - 8 * sc + Math.sin(a) * d * 0.9, (3.6 - k * 1.6) * sc, RAINBOW[i % 6], 1 - k * k);
    }
  }
  // The clouds: the first pops up at once, the second as the arch lands;
  // they puff away at the end.
  const gone = clamp01((t - ARCH.clouds[0]) / (ARCH.clouds[1] - ARCH.clouds[0]));
  const left = pop(clamp01(t / 0.18)),
    right = pop(clamp01((t - ARCH.grow * 0.8) / 0.18));
  if (left > 0) cloud(g, x - rMid, y, sc * left * (1 + gone * 0.3), 1 - gone);
  if (t > ARCH.grow * 0.8) cloud(g, x + rMid, y, sc * right * (1 + gone * 0.3), 1 - gone);
}
/**
 * Entrances that draw as well as burst (call each frame of the greeting with
 * t seconds into it), behind the fighter. `reach` is the room the drawing
 * takes in a thumbnail, in entrance units (its usual frame is 104 wide by 92
 * tall, the effect's origin 0.82 of the way down), and `still` the moment a
 * catalogue tile shows.
 */
export const DRAWN_ENTRANCES: Record<string, { length: number; reach: { w: number; h: number; feet: number }; still: number; draw: (under: G, x: number, y: number, sc: number, t: number) => void }> = {
  "rainbow-entrance": { length: ARCH.clouds[1], reach: { w: 256, h: 136, feet: 0.74 }, still: 0.55, draw: drawRainbowArch },
};
/** Draw an entrance's drawn part. False when it has none or has played. */
export function drawCollectionEntrance(under: G, id: string, x: number, y: number, sc: number, t: number) {
  const drawn = DRAWN_ENTRANCES[id];
  if (!drawn || t < 0 || t > drawn.length) return false;
  drawn.draw(under, x, y, sc, t);
  return true;
}
/**
 * Victory finales (t seconds in), plus their rarity flourish. Everything
 * draws on `under` and every particle is emitted `behind`: a finale plays
 * behind the champion and never covers its face. `_front` (the layer in
 * front of the fighter) is accepted for the call shape but never drawn on.
 */
export function drawCollectionVictory(
  _front: G,
  under: G,
  emit: Emit,
  chance: (rate: number, dt: number) => boolean,
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
  first: boolean,
) {
  const emit0 = emit;
  emit = (p) => emit0({ ...p, glow: true, behind: true });
  const known = baseVictory(under, emit, chance, id, x, y, sc, t, dt, first);
  // Rig-drawn pieces (Rockslide Flex) still get their flourish.
  if (known || id === "rockslide-flex")
    victoryFlourish(under, emit, chance, id, x, y, sc, t, dt);
  return known;
}
