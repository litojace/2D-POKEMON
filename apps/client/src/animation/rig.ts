import { drawElementGlyph } from "../element-effects";
import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AnimationController,
  facing,
  type AnimationPose,
  type AnimationState,
  type Facing,
} from "./controller";
import { parts, rigKey, type Part, type RigAsset } from "./assets";
export class FighterRig {
  readonly controller = new AnimationController();
  readonly root: Phaser.GameObjects.Container;
  private images = new Map<Part, Phaser.GameObjects.Image>();
  private effects: Phaser.GameObjects.Graphics;
  private dir: Facing = "down";
  private previousRotations = new Map<Part, number>();
  private lastRender = 0;
  private blinkAt = 0;
  private blinkUntil = 0;
  constructor(
    private scene: Phaser.Scene,
    readonly character: CharacterId,
    private assets: RigAsset[],
  ) {
    this.root = scene.add.container(0, 0).setDepth(2);
    this.effects = scene.add.graphics().setDepth(3);
    for (const part of parts) {
      const asset = assets.find(
        (a) => a.key === rigKey(character, "down", part),
      )!;
      const image = scene.add
        .image(asset.x, asset.y, asset.key)
        .setOrigin(asset.originX, asset.originY)
        .setScale(0.5);
      this.images.set(part, image);
      this.root.add(image);
    }
    this.blinkAt = scene.time.now + 3000 + Math.random() * 4000;
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
    this.effects.setVisible(visible);
  }
  destroy() {
    this.root.destroy(true);
    this.effects.destroy();
  }
  render(
    pose: AnimationPose,
    x: number,
    y: number,
    now: number,
    alpha = 1,
    reduced = false,
  ) {
    for (const [part, image] of this.images)
      this.previousRotations.set(part, image.rotation);
    const blend = this.lastRender
      ? 1 - Math.exp(-Math.max(0, now - this.lastRender) / 35)
      : 1;
    this.lastRender = now;
    const speed = CHARACTERS[this.character].speed;
    const state = this.controller.update(pose, now, speed * 0.65);
    const dir = facing(pose.angle);
    if (dir !== this.dir) {
      this.dir = dir;
      for (const [part, image] of this.images) {
        const asset = this.assets.find(
          (a) => a.key === rigKey(this.character, dir, part),
        )!;
        image
          .setTexture(asset.key)
          .setOrigin(asset.originX, asset.originY)
          .setPosition(asset.x, asset.y);
      }
    }
    const t = (now - this.controller.started) / 1000;
    const moving = state === "walk" || state === "run";
    const heavy =
      this.character === "thornback" || this.character === "terradon";
    const step = Math.sin(
      t *
        Math.PI *
        2 *
        (heavy ? (state === "run" ? 4 : 3) : state === "run" ? 7 : 5),
    );
    const idle = Math.sin(now / 430);
    const progress = Math.min(
      1,
      (now - this.controller.started) /
        Math.max(1, this.controller.until - this.controller.started),
    );
    const skill = state.startsWith("skill") ? Number(state.slice(5)) : -1;
    const attack = state === "basic" || skill >= 0;
    // A quick three-stage pose follows authorization; it never postpones gameplay.
    const punch = attack
      ? progress < 0.2
        ? -progress * 2
        : progress < 0.55
          ? Math.sin(((progress - 0.2) / 0.35) * Math.PI) * 1.3
          : (1 - progress) * 0.5
      : 0;
    const body = this.images.get("body")!,
      head = this.images.get("head")!,
      eyes = this.images.get("eyes")!,
      ears = this.images.get("ears")!,
      tail = this.images.get("tail")!,
      flame = this.images.get("flame")!,
      wings = this.images.get("wings")!,
      scarf = this.images.get("scarf")!;
    this.root.setPosition(x, y).setAlpha(alpha).setAngle(0).setScale(1);
    for (const image of this.images.values())
      image
        .setRotation(0)
        .setScale(0.5)
        .setTint(state === "hurt" ? 0xffb4b4 : 0xffffff);
    body.setScale(0.5, 0.5 + (reduced ? 0 : idle * 0.009));
    head.y = -15 + (reduced ? 0 : idle * 0.55);
    head.rotation = reduced
      ? 0
      : this.character === "tidefin"
        ? -0.05
        : idle * 0.025;
    ears.rotation = reduced ? 0 : Math.sin(now / 250) * 0.04;
    tail.rotation = reduced ? 0 : Math.sin(now / 340) * 0.12;
    wings.setScale(0.5 + (reduced ? 0 : Math.sin(now / 360) * 0.025), 0.5);
    flame.setScale(
      0.5 + (reduced ? 0 : Math.sin(now / 90) * 0.04),
      0.5 + (reduced ? 0 : Math.cos(now / 75) * 0.06),
    );
    flame.rotation = tail.rotation;
    scarf.rotation = reduced ? 0 : Math.sin(now / 200) * 0.06;
    if (now >= this.blinkAt) {
      this.blinkUntil = now + 125;
      this.blinkAt = now + 3000 + Math.random() * 4000;
    }
    eyes.setScale(
      0.5,
      state === "blink" || state === "defeat" || now < this.blinkUntil
        ? 0.055
        : 0.5,
    );
    eyes.y = -22 + (head.y + 15);
    const armL = this.images.get("armL")!,
      armR = this.images.get("armR")!,
      legL = this.images.get("legL")!,
      legR = this.images.get("legR")!;
    for (const part of ["armL", "armR", "legL", "legR"] as Part[]) {
      const asset = this.assets.find(
        (a) => a.key === rigKey(this.character, dir, part),
      )!;
      this.images.get(part)!.setPosition(asset.x, asset.y);
    }
    if (this.character === "auralynx") {
      armL.rotation = -0.35;
      armR.rotation = 0.35;
    }
    if (this.character === "tidefin") {
      body.setScale(0.53, 0.47);
      legL.rotation = -0.18;
      legR.rotation = 0.18;
    }
    if (moving && !reduced) {
      const stride =
        this.character === "cindrake"
          ? 0.32
          : this.character === "tidefin"
            ? 0.65
            : 0.48;
      armL.rotation = step * stride;
      armR.rotation = -step * stride;
      legL.rotation = -step * 0.28;
      legR.rotation = step * 0.28;
      legL.y += step * 2;
      legR.y -= step * 2;
      body.rotation = Math.cos(pose.angle) * 0.055;
      wings.rotation = -step * 0.045;
      scarf.rotation = Math.cos(pose.angle) * 0.16;
    }
    if (attack) {
      armR.rotation = -punch * 1.3;
      armL.rotation = punch * 0.7;
      head.rotation = -punch * 0.06;
      body.rotation = punch * 0.08;
      if (skill === 1) {
        armL.rotation = -0.7 - punch * 0.7;
        armR.rotation = 0.7 + punch * 0.7;
      }
      if (skill === 2) {
        armL.rotation = -1.1;
        armR.rotation = 1.1;
        body.setScale(0.54, 0.46);
      }
      if (skill === 3) {
        armL.rotation = 1.5 + punch * 0.2;
        armR.rotation = -1.5 - punch * 0.2;
        wings.setScale(0.58, 0.5);
        head.y -= 2;
      }
    }
    if (attack) {
      if (this.character === "voltkit") {
        ears.rotation = punch * 0.14;
        if (skill === 2) {
          armL.rotation = 0.6;
          armR.rotation = -0.6;
          head.y += 2;
        }
        if (skill === 3) tail.rotation += punch * 0.3;
      } else if (this.character === "cindrake") {
        wings.setScale(0.55 + punch * 0.05, 0.5);
        if (state === "basic" || skill === 0) {
          head.y -= punch * 3;
          head.rotation = punch * 0.16;
        }
        if (skill === 1) {
          armL.rotation = -1.6;
          armR.rotation = 1.6;
          wings.rotation = punch * 0.12;
        }
        if (skill === 2) {
          body.rotation = Math.cos(pose.angle) * 0.22;
          armL.rotation = -0.9;
          armR.rotation = 0.9;
        }
      } else if (this.character === "tidefin") {
        scarf.rotation = punch * 0.3;
        if (skill === 0) {
          armR.rotation = -punch * 2;
          armR.x += punch * 4;
        }
        if (skill === 1) {
          legR.rotation = punch * 0.9;
          armL.rotation = -1;
          armR.rotation = 1;
        }
        if (skill === 2) {
          armL.rotation = -1.5;
          armR.rotation = 1.5;
          body.setScale(0.55, 0.44);
        }
        if (skill === 3) {
          armL.rotation = Math.sin(progress * 22) * 1.4;
          armR.rotation = -armL.rotation;
        }
      } else if (this.character === "auralynx") {
        if (state === "basic") {
          legR.rotation = punch * 0.8;
          armR.x += punch * 5;
        }
        if (skill === 0 || skill === 3) {
          armL.rotation = -0.8 - punch * 0.4;
          armR.rotation = 0.8 + punch * 0.4;
          armL.x += 5;
          armR.x -= 5;
        }
        if (skill === 1) {
          armL.rotation = -punch * 1.5;
          armR.rotation = punch * 1.5;
        }
        if (skill === 2) {
          armL.rotation = -1.3;
          armR.rotation = 1.3;
          legL.rotation = -0.25;
        }
      }
    }
    if (this.character === "auralynx") {
      if (!reduced) {
        wings.rotation = now / 1400;
        if (pose.charging || (attack && skill === 3))
          this.root.y -= 3 + Math.sin(now / 550) * 2;
      }
      body.setTint(pose.charging ? 0xffddff : 0xffffff);
    }
    if (this.character === "thornback") {
      wings.rotation = reduced ? 0 : Math.sin(now / 600) * 0.045;
      if (attack && skill === 1) {
        body.setScale(0.55, 0.46);
        head.y += 4;
        armL.rotation = -0.6;
        armR.rotation = 0.6;
      }
      if (attack && skill >= 2) {
        armL.rotation = punch * 0.8;
        armR.rotation = -punch * 0.8;
        wings.rotation = punch * 0.15;
      }
    }
    if (this.character === "frostfang") {
      scarf.rotation = reduced ? 0 : Math.sin(now / 380) * 0.04;
      if (attack) {
        head.y -= punch * 2;
        if (skill === 3) {
          armL.rotation = 1.4;
          armR.rotation = -1.4;
        }
      }
    }
    if (this.character === "duskveil") {
      if (!reduced) {
        body.rotation += Math.sin(now / 700) * 0.04;
      }
      if (attack && skill === 1) {
        armL.rotation = -1;
        armR.rotation = 1;
        body.setAlpha(1);
      } else body.setAlpha(1);
    }
    if (this.character === "terradon" && attack) {
      if (skill === 1) {
        armL.rotation = -0.7;
        armR.rotation = 0.7;
      } else {
        armR.x += punch * 6;
        legR.rotation = punch * 0.5;
      }
    }
    if (state === "dash") {
      armL.rotation = -0.9;
      armR.rotation = 0.9;
      legL.rotation = 0.6;
      legR.rotation = -0.6;
      scarf.rotation = 0.25;
      body.rotation = Math.cos(pose.angle) * 0.15;
    }
    if (state === "jump") {
      armL.rotation = -1.1;
      armR.rotation = 1.1;
      legL.rotation = 0.7;
      legR.rotation = -0.7;
    }
    if (state === "land") {
      body.setScale(0.54, 0.43);
      legL.rotation = -0.3;
      legR.rotation = 0.3;
      head.y += 3 * (1 - progress);
    }
    if (state === "hurt") {
      this.root.x -= Math.cos(pose.angle) * Math.sin(progress * Math.PI) * 5;
      armL.rotation = 0.5;
      armR.rotation = -0.5;
      head.rotation = -0.12;
    }
    if (state === "defeat") {
      const faint = Math.min(1, t / 0.45);
      body.rotation = faint * 0.75;
      head.rotation = faint * 0.7;
      head.y += faint * 14;
      armL.rotation = 0.8;
      armR.rotation = -0.7;
      this.root.setAlpha(alpha * 0.65);
    }
    if (state === "wave") {
      armR.rotation = -2.4 + Math.sin(t * 14) * 0.4;
      head.rotation = -0.08;
    }
    if (state === "victory" && !reduced && t < 2) {
      if (this.character === "voltkit") {
        armL.rotation = 2.4 + Math.sin(t * 15) * 0.3;
        armR.rotation = -2.4 - Math.sin(t * 15) * 0.3;
        this.root.y -= Math.max(0, Math.sin(t * 8)) * 8;
      } else if (this.character === "cindrake") {
        wings.setScale(0.62, 0.55);
        head.y -= 4;
        armL.rotation = -0.9;
        armR.rotation = 0.9;
      } else if (this.character === "tidefin") {
        this.root.rotation = t < 0.65 ? (t / 0.65) * Math.PI * 2 : 0;
        armL.rotation = -0.8;
        armR.rotation = 0.8;
        legL.rotation = 0.5;
        legR.rotation = -0.5;
      } else if (this.character === "auralynx") {
        wings.rotation = t * 3;
        armL.rotation = 1.2;
        armR.rotation = -1.2;
        body.setScale(0.5 + Math.sin(t * 8) * 0.02);
      } else if (this.character === "thornback") {
        head.rotation = Math.sin(t * 5) * 0.08;
        wings.rotation = Math.sin(t * 7) * 0.15;
        armL.rotation = 0.5;
        armR.rotation = -0.5;
      } else if (this.character === "frostfang") {
        armL.rotation = 2 + Math.sin(t * 12) * 0.3;
        armR.rotation = -2 - Math.sin(t * 12) * 0.3;
        head.rotation = Math.sin(t * 6) * 0.1;
        scarf.rotation = Math.sin(t * 10) * 0.15;
      } else if (this.character === "duskveil") {
        body.rotation = Math.sin(t * 7) * 0.18;
        armL.rotation = 0.8 + Math.sin(t * 9) * 0.4;
        armR.rotation = -0.8 - Math.sin(t * 9) * 0.4;
        head.rotation = -body.rotation * 0.5;
      } else {
        armL.rotation = 1.5;
        armR.rotation = -1.5;
        legL.rotation = Math.sin(t * 6) * 0.2;
        legR.rotation = -legL.rotation;
        head.rotation = Math.sin(t * 4) * 0.08;
      }
    }
    for (const [part, image] of this.images) {
      const old = this.previousRotations.get(part) ?? 0;
      const delta = Math.atan2(
        Math.sin(image.rotation - old),
        Math.cos(image.rotation - old),
      );
      image.rotation = old + delta * blend;
    }
    // Keep independently animated facial parts attached to the head, including recoil/fainting.
    eyes.rotation = head.rotation;
    eyes.setPosition(
      Math.sin(head.rotation) * 7,
      head.y - Math.cos(head.rotation) * 7,
    );
    ears.rotation += head.rotation;
    ears.setPosition(
      Math.sin(head.rotation) * 17.5,
      head.y - Math.cos(head.rotation) * 17.5,
    );
    flame.setPosition(ears.x, ears.y);
    flame.rotation = head.rotation;
    this.effects.clear();
    if (reduced) return;
    const color = CHARACTERS[this.character].color;
    if (
      state === "victory" &&
      t < 1.8 &&
      (this.character === "voltkit" || this.character === "cindrake")
    ) {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        this.effects
          .lineStyle(2, color, 0.5)
          .lineBetween(
            x + Math.cos(a) * 30,
            y - 15 + Math.sin(a) * 30,
            x + Math.cos(a) * 36,
            y - 15 + Math.sin(a) * 36,
          );
      }
    }
    if (attack || pose.charging) {
      const radius = skill === 3 ? 12 : skill === 1 ? 9 : 6;
      this.effects
        .lineStyle(2, color, 0.65)
        .strokeCircle(
          x + Math.cos(pose.angle) * 25,
          y + Math.sin(pose.angle) * 25 - 10,
          radius + Math.sin(now / 65) * 2,
        );
      drawElementGlyph(
        this.effects,
        CHARACTERS[this.character].element,
        x + Math.cos(pose.angle) * 25,
        y + Math.sin(pose.angle) * 25 - 10,
        radius,
        color,
        0.7,
        now,
      );
      if (this.character === "cindrake" && state === "basic") {
        this.effects
          .fillStyle(color, 0.3)
          .fillTriangle(
            x,
            y - 12,
            x + Math.cos(pose.angle) * 45 + Math.sin(pose.angle) * 9,
            y + Math.sin(pose.angle) * 45 - 12,
            x + Math.cos(pose.angle) * 45 - Math.sin(pose.angle) * 9,
            y + Math.sin(pose.angle) * 45 - 12,
          );
      }
    }
    if (state === "dash")
      for (let i = 1; i < 4; i++)
        this.effects
          .lineStyle(2, color, 0.3 / i)
          .lineBetween(
            x - Math.cos(pose.angle) * i * 14,
            y - Math.sin(pose.angle) * i * 14,
            x - Math.cos(pose.angle) * (i * 14 + 16),
            y - Math.sin(pose.angle) * (i * 14 + 16),
          );
  }
}
