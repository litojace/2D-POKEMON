/**
 * Share card (UI remodel step 7, decision 7): your player card as a picture,
 * drawn on the device the way share-card.ts draws match results: 1200×630
 * (the usual link-preview size), your avatar (docs/hidden-picks.md,
 * "Avatars"), your title, name, level, rank and the four numbers, and a
 * QR code to the game (share-link.ts). Nothing is uploaded.
 */
import { playerLevel } from "../../../../packages/shared/src/journey";
import { drawScanToPlay, fit, loadImage, sharePicture } from "../share-card";
import { SHARE_SITE, shareLink, shownSite } from "../share-link";
import { avatarSrc } from "../portraits";
import {
  bestMastery,
  profileTiles,
  rankLine,
  type ProfileData,
} from "./profile-view";

const W = 1200,
  H = 630;
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

/** Your avatar's picture: a library one is the client's own file; your own
 * picture comes from the game server (asked for with CORS, so the canvas
 * can still be saved; if the server says no, the card goes without it). */
const artSource = (d: ProfileData) => avatarSrc(d.avatar);

/** Where the card's QR code sits (tests read it back from here). */
export const CARD_QR = { x: 936, y: 346, size: 224 } as const;

export async function drawPlayerCard(
  canvas: HTMLCanvasElement,
  d: ProfileData,
  site: string,
  withArt = true,
) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const el = "#ffd65b";
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#12213e");
  bg.addColorStop(1, "#0b1020");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Your panel: a gold glow behind your avatar, the address under it.
  const cy = 282;
  g.save();
  g.beginPath();
  g.roundRect(40, 40, 420, 550, 28);
  g.clip();
  const glow = g.createRadialGradient(250, cy + 60, 20, 250, cy + 60, 320);
  glow.addColorStop(0, `${el}66`);
  glow.addColorStop(1, "#0000");
  g.fillStyle = "#1a2547";
  g.fillRect(40, 40, 420, 550);
  g.fillStyle = glow;
  g.fillRect(40, 40, 420, 550);
  if (withArt) {
    try {
      const img = await loadImage(artSource(d), true);
      g.save();
      g.beginPath();
      g.arc(250, cy, 170, 0, Math.PI * 2);
      g.clip();
      g.drawImage(img, 80, cy - 170, 340, 340);
      g.restore();
      g.strokeStyle = el;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(250, cy, 172, 0, Math.PI * 2);
      g.stroke();
    } catch {
      /* the card still works without the picture */
    }
  }
  g.textAlign = "center";
  g.fillStyle = "#a0afc8";
  g.font = "600 20px system-ui, sans-serif";
  g.fillText("Play free at", 250, 522);
  g.fillStyle = "#ffffff";
  g.fillText(fitFont(g, shownSite(site), 380, 700, 28, 18), 250, 558);
  g.restore();
  g.strokeStyle = `${el}aa`;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(40, 40, 420, 550, 28);
  g.stroke();
  // Right: who you are and your numbers.
  g.textAlign = "left";
  g.fillStyle = "#ffd65b";
  g.font = "700 22px system-ui, sans-serif";
  g.fillText("ELEMENT ARENA · PLAYER CARD", 510, 90);
  if (d.title) {
    g.fillStyle = safe(d.titleColor, "#d9b98a");
    g.fillText(fitFont(g, d.title, 650, 700, 30, 22), 510, 150);
  }
  g.fillStyle = "#ffffff";
  g.fillText(fitFont(g, d.name, 650, 800, 72, 32), 510, 225);
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
  // The four numbers, two by two, beside the QR code; their bottoms line up.
  const tiles = profileTiles(d.progress, d.raids);
  const gap = 14,
    top = 330,
    bottom = CARD_QR.y + CARD_QR.size;
  const tw = (CARD_QR.x - 20 - 510 - gap) / 2,
    th = (bottom - top - gap) / 2;
  for (const [i, t] of tiles.entries()) {
    const tx = 510 + (i % 2) * (tw + gap),
      ty = top + Math.floor(i / 2) * (th + gap);
    g.fillStyle = "#121a33";
    g.beginPath();
    g.roundRect(tx, ty, tw, th, 16);
    g.fill();
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.fillText(fitFont(g, t.value, tw - 20, 800, 46, 28), tx + tw / 2, ty + 62);
    g.fillStyle = "#a0afc8";
    g.font = "600 20px system-ui, sans-serif";
    g.fillText(t.label, tx + tw / 2, ty + 94);
  }
  g.textAlign = "left";
  await drawScanToPlay(
    g,
    shareLink("card", site),
    CARD_QR.x,
    CARD_QR.y,
    CARD_QR.size,
  );
  return canvas;
}

/** Share card: the picture large, to share or keep (share-preview.ts). */
export function sharePlayerCard(d: ProfileData, site = SHARE_SITE) {
  const canvas = document.createElement("canvas");
  return sharePicture((withArt) => drawPlayerCard(canvas, d, site, withArt), {
    file: "element-arena-player-card.png",
    text: `${cardSummary(d).text} ${site}`,
    label: "Your player card as a picture",
  });
}
