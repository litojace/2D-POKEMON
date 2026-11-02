// Contact sheet of every crop at every stage + its item icon, on a soil tile like the farm.
const { chromium } = require('./pw'); const fs = require('fs');
const farm = fs.readFileSync(__dirname + '/farm.js', 'utf8');
const crops = farm.slice(farm.indexOf('const CROPS = ['), farm.indexOf('}));', farm.indexOf('const CROPS = [')) + 4);
const art = fs.readFileSync(__dirname + '/crops.js', 'utf8');
const only = process.argv[2] ? process.argv[2].split(',') : null; const out = process.argv[3] || 'sheet.png';
const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#2b1d3f;font:600 12px system-ui;color:#fff}table{border-collapse:separate;border-spacing:6px;padding:6px}td{background:#7a4e2c;border-radius:12px;width:120px;height:140px;text-align:center;vertical-align:bottom;position:relative;box-shadow:inset 0 -14px 0 #6a4224}td.n{background:none;box-shadow:none;width:110px;vertical-align:middle;text-align:left}td.i{background:#1e2a4a;box-shadow:none}img{width:120px;height:140px;display:block}</style><table id=t></table><script>${art};${crops};
const t=document.getElementById('t'); const ONLY=${JSON.stringify(only)};
const url=s=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
CROPS.filter(c=>!ONLY||ONLY.includes(c.id)).forEach(c=>{const tr=document.createElement('tr');tr.innerHTML='<td class=n>'+c.n+'<br><small>'+c.el+' · '+c.rar+'</small></td>'+[0,1,2,3,4].map(st=>'<td><img src="'+url(CROPART.field(c,st))+'"></td>').join('')+'<td class=i><img src="'+url(CROPART.item(c))+'"></td>';t.appendChild(tr);});
</script>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setContent(html); await p.waitForTimeout(800); await p.screenshot({ path: out, fullPage: true });
  const bad = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).length); console.log('broken images', bad, 'errs', JSON.stringify(errs)); await b.close(); })();
