import { battleCurves } from "../battle-curves";
import {
  groundHeight,
  WORLD_ART,
} from "../../../../packages/shared/src/world-art";
import { cosmeticLayer, originalOf, type Skin } from "./cosmetics";
import {
  profilePartOrder,
  profileEmissionPoint,
  PROFILE_HEAD_WIDTH,
  PROFILE_FACE_PARTS,
  REAR_ARMS_MIRRORED,
} from "../creature-profile";
import { drawElementGlyph } from "../element-effects";
import type Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { moodFor, squashFor } from "./expression";
import {
  ENTRANCES,
  MAX_TURN,
  MIN_WIDTH,
  SETTLED,
  VICTORIES,
  keepHeadRigid,
  type MoveAccent,
  type MoveStage,
} from "./champion-moves";
import {
  AnimationController,
  facing,
  type AnimationPose,
  type AnimationState,
  type Facing,
} from "./controller";
import { loadRigTextures, textureResolution } from "./rig-textures";
import {
  moodKey,
  parts,
  partsFor,
  rigAnchorsFor,
  rigKey,
  rigAssets,
  rigPoint,
  skinSuffix,
  lumeLayers,
  artOrigins,
  type LumeKind,
  type Part,
  type RigAsset,
} from "./assets";
import { HOVERING, paletteFor, type SkinLook } from "../creature-design";
import { hexToNumber, wornArt } from "../skins/skin-art";
import { drawColorsFx } from "../skins/colors-fx";
import {
  drawAnyParticle,
  stepParticle,
  drawSkinFx,
  type FxShape,
} from "../skins/skin-fx";
import {
  drawCollectionEntrance,
  drawCollectionVictory,
  playCollectionEntrance,
} from "../skins/collection-fx";

/** Skinned texture sets already requested, per scene (loaded on first sight). */
const requested = new WeakMap<Phaser.Scene, Map<string, string[]>>();

/**
 * A rig image is its art's size (and so is its origin), whatever its raster,
 * and takes its texture's own pivot whenever the texture changes: a costume
 * crops some parts in a wider box (assets.ts COSTUME_BOUNDS), where the same
 * joint is another fraction of the texture. Keeping the default crop's
 * fractions drew Tide Admiral's bicorne 26 rig px above its head and its
 * coat as far below the body (owner's iPhone report, Shop preview).
 */
function sizeByResolution(image: Phaser.GameObjects.Image) {
  image.setSizeToFrame = function (frame?: Phaser.Textures.Frame | boolean) {
    const f = (
      frame && typeof frame === "object" ? frame : this.frame
    ) as Phaser.Textures.Frame;
    const r = textureResolution(f.texture.key, f.source.width);
    f.source.resolution = r;
    this.width = f.realWidth / r;
    this.height = f.realHeight / r;
    const origin = artOrigins.get(originalOf(f.texture.key));
    // After the size: the display origin is measured in it.
    if (origin) this.setOrigin(origin[0], origin[1]);
    return this;
  };
  // (Test doubles of Phaser have no frames to size.)
  return typeof image.setFrame === "function"
    ? image.setFrame(image.frame)
    : image;
}

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
const FEET = WORLD_ART.fighterFeet;
/** Rockslide Flex victory: how high the rock pile lifts the fighter (rig units). */
const ROCK_PILE = 24;
/**
 * Near-paw props that stand upright from the paw, above the shoulder:
 * Astrabun's mallet (and each skin's re-forged mallet or wand). The prop is
 * painted on the arm, so raising that arm overhead turns it upside down onto
 * the body. Greetings and victories hold that arm (armR, before the side
 * mirror) near the angle where the prop stands up (radians; front and back
 * views, and side views, where it rests over the shoulder), within `swing`;
 * the free paw does the big moves.
 */
export const UPRIGHT_PROP_ARM: Partial<
  Record<
    CharacterId,
    { front: number; side: number; swing: number; sideSwing?: number }
  >
> = {
  // (Measured by sweeping the arm, 28 Nov 2026. The owner: "the mallet arm
  // can't move, it looks paralysed". Seen from the front or back the mallet
  // clears the body from held high beside the head (-0.55) to swung out
  // level (1.15); side on it sits behind the back, clear from over the
  // shoulder (0.45) down to the ground behind (-1.25). So the arm swings
  // freely in that range; `front` and `side` are its middle.)
  astrabun: { front: 0.3, side: -0.4, swing: 0.85 },
  // Tidefin's blade is painted on the near paw too. Seen from the front it
  // clears the body only while that arm turns outward (about -0.4 to 1.6
  // rad): turned inward, the blade lies across the chest (owner, 28 Nov
  // 2026: "it looks like it stabs its own body"). Side on, the blade is
  // edge-on and the arm swings freely.
  tidefin: { front: 0.6, side: 0, swing: 1, sideSwing: 2.6 },
};
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
  behind?: boolean;
}

