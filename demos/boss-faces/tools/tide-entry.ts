// Bundled into src/tide-rig.js by tools/build-tide.sh: the game's own
// Tidewyrm rig (apps/client/src/boss-vector-tide.ts), wrapped for the demo.
import {
  TIDE_FACE,
  tideEyes,
  tidePieces,
  tidePlacements,
  tidePose,
  tideProject,
} from "../../../apps/client/src/boss-vector-tide";

declare const KIT: any;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function pose(c: any) {
  const stranded = !!(c.exposed || c.stagger);
  const P: any = tidePose({
    clock: c.clock,
    phase: c.phase,
    reduced: !!c.reduced,
    windKind: c.windKind,
    windup: c.windup || 0,
    castKind: c.castKind,
    castAge: c.castAge === undefined ? 99 : c.castAge,
    stranded,
    stagger: !!c.stagger,
    hurt: c.hurt || 0,
    dead: !!c.dead,
    rise: 1,
    deathSink: c.dead ? smooth(0, 1.2, c.deadAge === undefined ? 9 : c.deadAge) : 0,
    roarAge: c.roarAge === undefined ? 99 : c.roarAge,
  });
  // the game's rig file eases these; the demo sets them outright
  P.flat = stranded && !c.dead ? 1 : 0;
  P.spin = 0;
  P.look = P.dizzy > 0.5 ? "dizzy" : P.closed > 0.5 || P.lid > 0.92 ? "shut" : P.lid > 0.55 ? "squint" : P.anger > 0.9 && P.lid < 0.15 ? "wide" : "glare";
  P.mouth = P.jaw > 0.3 ? "open" : "closed";
  return P;
}
function placements(P: any, yaw: number, phase: 1 | 2 | 3) {
  const dry = P.flat > 0.5;
  const r = tidePlacements(P, yaw, phase, () => (dry ? null : 0));
  const headZ = r.head.w.z;
  const list: any[] = r.placements.map((p) => ({ ...p, face: /^(eye|cran|brow|snout|jaw|mouth|fang|nostril)/.test(p.key) }));
  for (const l of r.lines)
    list.push({ line: l.pts, color: l.color, width: l.width, z: l.front ? headZ + 0.07 : headZ - 0.6 + 0.0005, face: true });
  list.sort((a, b) => a.z - b.z);
  // the construction, for the model sheet
  const { F, at } = r.head;
  const headYaw = Math.atan2(F.x, F.z);
  const e = tideEyes(headYaw);
  const axis = tideProject(at(0, 0, 9));
  const turn = Math.abs(Math.atan2(Math.sin(headYaw), Math.cos(headYaw)));
  const pf = turn - TIDE_FACE.lag * Math.sin(2 * Math.min(turn, Math.PI / 2));
  const cu = (e.view === "side" ? 1 : Math.sin(e.view === "front" ? pf * (headYaw < 0 ? -1 : 1) : pf)) * 26 * e.side;
  const guide =
    e.view === "back"
      ? null
      : {
          centre: [{ x: axis.x + cu * 0.7, y: axis.y - 34 }, { x: axis.x + cu, y: axis.y }, { x: axis.x + cu * 1.25, y: axis.y + 30 }],
          eyeLine: [{ x: axis.x - 40, y: axis.y }, { x: axis.x + 40, y: axis.y }],
          others: [],
          eyes: r.placements.filter((p) => /^eye-?1$/.test(p.key)).map((p) => ({ x: p.x, y: p.y })),
        };
  return {
    placements: list,
    heads: [{ x: axis.x, y: axis.y, view: e.view === "back" ? (turn > 2.75 ? "back" : "backtq") : e.view, side: headYaw < 0 ? -1 : 1, guide, marks: { top: -40, eye: 0, bot: 44 } }],
    shadows: [[0, 0, 70, 20]],
  };
}
export const boss = {
  id: "tidewyrm",
  title: "Tidewyrm",
  lede: "The water dragon that is already in the game. Its eye used to be one drawing squeezed sideways by the turn; it now has a front, a near, a far and a side drawing on one eye line. The far eye is drawn cut by the bridge of the snout.",
  attacks: [["dive", "Dive"], ["wave", "Tidal Wave"], ["bubbles", "Bubbles"], ["hightide", "High Tide"], ["undertow", "Undertow"], ["prison", "Water Prison"]],
  pose,
  placements,
  pieces: tidePieces,
  faces: [] as any[],
  face: TIDE_FACE,
  tideEyes,
  looks: ["glare", "wide", "squint", "shut", "dizzy"],
  mouths: ["closed"],
  stage: { w: 460, h: 330, ground: 0.8, closeW: 150, closeH: 120, sheetGap: 300, sheetH: 300, closeGap: 110, closeSheetH: 120, champion: [-170, 40], shadow: [70, 20], floor: ["#06141c", "#0c2a38", "120,220,255"] },
  occluder: "the bridge of the snout, drawn into the far eye's own drawing",
};
