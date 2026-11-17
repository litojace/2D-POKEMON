/**
 * The Spire's pictures, as inline SVG (no image files to load): the tower
 * on its Raid Hub card and page, and one small icon per blessing (on the
 * page's codex and the blessing cards between floors).
 */
import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";
import type { SpireBlessingId } from "../../../packages/shared/src/spire";
import type { Fx } from "./fx-engine";

/** The Spire's colour (Echoes, its card, its cards between floors). */
export const SPIRE_COLOR = "#a78bff";
/** The Echoes' skill colour in battle (a violet the court never uses). */
export const ECHO_SKILL_COLOR = 0xa98bff;
/** The tint on an Echo's rig (dark violet), and lighter when it is hit. */
export const ECHO_TINT = 0x8a7ab8;
export const ECHO_TINT_HURT = 0xd8c8ff;
/** Zone 3's Echoes: the pale wash over them (see AnimationPose.wash). */
export const ECHO_WASH_Z3 = { color: 0xe4dcff, alpha: 0.35 };
/** Zone 4's Echoes: a deeper violet shade (and a rose flush when hit). */
export const ECHO_TINT_Z4 = 0x5c4c94;
export const ECHO_TINT_HURT_Z4 = 0xff9cc8;
/** Zone 5's Echoes: a deep indigo shade (and a magenta flush when hit). */
export const ECHO_TINT_Z5 = 0x4a3c8c;
export const ECHO_TINT_HURT_Z5 = 0xff7ad0;
/** Zone 6's Echoes: a pale ice-blue shade and wash (a pale cyan flush when hit). */
export const ECHO_TINT_Z6 = 0xd4deff;
export const ECHO_TINT_HURT_Z6 = 0xb8fff4;
export const ECHO_WASH_Z6 = { color: 0xdce8ff, alpha: 0.28 };
/**
 * An Echo's tint on its zone's court. Zone 3's court is dark slate, where
 * the usual dark violet shade sinks into the floor: there Echoes are pale
 * violet ghosts instead (and flush pink when hit), washed over in pale
 * violet so even a dark champion's outlines and shading lift off the slate.
 * Zone 4's court is pale lavender marble: there the shade is deeper (no
 * wash), so Echoes stand dark on the pale stone, and the hit flush is rose
 * (the usual pale lilac flush would melt into the marble).
 * Zone 5's court is bright champagne stone and gold in full sun: there
 * the shade is a deep indigo (gold's opposite, no wash), so Echoes stand
 * dark and cool on the warm stone, and the hit flush is magenta (a pale
 * or gold flush would melt into the light).
 */
export function spireEchoTint(zone?: number): {
  tint: number;
  hurtTint: number;
  wash?: { color: number; alpha: number };
} {
  return zone === 3
    ? { tint: 0xe0d6ff, hurtTint: 0xffc2d6, wash: ECHO_WASH_Z3 }
    : zone === 4
      ? { tint: ECHO_TINT_Z4, hurtTint: ECHO_TINT_HURT_Z4 }
      : zone === 5
        ? { tint: ECHO_TINT_Z5, hurtTint: ECHO_TINT_HURT_Z5 }
        : zone === 6
          ? {
              tint: ECHO_TINT_Z6,
              hurtTint: ECHO_TINT_HURT_Z6,
              wash: ECHO_WASH_Z6,
            }
          : { tint: ECHO_TINT, hurtTint: ECHO_TINT_HURT };
}

