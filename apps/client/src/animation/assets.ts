import type { CharacterId } from "@arena/shared";
import { fighterArt } from "../fighter-art";
import type { Facing } from "./controller";
export type Part =
  | "tail"
  | "flame"
  | "wings"
  | "legL"
  | "legR"
  | "body"
  | "armL"
  | "armR"
  | "head"
  | "ears"
  | "eyes"
  | "scarf";
export const parts: Part[] = [
  "tail",
  "wings",
  "legL",
  "legR",
  "body",
  "armL",
  "armR",
  "head",
  "ears",
  "eyes",
  "scarf",
  "flame",
];
const palettes = {
  voltling: { body: "#ffdf65", chest: "#ffedb4", limb: "#ffd855" },
  emberwing: { body: "#f3a366", chest: "#ffe5b8", limb: "#f3a366" },
  aquashade: { body: "#5b91c6", chest: "#f3efdc", limb: "#5b91c6" },
  auralith: { body: "#689fc8", chest: "#f6e6bc", limb: "#3a455d" },
};
export interface RigAsset {
  key: string;
  url: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}
export function rigKey(id: CharacterId, dir: Facing, part: Part) {
  return `rig-${id}-${dir}-${part}`;
}
export function rigAssets(id: CharacterId): RigAsset[] {
  const document = new DOMParser().parseFromString(
    fighterArt(id),
    "image/svg+xml",
  );
  const take = (selector: string) => {
    const node = document.querySelector(selector);
    const text = node?.outerHTML ?? "";
    node?.remove();
    return text;
  };
  const eyes = take(".fighter-eyes"),
    ears = take(".fighter-ears"),
    head = take(".fighter-head");
  const flameNode =
    id === "emberwing"
      ? document.querySelector(".fighter-tail")?.lastElementChild
      : undefined;
  const flame = flameNode?.outerHTML ?? "";
  flameNode?.remove();
  const tail = take(".fighter-tail"),
    wings = take(".fighter-wings"),
    scarf = take(".fighter-scarf");
  const p = palettes[id];
  const definitions: Record<Part, { bounds: number[]; pivot: number[] }> = {
    tail: { bounds: [120, 60, 80, 115], pivot: [130, 137] },
    flame: { bounds: [140, 80, 40, 50], pivot: [158, 121] },
    wings: { bounds: [12, 45, 176, 100], pivot: [100, 115] },
    legL: { bounds: [50, 145, 45, 30], pivot: [78, 151] },
    legR: { bounds: [106, 145, 45, 30], pivot: [122, 151] },
    body: { bounds: [62, 105, 76, 65], pivot: [100, 130] },
    armL: { bounds: [45, 116, 32, 50], pivot: [65, 122] },
    armR: { bounds: [123, 116, 32, 50], pivot: [135, 122] },
    head: { bounds: [35, 45, 130, 88], pivot: [100, 100] },
    ears: { bounds: [32, 5, 135, 70], pivot: [100, 65] },
    eyes: { bounds: [60, 70, 80, 30], pivot: [100, 86] },
    scarf: { bounds: [60, 90, 125, 60], pivot: [100, 118] },
  };
  return (["up", "down", "left", "right"] as Facing[]).flatMap((dir) =>
    parts.map((part) => {
      const profile = dir === "left" || dir === "right",
        side = dir === "left" ? -1 : 1;
      const profileHead = `<ellipse fill="${p.body}" cx="100" cy="88" rx="32" ry="33"/><ellipse fill="${id === "voltling" ? p.body : p.chest}" cx="${100 + side * 26}" cy="103" rx="20" ry="12"/><path fill="${id === "auralith" ? "#3a455d" : p.body}" d="M77 67 66 48l18 8 16-11 17 12 17-9-8 20Z"/>${id === "voltling" ? `<ellipse fill="#ed7d75" stroke="none" cx="${100 + side * 15}" cy="102" rx="7" ry="5"/>` : ""}<path fill="none" d="M${100 + side * 23} 107q${side * 8} 5 ${side * 13} 0"/>`;
      const backHead = `<path fill="${p.body}" d="M58 86q-2-32 42-32t42 32q5 36-42 36T58 86Z"/>${id === "auralith" ? '<path fill="#3a455d" d="M62 77q38 15 76 0l-4 20q-34 14-68 0Z"/>' : id === "aquashade" ? '<path fill="#4274ac" d="m74 66 26-22 26 22-26 10Z"/>' : '<path fill="none" opacity=".4" d="M82 95q18 8 36 0"/>'}`;
      const arm = (x: number) =>
        `<path fill="${p.limb}" d="M${x - 7} 122q7-9 14 0l3 24q-9 17-17 0Z"/>${id === "auralith" ? `<path fill="#f5f4e9" d="m${x - 2} 133 3-9 4 9-4 5Z"/>` : ""}`;
      const leg = (x: number) =>
        `<path fill="${p.limb}" d="M${x - 6} 148h12l8 13q-2 10-22 6l-7-5Z"/><path fill="none" opacity=".35" d="M${x - 7} 160h15"/>`;
      const body = `<ellipse fill="${p.body}" cx="100" cy="135" rx="28" ry="30"/>${dir === "up" ? `<path fill="none" stroke="${id === "voltling" ? "#ab793e" : "#384967"}" stroke-width="5" d="M82 129h36m-32 10h28"/>` : `<ellipse fill="${p.chest}" cx="100" cy="140" rx="18" ry="22"/>${id === "auralith" ? '<path fill="#fff9e6" d="m95 130 5-13 5 13-5 5Z"/>' : ""}`}`;
      const visibleEyes =
        dir === "up"
          ? ""
          : profile
            ? `<ellipse fill="#332c40" cx="${100 + side * 13}" cy="86" rx="7" ry="10"/><circle fill="white" stroke="none" cx="${100 + side * 12}" cy="82" r="3"/>`
            : eyes;
      const content: Record<Part, string> = {
        tail,
        flame,
        wings,
        legL: leg(78),
        legR: leg(122),
        body,
        armL: arm(65),
        armR: arm(135),
        head: dir === "up" ? backHead : profile ? profileHead : head,
        ears,
        eyes: visibleEyes,
        scarf,
      };
      // Author the rearward tail for a right-facing pose instead of flipping the entire asymmetric fighter.
      if (dir === "right" && part === "tail")
        content.tail =
          id === "voltling"
            ? '<path fill="#ffd855" d="m70 137-28-21 14-17-24-31-12 18 18 17-12 17 38 26Z"/>'
            : id === "emberwing"
              ? '<path d="M73 147q-43 17-32-33" stroke="#eea160" stroke-width="12" fill="none"/>'
              : id === "auralith"
                ? '<path fill="#679cc5" d="M73 138q-39-10-26 16 18 10 33-2Z"/>'
                : "";
      if (dir === "right" && part === "flame")
        content.flame =
          id === "emberwing"
            ? '<path fill="#ffd375" stroke="#ee985e" d="M42 121q15-8 3-30-3 13-10 6-14 19 7 24Z"/>'
            : "";
      const definition = definitions[part];
      const b =
        dir === "right" && (part === "tail" || part === "flame")
          ? [
              200 - definition.bounds[0] - definition.bounds[2],
              definition.bounds[1],
              ...definition.bounds.slice(2),
            ]
          : definition.bounds;
      const q =
        dir === "right" && (part === "tail" || part === "flame")
          ? [200 - definition.pivot[0], definition.pivot[1]]
          : definition.pivot;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.join(" ")}"><g stroke="#394152" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" fill="#394152">${content[part]}</g></svg>`;
      return {
        key: rigKey(id, dir, part),
        url: "data:image/svg+xml;base64," + btoa(svg),
        width: b[2],
        height: b[3],
        originX: (q[0] - b[0]) / b[2],
        originY: (q[1] - b[1]) / b[3],
        x: (q[0] - 100) * 0.5,
        y: (q[1] - 130) * 0.5,
      };
    }),
  );
}
