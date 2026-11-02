// Route check: many random trips for the dog (outside↔outside, outside↔field) with every decoration slot filled.
// Every leg outside the field must stay off obstacles; the fence may only be crossed at the gate.
const { chromium } = require('./pw');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await p.click('#sc-farm'); await p.waitForTimeout(700);
  const r = await p.evaluate(() => { window.__bad = []; const D = __FM._dbg, F = D.F; F.decor = F.decor.map((d, k) => d || ["lamp", "planter", "bush6"][k % 3]); F.scarecrow = true; F.pasture = true;
    const G = D.GATE(), gx = G.out[0]; let bad = 0, legs = 0, fenceBad = 0, ms = 0, trips = 0, maxPts = 0; const rnd = (a, b) => a + Math.random() * (b - a);
    for (let t = 0; t < 300; t++) {
      let s, e, ins = Math.random() < .3; do { s = [rnd(0, 1760), rnd(300, 1080)]; } while (D.blocked(s[0], s[1], false));
      do { e = ins ? [rnd(D.FR.x0 + 60, D.FR.x1 - 60), rnd(D.FR.y0 + 50, D.FR.y1 - 40)] : [rnd(0, 1760), rnd(300, 1080)]; } while (!ins && D.blocked(e[0], e[1], false));
      D.dog.x = s[0]; D.dog.y = s[1]; const t0 = performance.now(); D.dogRoute(e[0], e[1], ins); ms = Math.max(ms, performance.now() - t0); trips++;
      const pts = [s, ...D.dog.path]; maxPts = Math.max(maxPts, pts.length);
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], c = pts[i], n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 4); legs++;
        for (let k = 1; k < n; k++) { const x = a[0] + (c[0] - a[0]) * k / n, y = a[1] + (c[1] - a[1]) * k / n, inA = D.inField(a[0], a[1]), inC = D.inField(c[0], c[1]);
          if (inA !== inC) { if (Math.abs(x - gx) > 40) { fenceBad++; break; } continue; }   // gate leg
          if (D.blocked(x, y, inA && inC)) { bad++; if (window.__bad.length < 8) window.__bad.push({ a: a.map(Math.round), c: c.map(Math.round), at: [Math.round(x), Math.round(y)], i, n: pts.length, s: s.map(Math.round), e: e.map(Math.round), ins }); break; } } }
    }
    return { trips, legs, legsThroughObstacles: bad, fenceCrossAwayFromGate: fenceBad, slowestRouteMs: +ms.toFixed(1), maxWaypoints: maxPts, bad: window.__bad }; });
  console.log(JSON.stringify(r)); console.log('errs', JSON.stringify(errs)); await b.close(); })();
