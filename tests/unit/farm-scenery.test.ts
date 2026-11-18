import { describe, expect, it } from "vitest";
import {
  COOP,
  DOGH,
  FCX,
  FR,
  PAST,
  PERSON_PX,
  POND,
  PX_PER_M,
  WELL,
  WH,
  WORLD,
  WW,
  onPath,
  roadY,
  trunks,
  type Rect,
} from "../../apps/client/src/farm/farm-layout";
import {
  along,
  depthSort,
  order,
  screenBox,
  type Drawable,
} from "../../apps/client/src/farm/farm-depth";
import {
  BRIDGE,
  BROOK,
  BROOK_DUCKS,
  FARM_AREA,
  FIELDS,
  LIVE_KINDS,
  PROPS,
  brookY,
  coversLive,
  fitZoom,
  foot,
  heightPx,
  hidesPlace,
  inWater,
  liveSamples,
  onAnyPath,
  propDrawable,
  splitProps,
  tractorAt,
  tractorBox,
  zoomMin,
} from "../../apps/client/src/farm/farm-scenery";
import {
  DOG_SPOTS,
  blocked,
  dogRoute,
  type PathWorld,
} from "../../apps/client/src/farm/farm-path";

const nop = () => {};
const overlap = (a: Rect, b: Rect) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const rand = (seed: number) => {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};

describe("farm depth: footprints, not one y per thing", () => {
  it("puts every overlapping pair in its separating-plane order", () => {
    const r = rand(7);
    for (let round = 0; round < 40; round++) {
      // Things on the ground that never overlap (as things standing don't).
      const list: Drawable[] = [];
      for (let k = 0; k < 400 && list.length < 30; k++) {
        const x = r() * 900,
          y = r() * 600,
          w = 6 + r() * 120,
          d = 4 + r() * (r() < 0.2 ? 200 : 30);
        const it = {
          x0: x,
          x1: x + w,
          y0: y,
          y1: y + d,
          h: 20 + r() * 180,
          sw: r() < 0.3 ? w : 0,
          draw: nop,
        };
        if (list.every((o) => !overlap(o, it))) list.push(it);
      }
      const sorted = depthSort(list),
        at = new Map(sorted.map((d, i) => [d, i]));
      for (const a of list)
        for (const b of list) {
          if (a === b) continue;
          const sa = screenBox(a),
            sb = screenBox(b);
          if (!overlap(sa, sb)) continue;
          const o = order(a, b);
          if (o < 0) expect(at.get(a)!).toBeLessThan(at.get(b)!);
          if (o > 0) expect(at.get(a)!).toBeGreaterThan(at.get(b)!);
        }
    }
  });
  it("draws a cow beside the pasture's side behind the nearer posts, in front of the farther", () => {
    // The side rail, a piece per post, as the farm draws it.
    const side = along(PAST.x1, PAST.y0, PAST.y1, 42, 34, nop);
    const cow: Drawable = {
      x0: PAST.x1 - 60,
      x1: PAST.x1 - 4,
      y0: 520,
      y1: 530,
      h: 70,
      draw: nop,
    };
    const sorted = depthSort([...side, cow]),
      i = sorted.indexOf(cow);
    for (const piece of side) {
      const j = sorted.indexOf(piece);
      if (piece.y0 >= cow.y1) expect(j).toBeGreaterThan(i);
      if (piece.y1 <= cow.y0) expect(j).toBeLessThan(i);
    }
    // The pieces cover the side from end to end.
    expect(side[0].y0).toBe(PAST.y0);
    expect(side[side.length - 1].y1).toBe(PAST.y1);
    side.slice(1).forEach((p, k) => expect(p.y0).toBe(side[k].y1));
  });
  it("puts a flat thing under what stands on it", () => {
    const nest: Drawable = {
      x0: 0,
      x1: 40,
      y0: 0,
      y1: 30,
      h: 0,
      flat: true,
      draw: nop,
    };
    const hen: Drawable = { x0: 10, x1: 30, y0: 10, y1: 20, h: 40, draw: nop };
    expect(depthSort([hen, nest])).toEqual([nest, hen]);
  });
});

