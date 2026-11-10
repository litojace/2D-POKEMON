// Bundled into src/tide-rig.js by tools/build-tide.sh: the game's own
// Tidewyrm rig (apps/client/src/boss-vector-tide.ts), wrapped for the demo.
import {
  TIDE_FACE,
  TIDE_SPEC,
  tidePieces,
  tidePlacements,
  tidePose,
  tideProject,
} from "../../../apps/client/src/boss-vector-tide";
import { headView } from "../../../apps/client/src/boss-vector-face";

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
  const HEAD = /^(cran|eye|brow|muzzle|pearl$|jaw|snout)/;
  const list: any[] = r.placements.map((p) => ({ ...p, face: HEAD.test(p.key) }));
  for (const l of r.lines)
    list.push({ line: l.pts, color: l.color, width: l.width, z: l.front ? headZ + 0.07 : headZ - 0.6 + 0.0005, face: true });
  list.sort((a, b) => a.z - b.z);
  // the construction, for the model sheet: rebuilt from the head piece's place
  const { F } = r.head;
  const headYaw = Math.atan2(F.x, F.z);
  const cran = r.placements.find((p) => p.key === "cran");
  const hx = cran ? cran.x : r.headScreen.x, hy = cran ? cran.y : r.headScreen.y;
  const hv = headView(headYaw);
  const S = TIDE_SPEC;
  let guide: any = null;
  if (cran && hv.view !== "back" && hv.view !== "backtq") {
    const roll = cran.rot, cr = Math.cos(roll), sr = Math.sin(roll);
    const side = hv.view === "front" ? 1 : hv.side;
    const at = (u: number, v: number) => ({ x: hx + u * side * cr - v * sr, y: hy + u * side * sr + v * cr });
    let pf = TIDE_FACE.faceYaw(hv.turn);
    if (hv.view === "front") pf *= hv.side;
    const sinF = hv.view === "side" ? 1 : Math.sin(pf);
    const eyes = r.placements.filter((p) => /^eye-?1$/.test(p.key));
    const nod = eyes.length ? 0 : 0;
    const centre = [];
    for (let v = S.top + 1; v <= S.bot - 1; v += 2) centre.push(at(S.centreLine(v) * sinF, v + nod));
    const [l, rr] = S.skullEdge(hv.view, S.lines.eye);
    const line = (v: number, k = 1) => { const [a, b] = S.skullEdge(hv.view, v); return [at(a * k, v), at(b * k, v)]; };
    guide = { centre, eyeLine: [at(l, S.lines.eye), at(rr, S.lines.eye)], others: [line(S.lines.brow, 0.9), line(S.lines.nose, 0.9), line(S.lines.pearl, 0.9)], eyes: eyes.map((p) => ({ x: p.x, y: p.y })) };
  }
  return {
    placements: list,
    heads: [{ x: hx, y: hy, view: cran ? cran.piece.replace("head-", "") : hv.view, side: headYaw < 0 ? -1 : 1, guide, marks: { top: S.top, eye: S.lines.eye, bot: S.bot } }],
    shadows: [[0, 0, 70, 20]],
  };
}
export const boss = {
  id: "tidewyrm",
  title: "Tidewyrm",
  lede: "The water dragon that is already in the game, with its head redrawn: a rounded head with a short snout, sleepy slit eyes, pink ear fins and the pearl on its brow, one drawing per view. The snout's far edge tucks the far eye.",
  attacks: [["dive", "Dive"], ["wave", "Tidal Wave"], ["bubbles", "Bubbles"], ["hightide", "High Tide"], ["undertow", "Undertow"], ["prison", "Water Prison"]],
  pose,
  placements,
  pieces: tidePieces,
  faces: [] as any[],
  face: { ...TIDE_SPEC, eyeOrbit: TIDE_SPEC.eyeOrbit },
  tideFace: TIDE_FACE,
  looks: ["glare", "wide", "squint", "shut", "dizzy"],
  mouths: ["closed"],
  stage: { w: 460, h: 330, ground: 0.8, closeW: 130, closeH: 100, sheetGap: 300, sheetH: 300, closeGap: 110, closeSheetH: 120, champion: [-170, 40], shadow: [70, 20], floor: ["#06141c", "#0c2a38", "120,220,255"] },
  occluder: "muzzle-tq: the bridge and far side of the snout",
};
