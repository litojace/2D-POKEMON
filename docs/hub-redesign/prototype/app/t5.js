const { chromium } = require('./pw');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/preview-t.html'); await p.waitForTimeout(800);
  await p.click('#sc-plaza'); await p.waitForTimeout(400); await p.click('#pz-start');
  const st = () => p.evaluate(() => { const { run, P } = __PZ._dbg; return { s: run.state, n: run.next, best: run.best, last: run.last, stun: P.stun > 0 }; });
  const tp = a => p.evaluate(a => { const T = { cx: 540, cy: 930, ro: [400, 290], ri: [262, 168] }; const x = T.cx + Math.cos(a) * (T.ri[0] + (T.ro[0] - T.ri[0]) * .5), y = T.cy + Math.sin(a) * (T.ri[1] + (T.ro[1] - T.ri[1]) * .5); __PZ._dbg.P.x = x; __PZ._dbg.P.y = y; }, a);
  await tp(-Math.PI / 2 - .12); await p.keyboard.down('d'); await p.waitForTimeout(500); await p.keyboard.up('d'); console.log('start', await st());
  for (const a of [0, Math.PI / 2, Math.PI]) { await tp(a); await p.waitForTimeout(150); }
  await tp(-Math.PI / 2 - .12); await p.keyboard.down('d'); await p.waitForTimeout(500); await p.keyboard.up('d'); console.log('finish', await st());
  console.log('lap quest', await p.evaluate(() => __PZ._dbg.Q.find(q => q.id === 'lap').n));
  await p.evaluate(() => { const { P, ball } = __PZ._dbg; P.x = ball.x - 70; P.y = ball.y; P.lastDir = { x: 1, y: 0 }; }); await p.keyboard.down('d'); await p.keyboard.press('Shift'); await p.waitForTimeout(600); await p.keyboard.up('d');
  console.log('ball', await p.evaluate(() => ({ vx: Math.round(__PZ._dbg.ball.vx), score: __PZ._dbg.score.join(':') })));
  console.log('errs', JSON.stringify(errs)); await b.close();
})();
