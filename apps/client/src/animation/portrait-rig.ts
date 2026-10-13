import type Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AnimationController,
  type AnimationPose,
  type AnimationState,
} from "./controller";
import type { FighterVisual } from "./pipeline";

/** Temporary presentation rig: matching art with motion cues, not authored limb frames. */
export class PortraitFighterVisual implements FighterVisual {
  readonly controller = new AnimationController();
  readonly root: Phaser.GameObjects.Container;
  private image: Phaser.GameObjects.Image;
  private effects: Phaser.GameObjects.Graphics;
  private scale: number;
  constructor(
    scene: Phaser.Scene,
    readonly character: CharacterId,
  ) {
    this.effects = scene.add.graphics();
    this.image = scene.add
      .image(0, 0, `portrait-${character}`)
      .setOrigin(0.5, 0.83);
    this.scale = 108 / Math.max(this.image.width, this.image.height);
    this.root = scene.add
      .container(0, 0, [this.effects, this.image])
      .setDepth(2);
  }
  trigger(
    state: AnimationState,
    now: number,
    duration = 300,
    eventId?: number,
  ) {
    return this.controller.trigger(state, now, duration, eventId);
  }
  setVisible(visible: boolean) {
    this.root.setVisible(visible);
  }
  destroy() {
    this.root.destroy(true);
  }
  render(
    pose: AnimationPose,
    x: number,
    y: number,
    now: number,
    alpha = 1,
    reduced = false,
  ) {
    const state = this.controller.update(
      pose,
      now,
      CHARACTERS[this.character].speed * 0.65,
    );
    const elapsed = now - this.controller.started;
    const beat = Math.sin(now / (state === "run" ? 55 : 85));
    const moving = state === "walk" || state === "run";
    const attacking = state === "basic" || state.startsWith("skill");
    const pulse = Math.sin(
      Math.PI * Math.min(1, elapsed / (state === "skill3" ? 650 : 300)),
    );
    let lift = 0,
      tilt = 0,
      sx = 1,
      sy = 1,
      reach = 0;
    if (!reduced) {
      if (moving) {
        lift = -Math.abs(beat) * 5;
        tilt = beat * 0.045;
        sx += beat * 0.025;
        sy -= beat * 0.025;
      } else {
        sy += Math.sin(now / 550) * 0.018;
      }
      if (attacking) {
        reach = pulse * (state === "basic" ? 9 : 5);
        sx += pulse * 0.08;
        sy -= pulse * 0.06;
        tilt = pulse * 0.08 * Math.cos(pose.angle);
      }
      if (state === "dash") {
        tilt = Math.cos(pose.angle) * 0.2;
        sx = 1.14;
        sy = 0.88;
      }
      if (state === "land") {
        sx += pulse * 0.12;
        sy -= pulse * 0.15;
      }
      if (state === "hurt")
        tilt = Math.sin(elapsed / 25) * 0.07 * Math.max(0, 1 - elapsed / 300);
      if (state === "victory" || state === "wave") {
        lift = -Math.abs(Math.sin(elapsed / 180)) * 9;
        tilt = Math.sin(elapsed / 220) * 0.08;
      }
    }
    if (state === "defeat") {
      tilt = 0.65;
      sy = 0.65;
    }
    this.root.setPosition(x, y).setAlpha(alpha);
    this.image
      .setPosition(
        Math.cos(pose.angle) * reach,
        lift + Math.sin(pose.angle) * reach,
      )
      .setScale(this.scale * sx, this.scale * sy)
      .setRotation(tilt)
      .setTint(
        state === "hurt" ? 0xffaaaa : state === "defeat" ? 0x8893a6 : 0xffffff,
      );
    this.effects.clear();
    if (state === "defeat" || reduced) return;
    const color = CHARACTERS[this.character].color;
    if (moving || state === "dash") {
      // Short charged footsteps/trails indicate travel without claiming new directional art.
      this.effects.lineStyle(state === "dash" ? 3 : 1.5, color, 0.65);
      for (let i = 0; i < 3; i++) {
        const distance = 17 + i * 9 + ((now / 12) % 9);
        const tx = -Math.cos(pose.angle) * distance,
          ty = -Math.sin(pose.angle) * distance + 10;
        this.effects.lineBetween(tx - 4, ty - 2, tx + 3, ty + 2);
      }
    }
    if (attacking || pose.charging) {
      this.effects
        .lineStyle(2, color, 0.7)
        .strokeEllipse(0, 9, 60 + pulse * 35, 22 + pulse * 12);
      const radius = 30 + pulse * 12;
      for (let i = 0; i < 3; i++) {
        const angle = now / 160 + (i * Math.PI * 2) / 3;
        const px = Math.cos(angle) * radius,
          py = -25 + Math.sin(angle) * radius * 0.7;
        this.effects
          .lineBetween(px - 3, py - 5, px + 2, py)
          .lineBetween(px + 2, py, px - 1, py + 5);
      }
    }
  }
}
