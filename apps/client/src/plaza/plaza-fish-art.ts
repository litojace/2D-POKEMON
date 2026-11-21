/**
 * The pond's fish, drawn for the Fish book and the catch card (SVG, in the
 * page, never on the Plaza's canvas: no cost to the scene). Each fish in
 * PLAZA_FISH names a body shape and its markings; its two colours tint
 * them. Head to the right, in a 64 × 40 box. A fish not caught yet is its
 * shape alone, in shadow.
 */
import type {
  PlazaFish,
  PlazaFishMark,
  PlazaFishShape,
} from "../../../../packages/shared/src/plaza";

interface ShapeArt {
  /** The body outline. */
  body: string;
  /** Tail, dorsal and other fins (drawn behind the body). */
  fins: string[];
  /** Fin rays: thin lines over the fins. */
  rays: string;
  /** A fin drawn over the body (the pectoral fin). */
  front?: string;
  /** Eye centre and radius; the gill arc; the mouth. */
  eye: [number, number, number];
  gill: string;
  mouth: string;
  /** Extras drawn last (whiskers, a lure, a snout's plates). */
  extra?: (fin: string, dark: string) => string;
  /** Spots, bars and scales: where the body is (x range, y centre, half height). */
  span: [number, number, number, number];
}

const SHAPES: Record<PlazaFishShape, ShapeArt> = {
  minnow: {
    body: "M10 20C17 12 37 10 50 15.5Q57 19 50 24C37 30 17 28 10 20Z",
    fins: [
      "M12 20 2 11Q6 20 2 29Z",
      "M25 13Q31 4 39 11.5Z",
      "M27 27Q31 33 36 28Z",
    ],
    rays: "M4 14 11 19.5M3.5 20H11M4 26 11 20.5M28 11 31 6M32 11 34 6.5M35 11.5 37 9",
    front: "M36 22Q30 26 29 23Q32 21 36 22Z",
    eye: [47, 18, 2.4],
    gill: "M42 14Q39 20 42 25",
    mouth: "M54.5 20.5Q52.5 21.5 51.5 20.8",
    span: [12, 52, 20, 7],
  },
  guppy: {
    body: "M21 20C24 12.5 41 11 50 16Q55 20 50 24C41 29 24 27.5 21 20Z",
    fins: [
      "M23 20C13 4 1 6 3 20C1 34 13 36 23 20Z",
      "M31 14Q35 6 43 13Z",
      "M33 26Q36 32 41 26.5Z",
    ],
    rays: "M21 19 5 10M21 19.5 3.5 15M21 20H3M21 20.5 3.5 25M21 21 5 30M34 13 36 8.5M38 13 40 9.5",
    front: "M41 22Q36 26 35 23Q38 21 41 22Z",
    eye: [47, 18.5, 2.5],
    gill: "M43 15Q40.5 20 43 24.5",
    mouth: "M53.8 20.6Q52 21.4 51 20.8",
    span: [24, 52, 20, 6.5],
  },
  carp: {
    body: "M12 20C15 8 40 6.5 52 15.5Q58 20 52 24.5C40 33.5 15 32 12 20Z",
    fins: [
      "M14 20 3 8Q9 20 3 32Z",
      "M20 10.5Q30 2 43 9L41 12Q30 9.5 22 12.5Z",
      "M24 29Q30 36 36 30Z",
    ],
    rays: "M5 11 13 19M4 20H13M5 29 13 21M24 10 27 5.5M29 9 32 4.5M34 8.5 37 4.5M38 9 40.5 6.5",
    front: "M38 23Q31 28 29.5 24.5Q33 22 38 23Z",
    eye: [48, 17.5, 2.4],
    gill: "M43 12Q39.5 20 43 27",
    mouth: "M56 20.6Q54 22 52.5 21.2",
    extra: (fin) =>
      `<path d="M54 22.5Q55 26 57.5 27M53 23Q53 27 54.5 29" fill="none" stroke="${fin}" stroke-width="1" stroke-linecap="round"/>`,
    span: [14, 54, 20, 10],
  },
  perch: {
    body: "M11 20C15 10.5 39 9 51 15.5Q57 20 51 24.5C39 31 15 29.5 11 20Z",
    fins: [
      "M13 20 3 10Q8 20 3 30Z",
      "M19 13 22 4.5 25 11.5 28 3.5 31 11 34 4.5 37 12Z",
      "M25 28Q30 35 36 29Z",
    ],
    rays: "M5 13 12 19.5M4 20H12M5 27 12 20.5M22 5 22.5 12M28 4 28 11M34 5 33.5 11.5",
    front: "M37 22.5Q31 27 29.5 24Q33 21.5 37 22.5Z",
    eye: [47, 17.5, 2.6],
    gill: "M42 13Q38.5 20 42 26",
    mouth: "M55 20.4Q53 21.6 51.5 21",
    span: [13, 52, 20, 8.5],
  },
  eel: {
    body: "M4 23C10 15 19 26 29 19.5C37 14 48 13.5 57 17.5Q61.5 20 57 22.5C48 25.5 38 25 31 26.5C21 32 11 22 5 27Z",
    fins: [
      "M6 22C12 12 20 22 29 16C37 10.5 44 11 50 13.5L48 15.5C42 13.5 36 14 30 18C21 24 12 15 6 22Z",
    ],
    rays: "M14 17.5 15 15M22 19 22.5 16.5M30 16.5 31 14M38 14 38.5 12M45 13.5 45.5 12",
    eye: [54, 18.5, 2],
    gill: "M50 16Q48.5 20 50 23",
    mouth: "M60 20.5Q58 21.3 57 20.6",
    span: [6, 58, 20.5, 4.5],
  },
  koi: {
    body: "M11 20C14 9 38 7.5 51 15Q58 20 51 25C38 32.5 14 31 11 20Z",
    fins: [
      "M13 20C7 13 2 9 1.5 13Q5 20 1.5 27C2 31 7 27 13 20Z",
      "M22 11Q31 3.5 42 10L40 12.5Q31 10 24 13Z",
      "M25 28.5Q30 35 36 29.5Z",
    ],
    rays: "M3 12 12 19M2.5 20H12M3 28 12 21M26 10 29 5.5M31 9 34 5M36 9 38.5 6",
    front: "M37 23Q29 30 27.5 25Q32 22 37 23Z",
    eye: [48, 17.5, 2.4],
    gill: "M43 12.5Q39.5 20 43 27",
    mouth: "M56 20.5Q54 22 52.5 21.2",
    extra: (fin) =>
      `<path d="M54 22.5Q55.5 25.5 58 26" fill="none" stroke="${fin}" stroke-width="1" stroke-linecap="round"/>`,
    span: [13, 53, 20, 9.5],
  },
  catfish: {
    body: "M8 21C13 13 35 11 51 15.5Q59 18.5 57 23C42 29 16 29.5 8 21Z",
    fins: [
      "M10 21 2 13Q6 21 2.5 29Z",
      "M27 13.5Q30 6 36 12.5Z",
      "M16 25Q24 31 38 27Z",
    ],
    rays: "M4 15.5 9.5 20.5M3 21H9.5M4 26.5 9.5 21.5M29 12 31 8M32 12 34 9",
    front: "M41 22.5Q34 27.5 33 24.5Q36.5 22 41 22.5Z",
    eye: [49, 17.5, 1.8],
    gill: "M45 15Q43 20 45 25",
    mouth: "M58 21Q55 22.5 53 21.6",
    extra: (fin) =>
      `<path d="M55.5 20Q60 15 63 16M55.5 21.5Q61 21 63.5 24M54 23Q57 27 60 28.5M53 23Q54 28 55.5 31" fill="none" stroke="${fin}" stroke-width="1.1" stroke-linecap="round"/>`,
    span: [10, 56, 21, 7],
  },
  betta: {
    body: "M24 20C27.5 14 42 12.5 50 16.5Q54 20 50 23.5C42 27.5 27.5 26 24 20Z",
    fins: [
      "M26 20C15 3 1 4 3 13C7 17.5 5 22.5 3 27C1 36 15 37 26 20Z",
      "M29 15.5C27 5 39 2 45 14Z",
      "M29 24.5C27 35 39 38 45 26Z",
    ],
    rays: "M25 19 6 8M25 19.5 4 14M25 20H3.5M25 20.5 4 26M25 21 6 32M31 14 32 6M35 13.5 37 5.5M39 14 41 8M31 26 32 34M35 26.5 37 34.5M39 26 41 32",
    front: "M42 22Q37 27 35.5 23.5Q39 21.5 42 22Z",
    eye: [47.5, 18.5, 2.3],
    gill: "M43.5 15Q41 20 43.5 24.5",
    mouth: "M53.5 20.4Q51.8 21.4 50.8 20.8",
    span: [26, 52, 20, 5.5],
  },
  angel: {
    body: "M18 20C21 10 40 8 52 18Q55 20 52 22C40 32 21 30 18 20Z",
    fins: [
      "M20 20 10 11Q13 20 10 29Z",
      "M27 12.5C29 3 35 -2 47 13.5Q38 9 33 11.5Z",
      "M27 27.5C29 37 35 42 47 26.5Q38 31 33 28.5Z",
    ],
    rays: "M12 13.5 19 19.5M11.5 20H19M12 26.5 19 20.5M30 9 35 2.5M34 10.5 39 5M30 31 35 37.5M34 29.5 39 35",
    front: "M41 21.5Q36 26 34.5 23Q38 21 41 21.5Z",
    eye: [47, 17.5, 2.3],
    gill: "M43 13.5Q40 20 43 26.5",
    mouth: "M54.5 20.2Q53 21.2 52 20.7",
    span: [20, 52, 20, 10],
  },
  lantern: {
    body: "M10 22C13 13.5 34 8.5 52 14Q60 18 55 25C41 31 16 30.5 10 22Z",
    fins: [
      "M12 22 2.5 14Q7 22 2.5 30Z",
      "M24 14.5Q28 8 35 12.5Z",
      "M22 27Q28 33 35 28.5Z",
    ],
    rays: "M5 16.5 11 21.5M4 22H11M5 27.5 11 22.5M26 13 28 9.5M30 12.5 32 9.5",
    front: "M40 23Q33 28 32 25Q35 22.5 40 23Z",
    eye: [48, 17, 3],
    gill: "M43 13Q39.5 20 43 26.5",
    mouth: "M57.5 21C55 24.5 52 24 50.5 22.5",
    extra: (fin, dark) =>
      `<path d="M51 23.2 52 24.6 53.2 23.4 54.4 24.4 55.6 22.8" fill="none" stroke="#fff" stroke-width=".8" stroke-linejoin="round"/><path d="M49 13.5Q52 2 61 4.5" fill="none" stroke="${dark}" stroke-width="1.1" stroke-linecap="round"/><circle cx="61" cy="5" r="3.6" fill="${fin}" opacity=".35"/><circle cx="61" cy="5" r="2.2" fill="${fin}"/><circle cx="60.3" cy="4.3" r=".8" fill="#fff"/>`,
    span: [12, 55, 21, 7.5],
  },
  sturgeon: {
    body: "M5 20C14 14 39 12.5 55 16.5L62.5 19.2 55 22C39 26.5 14 26 5 20Z",
    fins: [
      "M7 20 1.5 8.5 4 20.5 1.5 27Z",
      "M18 15.5Q22 10 27 14.5Z",
      "M16 23.5Q22 29 28 25Z",
    ],
    rays: "M3 11.5 6.5 19.5M2.5 25 6.5 20.8M20 14.5 22 11.5",
    front: "M40 22Q33 26.5 31.5 23.8Q35 21.5 40 22Z",
    eye: [49, 18, 1.9],
    gill: "M44 15Q42 19.5 44 23.5",
    mouth: "M56 22.2Q54 23.2 52.5 22.6",
    extra: (fin, dark) =>
      `<g fill="${fin}" stroke="${dark}" stroke-width=".5">${[
        12, 18, 24, 30, 36, 42,
      ]
        .map(
          (x) =>
            `<path d="M${x} ${15.6 - (x > 30 ? 0.6 : 0)}l2-1.8 2 1.8-2 1.8z"/>`,
        )
        .join(
          "",
        )}</g><path d="M57 21.6Q57.5 24 59 24.5M55.5 22Q55.5 24.5 56.8 25.5" fill="none" stroke="${fin}" stroke-width=".9" stroke-linecap="round"/>`,
    span: [8, 55, 20, 5.5],
  },
};

