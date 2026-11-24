/* ======================================================================
   JOURNEY vs MISSIONS (they are two different things in the real game):
   - Missions (as in the real game): 6 daily tasks, +40 / +70 / +120 coins and 50 XP each,
     5 changes a day, +50 coins for all six, +300 coins on every 7th all-six day.
   - Journey (proposed): player level 1–100 (Lv 1–50 unchanged), Daily Spark (first 500 XP
     each day count double), 30-tier season road (1,200 XP per tier, 50 coins per tier,
     cosmetics at tiers 5/12/20/30) + 4 weekly goals worth 250 season XP each.
   ====================================================================== */
const PROG = (() => {
  const POOL = { // [mission, target] — a sample of the real game's 30 daily missions
    easy: [["Play 2 matches", 2], ["Use 30 skills", 30], ["Finish a raid, win or lose", 1], ["Play for 10 minutes", 10]],
    med: [["Win a match", 1], ["Clear a raid as Voltkit or Auralynx", 1], ["Use your ultimate 3 times", 3], ["Win 3 matches against bots", 3]],
    hard: [["Beat 3 Hard bots", 3], ["Win 2 matches against players", 2], ["Clear a raid with no downs", 1], ["Clear 2 raids on your own", 2]],
  };
  const PAY = { easy: [40, 50], med: [70, 50], hard: [120, 50] }; // coins, XP (real game: 50 XP for every mission)
  const M = [
    { t: "Play 2 matches", d: "easy", n: 2, max: 2, claimed: true },
    { t: "Use 30 skills", d: "easy", n: 18, max: 30 },
    { t: "Win a match", d: "med", n: 1, max: 1 },
    { t: "Clear a raid as Voltkit or Auralynx", d: "med", n: 0, max: 1 },
    { t: "Beat 3 Hard bots", d: "hard", n: 3, max: 3 },
    { t: "Win 2 matches against players", d: "hard", n: 1, max: 2 },
  ];
  const J = {
    lv: 12, into: 140, changes: 5, streak: 3, spark: 380, tier: 7, txp: 540, TIER_XP: 1200, TIERS: 30, MAX: 100,
    season: { name: "Aurora Trails", c: "#9ff3d8", a: "#b6a0ff" },
    weekly: [
      { t: "Finish 5 matches or raids", n: 3, max: 5, xp: 250 },
      { t: "Use 50 skills", n: 50, max: 50, xp: 250 },
      { t: "Clear 2 raids", n: 1, max: 2, xp: 250 },
      { t: "Finish 3 weekly arcade matches", n: 0, max: 3, xp: 250 },
    ],
  };
  // season tiers: 50 coins each; the four seasonal cosmetics sit at tiers 5 / 12 / 20 / 30
  const COSM = { 5: ["crest", "Aurora frame"], 12: ["aura", "Aurora aura"], 20: ["decor", "Aurora colors"], 30: ["spark", "Aurora finale"] };
  const reward = t => COSM[t] ? [COSM[t], true] : [["coin", "50 coins"], false];
  // account level: Lv 1–50 exactly as today, then a climb to 9,000 XP per level by Lv 70 and ~1 level a week after
  const xpNext = L => L < 50 ? 100 + 25 * (L - 1) : L < 70 ? Math.round((1300 + 7700 * ((L - 49) / 21) ** 1.3) / 50) * 50 : 9000 + 75 * (L - 69);
  const LV_REWARD = { 15: "Comet arrival", 20: "Trailblazer aura", 25: "Aurora colors", 30: "Title: Arena Vanguard", 35: "Meteor finale", 40: "Champion laurel", 45: "Astral aura", 50: "Title: Elemental Legend", 55: "Prism frame", 60: "Title: Arena Veteran", 65: "Nova entrance", 70: "Starlit colors", 75: "Title: Mythic Champion", 80: "Solar aura", 85: "Eclipse finale", 90: "Title: Ascendant", 95: "Prismatic laurel", 100: "Title: Element Master + prismatic frame" };
  const lvCoins = L => L < 50 ? 30 : 100;
  // Daily Spark: the first 500 XP each day count double (catch-up for people who play less)
  function gainXP(x) {
    const bonus = Math.min(x, J.spark); J.spark -= bonus; const got = x + bonus; let ups = 0;
    J.into += got; while (J.lv < J.MAX && J.into >= xpNext(J.lv)) { J.into -= xpNext(J.lv); J.lv++; ups++; E.coins += lvCoins(J.lv); }
    if (ups) setCoins();
    return { got, bonus, ups, tierUps: addSeasonXP(got) };
  }
  const done = m => m.n >= m.max, claimable = () => M.filter(m => done(m) && !m.claimed).length;
  // real-world clocks: missions renew at local midnight, weekly goals on Monday 00:00, a season is one calendar month
  const dur = ms => { const m = Math.max(1, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d}d${h ? ` ${h}h` : ""}` : h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`; };
  const toMidnight = () => { const n = new Date(), t = new Date(n); t.setHours(24, 0, 0, 0); return t - n; };
  const toMonday = () => { const n = new Date(), t = new Date(n); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + ((8 - t.getDay()) % 7 || 7)); return t - n; };
  const toMonthEnd = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 1) - n; };
  const weeklyClaimable = () => J.weekly.filter(w => w.n >= w.max && !w.claimed).length;
  const pct = (a, b) => `${Math.min(100, a / b * 100)}%`;

  function sync() {
    E.missions = { done: M.filter(done).length, total: M.length, left: M.filter(m => !done(m)).reduce((a, m) => a + PAY[m.d][0], 0) };
    const mb = document.querySelector('.rail [data-drawer="missions"] .badge'); if (mb) { const n = claimable(); mb.textContent = n; mb.hidden = !n; }
    const jb = document.querySelector('.rail [data-drawer="journey"] .badge'); if (jb) { const n = weeklyClaimable(); jb.textContent = n; jb.hidden = !n; }
    const card = document.getElementById("jr-card"); if (card) card.innerHTML = cardHTML();
  }
  function cardHTML() {
    const nx = [5, 12, 20, 30].find(t => t > J.tier) ?? 30, [[, nm]] = reward(nx);
    return `<div class="jr-row"><b>Tier ${J.tier}</b><span>${J.txp}/${J.TIER_XP} XP</span></div><div class="jr-bar"><i style="width:${pct(J.txp, J.TIER_XP)}"></i></div><small class="jr-next">${I("crest")}<span>Next: ${nm} at tier ${nx}</span></small>`;
  }
  function addSeasonXP(x) {
    J.txp += x; let up = 0;
    while (J.txp >= J.TIER_XP && J.tier < J.TIERS) { J.txp -= J.TIER_XP; J.tier++; up++; }
    return up;
  }

  function missions() {
    const rows = M.map((m, i) => {
      const ok = done(m), [co, xp] = PAY[m.d];
      const act = m.claimed ? `<span class="ms-done">${I("star")}<span>Claimed</span></span>`
        : ok ? `<button type="button" class="mini-btn ms-claim" data-mclaim="${i}">Claim</button>`
        : `<button type="button" class="mini-btn ms-swap" data-mswap="${i}" ${J.changes ? "" : "disabled"} title="Change this mission">↻</button>`;
      // the difficulty sits in the reward line, so the mission name gets the full width and can wrap
      return `<div class="ms-row d-${m.d}${m.claimed ? " claimed" : ""}"><div class="ms-main"><div class="row"><span class="ms-t">${m.t}</span><span class="ms-n">${Math.min(m.n, m.max)}/${m.max}</span></div><div class="bar"><i style="width:${pct(m.n, m.max)}"></i></div><small class="ms-pay"><span class="ms-diff">${{ easy: "Easy", med: "Medium", hard: "Hard" }[m.d]}</span><i class="coin sm"></i><span class="ms-co">${co}</span><span class="ms-sep">·</span><span>+${xp} XP</span></small></div>${act}</div>`;
    }).join("");
    return [`Daily · new missions in ${dur(toMidnight())}`, "Missions", `<div class="ms-top"><span>${M.filter(done).length}/6 done · all six: +50 coins</span><span>${J.changes} change${J.changes === 1 ? "" : "s"} left</span></div>${rows}<div class="ms-streak"><span>All-six streak</span><span class="dots">${Array.from({ length: 7 }, (_, k) => `<i class="${k < J.streak ? "on" : ""}"></i>`).join("")}</span><span>day 7: +300 coins</span></div><p class="note-demo">Missions pay 40 / 70 / 120 coins and 50 XP each. XP also fills your season road. Tap ↻ to swap a mission you don't like.</p>`];
  }

  function journey() {
    const road = Array.from({ length: J.TIERS }, (_, k) => {
      const t = k + 1, [[ic, nm], big] = reward(t), st = t < J.tier ? "got" : t === J.tier ? "cur" : "lock";
      return `<div class="jr-tier ${st}${big ? " big" : ""}" title="Tier ${t}: ${nm}"><small>${t}</small><span class="jr-ic">${I(ic)}</span><em>${nm}</em>${st === "got" ? `<b class="jr-tick">✓</b>` : st === "lock" ? `<b class="jr-lock">${I("lock")}</b>` : ""}</div>`;
    }).join("");
    const weekly = J.weekly.map((w, i) => {
      const ok = w.n >= w.max;
      const act = w.claimed ? `<span class="ms-done">${I("star")}<span>Claimed</span></span>` : ok ? `<button type="button" class="mini-btn ms-claim" data-wclaim="${i}">Claim</button>` : `<span class="ms-xp">+${w.xp} XP</span>`;
      return `<div class="ms-row wk${w.claimed ? " claimed" : ""}"><div class="ms-main"><div class="row"><span class="ms-t">${w.t}</span><span class="ms-n">${Math.min(w.n, w.max)}/${w.max}</span></div><div class="bar"><i style="width:${pct(w.n, w.max)}"></i></div></div>${act}</div>`;
    }).join("");
    return [`Season · ${J.season.name}`, "Journey", `
      <div class="jr-head" style="--sc:${J.season.c};--sa:${J.season.a}">
        <div class="jr-lv"><b>${J.lv}</b><small>Level</small></div>
        <div class="jr-meta"><div class="jr-row"><b>${J.season.name}</b><span>Tier ${J.tier} / ${J.TIERS}</span></div><div class="jr-bar"><i style="width:${pct(J.txp, J.TIER_XP)}"></i></div><div class="jr-row sm"><span>${J.txp}/${J.TIER_XP} XP to tier ${Math.min(J.TIERS, J.tier + 1)}</span><span>ends in ${dur(toMonthEnd())}</span></div></div>
      </div>
      <div class="jr-road" id="jr-road">${road}</div>
      <div class="jr-spark">${I("spark")}<span><b>Daily Spark</b> · the next ${J.spark} XP today count double · renews in ${dur(toMidnight())}</span><div class="jr-bar"><i style="width:${pct(500 - J.spark, 500)}"></i></div></div>
      <h5 class="jr-h">This week <span>250 season XP each · resets in ${dur(toMonday())}</span></h5>${weekly}
      <h5 class="jr-h">Level ${J.lv} / ${J.MAX} <span>${J.into}/${xpNext(J.lv)} XP</span></h5>
      <div class="jr-lvroad">${Object.entries(LV_REWARD).filter(([L]) => +L > J.lv).slice(0, 4).map(([L, n]) => `<div><b>Lv ${L}</b><span>${n}</span></div>`).join("")}</div>
      <p class="note-demo">Every level gives coins (30 up to Lv 50, then 100). Lv 1–50 are unchanged; 51–100 take about a week each at the top. XP never changes fighter stats.</p>`];
  }

  function bind(el, kind) {
    if (kind !== "missions" && kind !== "journey") return;
    // the clicked button is replaced on redraw, so clicks must not bubble to the "click outside closes" handler
    const redraw = () => { el.querySelector(".body").innerHTML = (kind === "missions" ? missions() : journey())[2]; if (kind === "missions") el.querySelector("header .k").textContent = missions()[0]; sync(); bind2(); };
    const bind2 = () => {
      el.querySelectorAll("[data-mclaim]").forEach(b => b.onclick = e => { e.stopPropagation(); const m = M[+b.dataset.mclaim], [co, xp] = PAY[m.d]; m.claimed = true; E.coins += co; if (M.every(x => x.claimed)) { E.coins += 50; J.streak++; if (J.streak % 7 === 0) E.coins += 300; } setCoins(); const r = gainXP(xp); toast(`+${co} coins · +${r.got} XP${r.bonus ? " (Spark ×2)" : ""}${r.ups ? ` · Level ${J.lv}!` : ""}${r.tierUps ? ` · tier ${J.tier}` : ""}`); redraw(); });
      el.querySelectorAll("[data-mswap]").forEach(b => b.onclick = e => { e.stopPropagation(); const m = M[+b.dataset.mswap], used = new Set(M.map(x => x.t)), opts = POOL[m.d].filter(([t]) => !used.has(t)); if (!opts.length || !J.changes) return; [m.t, m.max] = opts[Math.floor(Math.random() * opts.length)]; m.n = 0; J.changes--; toast(`New mission: ${m.t}`); redraw(); });
      el.querySelectorAll("[data-wclaim]").forEach(b => b.onclick = e => { e.stopPropagation(); const w = J.weekly[+b.dataset.wclaim]; w.claimed = true; const up = addSeasonXP(w.xp); toast(`+${w.xp} season XP${up ? ` · tier ${J.tier} reached!` : ""}`); redraw(); });
      const road = el.querySelector("#jr-road"), cur = road?.querySelector(".cur"); if (road && cur) road.scrollLeft = cur.offsetLeft - road.clientWidth / 2 + cur.offsetWidth / 2;
    };
    bind2();
  }
  return { missions, journey, bind, sync, cardHTML };
})();
