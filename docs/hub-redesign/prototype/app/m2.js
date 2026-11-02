// Phone-layout audit at 1:1 scale: small tap targets, tiny text, overlapping HUD blocks, off-screen boxes.
const { chromium } = require('./pw');
const W = +(process.argv[2] || 844);
const AUDIT = () => {
  const scr = document.querySelector('.screen'), sr = scr.getBoundingClientRect(), k = sr.width / scr.offsetWidth, out = { tap: [], text: [], overlap: [], oob: [] };
  const vis = el => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')) + (el.textContent.trim() ? ` "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 16)}"` : (el.getAttribute('aria-label') ? ` [${el.getAttribute('aria-label')}]` : ''));
  const R = el => { const r = el.getBoundingClientRect(); return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k }; };
  scr.querySelectorAll('button, [role=button], a[href], input, select, .fm-chip').forEach(el => { if (!vis(el) || el.disabled) return; const r = R(el); if (Math.min(r.w, r.h) < 40) out.tap.push(`${name(el)} ${r.w.toFixed(0)}×${r.h.toFixed(0)}`); });
  scr.querySelectorAll('*').forEach(el => { if (!vis(el)) return; if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 10) out.text.push(`${name(el)} ${fs.toFixed(1)}px`); });
  // HUD blocks: direct children of the HUD layers + lobby chrome
  const blocks = [...scr.querySelectorAll('.fm-hud > *, .pz-hud > *, .topbar > *, .rail, .side > *, .playbox, .emotes, #layer > *, .stage-nav, .champ-nav, .nameplate')].filter(vis).filter(el => !el.matches('.fm-log, .pz-feed, .pz-banner, .fm-hint, .toast'));
  for (let i = 0; i < blocks.length; i++) { const a = R(blocks[i]); if (a.x < -1 || a.y < -1 || a.x + a.w > scr.offsetWidth + 1 || a.y + a.h > scr.offsetHeight + 1) out.oob.push(`${name(blocks[i])} x${a.x.toFixed(0)} y${a.y.toFixed(0)} ${a.w.toFixed(0)}×${a.h.toFixed(0)}`);
    for (let j = i + 1; j < blocks.length; j++) { if (blocks[i].contains(blocks[j]) || blocks[j].contains(blocks[i])) continue; const b = R(blocks[j]); const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ix > 2 && iy > 2) out.overlap.push(`${name(blocks[i])} ⨯ ${name(blocks[j])} (${ix.toFixed(0)}×${iy.toFixed(0)})`); } }
  return out;
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1000 }, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900);
  await p.click('#dev-phone'); await p.waitForTimeout(400);
  if (W !== 844) await p.evaluate(W => { const s = document.querySelector('.screen'); s.style.width = W + 'px'; window.dispatchEvent(new Event('resize')); }, W);
  await p.evaluate(() => document.getElementById('frame').scrollIntoView()); await p.waitForTimeout(300);
  const runs = [];
  const audit = async label => { const r = await p.evaluate(AUDIT); runs.push([label, r]); await (await p.$('#frame')).screenshot({ path: `m2-${W}-${label}.png` }); };
  await audit('lobby');
  for (const d of ['missions', 'journey', 'friends']) { await p.evaluate(d => document.querySelector(`.rail [data-drawer="${d}"]`)?.click() || window.__open?.(d), d); await p.waitForTimeout(350); await audit('drawer-' + d); await p.evaluate(() => document.querySelector('.drawer .close')?.click()); }
  await p.evaluate(() => document.querySelector('.rail [data-fit="shop"]')?.click()); await p.waitForTimeout(600); await audit('shop'); await p.evaluate(() => document.getElementById('sc-lobby').click()); await p.waitForTimeout(300);
  await p.click('#sc-plaza'); await p.waitForTimeout(800); await p.evaluate(() => document.getElementById('pz-start')?.click()); await p.waitForTimeout(300); await audit('plaza');
  await p.evaluate(() => { const s = __PZ._dbg.SPOTS[1], P = __PZ._dbg.P; P.x = s.x; P.y = s.y + 5; }); await p.waitForTimeout(400); await audit('plaza-spot');
  await p.click('#sc-farm'); await p.waitForTimeout(800); await audit('farm');
  const c = await p.evaluate(() => __FM._dbg.plotClient(13)); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300); await audit('farm-picker'); await p.keyboard.press('Escape'); await p.mouse.click(5, 5);
  for (const s of ['shop', 'orders', 'market', 'barn', 'book', 'decor', 'friends']) { await p.evaluate(s => __FM._dbg.openSheet(s), s); await p.waitForTimeout(250); await audit('sheet-' + s); }
  await p.evaluate(() => document.querySelector('#fm-sheet [data-close]')?.click());
  await p.evaluate(() => { const F = __FM._dbg.F, i = F.plots.findIndex((q, j) => __FM._dbg.buyable(j)); __FM._dbg.landClick(i); }); await p.waitForTimeout(300); await audit('deed');
  const agg = { tap: new Map(), text: new Map(), overlap: new Map(), oob: new Map() };
  for (const [label, r] of runs) for (const kind of Object.keys(agg)) for (const it of r[kind]) { const m = agg[kind]; if (!m.has(it)) m.set(it, []); m.get(it).push(label); }
  for (const kind of ['overlap', 'oob', 'tap', 'text']) { console.log(`\n== ${kind.toUpperCase()} (${agg[kind].size})`); [...agg[kind]].slice(0, kind === 'text' || kind === 'tap' ? 600 : 60).forEach(([it, ls]) => console.log('  ' + it + '   @' + [...new Set(ls)].slice(0, 4).join(',') + (ls.length > 4 ? '…' : ''))); }
  console.log('\nerrs', JSON.stringify(errs)); await b.close();
})();
