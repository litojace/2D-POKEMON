// Dog path check: record positions for a while (including a crow chase) and verify it only crosses the fence at the gate
const { chromium } = require('./pw');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await (await p.$('#frame')).scrollIntoViewIfNeeded();
  await p.click('#sc-farm'); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__trace = []; const D = __FM._dbg; setInterval(() => window.__trace.push([D.dog.x, D.dog.y, D.inField(D.dog.x, D.dog.y), D.blocked(D.dog.x, D.dog.y, D.inField(D.dog.x, D.dog.y))]), 50); });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { __FM._dbg.dog.chase = 23; __FM._dbg.dog.wait = 0; });   // chase a crow on plot 23
  await p.waitForTimeout(26000);
  const r = await p.evaluate(() => { const t = window.__trace, FR = __FM._dbg.FR, gx = (FR.x0 + FR.x1) / 2; let cross = [], blockedHits = 0, inside = 0;
    for (let i = 1; i < t.length; i++) { if (t[i][2] !== t[i - 1][2]) cross.push(Math.round(t[i][0] - gx)); if (t[i][3]) blockedHits++; if (t[i][2]) inside++; }
    const where = t.filter(s => s[3]).slice(0, 6).map(s => [Math.round(s[0]), Math.round(s[1]), s[2]]); return { where, samples: t.length, fenceCrossings: cross, crossingsAwayFromGate: cross.filter(dx => Math.abs(dx) > 60).length, insideSamples: inside, blockedHits }; });
  console.log(JSON.stringify(r)); console.log('errs', JSON.stringify(errs)); await b.close(); })();
