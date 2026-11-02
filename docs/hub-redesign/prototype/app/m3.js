// Real-device emulation: page load, tap-to-play full screen, every scene; layout audit + screenshots.
const { chromium, devices } = require('./pw'); const AUDIT = require('./audit-fn.js');
const DEV = { 'se-land': devices['iPhone SE landscape'], 'ip13-land': devices['iPhone 13 landscape'], 'px7-land': devices['Pixel 7 landscape'], 'ip13-port': devices['iPhone 13'] };
(async () => {
  const b = await chromium.launch();
  for (const [name, d] of Object.entries(DEV)) {
    const ctx = await b.newContext({ ...d }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + __dirname + '/preview.html'); await p.waitForTimeout(1200);
    await p.evaluate(() => document.getElementById('frame').scrollIntoView({ block: 'start' })); await p.waitForTimeout(200);
    await p.screenshot({ path: `m3-${name}-0page.png` });
    const tap = await p.$('.tap-play .go'); if (tap) { await tap.tap(); await p.waitForTimeout(700); }
    const st = await p.evaluate(() => { const sc = document.querySelector('.screen'), fr = document.getElementById('frame'); return { vw: innerWidth, vh: innerHeight, phone: sc.classList.contains('phone'), fs: fr.classList.contains('fs'), w: sc.offsetWidth, scale: +(sc.getBoundingClientRect().width / sc.offsetWidth).toFixed(3), gate: getComputedStyle(fr.querySelector('.rotate-gate')).display, tapPlay: !!fr.querySelector('.tap-play') }; });
    console.log(name.padEnd(10), JSON.stringify(st), errs.length ? 'ERR ' + errs.join(' | ') : '');
    await p.screenshot({ path: `m3-${name}-1lobby.png` });
    if (name.endsWith('port')) { await ctx.close(); continue; }
    const issues = [];
    const audit = async lab => { const r = await p.evaluate(AUDIT); for (const k of ['overlap', 'oob', 'text']) r[k].filter(x => !/drawer|fm-sheet|fm-modal|#fm-pop|tap-play/.test(x)).forEach(x => issues.push(`${lab} ${k}: ${x}`)); };
    await audit('lobby');
    await p.evaluate(() => document.getElementById('sc-plaza').click()); await p.waitForTimeout(800); await p.evaluate(() => document.getElementById('pz-start')?.click()); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = __PZ?._dbg?.SPOTS?.[1]; }).catch(() => {}); await audit('plaza'); await p.screenshot({ path: `m3-${name}-2plaza.png` });
    await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(900); await audit('farm'); await p.screenshot({ path: `m3-${name}-3farm.png` });
    console.log('   issues:', issues.length ? '\n   ' + [...new Set(issues)].join('\n   ') : 'none');
    await ctx.close();
  }
  await b.close();
})();
