import { drawPondWater, pondDuckPose } from "./town-pond-water";
import { isIOSWebApp } from "./render-budget";
import { paintedNature, paintedProp, paintedAnimal, paintedPlinth } from "./town-environment-art";
import { animalMotionSprite, createHenMotion, gullMotion, stepHen, type HenMotion } from "./town-animal-motion";
import { WORLD_ART } from "../../../packages/shared/src/world-art";
import { materialContext, townMaterialFamily } from "./world-materials";
import Phaser from "phaser";
import {
  TOWN,
  TOWN_PLAZA_ROAD,
  TOWN_BUILDINGS,
  TOWN_SHRUBS,
  TOWN_SIGNPOSTS,
  TOWN_DISTRICTS,
  TOWN_DUMMIES,
  TOWN_OBSTACLES,
  TOWN_SPOTS,
  TOWN_STALLS,
  TOWN_NEXT_STATUE,
  TOWN_STATUES,
  TOWN_TREES,
} from "../../../packages/shared/src/town";
import { RAID_BOSSES } from "../../../packages/shared/src/raid-roster";
import { raidCrest } from "./raid-crests";
import {
  ART_RES,
  TEXT_RES,
  WINDMILL_HUB,
  SUN,
  TEMPLE,
  TOWER,
  COLISEUM,
  buildingSprite,
  chimneyOf,
  fountainBase,
  fountainTop,
  paintedFountain,
  paintGround,
  rnd,
  carveStatue,
  statuePlinth,
  veiledStatue,
  STATUE_TOP,
  shrubSprite,
  signpostSprite,
  softBlob,
  treeCanopy,
  treeTrunk,
  windmillSails,
  type Sprite,
} from "./town-art";
import { propSprite, stallSprite } from "./town-props";
import { drawFountainWater } from "./town-fountain-water";
import { architectureFrame, paintedBuilding, paintedStall } from "./town-architecture";
import { drawFountainCrystal } from "./town-fountain-crystal";
import { butterflySprite, duckSprite, GULL_FRAMES, gullSprite, HEN_FRAMES, henSprite, type HenPose } from "./town-animals";

/**
 * Everything in the town that isn't a player: the painted ground, buildings,
 * trees and props (sorted by their foot so fighters pass behind them), and
 * the life on top: water, flags, smoke, birds, butterflies, ducks, chickens,
 * drifting cloud shadows and swaying trees.
 */
const num = (css: string) => parseInt(css.slice(1), 16);
const TAU = Math.PI * 2;
/** The town's one shadow colour (see SUN in town-art). */
export const SHADE = 0x141c0c;
/** What the coliseum's screen cycles through. */
const SCREEN_LINES = ["Walk to the gate to play", "Duels · 2v2 Teams · Free-for-all", "Party rules · Four arenas", "Bring a friend. Find a rival."];

/**
 * Painted pictures are kept for the whole visit: the town's Phaser game is
 * rebuilt each time you come back from a match, but the painting isn't.
 */
const painted = new Map<string, HTMLCanvasElement>();
function paint(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  let canvas = painted.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!);
    painted.set(key, canvas);
  }
  return canvas;
}
function bake(scene: Phaser.Scene, key: string, sprite: Sprite, res = ART_RES) {
  const pad = WORLD_ART.spritePadding;
  const width = sprite.w + pad * 2, height = sprite.h + pad * 2;
  if (!scene.textures.exists(key)) {
    const canvas = paint(key, Math.ceil(width * res), Math.ceil(height * res), (ctx) => {
      ctx.scale(res, res);
      ctx.translate(pad, pad);
      const family = townMaterialFamily(key);
      sprite.draw(family ? materialContext(ctx, family) : ctx);
    });
    scene.textures.addCanvas(key, canvas);
  }
  return { key, ox: (sprite.ax + pad) / width, oy: (sprite.ay + pad) / height, scale: 1 / res };
}

function place(scene: Phaser.Scene, key: string, sprite: Sprite, x: number, y: number, depth = y, res = ART_RES) {
  const t = bake(scene, key, sprite, res);
  return scene.add.image(x, y, t.key).setOrigin(t.ox, t.oy).setScale(t.scale).setDepth(depth);
}

interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export class TownScenery {
  private disposed = false;
  private canopies: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private sails?: Phaser.GameObjects.Image;
  private flags: { x: number; y: number; color: number; depth: number; w: number; g?: Phaser.GameObjects.Graphics }[] = [];
  private waterG: Phaser.GameObjects.Graphics;
  private waterBackG: Phaser.GameObjects.Graphics;
  private crystalG: Phaser.GameObjects.Graphics;
  private skyG: Phaser.GameObjects.Graphics;
  private birdShadowG: Phaser.GameObjects.Graphics;
  private bugG: Phaser.GameObjects.Graphics;
  private critterG: Phaser.GameObjects.Graphics;
  private markerG: Phaser.GameObjects.Graphics;
  private padG: Phaser.GameObjects.Graphics;
  /** The station you're standing on (its pad lights up). */
  active?: (typeof TOWN_SPOTS)[number];
  private screenText?: Phaser.GameObjects.Text;
  /** District signs (to keep markers off them and fade them over your fighter). */
  private signs: { box: Phaser.GameObjects.Container; left: number; right: number; top: number; bottom: number }[] = [];
  private markers: { x: number; y: number; color: number; phase: number }[] = [];
  private lampGlows: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private statueGlows: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private birds: Mover[] = [];
  private butterflies: (Mover & { color: number; home: { x: number; y: number } })[] = [];
  private chickens: HenMotion[] = [];
  private sideProfileBirds = false;
  private ducks: { a: number; speed: number; r: number; female: boolean; img?: Phaser.GameObjects.Image }[] = [];
  /** Animal pictures, painted once per frame of animation and swapped as they move. */
  private henImgs: Phaser.GameObjects.Image[] = [];
  private gullImgs: Phaser.GameObjects.Image[] = [];
  private flyImgs: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private reduced: boolean,
  ) {
    const dispose = () => {
      this.disposed = true;
      // Current scene textures retain their own canvases until destruction;
      // do not retain another whole town while an iOS battle is running.
      if (isIOSWebApp()) painted.clear();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
    scene.events.once(Phaser.Scenes.Events.DESTROY, dispose);
    this.ground();
    this.buildings();
    this.trees();
    this.props();
    this.labels();
    for (const f of this.flags) f.g = scene.add.graphics().setDepth(f.depth);
    const fountainY = TOWN_OBSTACLES.find((o) => o.kind === "fountain")!.y;
    this.waterBackG = scene.add.graphics().setDepth(fountainY - 0.2);
    this.waterG = scene.add.graphics().setDepth(fountainY + 0.1);
    this.crystalG = scene.add.graphics().setDepth(fountainY + 2);
    this.skyG = scene.add.graphics().setDepth(9000);
    this.birdShadowG = scene.add.graphics().setDepth(-400);
    this.bugG = scene.add.graphics().setDepth(8500);
    this.critterG = scene.add.graphics().setDepth(-450);
    this.padG = scene.add.graphics().setDepth(-350);
    this.markerG = scene.add.graphics().setDepth(4400);
    this.sideProfileBirds = !!this.environment("town-animals") || !!this.environment("town-animal-motion");
    this.life();
    // These source atlases are only used to bake the smaller placed sprites.
    // Release their GPU copies, particularly in iOS Home Screen web apps.
    for (const key of ["town-nature","town-scenery-props","town-animals","town-animal-motion","town-architecture-coliseum","town-architecture-raidHall","town-architecture-buildings","town-fountain-painted"]) {
      if(scene.textures.exists(key)) scene.textures.remove(key);
    }
  }

  // ───────── Static world ─────────

  private ground() {
    const key = "town-ground";
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, paint(key, TOWN.width, TOWN.height, paintGround));
    this.scene.add.image(0, 0, key).setOrigin(0).setDepth(-1000);
  }

  private environment(key: string) {
    return this.scene.textures.exists(key) ? this.scene.textures.get(key).getSourceImage() as HTMLImageElement : undefined;
  }
  private nature(kind: "crown"|"trunk"|"bush"|"rock", variant: number, frame: Sprite) {
    const source=this.environment("town-nature");
    return source?paintedNature(source,kind,variant,frame):frame;
  }
  private animal(kind: "duck"|"hen"|"gull", pose: string, index: number, female: boolean, frame: Sprite) {
    const motion=this.environment("town-animal-motion");
    if(motion && kind!=="duck")return animalMotionSprite(motion,kind,pose,index,female,frame);
    const source=this.environment("town-animals");
    return source?paintedAnimal(source,kind,pose,index,female,frame):frame;
  }

  private buildings() {
    for (const b of TOWN_BUILDINGS) {
      const frame = architectureFrame(b);
      const imageKey = `town-architecture-${frame.asset}`;
      if (this.scene.textures.exists(imageKey)) {
        const source = this.scene.textures.get(imageKey).getSourceImage() as HTMLImageElement;
        const art = paintedBuilding(source, b);
        place(this.scene, `town-painted-${b.id}`, art.sprite, b.x, b.y, b.y, 2);
        for (const p of art.flags) this.flags.push({x:b.x+p.x,y:b.y+p.y,color:b.kind === "temple"?0xb59bff:0xffd65b,depth:b.y+.3,w:26});
        if (!this.reduced) {
          for (const p of art.flames) this.flame(b.x+p.x,b.y+p.y,b.y+.5,b.kind === "tower"?.6:.45);
          if (art.chimney) this.smoke(b.x+art.chimney.x,b.y+art.chimney.y,b.y+2);
        }
        if (art.hub) {
          this.sails=place(this.scene,"town-sails",windmillSails(),b.x+art.hub.x,b.y+art.hub.y,b.y+1);
          this.sails.setScale(this.sails.scaleX*art.rotorScale);
        }
        continue;
      }
      const key = b.kind === "house" ? `town-house-${b.variant}-${b.w}` : `town-${b.id}`;
      place(this.scene, key, buildingSprite(b), b.x, b.y);
      if (b.kind === "windmill")
        this.sails = place(this.scene, "town-sails", windmillSails(), b.x + WINDMILL_HUB.dx, b.y + WINDMILL_HUB.dy, b.y + 1);
      if (b.kind === "house" && !this.reduced) {
        const c = chimneyOf(b);
        this.smoke(b.x + c.dx, b.y + c.dy, b.y + 2);
      }
      if (b.kind === "coliseum") {
        // Flags on masts round the rim, torches by the gate, the screen above it.
        const { rx, ry, topY, masts, torches } = COLISEUM;
        masts.forEach((a, k) =>
          this.flags.push({
            x: b.x + Math.cos(a) * (rx - 6),
            y: b.y + topY + Math.sin(a) * (ry - 3) - 4,
            color: [0xffd65b, 0xff7a4f, 0x7fe7ff, 0xffd65b, 0xb59bff, 0xff7a4f, 0x9be07a][k % 7],
            depth: b.y + 0.3,
            w: 30,
          }),
        );
        if (!this.reduced) for (const t of torches) this.flame(b.x + t.dx, b.y + t.dy - 2, b.y + 0.5, 0.6);
        this.bigScreen(b.x, b.y + topY + ry + 22, b.y + 0.4);
      }
      if (b.kind === "temple") {
        const ent = b.y + TEMPLE.entTop;
        // Flags at the front corners of the roof and on the ridge's far end.
        this.flags.push({ x: b.x - b.w / 2 - 20, y: ent + 4, color: 0xb59bff, depth: b.y + 0.3, w: 30 });
        this.flags.push({ x: b.x + b.w / 2 + 20, y: ent + 4, color: 0xb59bff, depth: b.y + 0.3, w: 30 });
        this.flags.push({ x: b.x, y: b.y + TEMPLE.apex - TEMPLE.back + 6, color: 0xe9c25a, depth: b.y + 0.3, w: 38 });
      }
      if (b.kind === "tower") {
        this.flags.push({ x: b.x + TOWER.flag.dx, y: b.y + TOWER.flag.dy, color: 0xc43c2a, depth: b.y + 0.3, w: 30 });
        if (!this.reduced) this.flame(b.x, b.y + TOWER.brazier, b.y + 0.5);
      }
    }
  }

  private trees() {
    const trunks = [bake(this.scene, "town-trunk", this.nature("trunk",0,treeTrunk(0))), bake(this.scene, "town-trunk-birch", this.nature("trunk",4,treeTrunk(4)))];
    TOWN_TREES.forEach((t, i) => {
      const trunk = trunks[t.variant === 4 ? 1 : 0];
      this.scene.add.image(t.x, t.y, trunk.key).setOrigin(trunk.ox, trunk.oy).setScale(trunk.scale).setDepth(t.y);
      const c = bake(this.scene, `town-canopy-${t.variant}`, this.nature("crown",t.variant,treeCanopy(t.variant)));
      const size = 1.05 + rnd(i * 3.3) * 0.35;
      const img = this.scene.add
        .image(t.x, t.y - 34, c.key)
        .setOrigin(c.ox, c.oy)
        .setScale(c.scale * size)
        .setDepth(t.y + 0.01);
      if (t.variant === 3) img.setScale(c.scale * (size * 0.95));
      this.canopies.push({ img, phase: rnd(i * 7.7) * TAU });
    });
  }

  private props() {
    const s = this.scene;
    // Fountain, element stones, lamps, crates, well, dummies…
    const f = TOWN_OBSTACLES[0];
    // The fountain: basin, then falling water behind the column, the column
    // and bowls, then the water in front (see drawFountain).
    const fountainSource = s.textures.exists("town-fountain-painted")
      ? s.textures.get("town-fountain-painted").getSourceImage() as HTMLImageElement
      : null;
    place(s, fountainSource ? "town-fountain-painted-base" : "town-fountain-base", fountainSource ? paintedFountain(fountainSource, false) : fountainBase(), f.x, f.y, f.y - 0.4);
    place(s, fountainSource ? "town-fountain-painted-top" : "town-fountain-top", fountainSource ? paintedFountain(fountainSource, true) : fountainTop(), f.x, f.y, f.y);
    const kinds = new Set(["stone", "lamp", "crates", "well", "dummy", "mirror", "obelisk", "board"]);
    for (const o of TOWN_OBSTACLES) {
      if (!kinds.has(o.kind)) continue;
      const original = propSprite(o.kind), source=this.environment("town-scenery-props");
      const sprite = source?paintedProp(source,o.kind,original):original;
      const img = place(s, `town-prop-${o.kind}`, sprite, o.x, o.y + (o.shape === "box" ? o.h / 2 : 4), o.y);
      if (o.kind === "lamp" && !this.reduced) {
        const glow = place(s, "town-glow", softBlob("255,214,140"), o.x, o.y - 104, o.y + 0.2, 1);
        glow.setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
        this.lampGlows.push({ img: glow, phase: rnd(o.x) * TAU });
      }
      if (o.kind === "stone") {
        // Each stone carries one element's gem.
        const i = TOWN_OBSTACLES.filter((p) => p.kind === "stone").indexOf(o);
        const colors = [0xffd65b, 0xff7a4f, 0x4fd6c8, 0x8fa8ff, 0x9be07a, 0xff8ad0, 0xd9a35b, 0x9a7aff];
        s.add.circle(o.x, o.y - 28, 7, colors[i % 8]).setDepth(o.y + 0.1);
        s.add.circle(o.x - 2, o.y - 30, 2.5, 0xffffff, 0.7).setDepth(o.y + 0.2);
      }
      void img;
    }
    // Bushes and boulders.
    for (const b of TOWN_SHRUBS) {
      const t = bake(s, `town-${b.kind}-${b.variant}`, this.nature(b.kind,b.variant,shrubSprite(b.kind, b.variant)));
      s.add.image(b.x, b.y + 6, t.key).setOrigin(t.ox, t.oy).setScale(t.scale).setDepth(b.y);
    }
    // Signposts pointing down each road out of the plaza.
    TOWN_SIGNPOSTS.forEach((p, i) => place(s, `town-signpost-${i}`, signpostSprite(p.label, p.color, p.left), p.x, p.y + 4, p.y, 2.5));
    const marketSource = s.textures.exists("town-architecture-buildings") ? s.textures.get("town-architecture-buildings").getSourceImage() as HTMLImageElement : null;
    TOWN_STALLS.forEach((st, i) => place(s, `town-${marketSource?"painted-":""}stall-${i}`, marketSource?paintedStall(marketSource,st.color):stallSprite(st.color, i), st.x, st.y + 26, st.y, 2));
    void TOWN_DUMMIES;
    // Raid Hall statues: each boss carved in stone on a plinth with its
    // name on a bronze plaque; the next plinth waits under a cloth.
    const next = TOWN_NEXT_STATUE;
    place(s, "town-plinth-next", statuePlinth("???", "#b59bff"), next.x, next.y + 12, next.y, 3);
    place(s, "town-veiled", veiledStatue(), next.x, next.y + 14 - STATUE_TOP, next.y + 0.1, 2).setScale(0.4);
    for (const st of TOWN_STATUES) {
      const boss = RAID_BOSSES[st.boss],
        foot = st.y + 12 - STATUE_TOP;
      const originalPlinth=statuePlinth(boss.name,boss.color),plinthSource=this.environment("town-scenery-props");
      place(s, `town-plinth-${st.boss}`, plinthSource?paintedPlinth(plinthSource,originalPlinth,boss.name):originalPlinth, st.x, st.y + 12, st.y, 3);
      if (!this.reduced) {
        // A faint light in the boss's colour, from below.
        const glow = place(s, "town-glow", softBlob("255,214,140"), st.x, foot - 30, st.y + 0.05, 1);
        glow.setTint(num(boss.color)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(0.9, 1.1);
        this.statueGlows.push(glow);
      }
      const key = `town-statue-${st.boss}`;
      const add = () => {
        if (this.disposed || !s.sys.isActive()) return;
        const src = s.textures.get(key).getSourceImage() as HTMLCanvasElement;
        // About 92 px tall, wider bosses scaled to fit the plinth.
        const scale = Math.min(92 / src.height, 96 / src.width);
        s.add.image(st.x, foot + 2, key).setOrigin(0.5, 1).setScale(scale).setDepth(st.y + 0.1);
      };
      if (!s.textures.exists(key) && painted.has(key)) s.textures.addCanvas(key, painted.get(key)!);
      if (s.textures.exists(key)) add();
      else {
        const svg = raidCrest(st.boss).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
        const img = new Image();
        img.onload = () => {
          if (this.disposed) return;
          const carved = painted.get(key) ?? carveStatue(img, 300);
          painted.set(key, carved);
          if (!s.textures.exists(key)) s.textures.addCanvas(key, carved);
          add();
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      }
    }
    s.load.start();
  }

  private labels() {
    for (const d of TOWN_DISTRICTS) {
      const y = d.id === "raid" ? d.y - 40 : d.id === "arena" ? d.y - 590 : d.id === "training" ? d.y - 250 : d.id === "board" ? d.y - 300 : d.y - 340;
      const title = this.scene.add
        .text(0, 0, d.label.toUpperCase(), { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontSize: "26px", fontStyle: "bold", color: d.color })
        .setOrigin(0.5, 1);
      const sub = this.scene.add.text(0, 2, d.sub, { resolution: TEXT_RES, fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#c9d2e3" }).setOrigin(0.5, 0);
      const w = Math.max(title.width, sub.width) + 36;
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x0e1a31, 0.86).fillRoundedRect(-w / 2, -40, w, 64, 14);
      bg.lineStyle(2, num(d.color), 0.9).strokeRoundedRect(-w / 2, -40, w, 64, 14);
      const box = this.scene.add.container(d.x, y, [bg, title, sub]).setDepth(4300);
      this.signs.push({ box, left: d.x - w / 2, right: d.x + w / 2, top: y - 40, bottom: y + 24 });
    }
    // Each station's marker floats above it, but never on a sign: if it
    // would, it sits just above the sign instead.
    for (const [i, sp] of TOWN_SPOTS.entries()) {
      if (sp.boss) continue;
      const lift = sp.id === "arena" ? 200 : sp.id === "raids" ? 230 : sp.id === "boss-rush" ? 120 : sp.id === "leaderboard" ? 330 : sp.id === "missions" ? 250 : 190;
      let y = sp.y - lift;
      for (const r of this.signs)
        if (sp.x > r.left - 16 && sp.x < r.right + 16 && y + 26 > r.top - 6 && y - 26 < r.bottom + 6) y = r.top - 30;
      this.markers.push({ x: sp.x, y, color: num(sp.color), phase: i });
    }
  }

  /** A screen mounted on the coliseum's top tier, above the gate; it grows to fit its text. */
  private bigScreen(x: number, y: number, depth: number) {
    const style = { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontStyle: "bold" };
    const live = this.scene.add.text(0, 0, "LIVE", { ...style, fontSize: "12px", color: "#ffffff" }).setOrigin(0, 0.5).setDepth(depth + 0.01);
    const title = this.scene.add.text(0, 0, "ELEMENTAL COLISEUM", { ...style, fontSize: "15px", color: "#ffd65b" }).setOrigin(0, 0.5).setDepth(depth + 0.01);
    const lines = SCREEN_LINES;
    this.screenText = this.scene.add
      .text(x, y + 12, lines[0], { resolution: TEXT_RES, fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "#eef2ff", align: "center" })
      .setOrigin(0.5)
      .setDepth(depth + 0.01);
    // Size the panel from the widest thing it will ever show, plus padding.
    const badgeW = live.width + 10,
      rowW = badgeW + 8 + title.width,
      widest = Math.max(rowW, ...lines.map((l) => this.screenText!.setText(l).width));
    this.screenText.setText(lines[0]);
    const w = Math.ceil(widest + 36),
      h = 58,
      left = x - rowW / 2,
      rowY = y - 10;
    const g = this.scene.add.graphics().setDepth(depth);
    // Brackets fixing it to the wall, then the frame and the display.
    g.fillStyle(0x3a2a18, 1).fillRect(x - w / 2 + 16, y - h / 2 - 8, 6, h + 16).fillRect(x + w / 2 - 22, y - h / 2 - 8, 6, h + 16);
    g.fillStyle(0x2a2420, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    g.fillStyle(0x0b1220, 1).fillRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 5);
    g.fillStyle(0xff4d5a, 1).fillRoundedRect(left, rowY - 8, badgeW, 16, 4);
    live.setPosition(left + 5, rowY);
    title.setPosition(left + badgeW + 8, rowY);
  }

  private smoke(x: number, y: number, depth: number) {
    bake(this.scene, "town-puff", softBlob("230,230,230"), 1);
    this.scene.add
      .particles(x, y, "town-puff", {
        speedY: { min: -30, max: -18 },
        speedX: { min: 4, max: 14 },
        scale: { start: 0.14, end: 0.5 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 3200,
        frequency: 420,
      })
      .setDepth(depth);
  }

  private flame(x: number, y: number, depth: number, size = 1) {
    bake(this.scene, "town-ember", softBlob("255,170,80"), 1);
    this.scene.add
      .particles(x, y, "town-ember", {
        speedY: { min: -70, max: -40 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.32 * size, end: 0.04 },
        alpha: { start: 0.95, end: 0 },
        tint: [0xffe08a, 0xff9b3a, 0xff5c2a],
        lifespan: 700,
        frequency: 40,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(depth);
  }

  // ───────── Moving life ─────────

  private life() {
    const s = this.scene;
    if (this.reduced) return;
    // Cloud shadows drifting over the town.
    bake(s, "town-cloud", softBlob("10,20,10"), 1);
    for (let i = 0; i < 6; i++)
      this.clouds.push(
        s.add
          .image(rnd(i * 5) * TOWN.width, rnd(i * 9) * TOWN.height, "town-cloud")
          .setScale(5 + rnd(i) * 4, 3 + rnd(i * 2) * 2)
          .setAlpha(0.1)
          .setDepth(7000),
      );
    for (let i = 0; i < 6; i++)
      this.birds.push({ x: rnd(i * 13) * TOWN.width, y: 150 + rnd(i * 17) * (TOWN.height - 300), vx: (70 + rnd(i) * 40) * (i%2?-1:1), vy: (rnd(i * 3) - 0.5) * 20, phase: rnd(i * 23) * TAU });
    const flowerSpots = [
      { x: 1250, y: 760 }, { x: 1980, y: 1360 }, { x: 900, y: 1300 }, { x: 2300, y: 1500 }, { x: 1050, y: 700 }, { x: 2400, y: 760 },
    ];
    for (let i = 0; i < 12; i++) {
      const home = flowerSpots[i % flowerSpots.length];
      this.butterflies.push({ x: home.x, y: home.y, vx: 0, vy: 0, phase: rnd(i * 31) * TAU, home, color: [0xffd65b, 0xff8ad0, 0x8fd0ff, 0xffffff][i % 4] });
    }
    for (let i = 0; i < 5; i++) {
      const [x,y]=[[650,1100],[1000,1420],[1750,1450],[2350,1750],[2800,1200]][i];
      this.chickens.push(createHenMotion({x,y},rnd(i * 41) * TAU,true));
    }
    for (let i = 0; i < 3; i++) this.ducks.push({ a: (i / 3) * TAU, speed: 0.12 + i * 0.03, r: 0.55 + i * 0.12, female: i === 1 });
    this.animals();
  }

  /** Bake every animal frame and create one picture per animal. */
  private animals() {
    const s = this.scene,
      RES = 3;
    const img = (key: string, sprite: Sprite) => {
      const t = bake(s, key, sprite, RES);
      return s.add.image(0, 0, t.key).setOrigin(t.ox, t.oy).setScale(t.scale);
    };
    for (const coat of ["white", "brown"] as const)
      for (const [pose, n] of Object.entries(HEN_FRAMES) as [HenPose, number][])
        for (let f = 0; f < n; f++) bake(s, `town-hen-${coat}-${pose}-${f}`, this.animal("hen",pose,f,coat==="brown",henSprite(coat, pose, f)), RES);
    this.chickens.forEach((c, i) => {
      const coat = i % 2 ? "brown" : "white";
      this.henImgs.push(img(`town-hen-${coat}-walk-0`, this.animal("hen","walk",0,coat==="brown",henSprite(coat, "walk", 0))).setData("coat", coat));
      void c;
    });
    for (const female of [false, true])
      for (const pose of ["swim", "dabble"] as const)
        for (let frame=0;frame<2;frame++) bake(s, `town-duck-${female ? "f" : "m"}-${pose}-${frame}`, this.animal("duck",pose,frame,female,duckSprite(pose,female)), RES);
    for (const d of this.ducks) d.img = img(`town-duck-${d.female ? "f" : "m"}-swim-0`, this.animal("duck","swim",0,d.female,duckSprite("swim", d.female))).setScale(1.4 / RES);
    for (let f = 0; f < GULL_FRAMES; f++) bake(s, `town-gull-${f}`, this.animal("gull","fly",f,false,gullSprite(f)), RES);
    for (let i = 0; i < this.birds.length; i++) this.gullImgs.push(img("town-gull-1", this.animal("gull","fly",1,false,gullSprite(1))).setDepth(9000));
    const wings: [number, string, string][] = [[0xffd65b, "#ffd65b", "#8a5a10"], [0xff8ad0, "#ff8ad0", "#7a1e50"], [0x8fd0ff, "#8fd0ff", "#1e4a7a"], [0xffffff, "#ffffff", "#5a5a6a"]];
    for (const b of this.butterflies) {
      const [, fill, edge] = wings.find(([c]) => c === b.color) ?? wings[0];
      this.flyImgs.push(img(`town-butterfly-${fill}`, butterflySprite(fill, edge)).setDepth(8500));
    }
    if (this.reduced) {
      // Still pictures: everyone at home, standing.
      this.drawCritters(0);
      this.drawBirds(0, 0);
      this.drawBugs(0, 0);
    }
  }

  /** Called every frame. `now` is the scene clock (ms), `dt` seconds. */
  update(now: number, dt: number, focus?: { x: number; y: number }) {
    const t = this.reduced ? 0 : now / 1000;
    // Swaying trees (only those near the camera are worth moving).
    for (const c of this.canopies) {
      if (focus && Math.abs(c.img.x - focus.x) > 1200) continue;
      c.img.rotation = this.reduced ? 0 : Math.sin(t * 1.1 + c.phase) * 0.025 + Math.sin(t * 2.7 + c.phase) * 0.008;
    }
    if (this.sails && !this.reduced) this.sails.rotation = t * 0.6;
    this.drawFlags(t);
    this.drawWater(t);
    this.drawCrystal(t);
    this.drawMarkers(t, focus);
    this.drawPads(t, focus);
    if (this.screenText) {
      const lines = SCREEN_LINES;
      this.screenText.setText(lines[Math.floor(t / 4) % lines.length]);
    }
    if (this.reduced) return;
    for (const l of this.lampGlows) l.img.setAlpha(0.5 + Math.sin(t * 7 + l.phase) * 0.05 + Math.sin(t * 13 + l.phase) * 0.04);
    for (const [i, g] of this.statueGlows.entries()) g.setAlpha(0.2 + Math.sin(t * 1.6 + i) * 0.06);
    for (const c of this.clouds) {
      c.x += dt * 14;
      c.y += dt * 4;
      if (c.x > TOWN.width + 600) c.x = -600;
      if (c.y > TOWN.height + 300) c.y = -300;
    }
    this.drawBirds(t, dt);
    this.drawBugs(t, dt);
    this.drawCritters(dt);
  }

  private drawFlags(t: number) {
    for (const f of this.flags) {
      const g = f.g!.clear();
      g.fillStyle(0x3a2a20, 1).fillRect(f.x - 1.5, f.y - 44, 3, 46);
      const pts: Phaser.Math.Vector2[] = [];
      const seg = 8;
      for (let k = 0; k <= seg; k++) {
        const u = k / seg;
        pts.push(new Phaser.Math.Vector2(f.x + u * f.w, f.y - 42 + Math.sin(t * 5 - u * 4 + f.x) * 4 * u));
      }
      for (let k = seg; k >= 0; k--) {
        const u = k / seg;
        pts.push(new Phaser.Math.Vector2(f.x + u * f.w, f.y - 24 + Math.sin(t * 5 - u * 4 + f.x) * 4 * u - (k === seg ? 4 : 0)));
      }
      g.fillStyle(f.color, 1).fillPoints(pts, true);
    }
  }

  private drawWater(t: number) {
    this.drawFountain(t);
    // Pond: shimmer lines and paddling ducks.
    const pg = this.critterG;
    drawPondWater(pg,t,this.reduced);
    for (const d of this.ducks) {
      const { x,y,dir,bob,dabble,frame } = pondDuckPose(d,t,this.reduced);
      pg.lineStyle(1.5, 0xffffff, 0.35).strokeEllipse(x - dir * 22, y + 2, 40, 9);
      pg.lineStyle(1, 0xffffff, 0.2).strokeEllipse(x - dir * 38, y + 2, 34, 6);
      d.img?.setTexture(`town-duck-${d.female ? "f" : "m"}-${dabble ? "dabble" : "swim"}-${frame}`).setPosition(x, y + 4 + bob).setFlipX(dir < 0).setDepth(y);
    }
  }

  /** Layered cascades follow the painted rims and land inside each pool. */
  private drawFountain(t: number) {
    const f = TOWN_OBSTACLES[0];
    drawFountainWater(this.waterBackG, this.waterG, f.x, f.y, t, this.reduced);
  }

  private drawCrystal(t: number) {
    const f = TOWN_OBSTACLES[0];
    drawFountainCrystal(this.crystalG, f.x, f.y, t, this.reduced);
  }

  /**
   * A glowing pad on the ground at every place you can use: a soft disc
   * in the station's colour with a slowly turning dashed ring. Standing
   * anywhere on it lets you press E (or tap); then it brightens, the ring
   * thickens and sparks rise from it.
   */
  private drawPads(t: number, focus?: { x: number; y: number }) {
    const g = this.padG.clear();
    for (const [i, s] of TOWN_SPOTS.entries()) {
      if (focus && Math.hypot(s.x - focus.x, s.y - focus.y) > 1100) continue;
      const on = this.active === s,
        c = num(s.color),
        r = s.reach * 0.78,
        x = s.x,
        y = s.y + 10,
        breathe = this.reduced ? 0 : Math.sin(t * 2.2 + i) * 0.5 + 0.5;
      // Disc and its glow.
      g.fillStyle(c, on ? 0.26 : 0.1 + breathe * 0.05).fillEllipse(x, y, r * 2, r * 2 * WORLD_ART.groundY);
      g.fillStyle(c, on ? 0.22 : 0.08).fillEllipse(x, y, r * 1.3, r * 1.3 * WORLD_ART.groundY);
      // Solid inner ring.
      g.lineStyle(on ? 3 : 2, c, on ? 0.95 : 0.6).strokeEllipse(x, y, r * 2, r * 2 * WORLD_ART.groundY);
      // Dashed outer ring, turning.
      const spin = this.reduced ? 0 : t * (on ? 1.2 : 0.5) + i,
        dashes = Math.max(8, Math.round(r / 6)),
        R = r + 7;
      g.lineStyle(on ? 3 : 2, c, on ? 0.9 : 0.45);
      for (let k = 0; k < dashes; k++) {
        const a0 = spin + (k / dashes) * Math.PI * 2,
          a1 = a0 + (Math.PI / dashes) * 0.9;
        g.beginPath();
        g.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R * WORLD_ART.groundY);
        g.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R * WORLD_ART.groundY);
        g.strokePath();
      }
      if (on && !this.reduced)
        // Sparks rising off the pad.
        for (let k = 0; k < 8; k++) {
          const p = (t * 0.7 + k / 8) % 1,
            a = k * 2.4 + i,
            sx = x + Math.cos(a) * r * 0.75,
            sy = y + Math.sin(a) * r * 0.75 * WORLD_ART.groundY - p * 46;
          g.fillStyle(0xffffff, (1 - p) * 0.9).fillCircle(sx, sy, 2);
          g.fillStyle(c, (1 - p) * 0.6).fillCircle(sx, sy, 4);
        }
    }
  }

  /** A bobbing diamond over each place you can walk up to. */
  private drawMarkers(t: number, focus?: { x: number; y: number }) {
    const g = this.markerG.clear();
    for (const m of this.markers) {
      if (focus && Math.hypot(m.x - focus.x, m.y - focus.y) > 1000) continue;
      const y = m.y + Math.sin(t * 2.4 + m.phase) * 5;
      g.fillStyle(0x000000, 0.25).fillTriangle(m.x, y - 12, m.x + 11, y + 2, m.x, y + 16);
      g.fillStyle(m.color, 1).fillTriangle(m.x, y - 14, m.x + 10, y, m.x, y + 14).fillTriangle(m.x, y - 14, m.x - 10, y, m.x, y + 14);
      g.fillStyle(0xffffff, 0.55).fillTriangle(m.x, y - 14, m.x - 10, y, m.x - 2, y);
    }
    // A sign over your fighter fades so it never hides you.
    for (const r of this.signs) {
      const behind = !!focus && focus.x > r.left - 40 && focus.x < r.right + 40 && focus.y > r.top && focus.y < r.bottom + 110;
      r.box.setAlpha(r.box.alpha + ((behind ? 0.25 : 1) - r.box.alpha) * 0.15);
    }
  }

  private drawBirds(t: number, dt: number) {
    const sh = this.birdShadowG.clear();
    this.skyG.clear();
    this.birds.forEach((b, i) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(t * 0.7 + b.phase) * 6 * dt;
      if (b.x > TOWN.width + 80 || b.x < -80) {
        b.x = b.vx > 0 ? -80 : TOWN.width + 80;
        b.y = 150 + rnd(b.phase * 7 + t) * (TOWN.height - 300);
      }
      const pose = gullMotion(t, b.phase, b.vx, b.vy, this.sideProfileBirds);
      this.gullImgs[i]?.setTexture(`town-gull-${pose.frame}`)
        .setPosition(b.x, b.y + pose.lift).setFlipX(pose.flipX).setRotation(pose.rotation);

      sh.fillStyle(SHADE, SUN.alpha).fillEllipse(b.x + 60, b.y + 130, 22, 7);
    });
  }

  private drawBugs(t: number, dt: number) {
    this.bugG.clear();
    this.butterflies.forEach((b, i) => {
      const tx = b.home.x + Math.sin(t * 0.5 + b.phase) * 70,
        ty = b.home.y + Math.sin(t * 0.8 + b.phase * 2) * 40;
      const dx = (tx - b.x) * Math.min(1, dt * 1.5),
        dy = (ty - b.y) * Math.min(1, dt * 1.5);
      b.x += dx;
      b.y += dy;
      const y = b.y - 30 + Math.sin(t * 3 + b.phase) * 6,
        flap = 0.2 + Math.abs(Math.sin(t * 14 + b.phase)) * 0.8,
        img = this.flyImgs[i];
      if (!img) return;
      const base = 1 / 3;
      img.setPosition(b.x, y).setScale(base * flap, base).setRotation(dx || dy ? Math.atan2(dy, dx) + Math.PI / 2 : 0);
    });
  }

  private drawCritters(dt: number) {
    // Shadows go on the ground layer; the animals sort with everything else.
    const g = this.critterG;
    this.chickens.forEach((c, i) => {
      const pose=stepHen(c,dt),img=this.henImgs[i],coat=img?.getData("coat")??"white";
      g.fillStyle(SHADE, SUN.alpha).fillEllipse(c.x + 3, c.y + 1, 20, 5);
      img?.setTexture(`town-hen-${coat}-${pose.pose}-${pose.frame}`)
        .setPosition(c.x,c.y).setFlipX(pose.facing<0).setDepth(c.y);
    });
  }
}
