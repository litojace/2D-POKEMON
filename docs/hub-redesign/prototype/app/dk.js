const { chromium, devices } = require('./pw');
(async () => { const b = await chromium.launch();
  for (const dev of ['iPhone SE landscape', 'iPhone 13 landscape', 'Pixel 7 landscape']) {
    const ctx = await b.newContext({ ...devices[dev] }); const p = await ctx.newPage();
    await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(900); await p.tap('.tap-play .go'); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('sc-farm').click()); await p.waitForTimeout(800); await p.tap('#fm-dock .dk-t'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const a = document.getElementById('fm-dock').getBoundingClientRect(), t = document.getElementById('fm-tools').getBoundingClientRect(), o = document.getElementById('fm-chips').getBoundingClientRect(); const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return { dockBottom: Math.round(a.bottom), toolsTop: Math.round(t.top), overlapTools: Math.round(ov(a, t)), overlapOrbs: Math.round(ov(a, o)) }; });
    console.log(dev.padEnd(22), JSON.stringify(r)); if (dev.startsWith('iPhone SE')) await p.screenshot({ path: 'dk-se.png' }); await ctx.close();
  }
  await b.close(); })();
