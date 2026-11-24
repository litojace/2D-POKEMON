import { describe, expect, it } from "vitest";
import { CHARACTERS, OBSTACLES, type Projectile } from "@arena/shared";
import { Fx, fxFor } from "../../apps/client/src/fx-engine";
import { drawProjectile } from "../../apps/client/src/skill-effects";

/** Same rule as the arena scene: fighters and blocks sort by ground y. */
const fighterDepth = (y: number) => 2 + y / 10000;

/** A stand-in scene: every game object records its depth and drawing calls. */
function fakeScene() {
  const made: { depth: number; calls: number }[] = [];
  const object = () => {
    const rec = { depth: 0, calls: 0 };
    made.push(rec);
    const o: any = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "setDepth")
            return (d: number) => {
              rec.depth = d;
              return o;
            };
          if (key === "depth") return rec.depth;
          return () => {
            rec.calls++;
            return o;
          };
        },
      },
    );
    return o;
  };
  const scene: any = {
    add: { graphics: object, image: object },
    textures: { exists: () => true },
    events: { on() {}, off() {}, once() {} },
    cameras: { main: { shake() {} } },
  };
  return { scene, made };
}

// The Coliseum's block rows: front edges at y 370 (two blocks), 510 and 660.
const EDGES = OBSTACLES.map((o) => o.y + o.h);

describe("effects and stone cover", () => {
  it("draws an effect behind a block row just under that row", () => {
    const { scene } = fakeScene();
    const fx = new Fx(scene);
    fx.setOccluders(EDGES, fighterDepth);
    // Behind the first row (ground y 300): under the blocks at 370, over a
    // fighter standing just in front of the shot.
    fx.at(300);
    const behind = (fx.g as any).depth;
    expect(behind).toBeLessThan(fighterDepth(370));
    expect(behind).toBeGreaterThan(fighterDepth(369));
    // Between rows: under the centre block (510), over the first row.
    fx.at(450);
    expect((fx.solid as any).depth).toBeLessThan(fighterDepth(510));
    expect((fx.solid as any).depth).toBeGreaterThan(fighterDepth(370));
    // In front of every block: the top layers, as before.
    fx.at(700);
    expect((fx.g as any).depth).toBe(4.5);
    fx.at(null);
    expect((fx.g as any).depth).toBe(4.5);
  });

  it("keeps everything on top when there is no cover", () => {
    const { scene } = fakeScene();
    const fx = new Fx(scene);
    fx.setOccluders([], fighterDepth);
    fx.at(100);
    expect((fx.g as any).depth).toBe(4.5);
    expect((fx.solid as any).depth).toBe(3.6);
  });

  it("puts a shot behind a block under it, then returns to the top layers", () => {
    const { scene, made } = fakeScene();
    const fx = fxFor(scene);
    fx.setOccluders(EDGES, fighterDepth);
    const g: any = { scene, ...Object.fromEntries(["fillStyle", "fillCircle", "lineStyle", "lineBetween"].map((k) => [k, () => g])) };
    const needle = CHARACTERS.tidefin.basic;
    // Tidefin's shot flying just behind the top-left block, as in the report.
    const pr = { id: 1, owner: "a", x: 560, y: 300, vx: 600, vy: 0, ability: needle, color: 0x6fd6ff } as unknown as Projectile;
    expect(needle.id).toBe("tide-needle");
    drawProjectile(g, pr, 0, true);
    const drawnBehind = made.filter((m) => m.calls > 0 && m.depth > 2 && m.depth < fighterDepth(370));
    expect(drawnBehind.length).toBeGreaterThan(0);
    expect((fx.g as any).depth).toBe(4.5);
  });
});
