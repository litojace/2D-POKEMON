import { describe, expect, it } from "vitest";
import {
  PLAZA,
  PLAZA_HURDLE_SEGMENTS,
  PLAZA_OBSTACLES,
  PLAZA_PATHS,
  PLAZA_TRACK,
} from "../../packages/shared/src/plaza";
import {
  depthSort,
  order,
  slices,
  spot,
  type Drawable,
} from "../../apps/client/src/plaza/plaza-depth";
import {
  BAKED,
  COWS,
  FARM,
  LANDMARKS,
  LIVE,
  MOVER_BOX,
  PLAZA_MARGIN,
  PLAZA_OUT,
  PLAZA_REACH,
  PLAZA_SCALE,
  RIVER,
  RIVER_LAMPS,
  SURROUND,
  coversMovers,
  hidesLandmark,
  onWalkable,
  plazaCamClamp,
  plazaZoom,
  propBox,
} from "../../apps/client/src/plaza/plaza-surround";

const W = PLAZA.width,
  H = PLAZA.height;
const noop = () => {};
const body = (x: number, y: number, name = "body") =>
  spot(x, y, 12, 84, noop, { sw: 44, name });
const names = (l: Drawable[]) => l.map((d) => d.name);

describe("Plaza depth: footprints, not one number each", () => {
  // A hurdle laid at a slant across the lane (-30°): its middle's y says
  // little about whether a runner at one end is behind it or in front.
  const [p0, p1] = PLAZA_HURDLE_SEGMENTS[0];
  const hurdle: Drawable = {
    x0: p0.x,
    y0: p0.y,
    x1: p1.x,
    y1: p1.y,
    line: true,
    h: PLAZA_SCALE.hurdle + 8,
    draw: noop,
    name: "hurdle",
  };
  const along = (t: number) => ({
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
  });

  it("a runner just behind a slanted hurdle is drawn under it, just in front over it", () => {
    for (const t of [0.15, 0.5, 0.85]) {
      const at = along(t);
      expect(order(body(at.x, at.y - 14), hurdle), `behind at ${t}`).toBe(-1);
      expect(order(body(at.x, at.y + 14), hurdle), `in front at ${t}`).toBe(1);
      expect(names(depthSort([hurdle, body(at.x, at.y - 14)]))).toEqual([
        "body",
        "hurdle",
      ]);
    }
    // The case a single number got wrong: behind the hurdle's near end but
    // with feet lower on screen than the hurdle's middle.
    const near = p0.y > p1.y ? p0 : p1,
      far = p0.y > p1.y ? p1 : p0,
      mid = (p0.y + p1.y) / 2;
    const b = body(near.x + (far.x - near.x) * 0.1, near.y - 12);
    expect(b.y1).toBeGreaterThan(mid);
    expect(order(b, hurdle)).toBe(-1);
  });

  it("someone in a goal's mouth stands between its far and near slices", () => {
    const goal = slices(1934, 1980, 835, 965, 6, PLAZA_SCALE.goal, noop).map(
      (d, i) => ({ ...d, name: `g${i}` }),
    );
    const sorted = names(depthSort([...goal, body(1975, 900, "me")]));
    const me = sorted.indexOf("me");
    expect(sorted.slice(0, me)).toEqual(["g0", "g1", "g2"]);
    expect(sorted.slice(me + 1)).toEqual(["g3", "g4", "g5"]);
  });

  it("a long food truck is behind someone at its front end, in front of someone behind its far end", () => {
    const truck: Drawable = {
      x0: 1615,
      x1: 1875,
      y0: 430,
      y1: 480,
      h: 190,
      draw: noop,
      name: "truck",
    };
    expect(names(depthSort([truck, body(1860, 490)]))).toEqual([
      "truck",
      "body",
    ]);
    expect(names(depthSort([body(1630, 425), truck]))).toEqual([
      "body",
      "truck",
    ]);
  });

  it("the order is stable, and trees still go by their trunks", () => {
    const tree = spot(500, 500, 18, 200, noop, { sw: 87, name: "tree" });
    expect(names(depthSort([tree, body(530, 480)]))).toEqual(["body", "tree"]);
    expect(names(depthSort([body(530, 520), tree]))).toEqual(["tree", "body"]);
    const crowd = Array.from({ length: 30 }, (_, i) =>
      body(400 + (i % 6) * 20, 400 + Math.floor(i / 6) * 9, `b${i}`),
    );
    expect(names(depthSort(crowd))).toEqual(
      names(depthSort(crowd.slice().reverse())),
    );
  });
});

