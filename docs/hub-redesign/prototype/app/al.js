// Button alignment audit: in every list (sheet rows, drawer rows), buttons in the same column must share
// left/right edges, and buttons in the same row must share their vertical centre and height.
const { chromium, devices } = require('./pw');
const CHECK = () => {
  const scr = document.querySelector('.screen'), k = scr.getBoundingClientRect().width / scr.offsetWidth, out = [];
  const lists = [...scr.querySelectorAll('.sh-body, .drawer .body, .fm-pop .grid')].filter(l => !l.matches('.landmap'));
  for (const list of lists) {
    if (!list.getClientRects().length) continue;
    const rows = [...list.children].filter(r => r.querySelector('button') && r.getClientRects().length && !r.matches('.landmap'));
    const cols = {};
    rows.forEach(r => {
      const bs = [...r.querySelectorAll('button, .ms-done, .ms-xp, .btn-ph')].filter(b => b.getClientRects().length && !b.closest('.sh-tabs'));
      if (!bs.length) return;
      const rr = bs.map(b => b.getBoundingClientRect());
      const cy = rr.map(x => x.top + x.height / 2), hs = rr.map(x => x.height);
      if (Math.max(...cy) - Math.min(...cy) > 1.5 * k) out.push(`row v-centre ${(Math.max(...cy) - Math.min(...cy)) / k | 0}px: ${r.textContent.trim().slice(0, 30)}`);
      if (bs.filter(b => b.tagName === 'BUTTON').length > 1 && !r.matches('.dogcard') && Math.max(...hs) - Math.min(...hs) > 1.5 * k) out.push(`row heights differ: ${r.textContent.trim().slice(0, 30)}`);
      (r.matches('.dogcard') ? bs : bs.slice().reverse()).forEach((b, i) => { (cols[i] ||= []).push([b.getBoundingClientRect(), r.textContent.trim().slice(0, 18)]); });
    });
    for (const [i, arr] of Object.entries(cols)) {
      if (arr.length < 2) continue;
      const L = arr.map(([x]) => x.left), R = arr.map(([x]) => x.right);
      const dl = (Math.max(...L) - Math.min(...L)) / k, dr = (Math.max(...R) - Math.min(...R)) / k;
      if (dl > 1.5 || dr > 1.5) out.push(`${list.closest('section,.fm-pop')?.querySelector('h4,h6')?.textContent || '?'} col ${i} (from right): left spread ${dl.toFixed(1)}px, right spread ${dr.toFixed(1)}px`);
    }
  }
  return out;
};
(async () => {
  const b = await chromium.launch(); const all = [];
  for (const mode of ['desk', 'phone']) {
    const ctx = mode === 'desk' ? await b.newContext({ viewport: { width: 1340, height: 1000 } }) : await b.newContext({ ...devices['iPhone 13 landscape'] });
    const p = await ctx.newPage(); await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900);
    if (mode === 'phone') { await p.tap('.tap-play .go'); await p.waitForTimeout(400); } else await (await p.$('#frame')).scrollIntoViewIfNeeded();
    for (const d of ['missions', 'journey', 'friends', 'raids']) { await p.evaluate(d => document.querySelector(`.rail [data-drawer="${d}"]`).click(), d); await p.waitForTimeout(300); (await p.evaluate(CHECK)).forEach(x => all.push(`${mode} drawer-${d}: ${x}`)); await p.evaluate(() => document.querySelector('.drawer .close')?.click()); }
    await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(800);
    await p.evaluate(() => { __ECON.leaves = 99999; __FM._dbg.F.lv = 45; });
    for (const [s, tabs] of [['shop', ['seeds', 'tools', 'dogs', 'land']], ['orders', [null]], ['market', ['sell', 'prices', 'coins']], ['barn', [null]], ['book', ['book', 'mastery']], ['decor', [null]], ['friends', [null]]]) {
      for (const t of tabs) { await p.evaluate(([s, t]) => __FM._dbg.openSheet(s, t || undefined), [s, t]); await p.waitForTimeout(250); (await p.evaluate(CHECK)).forEach(x => all.push(`${mode} ${s}/${t}: ${x}`)); }
    }
    await ctx.close();
  }
  console.log([...new Set(all)].join('\n') || 'ALL BUTTONS ALIGNED'); await b.close();
})();
