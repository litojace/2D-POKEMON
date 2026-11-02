import re, pathlib
D = pathlib.Path(__file__).parent
s = (D.parent/'lobby'/'template.html').read_text()
def rep(a, b, cnt=1):
    global s
    assert s.count(a) == cnt, (a[:90], s.count(a))
    s = s.replace(a, b)
def cut(a, b):  # remove from a up to (not including) b
    global s
    i = s.index(a); j = s.index(b, i); s = s[:i] + s[j:]

rep('  const dt = Math.min(100, t - last) / 1000; last = t;', '  const dt = Math.max(0, Math.min(100, t - last)) / 1000; last = t;')
rep('<title>Sảnh Arena</title>', '<title>Element Arena Hub</title>')
s = s.replace('gameEl.focus()', 'gameEl.focus({ preventScroll: true })')
rep('FRIENDS.slice(0, 3).map(f => {', 'FRIENDS.slice(0, 2).map(f => {')
rep('family=Barlow+Condensed:wght@600;700;800&family=DM+Sans', 'family=Barlow+Condensed:wght@600;700;800&family=Caveat:wght@600&family=DM+Sans')
# ---- CSS ----
extra_css = '''
/* doc helpers */
.zones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 860px) { .zones { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .zones { grid-template-columns: 1fr; } }
.zcard { background: var(--bg-1); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: grid; gap: 6px; align-content: start; }
.zcard .sw { width: 34px; height: 6px; border-radius: 3px; background: var(--c); }
.zcard p { margin: 0; color: var(--dim); font-size: 14px; }
.list { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.list li { display: grid; grid-template-columns: 22px 1fr; gap: 8px; font-size: 14px; color: var(--dim); }
.tag-sm { font-family: var(--display); font-weight: 700; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
.screen { outline: none; overflow: clip; }
.screen[data-scene="plaza"] .toast, .screen[data-scene="farm"] .toast { top: auto; bottom: 130px; }
.screen.phone[data-scene="plaza"] .toast, .screen.phone[data-scene="farm"] .toast { bottom: 80px; }
.screen[data-scene="plaza"] .scene-switch, .screen[data-scene="farm"] .scene-switch { z-index: 30; }
.screen[data-scene="plaza"] .topbar .profile, .screen[data-scene="farm"] .topbar .profile { opacity: .92; }
.farm-card { cursor: pointer; background: linear-gradient(120deg, #3f7a3399, #0b1020c2 70%); }
.farm-card .fc { display: grid; gap: 4px; font-size: 13px; }
.farm-card .fc span { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.farm-card .fc .ico { width: 1.15em; height: 1.15em; vertical-align: 0; }
#leaf-pill .ico { width: 1.15em; height: 1.15em; vertical-align: 0; margin: 0; }
.farm-card .fc b { color: #d8ff8a; }
.screen.phone .farm-card .fc { font-size: 10px; gap: 1px; }
.screen.phone .journey-card { display: none; }
.side .mission.extra { display: none; }
.frame.fs { background: #05070f; position: fixed; inset: 0; z-index: 9999; height: 100% !important; }
#fs-btn { margin-left: auto; }
'''
rep('@media (prefers-reduced-motion: reduce) {', (D/'plaza.css').read_text() + (D/'farm.css').read_text() + (D/'hud.css').read_text() + (D/'mobile.css').read_text() + (D/'farmui.css').read_text() + extra_css + '\n@media (prefers-reduced-motion: reduce) {')

# ---- HTML: screen ----
cut('        <!-- PLAZA scene -->', '        <!-- top bar -->')
rep('<div class="screen" id="screen" data-scene="lobby">', '<div class="screen" id="screen" data-scene="lobby" tabindex="0">')
rep('''              <button type="button" id="sc-lobby" aria-pressed="true">Lobby</button>
              <button type="button" id="sc-plaza" aria-pressed="false">Plaza <span class="count" id="pop">24</span></button>''',
'''              <button type="button" id="sc-lobby" aria-pressed="true">Lobby</button>
              <button type="button" id="sc-plaza" aria-pressed="false">Plaza <span class="count">15</span></button>
              <button type="button" id="sc-farm" aria-pressed="false">Farm <span class="count" id="farm-count">3</span></button>''')