/** Compact lobby emblem: transparent, with broad tiers readable on phones. */
export function spireLobbyIcon() {
  const tiers = [
    [34, 35, 7],
    [28, 28, 10],
    [22, 21, 13],
    [16, 14, 16],
  ]
    .map(([width, y, x]) => {
      const right = x + width;
      return `<path d="M${x} ${y + 10}h${width}l-2 -10H${x + 2}Z" fill="#aa8ce6" stroke="#694a9c" stroke-width="1.1" stroke-linejoin="round"/><path d="M24 ${y}h${right - 26}l2 10H24Z" fill="#8261bc"/><path d="M${x} ${y + 10}h${width}" stroke="#e5d4ff" stroke-width="1.7" stroke-linecap="round"/><path d="M22 ${y + 3}h4v4h-4Z" fill="#fff0b0"/>`;
    })
    .join("");
  return `<svg class="spire-lobby-icon" viewBox="0 0 48 64" fill="none" aria-hidden="true" focusable="false"><path d="M6 56h36l-3 -7H9Z" fill="#bba0ee" stroke="#694a9c" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 49h28l-2 -8H12Z" fill="#9270c9"/>${tiers}<path d="M17 14 24 3l7 11Z" fill="#e8d8ff" stroke="#8e6cc4" stroke-width="1.1" stroke-linejoin="round"/><path d="m24 3 7 11h-7Z" fill="#b69ae8"/><path d="M20 53v-6a4 4 0 0 1 8 0v6" fill="#fff0b0" stroke="#765298" stroke-width="1.1"/><path d="M9 56h30M16 59h16" stroke="#eadcff" stroke-width="1.7" stroke-linecap="round"/><path d="m38 13 1.5 3.5L43 18l-3.5 1.5L38 23l-1.5 -3.5L33 18l3.5 -1.5Z" fill="#ffe8a2"/><circle cx="9" cy="30" r="1.5" fill="#eee1ff"/></svg>`;
}

/**
 * The tower: ten floors of stone narrowing to a crystal tip, lit up to the
 * highest floor reached. `id` keeps gradient ids apart when two show.
 */
