import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";

// Poster's result and briefing sheets: the last old-look pieces (audit C08,
// C09, C10, C41, 27 Nov 2026). The pieces are laid into the arena overlay
// as the game writes them (result-rewards.ts, adventure-ui.ts,
// match-recap.ts, raid-ui.ts) and their styles read back: no pill, glow or
// thin gold rim, and the solo warning's words read on its block.
const contrast = (a: number[], b: number[]) => {
  const lum = (c: number[]) => {
    const [x, y, z] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };
  const l1 = lum(a),
    l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

test("Poster's sheets: reward news, the XP block, the places and the solo warning in the poster's shapes", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      if (!location.search) history.replaceState(null, "", "/?ui=poster");
    });
    const errors = await openHub(page);
    const look = await page.evaluate(() => {
      const ov = document.getElementById("arena-overlay")!;
      ov.className = "is-sheet";
      ov.innerHTML = `<div class="overlay-card match-sheet"><div class="panel-scroll">
        <div class="rw"><div class="rw-tiles">
          <div class="rw-tile has-burst"><span class="rw-burst">Level up</span></div>
          <div class="rw-tile"></div>
        </div></div>
        <section class="journey-result-xp"><strong>+150 XP</strong><p class="journey-level-up">LEVEL UP · 11 → 12<small>+30 coins</small></p>
          <div class="journey-level is-compact"><span class="journey-level-badge"><small>LEVEL</small><b>12</b></span><div><progress max="100" value="40"></progress></div></div></section>
        <div class="standings-card"><ol class="standings"><li class="place-1 me"><span>1st</span><b><bdi>Kai</bdi></b><em>3</em></li></ol></div>
        <details class="rc-extra" open><summary>Your fighter</summary><div class="raid-perks"><h3>Champion tricks</h3><ul><li><b>You · Voltkit</b> — Spark: a trick.</li></ul></div></details>
      </div><div class="panel-actions"><p class="raid-solo-warning">No revive solo at ★★★ · one knockout ends the run</p></div></div>`;
      const cs = (s: string, pseudo?: string) =>
        getComputedStyle(ov.querySelector(s)!, pseudo);
      const rgb = (s: string) =>
        s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const tiles = [...ov.querySelectorAll(".rw-tile")].map(
        (t) => getComputedStyle(t).borderTopColor,
      );
      const warn = cs(".raid-solo-warning");
      const perks = cs(".raid-perks");
      const extra = cs(".rc-extra");
      return {
        burst: [cs(".rw-burst").borderTopLeftRadius, cs(".rw-burst").boxShadow],
        tileEdges: tiles,
        xp: [
          cs(".journey-result-xp").borderTopLeftRadius,
          cs(".journey-level-badge").borderTopLeftRadius,
        ],
        levelUp: parseFloat(cs(".journey-level-up").fontSize),
        badge: [
          cs(".journey-level-badge").backgroundColor,
          cs(".journey-level-badge b").color,
          cs(".journey-level-badge small").color,
        ],
        places: [
          cs(".standings-card").borderTopLeftRadius,
          cs(".standings li").borderTopLeftRadius,
          cs(".standings li > span").borderTopLeftRadius,
        ],
        extraPad: parseFloat(extra.paddingLeft),
        perks: {
          radius: perks.borderTopLeftRadius,
          top: perks.borderTopStyle,
          fg: rgb(perks.color),
          bg: rgb(perks.backgroundColor),
          alpha: perks.backgroundColor,
        },
        warn: {
          fg: rgb(warn.color),
          bg: rgb(warn.backgroundColor),
          radius: warn.borderTopLeftRadius,
        },
      };
    });
    // C08: the news a square without glow; every tile the same edge.
    expect(look.burst).toEqual(["0px", "none"]);
    expect(new Set(look.tileEdges).size, "one tile edge").toBe(1);
    // C09: square blocks, the level-up line a readable size.
    expect(look.xp).toEqual(["0px", "0px"]);
    expect(look.levelUp).toBeGreaterThanOrEqual(14);
    // The level: a red square with white figures, as the header's "Lv"
    // (themes/poster/results-level.css).
    expect(look.badge).toEqual([
      "rgb(224, 20, 58)",
      "rgb(255, 255, 255)",
      "rgb(255, 255, 255)",
    ]);
    // C10: the places' card, plates and medals square.
    expect(look.places).toEqual(["0px", "0px", "0px"]);
    // C41: the Champion tricks a solid square plate, its words readable.
    expect(look.perks.radius).toBe("0px");
    expect(look.perks.top, "no thin rim").toBe("none");
    expect(look.perks.alpha, "solid, not see-through").toMatch(/^rgb\(/);
    expect(contrast(look.perks.fg, look.perks.bg)).toBeGreaterThanOrEqual(4.5);
    expect(
      look.extraPad,
      "the block's lines off its left edge",
    ).toBeGreaterThanOrEqual(8);
    // C41: the warning square, its words readable on its block.
    expect(look.warn.radius).toBe("0px");
    expect(contrast(look.warn.fg, look.warn.bg)).toBeGreaterThanOrEqual(4.5);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
