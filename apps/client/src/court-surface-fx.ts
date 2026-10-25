import type Phaser from "phaser";
import { ARENAS } from "@arena/shared";
import type { CourtId } from "./arena-courts";

/**
 * What a fight kicks up from each court's ground: sand on the Coliseum, wet
 * sand (and spray by the pool) at Tide Pools, sparks and ash on the forge's
 * stone, chips and grit in the ruins. Bursts sit on the ground, under the
 * fighters' feet, and sort with them.
 */
export type SurfaceKind = "hit" | "ko" | "land" | "dash";

const TEX = { dust: "surface-dust", grain: "surface-grain", spark: "surface-spark", leaf: "surface-leaf" };

function textures(scene: Phaser.Scene) {
  if (scene.textures.exists(TEX.dust)) return;
  const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!);
    scene.textures.addCanvas(key, canvas);
  };
  // White shapes, tinted per court.
  make(TEX.dust, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.5, "rgba(255,255,255,0.4)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  make(TEX.grain, 8, 8, (c) => {
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(4, 4, 3, 0, Math.PI * 2);
    c.fill();
  });
  make(TEX.spark, 4, 14, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 14);
  });
  make(TEX.leaf, 10, 6, (c) => {
    c.fillStyle = "#fff";
    c.beginPath();
    c.ellipse(5, 3, 4.5, 2.4, 0, 0, Math.PI * 2);
    c.fill();
  });
}

/** Per court: dust tint, grain tints, and what else flies. */
const LOOK: Record<CourtId, { dust: number; grains: number[]; extra?: "spark" | "leaf" }> = {
  classic: { dust: 0xe2cfa4, grains: [0xd9c08c, 0xbfa472, 0xeadbb8] },
  "tide-pools": { dust: 0xcdbf9c, grains: [0x9e8c66, 0x8a7a58, 0xbcae8c] },
  "ember-forge": { dust: 0x8a817a, grains: [0x5a534c, 0x77706a], extra: "spark" },
  "shifting-ruins": { dust: 0xd8ccae, grains: [0xb8a984, 0x968866, 0xcbbf9f], extra: "leaf" },
};

/** Spray of water instead of sand when the hit lands in or by the tide pool. */
function nearPool(court: CourtId, x: number, y: number) {
  if (court !== "tide-pools") return false;
  return ARENAS["tide-pools"].hazards.some(
    (h) => h.kind === "pool" && Math.hypot(x - h.x, y - h.y) < h.radius + 20,
  );
}

export function surfaceBurst(
  scene: Phaser.Scene,
  court: CourtId,
  x: number,
  y: number,
  kind: SurfaceKind,
  depth: number,
  reduced: boolean,
) {
  textures(scene);
  const look = LOOK[court];
  const wet = nearPool(court, x, y);
  const size = kind === "ko" ? 1.8 : kind === "hit" ? 1 : kind === "land" ? 0.8 : 0.55;
  // A low cloud along the ground.
  const puffs = reduced ? 1 : kind === "ko" ? 6 : kind === "dash" ? 2 : 3;
  for (let k = 0; k < puffs; k++) {
    const puff = scene.add
      .image(x + (Math.random() - 0.5) * 30 * size, y + (Math.random() - 0.5) * 8, TEX.dust)
      .setTint(wet ? 0xd8f1ff : look.dust)
      .setAlpha(wet ? 0.5 : 0.55)
      .setScale(0.5 * size, 0.28 * size)
      .setDepth(depth - 0.00005);
    scene.tweens.add({
      targets: puff,
      x: puff.x + (Math.random() - 0.5) * 70 * size,
      y: puff.y - 6 - Math.random() * 10,
      scaleX: 1.5 * size,
      scaleY: 0.8 * size,
      alpha: 0,
      duration: reduced ? 300 : 520 + Math.random() * 300,
      ease: "Quad.Out",
      onComplete: () => puff.destroy(),
    });
  }
  if (reduced || kind === "dash") return;
  // Grains (or droplets) thrown up and falling back.
  const grains = kind === "ko" ? 16 : kind === "hit" ? 8 : 5;
  for (let k = 0; k < grains; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4,
      v = (40 + Math.random() * 60) * size;
    const tx = x + Math.cos(a) * v,
      ty = y + (Math.random() - 0.3) * 18;
    const g = scene.add
      .image(x, y - 4, TEX.grain)
      .setTint(wet ? 0x9fdcf5 : look.grains[k % look.grains.length])
      .setScale(0.7 + Math.random() * 0.5)
      // In front of the fighter they fly off (the dust stays behind its feet).
      .setDepth(depth + 0.0003);
    const peak = y - 20 - Math.random() * 30 * size;
    scene.tweens.add({ targets: g, x: tx, duration: 420, ease: "Linear" });
    scene.tweens.add({
      targets: g,
      y: peak,
      duration: 180,
      ease: "Quad.Out",
      yoyo: false,
      onComplete: () =>
        scene.tweens.add({
          targets: g,
          y: ty,
          duration: 240,
          ease: "Quad.In",
          onComplete: () =>
            scene.tweens.add({ targets: g, alpha: 0, duration: 260, delay: 120, onComplete: () => g.destroy() }),
        }),
    });
  }
  if (look.extra === "spark" && kind !== "land") {
    // Sparks off hot stone: fast, bright, gone quickly.
    const n = kind === "ko" ? 14 : 7;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8,
        v = 50 + Math.random() * 90;
      const s = scene.add
        .image(x, y - 6, TEX.spark)
        .setTint(Math.random() < 0.5 ? 0xffb347 : 0xffe08a)
        .setBlendMode(1)
        .setRotation(a + Math.PI / 2)
        .setScale(0.6 + Math.random() * 0.5)
        .setDepth(depth + 0.0003);
      scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * v,
        y: y - 6 + Math.sin(a) * v * 0.6 + 20,
        alpha: 0,
        duration: 260 + Math.random() * 200,
        ease: "Quad.Out",
        onComplete: () => s.destroy(),
      });
    }
  }
  if (look.extra === "leaf" && (kind === "ko" || Math.random() < 0.35)) {
    // A leaf or two shaken loose, drifting down.
    for (let k = 0; k < (kind === "ko" ? 3 : 1); k++) {
      const l = scene.add
        .image(x + (Math.random() - 0.5) * 30, y - 30 - Math.random() * 20, TEX.leaf)
        .setTint([0x638f3f, 0x7aa64c, 0x9a8a4a][k % 3])
        .setRotation(Math.random() * 6)
        .setDepth(depth);
      scene.tweens.add({
        targets: l,
        x: l.x + (Math.random() - 0.5) * 80,
        y: y + 6,
        rotation: l.rotation + (Math.random() - 0.5) * 6,
        duration: 900 + Math.random() * 500,
        ease: "Sine.InOut",
        onComplete: () =>
          scene.tweens.add({ targets: l, alpha: 0, duration: 600, delay: 600, onComplete: () => l.destroy() }),
      });
    }
  }
}
