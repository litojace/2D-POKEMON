import { describe, expect, it } from "vitest";
import {
  actionBar,
  actions,
  attrs,
  bar,
  button,
  confirmModal,
  emptyState,
  itemTile,
  panel,
  price,
  rarityTag,
  row,
  tabs,
} from "../../apps/client/src/ui/components";

describe("shared UI components", () => {
  it("escapes every piece of text it is given", () => {
    const evil = `<img src=x onerror="alert(1)">`;
    for (const html of [
      button(evil),
      panel({ title: evil, kicker: evil, body: "" }),
      tabs([{ id: evil, label: evil }], evil),
      row({ title: evil, sub: evil }),
      itemTile({ id: evil, art: "", name: evil, sub: evil }),
      emptyState(evil, evil),
      confirmModal({
        kicker: evil,
        title: evil,
        lines: [[evil, ""]],
        confirm: evil,
      }),
      attrs({ "data-x": evil }),
    ]) {
      expect(html).not.toContain("<img");
      expect(html).not.toContain('onerror="');
    }
  });
  it("makes buttons in one of two sizes and puts actions in one equal group", () => {
    expect(button("Equip", { kind: "ok" })).toContain('class="ui-btn is-ok"');
    expect(button("Invite", { size: "s" })).toContain('class="ui-btn is-s"');
    expect(button("Buy", { kind: "primary" })).toContain('type="button"');
    const group = actions(button("Revert"), button("Equip", { kind: "ok" }));
    expect(group.startsWith('<div class="ui-actions">')).toBe(true);
    expect(group.match(/class="ui-btn/g)).toHaveLength(2);
    // The main action is last: bottom right, where PLAY is.
    expect(group.lastIndexOf("is-ok")).toBeGreaterThan(group.indexOf("Revert"));
  });
  it("gives every panel the same head with Close last", () => {
    const html = panel({
      kind: "sheet",
      kicker: "Daily",
      title: "Missions",
      tools: "<i>tool</i>",
      body: "B",
      foot: actionBar("", ""),
    });
    expect(html).toContain('class="ui-panel ui-sheet"');
    expect(html).toContain('role="dialog"');
    const head = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(head.indexOf("<i>tool</i>")).toBeLessThan(head.indexOf("ui-close"));
    expect(head.trimEnd().endsWith("</button>")).toBe(true);
    expect(html).toContain('aria-label="Back to the Lobby"');
  });
  it("shows prices with the old price struck through only when it differs", () => {
    expect(price(1200, 1500)).toContain("<s>");
    expect(price(1200, 1500)).toContain("1,500");
    expect(price(1200, 1200)).not.toContain("<s>");
    expect(price(12000)).toContain("12,000");
  });
  it("keeps progress bars between 0 and 100% and says their value", () => {
    expect(bar(5, 4, { label: "Done" })).toContain("--p:100.0%");
    expect(bar(-1, 4, { label: "Done" })).toContain("--p:0.0%");
    expect(bar(1, 0, { label: "Done" })).toContain("--p:0.0%");
    expect(bar(1, 4, { label: "Done" })).toContain('aria-valuenow="1"');
  });
  it("names rarities the way the Shop does", () => {
    expect(rarityTag("mythical")).toContain(">Mythical<");
    expect(rarityTag("mythic")).toContain("is-mythic");
    expect(rarityTag("rare")).toContain('data-rarity="rare"');
  });
  it("marks one tab selected and keeps only it in the tab order", () => {
    const html = tabs(
      [
        { id: "today", label: "Today", selected: true },
        { id: "skins", label: "Skins" },
      ],
      "Shop sections",
    );
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('role="tablist"');
  });
  it("puts Cancel first and the confirm action last in a confirmation", () => {
    const html = confirmModal({
      kicker: "Confirm purchase",
      title: "Blue Flame",
      lines: [["Price", price(1200)]],
      total: ["After", price(1140)],
      confirm: "Buy",
    });
    expect(html.indexOf("data-ui-cancel")).toBeLessThan(
      html.indexOf("data-ui-confirm-ok"),
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('class="is-total"');
  });
});
