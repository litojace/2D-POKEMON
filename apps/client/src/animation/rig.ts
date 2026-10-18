import { cosmeticLayer, type Skin } from "./cosmetics";
import { drawElementGlyph } from "../element-effects";
import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { moodFor, squashFor } from "./expression";
import {
  AnimationController,
  facing,
  type AnimationPose,
  type AnimationState,
  type Facing,
} from "./controller";
import {
  moodKey,
  parts,
  rigAnchors,
  rigKey,
  rigAssets,
  rigPoint,
  skinSuffix,
  type Part,
  type RigAsset,
} from "./assets";
import { paletteFor, type SkinLook } from "../creature-design";
import { hexToNumber, wornArt } from "../skins/skin-art";
import { FX_GRAVITY, drawFxParticle, drawSkinFx, type FxShape } from "../skins/skin-fx";
import { drawCollectionVictory, playCollectionEntrance } from "../skins/collection-fx";

/** Skinned texture sets already requested, per scene (loaded on first sight). */
const requested = new WeakMap<Phaser.Scene, Map<string, string[]>>();

/**
 * Follow-through: these parts hang on damped springs, so they trail behind
 * when the fighter moves and wobble when it lands or gets hit. `drag` is how
 * far (radians per px/s) they lean against the motion.
 */
interface Spring {
  drag: number;
  stiff: number;
  damp: number;
}
const SPRINGS: Partial<Record<Part, Spring>> = {
  tail: { drag: 1 / 420, stiff: 70, damp: 9 },
  ears: { drag: 1 / 1100, stiff: 160, damp: 14 },
  flame: { drag: 1 / 650, stiff: 110, damp: 10 },
  scarf: { drag: 1 / 520, stiff: 90, damp: 10 },
  wings: { drag: 1 / 1600, stiff: 120, damp: 12 },
};
/** Duskveil's lantern swings like a pendulum. */
const LANTERN: Spring = { drag: 1 / 240, stiff: 32, damp: 3.2 };
/** Rig pixels from the root (body pivot) down to the feet. */
const FEET = 21;
/** Rockslide Flex victory: how high the rock pile lifts the fighter (rig units). */
const ROCK_PILE = 24;
const MAX_PARTICLES = 48;