rep('<span id="coins">2,340</span></button>', '<span id="coins">2,340</span></button>\n            <button type="button" class="pill" id="leaf-pill" title="Gold Leaves: earned on the Farm and in the Plaza" style="cursor:pointer"><i class="ico-slot" data-ico="leaf"></i><span id="leaves">820</span></button>')
rep('''          <div class="card">
            <div class="card-head"><h4>Journey · this week</h4>''', '''          <div class="card farm-card" id="farm-card" role="button" tabindex="0">
            <div class="card-head"><h4>Farm</h4><span class="linkish">Enter →</span></div>
            <div class="fc" id="farm-card-body"></div>
          </div>
          <div class="card journey-card">
            <div class="card-head"><h4>Journey · this week</h4>''')
rep('''        <div id="layer"></div>''', (D/'plaza.html').read_text() + (D/'farm.html').read_text() + '''        <div id="layer"></div>''')

# ---- page sections: keep the demo section, replace the rest ----
demo_start = s.index('  <section aria-labelledby="demo-h">'); demo_end = s.rindex('</section>', demo_start, s.index('<section aria-labelledby="why-h">')) + len('</section>')
demo = s[demo_start:demo_end]
demo = demo.replace('<h2 id="demo-h">Demo bấm thử</h2>', '<h2 id="demo-h">Chơi thử</h2>')
demo = re.sub(r'<p class="try">.*?</p>', '<p class="try">Bấm <b>Sảnh · Plaza · Nông trại</b> ở giữa thanh trên. Plaza: bấm vào khung rồi dùng <b>WASD</b>, <b>Space</b>, <b>Shift</b>, <b>E</b>. Nông trại: chọn dụng cụ ở dưới rồi bấm hoặc kéo qua các ô đất.</p><button type="button" class="seg" id="fs-btn" style="padding:8px 16px;cursor:pointer;color:var(--text)">⛶ Toàn màn hình</button>', demo, flags=re.S)
demo = re.sub(r'<p class="frame-note">.*?</p>', '<p class="frame-note">Tướng và skin lấy từ repo. Toàn bộ nhà cửa, cây cối, đồ vật, động vật và cây trồng được vẽ mới bằng code cho demo, không dùng art cũ của game. Người chơi khác là bot. Coins, lá vàng, đồ đã có là dữ liệu mẫu; thời gian chạy theo đồng hồ thật, có nút tua nhanh trong Settings.</p>', demo, flags=re.S)
main_start = s.index('<main class="page">'); main_end = s.index('</main>') + len('</main>')
s = s[:main_start] + (D/'doc.html').read_text().replace('__DEMO__', demo) + s[main_end:]

