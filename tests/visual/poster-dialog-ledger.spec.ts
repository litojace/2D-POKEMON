import { expect, test } from "@playwright/test";
import { openHub } from "./helpers";

// Poster's dialog ledger and a fighter's combo (audit C33, C34, C35,
// 27 Nov 2026): a purchase's "After" rule ran in two pieces with the
// columns' gap between them; "What happens" broke over two lines beside a
// long answer; the combo was a gold-outlined pill on a dashed card. The
// pieces are laid out as confirmModal (ui/components.ts) and roster-view.ts
// write them, at a phone's width.
test("Poster: a dialog's total rule is one line, its line names stay whole, the combo is a flat block", async ({
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
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:20px;top:20px;width:420px";
      host.innerHTML = `<div class="ui-modal"><div class="ui-modal-body">
        <dl class="ui-ledger" id="buy"><dt>Price</dt><dd>1,200</dd><dt class="is-total">After</dt><dd class="is-total">1,140</dd></dl>
        <dl class="ui-ledger" id="report"><dt>What happens</dt><dd>Our team looks at it. Pictures that break the rules are removed.</dd></dl>
      </div></div>
      <div class="roster-room"><div class="roster-combo"><span class="roster-combo-tag">Combo</span><span class="roster-combo-text"><b>Charged</b><small>Static Glide charges Voltkit.</small></span></div></div>`;
      document.body.append(host);
      const box = (s: string) => host.querySelector(s)!.getBoundingClientRect();
      const name = host.querySelector("#report dt")!;
      const tag = getComputedStyle(host.querySelector(".roster-combo-tag")!);
      const card = getComputedStyle(host.querySelector(".roster-combo")!);
      return {
        gap: box("#buy dd.is-total").left - box("#buy dt.is-total").right,
        nameLines: Math.round(
          name.getBoundingClientRect().height /
            parseFloat(getComputedStyle(name).lineHeight),
        ),
        tag: [tag.borderTopLeftRadius, tag.borderTopStyle, tag.backgroundColor],
        card: [card.borderTopStyle, card.borderTopLeftRadius],
      };
    });
    expect(
      Math.abs(look.gap),
      "the total's rule in one piece",
    ).toBeLessThanOrEqual(1);
    expect(look.nameLines, '"What happens" on one line').toBe(1);
    expect(look.tag[0]).toBe("0px");
    expect(look.tag[1]).toBe("none");
    expect(look.tag[2]).not.toBe("rgba(0, 0, 0, 0)");
    expect(look.card).toEqual(["none", "0px"]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