export class FighterRig {
  readonly controller = new AnimationController();
  readonly root: Phaser.GameObjects.Container;
  private images = new Map<Part, Phaser.GameObjects.Image>();
  private effects: Phaser.GameObjects.Graphics;
  private dir: Facing = "down";
  private previousRotations = new Map<Part, number>();
  private carriedRotation = 0;
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
  /** The champion's own move last frame, and how far into it (seconds). */
  private moveState: AnimationState = "idle";
  private moveT = 0;
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
  /** A twin of each part drawn in one flat colour over it (pose.wash). */
  private washes?: Map<Part, Phaser.GameObjects.Image>;
  /** The facing the twins were last ordered for. */
  private washDir = "";
  /** Light layers over glowing costume pieces, by texture key. */
  private glows?: Map<string, Phaser.GameObjects.Image>;
  /** Auralynx's ring keeps its phase when its speed or the scene clock changes. */
  private auraRingAngle = 0;
  /** Height/width of the ground plane skin rings lie on. The fitting room's
   * floor is flatter than the arena's, so its preview sets its own. */
  groundFlat: number = WORLD_ART.groundY;
  /** The given layers by key, and the suffix of their look. */
  private layers = new Map<string, RigAsset>();
  private layersSuffix = "";
  /**
   * `assets` may be a Shop skin's set (its keys end in the skin's suffix):
   * the rig then starts in it, and the battle needn't load the champion's
   * own look for a fighter who never shows it. A part's joint is the same
   * in every look; a costume's wider crop moves only its texture's origin,
   * which the images take from the texture (sizeByResolution).
   */
  constructor(
    private scene: Phaser.Scene,
    readonly character: CharacterId,
    assets: RigAsset[],
  ) {
    const body = rigKey(character, "down", "body");
    this.layersSuffix = this.suffix =
      assets
        .find((a) => a.key.startsWith(body) && !a.key.includes("~lume-"))
        ?.key.slice(body.length) ?? "";
    for (const a of assets) this.layers.set(a.key, a);
    this.root = scene.add.container(0, 0).setDepth(2);
    this.effects = battleCurves(scene.add.graphics()).setDepth(3);
    this.under = battleCurves(scene.add.graphics()).setDepth(1.9);
    for (const part of partsFor(character)) {
      const asset = this.layer("down", part)!;
      const image = sizeByResolution(
        scene.add.image(asset.x, asset.y, asset.key),
      )
        .setOrigin(asset.originX, asset.originY)
        .setScale(0.5);
      this.images.set(part, image);
      this.root.add(image);
    }
    this.blinkAt = scene.time.now + 3000 + Math.random() * 4000;
    this.tiltAt = scene.time.now + 4000 + Math.random() * 3000;
  }
  /** The layer of a part in a facing, from the set the rig was given. */
  private layer(dir: Facing, part: Part) {
    return this.layers.get(
      rigKey(this.character, dir, part, this.layersSuffix),
    );
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
  /**
   * The layer drawn over the fighter (world coordinates), cleared at the
   * start of each render: draw on it after render() to pass in front.
   */
  get front() {
    return this.effects;
  }
  /** The layer just under the fighter, cleared like `front`. */
  get behind() {
    return this.under;
  }
  /** Sort the fighter (with its effects and ground layer) among other objects. */
  setDepth(depth: number) {
    this.under.setDepth(depth - 0.1);
    this.root.setDepth(depth);
    this.effects.setDepth(depth + 0.1);
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
    if (
      !this.scene.textures.exists(probe) ||
      pending?.some((key) => !this.scene.textures.exists(key))
    ) {
      if (!asked) requested.set(this.scene, (asked = new Map()));
      if (!asked.has(suffix)) {
        const assets = rigAssets(this.character, look ?? null);
        asked.set(
          suffix,
          assets.map((a) => a.key),
        );
        loadRigTextures(this.scene, assets);
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
      this.previousRotations.set(
        part,
        image.rotation - (part === "body" ? 0 : this.carriedRotation),
      );
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
      const order = (
        dir === "down" ? parts : profilePartOrder(dir, this.character)
      ).filter((part) => this.images.has(part));
      order.forEach((part, index) =>
        this.root.moveTo(this.images.get(part)!, index),
      );
      for (const [part, image] of this.images) {
        const asset = this.layer(dir, part)!;
        const key = rigKey(this.character, dir, part, this.suffix);
        // The worn texture's own pivot: a costume's crop can be wider.
        const [ox, oy] = artOrigins.get(key) ?? [asset.originX, asset.originY];
        image.setTexture(key).setOrigin(ox, oy).setPosition(asset.x, asset.y);
      }
    }
    const rigAnchors = rigAnchorsFor(this.character, dir);
    const t = (now - this.controller.started) / 1000;
    const moving = state === "walk" || state === "run";
    const heavy =
      this.character === "terradon" || this.character === "wombolder";
    // Floating champions keep their feet tucked and glide instead of stepping.
    const floats = HOVERING.includes(this.character);
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
      state === "basic"
        ? kit.basic
        : skill >= 0
          ? kit.skills[skill]
          : undefined;
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
    for (const [part, image] of this.images) {
      const asset = this.layer(dir, part)!;
      image
        .setPosition(asset.x, asset.y)
        .setRotation(0)
        .setScale(0.5)
        .setTint(
          state === "hurt"
            ? (pose.hurtTint ?? 0xffb4b4)
            : (pose.tint ?? 0xffffff),
        );
    }
    let [sx, sy] = reduced ? [1, 1] : squashFor(state, progress, t, pose.angle);
    let offsetX = 0,
      offsetY = 0;
    body.setScale(0.5, 0.5 + (reduced ? 0 : idle * 0.009));
    head.y = rigAnchors.headY + (reduced ? 0 : idle * 0.55);
    head.rotation = reduced ? 0 : idle * 0.025;
    ears.rotation = reduced ? 0 : Math.sin(now / 250) * 0.04;
    tail.rotation = reduced ? 0 : Math.sin(now / 340) * 0.12;
    wings.setScale(0.5 + (reduced ? 0 : Math.sin(now / 360) * 0.025), 0.5);
    const rigidHeadwear =
      this.character === "voltkit" ||
      this.character === "tidefin" ||
      this.character === "auralynx";
    const livingFlame = !reduced && this.character === "cindrake";
    flame.setScale(
      0.5 + (livingFlame ? Math.sin(now / 90) * 0.04 : 0),
      0.5 + (livingFlame ? Math.cos(now / 75) * 0.06 : 0),
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
    const profile = dir !== "down";
    if (this.character === "auralynx" && !profile) {
      armL.rotation = -0.35;
      armR.rotation = 0.35;
    }
    if (this.character === "tidefin" && !profile) {
      body.setScale(0.53, 0.47);
      legL.rotation = -0.18;
      legR.rotation = 0.18;
    }
    if (floats && !reduced && state !== "defeat")
      offsetY -=
        this.character === "lumoth"
          ? 6 + Math.sin(now / 310) * 1.8
          : 6 + Math.sin(now / (this.character === "duskveil" ? 260 : 520)) * 3;
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
      if (!floats) {
        legL.y += step * 2;
        legR.y -= step * 2;
      }
      if (this.character === "auralynx") {
        // Relaxed meditation arms and tucked feet, with no alternating walking cycle.
        armL.rotation = -0.12;
        armR.rotation = 0.12;
        legL.rotation = -0.08;
        legR.rotation = 0.08;
      }
      if (this.character === "lumoth") {
        armL.rotation = -0.1 + Math.sin(now / 310) * 0.025;
        armR.rotation = 0.1 - Math.sin(now / 310) * 0.025;
        legL.rotation = -0.05;
        legR.rotation = 0.05;
      }
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
      body.rotation = (dir === "left" ? -1 : 1) * punch * 0.08;
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
    if (this.character === "auralynx") {
      if (!reduced) {
        const celebrating =
          state === "victory" &&
          t < 2.2 &&
          pose.look?.victory !== "rockslide-flex";
        const speed = celebrating
          ? 6
          : pose.charging || attack
            ? 1 / 0.42
            : 1 / 1.4;
        this.auraRingAngle = (this.auraRingAngle + dt * speed) % (Math.PI * 2);
      }
      wings.rotation = this.auraRingAngle;
    }
    if (!reduced) {
      if (this.character === "auralynx") {
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
      if (this.character === "glacelle") {
        // Wing-flaps paddle the water; snow crystals drift round.
        armL.rotation += Math.sin(now / 220) * 0.16;
        armR.rotation -= Math.sin(now / 220) * 0.16;
        wings.rotation = Math.sin(now / 900) * 0.08;
      }
      if (this.character === "shadopus" && !moving) {
        // Tentacles never quite keep still.
        armL.rotation = Math.sin(now / 260) * 0.12;
        armR.rotation = -Math.sin(now / 290) * 0.12;
        legL.rotation = Math.sin(now / 330) * 0.06;
        legR.rotation = -Math.sin(now / 310) * 0.06;
      }
      if (this.character === "sunbara")
        // The yuzu rocks as if floating in a hot spring.
        flame.rotation = Math.sin(now / 520) * 0.06;
      if (this.character === "halcyra" || this.character === "astrabun")
        // A crest that ruffles; long ears that twitch.
        ears.rotation +=
          Math.sin(now / (this.character === "astrabun" ? 160 : 210)) * 0.03;
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
            this.tiltSide *
            0.26 *
            Math.sin(((this.tiltUntil - now) / 900) * Math.PI);
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
    // ---- Entrances (the round's greeting) and victories, one for each
    // champion (champion-moves.ts). An equipped Victory reward that brings
    // its own action (Rockslide Flex) replaces the champion's victory move.
    const ownMove =
      state === "wave"
        ? ENTRANCES[this.character]
        : state === "victory" && pose.look?.victory !== "rockslide-flex"
          ? VICTORIES[this.character]
          : undefined;
    const accents: [MoveAccent, number][] = [];
    if (ownMove) {
      const at = reduced ? SETTLED : t;
      const before =
        this.moveState === state && this.moveT <= at ? this.moveT : -1;
      const stage: MoveStage = {
        t: at,
        calm: reduced,
        facing: dir,
        side: dir === "left" ? -1 : 1,
        p: {
          head,
          body,
          armL,
          armR,
          legL,
          legR,
          tail,
          wings,
          flame,
          ears,
          scarf,
        },
        move: (dx, dy) => {
          offsetX += dx;
          offsetY += dy;
        },
        squash: (x, y) => {
          sx *= x;
          sy *= y;
        },
        spin: (angle) => {
          this.root.rotation += angle;
        },
        mood: (wanted) => {
          if (dir === "up") return;
          const key = moodKey(this.character, dir, wanted, this.suffix);
          if (eyes.texture.key !== key && this.scene.textures.exists(key))
            eyes.setTexture(key);
        },
        shut: (amount) => {
          eyes.scaleY = Math.max(0.055, 0.5 * (1 - amount));
        },
        fade: (k) => {
          this.root.setAlpha(this.root.alpha * Math.max(0, Math.min(1, k)));
        },
        sway: (speed, phase = 0) =>
          reduced ? 0 : Math.sin(at * speed + phase),
        passed: (moment) => !reduced && before < moment && at >= moment,
        accent: (kind, count) => {
          accents.push([kind, count]);
        },
      };
      const neck = head.y;
      ownMove(stage);
      // Nothing leaves the body: the head stays on its neck (it may sink,
      // never lift) and barely tilts; a headpiece drawn across the head
      // (gills, ears) never widens off it.
      head.y = Math.max(neck, head.y);
      head.rotation = Math.max(-0.16, Math.min(0.16, head.rotation));
      ears.scaleX = Math.min(0.54, ears.scaleX);
      // No spins: the art is flat, so a turn past a lean, or a squash that
      // narrows it to fake turning edge-on, reads as paper flipping over.
      this.root.rotation = Math.max(
        -MAX_TURN,
        Math.min(MAX_TURN, this.root.rotation),
      );
      sx = Math.max(MIN_WIDTH, sx);
      this.moveT = at;
    }
    this.moveState = ownMove ? state : "idle";
    for (const [kind, count] of accents) this.moveAccent(kind, count, x, y);
    // Rockslide Flex (a Victory reward): a pile of rocks rises under the
    // fighter, who stands on top flexing while pebbles bounce away.
    const flexing =
      state === "victory" &&
      !reduced &&
      pose.look?.victory === "rockslide-flex";
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
        // An upright prop is pumped beside the head instead (UPRIGHT_PROP_ARM).
        const held = this.propHold();
        armR.rotation =
          held === undefined ? -2.45 - pump * 0.18 : held - pump * 0.25;
        body.rotation = 0;
        head.rotation = -0.06;
        sy *= 1 + Math.max(0, pump) * 0.03;
      }
      // Pebbles burst when the pile lands, and with each flex.
      const pumps = (v: number) =>
        Math.floor((Math.max(0, v - 0.4) * 7) / Math.PI);
      if (lastPileT < 0.35 && t >= 0.35) this.pebbles(x, y, 16);
      else if (t < 2.6 && pumps(t) > pumps(lastPileT)) this.pebbles(x, y, 3);
    }
    // An upright prop stays upright: its arm never swings overhead.
    const prop = this.propHold();
    if (prop !== undefined && (state === "wave" || state === "victory")) {
      const held = UPRIGHT_PROP_ARM[this.character]!;
      const swing =
        (this.dir === "left" || this.dir === "right"
          ? held.sideSwing
          : undefined) ?? held.swing;
      armR.rotation = Math.max(
        prop - swing,
        Math.min(prop + swing, armR.rotation),
      );
    }
    // The same prop in an attack, seen from the front or back: a swing that
    // would carry it inward (the blade across the chest, the mallet upside
    // down on the belly) goes outward by as much instead (owner, 28 Nov
    // 2026: props never cut into the body). Side on, the swing is free.
    if (prop !== undefined && attack && (dir === "down" || dir === "up")) {
      const inner = prop - UPRIGHT_PROP_ARM[this.character]!.swing;
      if (armR.rotation < inner)
        armR.rotation = Math.min(
          prop + UPRIGHT_PROP_ARM[this.character]!.swing,
          2 * inner - armR.rotation,
        );
    }
    // Side drawings are mirrored; their local limb poses must mirror too.
    // World-space lean, lunge and wind already use the aiming direction.
    if (dir === "left") {
      for (const part of [
        "head",
        "ears",
        "flame",
        "armL",
        "armR",
        "legL",
        "legR",
        "tail",
        "wings",
      ] as Part[]) {
        if (part === "wings" && (this.character === "auralynx" || heavy))
          continue;
        this.images.get(part)!.rotation *= -1;
      }
      for (const part of ["armL", "armR"] as Part[]) {
        const asset = this.layer(dir, part)!;
        const image = this.images.get(part)!;
        image.x = 2 * asset.x - image.x;
      }
    }
    // Smooth hand-offs between poses (springy parts integrate on their own).
    for (const [part, image] of this.images) {
      // This is a rotating ring, not a wing. Its phase is already continuous;
      // a spring would snap backwards when Phaser wraps +PI to -PI.
      if (part === "wings" && (this.character === "auralynx" || heavy))
        continue;
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
        if (part === "flame" && rigidHeadwear) continue;
        if (part === "wings" && (this.character === "auralynx" || heavy))
          continue;
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
    // A shell is rigid: it follows the torso, without feather flutter or wing springs.
    if (heavy) wings.setScale(0.5, 0.5).setRotation(0);
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
    const earFar = this.images.get("earFar")!;
    earFar
      .setPosition(ears.x, ears.y)
      .setRotation(ears.rotation)
      .setScale(ears.scaleX, ears.scaleY);
    flame.setPosition(ears.x, ears.y);
    flame.rotation = rigidHeadwear
      ? head.rotation
      : flame.rotation + head.rotation;
    // A skin's headwear over an animated crest rides the head rigidly: no
    // flicker, sway, spring or attack swell (creature-design ANIMATED_CRESTS).
    this.images
      .get("hat")
      ?.setPosition(ears.x, ears.y)
      .setRotation(head.rotation)
      .setScale(0.5);
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
    // Seen from behind, a champion whose near paw holds something has its
    // arms mirrored (REAR_ARMS_MIRRORED): mirror their poses too, so a swing
    // or a held prop moves the same way it does from the front.
    if (dir === "up" && REAR_ARMS_MIRRORED.has(this.character))
      for (const part of ["armL", "armR"] as const) {
        const image = this.images.get(part);
        const asset = this.layer(dir, part);
        if (!image || !asset) continue;
        image.x = 2 * asset.x - image.x;
        image.rotation = -image.rotation;
      }
    // Carry complete side/rear parts with the torso. Their own shoulder/hip
    // pivots remain independent, including the hidden overlap at each joint.
    if (dir !== "down") {
      const cos = Math.cos(body.rotation),
        sin = Math.sin(body.rotation);
      for (const [part, image] of this.images) {
        if (part === "body") continue;
        const dx = ((image.x - body.x) * body.scaleX) / 0.5;
        const dy = ((image.y - body.y) * body.scaleY) / 0.5;
        image.setPosition(
          body.x + dx * cos - dy * sin,
          body.y + dx * sin + dy * cos,
        );
        image.rotation += body.rotation;
      }
    }
    this.carriedRotation = dir === "down" ? 0 : body.rotation;
    // A champion's own move never flattens the face: the squash or stretch
    // is the body's, and the head with all it carries keeps its size and
    // shape, riding on top (owner, 28 Nov 2026).
    if (ownMove && (sx !== 1 || sy !== 1))
      keepHeadRigid(
        PROFILE_FACE_PARTS.flatMap((part) => this.images.get(part) ?? []),
        { x: head.x, y: head.y },
        sx,
        sy,
      );
    for (const image of this.images.values()) image.setVisible(true);
    // Shell Up: head, limbs and sprout tuck away; only the mossy shell shows.
    if (pose.shell)
      for (const [part, image] of this.images)
        if (part !== "wings") image.setVisible(false);
    // Underground (Tunnel): only its mound of dirt shows.
    if (pose.mound)
      for (const image of this.images.values()) image.setVisible(false);
    this.syncWash(pose.wash);
    this.syncGlow(now, pose.ambient !== false, reduced);
    this.effects.clear();
    this.under.clear();
    if (pose.mound) this.drawMound(pose.mound, x, y, alpha, reduced);
    if (!this.suffix && pose.look?.skin === "starlit-skin") {
      for (let i = 0; i < 5; i++) {
        const sx = x + ((i % 3) - 1) * 14 * this.baseX,
          sy = y - (12 + Math.floor(i / 3) * 23) * this.baseY;
        const alpha = reduced
          ? 0.6
          : 0.35 + Math.sin(now / 900 + i * 1.8) ** 2 * 0.55;
        this.effects
          .lineStyle(1.2 * this.baseX, 0xf6e8ff, alpha)
          .lineBetween(sx - 3 * this.baseX, sy, sx + 3 * this.baseX, sy)
          .lineBetween(sx, sy - 3 * this.baseY, sx, sy + 3 * this.baseY);
      }
    }
    if (this.pile > 0) this.drawPile(x, y);
    if (reduced) {
      this.particles.length = 0;
      return;
    }
    this.drawEffects(
      pose,
      state,
      x,
      y,
      now,
      dt,
      t,
      progress,
      skill,
      attack,
      moving,
      dir,
    );
    this.lastProgress = progress;
  }

  /**
   * The wash: each part's twin, just above it, in the wash colour (its
   * texture, frame, place and pose copied once the part is posed). Made the
   * first time a pose asks for it; hidden when a pose doesn't.
   */
  private syncWash(wash: AnimationPose["wash"]) {
    if (!wash) {
      if (this.washes)
        for (const w of this.washes.values()) w.setVisible(false);
      return;
    }
    if (!this.washes) {
      this.washes = new Map();
      for (const [part, image] of this.images) {
        const twin = sizeByResolution(
          this.scene.add.image(0, 0, image.texture.key),
        );
        this.washes.set(part, twin);
        this.root.add(twin);
      }
      this.washDir = "";
    }
    if (this.washDir !== this.dir) {
      this.washDir = this.dir;
      for (const [part, twin] of this.washes)
        this.root.moveAbove(twin, this.images.get(part)!);
    }
    for (const [part, twin] of this.washes) {
      const image = this.images.get(part)!;
      if (twin.texture.key !== image.texture.key)
        twin.setTexture(image.texture.key);
      twin
        .setOrigin(image.originX, image.originY)
        .setPosition(image.x, image.y)
        .setScale(image.scaleX, image.scaleY)
        .setRotation(image.rotation)
        .setFlip(image.flipX, image.flipY)
        .setVisible(image.visible)
        .setAlpha(image.alpha * wash.alpha)
        .setTintFill(wash.color);
    }
  }

  /**
   * Light on glowing costume pieces: each light layer of a part (see
   * `lumeLayers`) rides just above it with additive blending, its strength
   * following the way it glows. Only fighters with the ambient budget get
   * them (none on Low): the costume's texture already shows the lit colours,
   * so without them the pieces simply hold still. Blinks stay at one flash a
   * second per light, far under the three-flashes-a-second safety line.
   */
  private syncGlow(now: number, ambient: boolean, reduced: boolean) {
    if (!this.glows && (!this.suffix || !ambient)) return;
    const shown = new Set<string>();
    if (ambient && this.suffix)
      for (const image of this.images.values()) {
        const layers = lumeLayers.get(image.texture.key);
        if (!layers) continue;
        for (const l of layers) {
          if (!this.scene.textures.exists(l.key)) continue;
          this.glows ??= new Map();
          let twin = this.glows.get(l.key);
          if (!twin) {
            twin = sizeByResolution(
              this.scene.add.image(0, 0, l.key),
            ).setBlendMode("ADD");
            this.glows.set(l.key, twin);
            this.root.add(twin);
          }
          this.root.moveAbove(twin, image);
          shown.add(l.key);
          twin
            .setOrigin(image.originX, image.originY)
            .setPosition(image.x, image.y)
            .setScale(image.scaleX, image.scaleY)
            .setRotation(image.rotation)
            .setFlip(image.flipX, image.flipY)
            .setVisible(image.visible)
            .setAlpha(
              image.alpha *
                (reduced ? 0.5 : lumeStrength(l.kind, l.phase, now / 1000)),
            );
        }
      }
    if (this.glows)
      for (const [key, twin] of this.glows)
        if (!shown.has(key)) twin.setVisible(false);
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
      g.fillStyle(color, 1).fillRoundedRect(
        cx - rw / 2,
        cy - rh / 2,
        rw,
        rh,
        Math.min(rw, rh) * 0.35,
      );
      g.lineStyle(1.5 * sc, 0x3d342b, 0.9).strokeRoundedRect(
        cx - rw / 2,
        cy - rh / 2,
        rw,
        rh,
        Math.min(rw, rh) * 0.35,
      );
      g.fillStyle(0xffffff, 0.12).fillRect(
        cx - rw * 0.3,
        cy - rh * 0.4,
        rw * 0.35,
        Math.max(1, rh * 0.15),
      );
    }
    // A thin amber glint, like Cragstone's cracks.
    g.lineStyle(1.4 * sc, 0xffc46b, 0.8).lineBetween(
      x - 6 * sc,
      base - h * 0.55,
      x + 2 * sc,
      base - h * 0.35,
    );
  }

  /** The arm angle that keeps an upright prop standing (UPRIGHT_PROP_ARM). */
  private propHold() {
    const prop = UPRIGHT_PROP_ARM[this.character];
    if (!prop) return undefined;
    return this.dir === "left" || this.dir === "right" ? prop.side : prop.front;
  }

  /** A few particles that belong to a champion's move (champion-moves.ts). */
  private moveAccent(kind: MoveAccent, count: number, x: number, y: number) {
    const sc = this.baseX,
      feet = y + FEET * this.baseY;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const out = (i / Math.max(1, count - 1) - 0.5) * 2 || 0;
      if (kind === "ember")
        this.emit({
          x: x + out * 12 * sc,
          y: y - 44 * this.baseY,
          vx: out * 40,
          vy: -50 - Math.random() * 40,
          life: 0.6,
          size: (1.6 + Math.random() * 1.4) * sc,
          color: i % 2 ? 0xffd34d : 0xff7a4f,
          shape: "dot",
        });
      else
        this.emit({
          x: x + (out * 14 + (Math.random() - 0.5) * 6) * sc,
          y: feet - (2 + Math.random() * 5) * sc,
          vx: out * (kind === "dust" ? 46 : 70) * (0.6 + Math.random() * 0.8),
          vy:
            kind === "dust"
              ? -18 - Math.random() * 14
              : -60 - Math.random() * 50,
          life: kind === "dust" ? 0.45 : 0.4,
          size: (kind === "dust" ? 2.6 : kind === "spark" ? 4.5 : 2.4) * sc,
          color:
            kind === "spark" ? 0x7ff3ff : kind === "drop" ? 0xbff6ff : 0xcbb89a,
          shape:
            kind === "spark" ? "spark" : kind === "drop" ? "bubble" : "dot",
        });
    }
  }

  /**
   * Pangrove underground (Tunnel): a mound of churned soil on the ground,
   * leaf-plate tips poking out of its crest, with clods turning over as it
   * moves toward `heading`. Everyone sees it: it is how the opponent knows
   * where Pangrove is.
   */
  private drawMound(
    mound: { churn: number; heading: number },
    x: number,
    y: number,
    alpha: number,
    reduced: boolean,
  ) {
    const g = this.effects,
      R = 30 * (this.baseX / 0.7),
      cx = x,
      cy = y + FEET * this.baseY - R * 0.35,
      churn = reduced ? 0 : mound.churn;
    // A soft shadow, then the mound itself (lit from above).
    g.fillStyle(0x000000, 0.22 * alpha).fillEllipse(
      cx,
      cy + R * 0.3,
      R * 2.5,
      R * 0.9,
    );
    g.fillStyle(0x3d2814, alpha).fillEllipse(cx, cy, R * 2.3, R * 1.15);
    g.fillStyle(0x7a5532, alpha).fillEllipse(cx, cy - R * 0.12, R * 2, R * 0.9);
    g.fillStyle(0xa57a4a, alpha).fillEllipse(
      cx - R * 0.2,
      cy - R * 0.3,
      R * 1.1,
      R * 0.4,
    );
    // Clods turning over as it digs along.
    for (let i = 0; i < 6; i++) {
      const t = churn + (i * Math.PI * 2) / 6,
        px = cx + Math.cos(t) * R * 0.75,
        py = cy - R * 0.1 + Math.sin(t) * R * 0.28;
      if (Math.sin(t) < -0.2) continue;
      g.fillStyle(i % 2 ? 0x5a3b1e : 0x8c6338, alpha).fillCircle(
        px,
        py,
        R * 0.13,
      );
    }
    // Leaf-plate tips along the crest: the only part of Pangrove that shows.
    const hx = Math.cos(mound.heading);
    for (const k of [-0.45, 0, 0.45]) {
      const px = cx + k * R * 0.9,
        py = cy - R * 0.45 - (k === 0 ? 4 : 0),
        lean = hx * 0.3,
        w = R * 0.2,
        h = R * 0.42;
      g.fillStyle(k === 0 ? 0xc7e88a : 0x7fcf6a, alpha).fillTriangle(
        px - w,
        py + h * 0.4,
        px + w,
        py + h * 0.4,
        px + lean * h,
        py - h * 0.6,
      );
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
    const screenPoint = (part: Part, p: { x: number; y: number }) => {
      const asset = this.layer(dir, part)!;
      const image = this.images.get(part)!;
      const dx = ((p.x - asset.x) * image.scaleX) / 0.5,
        dy = ((p.y - asset.y) * image.scaleY) / 0.5;
      const cos = Math.cos(image.rotation),
        sin = Math.sin(image.rotation);
      return {
        x: this.root.x + (image.x + dx * cos - dy * sin) * this.root.scaleX,
        y: this.root.y + (image.y + dx * sin + dy * cos) * this.root.scaleY,
      };
    };
    const at = (part: Part, ax: number, ay: number) => {
      if (dir !== "down")
        [ax, ay] = profileEmissionPoint(this.character, dir, part, ax, ay);
      return screenPoint(part, rigPoint(part, ax, ay));
    };
    const mount = (part: Part, ax: number, ay: number) => {
      if (
        (dir === "left" || dir === "right") &&
        PROFILE_FACE_PARTS.includes(part)
      )
        ax = 100 + (ax - 100) * PROFILE_HEAD_WIDTH;
      return screenPoint(part, { x: (ax - 100) * 0.5, y: (ay - 130) * 0.5 });
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
        color:
          Math.random() < 0.5
            ? (glow ?? 0xffd34d)
            : art
              ? hexToNumber(paletteFor(this.character, pose.skin).mid)
              : 0xff7a4f,
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
        // Victory sparkles stay behind the fighter, off its face.
        behind: true,
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
          mount,
          facing: dir,
          flat: this.groundFlat,
        },
        art,
        stage,
      );
    }
    // ---- Colors (all-fighter palettes): their motif and tier extras. A
    // champion skin wins over Colors, so it draws only without one.
    if (!this.suffix && !art && pose.look?.skin)
      drawColorsFx(
        {
          g,
          under: this.under,
          emit: (p) => this.emit(p),
          chance: (rate, d) => this.chance(rate, d),
          x,
          y,
          sc,
          now,
          dt,
          moving,
        },
        pose.look.skin,
      );
    // ---- Shop collection pieces: entrance burst and victory finale.
    if (state === "wave" && this.fxState !== "wave" && pose.look?.entrance)
      playCollectionEntrance(
        (p) => this.emit(p),
        pose.look.entrance,
        x,
        y,
        sc,
        // The rig bursts Mountainborn's pebbles itself; add only its flourish.
        pose.look.entrance === "mountainborn",
      );
    // An entrance that draws as well (Rainbow's arch), behind the fighter.
    if (state === "wave" && pose.look?.entrance)
      drawCollectionEntrance(this.under, pose.look.entrance, x, y, sc, t);
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
    for (const p of this.particles) stepParticle(p, dt);
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const p of this.particles)
      drawAnyParticle(p.behind ? this.under : g, p, 1 - p.age / p.life);
    // ---- Duskveil's wisps orbit; dizzy stars circle a fainted head.
    if (this.character === "duskveil" && state !== "defeat")
      for (let i = 0; i < 2; i++) {
        const a = now / 700 + i * Math.PI;
        const wx = x + Math.cos(a) * 30 * sc,
          wy = y - 12 * sc + Math.sin(a) * 10 * sc;
        // The near half of the circle passes in front, the far half behind.
        const near = Math.sin(a),
          layer = near > 0 ? g : this.under,
          d = 1 + 0.18 * near;
        layer.fillStyle(glow ?? 0x7dffe1, 0.18).fillCircle(wx, wy, 5 * sc * d);
        layer
          .fillStyle(glow ?? 0x7dffe1, 0.85 * (0.8 + 0.2 * near))
          .fillCircle(wx, wy, 1.8 * sc * d);
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
        groundHeight((44 + pulse * 26) * sc),
      );
      g.lineStyle(1.5, 0xffffff, 0.35).strokeEllipse(
        x,
        y + FEET * sc,
        44 * sc,
        groundHeight(44 * sc),
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

/** How strongly a light layer shines at time `t` (seconds), 0..1. */
export function lumeStrength(kind: LumeKind, phase: number, t: number) {
  const TAU = Math.PI * 2;
  switch (kind) {
    case "pulse":
      return 0.1 + 0.9 * (0.5 - 0.5 * Math.cos((TAU * t) / 2.2));
    case "blink":
      // One flash a second, the odd lights half a second after the even.
      return (t + phase * 0.5) % 1 < 0.3 ? 1 : 0.1;
    case "chase":
      // Even and odd lights take turns, like marquee bulbs.
      return (
        0.15 + 0.85 * (0.5 + 0.5 * Math.cos(TAU * (t / 1.2 - phase * 0.5)))
      );
    case "twinkle":
      return Math.max(0, Math.cos(TAU * (t / 2.6 - phase * 0.5))) ** 8;
  }
}
