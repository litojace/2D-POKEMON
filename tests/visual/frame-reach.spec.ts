import { expect, test } from "@playwright/test";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { REWARD_ITEMS } from "../../packages/shared/src/journey";
import { openLobby } from "./helpers";

// How far each portrait frame reaches beyond its portrait (ring, crest,
// ornaments, boss stars), as a share of the portrait's width. The player
// card keeps that much room around your avatar whatever you wear
// (screens/profile.css, --pf-portrait): 20% at the sides, 34% above, 37%
// below. A new frame that reaches further fails here: give it less reach,
// or the card more room. The rarity halo (.tier-glow) fades out and is
// left out.
const ROOM = { top: 0.34, bottom: 0.37, left: 0.2, right: 0.2 };
const FRAMES = [
  ...new Set(
    [
      ...Object.entries(RAID_COSMETICS).map(([id, item]) => ({ id, ...item })),
      ...LOOK_ITEMS,
      ...REWARD_ITEMS,
    ]
      .filter((i) => i.slot === "frame")
      .map((i) => i.id),
  ),
];

test("every portrait frame fits the room the player card keeps for it", async ({
  page,
}) => {
  expect(FRAMES.length).toBeGreaterThan(20);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openLobby(page);
  const reach = await page.evaluate(async (frames) => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:400px;top:300px;width:200px;height:200px";
    document.body.append(host);
    const out: Record<string, Record<string, number>> = {};
    for (const f of frames) {
      // As framePortrait draws it, with a boss frame's full star row.
      host.innerHTML = `<span class="raid-cosmetic-preview portrait-frame" data-cosmetic="${f}" data-portrait-frame="${f}" data-frame-stars="5"><span class="portrait-disc"></span><span class="frame-stars is-legendary">★★★★★</span></span>`;
      const el = host.firstElementChild as HTMLElement;
      await new Promise((r) => requestAnimationFrame(r));
      const base = el.getBoundingClientRect();
      const ext = { top: 0, bottom: 0, left: 0, right: 0 };
      const add = (r: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      }) => {
        if (r.right <= r.left || r.bottom <= r.top) return;
        ext.left = Math.max(ext.left, (base.left - r.left) / base.width);
        ext.right = Math.max(ext.right, (r.right - base.right) / base.width);
        ext.top = Math.max(ext.top, (base.top - r.top) / base.width);
        ext.bottom = Math.max(
          ext.bottom,
          (r.bottom - base.bottom) / base.width,
        );
      };
      for (const n of [el, ...Array.from(el.querySelectorAll("*"))]) {
        if (n.classList.contains("tier-glow")) continue;
        const r = n.getBoundingClientRect();
        add(r);
        // Pseudo-elements: their used box (absolutely placed), scaled from
        // its middle by any transform.
        for (const ps of ["::before", "::after"]) {
          const c = getComputedStyle(n, ps);
          if (c.content === "none" || c.display === "none") continue;
          if (c.position !== "absolute") continue;
          const [w, h, l, t] = [c.width, c.height, c.left, c.top].map(
            parseFloat,
          );
          if (![w, h, l, t].every(Number.isFinite)) continue;
          const m = new DOMMatrix(
            c.transform === "none" ? undefined : c.transform,
          );
          const sx = Math.hypot(m.a, m.b),
            sy = Math.hypot(m.c, m.d);
          const cx = r.left + l + w / 2 + m.e,
            cy = r.top + t + h / 2 + m.f;
          add({
            left: cx - (w * sx) / 2,
            right: cx + (w * sx) / 2,
            top: cy - (h * sy) / 2,
            bottom: cy + (h * sy) / 2,
          });
        }
      }
      out[f] = ext;
    }
    host.remove();
    return out;
  }, FRAMES);
  const over = Object.entries(reach).flatMap(([f, ext]) =>
    (Object.keys(ROOM) as (keyof typeof ROOM)[])
      .filter((k) => ext[k] > ROOM[k] + 0.005)
      .map((k) => `${f} reaches ${ext[k].toFixed(2)} ${k} (room ${ROOM[k]})`),
  );
  expect(over).toEqual([]);
  expect(errors).toEqual([]);
});
