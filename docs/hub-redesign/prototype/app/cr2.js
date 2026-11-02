const { chromium, devices } = require('./pw');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await p.tap('.tap-play .go'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(900);
  await p.evaluate(() => { const { F, CROPS } = __FM._dbg; F.plots.forEach(pl => pl.locked = false); CROPS.forEach((c, k) => Object.assign(F.plots[k], { crop: c.id, prog: k % 4 === 3 ? .7 : 1, mut: [], pests: 0 })); Object.assign(F.plots[30], { crop: null, prog: 0 }); __FM._dbg.CROPS.forEach(c => F.seeds[c.id] = 2); });
  await p.waitForTimeout(800); await p.screenshot({ path: 'cr2-phone.png' });
  const c = await p.evaluate(() => __FM._dbg.plotClient(30)); await p.tap(`#fm-cv`, { position: { x: 1, y: 1 } }).catch(() => { }); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); await p.screenshot({ path: 'cr2-picker.png' });
  console.log('errs', JSON.stringify(errs)); await b.close(); })();
