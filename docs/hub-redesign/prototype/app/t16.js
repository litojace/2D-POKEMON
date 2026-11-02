const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900);
  const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const found = new Set();
  const scan = async tag => { const t = await p.evaluate(() => document.getElementById('screen').innerText + ' ' + [...document.querySelectorAll('#screen [title], #screen [aria-label]')].map(e => (e.title || '') + ' ' + (e.getAttribute('aria-label') || '')).join(' ')); t.split('\n').forEach(l => { if (VI.test(l)) found.add(tag + ': ' + l.trim().slice(0, 90)); }); };
  await scan('lobby');
  await p.click('#mode-btn'); await scan('modes'); await p.mouse.click(5, 5);
  for (const d of ['fighters', 'raids', 'journey', 'missions', 'ranks', 'friends']) { await p.click(`.rail [data-drawer="${d}"]`); await p.waitForTimeout(80); await scan('drawer ' + d); }
  await p.click('.rail [data-fit="shop"]'); for (const t of ['today', 'skins', 'mythic', 'collections']) { await p.click(`[data-ftab="${t}"]`); await p.waitForTimeout(60); await scan('shop ' + t); const s = await p.$('.fp-body [data-sel]'); if (s) { await s.click(); await scan('shop sel ' + t); } }
  await p.click('[data-fitmode="wardrobe"]'); await scan('wardrobe'); await p.click('[data-fslot="aura"]'); await p.click('.fp-body [data-sel]:last-of-type').catch(() => {}); await scan('wardrobe sel');
  await p.click('#sc-plaza'); await p.waitForTimeout(500); await scan('plaza start'); await p.click('#pz-start'); await p.evaluate(() => { __PZ._dbg.ev.next = .1; }); await p.waitForTimeout(1500); await scan('plaza');
  await p.click('#sc-farm'); await p.waitForTimeout(600); await scan('farm');
  for (const [sh, tabs] of [['shop', ['seeds', 'tools', 'dogs', 'land']], ['orders', []], ['market', ['sell', 'prices', 'coins']], ['barn', []], ['book', []], ['decor', []], ['friends', []]]) { await p.click(`[data-sheet="${sh}"]`); await p.waitForTimeout(60); await scan('sheet ' + sh); for (const t of tabs) { await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(50); await scan(`sheet ${sh}/${t}`); } }
  await p.click('[data-visit="0"]'); await p.waitForTimeout(300); await scan('visit');
  await p.click('#fm-visit [data-home]');
  await p.evaluate(() => __FM._dbg.landClick(5)); await scan('deed'); await p.click('[data-deedno]');
  console.log([...found].join('\n') || 'NO VIETNAMESE');
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
