import type { RaidRite } from "../../../packages/shared/src/raid";

// Each picture depicts the effect rather than borrowing an unrelated combat icon.
const pictures: Record<RaidRite, { color: string; art: string }> = {
  fireproof: { color: "#ffbd83", art: '<path d="m32 6 19 8v15c0 15-19 27-19 27S13 44 13 29V14Z" fill="currentColor" fill-opacity=".15"/><path d="M32 43c-16-1-10-17-3-23-1 7 6 6 5 1 11 10 12 21-2 22Z" fill="currentColor" fill-opacity=".6"/>' },
  polished: { color: "#ffe2a0", art: '<path d="m32 7 17 25-17 25-17-25Z" fill="currentColor" fill-opacity=".2"/><path d="M6 32h17m-6-6 6 6-6 6m20-6h21M32 14v36M20 22l24 20"/>' },
  lucid: { color: "#c9a3ff", art: '<path d="M6 32Q32 8 58 32Q32 56 6 32Z"/><circle cx="32" cy="32" r="9"/><path d="m47 7 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor" fill-opacity=".5"/>' },
  shelter: {
    color: "#83e8cf",
    art: '<ellipse cx="32" cy="48" rx="24" ry="10" opacity=".45"/><path d="M32 7 49 14v13c0 12-17 21-17 21S15 39 15 27V14Z" fill="currentColor" fill-opacity=".14"/><path d="m30 20 11 9-11 9 2-9ZM5 23h13M3 30h11M6 37h12"/>',
  },
  sharing: {
    color: "#ffd86b",
    art: '<circle cx="32" cy="21" r="13" fill="currentColor" fill-opacity=".18"/><path d="m34 10-10 13h8l-2 10 11-15h-9Z" fill="currentColor"/><path d="M32 38v7m0-4-15 6m15-6 15 6"/><circle cx="15" cy="49" r="5"/><circle cx="49" cy="49" r="5"/><path d="M9 57h12m22 0h12"/>',
  },
  core: {
    color: "#ffb17d",
    art: '<path d="m32 8 18 10 5 20-15 17H23L9 38l5-20Z" fill="currentColor" fill-opacity=".12"/><path d="m32 18 10 13-10 15-10-15Z" fill="currentColor" fill-opacity=".6"/><path d="M3 31h13m-5-5 5 5-5 5m50-5H48m5-5-5 5 5 5M32 3v8m0 43v7"/>',
  },
  rescue: {
    color: "#91d5ff",
    art: '<path d="M9 47 21 33l10 6 12-13 12 5"/><path d="m23 44 9 5 13-12M18 30l8-10 10 6M36 26l8-8"/><circle cx="15" cy="21" r="5" fill="currentColor" fill-opacity=".3"/><path d="M48 5v13m-6-6h12"/><ellipse cx="31" cy="55" rx="24" ry="4" opacity=".4"/>',
  },
  courage: {
    color: "#ffa0b6",
    art: '<path d="M32 52S8 36 9 22c1-13 17-15 23-4 7-11 22-9 23 4 1 14-23 30-23 30Z" fill="currentColor" fill-opacity=".18"/><path d="m34 21-12 14h10l-2 12 13-17H33ZM5 8l7 6m47-6-7 6M3 36h7m44 0h7"/>',
  },
  mending: {
    color: "#b2f598",
    art: '<ellipse cx="32" cy="44" rx="26" ry="12"/><ellipse cx="32" cy="44" rx="17" ry="7" opacity=".5"/><path d="M32 7v24m-12-12h24" stroke-width="6"/><path d="M10 29v8m-4-4h8m40-12v8m-4-4h8"/><path d="m26 46 6 4 6-4"/>',
  },  // A paw stepping lightly over water, a bubble bursting beside it.
  footing: {
    color: "#7fe9ff",
    art: '<path d="M4 46q7-5 14 0t14 0 14 0 14 0M8 55q6-4 12 0t12 0 12 0 12 0" opacity=".6"/><ellipse cx="30" cy="30" rx="9" ry="11" fill="currentColor" fill-opacity=".2"/><circle cx="20" cy="17" r="4"/><circle cx="30" cy="12" r="4"/><circle cx="40" cy="17" r="4"/><circle cx="51" cy="31" r="6"/><path d="M57 23l3-3M51 22v-4M58 31h4"/>',
  },
  lamplighter: {
    color: "#ffd65b",
    art: '<path d="M22 14h16l-3-6H25Z"/><rect x="20" y="14" width="20" height="20" rx="3"/><path d="M30 34v16M22 52h16"/><path d="M30 19q-4 4 0 9q4-5 0-9Z" fill="currentColor" fill-opacity=".5"/><circle cx="30" cy="24" r="17" opacity=".35"/><path d="M48 40v8M44 44h8" opacity=".8"/>',
  },
};

export function raidRitePicture(id: RaidRite) {
  const { color, art } = pictures[id];
  return `<span class="raid-rite-icon" style="--rite-color:${color}"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art}</svg></span>`;
}
