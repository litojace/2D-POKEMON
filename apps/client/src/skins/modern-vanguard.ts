import type { CharacterId } from "@arena/shared";
import { DESIGNS, torso, type Design, type Kit } from "./modern-designs";
import type { Tint } from "./fashion-art";

/**
 * Nova Vanguard: a corps of eighteen heroes in one shared language (a suit
 * with an armoured chest plate whose seams carry light, a corps star on the
 * belt) where every hero is dressed for its post, with the gear that goes
 * with it: a courier's antenna and satchel, a forger's hammer and sun core,
 * a sentinel's hex shield and brow crystals, a medic's drone...
 *
 * Every piece keeps its place on the body from every side: what is worn on
 * the forehead stays on the forehead in profile, out over the eye, and
 * never shows from behind; what hangs at a hip or rides a shoulder is on
 * the viewer's right from the front (the hero's left) and on the viewer's
 * left from behind. Profiles are drawn facing right and mirrored for the
 * left view, as the champions themselves are.
 */
const T = (hue: number, sat: number, lift = 0, mix = 0.85): Tint => ({ hue, mix, sat, lift: [0.02 + lift, -0.04 + lift, -0.06 + lift] });

/** Body colours: each hero vivid in the colour of its power. */
export const VANGUARD_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(60, 0.95), // Pulse Courier: charged gold
  cindrake: T(10, 0.8, 0.12), // Solar Forger: forge orange
  tidefin: T(200, 0.65), // Riptide Ranger: riptide aqua
  auralynx: T(230, 0.5, 0.06), // Prism Sentinel: prism periwinkle
  lumoth: T(44, 0.78), // Lumen Warden: lamplight ivory
  mystowl: T(268, 0.6, -0.02), // Night Cartographer: night violet
  terradon: T(95, 0.5, -0.02), // Bulwark Grove: moss green
  duskveil: T(300, 0.55), // Echo Beacon: signal magenta
  coilemur: T(180, 0.5, 0.06), // Flux Runner: flux cyan
  pyranda: T(5, 0.95), // Cinder Medic: ember red
  glacelle: T(210, 0.65, -0.25), // Frost Weaver: frost white-blue
  halcyra: T(214, 0.78, 0.02), // Gale Captain: open-sky blue
  sunbara: T(40, 0.95, 0.06), // Dawn Defender: dawn gold
  astrabun: T(205, 0.95), // Comet Strider: comet ice blue
  wombolder: T(25, 0.65, -0.06), // Quake Marshal: rust amber
  shadopus: T(172, 0.52, 0.02), // Deepwatch Oracle: deep-sea teal
  pangrove: T(155, 0.5, -0.06), // Briar Bastion: briar jade
  mossloth: T(206, 0.36, 0.1), // Cloud Keeper: sky pastel
};

const STAR = "#fff6c8";
const cx = (k: Kit) => k.C + k.side * 3;
/** Which way the profile faces: +1 right, -1 left (1 from the front and back). */
const dir = (k: Kit) => k.side || 1;
/** Drawn once for the right-facing profile, mirrored for the left one. */
const prof = (k: Kit, x: number, svg: string) => (k.side < 0 ? `<g transform="translate(${2 * x} 0) scale(-1 1)">${svg}</g>` : svg);
/** A four-point corps star. */
const nova = (k: Kit, x: number, y: number, r: number) =>
  k.path(`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`, STAR, k.ink, 0.5);

type Plate = "shield" | "hex" | "round" | "chevron" | "vee";
export interface Look {
  suit: string;
  plate: string;
  glow: string;
  shape: Plate;
}
/** The plate outline on the chest, front view, centred on c. */
function plateD(shape: Plate, c: number, t: number, b: number) {
  switch (shape) {
    case "shield":
      return `M${c - 14} ${t + 1}H${c + 14}V${t + 18}Q${c + 14} ${b - 9} ${c} ${b - 4}Q${c - 14} ${b - 9} ${c - 14} ${t + 18}Z`;
    case "hex":
      return `M${c - 9} ${t + 1}H${c + 9}L${c + 15} ${t + 15}L${c + 9} ${b - 6}H${c - 9}L${c - 15} ${t + 15}Z`;
    case "round":
      return `M${c - 13} ${t + 15}A13 13 0 1 1 ${c + 13} ${t + 15}A13 13 0 1 1 ${c - 13} ${t + 15}Z`;
    case "chevron":
      return `M${c - 15} ${t + 1}L${c} ${t + 9}L${c + 15} ${t + 1}V${t + 21}L${c} ${b - 4}L${c - 15} ${t + 21}Z`;
    case "vee":
      return `M${c - 15} ${t + 1}L${c} ${b - 5}L${c + 15} ${t + 1}L${c + 8} ${t + 1}L${c} ${t + 18}L${c - 8} ${t + 1}Z`;
  }
}
/**
 * The corps suit: a chest plate whose outline glows, the hero's own mark on
 * it, and a belt with the corps star; from behind a spine of light. In
 * profile the plate sits on the front of the chest.
 */
