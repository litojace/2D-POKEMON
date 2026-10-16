import { describe, expect, it } from "vitest";
import { titlePickerMarkup } from "../../apps/client/src/player-nameplate";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const titles = [
  { id: id(1), name: "Master", color: "#ffbc65", description: "Season rank." },
  {
    id: id(2),
    name: "Mountain Conqueror",
    color: "#e8b06a",
    description: "Clear Grumblecrag on Peril 3.",
  },
  { id: id(3), name: "<b>Sneaky</b>", color: "nope", description: "" },
];

describe("title picker", () => {
  it("submits the same titleId values the old select did", () => {
    const html = titlePickerMarkup(titles, "Master");
    expect(html).toContain('name="titleId" value=""');
    for (const t of titles) expect(html).toContain(`value="${t.id}"`);
  });

  it("checks and marks only the equipped title", () => {
    const html = titlePickerMarkup(titles, "Mountain Conqueror");
    expect(html.match(/ checked/g)?.length).toBe(1);
    expect(html).toContain(`value="${id(2)}" checked`);
    expect(html.match(/title-equipped/g)?.length).toBe(1);
  });

  it("falls back to No title when nothing is equipped", () => {
    const html = titlePickerMarkup(titles, null);
    expect(html).toContain('value="" checked');
  });

  it("draws each title with its in-game treatment and colour", () => {
    const html = titlePickerMarkup(titles, null);
    expect(html).toContain('class="player-title title-master">Master<');
    expect(html).toContain("--title-color:#ffbc65");
    // Bad colours fall back instead of reaching the style attribute.
    expect(html).not.toContain("--title-color:nope");
  });

  it("escapes title names and descriptions", () => {
    const html = titlePickerMarkup(titles, null);
    expect(html).not.toContain("<b>Sneaky</b>");
    expect(html).toContain("&lt;b&gt;Sneaky&lt;/b&gt;");
  });

  it("explains where titles come from when there are none", () => {
    expect(titlePickerMarkup([], null)).toContain("Earn titles");
  });
});