describe("Plaza surroundings", () => {
  it("is all outside where anyone can walk", () => {
    for (const p of SURROUND)
      expect(onWalkable(p.x, p.y, 40), `${p.kind} at ${p.x},${p.y}`).toBe(
        false,
      );
    for (const c of COWS) {
      expect(onWalkable(c.x, c.y, 40)).toBe(false);
      expect(c.x).toBeGreaterThan(FARM.paddock.x0);
      expect(c.x).toBeLessThan(FARM.paddock.x1);
    }
    // Nothing the server collides with lies out there (the rules are unchanged).
    for (const o of PLAZA_OBSTACLES) expect(o.y).toBeLessThan(H);
  });

  it("anything baked under everyone can never be over someone standing behind it", () => {
    expect(BAKED.length).toBeGreaterThan(60);
    for (const p of BAKED)
      expect(coversMovers(propBox(p)), `${p.kind} at ${p.x},${p.y}`).toBe(
        false,
      );
    // The rest is drawn live in depth order: a few bushes at the woods' edge.
    expect(LIVE.length).toBeLessThan(25);
    for (const p of LIVE) expect(["bush", "rock"]).toContain(p.kind);
  });

  it("checks the baking rule against real positions", () => {
    // A tree right by the west edge reaches over someone standing behind it.
    expect(
      coversMovers(propBox({ kind: "tree", x: -40, y: 900, s: 1, v: 0 })),
    ).toBe(true);
    // A barn far into the farm never does; nor does the far bank.
    expect(
      coversMovers(propBox({ kind: "barn", x: 700, y: 1935, s: 1, v: 0 })),
    ).toBe(false);
    expect(
      coversMovers(
        propBox({ kind: "tree", x: 900, y: RIVER.y0 - 30, s: 1.2, v: 0 }),
      ),
    ).toBe(false);
    // Through the farm gate you walk 30 px further south.
    const g = PLAZA_REACH.y1(1350);
    expect(coversMovers({ x0: 1340, x1: 1360, top: g + 4, foot: g + 40 })).toBe(
      true,
    );
    expect(coversMovers({ x0: 1700, x1: 1720, top: g + 4, foot: g + 40 })).toBe(
      false,
    );
  });

  it("each baked picture lies wholly in the strips (none cut at the Plaza's edge)", () => {
    for (const p of BAKED) {
      const b = propBox(p);
      const inside = b.x1 > 0 && b.x0 < W && b.foot + 12 > 0 && b.top < H;
      expect(inside, `${p.kind} at ${p.x},${p.y}`).toBe(false);
      expect(b.x0).toBeGreaterThan(-PLAZA_MARGIN - 160);
      expect(b.x1).toBeLessThan(W + PLAZA_MARGIN + 160);
    }
  });

  it("no tree stands in front of the barn, the windmill or the well", () => {
    const marks = SURROUND.filter((p) => LANDMARKS.includes(p.kind));
    expect(marks.length).toBe(3);
    for (const a of SURROUND)
      for (const m of marks)
        if (a !== m)
          expect(
            hidesLandmark(a, m),
            `${a.kind} at ${a.x},${a.y} hides the ${m.kind}`,
          ).toBe(false);
  });

  it("the river has lamps on its far bank and runs the whole width", () => {
    expect(RIVER_LAMPS.length).toBeGreaterThan(6);
    expect(RIVER.y1).toBeLessThan(0);
    expect(RIVER.y0 - 20).toBeGreaterThan(-PLAZA_OUT.n - 40);
  });
});