function armour(k: Kit, L: Look, mark: (x: number, y: number, s: number) => string, back = "", shell = false) {
  const g = L.glow;
  if (k.back) {
    // From behind: the suit fitted to the body with shoulder plates and a
    // spine of light. A hero that carries its shell or boulder on its back
    // shows only the belt, so the shell is never covered.
    if (shell) k.put("body", k.rect(k.L - 2, k.B - 9, k.R - k.L + 4, 5, 1, "#2a2f3d", "none") + k.lume("chase", k.line(`M${k.L + 4} ${k.B - 6.5}H${k.R - 4}`, g, 1.6), 0, g) + back);
    else k.put("body", torso(k, L.suit,
      k.path(`M${k.C - 15} ${k.T + 2}Q${k.C - 4} ${k.T + 6} ${k.C - 3} ${k.B - 6}L${k.C - 14} ${k.B - 10}Z M${k.C + 15} ${k.T + 2}Q${k.C + 4} ${k.T + 6} ${k.C + 3} ${k.B - 6}L${k.C + 14} ${k.B - 10}Z`, L.plate, k.ink, 0.8) +
        k.lume("chase", k.line(`M${k.C} ${k.T + 2}V${k.B - 4}`, g, 2.2), 0, g)) + back);
    return;
  }
  const c = cx(k);
  const belt = (x0: number, x1: number, bx: number) =>
    k.rect(x0, k.B - 9, x1 - x0, 5, 1, "#2a2f3d", "none") + k.lume("pulse", nova(k, bx, k.B - 6.5, 4.4), 9, STAR);
  if (k.side) {
    const d = dir(k);
    const outline = `M${c - d * 3} ${k.T + 1}Q${c + d * 13} ${k.T + 1} ${c + d * 15} ${k.T + 17}Q${c + d * 14} ${k.B - 8} ${c + d * 3} ${k.B - 5}Q${c - d * 3} ${k.B - 12} ${c - d * 3} ${k.T + 1}Z`;
    k.put("body", torso(k, L.suit, k.path(outline, L.plate, k.ink, 0.9) + k.lume("pulse", k.path(outline, "none", g, 1.5), 1, g) + mark(c + d * 7, k.T + 15, 0.75) + belt(k.L - 2, k.R + 2, c + d * 9)));
    return;
  }
  const outline = plateD(L.shape, c, k.T, k.B);
  k.put("body", torso(k, L.suit, k.path(outline, L.plate, k.ink, 0.9) + k.lume("pulse", k.path(outline, "none", g, 1.6), 1, g) + mark(c, k.T + 15, 1) + belt(k.L - 2, k.R + 2, c)));
}
/** A glowing disc mark: a ring and a core. */
const core = (k: Kit, x: number, y: number, s: number, ring: string, g: string, i = 2) =>
  k.circle(x, y, 7 * s, ring, k.ink, 0.7) + k.lume("pulse", k.circle(x, y, 4.6 * s, g, "none", 0), i, g);

/** Each hero's suit, chest plate and glow colours, and plate shape. */
export const VANGUARD_LOOK: Record<CharacterId, Look> = {
  voltkit: { suit: "#1f4a5a", plate: "#e9f2f0", glow: "#7ff6e6", shape: "chevron" },
  cindrake: { suit: "#2a2f3a", plate: "#5a6070", glow: "#ffcf5a", shape: "round" },
  tidefin: { suit: "#173a6a", plate: "#dff6ff", glow: "#5ff0ff", shape: "shield" },
  auralynx: { suit: "#2c2f6a", plate: "#f2efe4", glow: "#a8f4ff", shape: "hex" },
  lumoth: { suit: "#1f3a3a", plate: "#f4ecd0", glow: "#fff1a0", shape: "vee" },
  mystowl: { suit: "#1e2350", plate: "#d9dff0", glow: "#bfe0ff", shape: "shield" },
  terradon: { suit: "#2f3d2a", plate: "#9a9a8a", glow: "#9fff8a", shape: "hex" },
  duskveil: { suit: "#1c1a33", plate: "#c9c3e8", glow: "#8ff5e6", shape: "vee" },
  coilemur: { suit: "#1d1f2a", plate: "#e8eef2", glow: "#7ff3ff", shape: "chevron" },
  pyranda: { suit: "#2a6a6a", plate: "#f4f8f8", glow: "#7dffb0", shape: "shield" },
  glacelle: { suit: "#2a4a7a", plate: "#e8f6ff", glow: "#d8f6ff", shape: "hex" },
  halcyra: { suit: "#20305a", plate: "#eef0f6", glow: "#9fe8ff", shape: "shield" },
  sunbara: { suit: "#6a2f1a", plate: "#ffe9c0", glow: "#ffd84a", shape: "round" },
  astrabun: { suit: "#24305e", plate: "#e8f0ff", glow: "#ffe9a8", shape: "shield" },
  wombolder: { suit: "#3a3a46", plate: "#b8a890", glow: "#ffb35a", shape: "hex" },
  shadopus: { suit: "#13324a", plate: "#cfe8e4", glow: "#9fffe8", shape: "round" },
  pangrove: { suit: "#1f3a2a", plate: "#8aa86a", glow: "#c6ff8a", shape: "shield" },
  mossloth: { suit: "#5a7a9a", plate: "#f4f8ff", glow: "#9fd8ff", shape: "round" },
};