export function spireTowerArt(highest = 0, id = "spire") {
  const floors = 10;
  const bands = Array.from({ length: floors }, (_, i) => {
    const y = 300 - i * 25,
      half = 58 - i * 4.2;
    const lit = i < highest;
    const elite = i === 4,
      boss = i === 9;
    return `<g><path d="M${100 - half} ${y} L${100 + half} ${y} L${100 + half - 4} ${y - 23} L${100 - half + 4} ${y - 23} Z" fill="${lit ? `url(#${id}-lit)` : `url(#${id}-stone)`}" stroke="#05030f" stroke-width="1.5"/>${boss ? "" : `<rect x="${100 - 5}" y="${y - 17}" width="10" height="11" rx="5" fill="${lit ? "#fff3c4" : elite ? "#c9b2ff" : "#3c2f63"}" opacity="${lit ? 0.95 : 0.8}"/>`}${elite ? `<path d="M${100 - half + 8} ${y - 12} h-10 M${100 + half - 8} ${y - 12} h10" stroke="#c9b2ff" stroke-width="2" stroke-linecap="round"/>` : ""}</g>`;
  }).join("");
  return `<svg class="spire-tower" viewBox="0 0 200 340" preserveAspectRatio="xMidYMax meet" role="img" aria-label="The Spire"><defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d55"/><stop offset="0.6" stop-color="#140e2c"/><stop offset="1" stop-color="#0a0818"/></linearGradient><linearGradient id="${id}-stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2446"/><stop offset="0.5" stop-color="#4a3d74"/><stop offset="1" stop-color="#231c3b"/></linearGradient><linearGradient id="${id}-lit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4596"/><stop offset="0.5" stop-color="#9a80e8"/><stop offset="1" stop-color="#4c3a82"/></linearGradient><radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9b2ff" stop-opacity="0.85"/><stop offset="1" stop-color="#c9b2ff" stop-opacity="0"/></radialGradient></defs><rect x="-400" y="-400" width="1000" height="740" fill="url(#${id}-sky)"/><g fill="#d8ccff" opacity="0.55"><circle cx="24" cy="40" r="1.3"/><circle cx="170" cy="28" r="1.1"/><circle cx="150" cy="80" r="1.4"/><circle cx="38" cy="110" r="0.9"/><circle cx="182" cy="140" r="1"/><circle cx="12" cy="180" r="1.2"/></g><ellipse cx="100" cy="312" rx="86" ry="14" fill="#06040f"/>${bands}<path d="M86 50 L100 14 L114 50 Z" fill="#c9b2ff" stroke="#05030f" stroke-width="1.5"/><circle cx="100" cy="34" r="30" fill="url(#${id}-glow)"/></svg>`;
}

const ICONS: Record<SpireBlessingId, string> = {
  keen: '<path d="M5 19 19 5M14 5h5v5M5 14l5 5"/>',
  stoneskin:
    '<path d="M12 3 19 6v6c0 4-3 7-7 9-4-2-7-5-7-9V6Z"/><path d="M9 12h6"/>',
  leech:
    '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/><path d="M10 14h4M12 12v4"/>',
  fleet: '<path d="M4 12h9M4 8h6M4 16h6M13 6l7 6-7 6"/>',
  focus: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M10 3h4"/>',
  surge: '<path d="M13 3 6 14h5l-1 7 7-11h-5Z"/>',
  rally: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  harvest:
    '<path d="M12 21c0-6 0-9 6-14-1 6-3 9-6 10M12 21c0-5-2-8-7-10 1 5 3 7 7 8"/>',
  bastion:
    '<path d="M5 5h14v7c0 4-3 7-7 9-4-2-7-5-7-9Z"/><path d="m9 12 2 2 4-4"/>',
  wake: '<path d="M3 15c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/><path d="m11 3-2 5h4l-2 5"/>',
};
/** A blessing's icon (line art in the current colour). */
export function spireBlessingIcon(id: SpireBlessingId) {
  return `<svg class="spire-blessing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[id]}</svg>`;
}

/** How long a climb's last Echoes take to fade once it ends (ms). */
export const ECHO_FADE_MS = 700;
let climbEnd: { id: string; at: number } | undefined;
/**
 * How much of a fighter shows: 1, or for an Echo after its climb ended a
 * fade from 1 to 0 (it doesn't stand frozen on the court over the results).
 * `now` is the frame's clock in ms.
 */
export function echoShown(state: Snapshot, p: Fighter, now: number) {
  if (!p.echo || state.phase !== "finished" || !state.raid?.spire) return 1;
  const id = state.raid.resultId ?? `${state.code}:${state.raid.spire.floor}`;
  if (climbEnd?.id !== id) climbEnd = { id, at: now };
  return Math.max(0, 1 - (now - climbEnd.at) / ECHO_FADE_MS);
}
/**
 * The elite captain's crown: five violet crystal points over its head
 * (drawn in the frame's graphics layer) and one small halo through the
 * effects engine, so Low's glow budget sees it.
 */
export function drawEliteCrown(
  g: Phaser.GameObjects.Graphics,
  fx: Fx,
  x: number,
  y: number,
  scale: number,
  clock: number,
) {
  const bob = Math.sin(clock * 3) * 2,
    w = 30 * scale,
    h = 15 * scale,
    top = y + bob;
  fx.glow(x, top - h * 0.4, 18 * scale, ECHO_SKILL_COLOR, 0.45);
  const points: { x: number; y: number }[] = [{ x: x - w / 2, y: top }];
  for (let i = 0; i < 5; i++) {
    const px = x - w / 2 + (w * (i + 0.5)) / 5;
    points.push({ x: px - w / 10, y: top - h * 0.35 });
    points.push({ x: px, y: top - h * (i === 2 ? 1.25 : i % 2 ? 0.8 : 1) });
    points.push({ x: px + w / 10, y: top - h * 0.35 });
  }
  points.push({ x: x + w / 2, y: top });
  g.fillStyle(0x2a1d55, 0.95).fillPoints(points, true);
  g.lineStyle(2, 0xd8c8ff, 0.95).strokePoints(points, true);
  g.fillStyle(0xfff3c4, 0.95).fillCircle(x, top - h * 0.2, 2.6 * scale);
}
