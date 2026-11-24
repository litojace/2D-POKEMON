import { describe, expect, it } from "vitest";
import {
  PLAZA,
  PLAZA_BENCHES,
  PLAZA_BUSHES,
  PLAZA_FLOODLIGHTS,
  PLAZA_GATE,
  PLAZA_HOUSES,
  PLAZA_LAMPS,
  PLAZA_LANDINGS,
  PLAZA_PATHS,
  PLAZA_PHOTO,
  PLAZA_PHOTO_CAMERA,
  PLAZA_PITCH,
  PLAZA_POND,
  PLAZA_ROCKS,
  PLAZA_TRACK,
  PLAZA_TREES,
  PLAZA_SQUARE,
  PLAZA_WALK,
  plazaPathGap,
  segmentDistance,
} from "../../packages/shared/src/plaza";

// Scenery stands where it makes sense: not on the dash track's lane, the
// pitch, the pond, a path or the fence, and not on top of each other.
const inEllipse = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const onLane = (x: number, y: number, r: number) => {
  const T = PLAZA_TRACK;
  return (
    inEllipse(x, y, T.cx, T.cy, T.ro[0] + r, T.ro[1] + r) &&
    !inEllipse(x, y, T.cx, T.cy, T.ri[0] - r, T.ri[1] - r)
  );
};
const onPitch = (x: number, y: number, r: number) =>
  x > PLAZA_PITCH.x0 - r &&
  x < PLAZA_PITCH.x1 + r &&
  y > PLAZA_PITCH.y0 - r &&
  y < PLAZA_PITCH.y1 + r;
const inPond = (x: number, y: number, r: number) =>
  inEllipse(
    x,
    y,
    PLAZA_POND.x,
    PLAZA_POND.y,
    PLAZA_POND.rx + 30 + r,
    PLAZA_POND.ry + 30 + r,
  );
const scenery = [
  ...PLAZA_TREES.map((t) => ({
    what: `tree at ${t.x},${t.y}`,
    x: t.x,
    y: t.y,
    r: 22,
  })),
  ...PLAZA_LAMPS.map((l) => ({
    what: `lamp at ${Math.round(l.x)},${Math.round(l.y)}`,
    x: l.x,
    y: l.y,
    r: 10,
  })),
  ...PLAZA_BUSHES.map((b) => ({
    what: `bush at ${Math.round(b.x)},${Math.round(b.y)}`,
    x: b.x,
    y: b.y,
    r: b.size / 2,
  })),
  ...PLAZA_ROCKS.map((b) => ({
    what: `rock at ${Math.round(b.x)},${Math.round(b.y)}`,
    x: b.x,
    y: b.y,
    r: b.size / 2,
  })),
];

describe("the Plaza's layout", () => {
  it("keeps trees, lamps, bushes and rocks off the lane, pitch, pond and fence", () => {
    const wrong = scenery.filter(
      (s) =>
        onLane(s.x, s.y, s.r) ||
        onPitch(s.x, s.y, s.r) ||
        inPond(s.x, s.y, s.r) ||
        s.y + s.r > PLAZA_GATE.y ||
        s.x - s.r < 0 ||
        s.x + s.r > PLAZA.width,
    );
    expect(wrong.map((s) => s.what)).toEqual([]);
  });

  it("keeps the paths clear: no bench, lamp, bush, rock or tree on the stones", () => {
    const blocking = [
      // A lamp post is thin: lamps may line a path's edge, not stand on it.
      ...scenery.map((s) => (s.what.startsWith("lamp") ? { ...s, r: 0 } : s)),
      // A bench is 80 px long: both ends and its middle.
      ...PLAZA_BENCHES.flatMap((b) =>
        [-40, 0, 40].map((dx) => ({
          what: `bench at ${b.x},${b.y}`,
          x: b.x + dx,
          y: b.y,
          r: 0,
        })),
      ),
    ].filter((s) => plazaPathGap(s.x, s.y).gap < s.r);
    expect([...new Set(blocking.map((s) => s.what))]).toEqual([]);
    expect(PLAZA_PATHS.length).toBeGreaterThan(5);
  });

  it("doesn't stack scenery on top of itself", () => {
    const round = [
      ...scenery,
      ...PLAZA_BENCHES.map((b) => ({
        what: `bench at ${b.x},${b.y}`,
        x: b.x,
        y: b.y,
        r: 40,
      })),
      ...PLAZA_FLOODLIGHTS.map((f) => ({
        what: `floodlight at ${f.x},${f.y}`,
        x: f.x,
        y: f.y,
        r: 12,
      })),
    ];
    const clash: string[] = [];
    round.forEach((a, i) =>
      round.slice(i + 1).forEach((b) => {
        if (Math.hypot(a.x - b.x, (a.y - b.y) * 1.3) < (a.r + b.r) * 0.8)
          clash.push(`${a.what} / ${b.what}`);
      }),
    );
    expect(clash).toEqual([]);
  });
});