export const VANGUARD_DESIGNS_NEW: Record<CharacterId, Design> = {
  // Pulse Courier: a chevron plate, a satchel on its left hip with a
  // heartbeat line across the flap, and a headset antenna that blinks.
  voltkit(k) {
    const L = VANGUARD_LOOK.voltkit;
    armour(k, L, (x, y, s) => k.lume("chase", k.path(`M${x - 7 * s} ${y - 3 * s}L${x} ${y + 2 * s}L${x + 7 * s} ${y - 3 * s}M${x - 7 * s} ${y + 3 * s}L${x} ${y + 8 * s}L${x + 7 * s} ${y + 3 * s}`, "none", L.glow, 2.2 * s), 2, L.glow));
    const sx = k.back ? k.L - 6 : k.side ? k.C - k.side * 8 : k.R + 6,
      sy = k.side ? k.B + 4 : k.B - 4;
    const fl = k.back ? -1 : k.side ? -k.side : 1;
    k.put(k.side ? "flame" : "body", k.rect(sx - 10, sy - 9, 20, 16, 3, "#2a5664", k.ink, 1) + k.rect(sx - 10, sy - 9, 20, 6, 3, "#356a7a", k.ink, 0.8) +
      k.lume("pulse", k.line(`M${sx - 7 * fl} ${sy + 2}h${3 * fl}l${2 * fl} -4l${2 * fl} 7l${2 * fl} -3h${4 * fl}`, L.glow, 1.4), 3, L.glow));
    // The headset: a band over the head and an antenna over its left ear.
    const ay = k.ht + 36;
    const ax = k.side ? k.hx - k.side * 26 : k.hx + (k.back ? -44 : 44);
    const tip = k.back ? -7 : k.side ? -k.side * 7 : 7;
    k.put("flame", (k.side ? k.line(`M${ax} ${ay}Q${ax - k.side * 2} ${k.ht - 4} ${k.hx + k.side * 6} ${k.ht - 2}`, "#2a5664", 3.2) : k.line(`M${k.hx - 44} ${ay}Q${k.hx} ${k.ht - 6} ${k.hx + 44} ${ay}`, "#2a5664", 3.2)) +
      k.line(`M${ax} ${ay}L${ax + tip} ${ay - 34}`, "#d9dde6", 1.8) + k.circle(ax, ay, 4.4, "#2a5664", k.ink, 0.8) +
      k.lume("blink", k.circle(ax + tip, ay - 35, 3, "#ff5a6a", k.ink, 0.5), 0, "#ff5a6a"));
  },
  // Solar Forger: a round plate with a sun core whose rays light in turn,
  // and a forge hammer slung across the back, its head white-hot over the
  // right shoulder. Its own flame crest stays.
  cindrake(k) {
    const L = VANGUARD_LOOK.cindrake;
    armour(k, L, (x, y, s) => core(k, x, y, s, "#3a2a1c", L.glow) +
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return k.lume("chase", k.line(`M${x + Math.cos(a) * 8.5 * s} ${y + Math.sin(a) * 8.5 * s}L${x + Math.cos(a) * 11.5 * s} ${y + Math.sin(a) * 11.5 * s}`, L.glow, 1.6 * s), i + 3, L.glow);
      }).join(""));
    const hammer = (x: number, y: number, rot: number) => `<g transform="rotate(${rot} ${x} ${y}) translate(${x} ${y}) scale(1.3) translate(${-x} ${-y})">` +
      k.rect(x - 1.8, y - 4, 3.6, 34, 1.5, "#5a3a22") +
      k.lume("pulse", k.rect(x - 11, y - 12, 22, 12, 2.5, "#ff8a3a", k.ink, 1) + k.rect(x - 8, y - 9, 16, 6, 1.5, "#ffe08a", "none"), 0, "#ffb347") + "</g>";
    if (k.back) k.put("scarf", hammer(k.C + 30, k.T - 4, 36));
    else k.put("body", k.side ? hammer(k.C - k.side * 30, k.T - 4, -k.side * 36) : hammer(k.C - 44, k.T - 4, -36), true);
  },
  // Riptide Ranger: a shield plate with a wave that runs along it, a brow
  // visor band, and hydro-jets on the back whose nozzles ring with water.
  tidefin(k) {
    const L = VANGUARD_LOOK.tidefin;
    armour(k, L, (x, y, s) => k.lume("chase", k.path(`M${x - 9 * s} ${y + 2 * s}q${3 * s} ${-6 * s} ${6 * s} 0t${6 * s} 0t${6 * s} 0`, "none", "#1f6fb0", 2.4 * s), 2, L.glow) + core(k, x, y + 8 * s, 0.5 * s, "#173a6a", L.glow, 3));
    // Hydro-jets: two nozzles behind the shoulders, each with a glowing ring.
    const jet = (x: number, y: number, i: number) => k.rect(x - 5, y - 12, 10, 18, 3, "#2a4a7a", k.ink, 0.9) + k.lume("pulse", `<ellipse cx="${x}" cy="${y + 7}" rx="5.5" ry="2.6" fill="${L.glow}" stroke="#ffffff" stroke-width="0.8"/>`, 4 + i, L.glow);
    if (k.back) k.put("scarf", jet(k.C - 13, k.T + 6, 0) + jet(k.C + 13, k.T + 6, 1));
    else if (k.side) k.put("body", jet(k.C - k.side * 16, k.T + 2, 0), true);
    else k.put("body", jet(k.C - 30, k.T - 2, 0) + jet(k.C + 30, k.T - 2, 1), true);
    // A visor band across the forehead, clear of the eyes; from behind the band only.
    const y = k.ht + 14;
    if (k.back) k.put("flame", k.line(`M${k.hx - 34} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 34} ${y + 6}`, "#2a4a7a", 4));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 26} ${y + 8}Q${k.hx + 4} ${y - 2} ${k.hx + 30} ${y + 4}`, "#2a4a7a", 4.4) + k.lume("pulse", k.line(`M${k.hx + 14} ${y + 1}L${k.hx + 30} ${y + 3}`, L.glow, 2.2), 0, L.glow)));
    else k.put("flame", k.line(`M${k.hx - 36} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 36} ${y + 6}`, "#2a4a7a", 4.4) + k.lume("pulse", k.line(`M${k.hx - 18} ${y + 1.5}Q${k.hx} ${y - 3} ${k.hx + 18} ${y + 1.5}`, L.glow, 2.2), 0, L.glow));
  },
  // Prism Sentinel: a hex plate with a prism, a hex shield at its right
  // side lit cell by cell, and three crystal shards rising from a brow gem.
  auralynx(k) {
    const L = VANGUARD_LOOK.auralynx;
    armour(k, L, (x, y, s) => k.lume("pulse", k.path(`M${x} ${y - 8 * s}L${x + 6 * s} ${y}L${x} ${y + 8 * s}L${x - 6 * s} ${y}Z`, L.glow, k.ink, 0.6), 2, L.glow));
    const hexD = (x: number, y: number, r: number) => "M" + Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return `${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
    }).join("L") + "Z";
    const shield = (x: number, y: number, z = 1) => `<path d="${hexD(x, y, 20 * z)}" fill="${L.glow}33" stroke="${L.glow}" stroke-width="1.6"/>` +
      [[0, 0], [-7, -6], [7, -6], [-7, 6], [7, 6]].map(([dx, dy], i) => k.lume("chase", `<path d="${hexD(x + dx * z, y + dy * z, 4.6 * z)}" fill="${L.glow}66" stroke="${L.glow}" stroke-width="0.8"/>`, 3 + i, L.glow)).join("");
    // The shield at its right side: viewer's left from the front, right from behind.
    k.put("body", k.back ? shield(k.C + 42, k.B - 12) : k.side ? shield(k.C - k.side * 22, k.B - 6, 0.75) : shield(k.C - 42, k.B - 12));
    // The brow gem and its shards: forehead only, out over the eye in profile.
    if (!k.back) {
      const base = k.ht + 9;
      const gem = (x: number, y: number) => k.path(`M${x - 6} ${y}L${x - 3} ${y - 4}H${x + 3}L${x + 6} ${y}L${x + 3} ${y + 4}H${x - 3}Z`, L.glow, k.ink, 0.6);
      const shard = (x: number, tall: number, i: number, lean: number) => k.lume("twinkle", k.path(`M${x - 3.2} ${base}L${x + lean} ${base - tall}L${x + 3.2} ${base}L${x} ${base + 3}Z`, L.glow, k.ink, 0.6), i, L.glow);
      k.put("flame", k.side
        ? prof(k, k.hx, k.line(`M${k.hx - 22} ${base + 10}Q${k.hx} ${base + 3} ${k.hx + 28} ${base + 7}`, "#f2efe4", 3.6) + gem(k.hx + 21, base + 6) + shard(k.hx + 14, 11, 0, 2) + shard(k.hx + 22, 15, 1, 2) + shard(k.hx + 29, 10, 2, 2))
        : k.line(`M${k.hx - 25} ${base + 8}L${k.hx - 8} ${base + 3}M${k.hx + 8} ${base + 3}L${k.hx + 25} ${base + 8}`, "#f2efe4", 3.6) + gem(k.hx, base + 6) + shard(k.hx - 9, 11, 0, 0) + shard(k.hx, 16, 1, 0) + shard(k.hx + 9, 11, 2, 0));
    } else k.put("flame", k.line(`M${k.hx - 25} ${k.ht + 17}Q${k.hx} ${k.ht + 10} ${k.hx + 25} ${k.ht + 17}`, "#f2efe4", 3.6));
  },
  // Lumen Warden: a vee plate around a lantern core, and a warden's lamp
  // on a staff over its left shoulder. Its antennae stay.
  lumoth(k) {
    const L = VANGUARD_LOOK.lumoth;
    armour(k, L, (x, y, s) => k.rect(x - 5 * s, y - 6 * s, 10 * s, 13 * s, 2.5 * s, "#3a3a2a", k.ink, 0.6) + k.lume("pulse", k.rect(x - 3.4 * s, y - 4 * s, 6.8 * s, 9 * s, 2 * s, L.glow, "none"), 2, L.glow));
    // The staff lamp, held up behind its left shoulder.
    const lamp = (x: number, y: number) => k.line(`M${x} ${y + 6}V${y + 66}`, "#7a6a4a", 2.2) + k.path(`M${x - 6} ${y - 6}H${x + 6}L${x + 7} ${y + 6}H${x - 7}Z`, "#3a3a2a") +
      k.lume("pulse", k.rect(x - 4.6, y - 4, 9.2, 9, 2, L.glow, "none"), 3, L.glow) + k.path(`M${x - 4} ${y - 6}L${x} ${y - 12}L${x + 4} ${y - 6}Z`, "#3a3a2a");
    // Over the wing at its left: viewer's right from the front, left from
    // behind; behind the shoulder in profile.
    // Held out clear of the head, so the lamp never covers an eye.
    if (k.back) k.put("flame", lamp(k.C - 66, k.T - 24));
    else if (k.side) k.put("flame", lamp(k.C - k.side * 58, k.T - 28));
    else k.put("flame", lamp(k.C + 66, k.T - 24));
  },
  // Night Cartographer: a shield plate with a star compass, and a holo star
  // map floating at its right hip whose stars twinkle.
  mystowl(k) {
    const L = VANGUARD_LOOK.mystowl;
    armour(k, L, (x, y, s) => k.circle(x, y, 7 * s, "#1e2350", k.ink, 0.6) + k.lume("pulse", k.path(`M${x} ${y - 6 * s}L${x + 1.6 * s} ${y}L${x} ${y + 6 * s}L${x - 1.6 * s} ${y}Z M${x - 6 * s} ${y}L${x} ${y - 1.6 * s}L${x + 6 * s} ${y}L${x} ${y + 1.6 * s}Z`, L.glow, "none"), 2, L.glow));
    // The map at its right hip: viewer's left from the front, right from
    // behind, at the back of the hip in profile.
    const map = (x: number, y: number) => {
      const pts = [[-8, -6], [-2, -9], [4, -4], [9, -8], [6, 3], [-4, 4]];
      return `<rect x="${x - 13}" y="${y - 13}" width="26" height="22" rx="3" fill="${L.glow}22" stroke="${L.glow}" stroke-width="1.2"/>` +
        k.line("M" + pts.map(([u, v]) => `${x + u} ${y + v}`).join("L"), `${L.glow}`, 0.8) +
        pts.map(([u, v], i) => k.lume("twinkle", k.circle(x + u, y + v, 1.5, "#ffffff", "none", 0), 3 + i, "#ffffff")).join("") +
        k.line(`M${x - 4} ${y + 9}L${x} ${y + 15}L${x + 4} ${y + 9}`, L.glow, 1);
    };
    k.put(k.side || k.back ? "flame" : "body", k.back ? map(k.C + 34, k.B - 18) : k.side ? map(k.C - k.side * 14, k.B - 4) : map(k.C - 36, k.B - 18));
  },
  // Bulwark Grove: a hex plate of stone with a rune that glows, moss on the
  // shoulders, a tower shield at its left side, and a stone circlet with a
  // leaf rune on the brow.
  terradon(k) {
    const L = VANGUARD_LOOK.terradon;
    armour(k, L, (x, y, s) => k.lume("pulse", k.path(`M${x} ${y - 8 * s}Q${x + 8 * s} ${y} ${x} ${y + 8 * s}Q${x - 8 * s} ${y} ${x} ${y - 8 * s}Z`, L.glow, k.ink, 0.6) + k.line(`M${x} ${y - 6 * s}V${y + 6 * s}`, "#2f5a2a", 0.9), 2, L.glow),
      "", true);
    const moss = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="5" fill="#5a8a3a" stroke="${k.ink}" stroke-width="0.8"/>` + k.circle(x - 4, y - 2, 1.4, "#ffd2e8", "none", 0) + k.circle(x + 3, y - 3, 1.2, "#ffffff", "none", 0);
    if (!k.back) k.put("flame", k.side ? moss(k.C - k.side * 2, k.T + 3) : moss(k.L + 6, k.T + 3) + moss(k.R - 6, k.T + 3));
    // The tower shield at its left side: viewer's right in front, left from behind.
    const tower = (x: number, y: number, w: number) => k.path(`M${x - w} ${y - 22}H${x + w}V${y + 10}Q${x} ${y + 24} ${x - w} ${y + 10}Z`, "#7a7a6a", k.ink, 1) +
      k.lume("pulse", k.path(`M${x} ${y - 14}Q${x + 7} ${y - 4} ${x} ${y + 8}Q${x - 7} ${y - 4} ${x} ${y - 14}Z`, L.glow, "none"), 3, L.glow) + k.line(`M${x - w + 3} ${y - 19}H${x + w - 3}`, "#5a8a3a", 2.4);
    k.put("body", k.back ? tower(k.C - 44, k.B - 14, 13) : k.side ? tower(k.C + k.side * 4, k.B - 10, 7) : tower(k.C + 44, k.B - 14, 13), !!k.back);
    // The circlet: a stone band with a leaf rune on the forehead (not from behind).
    const y = k.ht + 12;
    if (k.back) k.put("flame", k.line(`M${k.hx - 36} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 36} ${y + 6}`, "#7a7a6a", 4));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 28} ${y + 8}Q${k.hx} ${y - 2} ${k.hx + 28} ${y + 4}`, "#7a7a6a", 4.4) + k.lume("pulse", k.path(`M${k.hx + 22} ${y - 4}Q${k.hx + 27} ${y + 2} ${k.hx + 22} ${y + 8}Q${k.hx + 17} ${y + 2} ${k.hx + 22} ${y - 4}Z`, L.glow, k.ink, 0.5), 0, L.glow)));
    else k.put("flame", k.line(`M${k.hx - 38} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 38} ${y + 6}`, "#7a7a6a", 4.4) + k.lume("pulse", k.path(`M${k.hx} ${y - 8}Q${k.hx + 6} ${y - 1} ${k.hx} ${y + 6}Q${k.hx - 6} ${y - 1} ${k.hx} ${y - 8}Z`, L.glow, k.ink, 0.5), 0, L.glow));
  },
  // Echo Beacon: a cloak plate with a beacon light, and signal rings that
  // ripple out round the tip of its hood.
  duskveil(k) {
    const L = VANGUARD_LOOK.duskveil;
    armour(k, L, (x, y, s) => core(k, x, y + 2 * s, 0.8 * s, "#1c1a33", L.glow));
    // The rings round the hood's tip, the same from every side.
    const x = k.hx + (k.side ? k.side * 2 : 0),
      y = k.ht + 8;
    k.put("flame", [0, 1, 2].map((i) => k.lume("chase", `<ellipse cx="${x}" cy="${y + i * 7}" rx="${9 + i * 7}" ry="${3 + i * 1.6}" fill="none" stroke="${L.glow}" stroke-width="${2 - i * 0.4}" stroke-dasharray="${5 + i * 2} 3"/>`, i, L.glow)).join("") +
      k.lume("blink", k.circle(x, y - 6, 2.6, "#ffffff", k.ink, 0.5), 0, "#ffffff"));
  },
  // Flux Runner: a speed suit with glowing stripes that run down the chest,
  // magnetic boots that ring with light, and a sleek visor band.
  coilemur(k) {
    const L = VANGUARD_LOOK.coilemur;
    armour(k, L, (x, y, s) => [0, 1, 2].map((i) => k.lume("chase", k.line(`M${x - 8 * s + i * 4 * s} ${y - 6 * s}l${6 * s} ${12 * s}`, L.glow, 2 * s), 2 + i, L.glow)).join(""));
    // Mag boots: a ring of light round each foot.
    const feet = k.side ? [k.C - k.side * 4] : [k.C - 14, k.C + 14];
    k.put("body", feet.map((fx, i) => k.lume("pulse", `<ellipse cx="${fx}" cy="${k.B + 16}" rx="9" ry="3" fill="none" stroke="${L.glow}" stroke-width="2"/>`, 5 + i, L.glow)).join(""));
    const y = k.ht + 14;
    if (k.back) k.put("flame", k.line(`M${k.hx - 32} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 32} ${y + 6}`, "#2a2f3d", 4));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 24} ${y + 8}Q${k.hx} ${y - 1} ${k.hx + 28} ${y + 4}`, "#2a2f3d", 4.6) + k.lume("chase", k.line(`M${k.hx + 8} ${y + 2}L${k.hx + 28} ${y + 4}`, L.glow, 2), 0, L.glow)));
    else k.put("flame", k.line(`M${k.hx - 34} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 34} ${y + 6}`, "#2a2f3d", 4.6) + k.lume("chase", k.line(`M${k.hx - 20} ${y + 2}Q${k.hx} ${y - 3} ${k.hx + 20} ${y + 2}`, L.glow, 2), 0, L.glow));
  },
  // Cinder Medic: a white shield plate with a glowing cross, and a med-drone
  // hovering at its left shoulder with a blinking light.
  pyranda(k) {
    const L = VANGUARD_LOOK.pyranda;
    const plus = (x: number, y: number, r: number) => k.path(`M${x - r * 0.35} ${y - r}H${x + r * 0.35}V${y - r * 0.35}H${x + r}V${y + r * 0.35}H${x + r * 0.35}V${y + r}H${x - r * 0.35}V${y + r * 0.35}H${x - r}V${y - r * 0.35}H${x - r * 0.35}Z`, L.glow, k.ink, 0.5);
    armour(k, L, (x, y, s) => k.lume("pulse", plus(x, y, 6.5 * s), 2, L.glow), k.lume("pulse", plus(k.C, k.T + 16, 6), 2, L.glow));
    // A medic's headband: the cross on the forehead, out over the eye in
    // profile; from behind the band only.
    const by = k.ht + 16;
    if (k.back) k.put("flame", k.line(`M${k.hx - 36} ${by + 6}Q${k.hx} ${by - 4} ${k.hx + 36} ${by + 6}`, "#f4f8f8", 4));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 26} ${by + 8}Q${k.hx} ${by - 2} ${k.hx + 30} ${by + 4}`, "#f4f8f8", 4.4) + k.lume("pulse", plus(k.hx + 22, by + 1, 4), 4, L.glow)));
    else k.put("flame", k.line(`M${k.hx - 38} ${by + 6}Q${k.hx} ${by - 4} ${k.hx + 38} ${by + 6}`, "#f4f8f8", 4.4) + k.lume("pulse", plus(k.hx, by - 1, 4.4), 4, L.glow));
    const dx = k.back ? k.C - 52 : k.side ? k.hx - k.side * 40 : k.hx + 62,
      dy = k.ht + 2;
    k.put(k.back ? "scarf" : "flame", k.line(`M${dx - 14} ${dy - 6}H${dx + 14}`, "#5a6a7a", 1.8) +
      `<ellipse cx="${dx - 14}" cy="${dy - 7}" rx="6" ry="1.5" fill="#c9d4e0aa"/><ellipse cx="${dx + 14}" cy="${dy - 7}" rx="6" ry="1.5" fill="#c9d4e0aa"/>` +
      `<ellipse cx="${dx}" cy="${dy}" rx="10" ry="8" fill="#f4f6f8" stroke="${k.ink}" stroke-width="1"/>` +
      k.lume("pulse", plus(dx, dy, 3.6), 3, L.glow) + k.lume("blink", k.circle(dx, dy + 8, 1.8, "#ff5a6a", "none", 0), 0, "#ff5a6a"));
  },
  // Frost Weaver: a crystalline mantle over the shoulders whose points
  // glint, and a snowflake core on the plate. Its own crest stays.
  glacelle(k) {
    const L = VANGUARD_LOOK.glacelle;
    armour(k, L, (x, y, s) => k.lume("pulse", [0, 60, 120].map((a) => {
      const c = Math.cos((a * Math.PI) / 180) * 7 * s,
        sn = Math.sin((a * Math.PI) / 180) * 7 * s;
      return k.line(`M${x - c} ${y - sn}L${x + c} ${y + sn}`, "#7fd8ff", 2 * s);
    }).join(""), 2, "#bff0ff"));
    // The mantle: ice points round the collar.
    const pts = k.back ? [-22, -11, 0, 11, 22] : k.side ? [-12, -2, 8] : [-22, -11, 0, 11, 22];
    const x0 = k.side ? k.C - k.side * 2 : k.C;
    k.put("flame", pts.map((u, i) => {
      const x = x0 + (k.side ? k.side * u : u);
      return k.lume("twinkle", k.path(`M${x - 5.5} ${k.T}L${x} ${k.T + 15 - Math.abs(u) * 0.25}L${x + 5.5} ${k.T}Z`, "#8fd8ff", k.ink, 0.8), 3 + i, "#dff6ff");
    }).join("") + (k.back ? "" : k.path(`M${x0 - 26} ${k.T}Q${x0} ${k.T + 6} ${x0 + 26} ${k.T}`, "none", "#dff6ff", 1.6)));
  },
  // Gale Captain: an officer's suit with gold shoulder boards, a captain's
  // wing on the plate, and a wind-vane rotor on a mast over its left
  // shoulder whose blades glow. Its own crest stays.
  halcyra(k) {
    const L = VANGUARD_LOOK.halcyra;
    armour(k, L, (x, y, s) => k.lume("pulse", k.path(`M${x - 9 * s} ${y + 3 * s}Q${x - 2 * s} ${y - 9 * s} ${x + 9 * s} ${y - 4 * s}Q${x + 2 * s} ${y - 1 * s} ${x + 5 * s} ${y + 2 * s}Q${x} ${y + 1 * s} ${x - 9 * s} ${y + 3 * s}Z`, L.glow, k.ink, 0.6), 2, L.glow));
    if (!k.back) k.put("flame", (k.side ? [k.C - k.side * 2] : [k.L + 5, k.R - 5]).map((x) => k.rect(x - 7, k.T, 14, 5, 1.5, "#f2c14e", "#a8823a", 0.7)).join(""));
    // The rotor of the vane pack, behind the shoulders.
    const rotor = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="13" fill="#2a3a6a" stroke="${k.ink}" stroke-width="1"/>` +
      [0, 120, 240].map((a, i) => k.lume("chase", `<path d="M${x} ${y}L${x + Math.cos((a * Math.PI) / 180) * 11} ${y + Math.sin((a * Math.PI) / 180) * 11}" stroke="${L.glow}" stroke-width="3" stroke-linecap="round"/>`, 3 + i, L.glow)).join("") + k.circle(x, y, 3, "#f2c14e", "none", 0);
    // Over its left shoulder: viewer's right from the front, left from behind.
    const mast = (x: number, y: number) => k.line(`M${x} ${y + 12}V${y + 30}`, "#5a6a8a", 2.4) + rotor(x, y);
    if (k.back) k.put("flame", mast(k.C - 40, k.T - 14));
    else if (k.side) k.put("flame", mast(k.C - k.side * 46, k.T - 16));
    else k.put("flame", mast(k.C + 56, k.T - 14));
  },
  // Dawn Defender: a crown of sun rays worn round the head, lit ray by ray,
  // and a sunrise on the plate. Being a band round the head it reads the
  // same from every side: rays fan from the brow to the nape in profile,
  // and the sun gem on its front only shows from the front and the face side.
  sunbara(k) {
    const L = VANGUARD_LOOK.sunbara;
    armour(k, L, (x, y, s) => k.path(`M${x - 8 * s} ${y + 4 * s}A8 8 0 0 1 ${x + 8 * s} ${y + 4 * s}Z`, L.glow, k.ink, 0.6) + k.lume("chase", [-1, 0, 1].map((u) => k.line(`M${x + u * 6 * s} ${y - 6 * s}L${x + u * 9 * s} ${y - 10 * s}`, L.glow, 1.6 * s)).join(""), 2, L.glow));
    const cx = k.hx + (k.side ? -k.side * 2 : 0),
      cy = k.ht + 30,
      rx = k.side ? 42 : 46,
      ry = 22;
    const at = (deg: number, out = 0) => {
      const a = (deg * Math.PI) / 180;
      return [cx + Math.cos(a) * (rx + out), cy + Math.sin(a) * (ry + out)];
    };
    const [x0, y0] = at(200),
      [x1, y1] = at(340);
    const band = k.line(`M${x0} ${y0}A${rx} ${ry} 0 0 1 ${x1} ${y1}`, "#b8862a", 5) + k.line(`M${x0} ${y0}A${rx} ${ry} 0 0 1 ${x1} ${y1}`, "#ffcf5a", 2.6);
    const rays = [210, 230, 250, 270, 290, 310, 330].map((deg, i) => {
      const [bx, by] = at(deg, 1),
        [tx, ty] = at(deg, deg === 270 ? 20 : 15);
      return k.lume("chase", k.path(`M${bx - 3} ${by}L${tx} ${ty}L${bx + 3} ${by}Z`, L.glow, "#b8862a", 0.6), i, L.glow);
    }).join("");
    // The sun gem sits on the front of the band.
    const gemDeg = k.side ? (k.side > 0 ? 330 : 210) : 270;
    const [gx, gy] = at(gemDeg);
    const gem = k.back ? "" : k.lume("pulse", k.circle(gx, gy + 2, 4.6, "#ff9a3a", "#b8862a", 1) + k.circle(gx, gy + 2, 2, "#fff3b0", "none", 0), 8, L.glow);
    k.put("flame", rays + band + gem);
  },
  // Comet Strider: a shield plate with comet streaks lit in a run, a comet
  // clip on its left on the brow band (clear of its star eyes), and jet heels.
  astrabun(k) {
    const L = VANGUARD_LOOK.astrabun;
    armour(k, L, (x, y, s) => [0, 1, 2].map((i) => k.lume("chase", k.line(`M${x + (6 - i * 6) * s} ${y - 8 * s}l${-5 * s} ${14 * s}`, i === 1 ? L.glow : "#9fd8ff", 2 * s), 2 + i, L.glow)).join(""));
    if (!k.back) {
      const hx = k.side ? k.hx - k.side * 8 : k.hx + 30,
        hy = k.ht + 28,
        tail = k.side ? -k.side : 1;
      k.put("flame", k.lume("pulse", k.path(`M${hx} ${hy - 4}Q${hx + tail * 14} ${hy - 12} ${hx + tail * 24} ${hy - 18}Q${hx + tail * 12} ${hy - 4} ${hx} ${hy + 4}Z`, "#9fd8ff", "none"), 0, L.glow) +
        k.lume("twinkle", k.path(k.star(hx, hy, 6, 5), L.glow, k.ink, 0.6), 1, L.glow));
    }
    const feet = k.side ? [k.C - k.side * 4] : [k.C - 14, k.C + 14];
    k.put("body", feet.map((x, i) => k.lume("pulse", k.path(`M${x - 5} ${k.B + 14}Q${x} ${k.B + 30} ${x + 5} ${k.B + 14}Z`, "#9fd8ff", "none") + k.path(`M${x - 2.5} ${k.B + 14}Q${x} ${k.B + 23} ${x + 2.5} ${k.B + 14}Z`, "#ffffff", "none"), 5 + i, "#9fd8ff")).join(""), true);
  },
  // Quake Marshal: heavy plate with a seismic gauge whose cracks glow, big
  // pauldrons, and a marshal's peaked cap with a star badge. Its boulder is
  // never covered.
  wombolder(k) {
    const L = VANGUARD_LOOK.wombolder;
    armour(k, L, (x, y, s) => k.path(`M${x - 9 * s} ${y + 4 * s}A9 9 0 0 1 ${x + 9 * s} ${y + 4 * s}Z`, "#2a2a32", k.ink, 0.6) +
      k.lume("pulse", k.line(`M${x} ${y + 4 * s}L${x + 5 * s} ${y - 3 * s}`, L.glow, 1.6 * s), 2, L.glow) +
      k.lume("chase", k.line(`M${x - 10 * s} ${y + 10 * s}l${4 * s} ${-3 * s}l${3 * s} ${4 * s}l${4 * s} ${-4 * s}l${3 * s} ${3 * s}l${5 * s} ${-2 * s}`, L.glow, 1.4 * s), 3, L.glow),
      "", true);
    const pauldron = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="6.5" fill="#5a5a66" stroke="${k.ink}" stroke-width="1"/>` + k.line(`M${x - 8} ${y + 1}Q${x} ${y - 4} ${x + 8} ${y + 1}`, L.glow, 1.2);
    if (!k.back) k.put("flame", k.side ? pauldron(k.C - k.side * 2, k.T + 3) : pauldron(k.L + 5, k.T + 3) + pauldron(k.R - 5, k.T + 3));
    // The marshal's cap: a crown as deep as the head with a peak at the
    // front and a glowing star badge; in profile the peak points forward.
    const y = k.ht + 16;
    const cap = "#3a3a46";
    if (k.back) k.put("flame", k.path(`M${k.hx - 36} ${y + 2}Q${k.hx - 38} ${y - 26} ${k.hx} ${y - 28}Q${k.hx + 38} ${y - 26} ${k.hx + 36} ${y + 2}Q${k.hx} ${y - 4} ${k.hx - 36} ${y + 2}Z`, cap) + k.line(`M${k.hx - 35} ${y - 1}Q${k.hx} ${y - 7} ${k.hx + 35} ${y - 1}`, L.glow, 1.4));
    else if (k.side) k.put("flame", prof(k, k.hx, k.path(`M${k.hx - 30} ${y + 2}Q${k.hx - 32} ${y - 26} ${k.hx - 2} ${y - 28}Q${k.hx + 26} ${y - 26} ${k.hx + 28} ${y}Z`, cap) +
      k.path(`M${k.hx + 18} ${y - 1}Q${k.hx + 36} ${y - 2} ${k.hx + 44} ${y + 5}Q${k.hx + 30} ${y + 6} ${k.hx + 18} ${y + 3}Z`, "#2a2a32") + k.line(`M${k.hx - 29} ${y - 2}Q${k.hx} ${y - 8} ${k.hx + 27} ${y - 3}`, L.glow, 1.4) +
      k.lume("pulse", nova(k, k.hx + 18, y - 14, 5), 6, L.glow)));
    else k.put("flame", k.path(`M${k.hx - 36} ${y + 2}Q${k.hx - 38} ${y - 26} ${k.hx} ${y - 28}Q${k.hx + 38} ${y - 26} ${k.hx + 36} ${y + 2}Z`, cap) +
      k.path(`M${k.hx - 38} ${y + 1}Q${k.hx} ${y + 12} ${k.hx + 38} ${y + 1}Q${k.hx} ${y + 5} ${k.hx - 38} ${y + 1}Z`, "#2a2a32") + k.line(`M${k.hx - 35} ${y - 2}Q${k.hx} ${y - 8} ${k.hx + 35} ${y - 2}`, L.glow, 1.4) +
      k.lume("pulse", nova(k, k.hx, y - 14, 6), 6, L.glow));
  },
  // Deepwatch Oracle: a diving collar with glowing portholes, a round plate,
  // and sonar rings rippling out over its dome.
  shadopus(k) {
    const L = VANGUARD_LOOK.shadopus;
    armour(k, L, (x, y, s) => core(k, x, y, s, "#13324a", L.glow));
    // The collar: a ring at the neck with portholes.
    const ports = k.back ? [-14, 0, 14] : k.side ? [-6, 6] : [-16, -6, 6, 16];
    const x0 = k.side ? k.C + k.side * 2 : k.C;
    k.put("body", k.rect(k.L - 1, k.T - 4, k.R - k.L + 2, 7, 3.5, "#b8862a", k.ink, 0.9) + ports.map((u, i) => k.lume("chase", k.circle(x0 + u, k.T - 0.5, 2.2, L.glow, k.ink, 0.5), 3 + i, L.glow)).join(""));
    const x = k.hx + k.side * 2,
      y = k.ht + 30;
    k.put("flame", [0, 1, 2].map((i) => k.lume("chase", `<path d="M${x - 26 - i * 9} ${y - 6 - i * 4}Q${x} ${y - 30 - i * 9} ${x + 26 + i * 9} ${y - 6 - i * 4}" fill="none" stroke="${L.glow}" stroke-width="${2.4 - i * 0.4}" stroke-dasharray="${5 + i} 3"/>`, i, L.glow)).join(""));
  },
  // Briar Bastion: thorn armour, its plate marked with a glowing vine and a
  // bud, thorned pauldrons. Its sprout stays.
  pangrove(k) {
    const L = VANGUARD_LOOK.pangrove;
    armour(k, L, (x, y, s) => k.lume("chase", k.path(`M${x} ${y + 9 * s}Q${x - 6 * s} ${y + 2 * s} ${x} ${y - 4 * s}Q${x + 6 * s} ${y - 9 * s} ${x + 2 * s} ${y - 12 * s}`, "none", L.glow, 2 * s), 2, L.glow) +
      k.lume("pulse", k.circle(x + 2 * s, y - 12 * s, 2.2 * s, "#ffb3cf", k.ink, 0.4), 3, "#ffb3cf"));
    const thorns = (x: number, y: number, n: number) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="6" fill="#3a5a2a" stroke="${k.ink}" stroke-width="0.9"/>` +
      Array.from({ length: n }, (_, i) => {
        const u = x - 8 + (i * 16) / (n - 1);
        return k.path(`M${u - 2} ${y - 4}L${u} ${y - 11}L${u + 2} ${y - 4}Z`, "#c8d8a0", k.ink, 0.5);
      }).join("");
    if (!k.back) k.put("flame", k.side ? thorns(k.C - k.side * 2, k.T + 4, 3) : thorns(k.L + 5, k.T + 4, 3) + thorns(k.R - 5, k.T + 4, 3));
    else k.put("scarf", thorns(k.C - 18, k.T + 3, 3) + thorns(k.C + 18, k.T + 3, 3));
  },
  // Cloud Keeper: a soft round plate with a raindrop that glows, and a
  // little rain cloud of its own floating by its shoulder, its drops lit
  // in a run.
  mossloth(k) {
    const L = VANGUARD_LOOK.mossloth;
    armour(k, L, (x, y, s) => k.lume("pulse", k.path(`M${x} ${y - 7 * s}Q${x + 6 * s} ${y + 1 * s} ${x} ${y + 6 * s}Q${x - 6 * s} ${y + 1 * s} ${x} ${y - 7 * s}Z`, L.glow, k.ink, 0.6), 2, L.glow));
    const cloud = (x: number, y: number, z: number) => `<g transform="translate(${x} ${y}) scale(${z}) translate(${-x} ${-y})">` +
      [[-14, 2, 10], [0, -4, 13], [14, 2, 10], [0, 6, 11]].map(([u, v, r]) => `<circle cx="${x + u}" cy="${y + v}" r="${r}" fill="#f4f8ff" stroke="${k.ink}" stroke-width="1"/>`).join("") +
      `<rect x="${x - 22}" y="${y + 2}" width="44" height="10" fill="#f4f8ff"/>` +
      [-10, -2, 6, 14].map((u, i) => k.lume("chase", k.path(`M${x + u - 4} ${y + 16}q2 4 0 7q-2 -3 0 -7Z`, L.glow, "none"), 3 + i, L.glow)).join("") + "</g>";
    // Its cloud floats by its left shoulder: viewer's right from the front,
    // left from behind, behind the head in profile.
    if (k.back) k.put("flame", cloud(k.C - 50, k.ht + 4, 0.7));
    else if (k.side) k.put("flame", cloud(k.hx - k.side * 42, k.ht + 2, 0.7));
    else k.put("flame", cloud(k.hx + 60, k.ht + 4, 0.7));
  },
};

Object.assign((DESIGNS.vanguard ??= {}), VANGUARD_DESIGNS_NEW);
