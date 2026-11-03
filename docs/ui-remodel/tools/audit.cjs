// Part of the UI remodel's Phase 0 (docs/ui-remodel/PLAN.md). Run from the repo
// root after starting the server it needs; PW_CHROMIUM picks the browser.
// Measure each hub screen instead of eyeballing it: covered controls, small
// touch targets, cut-off text, the safe area, button styles, where Close
// sits. Usage: node docs/ui-remodel/tools/audit.cjs <outDir> [viewport...]
// (SCREEN=shop,missions limits the screens). Some findings need a look:
// a menu covering what it opens over, or a hidden tab's buttons, count too.
const path = require("path");
const fs = require("fs");
const cap = require("./hub-screens.cjs");
const OUT = process.argv[2] || "audit";
const ONLY = process.argv.slice(3);

// Runs in the page: what a player would notice.
function measure({ isPhone, inset }) {
  const vw = innerWidth,
    vh = innerHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== "hidden" &&
      s.display !== "none" &&
      !el.closest("[hidden],[inert]") &&
      +s.opacity > 0.05
    );
  };
  // The part of an element you can see through its scrolling ancestors.
  const shown = (el) => {
    let r = el.getBoundingClientRect();
    let x1 = r.left,
      y1 = r.top,
      x2 = r.right,
      y2 = r.bottom;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (
        /(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)
      ) {
        const q = p.getBoundingClientRect();
        x1 = Math.max(x1, q.left);
        y1 = Math.max(y1, q.top);
        x2 = Math.min(x2, q.right);
        y2 = Math.min(y2, q.bottom);
      }
    }
    x1 = Math.max(x1, 0);
    y1 = Math.max(y1, 0);
    x2 = Math.min(x2, vw);
    y2 = Math.min(y2, vh);
    return x2 - x1 > 2 && y2 - y1 > 2 ? { x1, y1, x2, y2 } : null;
  };
  const name = (el) => {
    const t = (
      el.getAttribute("aria-label") ||
      el.textContent ||
      el.id ||
      el.className ||
      el.tagName
    )
      .toString()
      .replace(/\s+/g, " ")
      .trim();
    return t.slice(0, 40);
  };
  const root =
    document.querySelector("dialog[open]") ||
    [
      ...document.querySelectorAll(
        "#home-fighter-panel, #home-play-panel, .lobby-layer, #battle, #menu",
      ),
    ].find(visible) ||
    document.body;
  const controls = [
    ...root.querySelectorAll(
      "button, a[href], select, input:not([type=hidden]), summary, [role=tab], [role=button]",
    ),
  ].filter(visible);
  const out = {
    controls: controls.length,
    covered: [],
    smallTargets: [],
    truncated: [],
    unsafe: [],
    offscreen: 0,
    buttonStyles: 0,
    styleExamples: [],
    close: null,
    headings: [],
  };
  for (const el of controls) {
    const s = shown(el);
    if (!s) {
      out.offscreen++;
      continue;
    }
    const r = el.getBoundingClientRect();
    // Covered: the middle of what you can see is someone else's.
    const cx = (s.x1 + s.x2) / 2,
      cy = (s.y1 + s.y2) / 2;
    const top = document.elementFromPoint(cx, cy);
    if (
      top &&
      top !== el &&
      !el.contains(top) &&
      !top.contains(el) &&
      !(top.closest("label") && top.closest("label").contains(el))
    )
      out.covered.push(`${name(el)} ← ${name(top)}`);
    if (isPhone && Math.min(r.width, r.height) < 40)
      out.smallTargets.push(
        `${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
    if (
      inset &&
      (r.left < inset.left - 0.5 ||
        r.right > vw - inset.right + 0.5 ||
        r.bottom > vh - inset.bottom + 0.5)
    )
      out.unsafe.push(
        `${name(el)} @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
  }
  // Text cut off with an ellipsis or clipped by its own box.
  for (const el of root.querySelectorAll(
    "b, small, span, h1, h2, h3, h4, p, strong, button, label",
  )) {
    if (!visible(el) || !shown(el) || !el.textContent.trim()) continue;
    const s = getComputedStyle(el);
    if (
      (s.textOverflow === "ellipsis" || s.overflow === "hidden") &&
      (el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 2)
    )
      out.truncated.push(name(el));
  }
  out.truncated = [...new Set(out.truncated)];
  // How many different button looks on one screen.
  const sig = new Map();
  for (const el of controls.filter((c) => c.tagName === "BUTTON" && shown(c))) {
    const s = getComputedStyle(el);
    const k = [
      Math.round(el.getBoundingClientRect().height),
      s.borderRadius,
      s.backgroundColor,
      s.backgroundImage.slice(0, 30),
      s.fontFamily.split(",")[0],
      s.fontSize,
      s.fontWeight,
      s.textTransform,
      s.borderTopColor,
    ].join("|");
    if (!sig.has(k)) sig.set(k, name(el));
  }
  out.buttonStyles = sig.size;
  out.styleExamples = [...sig.values()].slice(0, 30);
  const close = root.querySelector(
    "#close-dialog, [data-home-close], .dialog-close, [aria-label^=Close], [aria-label='Close']",
  );
  if (close && visible(close)) {
    const r = close.getBoundingClientRect();
    out.close = {
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(vw - r.right),
      radius: getComputedStyle(close).borderRadius,
    };
  }
  for (const h of root.querySelectorAll("h1, h2"))
    if (visible(h) && shown(h)) {
      const s = getComputedStyle(h);
      out.headings.push(
        `${h.textContent.trim().slice(0, 30)} · ${s.fontSize} ${s.fontFamily.split(",")[0]} ${s.textTransform}`,
      );
    }
  out.headings = out.headings.slice(0, 4);
  // Coin pill: where and how big, if this screen shows one.
  const coin = [
    ...root.querySelectorAll(".coin-chip, .currency, [class*=coin-chip]"),
  ].find(visible);
  if (coin) {
    const r = coin.getBoundingClientRect();
    out.coin = `${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} ${getComputedStyle(coin).fontSize}`;
  }
  out.scrollers = [...root.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return (
      visible(el) &&
      /(auto|scroll)/.test(s.overflowY) &&
      el.scrollHeight > el.clientHeight + 2
    );
  }).length;
  return out;
}

(async () => {
  const browser = await cap.launch();
  const result = {};
  for (const vp of cap.VIEWPORTS) {
    if (ONLY.length && !ONLY.includes(vp.name)) continue;
    result[vp.name] = {};
    for (const [screen, fn] of Object.entries(cap.SCREENS)) {
      if (process.env.SCREEN && !process.env.SCREEN.split(",").includes(screen))
        continue;
      const page = await cap.newPage(browser, vp);
      try {
        await cap.openHub(page);
        await fn(page, async (label) => {
          result[vp.name][label] = await page
            .evaluate(measure, {
              isPhone: vp.mobile,
              inset: vp.island ? { left: 59, right: 59, bottom: 21 } : null,
            })
            .catch((e) => ({ error: String(e).slice(0, 200) }));
          console.log(vp.name, label);
        });
      } catch (e) {
        console.log("FAIL", vp.name, screen, String(e).split("\n")[0]);
      }
      await page.context().close();
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      `${OUT}/${vp.name}.json`,
      JSON.stringify(result[vp.name], null, 1),
    );
  }
  await browser.close();
})();
