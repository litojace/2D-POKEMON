// The real animation renderer on a small, network-free review stage.
import Phaser from "phaser";
import { CHARACTERS, FIGHTER_IDS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../../packages/shared/src/shop";
import { FighterRig } from "../../../apps/client/src/animation/rig";
import { rigAssets } from "../../../apps/client/src/animation/assets";
import type { SkinLook } from "../../../apps/client/src/creature-design";
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
    loaded,
    pose(state = "idle", reduced = false) {
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
          clock + 250,
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
        // Inspect the actual rendered triangles; a shared point may appear in
        // several triangles but must never acquire several different positions.
        const c = (r.rig as any).continuous;
        let gap = 0,
          finite = true;
        const first = new Map<number, { x: number; y: number }>();
        if (c.mesh)
          c.geometry.indices.forEach((id: number, i: number) => {
            const v = c.mesh.vertices[i];
            finite &&= Number.isFinite(v.x) && Number.isFinite(v.y);
            const p = first.get(id);
            if (p)
              gap = Math.max(gap, Math.abs(p.x - v.x), Math.abs(p.y - v.y));
            else first.set(id, { x: v.x, y: v.y });
          });
        const drawn = c.mesh ?? c.flat;
        return {
          id: r.id,
          finite,
          gap,
          visible: drawn?.visible ?? false,
          key: drawn?.texture.key ?? "",
          points: [...first.values()],
          exposedParts: [...(r.rig as any).images]
            .filter(([, image]: any) => image.visible)
            .map(([part]: any) => part),
        };
      });
    },
    destroy() {
      game.destroy(true);
    },
  };
}
