// node tools/check-face.cjs
// Checks the face rules for every boss, over every half-degree of yaw, the
// extremes of nod and roll, and every look and mouth.
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const KIT = new Function(src('kit.js') + '; return KIT;')();
const RIGS = [['gloom-rig.js', 'GLOOM'], ['somnara-rig.js', 'SOMNARA'], ['prisma-rig.js', 'PRISMA'], ['ember-rig.js', 'EMBER'], ['twins-rig.js', 'TWINS'], ['tide-rig.js', 'TIDE']]
  .filter(([f]) => fs.existsSync(path.join(__dirname, '../src', f)));
const DEG = KIT.DEG;
let total = 0, failures = 0;
for (const [file, name] of RIGS) {
  const boss = new Function('KIT', src(file) + `; return ${name};`)(KIT).boss;
  const pieces = new Set(boss.pieces(1).map(p => p.name));
  boss.faces.forEach((fk, fi) => {
    const F = fk.spec; let bad = 0, n = 0;
    const who = boss.title + (boss.faces.length > 1 ? ' / ' + boss.faceNames[fi] : '');
    const say = (m) => { if (bad++ < 6) console.log('  FAIL', m); };
    const heights = {};
    for (let yaw = -180; yaw <= 180; yaw += 0.5) for (const pitch of [-0.45, 0, 0.45]) for (const roll of [0, 0.3]) for (const look of boss.looks) for (const mouth of look === boss.looks[0] ? boss.mouths : [boss.mouths[0]]) {
      const r = fk.face({ x: 0, y: 0, yaw: yaw * DEG, pitch, roll, z: 0 }, { look, mouth, variant: fi, eyeGlow: 0.3, gemGlow: 0.5 });
      const view = r.view, side = r.side;
      const c = Math.cos(-roll), s = Math.sin(-roll);
      for (const p of r.placements) {
        n++;
        if (!pieces.has(p.piece)) say('missing piece ' + p.piece);
        if (view === 'back' || view === 'backtq') { if (r.placements.length !== 1) say('face from behind: ' + p.piece); continue; }
        const u = (p.x * c - p.y * s) * side, v = p.x * s + p.y * c;
        const m = p.piece.match(/eye_(front|near|far|side)_/);
        if (m) {
          const g = F.eye[m[1]];
          if (Math.abs(v - (F.lines.eye + pitch * F.nod)) > 1e-6) say(`eye off the eye line at ${yaw}`);
          for (const dv of [-g.hh * 0.7, 0, g.hh * 0.7]) {
            const [l, rr] = F.skullEdge(view, v + dv);
            if (u - g.hw < l + F.margin - 1e-6 || u + g.hw > rr - F.margin + 1e-6) say(`eye outside the outline at ${yaw} (${view}): ${u.toFixed(1)} in [${l.toFixed(1)}, ${rr.toFixed(1)}]`);
          }
          const rot = (p.rot - roll) * side, want = m[1] === 'far' ? -F.farLift : 0;
          if (Math.abs(rot - want) > 1e-9) say(`eye tilted ${rot} at ${yaw}`);
          if (pitch === 0 && roll === 0) (heights[view] = heights[view] || new Set()).add(v.toFixed(3));
        } else if (!/glint|glow/.test(p.piece) && !/brow_far/.test(p.piece) && Math.abs(p.rot - roll) > 1e-9) say(`tilted ${p.piece} at ${yaw}`);
        if (/glint/.test(p.piece) && p.sx < 0) say('mirrored highlight');
      }
      if (view === 'tq' && pitch === 0 && roll === 0 && look === boss.looks[0] && mouth === boss.mouths[0]) {
        const near = r.eyes.find(e => e.id === 'n'), far = r.eyes.find(e => e.id === 'f');
        if (far.u - near.u < near.g.hw + far.g.hw) say(`eyes overlap at ${yaw}`);
        const hidden = Math.max(0, r.bridge - (far.u - far.g.hw)) / (2 * far.g.hw);
        // at the resting facing the far eye keeps its cap; nearer profile the outline may press it further
        if (F.tuckCap !== undefined && Math.abs(yaw) === 45 && hidden > F.tuckCap + 1e-6) say(`far eye ${Math.round(hidden * 100)}% hidden at ${yaw}`);
        if (yaw === 30 || yaw === 45 || yaw === 60)
          console.log(`  ${who} ${yaw}°: near eye ${near.u.toFixed(1)}, bridge ${r.bridge.toFixed(1)}, far eye ${far.u.toFixed(1)}; clear gap ${(r.bridge - near.u - near.g.hw).toFixed(1)}, far eye hidden ${Math.round(hidden * 100)}%`);
      }
    }
    const hs = Object.entries(heights).map(([k, v]) => `${k} ${[...v].join('/')}`).join(', ');
    console.log(`${who}: ${n} placements, ${bad} failures; eye height by view: ${hs}`);
    total += n; failures += bad;
  });
}
console.log(`${total} placements checked, ${failures} failures`);
process.exit(failures ? 1 : 0);
