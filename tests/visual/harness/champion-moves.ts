// Frame strips of a champion's entrance (the round's greeting) and victory:
// the real rig, stepped at 60 frames a second to each cell's moment, so
// springs and particles are where a player would see them.
import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { FighterRig } from "../../../apps/client/src/animation/rig";
import { rigAssets } from "../../../apps/client/src/animation/assets";
import type { SkinLook } from "../../../apps/client/src/creature-design";

export interface Strip {
  id: CharacterId;
  move: "wave" | "victory";
  /** Facing: "down" (the Shop's view), "right", "left" or "up". */
  dir?: "down" | "right" | "left" | "up";
  skin?: SkinLook | null;
  reduced?: boolean;
}
const ANGLE = { down: Math.PI / 2, right: 0, left: Math.PI, up: -Math.PI / 2 };

export function championMoves(
  strips: Strip[],
  times: number[],
  opts: { cell?: number; scale?: number; canvas?: boolean } = {},
) {
  const cell = opts.cell ?? 150,
    scale = opts.scale ?? 1.5,
    rowH = cell * 1.25;
  const cells: {
    strip: Strip;
    t: number;
    x: number;
    y: number;
    rig?: FighterRig;
  }[] = [];
  let ready!: () => void;
  const loaded = new Promise<void>((resolve) => (ready = resolve));
  class Moves extends Phaser.Scene {
    preload() {
      const seen = new Set<string>();
      for (const s of strips)
        for (const a of rigAssets(s.id, s.skin ?? null)) {
          if (seen.has(a.key)) continue;
          seen.add(a.key);
          this.load.svg(a.key, a.url, { width: a.width, height: a.height });
        }
    }
    create() {
      strips.forEach((strip, row) => {
        const y = row * rowH + rowH * 0.72;
        // The ground line, so hops and crouches read.
        this.add
          .rectangle(0, y + 34 * scale, times.length * cell, 2, 0x35507d)
          .setOrigin(0, 0.5);
        times.forEach((t, col) => {
          const x = col * cell + cell / 2;
          const rig = new FighterRig(
            this,
            strip.id,
            rigAssets(strip.id, strip.skin ?? null),
          );
          rig.root.setScale(scale);
          cells.push({ strip, t, x, y, rig });
          this.add.text(col * cell + 4, row * rowH + 2, `${t.toFixed(2)}s`, {
            fontSize: "11px",
            color: "#8fa6cc",
          });
        });
      });
      ready();
    }
  }
  const game = new Phaser.Game({
    type: opts.canvas ? Phaser.CANVAS : Phaser.WEBGL,
    width: times.length * cell,
    height: Math.ceil(strips.length * rowH),
    backgroundColor: "#10182b",
    scene: [Moves],
    banner: false,
    audio: { noAudio: true },
  });
  return {
    game,
    loaded,
    /** Play every cell from the move's start to its own moment. */
    draw() {
      game.loop.sleep();
      const start = 5000;
      let last = start;
      for (const c of cells) {
        const rig = c.rig!;
        rig.controller.reset();
        const end = start + c.t * 1000;
        for (let now = start; ; now = Math.min(end, now + 1000 / 60)) {
          rig.root.setScale(scale);
          rig.render(
            {
              hp: CHARACTERS[c.strip.id].health,
              speed: 0,
              angle: ANGLE[c.strip.dir ?? "down"],
              dash: false,
              jump: false,
              skin: c.strip.skin ?? null,
              greet: c.strip.move === "wave",
              victory: c.strip.move === "victory",
            },
            c.x,
            c.y,
            now,
            1,
            !!c.strip.reduced,
          );
          if (now >= end) break;
        }
        last = Math.max(last, end);
      }
      game.step(last, 0);
    },
  };
}
