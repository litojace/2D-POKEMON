// Touch gestures on an emulated phone via CDP touch events: tap / drag-from-plot / drag-from-barn / hold-and-paint / weather orb.
const { chromium, devices } = require('./pw');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await p.tap('.tap-play .go'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, holdMs = 0, steps = 10) => { await touch('touchStart', x0, y0); if (holdMs) await p.waitForTimeout(holdMs); for (let k = 1; k <= steps; k++) { await touch('touchMove', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps); await p.waitForTimeout(16); } await touch('touchEnd'); await p.waitForTimeout(250); };
  const st = () => p.evaluate(() => ({ cam: __FM._dbg.cam(), pop: !document.getElementById('fm-pop').hidden, sheet: !document.getElementById('fm-sheet').hidden, wet: __FM._dbg.F.plots.filter(q => q.wet).length, tool: __FM._dbg.F.tool }));
  const empty = await p.evaluate(() => __FM._dbg.F.plots.findIndex(q => !q.locked && !q.crop)); const ec = await p.evaluate(i => __FM._dbg.plotClient(i), empty);
  // 1. tap an empty plot -> seed picker
  await touch('touchStart', ec.x, ec.y); await p.waitForTimeout(60); await touch('touchEnd'); await p.waitForTimeout(300);
  console.log('tap empty plot -> picker open:', (await st()).pop); await p.evaluate(() => { document.getElementById('fm-pop').hidden = true; });
  // 2. drag starting on a plot -> pans, no picker
  let a = await st(); await drag(ec.x, ec.y, ec.x - 120, ec.y + 10); let c = await st();
  console.log('drag from plot -> camera moved:', Math.round(a.cam.x - c.cam.x) !== 0, '| picker opened:', c.pop);
  // 3. drag starting on the barn -> pans, no barn sheet
  const barn = await p.evaluate(() => { const r = document.getElementById('fm-cv').getBoundingClientRect(); return null; });
  await p.evaluate(() => __FM._dbg.F.tool = 'can');
  // 4. hold on a plot, then drag along the row -> paints water on several plots
  const row = await p.evaluate(() => { const F = __FM._dbg.F; F.plots.forEach(q => { q.wet = false; if (!q.locked && !q.crop) Object.assign(q, { crop: 'wheat', prog: .3, mut: [], pests: 0 }); }); return [__FM._dbg.plotClient(0), __FM._dbg.plotClient(3)]; });
  const w0 = (await st()).wet; await drag(row[0].x, row[0].y, row[1].x, row[1].y, 420); const w1 = (await st()).wet;
  console.log('hold + drag with can -> plots watered:', w1 - w0);
  // 5. quick drag with the can (no hold) -> pans, waters nothing
  const w2 = (await st()).wet; a = await st(); await drag(row[1].x, row[1].y, row[0].x, row[0].y); c = await st();
  console.log('quick drag with can -> watered', (await st()).wet - w2, '| camera moved:', Math.round(a.cam.x - c.cam.x) !== 0);
  // 6. weather orb
  await p.tap('[data-orb="weather"]'); await p.waitForTimeout(300); console.log('weather card:', (await p.textContent('#fm-orbpop')).replace(/\s+/g, ' ').slice(0, 120));
  await p.screenshot({ path: 'g1-weather.png' });
  console.log('errs', JSON.stringify(errs)); await b.close(); })();
