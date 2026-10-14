import {
  CHARACTERS,
  type Fighter,
  type Snapshot,
} from "../../../packages/shared/src/index";
import { fighterTextureData } from "./fighter-art";
import { mvpOf } from "./match-recap";

const W = 1200,
  H = 630;
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
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
    g.font = "700 30px system-ui, sans-serif";
    g.fillText(fit(g, p.name, slot - 30), cx, 440);
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
  g.fillText(`Play free: ${site.replace(/^https?:\/\//, "")}`, 60, 585);
  return canvas;
}

/** Shorten a name to fit a width. */
function fit(g: CanvasRenderingContext2D, text: string, width: number) {
  if (g.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
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
 * Share the result: the phone's share sheet with the picture when it can,
 * otherwise download the picture and copy the message.
 */
export async function shareResult(
  state: Snapshot,
  myId: string,
  site = location.origin,
): Promise<"shared" | "downloaded" | "failed"> {
  const { text } = shareSummary(state, myId);
  const canvas = document.createElement("canvas");
  await drawShareCard(canvas, state, myId, site);
  // Some browsers refuse to export a canvas with SVG drawn on it: redraw plain.
  let blob = await toBlob(canvas);
  if (!blob) blob = await toBlob(await drawShareCard(canvas, state, myId, site, false));
  if (!blob) return "failed";
  const file = new File([blob], "element-arena-result.png", {
    type: "image/png",
  });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `${text} ${site}`, title: "Element Arena" });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try {
    await navigator.clipboard.writeText(`${text} ${site}`);
  } catch {
    /* the picture alone is fine */
  }
  return "downloaded";
}