type ParticleShape = FxShape;
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: number;
  shape: ParticleShape;
  spin?: number;
}

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
  /** Spring state (angle, angular velocity) per follow-through part. */
  private springs = new Map<Part, { a: number; v: number }>();
  private particles: Particle[] = [];
  private lastX = NaN;
  private lastY = NaN;
  private velocityX = 0;
  private velocityY = 0;
  private lastState: AnimationState = "idle";
  private entrance = false;
  /** Rockslide Flex: pile height this frame (rig units) and the last time seen. */
  private pile = 0;
  private pileT = 0;
  /** Drawn under the fighter (the victory rock pile). */
  private under: Phaser.GameObjects.Graphics;
  private lastProgress = 0;
  /** The scale the caller asked for (view zoom, giants); squash multiplies it. */
  private baseX = 1;
  private baseY = 1;
  private setX = NaN;
  private setY = NaN;
  private tiltAt = 0;
  private tiltUntil = 0;
  private tiltSide = 1;
  /** Texture suffix of the Shop skin being shown ("" = the champion's own). */
  private suffix = "";
  /** The state skin effects last saw (to fire one-off bursts once). */
  private fxState: AnimationState = "idle";
  constructor(
    private scene: Phaser.Scene,
    readonly character: CharacterId,
    private assets: RigAsset[],
  ) {
    this.root = scene.add.container(0, 0).setDepth(2);
    this.effects = scene.add.graphics().setDepth(3);
    this.under = scene.add.graphics().setDepth(1.9);
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
    this.tiltAt = scene.time.now + 4000 + Math.random() * 3000;
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
    this.under.setVisible(visible);
  }
  destroy() {
    this.root.destroy(true);
    this.effects.destroy();
    this.under.destroy();
  }
  /** Kick every spring (a landing thump, a hit). */
  private kick(amount: number) {
    for (const s of this.springs.values()) s.v += amount;
  }
  private emit(p: Omit<Particle, "age">) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ ...p, age: 0 });
  }
  /** Spawn on average `rate` particles a second. */
  private chance(rate: number, dt: number) {
    return Math.random() < rate * dt;
  }
  /**
   * Show a Shop skin (or the champion's own look). Skinned textures load the
   * first time they are needed; until then the fighter keeps its own look.
   */
  wear(look: SkinLook | null | undefined) {
    const suffix = skinSuffix(this.character, look);
    if (suffix === this.suffix) return;
    const probe = rigKey(this.character, "down", "body", suffix);
    let asked = requested.get(this.scene);
    const pending = asked?.get(suffix);
    // The body can finish before arms, accessories or expression textures.
    // Keep the current form until the entire requested set is ready.
    if (!this.scene.textures.exists(probe) || pending?.some((key) => !this.scene.textures.exists(key))) {
      if (!asked) requested.set(this.scene, (asked = new Map()));
      if (!asked.has(suffix)) {
        const assets = rigAssets(this.character, look ?? null);
        asked.set(suffix, assets.map((a) => a.key));
        for (const a of assets)
          if (!this.scene.textures.exists(a.key))
            this.scene.load.svg(a.key, a.url, { width: a.width, height: a.height });
        if (!this.scene.load.isLoading()) this.scene.load.start();
      }
      return;
    }
    this.suffix = suffix;
    for (const [part, image] of this.images)
      image.setTexture(rigKey(this.character, this.dir, part, suffix));
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
    this.wear(pose.skin);
    const dt = this.lastRender
      ? Math.min(0.05, Math.max(0, now - this.lastRender) / 1000)
      : 0;
    const blend = this.lastRender
      ? 1 - Math.exp(-Math.max(0, now - this.lastRender) / 35)
      : 1;
    this.lastRender = now;
    // The caller sets the scale before each render; keep it as the base.
    if (this.root.scaleX !== this.setX || this.root.scaleY !== this.setY) {
      this.baseX = this.root.scaleX;
      this.baseY = this.root.scaleY;
    }
    // Smoothed on-screen velocity drives the follow-through.
    if (dt > 0 && Number.isFinite(this.lastX)) {
      const k = 1 - Math.exp(-dt / 0.08);
      this.velocityX += ((x - this.lastX) / dt - this.velocityX) * k;
      this.velocityY += ((y - this.lastY) / dt - this.velocityY) * k;
    }
    if (Math.hypot(x - this.lastX, y - this.lastY) > 200) {
      // Teleported (new round, respawn): no whiplash.
      this.velocityX = this.velocityY = 0;
    }
    this.lastX = x;
    this.lastY = y;
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
          .setTexture(rigKey(this.character, dir, part, this.suffix))
          .setOrigin(asset.originX, asset.originY)
          .setPosition(asset.x, asset.y);
      }
    }
    const t = (now - this.controller.started) / 1000;
    const moving = state === "walk" || state === "run";
    const heavy = this.character === "terradon";
    // Mystowl and Duskveil hover instead of stepping.
    const floats =
      this.character === "mystowl" || this.character === "duskveil";
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
    const kit = CHARACTERS[this.character];
    const ability =
      state === "basic" ? kit.basic : skill >= 0 ? kit.skills[skill] : undefined;
    const kind = ability?.kind;
    // Wind-up, strike, settle. It follows authorization; it never delays play.
    const punch = attack
      ? progress < 0.2
        ? -progress * 2
        : progress < 0.55
          ? Math.sin(((progress - 0.2) / 0.35) * Math.PI) * 1.3
          : (1 - progress) * 0.5
      : 0;
    const windup = attack && progress < 0.2 ? progress / 0.2 : 0;
    const strike =
      attack && progress >= 0.2 && progress < 0.6
        ? Math.sin(((progress - 0.2) / 0.4) * Math.PI)
        : 0;
    const aimX = Math.cos(pose.angle),
      aimY = Math.sin(pose.angle);
    const body = this.images.get("body")!,
      head = this.images.get("head")!,
      eyes = this.images.get("eyes")!,
      ears = this.images.get("ears")!,
      tail = this.images.get("tail")!,
      flame = this.images.get("flame")!,
      wings = this.images.get("wings")!,
      scarf = this.images.get("scarf")!;
    this.root.setPosition(x, y).setAlpha(alpha).setAngle(0);
    for (const image of this.images.values())
      image
        .setRotation(0)
        .setScale(0.5)
        .setTint(state === "hurt" ? 0xffb4b4 : 0xffffff);
    let [sx, sy] = reduced ? [1, 1] : squashFor(state, progress, t, pose.angle);
    let offsetX = 0,
      offsetY = 0;
    body.setScale(0.5, 0.5 + (reduced ? 0 : idle * 0.009));
    head.y = rigAnchors.headY + (reduced ? 0 : idle * 0.55);
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
    flame.rotation = 0;
    scarf.rotation = reduced ? 0 : Math.sin(now / 200) * 0.06;
    // ---- Expression.
    const mood = dir === "up" ? "normal" : moodFor(state, pose);
    const eyesKey = moodKey(this.character, dir, mood, this.suffix);
    if (eyes.texture.key !== eyesKey && this.scene.textures.exists(eyesKey))
      eyes.setTexture(eyesKey);
    if (now >= this.blinkAt) {
      this.blinkUntil = now + 125;
      this.blinkAt = now + 3000 + Math.random() * 4000;
    }
    const canBlink = mood === "normal" || mood === "focus";
    eyes.setScale(
      0.5,
      canBlink && (state === "blink" || now < this.blinkUntil) ? 0.055 : 0.5,
    );
    eyes.y = head.y - rigAnchors.eyesLift;
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
    if (floats && !reduced && state !== "defeat")
      offsetY -=
        6 + Math.sin(now / (this.character === "duskveil" ? 260 : 520)) * 3;
    if (moving && !reduced) {
      const stride =
        this.character === "cindrake"
          ? 0.32
          : this.character === "tidefin"
            ? 0.65
            : 0.48;
      armL.rotation = step * stride;
      armR.rotation = -step * stride;
      legL.rotation = -step * (floats ? 0.08 : heavy ? 0.18 : 0.28);
      legR.rotation = step * (floats ? 0.08 : heavy ? 0.18 : 0.28);
      legL.y += step * 2;
      legR.y -= step * 2;
      body.rotation = aimX * 0.055;
      wings.rotation = -step * 0.045;
      scarf.rotation = aimX * 0.16;
      // A little bounce on every step (not for hoverers).
      if (!floats) offsetY -= Math.abs(step) * (heavy ? 1 : 1.6);
    }
    // ---- Attacks: a pose for each kind of move.
    if (attack) {
      armR.rotation = -punch * 1.3;
      armL.rotation = punch * 0.7;
      head.rotation = -punch * 0.06;
      body.rotation = punch * 0.08;
      if (
        kind === "projectile" ||
        kind === "barrage" ||
        kind === "charged" ||
        kind === "beam"
      ) {
        // Release, then recoil away from the shot.
        const recoil =
          progress > 0.25 && progress < 0.7
            ? Math.sin(((progress - 0.25) / 0.45) * Math.PI)
            : 0;
        offsetX -= aimX * recoil * 3;
        offsetY -= aimY * recoil * 2;
        if (kind === "beam" || kind === "charged") {
          armL.rotation = -0.9 - strike * 0.3;
          armR.rotation = 0.9 + strike * 0.3;
        }
      } else if (kind === "melee") {
        // Lunge into the swing.
        offsetX += aimX * Math.max(0, punch) * 6;
        offsetY += aimY * Math.max(0, punch) * 4;
        body.rotation = aimX * punch * 0.14;
        legL.rotation = -0.2 * strike;
        legR.rotation = 0.25 * strike;
      } else if (kind === "cone") {
        armL.rotation = -0.9;
        armR.rotation = 0.9;
        body.rotation = aimX * 0.1;
        flame.setScale(0.6, 0.62);
      } else if (kind === "nova") {
        // Crouch to gather, then burst up and out.
        sy *= 1 - 0.1 * windup + 0.08 * strike;
        sx *= 1 + 0.08 * windup - 0.04 * strike;
        armL.rotation = 1.4 * strike - 0.4 * windup;
        armR.rotation = -1.4 * strike + 0.4 * windup;
      } else if (kind === "zone") {
        // Arms up, then slam down and plant.
        const raise =
          progress < 0.2
            ? windup
            : progress < 0.35
              ? 1
              : Math.max(0, 1 - (progress - 0.35) / 0.15);
        armL.rotation = 2.3 * raise;
        armR.rotation = -armL.rotation;
        if (progress > 0.3 && progress < 0.55) sy *= 0.92;
      } else if (kind) {
        // Guards, buffs, rests: a braced, upright stance.
        armL.rotation = -1.0;
        armR.rotation = 1.0;
        sy *= 1 + 0.04 * strike;
      }
      if (skill === 3) {
        // Ultimates get a hover and a bigger reach.
        offsetY -= Math.sin(progress * Math.PI) * 6;
        wings.setScale(0.58, 0.5);
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
        // The crest flares on every attack.
        flame.setScale(0.5 + strike * 0.12, 0.5 + strike * 0.18);
        if (state === "basic" || skill === 0) {
          head.y -= punch * 3;
          head.rotation = punch * 0.16;
        }
        if (skill === 1) {
          armL.rotation = -1.6;
          armR.rotation = 1.6;
          wings.rotation = punch * 0.12;
        }
      } else if (this.character === "tidefin") {
        scarf.rotation = punch * 0.3;
        if (skill === 0) {
          armR.rotation = -punch * 2;
          armR.x += punch * 4;
        }
        if (skill === 1) legR.rotation = punch * 0.9;
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
          armL.x += 5;
          armR.x -= 5;
        }
      } else if (this.character === "mystowl") {
        // The third eye pulses as it gathers power.
        flame.setScale(0.5 + windup * 0.15 + strike * 0.08);
      } else if (this.character === "terradon" && strike > 0.6) {
        offsetX += (Math.random() - 0.5) * 2;
      }
    }
    // ---- Signature idles.
    if (!reduced) {
      if (this.character === "auralynx") {
        const fast = pose.charging || attack;
        wings.rotation = now / (fast ? 420 : 1400);
        if (pose.charging || (attack && skill === 3))
          offsetY -= 3 + Math.sin(now / 550) * 2;
        // Meditative float after standing still for a moment.
        if (state === "idle" && t > 1.2) {
          const settle = Math.min(1, (t - 1.2) / 0.6);
          offsetY -= settle * (5 + Math.sin(now / 600) * 2);
          legL.rotation = 0.5 * settle;
          legR.rotation = -0.5 * settle;
          armL.rotation = -0.35 - 0.25 * settle;
          armR.rotation = 0.35 + 0.25 * settle;
        }
      }
      if (this.character === "lumoth")
        // Moth wings flutter, faster while moving.
        wings.setScale(
          0.5 + Math.sin(now / (moving ? 45 : 140)) * 0.04,
          0.5 + Math.sin(now / (moving ? 45 : 140)) * 0.015,
        );
      if (this.character === "terradon") {
        if (!moving) body.setScale(0.5 + idle * 0.015, 0.5 + idle * 0.02);
        // The sapling sways.
        flame.rotation = Math.sin(now / 300) * 0.09;
      }
      if (this.character === "tidefin")
        // Gill fronds ripple.
        ears.setScale(
          0.5 + Math.sin(now / 170) * 0.02,
          0.5 + Math.sin(now / 170 + 1.2) * 0.03,
        );
      if (this.character === "duskveil")
        // Robe tatters ripple.
        body.setScale(0.5 + Math.sin(now / 180) * 0.012, 0.5);
      if (this.character === "voltkit" && state === "dash")
        // Glider membranes spread mid-dash.
        wings.setScale(0.64, 0.56);
      if (this.character === "mystowl" && state === "idle") {
        // An owlish head tilt now and then.
        if (now >= this.tiltAt) {
          this.tiltUntil = now + 900;
          this.tiltAt = now + 4500 + Math.random() * 4000;
          this.tiltSide = Math.random() < 0.5 ? -1 : 1;
        }
        if (now < this.tiltUntil)
          head.rotation +=
            this.tiltSide * 0.26 * Math.sin(((this.tiltUntil - now) / 900) * Math.PI);
      }
      if (pose.charging && this.character === "auralynx")
        body.setTint(0xffddff);
    }
    // ---- Movement and reactions.
    if (state === "dash") {
      armL.rotation = -0.9;
      armR.rotation = 0.9;
      legL.rotation = 0.6;
      legR.rotation = -0.6;
      scarf.rotation = 0.25;
      body.rotation = aimX * 0.15;
    }
    if (state === "jump") {
      armL.rotation = -1.1;
      armR.rotation = 1.1;
      legL.rotation = 0.7;
      legR.rotation = -0.7;
    }
    if (state === "land") {
      legL.rotation = -0.3;
      legR.rotation = 0.3;
      head.y += 3 * (1 - progress);
    }
    if (state === "hurt") {
      offsetX -= aimX * Math.sin(progress * Math.PI) * 5;
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
    // ---- Greetings (round intro) and victories, one for each champion.
    if (state === "wave" && !reduced) this.wave(t, { head, body, armL, armR, legL, legR, tail, wings, flame, ears }, (dx, dy) => {
      offsetX += dx;
      offsetY += dy;
    });
    else if (state === "wave") armR.rotation = -2.4;
    // An equipped Victory reward replaces the champion's own victory move.
    if (
      state === "victory" &&
      !reduced &&
      t < 2.2 &&
      pose.look?.victory !== "rockslide-flex"
    )
      this.victory(t, { head, body, armL, armR, legL, legR, tail, wings, flame, ears }, (dx, dy) => {
        offsetX += dx;
        offsetY += dy;
      });
    // Rockslide Flex (a Victory reward): a pile of rocks rises under the
    // fighter, who stands on top flexing while pebbles bounce away.
    const flexing =
      state === "victory" && !reduced && pose.look?.victory === "rockslide-flex";
    const lastPileT = this.pileT;
    this.pileT = flexing ? t : 0;
    this.pile = 0;
    if (flexing) {
      const rise = Math.min(1, t / 0.35);
      const sink = t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.4) : 1;
      this.pile = ROCK_PILE * (1 - (1 - rise) ** 3) * sink;
      offsetX = 0;
      offsetY -= this.pile;
      if (t > 0.4 && t < 2.6) {
        const pump = Math.sin((t - 0.4) * 7);
        armL.rotation = 2.45 + pump * 0.18;
        armR.rotation = -2.45 - pump * 0.18;
        body.rotation = 0;
        head.rotation = -0.06;
        sy *= 1 + Math.max(0, pump) * 0.03;
      }
      // Pebbles burst when the pile lands, and with each flex.
      const pumps = (v: number) => Math.floor(Math.max(0, v - 0.4) * 7 / Math.PI);
      if (lastPileT < 0.35 && t >= 0.35) this.pebbles(x, y, 16);
      else if (t < 2.6 && pumps(t) > pumps(lastPileT)) this.pebbles(x, y, 3);
    }
    // Smooth hand-offs between poses (springy parts integrate on their own).
    for (const [part, image] of this.images) {
      if (!reduced && SPRINGS[part]) continue;
      const old = this.previousRotations.get(part) ?? 0;
      const delta = Math.atan2(
        Math.sin(image.rotation - old),
        Math.cos(image.rotation - old),
      );
      image.rotation = old + delta * blend;
    }
    // ---- Follow-through springs.
    if (!reduced && dt > 0) {
      if (state !== this.lastState) {
        if (state === "land") this.kick(2.5);
        if (state === "hurt") this.kick(Math.random() < 0.5 ? -4 : 4);
        if (state === "dash") this.kick(-aimX * 3);
      }
      for (const part of Object.keys(SPRINGS) as Part[]) {
        const image = this.images.get(part)!;
        const spring =
          part === "tail" && this.character === "duskveil"
            ? LANTERN
            : SPRINGS[part]!;
        const target =
          image.rotation +
          Math.max(-0.55, Math.min(0.55, -this.velocityX * spring.drag));
        const s = this.springs.get(part) ?? { a: target, v: 0 };
        const accel = spring.stiff * (target - s.a) - spring.damp * s.v;
        s.v += accel * dt;
        s.a += s.v * dt;
        if (!Number.isFinite(s.a)) {
          s.a = target;
          s.v = 0;
        }
        this.springs.set(part, s);
        image.rotation = s.a;
      }
    } else if (reduced) this.springs.clear();
    // Mountainborn entrance: a burst of pebbles as the round's greeting starts.
    if (
      state === "wave" &&
      this.lastState !== "wave" &&
      pose.look?.entrance === "mountainborn"
    )
      this.entrance = true;
    this.lastState = state;
    // Keep independently animated facial parts attached to the head, including recoil/fainting.
    eyes.rotation = head.rotation;
    eyes.setPosition(
      Math.sin(head.rotation) * rigAnchors.eyesLift,
      head.y - Math.cos(head.rotation) * rigAnchors.eyesLift,
    );
    ears.rotation += head.rotation;
    ears.setPosition(
      Math.sin(head.rotation) * rigAnchors.earsLift,
      head.y - Math.cos(head.rotation) * rigAnchors.earsLift,
    );
    flame.setPosition(ears.x, ears.y);
    flame.rotation += head.rotation;
    if (reduced) {
      // Poses only: no bobbing, lunging or squashing.
      offsetX = 0;
      offsetY = 0;
      sx = 1;
      sy = 1;
    }
    // ---- Root: squash/stretch about the feet, and the pose offsets.
    const scaleX = this.baseX * sx,
      scaleY = this.baseY * sy;
    this.root.setScale(scaleX, scaleY);
    this.setX = this.root.scaleX;
    this.setY = this.root.scaleY;
    this.root.x += offsetX * this.baseX;
    this.root.y += offsetY * this.baseY + FEET * this.baseY * (1 - sy);
    for (const image of this.images.values()) {
      const texture = cosmeticLayer(
        this.scene,
        image.texture.key,
        // A champion skin wins over an all-fighter Skin (design §10.5.2).
        (this.suffix ? null : (pose.look?.skin ?? null)) as Skin | null,
      );
      if (image.texture.key !== texture) image.setTexture(texture);
    }
    this.effects.clear();
    this.under.clear();
    if (this.pile > 0) this.drawPile(x, y);
    if (reduced) {
      this.particles.length = 0;
      return;
    }
    this.drawEffects(pose, state, x, y, now, dt, t, progress, skill, attack, moving, dir);
    this.lastProgress = progress;
  }

  /** A burst of bouncing pebbles from the top of the victory rock pile. */
  private pebbles(x: number, y: number, count: number) {
    const sc = this.baseX;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * (0.15 + Math.random() * 0.7);
      const speed = 70 + Math.random() * 120;
      this.emit({
        x: x + (Math.random() - 0.5) * 34 * sc,
        y: y + (FEET - this.pile) * sc,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 40,
        life: 0.7 + Math.random() * 0.4,
        size: (2.2 + Math.random() * 2.4) * sc,
        color: [0x8a7a68, 0xa99782, 0x6f6152, 0xffc46b][i % 4],
        shape: "pebble",
      });
    }
  }
  /** The Rockslide Flex pile: chunky stones stacked under the fighter's feet. */
  private drawPile(x: number, y: number) {
    const g = this.under,
      sc = this.baseX,
      base = y + FEET * sc,
      h = this.pile * sc,
      w = 30 * sc;
    const stones: [number, number, number, number, number][] = [
      // x offset, y (0 = ground, 1 = top), width, height, colour
      [-0.62, 0.12, 0.62, 0.42, 0x6f6152],
      [0.6, 0.1, 0.6, 0.4, 0x7c6d5d],
      [-0.05, 0.05, 0.8, 0.5, 0x8a7a68],
      [-0.32, 0.55, 0.58, 0.42, 0x9b8a75],
      [0.34, 0.6, 0.55, 0.4, 0x8a7a68],
      [0.0, 0.92, 0.66, 0.34, 0xa99782],
    ];
    g.fillStyle(0x000000, 0.25).fillEllipse(x, base + 2 * sc, w * 2.3, 9 * sc);
    for (const [ox, oy, sw, sh, color] of stones) {
      const cx = x + ox * w,
        cy = base - oy * h,
        rw = sw * w,
        rh = Math.max(2, sh * h);
      g.fillStyle(color, 1).fillRoundedRect(cx - rw / 2, cy - rh / 2, rw, rh, Math.min(rw, rh) * 0.35);
      g.lineStyle(1.5 * sc, 0x3d342b, 0.9).strokeRoundedRect(cx - rw / 2, cy - rh / 2, rw, rh, Math.min(rw, rh) * 0.35);
      g.fillStyle(0xffffff, 0.12).fillRect(cx - rw * 0.3, cy - rh * 0.4, rw * 0.35, Math.max(1, rh * 0.15));
    }
    // A thin amber glint, like Cragstone's cracks.
    g.lineStyle(1.4 * sc, 0xffc46b, 0.8).lineBetween(x - 6 * sc, base - h * 0.55, x + 2 * sc, base - h * 0.35);
  }

  /** Each champion's own greeting at the start of a round. */
  private wave(
    t: number,
    p: Record<
      | "head"
      | "body"
      | "armL"
      | "armR"
      | "legL"
      | "legR"
      | "tail"
      | "wings"
      | "flame"
      | "ears",
      Phaser.GameObjects.Image
    >,
    move: (dx: number, dy: number) => void,
  ) {
    const hand = -2.4 + Math.sin(t * 14) * 0.4;
    switch (this.character) {
      case "voltkit":
        // A bouncy hop-and-wave.
        p.armR.rotation = hand;
        move(0, -Math.max(0, Math.sin(t * 9)) * 5);
        p.ears.rotation = Math.sin(t * 9) * 0.1;
        break;
      case "cindrake":
        // Fist up, crest blazing.
        p.armR.rotation = -2.7;
        p.armL.rotation = 0.3;
        p.flame.setScale(0.6, 0.66);
        p.head.rotation = -0.06;
        break;
      case "tidefin":
        // Blade salute.
        p.armR.rotation = -2.2;
        p.head.rotation = -0.1;
        p.legR.rotation = 0.3;
        break;
      case "auralynx":
        // A calm bow, palms together.
        p.head.y += 3 + Math.sin(Math.min(1, t / 0.5) * Math.PI) * 2;
        p.armL.rotation = -0.6;
        p.armR.rotation = 0.6;
        p.armL.x += 5;
        p.armR.x -= 5;
        break;
      case "lumoth":
        // A shy wave with a flutter.
        p.armR.rotation = hand;
        p.wings.setScale(0.5 + Math.abs(Math.sin(t * 10)) * 0.06, 0.5);
        p.head.rotation = 0.1;
        break;
      case "mystowl":
        // One wing raised, head tilted.
        p.wings.rotation = Math.sin(t * 10) * 0.1;
        p.head.rotation = 0.22;
        move(0, -Math.sin(t * 3) * 2);
        break;
      case "terradon":
        // A slow, sleepy wave.
        p.armR.rotation = -2.2 + Math.sin(t * 5) * 0.3;
        p.flame.rotation = Math.sin(t * 8) * 0.18;
        p.head.rotation = -0.08;
        break;
      case "duskveil":
        // Lifts its lantern.
        p.armR.rotation = -1.6;
        p.tail.rotation = -0.4 + Math.sin(t * 6) * 0.3;
        break;
    }
  }

  /** Each champion's own celebration. */
  private victory(
    t: number,
    p: Record<
      | "head"
      | "body"
      | "armL"
      | "armR"
      | "legL"
      | "legR"
      | "tail"
      | "wings"
      | "flame"
      | "ears",
      Phaser.GameObjects.Image
    >,
    move: (dx: number, dy: number) => void,
  ) {
    switch (this.character) {
      case "voltkit":
        p.armL.rotation = 2.4 + Math.sin(t * 15) * 0.3;
        p.armR.rotation = -2.4 - Math.sin(t * 15) * 0.3;
        move(0, -Math.max(0, Math.sin(t * 8)) * 8);
        break;
      case "cindrake":
        p.wings.setScale(0.62, 0.55);
        p.flame.setScale(0.62, 0.7);
        p.head.y -= 4;
        p.armL.rotation = -0.9;
        p.armR.rotation = 0.9;
        break;
      case "tidefin":
        this.root.rotation = t < 0.65 ? (t / 0.65) * Math.PI * 2 : 0;
        p.armL.rotation = -0.8;
        p.armR.rotation = t < 0.65 ? 0.8 : -2.3;
        p.legL.rotation = 0.5;
        p.legR.rotation = -0.5;
        break;
      case "auralynx":
        p.wings.rotation = t * 6;
        p.armL.rotation = 1.2;
        p.armR.rotation = -1.2;
        p.body.setScale(0.5 + Math.sin(t * 8) * 0.02);
        move(0, -Math.min(1, t / 0.4) * 6);
        break;
      case "lumoth":
        // A spin with a burst of wing flaps.
        this.root.rotation = t < 0.8 ? (t / 0.8) * Math.PI * 2 : 0;
        p.wings.setScale(0.5 + Math.abs(Math.sin(t * 14)) * 0.08, 0.5);
        move(0, -Math.max(0, Math.sin(t * 7)) * 6);
        break;
      case "mystowl":
        // Rises with cloak spread, head bobbing.
        move(0, -Math.min(1, t / 0.5) * 10);
        p.wings.setScale(0.62, 0.56);
        p.head.rotation = Math.sin(t * 5) * 0.16;
        p.flame.setScale(0.6);
        break;
      case "terradon":
        // A big stretch and yawn.
        p.armL.rotation = 2.2;
        p.armR.rotation = -2.2;
        p.head.rotation = -0.12;
        p.body.setScale(
          0.5 + Math.sin(t * 3) * 0.03,
          0.5 - Math.sin(t * 3) * 0.02,
        );
        break;
      case "duskveil":
        // Lantern held high and swung in a circle.
        p.armR.rotation = -1.8;
        p.tail.rotation = -0.6 + Math.sin(t * 5) * 0.35;
        move(0, -Math.sin(t * 4) * 3);
        break;
    }
  }

  private drawEffects(
    pose: AnimationPose,
    state: AnimationState,
    x: number,
    y: number,
    now: number,
    dt: number,
    t: number,
    progress: number,
    skill: number,
    attack: boolean,
    moving: boolean,
    dir: Facing,
  ) {
    const g = this.effects;
    const art = wornArt(this.character, pose.skin);
    const stage = pose.skin?.stage ?? 1;
    // Epic and Mythical skins recolour the cast glyph, rings and sparks.
    const color = art?.skill ?? CHARACTERS[this.character].color;
    const glow = art
      ? hexToNumber(paletteFor(this.character, pose.skin).glow)
      : undefined;
    const sc = this.baseX;
    const at = (part: Part, ax: number, ay: number) => {
      const p = rigPoint(part, ax, ay);
      return {
        x: this.root.x + p.x * this.root.scaleX,
        y: this.root.y + p.y * this.root.scaleY,
      };
    };
    // The tail tip sits on the far side when facing right.
    const tailX = (ax: number) => (dir === "right" ? 200 - ax : ax);
    if (this.entrance) {
      this.entrance = false;
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI * (0.1 + Math.random() * 0.8);
        const speed = 90 + Math.random() * 150;
        this.emit({
          x: x + (Math.random() - 0.5) * 30 * sc,
          y: y + FEET * sc,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 60,
          life: 0.8 + Math.random() * 0.4,
          size: (2.5 + Math.random() * 2.5) * sc,
          color: [0x8a7a68, 0xa99782, 0x6f6152, 0xffc46b][i % 4],
          shape: "pebble",
        });
      }
    }
    // ---- Signature particles.
    if (this.character === "voltkit" && this.chance(moving ? 6 : 2.5, dt)) {
      const tip = at("tail", tailX(168), 84);
      this.emit({
        x: tip.x + (Math.random() - 0.5) * 8 * sc,
        y: tip.y + (Math.random() - 0.5) * 8 * sc,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 20,
        life: 0.25,
        size: 5 * sc,
        color: glow ?? 0x7ff3ff,
        shape: "spark",
      });
    }
    if (this.character === "cindrake" && this.chance(attack ? 14 : 5, dt)) {
      const crest = at("flame", 100 + (Math.random() - 0.5) * 30, 20);
      this.emit({
        x: crest.x,
        y: crest.y,
        vx: (Math.random() - 0.5) * 18,
        vy: -30 - Math.random() * 30,
        life: 0.7,
        size: (1.4 + Math.random() * 1.4) * sc,
        color: Math.random() < 0.5 ? (glow ?? 0xffd34d) : (art ? hexToNumber(paletteFor(this.character, pose.skin).mid) : 0xff7a4f),
        shape: "dot",
      });
    }
    if (this.character === "tidefin" && moving && this.chance(7, dt)) {
      this.emit({
        x: x - Math.cos(pose.angle) * 14 * sc + (Math.random() - 0.5) * 10 * sc,
        y: y + 16 * sc,
        vx: (Math.random() - 0.5) * 10,
        vy: -14 - Math.random() * 10,
        life: 0.6,
        size: (2 + Math.random() * 2) * sc,
        color: glow ?? 0xbff6ff,
        shape: "bubble",
      });
    }
    if (this.character === "lumoth" && this.chance(moving ? 10 : 2.5, dt)) {
      const side = Math.random() < 0.5 ? 40 : 160;
      const wing = at("wings", side, 80 + Math.random() * 60);
      this.emit({
        x: wing.x,
        y: wing.y,
        vx: (Math.random() - 0.5) * 16,
        vy: 6 + Math.random() * 10,
        life: 0.9,
        size: (2 + Math.random() * 1.5) * sc,
        color: glow ?? 0xfff1a0,
        shape: "star",
      });
    }
    if (
      this.character === "terradon" &&
      skill >= 0 &&
      this.lastProgress < 0.3 &&
      progress >= 0.3
    ) {
      // Stomp: dust puffs kick out from the feet.
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1;
        this.emit({
          x: x + side * (8 + Math.random() * 14) * sc,
          y: y + (FEET - 2 + Math.random() * 4) * sc,
          vx: side * (18 + Math.random() * 22),
          vy: -6 - Math.random() * 10,
          life: 0.45 + Math.random() * 0.2,
          size: (2.5 + Math.random() * 2) * sc,
          color: 0xead9b6,
          shape: "puff",
        });
      }
    }
    if (pose.ultReady && this.chance(4, dt)) {
      // Charged ultimate: motes rise around the fighter.
      const a = Math.random() * Math.PI * 2;
      this.emit({
        x: x + Math.cos(a) * 22 * sc,
        y: y + 14 * sc + Math.sin(a) * 6 * sc,
        vx: 0,
        vy: -36,
        life: 0.8,
        size: 2.2 * sc,
        color,
        shape: "star",
      });
    }
    if (state === "victory" && t < 1.2 && this.chance(18, dt)) {
      const a = Math.random() * Math.PI * 2;
      this.emit({
        x: x + Math.cos(a) * 10 * sc,
        y: y - 20 * sc,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70 - 20,
        life: 0.6,
        size: 2.6 * sc,
        color: Math.random() < 0.5 ? color : 0xffffff,
        shape: "star",
      });
    }
    // ---- Shop skin extras (trails, details, Mythical Awakening effects).
    if (art) {
      const top = at("head", 100, 55);
      drawSkinFx(
        {
          g,
          under: this.under,
          emit: (p) => this.emit(p),
          chance: (rate, d) => this.chance(rate, d),
          x,
          y,
          headX: top.x,
          headY: top.y,
          sc,
          now,
          dt,
          angle: pose.angle,
          moving,
          dashing: state === "dash",
          hurt: state === "hurt",
          defeated: state === "defeat",
          greeting: state === "wave" && this.fxState !== "wave",
          celebrating: state === "victory" && this.fxState !== "victory",
          knockedOut: state === "defeat" && this.fxState !== "defeat",
          ultimate: skill === 3 && this.lastProgress < 0.3 && progress >= 0.3,
          ambient: pose.ambient !== false,
        },
        art,
        stage,
      );
    }
    // ---- Shop collection pieces: entrance burst and victory finale.
    if (state === "wave" && this.fxState !== "wave" && pose.look?.entrance)
      playCollectionEntrance((p) => this.emit(p), pose.look.entrance, x, y, sc);
    if (state === "victory" && pose.look?.victory)
      drawCollectionVictory(
        g,
        this.under,
        (p) => this.emit(p),
        (rate, d) => this.chance(rate, d),
        pose.look.victory,
        x,
        y,
        sc,
        t,
        dt,
        this.fxState !== "victory",
      );
    this.fxState = state;
    // ---- Update and draw particles.
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (FX_GRAVITY[p.shape] ?? 0) * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const p of this.particles) {
      const fade = 1 - p.age / p.life;
      if (drawFxParticle(g, p, fade)) continue;
      if (p.shape === "dot") g.fillStyle(p.color, 0.85 * fade).fillCircle(p.x, p.y, p.size);
      else if (p.shape === "bubble")
        g.lineStyle(1.2, p.color, 0.8 * fade).strokeCircle(p.x, p.y, p.size);
      else if (p.shape === "puff")
        g.fillStyle(p.color, 0.35 * fade).fillCircle(p.x, p.y, p.size * (1 + p.age * 2));
      else if (p.shape === "pebble") {
        const s = p.size;
        g.fillStyle(p.color, fade)
          .fillTriangle(p.x - s, p.y, p.x, p.y - s * 0.8, p.x + s, p.y)
          .fillTriangle(p.x - s, p.y, p.x, p.y + s * 0.7, p.x + s, p.y);
      } else if (p.shape === "spark")
        g.lineStyle(1.6, p.color, fade)
          .lineBetween(p.x - p.size, p.y, p.x, p.y - p.size * 0.6)
          .lineBetween(p.x, p.y - p.size * 0.6, p.x + p.size * 0.4, p.y + p.size * 0.5);
      else {
        // A tiny four-point star.
        const s = p.size;
        g.fillStyle(p.color, 0.9 * fade)
          .fillTriangle(p.x - s * 0.35, p.y, p.x + s * 0.35, p.y, p.x, p.y - s * 1.3)
          .fillTriangle(p.x - s * 0.35, p.y, p.x + s * 0.35, p.y, p.x, p.y + s * 1.3)
          .fillTriangle(p.x, p.y - s * 0.35, p.x, p.y + s * 0.35, p.x - s * 1.3, p.y)
          .fillTriangle(p.x, p.y - s * 0.35, p.x, p.y + s * 0.35, p.x + s * 1.3, p.y);
      }
    }
    // ---- Duskveil's wisps orbit; dizzy stars circle a fainted head.
    if (this.character === "duskveil" && state !== "defeat")
      for (let i = 0; i < 2; i++) {
        const a = now / 700 + i * Math.PI;
        const wx = x + Math.cos(a) * 30 * sc,
          wy = y - 12 * sc + Math.sin(a) * 10 * sc;
        g.fillStyle(glow ?? 0x7dffe1, 0.18).fillCircle(wx, wy, 5 * sc);
        g.fillStyle(glow ?? 0x7dffe1, 0.85).fillCircle(wx, wy, 1.8 * sc);
      }
    if (state === "defeat") {
      const top = at("head", 100, 46);
      for (let i = 0; i < 3; i++) {
        const a = now / 260 + (i * Math.PI * 2) / 3;
        const s = 3 * sc;
        const sx = top.x + Math.cos(a) * 14 * sc,
          sy = top.y + Math.sin(a) * 4 * sc;
        g.fillStyle(0xfff1a0, 0.9)
          .fillTriangle(sx - s * 0.4, sy, sx + s * 0.4, sy, sx, sy - s * 1.2)
          .fillTriangle(sx - s * 0.4, sy, sx + s * 0.4, sy, sx, sy + s * 1.2)
          .fillTriangle(sx, sy - s * 0.4, sx, sy + s * 0.4, sx - s * 1.2, sy)
          .fillTriangle(sx, sy - s * 0.4, sx, sy + s * 0.4, sx + s * 1.2, sy);
      }
    }
    // ---- Ultimate ready: a pulsing ring at the feet.
    if (pose.ultReady && state !== "defeat") {
      const pulse = (now / 900) % 1;
      g.lineStyle(2.5, color, 0.55 * (1 - pulse)).strokeEllipse(
        x,
        y + FEET * sc,
        (44 + pulse * 26) * sc,
        (16 + pulse * 9) * sc,
      );
      g.lineStyle(1.5, 0xffffff, 0.35).strokeEllipse(
        x,
        y + FEET * sc,
        44 * sc,
        16 * sc,
      );
    }
    // ---- Cast glyph (unchanged): the element sigil where the move leaves.
    if (attack || pose.charging) {
      const radius = skill === 3 ? 12 : skill === 1 ? 9 : 6;
      g.lineStyle(2, color, 0.65).strokeCircle(
        x + Math.cos(pose.angle) * 25,
        y + Math.sin(pose.angle) * 25 - 10,
        radius + Math.sin(now / 65) * 2,
      );
      drawElementGlyph(
        g,
        CHARACTERS[this.character].element,
        x + Math.cos(pose.angle) * 25,
        y + Math.sin(pose.angle) * 25 - 10,
        radius,
        color,
        0.7,
        now,
      );
      if (this.character === "cindrake" && state === "basic") {
        g.fillStyle(color, 0.3).fillTriangle(
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
        g.lineStyle(2, color, 0.3 / i).lineBetween(
          x - Math.cos(pose.angle) * i * 14,
          y - Math.sin(pose.angle) * i * 14,
          x - Math.cos(pose.angle) * (i * 14 + 16),
          y - Math.sin(pose.angle) * (i * 14 + 16),
        );
  }
}
