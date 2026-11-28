import {
  CHARACTERS,
  type Fighter,
  type Snapshot,
} from "../../../packages/shared/src/index";
import { fighterTextureData } from "./fighter-art";
import { mvpOf } from "./match-recap";
import { SHARE_SITE, shareLink, shownSite } from "./share-link";

const W = 1200,
  H = 630;
/** Where the result card's QR code sits (tests read it back from here). */
export const RESULT_QR = { x: 1004, y: 22, size: 156 } as const;
const QR = RESULT_QR;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * The pictures are in Poster, the look every player has (owner, 27 Nov
 * 2026; themes/poster/tokens.css): the element colour's dotted page, square
 * ink blocks with a hard shadow, Anton capitals. They were the old look's
 * navy gradients, rounded cards and system type (audit C11, C12).
 */
export const POSTER = {
  el: "#ffd65b",
  ink: "#0d0d0f",
  ink2: "#1e1e22",
  dim: "#d6d5dc",
  shadow: "rgba(0, 0, 0, 0.28)",
} as const;
export const DISPLAY = '"Anton", Impact, "Arial Narrow", sans-serif';
export const BODY = '"Archivo", system-ui, sans-serif';

/** Poster's two faces, loaded before drawing (a canvas draws with what is
 * loaded); after 1.5 s the card draws with the fallbacks. */
export async function posterFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 64px "Anton"'),
        document.fonts.load('700 24px "Archivo"'),
        document.fonts.load('500 20px "Archivo"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* the fallbacks draw it */
  }
}

/** The page: the element colour with Poster's dots. */
export function posterPage(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = POSTER.el;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(13, 13, 15, 0.1)";
  for (let y = 11; y < h; y += 22)
    for (let x = 11; x < w; x += 22) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
}

/** A square block with Poster's hard shadow. */
export function posterBlock(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = POSTER.ink,
) {
  g.fillStyle = POSTER.shadow;
  g.fillRect(x + 8, y + 8, w, h);
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

/** A label in the element colour on an ink block ("ELEMENT ARENA"). */
export function posterTag(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  g.save();
  g.font = `400 24px ${DISPLAY}`;
  g.letterSpacing = "3px";
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const w = g.measureText(text).width + 28;
  posterBlock(g, x, y, w, 42);
  g.fillStyle = POSTER.el;
  g.fillText(text, x + 14, y + 31);
  g.restore();
  return w;
}

/** Sides as the card shows them: you (and your partner) first. */
function sides(state: Snapshot, myId: string) {
  const me = state.players.find((p) => p.id === myId);
  const team = (p: Fighter) =>
    p.team ?? (state.players.indexOf(p) % 2 === 0 ? 0 : 1);
  if (state.mode === "ffa" || !me)
    return [...state.players].sort(
      (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
    );
  return [
    ...state.players.filter((p) => team(p) === team(me)),
    ...state.players.filter((p) => team(p) !== team(me)),
  ];
}

/** The words on the card and in the share message. */
export function shareSummary(state: Snapshot, myId: string) {
  const me = state.players.find((p) => p.id === myId);
  const team = (p: Fighter) =>
    p.team ?? (state.players.indexOf(p) % 2 === 0 ? 0 : 1);
  const won =
    state.mode === "teams"
      ? !!me && state.winnerTeam === team(me)
      : state.winner === myId;
  const mine =
    state.mode === "teams" && me
      ? (state.teamScores?.[team(me)] ?? 0)
      : (state.scores[myId] ?? 0);
  const best =
    state.mode === "teams" && me
      ? Math.max(
          ...(state.teamScores ?? [0, 0]).filter((_, t) => t !== team(me)),
        )
      : Math.max(
          0,
          ...state.players
            .filter((p) => p.id !== myId)
            .map((p) => state.scores[p.id] ?? 0),
        );
  const others = state.players.filter((p) => p.id !== myId);
  const versus =
    state.mode === "teams" && me
      ? others
          .filter((p) => team(p) !== team(me))
          .map((p) => p.name)
          .join(" & ")
      : others.map((p) => p.name).join(", ");
  const headline = won
    ? state.mode === "ffa"
      ? "Last one standing!"
      : `Victory ${mine}–${best}`
    : `Fought hard ${mine}–${best}`;
  const fighter = me ? CHARACTERS[me.character].name : "";
  const text = won
    ? `I just won ${mine}–${best} against ${versus} in Element Arena${fighter ? ` with ${fighter}` : ""}. Think you can beat me?`
    : `Close one against ${versus} in Element Arena (${mine}–${best}). Rematch me!`;
  return { won, headline, text, versus };
}

/** A picture to draw on a card. `cors`: ask another origin for it with
 * CORS, so drawing it keeps the canvas exportable. */
export function loadImage(src: string, cors = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw the result card onto a 1200×630 canvas (the usual link-preview size). */
export async function drawShareCard(
  canvas: HTMLCanvasElement,
  state: Snapshot,
  myId: string,
  site: string,
  withArt = true,
) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const { headline } = shareSummary(state, myId);
  await posterFonts();
  posterPage(g, W, H);
  g.textBaseline = "alphabetic";
  posterTag(g, "ELEMENT ARENA", 60, 34);
  // The headline in Anton capitals, clear of the code's label on the right.
  g.fillStyle = POSTER.ink;
  g.textAlign = "left";
  g.fillText(
    fitFont(g, headline.toUpperCase(), QR.x - 200 - 60, 400, 84, 44, DISPLAY),
    60,
    160,
  );
  // The fighters, each on an ink block with their colour along its top.
  const list = sides(state, myId);
  const slot = (W - 120) / list.length;
  const mvp = mvpOf(state.players);
  for (const [i, p] of list.entries()) {
    const c = CHARACTERS[p.character];
    const x = 60 + i * slot,
      cx = x + slot / 2,
      bw = slot - 24;
    posterBlock(g, x + 4, 196, bw, 330);
    // The colour band inside the ink's edge, so a yellow fighter's (Voltkit)
    // still reads on the yellow page.
    g.fillStyle = hex(c.color);
    g.fillRect(x + 10, 202, bw - 12, 6);
    if (p.id === myId) {
      g.save();
      g.font = `400 20px ${DISPLAY}`;
      g.letterSpacing = "2px";
      const tw = g.measureText("YOU").width + 20;
      g.fillStyle = POSTER.el;
      g.fillRect(x + 16, 220, tw, 30);
      g.fillStyle = POSTER.ink;
      g.fillText("YOU", x + 26, 243);
      g.restore();
    }
    if (withArt) {
      try {
        const img = await loadImage(fighterTextureData(p.character));
        const size = Math.min(190, bw - 40);
        g.drawImage(img, cx - 2 - size / 2, 220, size, size);
      } catch {
        /* the card still works without the picture */
      }
    }
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.fillText(
      fitFont(g, p.name.toUpperCase(), bw - 30, 400, 34, 22, DISPLAY),
      cx - 2,
      448,
    );
    g.fillStyle = hex(c.color);
    g.font = `700 18px ${BODY}`;
    g.fillText(c.name.toUpperCase(), cx - 2, 476);
    g.fillStyle = POSTER.dim;
    g.font = `500 18px ${BODY}`;
    g.fillText(
      `${state.mode === "ffa" ? `${state.scores[p.id] ?? 0} rounds · ` : ""}${Math.round(p.stats.dealt)} dmg · ${p.stats.kos ?? 0} KO${p.id === mvp?.id ? " · MVP" : ""}`,
      cx - 2,
      506,
    );
    g.textAlign = "left";
  }
  g.fillStyle = POSTER.ink;
  g.font = `400 30px ${DISPLAY}`;
  g.letterSpacing = "1px";
  g.fillText(`PLAY FREE · ${shownSite(site).toUpperCase()}`, 60, 590);
  g.letterSpacing = "0px";
  // Top right, clear of the headline and the fighters: a camera opens the
  // game from the picture.
  await drawScanToPlay(
    g,
    shareLink("result", site),
    QR.x,
    QR.y,
    QR.size,
    "left",
  );
  return canvas;
}

/** Shorten a name to fit a width. */
export function fit(g: CanvasRenderingContext2D, text: string, width: number) {
  if (g.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > width)
    t = t.slice(0, -1);
  return `${t}…`;
}

/** The biggest font (from `max` down to `min` px) that fits `text` in
 * `width`; at `min` the words are shortened as a last resort. */
export function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  width: number,
  weight: number,
  max: number,
  min: number,
  family = BODY,
) {
  let size = max;
  g.font = `${weight} ${size}px ${family}`;
  while (size > min && g.measureText(text).width > width) {
    size -= 2;
    g.font = `${weight} ${size}px ${family}`;
  }
  return fit(g, text, width);
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      resolve(null);
    }
  });
}

