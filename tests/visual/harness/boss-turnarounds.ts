/** Art review only: production painters with all four headings side by side. */
import Phaser from "phaser";
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import {
  RAID_BOSS_ORDER,
  RAID_BOSSES,
} from "../../../packages/shared/src/raid-roster";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { queueBossArt } from "../../../apps/client/src/boss-painted-rig";
import { queueBossSpellArt } from "../../../apps/client/src/boss-spell-flipbook";
import { drawBossBattleEffects } from "../../../apps/client/src/boss-spell-art";
import { painters } from "./boss-review";
const headings = [
  ["FRONT", Math.PI / 2],
  ["BACK", -Math.PI / 2],
  ["LEFT", Math.PI],
  ["RIGHT", 0],
] as const;
const entries: { id: RaidBossId; ground?: boolean }[] = [
  ...RAID_BOSS_ORDER.map((id) => ({ id })),
  { id: "emberwing", ground: true },
  { id: "tidewyrm", ground: true },
];
export function reviewTurnarounds() {
  let ready!: () => void;
  const loaded = new Promise<void>((resolve) => (ready = resolve));
  const cells: {
    id: RaidBossId;
    g: Phaser.GameObjects.Graphics;
    state: ReturnType<ReturnType<typeof createRaidArena>["snapshot"]>;
  }[] = [];
  let paint: (() => void) | undefined;
  class Board extends Phaser.Scene {
    preload() {
      for (const id of RAID_BOSS_ORDER) queueBossArt(this, id);
      queueBossSpellArt(this);
    }
    update() {
      paint?.();
    }
    create() {
      this.add.text(30, 15, "BOSS TURNAROUNDS", {
        fontFamily: "sans-serif",
        fontSize: "26px",
        color: "#ffe2a3",
      });
      headings.forEach(([name], col) =>
        this.add
          .text(col * 450 + 225, 65, name, {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#aabbda",
          })
          .setOrigin(0.5),
      );
      entries.forEach(({ id, ground }, row) => {
        this.add.text(
          22,
          100 + row * 400,
          RAID_BOSSES[id].name + (ground ? " · GROUNDED" : ""),
          { fontFamily: "sans-serif", fontSize: "18px", color: "#ffe2a3" },
        );
        headings.forEach(([, angle], col) => {
          const arena = createRaidArena("TURNS" + row + col, id);
          arena.add("hero", "Hero");
          arena.start();
          arena.phase = "playing";
          arena.raid.gilded = false;
          const state = arena.snapshot(),
            bosses = state.players.filter((p) => p.raidBoss),
            cx = bosses.reduce((sum, p) => sum + p.x, 0) / bosses.length,
            cy = bosses.reduce((sum, p) => sum + p.y, 0) / bosses.length;
          state.players.forEach((p) => {
            p.x -= cx;
            p.y -= cy;
            if (p.raidBoss) p.angle = angle;
          });
          state.raid!.airborne = id === "emberwing" && !ground;
          if (id === "tidewyrm" && ground) {
            state.raid!.exposedUntil = 100;
            state.raid!.islands = [{ x: 0, y: 0, radius: 110, sunk: false }];
          }
          const scale = id === "storm-twins" ? 0.7 : 1,
            g = this.add
              .graphics()
              .setPosition(225 + col * 450, 395 + row * 400)
              .setScale(scale);
          cells.push({ id, g, state });
        });
      });
      ready();
    }
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: 1800,
    height: 3700,
    backgroundColor: "#141e33",
    scene: [Board],
    banner: false,
    audio: { noAudio: true },
    render: { pixelArt: false, antialias: true },
  });
  return {
    game,
    cells,
    loaded,
    frame(clock = 0, reduced = true) {
      game.loop.sleep();
      game.loop.frame++;
      paint = () => {
        for (const cell of cells) {
          cell.g.clear();
          cell.state.time = clock;
          drawBossBattleEffects(cell.g, cell.state, reduced, clock);
          painters[cell.id](cell.g, cell.state, reduced, clock);
        }
      };
      game.step(clock * 1000, 0);
    },
  };
}
