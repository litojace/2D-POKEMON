import type { RaidBossId } from "../../../packages/shared/src/raid";
import { raidGuideSprite } from "./raid-guide-sprites";

/**
 * Small emblems for the current boss identities, drawn in a 100×100 box.
 */
const ink =
  'stroke="#14203a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const CRESTS: Record<RaidBossId, string> = {
  grumblecrag: `<g transform="translate(50 56) scale(.78)">${raidGuideSprite("grumblecrag")}</g>`,
  // A round-headed axolotl peeking over a wave: frilly gills, pearl on its brow.
  tidewyrm: `<g ${ink}><path d="M20 30c-8-6-12-14-8-18 4 4 8 10 10 16M18 40c-10-2-16-8-14-14 6 2 12 6 14 12M22 50c-10 2-16 0-18-6 6-1 12 0 18 4M80 30c8-6 12-14 8-18-4 4-8 10-10 16M82 40c10-2 16-8 14-14-6 2-12 6-14 12M78 50c10 2 16 0 18-6-6-1-12 0-18 4" fill="#ff8fbd"/><ellipse cx="50" cy="48" rx="31" ry="27" fill="#4fd6c8"/><path d="M26 58c8 8 40 8 48 0-2 10-12 16-24 16s-22-6-24-16Z" fill="#fdf6f4"/><circle cx="50" cy="28" r="5" fill="#fff6e0"/><ellipse cx="38" cy="48" rx="5" ry="6.5" fill="#14203a" stroke="none"/><ellipse cx="62" cy="48" rx="5" ry="6.5" fill="#14203a" stroke="none"/><circle cx="36.5" cy="46" r="1.8" fill="#fff" stroke="none"/><circle cx="60.5" cy="46" r="1.8" fill="#fff" stroke="none"/><path d="M34 58c10 6 22 6 32 0" fill="none"/><path d="M6 80c10-8 18-8 26 0s16 8 24 0 16-8 24 0 10 6 14 4v12H6Z" fill="#2c8fa3"/></g>`,
  // A floppy-eared puff of shadow with a crescent-moon tail.
  gloomshade: `<g ${ink}><path d="M80 40c12-4 14-18 6-24 8 10 2 22-8 22Z" fill="#ffe7a8"/><path d="M24 30c-8-14-2-22 6-14l6 8c8-4 20-4 28 0l6-8c8-8 14 0 6 14 8 8 10 22 6 34-6 16-22 22-32 22S28 80 22 64c-4-12-4-26 2-34Z" fill="#3b2a6b"/><path d="M60 68c8-2 14-12 20-26" fill="none" stroke="#3b2a6b" stroke-width="7"/><circle cx="40" cy="50" r="5" fill="#d8c8ff" stroke="none"/><circle cx="58" cy="50" r="5" fill="#d8c8ff" stroke="none"/><circle cx="49" cy="40" r="3" fill="#d8c8ff" stroke="none"/><path d="M40 64c6 5 12 5 18 0" fill="none" stroke="#d8c8ff"/></g>`,
  // A sleepy violet tapir with an ivory saddle and a starry nightcap.
  somnara: `<g ${ink}><ellipse cx="46" cy="65" rx="32" ry="20" fill="#9f88df"/><path d="M27 48c8-4 16-4 22-2v37H29Z" fill="#fff1d4"/><path d="M22 78v13h10V80m27 0v11h10V78" fill="#9f88df"/><circle cx="65" cy="45" r="23" fill="#ac94ed"/><circle cx="47" cy="33" r="6" fill="#eab4d5"/><path d="M77 45c13 0 15 13 8 20-4 3-8 0-7-4l1-7" fill="#ac94ed"/><path d="M53 44q6 5 12 0" fill="none"/><path d="M47 28c-2-21 22-30 29-13-10-7-15 0-13 9" fill="#55428d"/><path d="M44 28q14-9 30-1" fill="none" stroke="#fff1d4" stroke-width="6"/><circle cx="77" cy="15" r="5" fill="#fff1d4"/><path d="m56 15 2-4 2 4 4 1-3 3v4l-3-2-4 2 1-4-3-3Z" fill="#ffe17a" stroke="none"/></g>`,
  // A lavender snail with an iridescent spiral shell and a heart jewel.
  prismatail: `<g ${ink}><path d="M13 80c1-11 21-12 38-12h12V49c0-15 23-15 23 0v22c0 13-20 17-43 17H16q-9 0-3-8Z" fill="#d1bcf4"/><circle cx="38" cy="48" r="30" fill="#c7def3"/><path d="M38 19v58M9 48h58M18 27l41 42M16 68l43-42" stroke="#e3c36e" fill="none"/><path d="M58 53c5-22-27-33-34-11-6 18 22 27 24 9 1-12-16-11-15-2" stroke="#ac8cdd" fill="none" stroke-width="4"/><path d="M38 45c-9-11-17 3 0 13 17-10 9-24 0-13Z" fill="#fff7ff"/><path d="M69 37l-5-15m15 15 5-15" fill="none"/><circle cx="64" cy="20" r="4" fill="#b5a0ec"/><circle cx="85" cy="20" r="4" fill="#b5a0ec"/><circle cx="69" cy="48" r="2" fill="#402d61"/><circle cx="80" cy="48" r="2" fill="#402d61"/><path d="M70 56q5 4 9-1" fill="none"/></g>`,
  // Lumiwick, a living paper sky lantern with ribbon arms.
  emberwing: `<g ${ink}><path d="M30 65C7 71 4 57 8 52M70 65c23 6 26-8 22-13" fill="none" stroke="#f47e35" stroke-width="5"/><path d="M24 65V40c0-35 52-35 52 0v25Z" fill="#ffd49a"/><path d="M40 18q-7 20 0 46m20-46q7 20 0 46" fill="none" stroke="#ed9e50"/><path d="M24 64h52v10H24Z" fill="#d65327"/><circle cx="36" cy="68" r="1" fill="#ffde7d"/><circle cx="64" cy="68" r="1" fill="#ffde7d"/><path d="M47 74v10l-6 10 9-5 9 5-6-10V74" fill="#e87631"/><path d="M47 15c-4-6 3-9 3-14 9 7 8 12 2 15" fill="#ffb453"/><ellipse cx="40" cy="47" rx="4" ry="5" fill="#633326"/><ellipse cx="60" cy="47" rx="4" ry="5" fill="#633326"/><path d="M44 57q6 7 12 0" fill="none"/></g>`,
  // Two floating thunder-jellies tied by a crackling ribbon.
  "storm-twins": `<g ${ink}><path d="M28 50c10 0 14 10 22 4s14-8 22-4" fill="none" stroke="#fff3b0" stroke-width="4"/><path d="M8 44a16 16 0 0 1 32 0c0 4-2 6-4 6H12c-2 0-4-2-4-6Z" fill="#ffd65b"/><path d="M60 44a16 16 0 0 1 32 0c0 4-2 6-4 6H64c-2 0-4-2-4-6Z" fill="#7fb8ff"/><path d="M14 50v18m6-18v24m6-24v18m6-18v22M66 50v20m6-20v24m6-24v18m6-18v22" fill="none"/><path d="M12 28c2-8 10-12 16-10 4-6 12-2 10 4" fill="#e8f2ff"/><path d="M66 28c2-8 10-12 16-10 4-6 12-2 10 4" fill="#e8f2ff"/><path d="M18 40c2 2 4 2 6 0M28 40c2 2 4 2 6 0M70 40h6M82 40h6" fill="none"/><path d="M48 66l6-10h-6l4-10" fill="none" stroke="#ffd65b" stroke-width="3"/></g>`,
};

export function raidCrest(id: RaidBossId, label = false) {
  return `<svg class="raid-crest" viewBox="0 0 100 100" ${label ? "" : 'aria-hidden="true"'} focusable="false">${CRESTS[id]}</svg>`;
}
