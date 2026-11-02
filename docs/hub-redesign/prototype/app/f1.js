// Farm orbs + expandable menu: desktop and phone, open states, actions.
const { chromium, devices } = require('./pw');
(async () => {
  const b = await chromium.launch(); const errs = [];
  // desktop
  let p = await b.newPage({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 2 }); p.on('pageerror', e => errs.push('desk: ' + e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded();
  await p.click('#sc-farm'); await p.waitForTimeout(900); await f.screenshot({ path: 'f1-desk-closed.png' });
  await p.click('[data-orb="dog"]'); await p.waitForTimeout(300); await f.screenshot({ path: 'f1-desk-dogcard.png' });
  console.log('dog card:', (await p.textContent('#fm-orbpop')).replace(/\s+/g, ' ').slice(0, 120));
  await p.click('[data-orbgo="dogs"]'); await p.waitForTimeout(300); console.log('opens sheet:', await p.evaluate(() => !document.getElementById('fm-sheet').hidden && document.querySelector('#fm-sheet .sh-tabs [aria-selected="true"]')?.textContent));
  await p.evaluate(() => document.querySelector('#fm-sheet [data-close]')?.click());
  await p.click('[data-orb="perk"]'); await p.waitForTimeout(200); await p.click('[data-orbgo="perk"]'); await p.waitForTimeout(200);
  await p.click('[data-orb="barn"]'); await p.waitForTimeout(200); console.log('barn card:', (await p.textContent('#fm-orbpop')).replace(/\s+/g, ' ').slice(0, 80));
  await p.click('#fm-badge'); await p.waitForTimeout(200); console.log('outside tap closes:', await p.evaluate(() => document.getElementById('fm-orbpop').hidden));
  await p.click('#fm-dock .dk-t'); await p.waitForTimeout(300); await f.screenshot({ path: 'f1-desk-open.png' });
  console.log('desk dock open:', await p.evaluate(() => [document.getElementById('fm-dock').classList.contains('open'), localStorage.getItem('fmDockOpen')]));
  await p.close();
  // phone
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); p = await ctx.newPage(); p.on('pageerror', e => errs.push('phone: ' + e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await p.tap('.tap-play .go'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(900); await p.screenshot({ path: 'f1-phone-closed.png' });
  await p.tap('[data-orb="dog"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'f1-phone-dogcard.png' }); await p.tap('[data-orb="dog"]'); await p.waitForTimeout(200);
  await p.tap('#fm-dock .dk-t'); await p.waitForTimeout(300); await p.screenshot({ path: 'f1-phone-open.png' });
  await p.tap('#fm-dock [data-sheet="orders"]'); await p.waitForTimeout(300); console.log('phone: item opens sheet + menu folds:', await p.evaluate(() => [!document.getElementById('fm-sheet').hidden, document.getElementById('fm-dock').classList.contains('open')]));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
