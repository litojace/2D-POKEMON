// Numeric checks of the face rules, over every yaw and the extremes of nod and roll.
const G = new Function(require('fs').readFileSync(require('path').join(__dirname, '../src/gloom-rig.js'),'utf8') + '; return GLOOM;')();
const { FACE, DEG } = G; let bad = 0, n = 0; const say = (m) => { if (bad++ < 12) console.log('FAIL', m); };
const pieces = new Map(G.gloomPieces(1).map(p => [p.name, p]));
const heights = {};
for (let yaw = -180; yaw <= 180; yaw += 0.5) for (const pitch of [-0.45, 0, 0.45]) for (const roll of [0, 0.3]) for (const look of ['idle', 'glare', 'wide', 'hurt', 'dizzy', 'closed']) for (const mouth of look === 'idle' ? G.MOUTHS : ['smile']) {
  const r = G.gloomFace({ x: 0, y: 0, yaw: yaw * DEG, pitch, roll, z: 0 }, { look, mouth });
  const { view, side } = G.headView(yaw * DEG);
  const c = Math.cos(-roll), s = Math.sin(-roll);
  for (const p of r.placements) {
    n++;
    if (!pieces.has(p.piece)) say('missing piece ' + p.piece);
    if (view === 'back' || view === 'backtq') { if (p.piece !== 'head_' + view) say('face from behind ' + p.piece); continue; }
    // back to head space, canonical side
    const u = (p.x * c - p.y * s) * side, v = p.x * s + p.y * c;
    const m = p.piece.match(/^eye_(\w+?)_/);
    if (m) {
      const g = FACE.eye[m[1]];
      const nod = pitch * FACE.nod;
      if (Math.abs(v - (FACE.eyeLine + nod)) > 1e-6) say(`eye off the eye line yaw ${yaw}`);
      for (const dv of [-g.hh * 0.7, 0, g.hh * 0.7]) {
        const [l, rr] = G.skullEdge(view, v + dv);
        if (u - g.hw < l + FACE.margin - 1e-6 || u + g.hw > rr - FACE.margin + 1e-6) say(`eye outside outline yaw ${yaw} view ${view} u ${u.toFixed(1)} [${l.toFixed(1)}, ${rr.toFixed(1)}]`);
      }
      const rot = (p.rot - roll) * side;
      const want = m[1] === 'far' ? -FACE.farLift : 0;
      if (Math.abs(rot - want) > 1e-9) say(`eye tilt ${rot} yaw ${yaw}`);
      if (pitch === 0 && roll === 0) (heights[view] = heights[view] || new Set()).add(v.toFixed(4));
    } else if (!/^glint|^glow/.test(p.piece) && Math.abs(Math.abs(p.rot - roll)) > 1e-9 && !/^brow_far/.test(p.piece)) say(`tilted ${p.piece} yaw ${yaw}`);
    if (p.piece === 'glint' && p.sx < 0) say('mirrored highlight');
  }
  // three-quarter order: near eye, gap, bridge, far eye
  if (view === 'tq' && pitch === 0 && roll === 0 && look === 'idle' && mouth === 'smile') {
    const f = (k) => r.placements.find(p => p.key === k);
    const near = f('f-eyen').x * side, far = f('f-eyef').x * side;
    const bridge = G.centreLine(FACE.eyeLine) * Math.sin(G.faceYaw(Math.abs(yaw) * DEG));
    const gap = bridge - (near + FACE.eye.near.hw);
    const tuck = bridge + 1 - (far - FACE.eye.far.hw);
    if (gap < 4) say(`near eye crowds the bridge at ${yaw}: gap ${gap.toFixed(1)}`);
    if (far - near < FACE.eye.near.hw + FACE.eye.far.hw) say(`eyes too close at ${yaw}`);
    if (Math.abs(yaw) === 45 || Math.abs(yaw) === 30 || Math.abs(yaw) === 60) console.log(`yaw ${yaw}: near eye ${near.toFixed(1)}, bridge ${bridge.toFixed(1)}, far eye ${far.toFixed(1)} | clear gap ${gap.toFixed(1)}, far eye tucked ${tuck.toFixed(1)} of ${FACE.eye.far.hw * 2}`);
  }
}
console.log('eye heights per view (no nod):', Object.fromEntries(Object.entries(heights).map(([k, v]) => [k, [...v]])));
console.log(`${n} placements checked, ${bad} failures`);
