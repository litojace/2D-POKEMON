// Growth must follow the wall clock even when the page runs at a crawl (CPU throttled 8×).
const { chromium } = require('./pw');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(1500); await p.click('#sc-farm'); await p.waitForTimeout(1500);
  const g = await p.evaluate(async () => { const F = __FM._dbg.F; const P = F.plots.find(p => !p.crop && !p.locked); Object.assign(P, { crop: 'wheat', prog: 0, wet: false, fert: null, pests: 0, mut: [] }); const w = F.weather.cur; const a = P.prog, t0 = Date.now(); await new Promise(r => setTimeout(r, 8000)); return { weather: w, perSec: (P.prog - a) / ((Date.now() - t0) / 1000) }; });
  const mul = { sun: 1.1, frost: .85 }[g.weather] ?? 1; console.log('throttled growth per sec', g.perSec.toExponential(3), 'expected', (mul / (15 * 240)).toExponential(3), 'ratio', (g.perSec / (mul / (15 * 240))).toFixed(3));
  console.log('errs', JSON.stringify(errs)); await b.close(); })();
