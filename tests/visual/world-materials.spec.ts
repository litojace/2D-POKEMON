import { expect, test } from "@playwright/test";

test("material painting preserves paths, transforms, holes and transparent washes", async ({
  page,
}) => {
  await page.route("**/material-review", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto("/material-review");
  const result = await page.evaluate(async () => {
    const { materialContext } =
      await import("/apps/client/src/world-materials.ts");
    const draw = (decorated: boolean, wash = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      const native = canvas.getContext("2d")!;
      const c = decorated ? materialContext(native, "architecture") : native;
      c.translate(18, 13);
      c.rotate(0.12);
      c.globalAlpha = wash ? 0.3 : 1;
      c.fillStyle = "#b9ad95";
      c.beginPath();
      c.rect(5, 5, 100, 100);
      c.rect(30, 30, 35, 35);
      c.fill("evenodd");
      // A separate fillRect must not replace the current donut path.
      c.fillStyle = "#7a5638";
      c.fillRect(112, 15, 12, 70);
      c.strokeStyle = "#ff0011";
      c.lineWidth = 2;
      c.stroke();
      return Array.from(native.getImageData(0, 0, 160, 160).data);
    };
    const plain = draw(false),
      painted = draw(true),
      repeated = draw(true);
    let escaped = 0,
      changed = 0,
      strokeLost = 0;
    for (let k = 0; k < plain.length; k += 4) {
      if (plain[k + 3] === 0 && painted[k + 3] !== 0) escaped++;
      if (plain[k] !== painted[k]) changed++;
      if (
        plain[k] === 255 &&
        plain[k + 1] === 0 &&
        plain[k + 2] === 17 &&
        painted[k] !== 255
      )
        strokeLost++;
    }
    return {
      escaped,
      changed,
      strokeLost,
      repeat: JSON.stringify(painted) === JSON.stringify(repeated),
      wash:
        JSON.stringify(draw(false, true)) === JSON.stringify(draw(true, true)),
    };
  });
  expect(result.escaped).toBe(0);
  expect(result.strokeLost).toBe(0);
  expect(result.changed).toBeGreaterThan(1000);
  expect(result.repeat).toBe(true);
  expect(result.wash).toBe(true);
});
