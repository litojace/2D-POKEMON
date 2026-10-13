import type Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { type FighterPack } from "./asset-schema";
import { fighterPack } from "./pack-config";
import { FighterRig } from "./rig";
import { PortraitFighterVisual } from "./portrait-rig";
import {
  AnimationController,
  facing,
  type AnimationPose,
  type AnimationState,
} from "./controller";
import type { RigAsset } from "./assets";
export interface FighterVisual {
  readonly character: CharacterId;
  readonly controller: AnimationController;
  readonly root: Phaser.GameObjects.Container;
  trigger(
    state: AnimationState,
    now: number,
    duration?: number,
    eventId?: number,
  ): boolean;
  render(
    pose: AnimationPose,
    x: number,
    y: number,
    now: number,
    alpha?: number,
    reduced?: boolean,
  ): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}
export function queueFighterAssets(
  scene: Phaser.Scene,
  id: CharacterId,
  layers: RigAsset[],
) {
  const pack = fighterPack(id),
    path = `/assets/fighters/${id}/`,
    texture = `frames-${id}`;
  if (id === "voltkit" && pack?.kind === "layered") {
    scene.load.image(`portrait-${id}`, path + pack.portrait);
    return;
  }
  if (!pack || pack.kind === "layered") {
    for (const a of layers)
      scene.load.svg(a.key, a.url, { width: a.width, height: a.height });
    return;
  }
  if (pack.kind === "frames")
    for (const [name, url] of Object.entries(pack.files))
      scene.load.image(`${texture}-${name}`, path + url);
  else if (pack.kind === "sheet")
    scene.load.spritesheet(texture, path + pack.image, {
      frameWidth: pack.frameWidth,
      frameHeight: pack.frameHeight,
    });
  else scene.load.atlas(texture, path + pack.image, path + pack.data);
}
function animationKey(id: CharacterId, state: string, dir: string) {
  return `fighter-${id}-${state}-${dir}`;
}
export function createFighterVisual(
  scene: Phaser.Scene,
  id: CharacterId,
  layers: RigAsset[],
): FighterVisual {
  const pack = fighterPack(id);
  if (id === "voltkit" && pack?.kind === "layered")
    return new PortraitFighterVisual(scene, id);
  if (!pack || pack.kind === "layered")
    return new FighterRig(scene, id, layers);
  const texture = `frames-${id}`;
  for (const [key, a] of Object.entries(pack.animations)) {
    const animKey = `fighter-${id}-${key}`;
    if (scene.anims.exists(animKey)) continue;
    const frames = a.frames.map((frame) =>
      pack.kind === "frames"
        ? { key: `${texture}-${frame}` }
        : { key: texture, frame },
    );
    for (const frame of frames)
      if (
        !scene.textures.exists(frame.key) ||
        (frame.frame !== undefined &&
          !scene.textures.get(frame.key).has(String(frame.frame)))
      )
        throw Error(
          `Missing ${id} animation frame ${frame.key}/${frame.frame ?? ""}`,
        );
    scene.anims.create({
      key: animKey,
      frames,
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    });
  }
  return new FrameFighterVisual(scene, id, pack);
}
class FrameFighterVisual implements FighterVisual {
  readonly controller = new AnimationController();
  readonly root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private current = "";
  private replay = false;
  constructor(
    private scene: Phaser.Scene,
    readonly character: CharacterId,
    private pack: Exclude<FighterPack, { kind: "layered" }>,
  ) {
    const frame = pack.animations["idle-down"].frames[0];
    this.sprite = scene.add
      .sprite(
        0,
        -10,
        pack.kind === "frames"
          ? `frames-${character}-${frame}`
          : `frames-${character}`,
        pack.kind === "frames" ? undefined : frame,
      )
      .setOrigin(0.5, 0.75);
    this.root = scene.add.container(0, 0, [this.sprite]).setDepth(2);
    this.sprite.setScale(
      Math.min(92 / this.sprite.width, 92 / this.sprite.height),
    );
  }
  trigger(
    state: AnimationState,
    now: number,
    duration = 300,
    eventId?: number,
  ) {
    const accepted = this.controller.trigger(state, now, duration, eventId);
    if (accepted) this.replay = true;
    return accepted;
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
      ),
      dir = facing(pose.angle);
    const selected = this.pack.animations[`${state}-${dir}`] ? state : "idle";
    const key = animationKey(this.character, selected, dir);
    this.root.setPosition(x, y).setAlpha(alpha);
    if (this.current !== key || this.replay) {
      this.current = key;
      this.replay = false;
      this.sprite.play(key);
    }
    if (
      reduced &&
      ["idle", "walk", "run", "wave", "victory"].includes(selected)
    )
      this.sprite.anims.pause();
    else if (this.sprite.anims.isPaused) this.sprite.anims.resume();
    this.sprite.setTint(state === "hurt" ? 0xffbaba : 0xffffff);
  }
}
