/**
 * Share card (UI remodel step 7, decision 7): your player card as a picture,
 * drawn on the device the way share-card.ts draws match results: 1200×630
 * (the usual link-preview size), your fighter in the look you wear, your
 * title, name, level, rank and the four numbers. Nothing is uploaded.
 */
import { CHARACTERS } from "../../../../packages/shared/src/index";
import { playerLevel } from "../../../../packages/shared/src/journey";
import { fit, loadImage, sharePicture } from "../share-card";
import {
  bestMastery,
  profileTiles,
  rankLine,
  cardArt,
  type ProfileData,
} from "./profile-view";

const W = 1200,
  H = 630;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const safe = (c: string | null | undefined, fallback: string) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;

/** The card's words, also used for the share message. */
export function cardSummary(d: ProfileData) {
  const level = d.journey ? playerLevel(d.journey.xp).level : null;
  const rank = rankLine(d.progress);
  const best = bestMastery(d.progress);
  const facts = [
    level !== null ? `Level ${level}` : "",
    rank ? rank.text : "",
    best ? best.text : "",
  ].filter(Boolean);
  return {
    facts,
    text: `${d.name}${d.title ? `, ${d.title}` : ""}${facts.length ? ` · ${facts.join(" · ")}` : ""} in Element Arena.`,
  };
}

/** The fighter's picture as an image source (SVG or the pack's file). */
function artSource(d: ProfileData) {
  const art = cardArt(d.fighter, "share");
  const img = art.match(/^<img[^>]*src="([^"]+)"/);
  if (img) return img[1];
  const svg = art.includes("xmlns=")
    ? art
    : art.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function drawPlayerCard(
  canvas: HTMLCanvasElement,
  d: ProfileData,
  site: string,
  withArt = true,
) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const el = hex(CHARACTERS[d.fighter].color);
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#12213e");
  bg.addColorStop(1, "#0b1020");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // The fighter's panel: a glow in its element's colour.
  g.save();
  g.beginPath();
  g.roundRect(40, 40, 420, 550, 28);
  g.clip();
  const glow = g.createRadialGradient(250, 360, 20, 250, 360, 320);
  glow.addColorStop(0, `${el}66`);
  glow.addColorStop(1, "#0000");
  g.fillStyle = "#1a2547";
  g.fillRect(40, 40, 420, 550);
  g.fillStyle = glow;
  g.fillRect(40, 40, 420, 550);
  if (withArt) {
    try {
      const img = await loadImage(artSource(d));
      g.drawImage(img, 60, 70, 380, 400);
    } catch {
      /* the card still works without the picture */
    }
  }
  g.restore();
  g.strokeStyle = `${el}aa`;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(40, 40, 420, 550, 28);
  g.stroke();
  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.font = "800 40px system-ui, sans-serif";
  g.fillText(fit(g, CHARACTERS[d.fighter].name.toUpperCase(), 380), 250, 545);
  // Right: who you are and your numbers.
  g.textAlign = "left";
  g.fillStyle = "#ffd65b";
  g.font = "700 22px system-ui, sans-serif";
  g.fillText("ELEMENT ARENA · PLAYER CARD", 510, 90);
  if (d.title) {
    g.fillStyle = safe(d.titleColor, "#d9b98a");
    g.font = "700 30px system-ui, sans-serif";
    g.fillText(fit(g, d.title, 640), 510, 150);
  }
  g.fillStyle = "#ffffff";
  g.font = "800 72px system-ui, sans-serif";
  g.fillText(fit(g, d.name, 640), 510, 225);
  const { facts } = cardSummary(d);
  const rank = rankLine(d.progress);
  let x = 510;
  g.font = "700 24px system-ui, sans-serif";
  for (const [i, fact] of facts.entries()) {
    const w = g.measureText(fact).width + 28;
    if (x + w > W - 40) break;
    g.fillStyle = "#1a2547";
    g.beginPath();
    g.roundRect(x, 255, w, 42, 10);
    g.fill();
    g.fillStyle = i === 1 && rank ? rank.color : "#eef2ff";
    g.fillText(fact, x + 14, 284);
    x += w + 12;
  }
  const tiles = profileTiles(d.progress, d.raids);
  const tw = (W - 40 - 510 - 3 * 14) / 4;
  for (const [i, t] of tiles.entries()) {
    const tx = 510 + i * (tw + 14);
    g.fillStyle = "#121a33";
    g.beginPath();
    g.roundRect(tx, 335, tw, 130, 16);
    g.fill();
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.font = "800 50px system-ui, sans-serif";
    g.fillText(fit(g, t.value, tw - 16), tx + tw / 2, 410);
    g.fillStyle = "#a0afc8";
    g.font = "600 20px system-ui, sans-serif";
    g.fillText(t.label, tx + tw / 2, 445);
  }
  g.textAlign = "left";
  g.fillStyle = "#a0afc8";
  g.font = "500 24px system-ui, sans-serif";
  g.fillText(`Play free: ${site.replace(/^https?:\/\//, "")}`, 510, 575);
  return canvas;
}

/** Share card: the share sheet with the picture, else download and copy. */
export function sharePlayerCard(d: ProfileData, site = location.origin) {
  const canvas = document.createElement("canvas");
  return sharePicture((withArt) => drawPlayerCard(canvas, d, site, withArt), {
    file: "element-arena-player-card.png",
    text: `${cardSummary(d).text} ${site}`,
  });
}