describe("the Plaza's paths", () => {
  // Every path end arrives somewhere: on another path, in a paved landing,
  // at a house's door, or at a place drawn over it (the square, the runway,
  // the pitch, the track, the pond, the gate, the event board). None stops
  // in a round stub on the grass.
  const arrives = (x: number, y: number, self: number) =>
    PLAZA_PATHS.some(
      (p, i) =>
        i !== self &&
        p.pts.slice(1).some((b, k) => {
          const a = p.pts[k];
          return (
            segmentDistance(x, y, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }) <
            p.w / 2
          );
        }),
    ) ||
    PLAZA_LANDINGS.some(
      (l) => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 < 1,
    ) ||
    PLAZA_HOUSES.some(
      (h) => Math.abs(x - h.x) < 40 && Math.abs(y - h.y) < 40,
    ) ||
    ((x - PLAZA_SQUARE.x) / PLAZA_SQUARE.rx) ** 2 +
      ((y - PLAZA_SQUARE.y) / PLAZA_SQUARE.ry) ** 2 <
      1.1 ||
    (Math.abs(x - (PLAZA_WALK.x0 + PLAZA_WALK.x1) / 2) < 60 &&
      Math.abs(y - PLAZA_WALK.y1) < 30) ||
    (x >= PLAZA_PITCH.x0 && Math.abs(y - PLAZA_SQUARE.y) < 60) ||
    ((x - PLAZA_TRACK.cx) / PLAZA_TRACK.ro[0]) ** 2 +
      ((y - PLAZA_TRACK.cy) / PLAZA_TRACK.ro[1]) ** 2 <
      1.12 ||
    ((x - PLAZA_POND.x) / (PLAZA_POND.rx + 10)) ** 2 +
      ((y - PLAZA_POND.y) / (PLAZA_POND.ry + 50)) ** 2 <
      1 ||
    (Math.abs(x - PLAZA_GATE.x) < 60 && y >= PLAZA_GATE.y) ||
    Math.hypot(x - 1080, y - 1255) < 40;
  it("end where they arrive somewhere, not as stubs on the grass", () => {
    const stubs = PLAZA_PATHS.flatMap((p, i) =>
      [p.pts[0], p.pts[p.pts.length - 1]]
        .filter(([x, y]) => !arrives(x, y, i))
        .map(([x, y]) => `${x},${y}`),
    );
    expect(stubs).toEqual([]);
  });
  it("leave the Photo Spot's camera on its own feet, clear of the arch", () => {
    for (const post of [PLAZA_PHOTO.x - 80, PLAZA_PHOTO.x + 80])
      expect(
        Math.hypot(
          PLAZA_PHOTO_CAMERA.x - post,
          PLAZA_PHOTO_CAMERA.y - PLAZA_PHOTO.y,
        ),
      ).toBeGreaterThan(60);
    // In front of the arch (nearer the viewer), so it points at the spot.
    expect(PLAZA_PHOTO_CAMERA.y).toBeGreaterThan(PLAZA_PHOTO.y + 60);
  });
});
