import base64, json, pathlib, re, subprocess, sys
D = pathlib.Path(__file__).parent
subprocess.run([sys.executable, str(D/'assemble.py')], check=True)
s = (D/'template.html').read_text()
L = D.parent/'lobby'
art = (L/'art.json').read_text(); assert '</script' not in art
s = s.replace('__ART__', art).replace('__TONES__', (L/'tones.json').read_text()).replace('__CATALOG__', (L/'catalog.json').read_text())
left = re.findall(r'__[A-Z][A-Z_0-9-]*__', s)
assert not left, left
(D/'hub.html').write_text(s)
(D/'preview.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>img{max-width:100%}[hidden]{display:none!important}body{margin:0}</style></head><body>' + s + '</body></html>')
print('hub.html', len(s)//1024, 'KB')
# test build: expose debug handles for the Playwright scripts
pv = (D/'preview.html').read_text(); k = 'scenesReady = true; fillIconSlots(screen);'
assert pv.count(k) == 1
(D/'preview-t.html').write_text(pv.replace(k, k + ' window.__PZ = PZ; window.__FM = FM; window.__ECON = ECON; window.__wallet = updateWallet;'))
