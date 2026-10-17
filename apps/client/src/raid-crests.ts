import type { RaidBossId } from "../../../packages/shared/src/raid";
import { raidGuideBoss } from "./raid-guide-art";

/**
 * Small original emblems for each boss, drawn in a 100×100 box. Grumblecrag
 * reuses its guide art; the others are teasers until their fights are built.
 */
const ink = 'stroke="#14203a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const CRESTS: Record<RaidBossId, string> = {
  grumblecrag: `<g transform="translate(50 56) scale(.78)">${raidGuideBoss()}</g>`,
  // A round-snouted sea serpent looping through a wave, pearl on its brow.
  tidewyrm: `<g ${ink}><path d="M8 76c10-8 18-8 26 0s16 8 24 0 16-8 24 0 10 6 12 4v14H8Z" fill="#2c8fa3"/><path d="M26 74c-6-26 6-48 30-52 18-3 30 10 28 24-2 12-14 16-22 10" fill="none" stroke="#4fd6c8" stroke-width="13"/><path d="M26 74c-6-26 6-48 30-52 18-3 30 10 28 24-2 12-14 16-22 10" fill="none" stroke-width="2.6"/><path d="M60 14c-4-6 2-10 6-6 2-6 10-4 8 3" fill="#9ff3e6"/><circle cx="72" cy="34" r="3" fill="#14203a" stroke="none"/><circle cx="64" cy="22" r="4.5" fill="#fff6e0"/><path d="M80 44c3 1 5 0 6-2" fill="none"/></g>`,
  // A floppy-eared puff of shadow with a crescent-moon tail.
  gloomshade: `<g ${ink}><path d="M80 40c12-4 14-18 6-24 8 10 2 22-8 22Z" fill="#ffe7a8"/><path d="M24 30c-8-14-2-22 6-14l6 8c8-4 20-4 28 0l6-8c8-8 14 0 6 14 8 8 10 22 6 34-6 16-22 22-32 22S28 80 22 64c-4-12-4-26 2-34Z" fill="#3b2a6b"/><path d="M60 68c8-2 14-12 20-26" fill="none" stroke="#3b2a6b" stroke-width="7"/><circle cx="40" cy="50" r="5" fill="#d8c8ff" stroke="none"/><circle cx="58" cy="50" r="5" fill="#d8c8ff" stroke="none"/><circle cx="49" cy="40" r="3" fill="#d8c8ff" stroke="none"/><path d="M40 64c6 5 12 5 18 0" fill="none" stroke="#d8c8ff"/></g>`,
  // A sleepy sky whale with a nightcap and a tiny house on its back.
  somnara: `<g ${ink}><path d="M10 62c0-18 20-30 44-30 22 0 34 12 36 24l8-8c2 10-2 16-8 18-4 12-18 20-38 20-24 0-42-8-42-24Z" fill="#8f7ae0"/><path d="M14 66c10 10 26 14 44 12 14-2 24-6 30-12" fill="#c9b8ff"/><path d="M28 34 20 18c10-2 20 2 22 12" fill="#5a4aa8"/><circle cx="19" cy="17" r="4" fill="#fff6e0"/><path d="M50 32v-8h12v8M48 24l8-7 8 7" fill="#ffd9a8"/><path d="M30 56c3 2 6 2 8 0" fill="none"/><path d="M76 20l2 4 4 1-4 2-1 4-2-4-4-1 4-2Z" fill="#fff1b0" stroke="none"/><path d="M86 34l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#fff1b0" stroke="none"/></g>`,
  // A proud crystal peacock with a fan of prism feathers.
  prismatail: `<g ${ink}><path d="M50 60 14 34l10-10Zm0 0L30 16l12-4Zm0 0 2-50 12 2Zm0 0 22-46 10 6Zm0 0 36-26 4 12Z" fill="#fff3b8"/><path d="M50 60 24 24l6-4Zm0 0 12-46 6 2Zm0 0 26-30 4 6Z" fill="#a8f0ff" stroke="none"/><path d="M38 90c-4-14 0-30 12-34 12 4 16 20 12 34Z" fill="#ffd65b"/><circle cx="50" cy="48" r="9" fill="#ffd65b"/><path d="M50 39l-2-7 4 2 1-6 2 7" fill="#fff6e0"/><circle cx="53" cy="47" r="2" fill="#14203a" stroke="none"/><path d="M58 50l6 2-6 2" fill="#ff9a5a"/><path d="M50 70l5 6-5 6-5-6Z" fill="#9ff3ff"/></g>`,
  // A plump, smug fire bird with ember-tipped feathers.
  emberwing: `<g ${ink}><path d="M44 22c-6-10 2-18 8-12 2-8 12-8 10 2 6-4 12 4 4 10" fill="#ffd65b"/><ellipse cx="50" cy="56" rx="30" ry="28" fill="#ff7a4f"/><path d="M22 54c-12 2-18 12-14 20 8-2 14-6 18-12M78 54c12 2 18 12 14 20-8-2-14-6-18-12" fill="#ffb15b"/><ellipse cx="50" cy="64" rx="16" ry="14" fill="#ffd9a8"/><path d="M38 46c3-2 6-2 8 1M54 47c2-3 5-3 8-1" fill="none"/><path d="M47 52h6l-3 5Z" fill="#ffd65b"/><path d="M40 84v8M60 84v8" fill="none"/><path d="M30 84c-4 4-2 8 2 8M70 84c4 4 2 8-2 8" fill="none" stroke="#ffd65b"/></g>`,
  // Two floating thunder-jellies tied by a crackling ribbon.
  "storm-twins": `<g ${ink}><path d="M28 50c10 0 14 10 22 4s14-8 22-4" fill="none" stroke="#fff3b0" stroke-width="4"/><path d="M8 44a16 16 0 0 1 32 0c0 4-2 6-4 6H12c-2 0-4-2-4-6Z" fill="#ffd65b"/><path d="M60 44a16 16 0 0 1 32 0c0 4-2 6-4 6H64c-2 0-4-2-4-6Z" fill="#7fb8ff"/><path d="M14 50v18m6-18v24m6-24v18m6-18v22M66 50v20m6-20v24m6-24v18m6-18v22" fill="none"/><path d="M12 28c2-8 10-12 16-10 4-6 12-2 10 4" fill="#e8f2ff"/><path d="M66 28c2-8 10-12 16-10 4-6 12-2 10 4" fill="#e8f2ff"/><path d="M18 40c2 2 4 2 6 0M28 40c2 2 4 2 6 0M70 40h6M82 40h6" fill="none"/><path d="M48 66l6-10h-6l4-10" fill="none" stroke="#ffd65b" stroke-width="3"/></g>`,
};

export function raidCrest(id: RaidBossId, label = false) {
  return `<svg class="raid-crest" viewBox="0 0 100 100" ${label ? "" : 'aria-hidden="true"'} focusable="false">${CRESTS[id]}</svg>`;
}