describe("the land round the farm", () => {
  it("has things to see everywhere the camera can go", () => {
    // Every 160 px cell of the world outside the farm holds a field, the
    // brook, the road or something standing.
    const cell = 160;
    const empty: string[] = [];
    for (let x = WORLD.x0; x < WORLD.x1; x += cell)
      for (let y = WORLD.y0; y < WORLD.y1; y += cell) {
        const c = { x0: x, x1: x + cell, y0: y, y1: y + cell };
        if (overlap(c, { x0: 0, x1: WW, y0: 0, y1: WH })) continue;
        const dressed =
          FIELDS.some((f) => overlap(c, f)) ||
          PROPS.some((p) => overlap(c, foot(p))) ||
          [0.25, 0.5, 0.75].some((f) => {
            const px = x + cell * f;
            return (
              Math.abs(brookY(px) - (y + cell / 2)) < cell / 2 ||
              onPath(px, y + cell / 2)
            );
          });
        if (!dressed) empty.push(`${x},${y}`);
      }
    expect(empty).toEqual([]);
    expect(PROPS.length).toBeGreaterThan(80);
  });
  it("keeps everything off the farm, the paths, the road and the water", () => {
    for (const p of PROPS) {
      const f = foot(p);
      expect(overlap(f, FARM_AREA), p.id).toBe(false);
      expect(
        overlap(f, {
          x0: PAST.x0 - 40,
          x1: PAST.x1 + 44,
          y0: PAST.y0 - 40,
          y1: PAST.y1 + 30,
        }),
        p.id,
      ).toBe(false);
      expect(onAnyPath(f), p.id).toBe(false);
      expect(inWater(f), p.id).toBe(false);
      expect(f.x1 > WORLD.x0 && f.x0 < WORLD.x1, p.id).toBe(true);
    }
  });
  it("never stands two things in one place", () => {
    for (let i = 0; i < PROPS.length; i++)
      for (let j = i + 1; j < PROPS.length; j++)
        expect(
          overlap(foot(PROPS[i]), foot(PROPS[j])),
          `${PROPS[i].id} / ${PROPS[j].id}`,
        ).toBe(false);
  });
  it("never hides a place you tap behind something tall", () => {
    for (const p of PROPS) expect(hidesPlace(p), p.id).toBe(false);
  });
  it("bakes only what is never drawn over anything live", () => {
    const { baked, live } = splitProps();
    expect(baked.length + live.length).toBe(PROPS.length);
    // Most of it is baked into the ground: few pictures a frame.
    expect(baked.length).toBeGreaterThan(30);
    const samples = liveSamples();
    for (const p of baked) {
      expect(LIVE_KINDS.has(p.kind), p.id).toBe(false);
      expect(coversLive(p, samples), p.id).toBe(false);
    }
    // A tall thing just in front of the farm would cover the dog: live.
    const near = {
      ...PROPS.find((p) => p.kind === "bale")!,
      x: 900,
      y: WH + 40,
    };
    expect(coversLive(near, samples)).toBe(true);
  });
  it("keeps the tractor's road and the ducks' stretch of brook clear", () => {
    for (let t = 0; t < 128; t += 0.5) {
      const tr = tractorAt(t);
      if (!tr.on) continue;
      const b = tractorBox(tr.x, tr.y);
      if (tr.x > WORLD.x0 && tr.x < WORLD.x1)
        expect(onPath(tr.x, tr.y), `tractor at ${t}`).toBe(true);
      for (const p of PROPS)
        expect(overlap(b, foot(p)), `${p.id} at ${t}`).toBe(false);
    }
    expect(BROOK_DUCKS.x0).toBeGreaterThan(BRIDGE.x1 + 40);
    for (let x = BROOK_DUCKS.x0; x <= BROOK_DUCKS.x1; x += 10) {
      const duck = {
        x0: x - 22,
        x1: x + 22,
        y0: brookY(x) - 4,
        y1: brookY(x) + 6,
      };
      for (const p of PROPS) expect(overlap(duck, foot(p)), p.id).toBe(false);
      expect(Math.abs(brookY(x) + 6 - brookY(x))).toBeLessThan(BROOK.half);
    }
  });
  it("walks the dog round the trees' trunks, never through them", () => {
    const world: PathWorld = {
      field: FR,
      pasture: PAST,
      pond: POND,
      well: WELL,
      doghouse: DOGH,
      scarecrow: [288, 562],
      decor: [
        { x0: COOP.x0, x1: COOP.x1, y0: COOP.y0 - 6, y1: COOP.y1 + 4 },
        ...trunks(),
      ],
      gateX: FCX,
      width: WW,
      height: WH,
    };
    const solid = [...trunks(), ...PROPS.map(foot)];
    // Its own spots, and spots all over the farm (some by the trees).
    const r = rand(11),
      spots: [number, number][] = [
        ...DOG_SPOTS,
        [600, 1062],
        [690, 1040],
        [20, 1066],
        [90, 1040],
        [1690, 1010],
        [20, 380],
        [80, 420],
        [40, 230],
        [110, 200],
      ];
    while (spots.length < 40) {
      const p: [number, number] = [r() * WW, r() * WH];
      if (!blocked(world, p[0], p[1])) spots.push(p);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = 0; j < spots.length; j += 3) {
        const a = spots[i],
          b = spots[j];
        if (a === b || blocked(world, a[0], a[1]) || blocked(world, b[0], b[1]))
          continue;
        const route = [a, ...dogRoute(world, a, b, false)];
        for (let i = 1; i < route.length; i++) {
          const [x0, y0] = route[i - 1],
            [x1, y1] = route[i],
            n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
          for (let k = 0; k <= n; k++) {
            const x = x0 + ((x1 - x0) * k) / n,
              y = y0 + ((y1 - y0) * k) / n;
            for (const r of solid)
              if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)
                expect.fail(`${a} → ${b} through ${JSON.stringify(r)}`);
          }
        }
      }
  });
});