# ---- JS ----
rep('const IMG = Object.fromEntries(', '''const assetsReady = Promise.resolve();
const ECON = { leaves: 2000, useTreat: () => null, treatCount: () => 0, farmStatus: null };
const fmtWallet = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\\.?0+$/, "")}M` : n.toLocaleString("en-US");
const fastTime = () => { try { return localStorage.getItem("ea-fast") === "1"; } catch { return false; } };
function updateWallet() { const el = document.getElementById("leaves"); if (el) el.textContent = fmtWallet(ECON.leaves); }
let scenesReady = false;
const IMG = Object.fromEntries(''')
# fit(): fullscreen + scene canvases
rep('''function fit() {
  const w = S.phone ? 844 : 1280, h = S.phone ? 390 : 800;
  const s = Math.min(1, frame.clientWidth / w);
  inner.style.transform = `scale(${s})`;
  inner.style.left = `${Math.max(0, (frame.clientWidth - w * s) / 2)}px`;
  frame.style.height = `${Math.round(h * s)}px`;
}''', '''/* ---------- fitting the game into the page (desktop, phones, full screen) ---------- */
const touchPhone = () => matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) < 560;
let pseudoFs = false;
const isFs = () => document.fullscreenElement === frame || pseudoFs;
function fit() {
  const fs = isFs(), h = S.phone ? 390 : 800, base = S.phone ? 844 : 1280;
  frame.classList.toggle("fs", fs); document.documentElement.classList.toggle("fs-lock", pseudoFs);
  // A phone held sideways also fits the inline frame to the screen height, like full screen.
  const inlinePhone = !fs && S.phone && touchPhone() && innerWidth > innerHeight;
  const cs = getComputedStyle(frame), pl = fs ? parseFloat(cs.paddingLeft) || 0 : 0, pr = fs ? parseFloat(cs.paddingRight) || 0 : 0, pt = fs ? parseFloat(cs.paddingTop) || 0 : 0, pb = fs ? parseFloat(cs.paddingBottom) || 0 : 0;
  const aw = (fs ? innerWidth : frame.clientWidth) - pl - pr, ah = fs ? innerHeight - pt - pb : inlinePhone ? innerHeight - 6 : Infinity;
  // Wide screens get a wider game screen (up to 1.7x); 16:9 phones get a narrower one (down to 700) instead of shrinking it all.
  const w = fs || inlinePhone ? Math.round(Math.min(base * 1.7, Math.max(S.phone ? 700 : base, h * aw / ah))) : base;
  if (screen.offsetWidth !== w) { screen.style.width = `${w}px`; if (scenesReady) { layoutStage(); renderStage(); seedCrowd(); } }
  screen.classList.toggle("narrow", S.phone && w < 780);
  const s = fs ? Math.min(aw / w, ah / h) : inlinePhone ? Math.min(1.3, aw / w, ah / h) : Math.min(1, aw / w);
  inner.style.transform = `scale(${s})`;
  inner.style.left = `${pl + Math.max(0, (aw - w * s) / 2)}px`;
  inner.style.top = fs ? `${pt + Math.max(0, (ah - h * s) / 2)}px` : "0px";
  frame.style.height = fs ? "100%" : `${Math.round(h * s)}px`;
  if (scenesReady) { const ps = Math.min(2.5, s * (devicePixelRatio || 1)); PZ.resize(w, h, ps); FM.resize(w, h, ps); }
}
// Full screen: the real Fullscreen API where it exists, otherwise (iPhone, embedded pages) the frame simply covers the window.
function enterFs() {
  const go = frame.requestFullscreen?.({ navigationUI: "hide" });
  if (go) go.then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => { pseudoFs = true; fit(); });
  else { pseudoFs = true; fit(); }
}
function exitFs() { if (document.fullscreenElement) document.exitFullscreen?.(); pseudoFs = false; fit(); }
const toggleFs = () => isFs() ? exitFs() : enterFs();
document.addEventListener("fullscreenchange", () => setTimeout(fit, 50));
document.addEventListener("keydown", e => { if (e.key === "Escape" && pseudoFs) exitFs(); });
screen.addEventListener("scroll", () => { if (screen.scrollTop || screen.scrollLeft) { screen.scrollTop = 0; screen.scrollLeft = 0; } });
$("fs-btn").onclick = toggleFs;
// Phones: turn-sideways cover in portrait; switch to the phone layout when turned sideways; one tap to play full screen.
frame.insertAdjacentHTML("beforeend", `<div class="rotate-gate" aria-live="polite"><i class="ph"></i><b>Turn your phone sideways</b><span>Element Arena plays in landscape. Rotate your phone to play the demo.</span></div>`);
function phoneCheck() {
  if (!touchPhone()) return;
  if (innerWidth > innerHeight && !S.phone) setDevice(true);
  const want = innerWidth > innerHeight && !isFs() && !sessionStorageSafe("tapPlayDone");
  let tp = frame.querySelector(".tap-play");
  if (want && !tp) {
    frame.insertAdjacentHTML("beforeend", `<div class="tap-play"><button type="button" class="go">▶ Play full screen</button><button type="button" class="here">Play here</button></div>`);
    tp = frame.querySelector(".tap-play");
    tp.querySelector(".go").onclick = () => { sessionStorageSafe("tapPlayDone", 1); tp.remove(); enterFs(); };
    tp.querySelector(".here").onclick = () => { sessionStorageSafe("tapPlayDone", 1); tp.remove(); frame.scrollIntoView({ block: "start", behavior: "smooth" }); };
  } else if (!want && tp) tp.remove();
}
function sessionStorageSafe(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } }
addEventListener("resize", () => { phoneCheck(); fit(); });
addEventListener("orientationchange", () => setTimeout(() => { phoneCheck(); fit(); }, 120));''')
rep('function setCoins() { $("coins").textContent = fmt(E.coins); }', 'function setCoins() { $("coins").textContent = fmtWallet(E.coins); }')
rep('/* ---------- drawers ---------- */', (D/'progress.js').read_text() + '\n/* ---------- drawers ---------- */')
s = re.sub(r'    case "journey": return \["This week", "Journey".*?\n', '    case "journey": return PROG.journey();\n', s, count=1)
s = re.sub(r'    case "missions": return \["Notice Board", "Missions".*?\n', '    case "missions": return PROG.missions();\n', s, count=1)
assert 'PROG.journey()' in s and 'PROG.missions()' in s
rep('  bindFriendButtons(el);\n', '  bindFriendButtons(el);\n  PROG.bind(el, kind);\n')
s = re.sub(r'<div class="card journey-card">\s*<div class="card-head"><h4>Journey · this week</h4>.*?</div>\s*<div class="mission">.*?</div></div>\s*<div class="mission extra">.*?</div></div>\s*</div>',
           '<div class="card journey-card">\n            <div class="card-head"><h4>Journey · Aurora Trails</h4><button type="button" class="linkish" data-drawer="journey">Open</button></div>\n            <div class="jr-card" id="jr-card"></div>\n          </div>', s, count=1, flags=re.S)
