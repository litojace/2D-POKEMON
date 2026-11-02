// Measures HUD boxes across time + state changes and reports any that change size.
const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(800);
  const f = await p.$('#frame'); await f.scrollIntoViewIfNeeded();
  const snap = () => p.evaluate(() => {
    const scr = document.querySelector('.screen'), sr = scr.getBoundingClientRect(), k = sr.width / scr.offsetWidth, out = {};
    const path = el => { const a = []; while (el && el !== scr) { let s = el.tagName.toLowerCase(); if (el.id) { a.unshift('#' + el.id); break; } const cls = [...el.classList].filter(c => !/^(on|hot|sel|act|ready)$/.test(c)).slice(0, 2).join('.'); if (cls) s += '.' + cls; const par = el.parentElement; if (par) s += ':' + [...par.children].indexOf(el); a.unshift(s); el = par; } return a.join('>'); };
    scr.querySelectorAll('*').forEach(el => {
      if (el.closest('.fm-sheet,.fm-modal,.fm-pop,#layer,.pz-wheel,.fm-log,.pz-feed,.toast,.pz-photo,.pz-start,.fm-tip')) return;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null && cs.position !== 'fixed') return;
      const boxy = (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || el.tagName === 'BUTTON') && el.tagName !== 'CANVAS' && el.tagName !== 'IMG';
      if (!boxy) return; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      out[path(el)] = { w: +(r.width / k).toFixed(1), h: +(r.height / k).toFixed(1), t: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 40) };
    });
    return out;
  });
  const diffs = {}; let base = null;
  const cmp = (cur, label) => { for (const key in cur) { if (!base[key]) { base[key] = cur[key]; continue; } const a = base[key], c = cur[key]; if (Math.abs(a.w - c.w) > .6 || Math.abs(a.h - c.h) > .6) { (diffs[key] ||= []).push(`${label}: ${a.w}x${a.h} "${a.t}" -> ${c.w}x${c.h} "${c.t}"`); } } };
  const scene = async (name, steps) => { base = await snap(); for (const [label, fn] of steps) { await fn(); await p.waitForTimeout(250); cmp(await snap(), name + '/' + label); } };
  await scene('lobby', [['wait3s', () => p.waitForTimeout(3000)], ['bigmoney', () => p.evaluate(() => { document.getElementById('coins').textContent = '1,234,567'; __ECON.leaves = 99999; __wallet(); })], ['wait2s', () => p.waitForTimeout(2000)]]);
  await p.evaluate(() => { document.getElementById('coins').textContent = '2,340'; __ECON.leaves = 820; __wallet(); });
  await p.click('#sc-farm'); await p.waitForTimeout(900);
  const steps = [['wait3s', () => p.waitForTimeout(3000)]];
  for (const k of ['2', '3', '4', '5', '6', '1']) steps.push(['key' + k, () => p.keyboard.press(k)]);
  const crops = await p.evaluate(() => __FM._dbg.CROPS.map(c => c.id));
  for (const c of crops) steps.push(['seed:' + c, () => p.evaluate(c => { __FM._dbg.F.seeds[c] = 7; __FM._dbg.F.seed = c; }, c).then(() => p.keyboard.press('2'))]);
  steps.push(['money', () => p.evaluate(() => { __ECON.leaves = 123456; __wallet(); })]);
  steps.push(['wait4s', () => p.waitForTimeout(4000)]);
  await scene('farm', steps);
  await p.click('#sc-plaza'); await p.waitForTimeout(900); await p.click('#pz-start').catch(() => {}); await p.waitForTimeout(300);
  const spots = await p.evaluate(() => __PZ._dbg.SPOTS.map(s => [s.x, s.y, s.label || s.id || '']));
  const ps = [['wait3s', () => p.waitForTimeout(3000)]];
  spots.forEach(([x, y, l], i) => ps.push(['spot' + i + ':' + l, () => p.evaluate(([x, y]) => { const P = __PZ._dbg.P; P.x = x; P.y = y + 5; }, [x, y]).then(() => p.waitForTimeout(250))]));
  ps.push(['wait3s', () => p.waitForTimeout(3000)]);
  await scene('plaza', ps);
  for (const k in diffs) { console.log('\n' + k); [...new Set(diffs[k])].slice(0, 6).forEach(d => console.log('   ' + d)); }
  console.log('\nchanged boxes:', Object.keys(diffs).length, 'errs', JSON.stringify(errs)); await b.close();
})();