describe("one scale", () => {
  it("measures things people use against a person", () => {
    // A person is 80 px; things people use are drawn at 55 px a metre.
    expect(PERSON_PX / PX_PER_M).toBeGreaterThan(1.3);
    expect(PERSON_PX / PX_PER_M).toBeLessThan(1.6);
    expect(heightPx("mailbox")).toBeCloseTo(66, 0);
    // A tractor's cab stands about one and a half people tall; a bale is
    // below a person's shoulder; a beehive reaches a person's waist.
    expect(heightPx("tractor") / PERSON_PX).toBeGreaterThan(1.3);
    expect(heightPx("tractor") / PERSON_PX).toBeLessThan(1.8);
    expect(heightPx("bale") / PERSON_PX).toBeLessThan(0.9);
    expect(heightPx("hive") / PERSON_PX).toBeLessThan(0.65);
    // Every prop's picture is as tall as its kind says.
    for (const p of PROPS)
      if (
        !["tree", "bush", "rock", "flowers", "wall", "sunrow"].includes(p.kind)
      )
        expect(p.h, p.id).toBeCloseTo(heightPx(p.kind, p.s), 5);
    for (const p of PROPS.filter((q) => q.kind === "tree"))
      expect(p.h / PERSON_PX, p.id).toBeGreaterThan(1.5);
  });
});

describe("the camera", () => {
  it("zooms out only a little past the farm's fit, never past the world", () => {
    for (const [vw, vh] of [
      [1731, 800],
      [1280, 800],
      [1896, 800],
      [1280, 1150],
      [1280, 2771],
    ]) {
      const z = zoomMin(vw, vh);
      expect(z).toBeGreaterThanOrEqual(0.92 * fitZoom(vw, vh) - 1e-9);
      expect(vw / z).toBeLessThanOrEqual(WORLD.x1 - WORLD.x0 + 1e-6);
      expect(vh / z).toBeLessThanOrEqual(WORLD.y1 - WORLD.y0 + 1e-6);
    }
  });
  it("shows the road at the top and the brook at the bottom", () => {
    expect(roadY(WORLD.x0)).toBeGreaterThan(WORLD.y0);
    expect(brookY(FCX) + BROOK.half).toBeLessThan(WORLD.y1);
    const b = screenBox(propDrawable(PROPS[0]));
    expect(b.y1).toBeGreaterThan(b.y0);
  });
});
