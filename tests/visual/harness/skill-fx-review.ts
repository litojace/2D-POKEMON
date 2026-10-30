import Phaser from "phaser";
import {
  CHARACTERS,
  exAbility,
  type Ability,
  type CharacterId,
  type Projectile,
  type Zone,
} from "@arena/shared";
import { fxFor } from "../../../apps/client/src/fx-engine";
import {
  drawProjectile,
  drawZone,
  drawWindup,
  drawChannel,
  playCast,
  playImpact,
  playBeam,
  playHit,
} from "../../../apps/client/src/skill-effects";

export function auditSkillScene(scene: Phaser.Scene) {
  const fx = fxFor(scene);
  return { stats: fx.diagnostics(), limits: fx.limits };
}

/** Actual effect renderer, frozen at authored phases for repeatable review. */
export async function reviewSkills() {
  let ready!: () => void;
  const loaded = new Promise<void>((resolve) => (ready = resolve));
  let scene: Review,
    clock = 1000,
    id: CharacterId = "voltkit",
    ability: Ability = CHARACTERS.voltkit.basic;
  let phase: "active" | "windup" | "impact" = "active",
    started = 1000,
    projectile: Projectile,
    zone: Zone;
  let hero: Phaser.GameObjects.Image, target: Phaser.GameObjects.Image;
  const x = 620,
    y = 500,
    tx = 990,
    ty = 500;
  class Review extends Phaser.Scene {
    preload() {
      for (const id of Object.keys(CHARACTERS))
        this.load.svg(`review-${id}`, `/assets/fighters/${id}/selection.svg`, {
          width: 220,
          height: 220,
        });
    }
    create() {
      scene = this;
      const floor = this.add.graphics().setDepth(-10);
      floor.fillStyle(0x182c3e).fillRect(0, 0, 1600, 900);
      for (let iy = 0; iy < 10; iy++)
        for (let ix = 0; ix < 18; ix++) {
          floor
            .fillStyle((ix + iy) % 2 ? 0x243b4c : 0x213747)
            .fillRoundedRect(ix * 94 + 1, iy * 94 + 1, 91, 91, 6);
          floor
            .lineStyle(1, 0x8da5b7, 0.1)
            .strokeRoundedRect(ix * 94 + 2, iy * 94 + 2, 88, 88, 6);
        }
      floor.lineStyle(2, 0xb9ddf0, 0.14).strokeCircle(800, 500, 330);
      hero = this.add
        .image(x, y, "review-voltkit")
        .setDisplaySize(100, 100)
        .setOrigin(0.5, 0.68)
        .setDepth(2);
      target = this.add
        .image(tx, ty, "review-duskveil")
        .setDisplaySize(100, 100)
        .setOrigin(0.5, 0.68)
        .setDepth(2);
      this.cameras.main
        .setZoom(Math.min(innerWidth / 1600, innerHeight / 900))
        .centerOn(800, 450);
      ready();
    }
    update(time: number) {
      if (!projectile) return;
      const now = time - started,
        fx = fxFor(this);
      const g = fx.g;
      if (phase === "windup") {
        drawWindup(
          g,
          ability,
          x,
          y,
          0,
          tx,
          ty,
          CHARACTERS[id].color,
          0.65,
          time,
        );
        return;
      }
      if (phase === "impact") return;
      if (["projectile", "barrage", "charged"].includes(ability.kind)) {
        projectile.x = x + 40 + Math.min(390, now * 0.7);
        drawProjectile(g, projectile, time, fx.reduced);
      } else if (ability.kind === "zone") {
        drawZone(
          g,
          zone,
          Math.min(0.8, Math.max(0.12, (now + 400) / 1000 / ability.duration)),
          time,
          fx.reduced,
        );
      } else if (ability.kind === "cone")
        drawChannel(
          g,
          ability,
          x,
          y,
          0,
          CHARACTERS[id].color,
          time,
          fx.reduced,
        );
    }
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    width: innerWidth,
    height: innerHeight,
    backgroundColor: "#122232",
    scene: [Review],
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true, preserveDrawingBuffer: true },
    fps: { target: 30 },
  });
  await loaded;
  game.loop.sleep();
  return {
    game,
    capture(
      champion: CharacterId,
      slot: number,
      stage: "active" | "windup" | "impact" = "active",
      ex = false,
    ) {
      fxFor(scene).destroy();
      clock += 2200;
      scene.time.now = clock;
      id = champion;
      const c = CHARACTERS[id];
      const original = [c.basic, ...c.skills][slot];
      ability = ex ? exAbility(original) : original;
      const before = JSON.stringify(ability);
      phase = stage;
      started = clock;
      hero.setTexture(`review-${id}`);
      target.setVisible(
        !["nova", "buff", "barrier", "rest", "counter", "clone"].includes(
          ability.kind,
        ),
      );
      projectile = {
        id: 20 + slot,
        owner: "hero",
        x: x + 40,
        y,
        vx: ability.speed || 700,
        vy: 0,
        remaining: ability.range,
        ability,
        color: c.color,
      } as Projectile;
      zone = {
        id: 30 + slot,
        owner: "hero",
        x: tx,
        y: ty,
        radius: ability.radius,
        until: scene.time.now + ability.duration,
        ability,
        color: c.color,
      } as Zone;
      const title = document.getElementById("review-title")!;
      title.textContent = `${c.name} · ${ability.name}${ex ? " · EX" : ""}`;
      if (stage === "impact") {
        playImpact(scene, ability, tx, ty, c.color, false);
        playHit(scene, c.element, tx, ty, c.color, false);
      } else if (stage !== "windup") {
        playCast(scene, ability, x, y, 0, c.color, false);
        if (ability.kind === "beam")
          playBeam(scene, ability, x, y, tx, ty, c.color, false);
      }
      const frames = stage === "impact" ? 10 : slot === 4 ? 18 : 10;
      for (let i = 0; i < frames; i++) game.headlessStep((clock += 16), 16);
      game.step((clock += 16), 16);
      return {
        id: ability.id,
        kind: ability.kind,
        unchanged: before === JSON.stringify(ability),
        stats: fxFor(scene).diagnostics(),
        limits: fxFor(scene).limits,
        reduced: fxFor(scene).reduced,
      };
    },
    clear() {
      projectile = undefined!;
      for (let i = 0; i < 180; i++) game.headlessStep((clock += 32), 32);
      game.step((clock += 16), 16);
      return fxFor(scene).diagnostics();
    },
  };
}
