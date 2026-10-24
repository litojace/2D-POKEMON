import Phaser from "phaser";
import {
  TOWN,
  TOWN_BUILDINGS,
  TOWN_SHRUBS,
  TOWN_SIGNPOSTS,
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
  COLISEUM,
  buildingSprite,
  chimneyOf,
  FOUNTAIN,
  fountainBase,
  fountainTop,
  paintGround,
  propSprite,
  rnd,
  shrubSprite,
  signpostSprite,
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
  private waterBackG: Phaser.GameObjects.Graphics;
  private crystalG: Phaser.GameObjects.Graphics;
  private skyG: Phaser.GameObjects.Graphics;
  private birdShadowG: Phaser.GameObjects.Graphics;
  private bugG: Phaser.GameObjects.Graphics;
  private critterG: Phaser.GameObjects.Graphics;
  private markerG: Phaser.GameObjects.Graphics;
  private screenText?: Phaser.GameObjects.Text;
  /** District signs (to keep markers off them and fade them over your fighter). */
  private signs: { box: Phaser.GameObjects.Container; left: number; right: number; top: number; bottom: number }[] = [];
  private markers: { x: number; y: number; color: number; phase: number }[] = [];
  private lampGlows: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private statueGlows: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private birds: Mover[] = [];
  private butterflies: (Mover & { color: number; home: { x: number; y: number } })[] = [];
  private chickens: (Mover & { home: { x: number; y: number }; pause: number })[] = [];
  /** A dog trotting laps around the plaza, stopping now and then to sniff. */
  private dog = { a: 1.2, rest: 0, sniffAt: 6 };
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
    this.waterBackG = scene.add.graphics().setDepth(TOWN.plaza.y - 0.2);
    this.waterG = scene.add.graphics().setDepth(TOWN.plaza.y + 0.1);
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
    const trunks = [bake(this.scene, "town-trunk", treeTrunk(0)), bake(this.scene, "town-trunk-birch", treeTrunk(4))];
    TOWN_TREES.forEach((t, i) => {
      const trunk = trunks[t.variant === 4 ? 1 : 0];
      this.scene.add.image(t.x, t.y, trunk.key).setOrigin(trunk.ox, trunk.oy).setScale(trunk.scale).setDepth(t.y);
      const c = bake(this.scene, `town-canopy-${t.variant}`, treeCanopy(t.variant));
      const size = 1.05 + rnd(i * 3.3) * 0.35;
      const img = this.scene.add
        .image(t.x, t.y - 34, c.key)
        .setOrigin(c.ox, c.oy)
        .setScale(c.scale * size)
        .setFlipX(i % 2 === 0)
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
    place(s, "town-fountain-base", fountainBase(), f.x, f.y, f.y - 0.4);
    place(s, "town-fountain-top", fountainTop(), f.x, f.y, f.y);
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
    // Bushes and boulders.
    for (const b of TOWN_SHRUBS) {
      const t = bake(s, `town-${b.kind}-${b.variant}`, shrubSprite(b.kind, b.variant));
      s.add.image(b.x, b.y + 6, t.key).setOrigin(t.ox, t.oy).setScale(t.scale).setDepth(b.y);
    }
    // Signposts pointing down each road out of the plaza.
    TOWN_SIGNPOSTS.forEach((p, i) => place(s, `town-signpost-${i}`, signpostSprite(p.label, p.color, p.left), p.x, p.y + 4, p.y, 2.5));
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
    // The spout: a small jet that rises from the finial and falls back
    // into the top bowl.
    const f = TOWN_OBSTACLES[0];
    bake(s, "town-drop", softBlob("215,245,255"), 1);
    s.add
      .particles(f.x, f.y + FOUNTAIN.spout.dy, "town-drop", {
        speed: { min: 95, max: 120 },
        angle: { min: 262, max: 278 },
        gravityY: 420,
        scale: { start: 0.07, end: 0.045 },
        alpha: { start: 0.95, end: 0.35 },
        lifespan: 560,
        frequency: 14,
      })
      .setDepth(f.y + 0.15);
    // Spray and mist where the falling water meets the pool.
    const land = FOUNTAIN.mid.rx + 16;
    s.add
      .particles(0, 0, "town-drop", {
        emitZone: { type: "edge", source: new Phaser.Geom.Ellipse(f.x, f.y + FOUNTAIN.pool.dy, land * 2, land * 0.94), quantity: 40 },
        speedY: { min: -60, max: -25 },
        speedX: { min: -14, max: 14 },
        gravityY: 260,
        scale: { start: 0.06, end: 0.03 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 340,
        frequency: 22,
      })
      .setDepth(f.y + 0.12);
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
      const lines = SCREEN_LINES;
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
    this.drawFountain(t);
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

  /**
   * Water spilling over each bowl's lip in thin sheets, the strands behind
   * the column drawn first, then the near ones; ripples, foam and glints
   * on the pool.
   */
  private drawFountain(t: number) {
    const f = TOWN_OBSTACLES[0],
      { pool, mid, top } = FOUNTAIN,
      back = this.waterBackG.clear(),
      front = this.waterG.clear(),
      still = this.reduced;
    const poolY = f.y + pool.dy;
    // Ripples spreading from where the water lands.
    for (let k = 0; k < 3 && !still; k++) {
      const p = (t * 0.45 + k / 3) % 1,
        rx = mid.rx + 18 + p * (pool.rx - mid.rx - 22);
      back.lineStyle(1.5, 0xe8fbff, 0.45 * (1 - p)).strokeEllipse(f.x, poolY, rx * 2, rx * 2 * (pool.ry / pool.rx));
    }
    // Glints twinkling on the pool.
    for (let k = 0; k < 12 && !still; k++) {
      const a = rnd(k * 5.3) * TAU,
        d = 0.3 + rnd(k * 9.1) * 0.6,
        tw = Math.max(0, Math.sin(t * 2.2 + k * 1.7));
      back.fillStyle(0xffffff, 0.75 * tw).fillEllipse(f.x + Math.cos(a) * pool.rx * d, poolY + Math.sin(a) * pool.ry * d, 5 * tw + 1, 1.6);
    }
    // A sheet falling from a bowl's lip to the surface below it.
    const sheet = (fromY: number, fromRx: number, fromRy: number, toY: number, toRx: number, toRy: number, strands: number, width: number) => {
      for (let k = 0; k < strands; k++) {
        const a = (k / strands) * TAU + 0.04,
          sin = Math.sin(a),
          g = sin < 0 ? back : front,
          x0 = f.x + Math.cos(a) * fromRx,
          y0 = fromY + sin * fromRy + 2,
          x1 = f.x + Math.cos(a) * toRx,
          y1 = toY + sin * toRy,
          // The water leaves the lip outward, then curves down.
          cx = x0 + Math.cos(a) * (toRx - fromRx) * 0.9,
          cy = y0 + 2;
        const sway = still ? 0 : Math.sin(t * 6 + k * 1.3) * 0.8;
        const curve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(x0, y0),
          new Phaser.Math.Vector2(cx + sway, cy),
          new Phaser.Math.Vector2(x1 + sway, y1),
        );
        const pts = curve.getPoints(10);
        g.lineStyle(width, 0xbfeeff, sin < 0 ? 0.32 : 0.42).strokePoints(pts);
        g.lineStyle(width * 0.4, 0xffffff, sin < 0 ? 0.25 : 0.45).strokePoints(pts);
        // Bright beads running down the strand.
        if (!still)
          for (let b = 0; b < 2; b++) {
            const u = (t * 1.6 + k * 0.37 + b * 0.5) % 1,
              p = curve.getPoint(u * u);
            g.fillStyle(0xffffff, 0.8).fillCircle(p.x, p.y, 1.4);
          }
      }
    };
    sheet(f.y + top.dy, top.rx - 2, top.ry - 1, f.y + mid.dy + 2, top.rx + 9, (top.rx + 9) * (mid.ry / mid.rx), 14, 2);
    sheet(f.y + mid.dy, mid.rx - 3, mid.ry - 1.5, poolY, mid.rx + 16, (mid.rx + 16) * (pool.ry / pool.rx), 30, 3);
    // Foam where the sheet lands, and the jet above the spout.
    const land = mid.rx + 16,
      landRy = land * (pool.ry / pool.rx);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * TAU,
        g = Math.sin(a) < 0 ? back : front,
        wob = still ? 1 : 0.7 + 0.3 * Math.sin(t * 9 + k * 2.1);
      g.fillStyle(0xf4fdff, 0.75 * wob).fillEllipse(f.x + Math.cos(a) * land, poolY + Math.sin(a) * landRy, 9 * wob, 4);
    }
    front.lineStyle(3, 0xd8f6ff, 0.75).lineBetween(f.x, f.y + FOUNTAIN.spout.dy, f.x, f.y + FOUNTAIN.spout.dy - 12 - (still ? 0 : Math.sin(t * 8) * 1.5));
  }

  private drawCrystal(t: number) {
    const f = TOWN_OBSTACLES[0];
    const bob = Math.sin(t * 1.4) * 5,
      cy = f.y - 215 + bob,
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
    {
      const d = this.dog;
      d.sniffAt -= dt;
      if (d.sniffAt <= 0) {
        d.rest = 1.6 + rnd(t) * 1.4;
        d.sniffAt = 7 + rnd(t * 3) * 8;
      }
      const moving = d.rest <= 0;
      if (moving) d.a += dt * 0.11;
      else d.rest -= dt;
      const R = 455,
        x = TOWN.plaza.x + Math.cos(d.a) * R,
        y = TOWN.plaza.y + Math.sin(d.a) * R * 0.78,
        dir = -Math.sin(d.a) >= 0 ? 1 : -1,
        step = moving ? Math.sin(t * 14) : 0,
        sniff = moving ? 0 : Math.max(0, Math.sin(t * 5)) * 3;
      g.fillStyle(0x000000, 0.2).fillEllipse(x, y + 2, 30, 7);
      g.fillStyle(0x7a4f2e, 1);
      g.fillRect(x - 10, y - 9 - step, 3, 9 + step).fillRect(x + 7, y - 9 + step, 3, 9 - step);
      g.fillStyle(0xa8703f, 1).fillEllipse(x, y - 13, 28, 13);
      g.fillCircle(x + dir * 14, y - 19 + sniff, 7);
      g.fillStyle(0x6a4224, 1).fillEllipse(x + dir * 11, y - 21 + sniff, 5, 9);
      g.fillStyle(0x2a1c10, 1).fillCircle(x + dir * 20, y - 18 + sniff, 1.8);
      // Wagging tail.
      const wag = Math.sin(t * (moving ? 10 : 18)) * 5;
      g.lineStyle(3, 0xa8703f, 1).lineBetween(x - dir * 13, y - 15, x - dir * 20, y - 22 + wag);
    }
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
