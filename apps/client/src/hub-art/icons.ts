// @ts-nocheck
/*
 * The hub icon set: 24×24 duotone icons, each outline a deeper shade of its own fill.
 * Ported unchanged from the approved hub prototype
 * (docs/hub-redesign/prototype/app/icons.js), keeping only the icons the
 * Plaza draws; the exports at the end are new. Pure drawing code, so it is not type-checked line by line.
 */
/* ======================================================================
   ICONS: one illustrated set (24×24, duotone, dark outline) for the Plaza.
   Used in HTML (I(name)) and drawn on canvas (ICON_IMG(name)),
   so the tool bar, the cursor and canvas signs always match.
   ====================================================================== */
const ICON_SRC = (() => {
  // No dark ink outline: every shape is outlined in a deeper shade of its own
  // colour, so icons read on the navy UI and on the grass without a white rim.
  const shade = (f) => {
    let h = f.slice(1);
    if (h.length === 3) h = [...h].map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16),
      t = [34, 22, 52],
      k = 0.42;
    return (
      "#" +
      [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        .map((v, i) =>
          Math.round(v * (1 - k) + t[i] * k)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  };
  const O = (f) =>
    /^#[0-9a-f]{3,8}$/i.test(f)
      ? `stroke="${shade(f)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"`
      : 'stroke="none"';
  const p = (d, f) => `<path d="${d}" fill="${f}" ${O(f)}/>`;
  const c = (x, y, r, f) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${O(f)}/>`;
  const r = (x, y, w, h, rx, f) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${O(f)}/>`;
  const l = (d, w = 1.5, col = "#6a5238") =>
    `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const hl = (d) =>
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>`;
  return {
    coin:
      c(12, 12, 8, "#ffd65b") +
      c(12, 12, 5, "#ffe58f") +
      l("M12 9.5v5", 1.5, "#b8862a"),
    gift:
      r(4, 10, 16, 11, 2, "#ff6f9a") +
      r(3, 7, 18, 4, 1.5, "#ff8fb1") +
      l("M12 7v14", 1.5, "#c2456e") +
      p("M12 7c-2-4-6-3-4 0zM12 7c2-4 6-3 4 0z", "#ffd65b"),
    orb:
      c(12, 12, 7, "#c9a3ff") +
      c(12, 12, 3.5, "#f3e8ff") +
      hl("M8 9a5 5 0 0 1 3-2"),
    camera:
      r(3, 7, 18, 13, 3, "#7383b3") +
      r(8, 4.5, 8, 4, 1.5, "#7383b3") +
      c(12, 13.5, 4, "#8fd0ff") +
      c(17.5, 10, 1, "#ef4f61"),
    // The Plaza photo album: a print on top of a tilted one.
    album:
      p("M3.6 7.4 14.8 4.3l2.4 8.8-11.2 3.1z", "#ff9bd2") +
      r(6.5, 8.5, 14, 13, 1.5, "#fbf7ee") +
      r(8.5, 10.5, 10, 7, 0.8, "#8fd0ff") +
      p("M8.5 17.5l3.3-3.6 2.3 2.1 1.7-1.5 2.7 3z", "#7cc95a") +
      c(15.8, 12.6, 1.2, "#ffd65b"),
    // The pond's fishing spot and the Fish book.
    fish:
      p("M7 12 2 7v10z", "#ffb04a") +
      p("M6.5 12c2.5-5 11-6.5 15 0-4 6.5-12.5 5-15 0z", "#4fb3ff") +
      p("M12 8.2c1.5-2.4 4-2.6 5.5-1z", "#ffb04a") +
      c(17.4, 11.2, 1.1, "#0b1020") +
      hl("M10 10.5a6 6 0 0 1 4-1.6"),
    boba:
      p(
        "M6 8h12l-1.6 12.5a1.5 1.5 0 0 1-1.5 1.3H9.1a1.5 1.5 0 0 1-1.5-1.3z",
        "#f1d3b0",
      ) +
      r(5, 6, 14, 3, 1.2, "#ff9bd2") +
      l("M14 6l2-4", 2, "#ff7fb0") +
      [9.5, 12, 14.5]
        .map((x) => `<circle cx="${x}" cy="18.5" r="1.3" fill="#3a2214"/>`)
        .join(""),
    trophy:
      p("M7 4h10v5a5 5 0 0 1-10 0z", "#ffd65b") +
      p("M7 6H4c0 3 1.5 4.5 3 4.5M17 6h3c0 3-1.5 4.5-3 4.5", "none") +
      l("M7 6H4c0 3 1.5 4.5 3 4.5M17 6h3c0 3-1.5 4.5-3 4.5", 1.5, "#e0b040") +
      l("M12 14v3", 1.5, "#e0b040") +
      r(8, 17, 8, 4, 1, "#c9952a"),
    smile:
      c(12, 12, 8.5, "#ffd65b") +
      c(9, 10, 1.1, "#2a1f12") +
      c(15, 10, 1.1, "#2a1f12") +
      l("M8.5 14c2 2.5 5 2.5 7 0", 1.6, "#8a5a10"),
    sun:
      c(12, 12, 4.8, "#ffd65b") +
      l(
        "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8",
        1.6,
        "#e0a020",
      ),
    moon:
      p("M15 3a8.5 8.5 0 1 0 6 13A7 7 0 0 1 15 3z", "#e8dcff") +
      c(10, 10, 1, "#c9b8f0") +
      c(9, 15, 1.4, "#c9b8f0"),
    // The Plaza map: a folded map with a pin.
    map:
      p("M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z", "#bfe8a6") +
      l("M8.5 4v13.5M15.5 6.5V20", 1.2, "#6fa85a") +
      l("M5 15c2-1 3 1 5 0s3-3 5-2", 1.3, "#e8c46a") +
      p(
        "M15 4.5a3 3 0 0 1 3 3c0 2.2-3 5-3 5s-3-2.8-3-5a3 3 0 0 1 3-3z",
        "#ef4f61",
      ) +
      c(15, 7.5, 1.1, "#fff"),
    // The Orb Ball pitch's ball.
    ball:
      c(12, 12, 8.5, "#f6f3ff") +
      p("M12 8.2l3 2.2-1.1 3.6h-3.8L9 10.4z", "#5b4bd0") +
      l(
        "M12 8.2V4.5M15 10.4l3.6-1.2M13.9 14l2.2 3M10.1 14l-2.2 3M9 10.4 5.4 9.2",
        1.2,
        "#8f86c8",
      ) +
      hl("M7.5 8.5a6 6 0 0 1 3-2.5"),
    // The Dash Track's chequered flag.
    flag:
      l("M6 21V3.5", 2, "#6a5238") +
      r(6.5, 4, 13, 9, 1, "#fafafa") +
      p(
        "M6.5 4h3.25v3H6.5zM13 4h3.25v3H13zM9.75 7H13v3H9.75zM16.25 7h3.25v3h-3.25zM6.5 10h3.25v3H6.5zM13 10h3.25v3H13z",
        "#2a2a36",
      ),
    // The runway's star.
    star: p(
      "M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z",
      "#ffd65b",
    ),
    // The wishing fountain: a sparkle.
    sparkle:
      p(
        "M12 2.5c.8 4.6 2.9 6.7 7.5 7.5-4.6.8-6.7 2.9-7.5 7.5-.8-4.6-2.9-6.7-7.5-7.5 4.6-.8 6.7-2.9 7.5-7.5z",
        "#8fd7ff",
      ) +
      p(
        "M18.5 15c.3 1.7 1 2.4 2.7 2.7-1.7.3-2.4 1-2.7 2.7-.3-1.7-1-2.4-2.7-2.7 1.7-.3 2.4-1 2.7-2.7z",
        "#ff9bd2",
      ),
    heart: p(
      "M12 20s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.4-8 10-8 10z",
      "#ff6f9a",
    ),
  };
})();
const I = (name, cls = "") =>
  ICON_SRC[name]
    ? `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${ICON_SRC[name]}</svg>`
    : "";
const ICON_IMGS = {};
function ICON_IMG(name) {
  if (!ICON_SRC[name]) return null;
  if (!ICON_IMGS[name]) {
    const im = new Image();
    im.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${ICON_SRC[name]}</svg>`,
      );
    ICON_IMGS[name] = im;
  }
  return ICON_IMGS[name];
}
if (typeof Image !== "undefined") Object.keys(ICON_SRC).forEach(ICON_IMG);
/** Draw "text + icon" centred on (x, y) on a canvas, with the icon sized to the text. */
function textWithIcon(g, text, icon, x, y, size, stroke) {
  const im = ICON_IMG(icon),
    w = g.measureText(text).width,
    iw = size * 1.15,
    gap = size * 0.25,
    tw = w + gap + iw;
  g.textAlign = "left";
  g.textBaseline = "middle";
  if (stroke) g.strokeText(text, x - tw / 2, y);
  g.fillText(text, x - tw / 2, y);
  if (im?.complete) g.drawImage(im, x - tw / 2 + w + gap, y - iw / 2, iw, iw);
  g.textBaseline = "alphabetic";
  g.textAlign = "center";
}

/** An icon as inline SVG markup (HTML). */
export const hubIcon = (name: string, cls = ""): string => I(name, cls);
/** An icon as an image, for drawing on a canvas. */
export const hubIconImage = (name: string): HTMLImageElement | null =>
  ICON_IMG(name);
export { textWithIcon, ICON_SRC };
