const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(800);
  const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded(); const shot = n => f.screenshot({ path: 'q-' + n + '.png' });
  await p.click('#sc-farm'); await p.waitForTimeout(800);
  const pc = i => p.evaluate(i => __FM._dbg.plotClient(i), i);
  // empty plot -> seed picker
  let c = await pc(13); await p.mouse.move(c.x, c.y); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300); await shot('picker');
  await p.click('.fm-pop [data-pseed]'); await p.waitForTimeout(200);
  console.log('tool after pick', await p.evaluate(() => __FM._dbg.F.tool));
  for (const [key, name, plot] of [['3', 'can', 11], ['5', 'net', 4], ['6', 'shovel', 20]]) { await p.keyboard.press(key); const q = await pc(plot); await p.mouse.move(q.x + 10, q.y - 4); await p.waitForTimeout(150); await p.mouse.down(); await p.waitForTimeout(90); await shot('cur-' + name); await p.mouse.up(); await p.waitForTimeout(150); console.log(key, await p.evaluate(() => __FM._dbg.F.tool)); }
  // combo: make 4 ripe in a row, sickle-drag
  await p.evaluate(() => { const F = __FM._dbg.F; F.sickle = true; [0, 1, 2, 3, 4].forEach(i => { Object.assign(F.plots[i], { crop: 'wheat', prog: 1, mut: [], pests: 0 }); }); F.tool = 'hand'; });
  const xp0 = await p.evaluate(() => __FM._dbg.F.xp + __FM._dbg.F.lv * 1000);
  const a0 = await pc(0), a4 = await pc(4); await p.mouse.move(a0.x, a0.y); await p.mouse.down(); await p.mouse.move(a4.x, a4.y, { steps: 12 }); await p.waitForTimeout(100); await shot('combo'); await p.mouse.up(); await p.waitForTimeout(200);
  console.log('xp gained', (await p.evaluate(() => __FM._dbg.F.xp + __FM._dbg.F.lv * 1000)) - xp0, 'log', await p.evaluate(() => __FM._dbg.F.log[0]?.html));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
