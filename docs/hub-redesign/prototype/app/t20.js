// Finds text that is cut ("…") or spills out of its box, on desktop and phone, in every scene.
const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(800);
  const check = label => p.evaluate(label => {
    const scr = document.querySelector('.screen'), out = [];
    scr.querySelectorAll('*').forEach(el => {
      if (el.closest('.fm-sheet,.fm-modal,#layer,.pz-photo,.pz-start,.fm-log,.pz-feed,.toast,.stage,.bubble,.walker,.crowd')) return;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) return;
      if (el.closest('[hidden]')) return;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') out.push(`${label} CUT  ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
      const box = el.parentElement.closest('button,.pill,.fm-chip,.glass,.fm-tool,.pz-act,.opt,.card,.count');
      if (box && cs.position !== 'absolute') { const r = el.getBoundingClientRect(), q = box.getBoundingClientRect(); if (r.right > q.right + 1.5 || r.left < q.left - 1.5) out.push(`${label} SPILL ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}" out of ${box.className.split(' ')[0]}`); }
    });
    return out;
  }, label);
  const res = [];
  for (const dev of ['desktop', 'phone']) {
    await p.click('#dev-' + dev); await p.waitForTimeout(500);
    await p.click('#sc-lobby'); await p.waitForTimeout(500); res.push(...await check(dev + '/lobby'));
    await p.click('#sc-farm'); await p.waitForTimeout(700); res.push(...await check(dev + '/farm'));
    for (const w of ['frost', 'rainbow', 'storm']) { await p.evaluate(w => { __FM._dbg.F.weather.cur = w; __FM._dbg.F.weather.next = 'storm'; }, w); await p.waitForTimeout(1100); res.push(...await check(dev + '/farm-' + w)); }
    const c = await p.evaluate(() => __FM._dbg.plotClient(13)); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300); res.push(...await check(dev + '/picker'));
    await p.keyboard.press('Escape');
    await p.click('#sc-plaza'); await p.waitForTimeout(700); await p.click('#pz-start').catch(() => {}); await p.waitForTimeout(300);
    const spots = await p.evaluate(() => __PZ._dbg.SPOTS.map(s => [s.x, s.y]));
    for (const [i, [x, y]] of spots.entries()) { await p.evaluate(([x, y]) => { const P = __PZ._dbg.P; P.x = x; P.y = y + 5; }, [x, y]); await p.waitForTimeout(350); res.push(...await check(dev + '/plaza-spot' + i)); }
  }
  console.log([...new Set(res)].join('\n') || 'NO CUT OR SPILLED TEXT'); console.log('errs', JSON.stringify(errs)); await b.close();
})();
