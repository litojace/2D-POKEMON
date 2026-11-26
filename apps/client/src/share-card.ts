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
  const { won, headline } = shareSummary(state, myId);
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#12213e");
  bg.addColorStop(1, "#1b2e50");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.25, 60, 10, W * 0.25, 60, 520);
  glow.addColorStop(0, won ? "#ffd16655" : "#7fd3ff44");
  glow.addColorStop(1, "#0000");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ffd65b";
  g.font = "700 22px system-ui, sans-serif";
  g.fillText("ELEMENT ARENA", 60, 70);
  g.fillStyle = "#ffffff";
  g.font = "800 68px system-ui, sans-serif";
  g.fillText(headline, 60, 150);
  // The fighters, each with their creature.
  const list = sides(state, myId);
  const slot = (W - 120) / list.length;
  const mvp = mvpOf(state.players);
  for (const [i, p] of list.entries()) {
    const c = CHARACTERS[p.character];
    const x = 60 + i * slot,
      cx = x + slot / 2;
    g.fillStyle = `${hex(c.color)}22`;
    g.beginPath();
    g.roundRect(x + 8, 190, slot - 16, 330, 18);
    g.fill();
    if (p.id === myId) {
      g.strokeStyle = "#ffffffaa";
      g.lineWidth = 3;
      g.stroke();
    }
    if (withArt) {
      try {
        const img = await loadImage(fighterTextureData(p.character));
        const size = Math.min(200, slot - 40);
        g.drawImage(img, cx - size / 2, 200, size, size);
      } catch {
        /* the card still works without the picture */
      }
    }
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.fillText(fitFont(g, p.name, slot - 30, 700, 30, 20), cx, 440);
    g.fillStyle = hex(c.color);
    g.font = "600 20px system-ui, sans-serif";
    g.fillText(c.name.toUpperCase(), cx, 470);
    g.fillStyle = "#c1cfe4";
    g.font = "500 18px system-ui, sans-serif";
    g.fillText(
      `${state.mode === "ffa" ? `${state.scores[p.id] ?? 0} rounds · ` : ""}${Math.round(p.stats.dealt)} dmg · ${p.stats.kos ?? 0} KO${p.id === mvp?.id ? " · MVP" : ""}`,
      cx,
      500,
    );
    g.textAlign = "left";
  }
  g.fillStyle = "#a0afc8";
  g.font = "500 24px system-ui, sans-serif";
  g.fillText(`Play free: ${shownSite(site)}`, 60, 585);
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
) {
  let size = max;
  g.font = `${weight} ${size}px system-ui, sans-serif`;
  while (size > min && g.measureText(text).width > width) {
    size -= 2;
    g.font = `${weight} ${size}px system-ui, sans-serif`;
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
  g.fillStyle = "#ffd65b";
  g.font = "800 20px system-ui, sans-serif";
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
