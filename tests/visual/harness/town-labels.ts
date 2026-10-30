import {
  paintedPlinth,
  plinthLabelBounds,
} from "../../../apps/client/src/town-environment-art";
import { statuePlinth } from "../../../apps/client/src/town-art";
import { TOWN_ART } from "../../../apps/client/src/town-assets";
import { RAID_BOSSES } from "../../../packages/shared/src/raid-roster";

export async function auditBossPlinths() {
  await document.fonts.load('700 7px "Barlow Condensed"');
  const source = new Image();
  source.src = TOWN_ART.props;
  await source.decode();
  return Object.values(RAID_BOSSES).map((boss) => {
    const original = statuePlinth(boss.name, boss.color),
      sprite = paintedPlinth(source, original, boss.name);
    const canvas = document.createElement("canvas");
    canvas.width = original.w * 4;
    canvas.height = original.h * 4;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(4, 4);
    const glyphs: {
      text: string;
      x: number;
      y: number;
      right: number;
      bottom: number;
    }[] = [];
    const native = ctx.fillText.bind(ctx);
    ctx.fillText = (text, x, y, maxWidth) => {
      // Text metrics are rounded to whole pixels of the font size; measure
      // at 16x for the real ink bounds of these 5-7px labels.
      const font = ctx.font;
      ctx.font = font.replace(/([\d.]+)px/, (_, px) => `${Number(px) * 16}px`);
      const big = ctx.measureText(text);
      ctx.font = font;
      const m = {
        left: big.actualBoundingBoxLeft / 16,
        right: big.actualBoundingBoxRight / 16,
        ascent: big.actualBoundingBoxAscent / 16,
        descent: big.actualBoundingBoxDescent / 16,
      };
      glyphs.push({
        text,
        x: x - m.left,
        y: y - m.ascent,
        right: x + m.right,
        bottom: y + m.descent,
      });
      if (maxWidth === undefined) native(text, x, y);
      else native(text, x, y, maxWidth);
    };
    sprite.draw(ctx);
    return { boss: boss.name, plaque: plinthLabelBounds(original), glyphs };
  });
}
