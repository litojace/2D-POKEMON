import { RULES } from "@arena/shared";
import { paintKit } from "./arena-courts";
import type { RaidFloorId } from "./raid-floors";
import { GLOOMSHADE } from "../../../packages/shared/src/raid";
import grumblecrag from "./art/raid-arenas/grumblecrag.webp";
import tidewyrm from "./art/raid-arenas/tidewyrm.webp";
import gloomshade from "./art/raid-arenas/gloomshade.webp";
import somnara from "./art/raid-arenas/somnara.webp";
import prismatail from "./art/raid-arenas/prismatail.webp";
import emberwing from "./art/raid-arenas/emberwing.webp";
import stormTwins from "./art/raid-arenas/storm-twins.webp";

export type IllustratedRaidFloor = RaidFloorId | "raid-coliseum";
export const RAID_ARENA_ART: Record<IllustratedRaidFloor, string> = {
  "raid-coliseum": grumblecrag,
  lagoon: tidewyrm,
  "lantern-yard": gloomshade,
  "cloud-deck": somnara,
  "sun-atrium": prismatail,
  "sky-terrace": emberwing,
  "conductor-ring": stormTwins,
};
export const isIllustratedRaidFloor = (
  id: string,
): id is IllustratedRaidFloor => Object.hasOwn(RAID_ARENA_ART, id);

/** Only the selected arena is decoded; bake once, then release the source image. */
export function loadRaidArenaArt(
  id: IllustratedRaidFloor,
  paint: (image: HTMLImageElement) => void,
) {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    paint(image);
    image.onload = null;
    image.onerror = null;
  };
  // The procedural floor remains playable if an offline asset is unavailable.
  image.onerror = () => {
    image.onload = null;
    image.onerror = null;
  };
  image.src = RAID_ARENA_ART[id];
}

/** Gameplay landmarks use world coordinates, never the generated illustration. */
export function paintIllustratedRaidFloor(
  c: CanvasRenderingContext2D,
  id: IllustratedRaidFloor,
  image: HTMLImageElement,
) {
  const { width: W, height: H } = RULES;
  c.save();
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  c.drawImage(image, 0, 0, W, H);
  // Keep white/cyan warnings readable over bright marble and water caustics.
  c.fillStyle = id === "lagoon" ? "#062c3a28" : "#0c112317";
  c.fillRect(0, 0, W, H);
  // A little common material grain also stays crisp on dense-screen canvas bakes.
  paintKit.grain(c, 0, 0, W, H, 0.08, 731, [
    [70, 0.3],
    [4, 0.2],
  ]);
  const ring = (x: number, y: number, r: number, color: string, width = 2) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  };
  if (id === "lagoon") {
    ring(800, 450, 150, "#c2f6ec55");
    ring(800, 450, 230, "#c2f6ec33");
  } else if (id === "lantern-yard") {
    const { cols, rows } = GLOOMSHADE.hands;
    const tw = W / cols,
      th = H / rows;
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < rows; row++) {
        c.fillStyle = (col + row) % 2 === 0 ? "#c3b9f31c" : "#05061920";
        c.fillRect(col * tw, row * th, tw, th);
      }
    c.strokeStyle = "#bcb0db5c";
    c.lineWidth = 2;
    c.beginPath();
    for (let col = 1; col < cols; col++) {
      c.moveTo(col * tw, 0);
      c.lineTo(col * tw, H);
    }
    for (let row = 1; row < rows; row++) {
      c.moveTo(0, row * th);
      c.lineTo(W, row * th);
    }
    c.stroke();
    ring(800, 430, 120, "#c8b7ec55");
    ring(800, 430, 150, "#c8b7ec33");
  } else if (id === "sky-terrace") {
    ring(800, 450, 260, "#c39a6966", 3);
  } else if (id === "sun-atrium") {
    ring(1000, 450, 210, "#997546aa", 3);
    ring(1000, 450, 310, "#997546aa", 3);
    const colors = [
      "#d97c91",
      "#e0ba70",
      "#80b9a8",
      "#70a9c7",
      "#8d8dc0",
      "#b18dbd",
    ];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        x = 1000 + Math.cos(a) * 310,
        y = 450 + Math.sin(a) * 310;
      c.fillStyle = colors[i % 6];
      c.beginPath();
      c.moveTo(x, y - 10);
      c.lineTo(x + 6, y);
      c.lineTo(x, y + 10);
      c.lineTo(x - 6, y);
      c.closePath();
      c.fill();
    }
  } else if (id === "conductor-ring") {
    for (const [rx, ry] of [
      [730, 380],
      [710, 360],
      [500, 285],
    ]) {
      c.strokeStyle = rx === 710 ? "#a5daf055" : "#c4906366";
      c.lineWidth = rx === 730 ? 4 : 2;
      c.beginPath();
      c.ellipse(800, 450, rx, ry, 0, 0, Math.PI * 2);
      c.stroke();
    }
    ring(800, 450, 150, "#a5daf044");
  } else if (id === "cloud-deck") {
    ring(800, 450, 275, "#c9a3ff77", 2.5);
    c.fillStyle = "#e6e4ff99";
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.beginPath();
      c.arc(
        800 + Math.cos(a) * 275,
        450 + Math.sin(a) * 275,
        3.5,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  // A restrained rim makes the world boundary clear without hiding live warnings.
  c.strokeStyle = "#c7c1b444";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(18, 18, W - 36, H - 36, 18);
  c.stroke();
  c.restore();
}
