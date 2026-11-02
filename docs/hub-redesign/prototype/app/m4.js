// Touch behaviour on an emulated phone: rotation, tap-to-play, pinch zoom, tap tooltip, seed picker, full screen toggle.
const { chromium, devices } = require('./pw');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(1000);
  const st = () => p.evaluate(() => { const sc = document.querySelector('.screen'), fr = document.getElementById('frame'); return { phone: sc.classList.contains('phone'), fs: fr.classList.contains('fs'), gate: getComputedStyle(fr.querySelector('.rotate-gate')).display, tap: !!fr.querySelector('.tap-play'), w: sc.offsetWidth }; });
  console.log('portrait', JSON.stringify(await st()));
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(600);
  console.log('rotated ', JSON.stringify(await st()));
  await p.tap('.tap-play .here'); await p.waitForTimeout(300); console.log('play here', JSON.stringify(await st()));
  // farm
  await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById('frame').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500);
  console.log('frame top after Play here', await p.evaluate(() => Math.round(document.getElementById('frame').getBoundingClientRect().top)));
  // tap a growing crop with the hand → tooltip
  const gi = await p.evaluate(() => __FM._dbg.F.plots.findIndex(q => q.crop && q.prog < 1));
  const gc = await p.evaluate(i => __FM._dbg.plotClient(i), gi); console.log('crop plot', gi, JSON.stringify(gc), 'viewport', JSON.stringify(p.viewportSize())); await p.touchscreen.tap(gc.x, gc.y);
  await p.waitForTimeout(200); console.log('tap tooltip visible', await p.evaluate(() => !document.getElementById('fm-tip').hidden), await p.evaluate(() => document.getElementById('fm-tip').innerText.split('\n')[0]));
  // tap an empty owned plot → centred seed picker
  const ei = await p.evaluate(() => __FM._dbg.F.plots.findIndex(q => !q.locked && !q.crop));
  const ec = await p.evaluate(i => __FM._dbg.plotClient(i), ei); await p.touchscreen.tap(ec.x, ec.y); await p.waitForTimeout(300);
  console.log('picker', await p.evaluate(() => { const e = document.getElementById('fm-pop'), r = e.getBoundingClientRect(), s = document.querySelector('.screen').getBoundingClientRect(); return { open: !e.hidden, centredOff: Math.round((r.left + r.width / 2) - (s.left + s.width / 2)), fitsBottom: r.bottom <= s.bottom + 1 }; }));
  await p.screenshot({ path: 'm4-picker.png' });
  await p.keyboard.press('Escape'); await p.evaluate(() => { document.getElementById('fm-pop').hidden = true; });
  const z0 = await p.evaluate(() => __FM._dbg.cam().Z);
  const r = await p.evaluate(() => { const b = document.getElementById('fm-cv').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.evaluate(({ x, y }) => { const cv = document.getElementById('fm-cv'), ev = (t, id, px) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: px, clientY: y, bubbles: true, isPrimary: id === 1 }));
    ev('pointerdown', 1, x - 40); ev('pointerdown', 2, x + 40); for (let k = 1; k <= 10; k++) { ev('pointermove', 1, x - 40 - k * 8); ev('pointermove', 2, x + 40 + k * 8); } ev('pointerup', 1, x - 120); ev('pointerup', 2, x + 120); }, r);
  const z1 = await p.evaluate(() => __FM._dbg.cam().Z); console.log('pinch zoom', z0.toFixed(2), '->', z1.toFixed(2));
  // full screen via settings
  await p.evaluate(() => document.getElementById('sc-lobby').click()); await p.waitForTimeout(400);
  await p.tap('.topbar .icon-btn'); await p.waitForTimeout(300); await p.tap('[data-fs]'); await p.waitForTimeout(500); console.log('settings → fs', JSON.stringify(await st()));
  await p.tap('.topbar .icon-btn'); await p.waitForTimeout(300); console.log('settings button says', await p.textContent('[data-fs]')); await p.tap('[data-fs]'); await p.waitForTimeout(500); console.log('exit fs', JSON.stringify(await st()));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
