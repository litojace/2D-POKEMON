const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message + ' @' + (e.stack || '').split('\n')[1])); p.on('console', m => m.type() === 'error' && errs.push('CE ' + m.text()));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(1200);
  const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded();
  const shot = n => f.screenshot({ path: 'i-' + n + '.png' });
  await shot('lobby');
  // farm actions
  await p.click('#sc-farm'); await p.waitForTimeout(1200);
  const pc = i => p.evaluate(i => __FM._dbg.plotClient(i), i);
  const at = async i => { const c = await pc(i); await p.mouse.click(c.x, c.y); };
  await at(0); await at(2); await p.waitForTimeout(300);
  await at(13); await p.waitForTimeout(400); await shot('farm-seedpop');
  await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('fm-pop').hidden = true);
  await p.click('[data-tool="seed"]'); { const a = await pc(20), b2 = await pc(23); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b2.x, b2.y, { steps: 8 }); await p.mouse.up(); }
  await p.waitForTimeout(900); await shot('farm-after');
  await p.click('[data-sheet="shop"]'); await p.waitForTimeout(300); await shot('farm-shop');
  await p.click('[data-tab="tools"]'); await p.waitForTimeout(200); await shot('farm-tools');
  await p.click('[data-tab="dogs"]'); await p.waitForTimeout(200); await shot('farm-dogs');
  await p.click('[data-sheet="orders"]'); await p.waitForTimeout(200); await shot('farm-orders');
  await p.click('[data-sheet="market"]'); await p.waitForTimeout(200); await shot('farm-market');
  await p.click('[data-sheet="book"]'); await p.waitForTimeout(200); await shot('farm-book');
  await p.click('[data-sheet="friends"]'); await p.waitForTimeout(200); await p.click('[data-visit="1"]'); await p.waitForTimeout(600); await shot('farm-visit');
  await p.evaluate(() => { const d = window.__FMDBG; });
  await p.click('#fm-visit [data-home]');
  // plaza
  await p.click('#sc-plaza'); await p.waitForTimeout(800); await p.click('#pz-start');
  const m = await (await p.$('#pz-mini')).boundingBox();
  await p.mouse.click(m.x + m.width * (1350 / 2700), m.y + m.height * (400 / 1700)); await p.waitForTimeout(6000); await shot('plaza-runway');
  await p.mouse.click(m.x + m.width * (1010 / 2700), m.y + m.height * (540 / 1700)); await p.waitForTimeout(3500); await shot('plaza-photo-spot');
  await p.keyboard.press('e'); await p.waitForTimeout(900); await shot('plaza-photo');
  await p.keyboard.press('Escape');
  await p.mouse.click(m.x + m.width * (2280 / 2700), m.y + m.height * (900 / 1700)); await p.waitForTimeout(6500); await shot('plaza-pitch');
  // phone
  await p.click('#dev-phone'); await p.waitForTimeout(800); await shot('p-plaza');
  await p.click('#sc-farm'); await p.waitForTimeout(800); await shot('p-farm');
  await p.click('#sc-lobby'); await p.waitForTimeout(600); await shot('p-lobby');
  await p.setViewportSize({ width: 400, height: 900 }); await p.waitForTimeout(300);
  console.log('sw', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', JSON.stringify(errs.slice(0, 12)));
  await b.close();
})();
