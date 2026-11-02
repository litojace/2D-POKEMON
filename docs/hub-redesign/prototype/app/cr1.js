// New crop art in the real farm: a field with every crop at mixed stages, plus menus that use item icons.
const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 2 }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(800); const fr = await p.$('#frame'); await fr.scrollIntoViewIfNeeded();
  await p.click('#sc-farm'); await p.waitForTimeout(800);
  await p.evaluate(() => { const { F, CROPS } = __FM._dbg; F.lv = 100; F.plots.forEach(pl => pl.locked = false); CROPS.forEach((c, k) => { const pl = F.plots[k]; Object.assign(pl, { crop: c.id, prog: k % 5 === 4 ? .5 : 1, wet: false, pests: 0, fert: null, mut: [], crow: null }); }); [25, 26, 27, 28, 29].forEach((i, k) => Object.assign(F.plots[i], { crop: 'pumpkin', prog: [0.02, .2, .5, .8, 1][k], mut: [] })); F.plots[30] && Object.assign(F.plots[30], { crop: 'melon', prog: 1, mut: ['gold'] }); F.plots[31] && Object.assign(F.plots[31], { crop: 'starfruit', prog: 1, mut: ['rainbow'] }); });
  await p.waitForTimeout(1200); await fr.screenshot({ path: 'cr1-field.png' });
  // zoomed look
  await p.evaluate(() => { const c = __FM._dbg.cam(); }); 
  const box = await fr.boundingBox(); await p.mouse.move(box.x + box.width * .45, box.y + box.height * .5); for (let k = 0; k < 4; k++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(120); } await p.waitForTimeout(600); await fr.screenshot({ path: 'cr1-zoom.png' });
  // seed picker, shop, barn
  await p.evaluate(() => { const { F } = __FM._dbg; Object.assign(F.plots[40], { crop: null, prog: 0, locked: false }); __FM._dbg.CROPS.forEach(c => F.seeds[c.id] = 3); F.barn = Object.fromEntries(__FM._dbg.CROPS.slice(0, 12).map(c => [c.id, 4])); });
  await p.evaluate(() => __FM._dbg.openSheet('shop')); await p.waitForTimeout(500); await fr.screenshot({ path: 'cr1-shop.png' });
  await p.evaluate(() => document.querySelector('#fm-sheet [data-close]')?.click()); await p.evaluate(() => __FM._dbg.openSheet('market')); await p.waitForTimeout(500); await fr.screenshot({ path: 'cr1-market.png' });
  console.log('icon sources are items:', await p.evaluate(() => [...document.querySelectorAll('#fm-sheet .ic img')].length));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
