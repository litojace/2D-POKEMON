/*
 * The Plaza map: a small painted picture of the whole Plaza, made once from
 * the ground picture the scene already paints (paths, square, track, pitch,
 * pond rim, flower beds), with the things drawn live on top of it in
 * miniature (houses, trees, the stage and its screen, the truck, the pond's
 * water). The map dialog and the map board by the square both use it, so
 * a player always sees the same map.
 *
 * Painted once (the first time the dialog opens, or when the board is first
 * drawn), never per frame: about a 900 × 570 canvas, a few milliseconds.
 */
import {
  PLAZA,
  PLAZA_CAFE,
  PLAZA_HOUSES,
  PLAZA_LED,
  PLAZA_PLACES,
  PLAZA_POND,
  PLAZA_STAGE,
  PLAZA_TREES,
  type PlazaPlace,
} from "../../../../packages/shared/src/plaza";

const W = PLAZA.width,
  H = PLAZA.height;

/** The map's picture: world (0, 0)–(W, H) scaled to `width` px across. */
export function paintPlazaMap(
  ground: HTMLCanvasElement,
  margin: number,
  width: number,
): HTMLCanvasElement {
  const k = width / W,
    c = document.createElement("canvas");
  c.width = Math.round(width);
  c.height = Math.round(H * k);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(ground, margin, margin, W, H, 0, 0, c.width, c.height);
  g.scale(k, k);
  // A little more contrast and warmth than the ground itself, as printed
  // park maps are: it reads at a small size.
  g.fillStyle = "rgba(255,240,200,.08)";
  g.fillRect(0, 0, W, H);
  // The pond's water (the ground has only its rim).
  const P = PLAZA_POND,
    water = g.createRadialGradient(
      P.x - P.rx * 0.3,
      P.y - P.ry * 0.4,
      10,
      P.x,
      P.y,
      P.rx,
    );
  water.addColorStop(0, "#9fe3ff");
  water.addColorStop(1, "#2f8fd0");
  g.fillStyle = water;
  g.beginPath();
  g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2);
  g.fill();
  // The stage's screen and its truss.
  g.fillStyle = "#14102a";
  g.fillRect(
    PLAZA_LED.x0 - 24,
    PLAZA_LED.y0 - 34,
    PLAZA_LED.x1 - PLAZA_LED.x0 + 48,
    PLAZA_STAGE.y0 - PLAZA_LED.y0 + 34,
  );
  const scr = g.createLinearGradient(PLAZA_LED.x0, 0, PLAZA_LED.x1, 0);
  scr.addColorStop(0, "#8a3ad0");
  scr.addColorStop(1, "#3a5ad0");
  g.fillStyle = scr;
  g.fillRect(
    PLAZA_LED.x0,
    PLAZA_LED.y0,
    PLAZA_LED.x1 - PLAZA_LED.x0,
    PLAZA_LED.y1 - PLAZA_LED.y0,
  );
  // The Volt Boba truck.
  g.fillStyle = "#5fcfc0";
  g.beginPath();
  g.roundRect(PLAZA_CAFE.x - 120, PLAZA_CAFE.y - 120, 240, 110, 20);
  g.fill();
  g.fillStyle = "#ff9bd2";
  g.fillRect(PLAZA_CAFE.x - 120, PLAZA_CAFE.y - 120, 240, 26);
  // Houses: a wall and a roof each.
  for (const h of PLAZA_HOUSES) {
    const w = h.o.w * 1.25,
      x0 = h.x - w / 2 + 14;
    g.fillStyle = "rgba(0,0,0,.25)";
    g.fillRect(x0 + 8, h.y - 110, w, 120);
    g.fillStyle = h.o.wall;
    g.fillRect(x0, h.y - 120, w, 120);
    g.fillStyle = h.o.roof;
    g.beginPath();
    g.moveTo(x0 - 18, h.y - 110);
    g.lineTo(x0 + w / 2, h.y - 230);
    g.lineTo(x0 + w + 18, h.y - 110);
    g.closePath();
    g.fill();
  }
  // Trees: a shadow and a round crown in their own colour.
  const CROWN: Record<string, string> = {
    pine: "#2f7a4a",
    round: "#4fae46",
    mint: "#45c49a",
    autumn: "#f08a3a",
    cherry: "#ffb3d1",
    apple: "#4fae46",
    orange: "#58b048",
    lime: "#8fcf4a",
  };
  for (const t of PLAZA_TREES) {
    g.fillStyle = "rgba(20,50,20,.35)";
    g.beginPath();
    g.ellipse(t.x + 12, t.y - 4, 62, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = CROWN[t.kind] ?? "#4fae46";
    g.beginPath();
    g.arc(t.x, t.y - 60, 64, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.22)";
    g.beginPath();
    g.arc(t.x - 18, t.y - 80, 24, 0, Math.PI * 2);
    g.fill();
  }
  // A soft vignette, so the edge reads as the map's edge.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const v = g.createRadialGradient(
    c.width / 2,
    c.height / 2,
    c.height * 0.45,
    c.width / 2,
    c.height / 2,
    c.width * 0.62,
  );
  v.addColorStop(0, "rgba(20,30,20,0)");
  v.addColorStop(1, "rgba(20,30,20,.35)");
  g.fillStyle = v;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** A place's spot on the map, as a fraction of its width and height. */
export const mapFrac = (x: number, y: number) => ({ fx: x / W, fy: y / H });

/** The places' pins over the map (HTML), each one a Go button. */
export function mapPinsHtml(
  places: readonly PlazaPlace[],
  icon: (name: string) => string,
  questHere: (p: PlazaPlace) => boolean,
) {
  return places
    .map((p) => {
      const { fx, fy } = mapFrac(p.x, p.y);
      return `<button type="button" class="pz-pin${questHere(p) ? " quest" : ""}${p.label ? ` ${p.label}` : ""}" data-place="${p.id}" style="left:${(fx * 100).toFixed(2)}%;top:${(fy * 100).toFixed(2)}%" aria-label="Go to ${p.name}">${icon(p.icon)}<span>${p.name}</span></button>`;
    })
    .join("");
}

export { PLAZA_PLACES };