describe("Plaza camera: never past what is built", () => {
  const screens: [number, number][] = [
    [667, 375],
    [844, 390],
    [932, 430],
    [1280, 800],
    [1440, 900],
    [2560, 1080],
    [3840, 1600],
    [5120, 2880],
  ];
  it("the view stays inside the painted surroundings wherever you stand", () => {
    expect(Math.max(...Object.values(PLAZA_OUT))).toBeLessThan(PLAZA_MARGIN);
    for (const [nw, nh] of screens) {
      const z = plazaZoom(nw, nh);
      expect(z).toBeGreaterThanOrEqual(0.66);
      for (const [x, y] of [
        [0, 0],
        [W, H],
        [-500, H + 500],
        [W / 2, H / 2],
        [W + 900, -900],
      ]) {
        const c = plazaCamClamp(x, y, nw, nh, z);
        const hw = nw / 2 / z,
          hh = nh / 2 / z;
        expect(c.x - hw).toBeGreaterThanOrEqual(-PLAZA_OUT.w - 0.01);
        expect(c.x + hw).toBeLessThanOrEqual(W + PLAZA_OUT.e + 0.01);
        expect(c.y - hh).toBeGreaterThanOrEqual(-PLAZA_OUT.n - 0.01);
        expect(c.y + hh).toBeLessThanOrEqual(H + PLAZA_OUT.s + 0.01);
      }
    }
  });
  it("phones see as much as before (zoom 0.66), desktops 1", () => {
    expect(plazaZoom(844, 390)).toBe(0.66);
    expect(plazaZoom(1280, 800)).toBe(1);
  });
  it("at an edge you are no longer pressed against the side of the screen", () => {
    const z = plazaZoom(844, 390);
    const c = plazaCamClamp(PLAZA_REACH.x0, PLAZA_REACH.y0, 844, 390, z);
    // Before, the camera stopped at the map's edge: you stood 30 px from it.
    expect(PLAZA_REACH.x0 - (c.x - 844 / 2 / z)).toBeGreaterThan(200);
  });
});

describe("Plaza: one scale for everything", () => {
  it("doors, goals, lamps and hurdles are sized against a fighter", () => {
    const B = PLAZA_SCALE.body;
    expect(PLAZA_SCALE.houseDoor * PLAZA_SCALE.house).toBeGreaterThanOrEqual(B);
    expect(PLAZA_SCALE.houseWall * PLAZA_SCALE.house).toBeGreaterThanOrEqual(
      B * 1.8,
    );
    expect(PLAZA_SCALE.goal).toBeGreaterThan(B);
    expect(110 * PLAZA_SCALE.lamp).toBeGreaterThanOrEqual(B * 1.6);
    // A jump (42 px high) clears a hurdle's bar.
    expect(PLAZA_SCALE.hurdle).toBeLessThan(PLAZA.jump.height);
    // The mover box used for the baking rule holds a whole fighter and a bounce.
    expect(MOVER_BOX.up).toBeGreaterThanOrEqual(84 + PLAZA.pad.height);
  });
  it("the stone paths never run through something you bump into", () => {
    // (A path may end at a door or a seat: only its middle is checked.)
    const hits: string[] = [];
    for (const { pts } of PLAZA_PATHS)
      for (let i = 0; i < pts.length - 1; i++)
        for (let k = 0.2; k <= 0.8; k += 0.1) {
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
            y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
          for (const o of PLAZA_OBSTACLES) {
            const d = Math.hypot(x - o.x, (y - o.y) * (o.sy ?? 1));
            if (d < o.r * 0.6) hits.push(`${Math.round(x)},${Math.round(y)}`);
          }
        }
    expect(hits).toEqual([]);
    expect(PLAZA_TRACK.ro[0]).toBeGreaterThan(0);
  });
});
