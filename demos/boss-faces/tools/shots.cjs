// node tools/shots.cjs jobs.json
// Renders proof images from all-bosses.html with the pre-installed Playwright.
// A job is either a grid   { boss, out, cols, cell:[w,h], zoom, body?, headOnly?, lines?, items:[{yaw,label,cue,phase}] }
// or a page shot           { boss, out, page:true, w, h, dsf, full?, S:{...}, clock }
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const url = 'file://' + path.join(__dirname, '..', 'all-bosses.html');
(async () => {
  // PW_CHROMIUM names a Chromium to use (the cloud container's is /opt/pw-browsers/chromium)
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const errs = [];
  for (const j of jobs) {
    const pg = await b.newPage({ viewport: { width: j.w || 900, height: j.h || 700 }, deviceScaleFactor: j.dsf || 1 });
    pg.on('pageerror', e => errs.push(j.out + ': ' + e));
    pg.on('console', m => { if (m.type() === 'error') errs.push(j.out + ': ' + m.text()); });
    await pg.goto(url + '#' + j.boss);
    await pg.waitForTimeout(120);
    if (j.page) {
      await pg.evaluate((j) => { Object.assign(DEMO.S, { paused: true }, j.S || {}); DEMO.S.manual = j.manual || { clock: j.clock || 0.4, windup: 0 }; DEMO.render(); }, j);
      await pg.waitForTimeout(60);
      if (j.full) await pg.screenshot({ path: j.out, fullPage: true }); else await pg.locator('#stage').screenshot({ path: j.out });
    } else {
      const data = await pg.evaluate((j) => {
        const B = DEMO.boss(), [cw, ch] = j.cell, cols = j.cols, rows = Math.ceil(j.items.length / cols), z = j.zoom;
        const cv = document.createElement('canvas'); cv.width = cw * cols; cv.height = ch * rows;
        const c = cv.getContext('2d');
        c.fillStyle = j.bg || '#141029'; c.fillRect(0, 0, cv.width, cv.height);
        j.items.forEach((it, i) => {
          const phase = it.phase || j.phase || 1;
          const at = DEMO.atlas(phase, Math.min(8, z));
          const P = B.pose({ clock: 0.4, phase, reduced: false, windup: 0, ...(it.cue || {}) });
          const pl = B.placements(P, it.yaw * KIT.DEG, phase);
          const hx = pl.heads.reduce((a, h) => a + h.x, 0) / pl.heads.length, hy = pl.heads.reduce((a, h) => a + h.y, 0) / pl.heads.length;
          const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
          c.save(); c.beginPath(); c.rect(ox, oy, cw, ch); c.clip();
          if (j.body) c.translate(ox + cw / 2, oy + ch * (j.ground || 0.8)); else c.translate(ox + cw / 2 - hx * z, oy + ch * 0.5 - hy * z);
          c.scale(z, z);
          DEMO.drawPlacements(c, pl.placements, at, j.headOnly ? (p) => p.face : null);
          if (j.lines || it.lines) for (const h of pl.heads) DEMO.drawGuide(c, h.guide, z);
          c.restore();
          c.fillStyle = '#ffd24a'; c.font = '600 ' + Math.round(Math.max(13, cw / 20)) + 'px ui-monospace, monospace';
          c.fillText(it.label || (it.yaw + '°'), ox + 8, oy + Math.max(18, cw / 15));
          c.strokeStyle = '#2e2757'; c.strokeRect(ox + 0.5, oy + 0.5, cw - 1, ch - 1);
        });
        return cv.toDataURL(j.out.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 0.9);
      }, j);
      fs.writeFileSync(j.out, Buffer.from(data.split(',')[1], 'base64'));
    }
    await pg.close();
  }
  if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 8));
  await b.close();
})();
