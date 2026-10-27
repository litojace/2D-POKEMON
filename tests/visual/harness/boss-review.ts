import Phaser from "phaser";
import {
  queueBossArt,
  retainBossArt,
} from "../../../apps/client/src/boss-painted-rig";
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import {
  RAID_BOSS_ORDER,
  RAID_BOSSES,
} from "../../../packages/shared/src/raid-roster";
import { drawRaidBoss } from "../../../apps/client/src/raid-boss-art";
import { drawTidewyrm } from "../../../apps/client/src/raid-tidewyrm-art";
import { drawGloomshade } from "../../../apps/client/src/raid-gloomshade-art";
import { drawSomnara } from "../../../apps/client/src/raid-somnara-art";
import { drawPrismatail } from "../../../apps/client/src/raid-prismatail-art";
import { drawEmberwing } from "../../../apps/client/src/raid-emberwing-art";
import { drawStormTwins } from "../../../apps/client/src/raid-storm-twins-art";

const painters = {
  grumblecrag: drawRaidBoss,
  tidewyrm: drawTidewyrm,
  gloomshade: drawGloomshade,
  somnara: drawSomnara,
  prismatail: drawPrismatail,
  emberwing: drawEmberwing,
  "storm-twins": drawStormTwins,
};

/** Actual battle painters and server snapshots, with no network or player UI. */
export function reviewBosses(preload = true) {
  let ready!: () => void;
  const loaded = new Promise<void>((r) => (ready = r));
  const rows: {
    id: (typeof RAID_BOSS_ORDER)[number];
    g: Phaser.GameObjects.Graphics;
    state: ReturnType<ReturnType<typeof createRaidArena>["snapshot"]>;
  }[] = [];
  class Review extends Phaser.Scene {
    preload() {
      if (preload) for (const id of RAID_BOSS_ORDER) queueBossArt(this, id);
    }
    create() {
      RAID_BOSS_ORDER.forEach((id, i) => {
        const arena = createRaidArena("REVIEW", id);
        arena.add("hero", "Hero");
        arena.start();
        arena.phase = "playing";
        arena.raid.gilded = false;
        const state = arena.snapshot(),
          bosses = state.players.filter((p) => p.raidBoss);
        const x = bosses.reduce((sum, p) => sum + p.x, 0) / bosses.length;
        const y = bosses.reduce((sum, p) => sum + p.y, 0) / bosses.length;
        state.players.forEach((p) => {
          p.x -= x;
          p.y -= y;
        });
        const left = (i % 2) * 800,
          top = Math.floor(i / 2) * 500;
        this.add.text(left + 20, top + 20, RAID_BOSSES[id].name, {
          fontFamily: "sans-serif",
          fontSize: "22px",
          color: "#ffe2a3",
        });
        const g = this.add
          .graphics()
          .setPosition(left + 400, top + 350)
          .setScale(id === "storm-twins" ? 1 : 1.35);
        rows.push({ id, g, state });
      });
      ready();
    }
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: 1600,
    height: 2000,
    backgroundColor: "#162038",
    scene: [Review],
    banner: false,
    audio: { noAudio: true },
    render: { pixelArt: false, antialias: true },
  });
  return {
    game,
    loaded,
    rows,
    retain(id: (typeof RAID_BOSS_ORDER)[number]) {
      retainBossArt(rows[0].g.scene, id);
    },
    frame(
      phase: 1 | 2 | 3 = 1,
      clock = 0,
      reduced = true,
      ids = [...RAID_BOSS_ORDER],
    ) {
      game.loop.sleep();
      game.loop.frame++;
      for (const row of rows) {
        row.g.clear();
        if (!ids.includes(row.id)) continue;
        row.state.raid!.phase = phase;
        row.state.time = clock;
        const before = JSON.stringify(row.state);
        painters[row.id](row.g, row.state, reduced, clock);
        if (JSON.stringify(row.state) !== before)
          throw new Error(`${row.id} changed combat state`);
      }
      game.step(clock * 1000, 0);
    },
  };
}
