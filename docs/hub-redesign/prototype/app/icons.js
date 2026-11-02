/* ======================================================================
   ICONS: one illustrated set (24×24, duotone, dark outline) for the whole hub.
   Used in HTML (I(name) / [data-ico]) and drawn on canvas (ICON_IMG(name)),
   so the tool bar, the cursor and canvas signs always match.
   ====================================================================== */
const ICON_SRC = (() => {
  // No dark ink outline: every shape is outlined in a deeper shade of its own
  // colour, so icons read on the navy UI and on the grass without a white rim.
  const shade = f => { let h = f.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join(""); const n = parseInt(h.slice(0, 6), 16), t = [34, 22, 52], k = .42; return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v, i) => Math.round(v * (1 - k) + t[i] * k).toString(16).padStart(2, "0")).join(""); };
  const O = f => /^#[0-9a-f]{3,8}$/i.test(f) ? `stroke="${shade(f)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"` : 'stroke="none"';
  const p = (d, f) => `<path d="${d}" fill="${f}" ${O(f)}/>`;
  const c = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${O(f)}/>`;
  const r = (x, y, w, h, rx, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${O(f)}/>`;
  const l = (d, w = 1.5, col = "#6a5238") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const hl = d => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>`;
  const can = (a, b) => p("M14 9l6-4 1.4 1.4-5.4 6", b) + r(3, 8, 12, 12, 3, a) + l("M5 8a4.5 4.5 0 0 1 8 0", 1.8, a) + hl("M6 11v6");
  const bag = (a, b, mark) => p("M6 9c-1 7 0 12 6 12s7-5 6-12z", a) + `<ellipse cx="12" cy="8.5" rx="6" ry="2.4" fill="${b}" ${O(b)}/>` + mark;
  return {
    leaf: p("M5 19C5 10 10 5 20 4c0 10-5 15-15 15z", "#7fd65a") + l("M5 19 14 10", 1.5, "#3f8a2e") + hl("M9 11c2-2 4-3 7-4"),
    coin: c(12, 12, 8, "#ffd65b") + c(12, 12, 5, "#ffe58f") + l("M12 9.5v5", 1.5, "#b8862a"),
    hand: p("M7 21v-7l-2.5-3.2a1.5 1.5 0 0 1 2.3-1.9L8 10V5.5a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v6c0 3-2 6-5 6z", "#fff4e0") + l("M11 5.5V11M14 5.5V11M17 9v3", 1.5, "#c49a70") + r(7, 18.5, 10, 2.5, 1, "#ef4f61"),
    seed: bag("#d9b07a", "#9a6a3a", c(12, 15, 2.4, "#7cc95a") + l("M12 12.6c1-2 2.5-2.6 3.5-2.3", 1.3, "#3f8a2e")),
    can: can("#c98d52", "#8a5a2c"), can2: can("#ef9a52", "#a85a20"), can3: can("#ffd65b", "#c9952a"),
    fert: bag("#9be07a", "#4f9a3c", p("M12 17c-3 0-3-4 0-5 3 1 3 5 0 5z", "#fff")),
    fertSuper: bag("#7fe7ff", "#1f9fb8", p("M13 11l-3 4h3l-1 4 3-5h-3z", "#fff")),
    fertGold: bag("#ffd65b", "#c9952a", p("M12 11l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8L8 13.9l2.8-.3z", "#fff")),
    net: l("M4 21 12 12", 3, "#9a6a3a") + `<ellipse cx="15.5" cy="8.5" rx="5" ry="5.5" fill="#e6f4ff" ${O("#e6f4ff")}/>` + l("M12.5 5v7M15.5 3.5v10M18.5 5v7M10.8 7h9.4M10.8 10h9.4", 1, "#5f8cc0"),
    sickle: l("M6 21l3-7", 3.2, "#8a5a2c") + p("M9 14C8 7 13 3 20 5c-5 1-8 4-8 9z", "#dfe6ef") + hl("M11 10c1-2 3-3.5 6-4"),
    shovel: l("M12 3v11", 3, "#8a5a2c") + l("M9 3h6", 3, "#c9a36a") + p("M8 14h8v3c0 3-2 5-4 5s-4-2-4-5z", "#c5cfdc") + hl("M10 16v2"),
    bug: `<ellipse cx="12" cy="14" rx="7" ry="6" fill="#5b45a8" ${O("#5b45a8")}/>` + c(9.5, 12.5, 1.8, "#fff") + c(14.5, 12.5, 1.8, "#fff") + l("M9 8 7.5 5M15 8l1.5-3", 1.5, "#a896f5"),
    gift: r(4, 10, 16, 11, 2, "#ff6f9a") + r(3, 7, 18, 4, 1.5, "#ff8fb1") + l("M12 7v14", 1.5, "#c2456e") + p("M12 7c-2-4-6-3-4 0zM12 7c2-4 6-3 4 0z", "#ffd65b"),
    shop: p("M4 10h16l-1.5 10h-13z", "#ffd65b") + p("M3 6h18l-1 4H4z", "#ef4f61") + l("M9 10V8M15 10V8", 1.5, "#a8323f") + hl("M7 13v4"),
    orders: r(5, 4, 14, 17, 2, "#fff8e6") + r(8.5, 2.5, 7, 3.5, 1.2, "#c98d52") + l("M8.5 10h7M8.5 13.5h7M8.5 17h4", 1.5, "#b0956a"),
    market: r(3, 4, 18, 16, 3, "#e6f4ff") + p("M6 16l4-4 3 2 5-6", "none") + l("M6 16l4-4 3 2 5-6", 2, "#43a86a") + c(18, 8, 1.4, "#43a86a"),
    barn: p("M3 11l9-7 9 7v10H3z", "#ef5a48") + l("M2 11l10-8 10 8", 1.6, "#b8382c") + r(8.5, 13, 7, 8, .5, "#fff6ea") + l("M8.5 13l7 8M15.5 13l-7 8", 1.2, "#c0483a"),
    book: p("M4 5c3-1.5 6-1.5 8 0v15c-2-1.5-5-1.5-8 0z", "#7fb8ff") + p("M20 5c-3-1.5-6-1.5-8 0v15c2-1.5 5-1.5 8 0z", "#a8d0ff") + c(16, 10, 1.6, "#7cc95a"),
    decor: p("M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.6-1.4.4-2.8 2-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z", "#ffe0b8") + c(7.5, 11, 1.6, "#ef4f61") + c(10, 7, 1.6, "#ffd65b") + c(14.5, 7, 1.6, "#4fb3ff") + c(17, 11, 1.6, "#7cc95a"),
    friends: c(8.5, 8, 3.3, "#ffd3a8") + p("M2.5 20c.5-4 3-6 6-6s5.5 2 6 6z", "#4fb3ff") + c(16.5, 9, 2.8, "#ffd3a8") + p("M13.5 14.5c1-1 2-1.4 3-1.4 2.5 0 4.5 2 5 5.4h-6", "#ff9bd2"),
    dog: p("M6 9c0-3 2.5-5 6-5s6 2 6 5v4c0 4-2.5 7-6 7s-6-3-6-7z", "#e8a94c") + p("M6 8c-2 0-3 3-2.5 6 1 0 2.5-1 2.5-3zM18 8c2 0 3 3 2.5 6-1 0-2.5-1-2.5-3z", "#b5762c") + `<ellipse cx="12" cy="15.5" rx="3.5" ry="2.6" fill="#fbe0a8" ${O("#fbe0a8")}/>` + c(12, 14.4, 1.1, "#2a1f12") + c(9.3, 11, .9, "#2a1f12") + c(14.7, 11, .9, "#2a1f12"),
    cow: `<ellipse cx="12" cy="12.5" rx="7" ry="7.5" fill="#fff" ${O("#fff")}/>` + p("M8 7c1 2 3 2 3 0-1-1.5-2-1.5-3 0zM15 13c1.5-.5 2.5.5 2 2-1 .5-2.5 0-2-2z", "#2a2430") + `<ellipse cx="12" cy="16.5" rx="4.5" ry="3" fill="#ffb3c1" ${O("#ffb3c1")}/>` + l("M5 8 3 6M19 8l2-2", 1.5, "#ead6ae"),
    fish: p("M3 12c3-4 9-5 14 0-5 5-11 4-14 0z", "#ff8a3d") + p("M17 12l4-3v6z", "#ffb36b") + c(7.5, 11.2, .9, "#2a1f12"),
    sign: l("M12 13v8", 2.5, "#8a5a2c") + r(4, 5, 16, 9, 2, "#ef5a48") + l("M7.5 9.5h9", 1.6, "#fff4d6"),
    sprout: p("M12 21v-8", "none") + l("M12 21v-8", 2, "#4f9a3c") + p("M12 13C12 9 9 7 5 7c0 4 3 6 7 6z", "#7cc95a") + p("M12 12c0-3 2.5-5 6-5 0 3-2.5 5-6 5z", "#9be07a"),
    wheat: l("M12 21V7", 1.8, "#c9952a") + [5, 8.5, 12].map((y, i) => p(`M12 ${y + 3}c-3 0-4-2-4-4 2 0 4 1 4 4zM12 ${y + 3}c3 0 4-2 4-4-2 0-4 1-4 4z`, "#ffd65b")).join("") + p("M12 7c-1-2 0-4 0-4s1 2 0 4z", "#ffd65b"),
    clock: c(12, 12, 8.5, "#fff8e6") + l("M12 7.5V12l3 2", 1.8, "#6a5238"),
    broom: l("M17 3 11 13", 2.5, "#8a5a2c") + p("M11 12l-6 3c-1 2 0 4 1 5l2-1 1 2 2-1 1 1c1-2 2-4 1-7z", "#ffd65b") + l("M8 16l2 3M11 15l1 3", 1, "#b8862a"),
    orb: c(12, 12, 7, "#c9a3ff") + c(12, 12, 3.5, "#f3e8ff") + hl("M8 9a5 5 0 0 1 3-2"),
    camera: r(3, 7, 18, 13, 3, "#7383b3") + r(8, 4.5, 8, 4, 1.5, "#7383b3") + c(12, 13.5, 4, "#8fd0ff") + c(17.5, 10, 1, "#ef4f61"),
    boba: p("M6 8h12l-1.6 12.5a1.5 1.5 0 0 1-1.5 1.3H9.1a1.5 1.5 0 0 1-1.5-1.3z", "#f1d3b0") + r(5, 6, 14, 3, 1.2, "#ff9bd2") + l("M14 6l2-4", 2, "#ff7fb0") + [9.5, 12, 14.5].map(x => `<circle cx="${x}" cy="18.5" r="1.3" fill="#3a2214"/>`).join(""),
    clipboard: r(5, 4, 14, 17, 2, "#e6f4ff") + r(8.5, 2.5, 7, 3.5, 1.2, "#4fb3ff") + l("M8.5 10l1.5 1.5 3-3M8.5 16h7", 1.5, "#3f7fc0"),
    trophy: p("M7 4h10v5a5 5 0 0 1-10 0z", "#ffd65b") + p("M7 6H4c0 3 1.5 4.5 3 4.5M17 6h3c0 3-1.5 4.5-3 4.5", "none") + l("M7 6H4c0 3 1.5 4.5 3 4.5M17 6h3c0 3-1.5 4.5-3 4.5", 1.5, "#e0b040") + l("M12 14v3", 1.5, "#e0b040") + r(8, 17, 8, 4, 1, "#c9952a"),
    smile: c(12, 12, 8.5, "#ffd65b") + c(9, 10, 1.1, "#2a1f12") + c(15, 10, 1.1, "#2a1f12") + l("M8.5 14c2 2.5 5 2.5 7 0", 1.6, "#8a5a10"),
    berry: p("M12 8c5 0 7 3 6 7-1 3.5-3.5 6-6 6s-5-2.5-6-6C5 11 7 8 12 8z", "#ef4f61") + p("M8 6c1.5 1.5 2.5 2 4 2s2.5-.5 4-2c-1.5-1-2.5-1-4 0-1.5-1-2.5-1-4 0z", "#7cc95a") + [[10, 12], [14, 12], [12, 15], [9.5, 16.5], [14.5, 16.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="#ffe58f"/>`).join(""),
    sun: c(12, 12, 4.8, "#ffd65b") + l("M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8", 1.6, "#e0a020"),
    rain: p("M7 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 8.5a3.3 3.3 0 0 1-.5 6.5z", "#e6f0ff") + l("M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5", 1.6, "#4fb3ff"),
    storm: p("M7 14a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 7.5a3.3 3.3 0 0 1-.5 6.5z", "#c9d3e6") + p("M12.5 13l-3 4.5h3l-1.5 4.5 4.5-6h-3l1.5-3z", "#ffd65b"),
    moon: p("M15 3a8.5 8.5 0 1 0 6 13A7 7 0 0 1 15 3z", "#e8dcff") + c(10, 10, 1, "#c9b8f0") + c(9, 15, 1.4, "#c9b8f0"),
    snow: l("M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9", 1.8, "#4fa8d8") + l("M10 4.5 12 6l2-1.5M10 19.5 12 18l2 1.5", 1.4, "#4fa8d8"),
    rainbow: p("M3 18a9 9 0 0 1 18 0", "none") + l("M3 18a9 9 0 0 1 18 0", 2.4, "#ef4f61") + l("M6 18a6 6 0 0 1 12 0", 2.4, "#ffd65b") + l("M9 18a3 3 0 0 1 6 0", 2.4, "#4fb3ff"),
    scarecrow: l("M12 10v11", 2, "#8a5a2c") + l("M5 12h14", 2, "#8a5a2c") + c(12, 7, 3.5, "#ff9a3a") + p("M7 5h10l-2-2.5H9z", "#e9c46a") + p("M8.5 12h7l-1 5h-5z", "#6fa8dc"),
    sprinkler: l("M12 21v-8", 2.4, "#8a93a6") + c(12, 11, 2.5, "#4fb3ff") + l("M8 9C6 7 5 5 5 3M16 9c2-2 3-4 3-6M10 7.5C9.5 6 9.5 4.5 10 3M14 7.5c.5-1.5.5-3 0-4.5", 1.4, "#7fd4ff"),
    lamp: l("M12 21V9", 2, "#9aa3b8") + p("M8.5 9l1-5h5l1 5z", "#ffe9a6") + l("M8 21h8", 2, "#9aa3b8"),
    flower: [0, 1, 2, 3, 4].map(k => { const a = k * 1.2566 - 1.57; return `<circle cx="${(12 + Math.cos(a) * 4).toFixed(1)}" cy="${(10 + Math.sin(a) * 4).toFixed(1)}" r="3" fill="#ff8fb8" ${O("#ff8fb8")}/>`; }).join("") + c(12, 10, 2.2, "#ffd65b") + r(8, 16, 8, 5, 1.5, "#c9824a"),
    rose: c(12, 10, 6, "#ef4f61") + l("M12 6.5c-2 1-2 4 0 4.5 2 .5 3-2 1.5-3", 1.2, "#a8283a") + p("M12 16v5", "none") + l("M12 16v5", 2, "#4f9a3c") + p("M12 19c-2-2-4-1-4 0 2 1 3 1 4 0z", "#7cc95a"),
    fern: l("M12 21C12 13 10 7 6 4", 1.8, "#3f8a3a") + [6, 9, 12, 15].map(y => p(`M${12 - (21 - y) * .12} ${y}c-3-1-4.5 0-5.5 1.5 2 .5 4 .5 5.5-1.5z`, "#7cc95a")).join(""),
    rock: p("M3 18c0-5 3-9 8-9 2-2 5-2 7 1 2 2 3 5 3 8z", "#c9cdd6") + hl("M8 12c1-1 2.5-1.5 4-1.5") + p("M14 9.5c1-.5 2.5-.5 3.5.5-1.5 1-2.5.5-3.5-.5z", "#7cc95a"),
    crate: r(4, 6, 16, 14, 2, "#e3a960") + l("M6.5 8.5l11 9M17.5 8.5l-11 9", 1.2, "#a8743a"),
    pine: p("M12 3l5 6h-2l4 5h-2.5l3.5 4H4l3.5-4H5l4-5H7z", "#3fae6a") + r(10.5, 18, 3, 3.5, .5, "#8a5a2c"),
    apple: c(12, 9.5, 6.5, "#5fbf4f") + c(9.5, 9, 1.4, "#ef4f61") + c(14, 7.5, 1.4, "#ef4f61") + c(13.5, 11.5, 1.4, "#ef4f61") + r(10.8, 15.5, 2.4, 6, .5, "#8a5a2c"),
    gazebo: p("M4 10 12 3l8 7z", "#4fb3a8") + l("M6 10v10M18 10v10M10 10v10M14 10v10", 1.6, "#ddd2bc") + l("M4 20h16", 2, "#b8a888"),
    house: p("M4 11 12 4l8 7v10H4z", "#fff3dd") + p("M2.5 11.5 12 3.5l9.5 8", "none") + l("M2.5 11.5 12 3.5l9.5 8", 2.2, "#d9473f") + r(10, 14.5, 4, 6.5, .5, "#8a5a2c"),
    statue: r(6, 17, 12, 4, 1, "#e7dfd0") + c(12, 10, 5, "#ffd65b") + c(10.3, 9.5, .9, "#2a1f12") + c(13.7, 9.5, .9, "#2a1f12") + p("M8 6l-1-3 2.5 1.5M16 6l1-3-2.5 1.5", "#ffd65b"),
    star: p("M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z", "#ffd65b"),
    heart: p("M12 20s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.4-8 10-8 10z", "#ff6f9a"),
    lock: r(5, 10, 14, 11, 2, "#ffd65b") + l("M8 10V7a4 4 0 0 1 8 0v3", 2, "#e0b040"),
    ball: c(12, 12, 8.5, "#d8c8ff") + l("M7 7.5c3 2 3 7 0 9M17 7.5c-3 2-3 7 0 9", 1.4, "#5a3fd0"),
    flag: l("M6 21V3", 2, "#aab3c5") + p("M6 4h12l-2.5 4L18 12H6z", "#fff") + r(6, 4, 3, 2.7, 0, "#2a1f12") + r(12, 4, 3, 2.7, 0, "#2a1f12") + r(9, 6.7, 3, 2.7, 0, "#2a1f12") + r(15, 6.7, 2.2, 2.7, 0, "#2a1f12"),
    fountain: `<ellipse cx="12" cy="18" rx="9" ry="3.5" fill="#e9dcc2" ${O("#e9dcc2")}/>` + `<ellipse cx="12" cy="17.5" rx="6.5" ry="2" fill="#4fb8e0"/>` + l("M12 17V9", 2.2, "#c9bfae") + p("M12 9c-1-3 0-5 0-6 0 1 1 3 0 6z", "#9ff0ff") + l("M12 8c-3 0-4.5 2-5 5M12 8c3 0 4.5 2 5 5", 1.4, "#4fb8e0"),
    spark: p("M12 2l2 7 7 3-7 2-2 8-2-8-7-2 7-3z", "#ff9bd2"),
    crest: p("M12 2.5l7.5 3v5.5c0 5-3.2 8.4-7.5 10.5-4.3-2.1-7.5-5.5-7.5-10.5V5.5z", "#9ff3d8") + p("M12 7l1.4 3 3.1.3-2.3 2.1.7 3.1L12 14l-2.9 1.5.7-3.1-2.3-2.1 3.1-.3z", "#ffd991"),
    aura: `<ellipse cx="12" cy="17" rx="8.5" ry="3.2" fill="none" stroke="#b6a0ff" stroke-width="2"/>` + `<ellipse cx="12" cy="17" rx="5" ry="1.6" fill="none" stroke="#9ff3d8" stroke-width="1.5"/>` + p("M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z", "#e8dcff"),
    menu: r(4, 5, 16, 3, 1.5, "#dfe6f5") + r(4, 10.5, 16, 3, 1.5, "#dfe6f5") + r(4, 16, 16, 3, 1.5, "#dfe6f5"),
    close: l("M6.5 6.5l11 11M17.5 6.5l-11 11", 3.2, "#dfe6f5"),
    milk: p("M8 3h8v3l2 3v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V9l2-3z", "#e6f4ff") + r(6, 12, 12, 5, 0, "#4fb3ff"),
  };
})();
const I = (name, cls = "") => ICON_SRC[name] ? `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${ICON_SRC[name]}</svg>` : "";
const L = I("leaf", "leaf");
const ICON_IMGS = {};
function ICON_IMG(name) {
  if (!ICON_SRC[name]) return null;
  if (!ICON_IMGS[name]) { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${ICON_SRC[name]}</svg>`); ICON_IMGS[name] = im; }
  return ICON_IMGS[name];
}
Object.keys(ICON_SRC).forEach(ICON_IMG);
function fillIconSlots(root = document) { root.querySelectorAll("[data-ico]").forEach(el => { if (!el.dataset.icoDone) { el.innerHTML = I(el.dataset.ico); el.dataset.icoDone = 1; } }); }
/** Draw "text + icon" centred on (x, y) on a canvas, with the icon sized to the text. */
function textWithIcon(g, text, icon, x, y, size, stroke) {
  const im = ICON_IMG(icon), w = g.measureText(text).width, iw = size * 1.15, gap = size * .25, tw = w + gap + iw;
  g.textAlign = "left"; g.textBaseline = "middle";
  if (stroke) g.strokeText(text, x - tw / 2, y);
  g.fillText(text, x - tw / 2, y);
  if (im?.complete) g.drawImage(im, x - tw / 2 + w + gap, y - iw / 2, iw, iw);
  g.textBaseline = "alphabetic"; g.textAlign = "center";
}
