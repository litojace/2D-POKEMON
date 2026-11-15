// Draws the email banner's pieces with the game's own renderers: a duel
// court (crowd stands + floor) and champions in real animation poses.
// Loaded in the visual-test Vite server (see README); not part of the app.
import Phaser from "phaser";
import { CHARACTERS, RULES, type CharacterId } from "@arena/shared";
import { FighterRig } from "../../../apps/client/src/animation/rig";
import { rigAssets } from "../../../apps/client/src/animation/assets";
import type { AnimationState } from "../../../apps/client/src/animation/controller";
import {
  paintCourtFloor,
  paintCourtStands,
  STANDS,
  type CourtId,
} from "../../../apps/client/src/arena-courts";

/** The court with its stands, `scale` times the game's size, no pillars. */
export function courtPng(id: CourtId, scale = 2) {
  const c = document.createElement("canvas");
  c.width = RULES.width * scale;
  c.height = (STANDS + RULES.height) * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  paintCourtStands(g, id);
  g.save();
  g.translate(0, STANDS);
  paintCourtFloor(g, id, true);
  g.restore();
  return c.toDataURL("image/png");
}

export interface Actor {
  id: CharacterId;
  state: AnimationState;
  /** Facing: Math.PI looks left, 0 looks right. */
  angle: number;
  /** 0..1 through the move. */
  phase: number;
  skin?: string | null;
  stage?: number;
  /** Where the feet sit, 0..1 down the picture (spinning moves need room below). */
  feet?: number;
}

/** One champion in one pose, transparent PNG, `size` px square. */
export async function posePng(a: Actor, size = 480): Promise<string> {
  const assets = rigAssets(a.id);
  let rig!: FighterRig;
  const game = await new Promise<Phaser.Game>((done) => {
    class S extends Phaser.Scene {
      preload() {
        for (const x of assets)
          this.load.svg(x.key, x.url, { width: x.width, height: x.height });
      }
      create() {
        rig = new FighterRig(this, a.id, assets);
        rig.root.setScale(size / 120);
        done(game);
      }
    }
    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      width: size,
      height: size,
      transparent: true,
      scene: [S],
      banner: false,
      audio: { noAudio: true },
      render: { preserveDrawingBuffer: true },
    });
  });
  game.loop.sleep();
  const clock = 5000;
  rig.controller.reset();
  if (!["idle", "jump", "defeat"].includes(a.state))
    rig.trigger(a.state, clock, 900);
  const pose = {
    hp: a.state === "defeat" ? 0 : CHARACTERS[a.id].health,
    speed: 0,
    angle: a.angle,
    dash: false,
    jump: a.state === "jump",
    skin: a.skin ? { skin: a.skin, stage: a.stage ?? 3 } : null,
  };
  // Skins load their own textures: render, wait, render again.
  for (let i = 0; i < 3; i++) {
    rig.render(
      pose as any,
      size / 2,
      size * (a.feet ?? 0.8),
      clock + a.phase * 900,
      1,
      false,
    );
    game.step(clock + a.phase * 900 + i, 0);
    await new Promise((r) => setTimeout(r, 250));
  }
  const url = game.canvas.toDataURL("image/png");
  game.destroy(true);
  return url;
}