/**
 * Share a picture: it opens large (share-preview.ts) with the ways this
 * device has to keep it: the share sheet, a download, or a long press.
 * `draw(withArt)` draws the canvas; it is asked again without art if the
 * browser refuses to export the first one (some refuse a canvas with SVG
 * drawn on it).
 */
export async function sharePicture(
  draw: (withArt: boolean) => Promise<HTMLCanvasElement>,
  o: { file: string; text: string; title?: string; label: string },
): Promise<"shown" | "failed"> {
  let blob = await toBlob(await draw(true));
  if (!blob) blob = await toBlob(await draw(false));
  if (!blob) return "failed";
  const { showSharePreview } = await import("./share-preview");
  // Resolves once the picture is closed.
  await showSharePreview({ ...o, blob });
  return "shown";
}

/** The QR code and its label in a corner of a card (share-qr.ts, loaded
 * with the picture). */
export async function drawScanToPlay(
  g: CanvasRenderingContext2D,
  link: string,
  x: number,
  y: number,
  size: number,
  label: "above" | "left" = "above",
) {
  const { drawQr } = await import("./share-qr");
  g.save();
  g.textBaseline = "alphabetic";
  // Ink on the element colour's page (Poster).
  g.fillStyle = POSTER.ink;
  g.font = `400 22px ${DISPLAY}`;
  g.letterSpacing = "2px";
  if (label === "above") {
    g.textAlign = "center";
    g.fillText("SCAN TO PLAY", x + size / 2, y - 12);
  } else {
    g.textAlign = "right";
    g.fillText("SCAN", x - 18, y + size / 2 - 6);
    g.fillText("TO PLAY", x - 18, y + size / 2 + 20);
  }
  g.restore();
  return drawQr(g, link, x, y, size);
}

/** Share a match result (the results screen's Share). */
export async function shareResult(
  state: Snapshot,
  myId: string,
  site = SHARE_SITE,
): Promise<"shown" | "failed"> {
  const { text } = shareSummary(state, myId);
  const canvas = document.createElement("canvas");
  return sharePicture(
    (withArt) => drawShareCard(canvas, state, myId, site, withArt),
    {
      file: "element-arena-result.png",
      text: `${text} ${site}`,
      label: "Your match result as a picture",
    },
  );
}