assert 'id="jr-card"' in s
s = re.sub(r'(<button type="button" data-drawer="journey" aria-expanded="false">.*?<span>Journey</span>)', r'\1<i class="badge green" hidden></i>', s, count=1, flags=re.S)
assert 'Journey</span><i class="badge green" hidden></i>' in s
rep("""    case "settings": return ["Settings", "Settings", '<p class="note-demo">Graphics, controls and audio settings.</p>'];""", """    case "settings": return ["Settings", "Settings", `<div class="list-row"><span class="sw" style="--c:#4fb3ff"></span><span><b>Full screen</b><small>Hide the page around the game. On iPhone the game covers the browser window.</small></span><button type="button" class="mini-btn" data-fs>${isFs() ? "Exit" : "Enter"}</button></div><div class="list-row"><span class="sw" style="--c:#7ff0a2"></span><span><b>Fast demo time</b><small>${fastTime() ? "On: one farm day passes in 6 minutes." : "Off: crops, weather and shops follow the real clock."} Turn on to try a whole day quickly.</small></span><button type="button" class="mini-btn" data-fasttime>${fastTime() ? "Turn off" : "Turn on"}</button></div><div class="list-row"><span class="sw" style="--c:#ff8a6a"></span><span><b>Reset demo farm</b><small>Your farm is saved on this device so crops keep growing while you are away. This starts it over.</small></span><button type="button" class="mini-btn" data-resetfarm>Reset</button></div><p class="note-demo">Graphics, controls and audio settings live here in the real game.</p>`];""")
rep('  PROG.bind(el, kind);\n', '  PROG.bind(el, kind);\n  el.querySelector("[data-fs]")?.addEventListener("click", e => { e.stopPropagation(); closeLayer(); toggleFs(); });\n  el.querySelector("[data-fasttime]")?.addEventListener("click", e => { e.stopPropagation(); try { localStorage.setItem("ea-fast", fastTime() ? "0" : "1"); } catch { } FM.save(); location.reload(); });\n  el.querySelector("[data-resetfarm]")?.addEventListener("click", e => { e.stopPropagation(); FM.reset(); location.reload(); });\n')
rep("  const off = S.phone ? [-150, 150, -262] : [-222, 222, -398];", "  // narrow phones pull the party slots in so the far-left one never slides under the side menu\n  const kx = S.phone ? Math.max(.6, Math.min(1, (screen.offsetWidth * .45 - 101) / 262)) : 1;\n  const off = (S.phone ? [-150, 150, -262] : [-222, 222, -398]).map(v => Math.round(v * kx));")
# lobby emotes only on the stage
rep('''  const host = S.scene === "plaza" ? plaza.querySelector(".you") : $("stage").querySelector(".main");
  if (host) bubbleOn(host, b.dataset.emote, S.scene === "plaza");''', '''  const host = $("stage").querySelector(".main");
  if (host) bubbleOn(host, b.dataset.emote, false);''')
