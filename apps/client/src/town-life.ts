import Phaser from "phaser";
import {
  TOWN,
  TOWN_BUILDINGS,
  TOWN_DISTRICTS,
  TOWN_DUMMIES,
  TOWN_OBSTACLES,
  TOWN_POND,
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
  buildingSprite,
  chimneyOf,
  fountainSprite,
  paintGround,
  propSprite,
  rnd,
  softBlob,
  stallSprite,
  treeCanopy,
  treeTrunk,
  windmillSails,
  type Sprite,
} from "./town-art";

/**
 * Everything in the town that isn't a player: the painted ground, buildings,
 * trees and props (sorted by their foot so fighters pass behind them), and
 * the life on top: water, flags, smoke, birds, butterflies, ducks, chickens,
 * drifting cloud shadows and swaying trees.
 */
const num = (css: string) => parseInt(css.slice(1), 16);
const TAU = Math.PI * 2;

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
  if (!scene.textures.exists(key)) {
    const canvas = paint(key, Math.ceil(sprite.w * res), Math.ceil(sprite.h * res), (ctx) => {
      ctx.scale(res, res);
      sprite.draw(ctx);
    });
    scene.textures.addCanvas(key, canvas);
  }
  return { key, ox: sprite.ax / sprite.w, oy: sprite.ay / sprite.h, scale: 1 / res };
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
  private canopies: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private sails?: Phaser.GameObjects.Image;
  private flags: { x: number; y: number; color: number; depth: number; w: number; g?: Phaser.GameObjects.Graphics }[] = [];
  private waterG: Phaser.GameObjects.Graphics;
  private crystalG: Phaser.GameObjects.Graphics;
  private skyG: Phaser.GameObjects.Graphics;
  private birdShadowG: Phaser.GameObjects.Graphics;
  private bugG: Phaser.GameObjects.Graphics;
  private critterG: Phaser.GameObjects.Graphics;
  private markerG: Phaser.GameObjects.Graphics;
  private screenText?: Phaser.GameObjects.Text;
  private lampGlows: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private statueGlows: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private birds: Mover[] = [];
  private butterflies: (Mover & { color: number; home: { x: number; y: number } })[] = [];
  private chickens: (Mover & { home: { x: number; y: number }; pause: number })[] = [];
  private ducks: { a: number; speed: number; r: number }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private reduced: boolean,
  ) {
    this.ground();
    this.buildings();
    this.trees();
    this.props();
    this.labels();
    for (const f of this.flags) f.g = scene.add.graphics().setDepth(f.depth);
    this.waterG = scene.add.graphics().setDepth(TOWN.plaza.y + 1);
    this.crystalG = scene.add.graphics().setDepth(TOWN.plaza.y + 2);
    this.skyG = scene.add.graphics().setDepth(9000);
    this.birdShadowG = scene.add.graphics().setDepth(-400);
    this.bugG = scene.add.graphics().setDepth(8500);
    this.critterG = scene.add.graphics().setDepth(-450);
    this.markerG = scene.add.graphics().setDepth(4400);
    this.life();
  }

  // ───────── Static world ─────────

  private ground() {
    const key = "town-ground";
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, paint(key, TOWN.width, TOWN.height, paintGround));
    this.scene.add.image(0, 0, key).setOrigin(0).setDepth(-1000);
  }

  private buildings() {
    for (const b of TOWN_BUILDINGS) {
      const key = b.kind === "house" ? `town-house-${b.variant}-${b.w}` : `town-${b.id}`;
      place(this.scene, key, buildingSprite(b), b.x, b.y);
      if (b.kind === "windmill")
        this.sails = place(this.scene, "town-sails", windmillSails(), b.x + WINDMILL_HUB.dx, b.y + WINDMILL_HUB.dy, b.y + 1);
      if (b.kind === "house" && !this.reduced) {
        const c = chimneyOf(b);
        this.smoke(b.x + c.dx, b.y + c.dy, b.y + 2);
      }
      if (b.kind === "coliseum") {
        const rx = b.w / 2,
          wallTop = b.y - 248;
        for (const a of [Math.PI + 0.45, Math.PI + 1.0, Math.PI * 1.5, TAU - 1.0, TAU - 0.45])
          this.flags.push({ x: b.x + Math.cos(a) * rx * 0.98, y: wallTop + Math.sin(a) * 120 - 10, color: [0xffd65b, 0xff7a4f, 0xffd65b, 0x7fe7ff, 0xffd65b][this.flags.length % 5], depth: b.y + 0.3, w: 34 });
        this.bigScreen(b.x, b.y - 300, b.y + 0.4);
      }
      if (b.kind === "temple") {
        const ent = b.y - 286;
        this.flags.push({ x: b.x - b.w / 2 - 20, y: ent, color: 0xb59bff, depth: b.y + 0.3, w: 30 });
        this.flags.push({ x: b.x + b.w / 2 + 20, y: ent, color: 0xb59bff, depth: b.y + 0.3, w: 30 });
        this.flags.push({ x: b.x, y: ent - 122, color: 0xe9c25a, depth: b.y + 0.3, w: 38 });
      }
      if (b.kind === "tower") {
        this.flags.push({ x: b.x - 40, y: b.y - 352, color: 0xc43c2a, depth: b.y + 0.3, w: 30 });
        if (!this.reduced) this.flame(b.x, b.y - 362, b.y + 0.5);
      }
    }
  }

  private trees() {
    const trunk = bake(this.scene, "town-trunk", treeTrunk());
    TOWN_TREES.forEach((t, i) => {
      this.scene.add.image(t.x, t.y, trunk.key).setOrigin(trunk.ox, trunk.oy).setScale(trunk.scale).setDepth(t.y);
      const c = bake(this.scene, `town-canopy-${t.variant}`, treeCanopy(t.variant));
      const size = 1.05 + rnd(i * 3.3) * 0.35;
      const img = this.scene.add
        .image(t.x, t.y - 34, c.key)
        .setOrigin(c.ox, c.oy)
        .setScale(c.scale * size)
        .setFlipX(i % 2 === 0)
        .setDepth(t.y + 0.01);
      this.canopies.push({ img, phase: rnd(i * 7.7) * TAU });
    });
  }

  private props() {
    const s = this.scene;
    // Fountain, element stones, lamps, crates, well, dummies…
    const f = TOWN_OBSTACLES[0];
    place(s, "town-fountain", fountainSprite(), f.x, f.y + 10, f.y);
    const kinds = new Set(["stone", "lamp", "crates", "well", "dummy", "mirror", "obelisk", "board"]);
    for (const o of TOWN_OBSTACLES) {
      if (!kinds.has(o.kind)) continue;
      const sprite = propSprite(o.kind);
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
    TOWN_STALLS.forEach((st, i) => place(s, `town-stall-${i}`, stallSprite(st.color, i), st.x, st.y + 26, st.y));
    void TOWN_DUMMIES;
    // Raid Hall statues: a pedestal, the boss's crest, and a glow.
    const ped = bake(s, "town-pedestal", propSprite("pedestal"));
    s.add.image(TOWN_NEXT_STATUE.x, TOWN_NEXT_STATUE.y + 10, ped.key).setOrigin(ped.ox, ped.oy).setScale(ped.scale).setDepth(TOWN_NEXT_STATUE.y);
    s.add
      .text(TOWN_NEXT_STATUE.x, TOWN_NEXT_STATUE.y - 52, "?", { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontSize: "40px", fontStyle: "bold", color: "#b59bff" })
      .setOrigin(0.5, 1)
      .setAlpha(0.7)
      .setDepth(TOWN_NEXT_STATUE.y + 0.1);
    for (const st of TOWN_STATUES) {
      s.add.image(st.x, st.y + 10, ped.key).setOrigin(ped.ox, ped.oy).setScale(ped.scale).setDepth(st.y);
      const boss = RAID_BOSSES[st.boss];
      if (!this.reduced) {
        const glow = place(s, "town-glow", softBlob("255,214,140"), st.x, st.y - 70, st.y + 0.05, 1);
        glow.setTint(num(boss.color)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(1.3);
        this.statueGlows.push(glow);
      }
      const key = `town-crest-${st.boss}`;
      const add = () => s.add.image(st.x, st.y - 40, key).setOrigin(0.5, 1).setDepth(st.y + 0.1).setScale(0.42);
      if (s.textures.exists(key)) add();
      else {
        const svg = raidCrest(st.boss).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
        // Phaser decodes data URLs as base64.
        const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(svg)));
        s.load.svg(key, `data:image/svg+xml;base64,${b64}`, { width: 200, height: 200 });
        s.load.once(`filecomplete-svg-${key}`, add);
      }
    }
    s.load.start();
  }

  private labels() {
    for (const d of TOWN_DISTRICTS) {
      const y = d.id === "raid" ? d.y - 470 : d.id === "arena" ? d.y - 470 : d.id === "training" ? d.y - 250 : d.id === "board" ? d.y - 300 : d.y - 340;
      const title = this.scene.add
        .text(0, 0, d.label.toUpperCase(), { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontSize: "26px", fontStyle: "bold", color: d.color })
        .setOrigin(0.5, 1);
      const sub = this.scene.add.text(0, 2, d.sub, { resolution: TEXT_RES, fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#c9d2e3" }).setOrigin(0.5, 0);
      const w = Math.max(title.width, sub.width) + 36;
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x0e1a31, 0.86).fillRoundedRect(-w / 2, -40, w, 64, 14);
      bg.lineStyle(2, num(d.color), 0.9).strokeRoundedRect(-w / 2, -40, w, 64, 14);
      this.scene.add.container(d.x, y, [bg, title, sub]).setDepth(4300);
    }
  }

  private bigScreen(x: number, y: number, depth: number) {
    const g = this.scene.add.graphics().setDepth(depth);
    g.fillStyle(0x3a3226, 1).fillRoundedRect(x - 120, y - 46, 240, 92, 10);
    g.fillStyle(0x0b1220, 1).fillRoundedRect(x - 112, y - 38, 224, 76, 6);
    g.fillStyle(0xff4d5a, 1).fillRoundedRect(x - 104, y - 32, 38, 16, 4);
    this.scene.add.text(x - 85, y - 24, "LIVE", { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontSize: "13px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5).setDepth(depth + 0.01);
    this.scene.add.text(x + 14, y - 22, "ELEMENTAL COLISEUM", { resolution: TEXT_RES, fontFamily: "Barlow Condensed, sans-serif", fontSize: "17px", fontStyle: "bold", color: "#ffd65b" }).setOrigin(0.5).setDepth(depth + 0.01);
    this.screenText = this.scene.add
      .text(x, y + 12, "", { resolution: TEXT_RES, fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#eef2ff", align: "center" })
      .setOrigin(0.5)
      .setDepth(depth + 0.01);
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

  private flame(x: number, y: number, depth: number) {
    bake(this.scene, "town-ember", softBlob("255,170,80"), 1);
    this.scene.add
      .particles(x, y, "town-ember", {
        speedY: { min: -70, max: -40 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.32, end: 0.04 },
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
    // Fountain spray from the upper bowl.
    const f = TOWN_OBSTACLES[0];
    bake(s, "town-drop", softBlob("200,240,255"), 1);
    s.add
      .particles(f.x, f.y - 82, "town-drop", {
        speed: { min: 60, max: 95 },
        angle: { min: 205, max: 335 },
        gravityY: 230,
        scale: { start: 0.09, end: 0.05 },
        alpha: { start: 0.9, end: 0.2 },
        lifespan: 820,
        frequency: 18,
      })
      .setDepth(f.y + 1.5);
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
      this.birds.push({ x: rnd(i * 13) * TOWN.width, y: 150 + rnd(i * 17) * (TOWN.height - 300), vx: 70 + rnd(i) * 40, vy: (rnd(i * 3) - 0.5) * 20, phase: rnd(i * 23) * TAU });
    const flowerSpots = [
      { x: 1250, y: 760 }, { x: 1980, y: 1360 }, { x: 900, y: 1300 }, { x: 2300, y: 1500 }, { x: 1050, y: 700 }, { x: 2400, y: 760 },
    ];
    for (let i = 0; i < 12; i++) {
      const home = flowerSpots[i % flowerSpots.length];
      this.butterflies.push({ x: home.x, y: home.y, vx: 0, vy: 0, phase: rnd(i * 31) * TAU, home, color: [0xffd65b, 0xff8ad0, 0x8fd0ff, 0xffffff][i % 4] });
    }
    for (let i = 0; i < 5; i++) {
      const home = i < 3 ? { x: 1000 + i * 40, y: 1420 } : { x: 2400 + i * 30, y: 1780 };
      this.chickens.push({ x: home.x, y: home.y, vx: 0, vy: 0, phase: rnd(i * 41) * TAU, home, pause: 0 });
    }
    for (let i = 0; i < 3; i++) this.ducks.push({ a: (i / 3) * TAU, speed: 0.12 + i * 0.03, r: 0.55 + i * 0.12 });
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
    if (this.screenText) {
      const lines = ["Walk to the gate to play", "Duels · 2v2 Teams · Free-for-all", "Party rules · Four arenas", "Bring a friend. Find a rival."];
      this.screenText.setText(lines[Math.floor(t / 4) % lines.length]);
    }
    if (this.reduced) return;
    for (const l of this.lampGlows) l.img.setAlpha(0.5 + Math.sin(t * 7 + l.phase) * 0.05 + Math.sin(t * 13 + l.phase) * 0.04);
    for (const [i, g] of this.statueGlows.entries()) g.setAlpha(0.35 + Math.sin(t * 1.6 + i) * 0.15);
    for (const c of this.clouds) {
      c.x += dt * 14;
      c.y += dt * 4;
      if (c.x > TOWN.width + 600) c.x = -600;
      if (c.y > TOWN.height + 300) c.y = -300;
    }
    this.drawBirds(t, dt);
    this.drawBugs(t, dt);
    this.drawCritters(t, dt);
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
    const g = this.waterG.clear();
    const f = TOWN_OBSTACLES[0];
    // Ripples in the fountain basin.
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.6 + k / 3) % 1;
      g.lineStyle(2, 0xe8fbff, 0.5 * (1 - p)).strokeEllipse(f.x, f.y + 8, 40 + p * 120, 18 + p * 58);
    }
    // Pond: shimmer lines and paddling ducks.
    const p = TOWN_POND;
    const pg = this.critterG;
    pg.clear();
    for (let k = 0; k < 14; k++) {
      const a = rnd(k * 3) * TAU,
        d = rnd(k * 5) * 0.75,
        x = p.x + Math.cos(a) * p.rx * d,
        y = p.y + Math.sin(a) * p.ry * d,
        w = 10 + Math.sin(t * 2 + k) * 6;
      pg.lineStyle(2, 0xd8f6ff, 0.35 + Math.sin(t * 3 + k) * 0.2).lineBetween(x - w, y, x + w, y);
    }
    for (const d of this.ducks) {
      const a = d.a + t * d.speed,
        x = p.x + Math.cos(a) * p.rx * d.r,
        y = p.y + Math.sin(a) * p.ry * d.r,
        dir = -Math.sin(a) > 0 ? 1 : -1,
        bob = Math.sin(t * 4 + d.a) * 1.2;
      pg.lineStyle(1.5, 0xffffff, 0.35).strokeEllipse(x - dir * 14, y + 4, 26, 8);
      pg.fillStyle(0xf4efe2, 1).fillEllipse(x, y + bob, 24, 13);
      pg.fillStyle(0x2f7a4a, 1).fillCircle(x + dir * 10, y - 7 + bob, 6);
      pg.fillStyle(0xffb03a, 1).fillTriangle(x + dir * 15, y - 8 + bob, x + dir * 21, y - 6 + bob, x + dir * 15, y - 4 + bob);
    }
  }

  private drawCrystal(t: number) {
    const f = TOWN_OBSTACLES[0];
    const bob = Math.sin(t * 1.4) * 5,
      cy = f.y - 150 + bob,
      g = this.crystalG.clear();
    g.fillStyle(0xfff0be, 0.18).fillCircle(f.x, cy, 50);
    g.fillStyle(0xe9f7ff, 1).fillTriangle(f.x, cy - 36, f.x + 22, cy, f.x, cy + 36);
    g.fillStyle(0xbfe8ff, 1).fillTriangle(f.x, cy - 36, f.x - 22, cy, f.x, cy + 36);
    g.fillStyle(0x9fd9ff, 1).fillTriangle(f.x, cy - 36, f.x + 22, cy, f.x + 6, cy);
    // Motes circling the crystal.
    for (let k = 0; k < 6; k++) {
      const a = t * 0.9 + (k / 6) * TAU;
      g.fillStyle(0xfff3c4, 0.8).fillCircle(f.x + Math.cos(a) * 40, cy + Math.sin(a) * 14, 2.2);
    }
  }

  /** A bobbing diamond over each place you can walk up to. */
  private drawMarkers(t: number, focus?: { x: number; y: number }) {
    const g = this.markerG.clear();
    for (const [i, s] of TOWN_SPOTS.entries()) {
      if (s.boss) continue;
      if (focus && Math.hypot(s.x - focus.x, s.y - focus.y) > 900) continue;
      const lift = s.id === "arena" ? 200 : s.id === "raids" ? 230 : s.id === "boss-rush" ? 120 : s.id === "leaderboard" ? 330 : s.id === "missions" ? 250 : 190;
      const y = s.y - lift + Math.sin(t * 2.4 + i) * 6,
        c = num(s.color);
      g.fillStyle(0x000000, 0.25).fillTriangle(s.x, y - 12, s.x + 11, y + 2, s.x, y + 16);
      g.fillStyle(c, 1).fillTriangle(s.x, y - 14, s.x + 10, y, s.x, y + 14).fillTriangle(s.x, y - 14, s.x - 10, y, s.x, y + 14);
      g.fillStyle(0xffffff, 0.55).fillTriangle(s.x, y - 14, s.x - 10, y, s.x - 2, y);
    }
  }

  private drawBirds(t: number, dt: number) {
    const g = this.skyG.clear(),
      sh = this.birdShadowG.clear();
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(t * 0.7 + b.phase) * 6 * dt;
      if (b.x > TOWN.width + 80) {
        b.x = -80;
        b.y = 150 + rnd(b.phase * 7 + t) * (TOWN.height - 300);
      }
      const flap = Math.sin(t * 9 + b.phase) * 7;
      g.lineStyle(3, 0x2a2a35, 0.9);
      g.beginPath();
      g.moveTo(b.x - 12, b.y - flap);
      g.lineTo(b.x, b.y);
      g.lineTo(b.x + 12, b.y - flap);
      g.strokePath();
      sh.fillStyle(0x000000, 0.12).fillEllipse(b.x + 60, b.y + 130, 18, 6);
    }
  }

  private drawBugs(t: number, dt: number) {
    const g = this.bugG.clear();
    for (const b of this.butterflies) {
      const tx = b.home.x + Math.sin(t * 0.5 + b.phase) * 70,
        ty = b.home.y + Math.sin(t * 0.8 + b.phase * 2) * 40;
      b.x += (tx - b.x) * Math.min(1, dt * 1.5);
      b.y += (ty - b.y) * Math.min(1, dt * 1.5);
      const w = Math.abs(Math.sin(t * 14 + b.phase)) * 6 + 1,
        y = b.y - 30 + Math.sin(t * 3 + b.phase) * 6;
      g.fillStyle(b.color, 0.95).fillEllipse(b.x - w / 2 - 1, y, w, 7).fillEllipse(b.x + w / 2 + 1, y, w, 7);
      g.fillStyle(0x2a2a35, 1).fillRect(b.x - 0.75, y - 3, 1.5, 6);
    }
  }

  private drawCritters(t: number, dt: number) {
    // Chickens peck around a home spot, drawn on the ground layer.
    const g = this.critterG;
    for (const c of this.chickens) {
      c.pause -= dt;
      if (c.pause <= 0) {
        const a = rnd(t * 3 + c.phase) * TAU;
        c.vx = Math.cos(a) * 30;
        c.vy = Math.sin(a) * 18;
        c.pause = 0.8 + rnd(t + c.phase) * 1.6;
      }
      const moving = c.pause > 0.5;
      if (moving) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
      if (Math.hypot(c.x - c.home.x, c.y - c.home.y) > 80) {
        c.vx = (c.home.x - c.x) * 0.5;
        c.vy = (c.home.y - c.y) * 0.5;
      }
      const dir = c.vx >= 0 ? 1 : -1,
        hop = moving ? Math.abs(Math.sin(t * 12 + c.phase)) * 3 : 0,
        peck = moving ? 0 : Math.max(0, Math.sin(t * 6 + c.phase)) * 4;
      g.fillStyle(0x000000, 0.18).fillEllipse(c.x, c.y + 2, 18, 5);
      g.fillStyle(0xfff6e0, 1).fillEllipse(c.x, c.y - 8 - hop, 18, 14);
      g.fillStyle(0xfff6e0, 1).fillCircle(c.x + dir * 8, c.y - 15 - hop + peck, 5.5);
      g.fillStyle(0xe8463a, 1).fillCircle(c.x + dir * 8, c.y - 21 - hop + peck, 2.5);
      g.fillStyle(0xffb03a, 1).fillTriangle(c.x + dir * 13, c.y - 16 - hop + peck, c.x + dir * 18, c.y - 14 - hop + peck, c.x + dir * 13, c.y - 12 - hop + peck);
      g.fillStyle(0x2a2a35, 1).fillCircle(c.x + dir * 9, c.y - 16 - hop + peck, 1.2);
    }
  }
}