/** Mix a colour toward another (0 = a, 1 = b). */
function mix(a: string, b: string, k: number) {
  const n = (h: string) => parseInt(h.slice(1, 7), 16),
    x = n(a),
    y = n(b);
  return (
    "#" +
    [16, 8, 0]
      .map((s) =>
        Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function marks(mark: PlazaFishMark, a: ShapeArt, fin: string, dark: string) {
  const [x0, x1, cy, h] = a.span,
    w = x1 - x0;
  switch (mark) {
    case "lateral":
      return `<path d="M${x0 + 2} ${cy}Q${x0 + w / 2} ${cy - 2} ${x1 - 6} ${cy - 1}" fill="none" stroke="${fin}" stroke-width="2" stroke-linecap="round" opacity=".9"/><path d="M${x0 + 4} ${cy + 0.8}Q${x0 + w / 2} ${cy - 1.2} ${x1 - 8} ${cy}" fill="none" stroke="#fff" stroke-width=".6" opacity=".7"/>`;
    case "bars":
      return [0.22, 0.42, 0.62]
        .map(
          (k) =>
            `<path d="M${x0 + w * k} ${cy - h - 2}q-2 ${h + 2} 0 ${2 * h + 4}" fill="none" stroke="${dark}" stroke-width="${(w / 14).toFixed(1)}" opacity=".55"/>`,
        )
        .join("");
    case "spots":
      return [
        [0.18, -0.2, 0.28],
        [0.35, 0.3, 0.22],
        [0.5, -0.35, 0.3],
        [0.62, 0.25, 0.18],
        [0.3, -0.55, 0.16],
        [0.75, -0.1, 0.14],
      ]
        .map(
          ([kx, ky, r]) =>
            `<ellipse cx="${(x0 + w * kx).toFixed(1)}" cy="${(cy + h * ky).toFixed(1)}" rx="${(h * r * 1.4).toFixed(1)}" ry="${(h * r).toFixed(1)}" fill="${fin}" opacity=".9"/>`,
        )
        .join("");
    case "scales": {
      let d = "";
      for (let row = -1; row <= 1; row++)
        for (let x = x0 + 4 + (row & 1) * 2.5; x < x1 - 10; x += 5)
          d += `M${x.toFixed(1)} ${(cy + row * h * 0.5 - 1.5).toFixed(1)}a2.6 2.6 0 0 0 0 5`;
      return `<path d="${d}" fill="none" stroke="${dark}" stroke-width=".7" opacity=".55"/><path d="${d}" fill="none" stroke="#fff" stroke-width=".4" opacity=".35" transform="translate(.6 0)"/>`;
    }
    case "zigzag":
      return `<path d="M${x0 + 4} ${cy + 1}l5-4 3 4 5-4 3 4 5-4 3 4 5-4 3 4 5-4 3 4 4-3" fill="none" stroke="${fin}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${x0 + 4} ${cy + 1}l5-4 3 4 5-4 3 4 5-4 3 4 5-4 3 4 5-4 3 4 4-3" fill="none" stroke="#fff" stroke-width=".5" stroke-linejoin="round"/>`;
    case "sparkle": {
      const star = (x: number, y: number, r: number) =>
        `<path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z" fill="${fin}"/>`;
      return (
        star(x0 + w * 0.3, cy - h * 0.3, 2.6) +
        star(x0 + w * 0.55, cy + h * 0.25, 2) +
        star(x0 + w * 0.72, cy - h * 0.35, 1.6) +
        [0.15, 0.42, 0.62, 0.85]
          .map(
            (k, i) =>
              `<circle cx="${(x0 + w * k).toFixed(1)}" cy="${(cy + h * (i % 2 ? -0.1 : 0.45)).toFixed(1)}" r=".9" fill="#fff" opacity=".85"/>`,
          )
          .join("")
      );
    }
  }
}

/** One fish, as SVG: its colours if caught, a shadow of its shape if not. */
export function fishArt(f: PlazaFish, known: boolean) {
  const a = SHAPES[f.shape] ?? SHAPES.minnow,
    id = `pzf-${f.id}${known ? "" : "-x"}`;
  if (!known)
    return `<svg viewBox="0 0 64 40" aria-hidden="true"><g fill="#28304e" stroke="#3a4468" stroke-width=".8">${a.fins.map((d) => `<path d="${d}"/>`).join("")}<path d="${a.body}"/></g><circle cx="${a.eye[0]}" cy="${a.eye[1]}" r="${a.eye[2] * 0.6}" fill="#3a4468"/></svg>`;
  const dark = mix(f.color, "#10142a", 0.55),
    deep = mix(f.color, "#10142a", 0.25),
    belly = mix(f.color, "#ffffff", 0.6),
    finDark = mix(f.fin, "#10142a", 0.35),
    [ex, ey, er] = a.eye;
  return `<svg viewBox="0 0 64 40" aria-hidden="true"><defs><linearGradient id="${id}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset=".45" stop-color="${f.color}"/><stop offset="1" stop-color="${belly}"/></linearGradient><linearGradient id="${id}-f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f.fin}" stop-opacity=".75"/><stop offset="1" stop-color="${f.fin}"/></linearGradient><clipPath id="${id}-c"><path d="${a.body}"/></clipPath></defs><g fill="url(#${id}-f)" stroke="${finDark}" stroke-width=".8" stroke-linejoin="round">${a.fins.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${a.rays}" fill="none" stroke="${finDark}" stroke-width=".55" stroke-linecap="round" opacity=".8"/><path d="${a.body}" fill="url(#${id}-b)"/><g clip-path="url(#${id}-c)">${marks(f.mark, a, f.fin, dark)}<path d="${a.body}" fill="none" stroke="#fff" stroke-width="3" opacity=".18" transform="translate(0 -2.2)"/></g><path d="${a.body}" fill="none" stroke="${dark}" stroke-width="1" stroke-linejoin="round"/><path d="${a.gill}" fill="none" stroke="${dark}" stroke-width=".9" stroke-linecap="round" opacity=".8"/>${a.front ? `<path d="${a.front}" fill="${f.fin}" stroke="${finDark}" stroke-width=".7"/>` : ""}<path d="${a.mouth}" fill="none" stroke="${dark}" stroke-width=".9" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="${er}" fill="#fff" stroke="${dark}" stroke-width=".6"/><circle cx="${ex + er * 0.15}" cy="${ey}" r="${er * 0.62}" fill="#0b1020"/><circle cx="${ex + er * 0.35}" cy="${ey - er * 0.3}" r="${er * 0.25}" fill="#fff"/>${a.extra ? a.extra(f.fin, dark) : ""}</svg>`;
}