rep('const plaza = $("plaza"), horizon = $("horizon");', 'const horizon = $("horizon");')
rep('''  horizon.innerHTML = ""; plaza.querySelectorAll(".walker").forEach(w => w.remove());''', '''  horizon.innerHTML = "";''')
rep('''  const nPlaza = 13, nLobby = S.phone ? 6 : 9;
  for (let i = 0; i < nPlaza; i++) {
    const z = ZONES[zonesW[i % zonesW.length]], p = zonePoint(z);
    crowd.push(makeWalker(plaza, { name: CROWD_NAMES[i], c: CH[(i * 5 + 2) % 8].id, x: p.x, y: p.y, zone: z, pct: true }));
  }''', '''  const nLobby = S.phone ? 6 : 9;''')
rep('''  you = makeWalker(plaza, { name: "tester", c: CH[S.champ].id, x: 50, y: 78, pct: true, you: true });
  $("pop").textContent = String(nPlaza + 11);''', '')
rep('function placeYou() { if (you) you.el.querySelector("img").src = heroArt(CH[S.champ].id); }', 'function placeYou() {}')
cut('/* ---------- plaza hotspots ---------- */', '/* ======================================================================\n   SHOP & WARDROBE')
# scenes
rep('''function setScene(sc) {
  S.scene = sc; screen.dataset.scene = sc; closeLayer();
  $("sc-lobby").setAttribute("aria-pressed", String(sc === "lobby"));
  $("sc-plaza").setAttribute("aria-pressed", String(sc === "plaza"));
  plaza.setAttribute("aria-hidden", String(sc !== "plaza"));
  placeYou();
}
$("sc-lobby").onclick = () => { if (S.scene === "fit") closeFit(); else setScene("lobby"); };
$("sc-plaza").onclick = () => { screen.querySelectorAll(".rail [data-fit]").forEach(b => b.setAttribute("aria-expanded", "false")); setScene("plaza"); };''',
'''/* SKIN names for any skin key ("id:stage") */
const SKIN = {};
SKINS.forEach(s => [1, 2, 3].forEach(st => { SKIN[`${s.id}:${st}`] = [s.name, `${RAR_NAME[s.rarity]}${s.rarity === "mythical" ? ` · Stage ${"I".repeat(st)}` : ""}`]; }));

__PLAZA_JS__

__FARM_JS__

function setScene(sc) {
  const prev = S.scene;
  if (prev === "plaza" && sc !== "plaza") PZ.leave();
  if (prev === "farm" && sc !== "farm") FM.leave();
  S.scene = sc; screen.dataset.scene = sc; closeLayer();
  $("sc-lobby").setAttribute("aria-pressed", String(sc === "lobby" || sc === "fit"));
  $("sc-plaza").setAttribute("aria-pressed", String(sc === "plaza"));
  $("sc-farm").setAttribute("aria-pressed", String(sc === "farm"));
  if (sc === "plaza") assetsReady.then(() => { if (S.scene === "plaza") PZ.enter(); });
  if (sc === "farm") assetsReady.then(() => { if (S.scene === "farm") FM.enter(); });
  if (sc === "lobby") renderFarmCard();
}
function setSceneMain(sc) { screen.querySelectorAll(".rail [data-fit]").forEach(b => b.setAttribute("aria-expanded", "false")); setScene(sc); }
function renderFarmCard() {
  if (!ECON.farmStatus) return;
  const f = ECON.farmStatus();
  $("farm-card-body").innerHTML = `<span><span class="fc-l">${I("wheat")}<em>${f.ripe}</em><i class="w">ripe</i><span class="fc-sep">·</span>${I("bug")}<em>${f.pests}</em><i class="w">bugs</i></span><b class="fc-r">${I(f.weather.ic)}<span>${f.weather.n}</span></b></span><span><span class="fc-l">${I("dog")}<span class="fc-dog">${f.dog}</span></span></span>`;
  $("farm-count").textContent = String(f.ripe);
}
setInterval(() => { if (S.scene === "lobby") renderFarmCard(); else if (ECON.farmStatus) $("farm-count").textContent = String(ECON.farmStatus().ripe); }, 3000);
$("farm-card").onclick = () => setSceneMain("farm");
$("leaf-pill").onclick = e => { e.stopPropagation(); setSceneMain("farm"); };
$("sc-lobby").onclick = () => { if (S.scene === "fit") closeFit(); else setScene("lobby"); };
$("sc-plaza").onclick = () => setSceneMain("plaza");
$("sc-farm").onclick = () => setSceneMain("farm");''')
rep('layoutStage(); renderAll(); seedCrowd(); fit();\n})();', 'scenesReady = true; fillIconSlots(screen); PROG.sync(); setTimeout(phoneCheck, 0);\nlayoutStage(); renderAll(); seedCrowd(); fit(); updateWallet(); renderFarmCard();\nsetTimeout(() => { try { $("bg").style.backgroundImage = `url(${PZ.snapshot()})`; } catch (e) { console.error(e); } }, 30);\n})();')
s = s.replace('<div class="bg" id="bg" style="background-image:url(__PLAZA__)"></div>', '<div class="bg" id="bg"></div>')
s = s.replace('(S.phone ? 844 : 1280)', 'screen.offsetWidth').replace('const W = S.phone ? 844 : 1280, H = S.phone ? 390 : 800;', 'const W = screen.offsetWidth, H = screen.offsetHeight;')
s = s.replace('$("dev-desktop").onclick = () => setDevice(false);', 'if (matchMedia("(pointer: coarse)").matches && innerWidth > innerHeight && innerHeight < 560) setTimeout(() => setDevice(true), 0);\n$("dev-desktop").onclick = () => setDevice(false);')
s = s.replace('  S.phone = phone;\n  screen.classList.toggle("phone", phone);', '  S.phone = phone;\n  screen.classList.toggle("phone", phone); screen.style.width = "";')
s = s.replace('__PLAZA_JS__', (D/'icons.js').read_text() + '\n' + (D/'art.js').read_text() + '\n' + (D/'plaza.js').read_text()).replace('__FARM_JS__', (D/'crops.js').read_text() + '\n' + (D/'farm.js').read_text())
(D/'template.html').write_text(s)
print('assembled', len(s)//1024, 'KB')
