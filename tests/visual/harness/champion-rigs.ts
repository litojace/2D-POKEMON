// The real animation renderer on a small, network-free review stage.
import Phaser from "phaser";
import { CHARACTERS, FIGHTER_IDS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../../packages/shared/src/shop";
import { FighterRig } from "../../../apps/client/src/animation/rig";
import {
  rigAssets,
  rigKey,
  rigPoint,
} from "../../../apps/client/src/animation/assets";
import type { SkinLook } from "../../../apps/client/src/creature-design";
import { profilePivot } from "../../../apps/client/src/creature-profile";
import type { AnimationState } from "../../../apps/client/src/animation/controller";

export function reviewChampions(canvas = false) {
  const assets = new Map(FIGHTER_IDS.map((id) => [id, rigAssets(id)]));
  const rigs: {
    id: CharacterId;
    angle: number;
    x: number;
    y: number;
    rig: FighterRig;
  }[] = [];
  const looks = new Map<CharacterId, SkinLook>();
  let scene: Phaser.Scene;
  let ready!: () => void;
  const loaded = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let clock = 1000;
  let playback = "";
  class Review extends Phaser.Scene {
    preload() {
      for (const a of [...assets.values()].flat())
        this.load.svg(a.key, a.url, { width: a.width, height: a.height });
    }
    create() {
      scene = this;
      FIGHTER_IDS.forEach((id, i) => {
        this.add.text(20, i * 260 + 16, id.toUpperCase(), {
          fontSize: "22px",
          fontStyle: "bold",
        });
        [Math.PI, 0, -Math.PI / 2].forEach((angle, j) => {
          const x = 260 + j * 450,
            y = i * 260 + 185;
          const rig = new FighterRig(this, id, assets.get(id)!);
          rig.root.setScale(2.1);
          rigs.push({ id, angle, x, y, rig });
        });
      });
      ready();
    }
  }
  const game = new Phaser.Game({
    type: canvas ? Phaser.CANVAS : Phaser.WEBGL,
    width: 1440,
    height: 2080,
    backgroundColor: "#10182b",
    scene: [Review],
    banner: false,
    fps: { target: 10 },
    audio: { noAudio: true },
  });
  return {
    game,
    loaded,
    /** Deterministic frames for reviewing actual joint movement as a short clip. */
    frame(state: AnimationState, elapsed: number) {
      game.loop.sleep();
      if (state !== playback) {
        clock += 1400;
        playback = state;
        for (const r of rigs) {
          r.rig.controller.reset();
          r.rig.trigger(state, clock, 1200);
        }
      }
      for (const r of rigs)
        r.rig.render(
          {
            hp: CHARACTERS[r.id].health,
            speed: state === "run" ? CHARACTERS[r.id].speed : 0,
            angle: r.angle,
            dash: state === "dash",
            jump: state === "jump",
            skin: looks.get(r.id) ?? null,
          },
          r.x,
          r.y,
          clock + elapsed,
          1,
          false,
        );
      game.step(clock + elapsed, 0);
    },
    pose(state = "idle", reduced = false, phase = 250 / 900) {
      clock += 1200;
      for (const r of rigs) {
        r.rig.controller.reset();
        if (!["idle", "walk", "run", "dash", "jump", "defeat"].includes(state))
          r.rig.trigger(state as AnimationState, clock, 900);
        r.rig.render(
          {
            hp: state === "defeat" ? 0 : CHARACTERS[r.id].health,
            speed:
              state === "walk"
                ? 100
                : state === "run"
                  ? CHARACTERS[r.id].speed
                  : 0,
            angle: r.angle,
            dash: state === "dash",
            jump: state === "jump",
            skin: looks.get(r.id) ?? null,
          },
          r.x,
          r.y,
          clock + phase * 900,
          1,
          reduced,
        );
      }
    },
    async appearance(kind: "rare" | "mythical" | "original") {
      looks.clear();
      if (kind !== "original")
        for (const id of FIGHTER_IDS) {
          const skin = CHAMPION_SKINS.find(
            (s) => s.champion === id && s.rarity === kind,
          )!;
          looks.set(id, { skin: skin.id, stage: 3 });
        }
      const pending = [...looks]
        .flatMap(([id, look]) => rigAssets(id, look))
        .filter((a) => !scene.textures.exists(a.key));
      if (pending.length) {
        for (const a of pending)
          scene.load.svg(a.key, a.url, { width: a.width, height: a.height });
        await new Promise<void>((resolve) => {
          scene.load.once("complete", resolve);
          scene.load.start();
        });
      }
    },
    audit() {
      return rigs.map((r) => {
        const images = [...(r.rig as any).images] as [
          string,
          Phaser.GameObjects.Image,
        ][];
        return {
          id: r.id,
          dir: (r.rig as any).dir,
          anchorY: r.y,
          rootY: r.rig.root.y,
          finite: images.every(([, v]) =>
            [v.x, v.y, v.rotation, v.scaleX, v.scaleY].every(Number.isFinite),
          ),
          visible: images.every(([, v]) => v.visible),
          key: images.find(([p]) => p === "body")![1].texture.key,
          points: images.map(([part, v]) => ({
            part,
            x: v.x,
            y: v.y,
            rotation: v.rotation,
            scaleX: v.scaleX,
            scaleY: v.scaleY,
          })),
          parts: images.filter(([, v]) => v.visible).map(([p]) => p),
          whole: images.some(([, v]) => v.texture.key.includes("whole")),
          headwearAttached:
            !["voltkit", "tidefin", "auralynx"].includes(r.id) ||
            Math.abs(
              images.find(([part]) => part === "flame")![1].rotation -
                images.find(([part]) => part === "head")![1].rotation,
            ) < 1e-6,
        };
      });
    },
    coverage() {
      const rows: {
        id: string;
        dir: string;
        part: string;
        limb: number;
        torso: number;
      }[] = [];
      const alpha = (
        asset: ReturnType<typeof rigAssets>[number],
        x: number,
        y: number,
      ) => {
        const image = scene.textures
          .get(asset.key)
          .getSourceImage() as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const c = canvas.getContext("2d", { willReadFrequently: true })!;
        c.drawImage(image, 0, 0);
        const left = asset.x * 2 + 100 - asset.originX * asset.width,
          top = asset.y * 2 + 130 - asset.originY * asset.height;
        const px = Math.round(((x - left) * image.width) / asset.width),
          py = Math.round(((y - top) * image.height) / asset.height);
        return (
          c
            .getImageData(Math.max(0, px - 1), Math.max(0, py - 1), 3, 3)
            .data.filter((_, i) => i % 4 === 3)
            .reduce((sum, v) => sum + v, 0) / 9
        );
      };
      for (const r of rigs) {
        const dir = (r.rig as any).dir as "left" | "right" | "up";
        const list = assets.get(r.id)!;
        const torso = list.find((a) => a.key === rigKey(r.id, dir, "body"))!;
        for (const part of [
          "head",
          "armL",
          "armR",
          "legL",
          "legR",
          "tail",
        ] as const) {
          if (r.id === "mystowl" && (part === "armL" || part === "armR"))
            continue;
          if (r.id === "duskveil" && (part === "legL" || part === "legR"))
            continue;
          if (r.id === "lumoth" && part === "tail") continue;
          // Terradon intentionally hides its arms behind the shell from the rear.
          if (r.id === "terradon" && dir === "up" && (part === "armL" || part === "armR")) continue;
          // Owl toes are line strokes: inspect the neck/tail rather than inventing a hip capsule.
          if (r.id === "mystowl" && (part === "legL" || part === "legR"))
            continue;
          const joint = profilePivot(r.id, dir, part)!;
          const point = rigPoint(part, ...joint);
          const x = point.x * 2 + 100,
            y = point.y * 2 + 130;
          const a = list.find((a) => a.key === rigKey(r.id, dir, part))!;
          rows.push({
            id: r.id,
            dir,
            part,
            limb: alpha(a, x, y),
            torso: alpha(torso, x, y),
          });
        }
      }
      return rows;
    },
    destroy() {
      game.destroy(true);
    },
  };
}
