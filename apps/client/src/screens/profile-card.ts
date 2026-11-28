/**
 * Share card (UI remodel step 7, decision 7): your player card as a picture,
 * drawn on the device the way share-card.ts draws match results: 1200×630
 * (the usual link-preview size), your avatar (docs/hidden-picks.md,
 * "Avatars"), your title, name, level, rank and the four numbers, and a
 * QR code to the game (share-link.ts). Nothing is uploaded.
 */
import { playerLevel } from "../../../../packages/shared/src/journey";
import {
  BODY,
  DISPLAY,
  POSTER,
  drawScanToPlay,
  fitFont,
  loadImage,
  posterBlock,
  posterFonts,
  posterPage,
  posterTag,
  sharePicture,
} from "../share-card";
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
  await posterFonts();
  posterPage(g, W, H);
  // Your panel: an ink block, your avatar framed square in the element
  // colour, the address under it.
  const cy = 270;
  posterBlock(g, 40, 40, 420, 550);
  if (withArt) {
    try {
      const img = await loadImage(artSource(d), true);
      g.fillStyle = POSTER.el;
      g.fillRect(72, cy - 178, 356, 356);
      g.drawImage(img, 80, cy - 170, 340, 340);
    } catch {
      /* the card still works without the picture */
    }
  }
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = POSTER.dim;
  g.font = `600 20px ${BODY}`;
  g.fillText("Play free at", 250, 520);
  g.fillStyle = POSTER.el;
  g.fillText(
    fitFont(g, shownSite(site).toUpperCase(), 380, 400, 32, 20, DISPLAY),
    250,
    560,
  );
  // Right: who you are and your numbers.
  g.textAlign = "left";
  posterTag(g, "ELEMENT ARENA · PLAYER CARD", 510, 40);
  if (d.title) {
    // In ink on the page: a title's own colour is often pale (made for the
    // old look's navy) and would not read on the element colour.
    g.fillStyle = POSTER.ink;
    g.fillText(fitFont(g, d.title, 650, 700, 28, 20), 510, 128);
  }
  g.fillStyle = POSTER.ink;
  g.fillText(
    fitFont(g, d.name.toUpperCase(), 650, 400, 84, 36, DISPLAY),
    510,
    212,
  );
  const { facts } = cardSummary(d);
  const rank = rankLine(d.progress);
  let x = 510;
  g.font = `700 22px ${BODY}`;
  for (const [i, fact] of facts.entries()) {
    const w = g.measureText(fact).width + 28;
    if (x + w > W - 40) break;
    g.fillStyle = POSTER.ink;
    g.fillRect(x, 240, w, 42);
    g.fillStyle = i === 1 && rank ? rank.color : "#ffffff";
    g.font = `700 22px ${BODY}`;
    g.fillText(fact, x + 14, 268);
    x += w + 10;
  }
  // The four numbers, two by two, beside the QR code; their bottoms line up.
  const tiles = profileTiles(d.progress, d.raids);
  const gap = 18,
    top = 320,
    bottom = CARD_QR.y + CARD_QR.size;
  const tw = (CARD_QR.x - 28 - 510 - gap) / 2,
    th = (bottom - top - gap) / 2;
  for (const [i, t] of tiles.entries()) {
    const tx = 510 + (i % 2) * (tw + gap),
      ty = top + Math.floor(i / 2) * (th + gap);
    posterBlock(g, tx, ty, tw, th);
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.fillText(
      fitFont(g, t.value, tw - 20, 400, 50, 28, DISPLAY),
      tx + tw / 2,
      ty + 66,
    );
    g.fillStyle = POSTER.dim;
    g.font = `600 18px ${BODY}`;
    g.fillText(t.label.toUpperCase(), tx + tw / 2, ty + 98);
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
