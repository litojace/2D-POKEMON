import type { CharacterId } from "@arena/shared";

/**
 * Paintings behind the startup curtain (docs/loading-screens.md,
 * docs/loading-art-prompts.md): champions in Legendary and Mythical skins
 * from the Shop, fighting in the game's PvP modes or resting between them. The scenes are the brief
 * the paintings are made from; a scene is shown once its picture is in
 * src/art/loading-art/startup-art-<id>.webp (scripts/import-loading-art.py),
 * so the list never points at a painting that isn't there. The service
 * worker keeps the one a start downloads for the next (sw.ts,
 * arena-startup-art-v1); it does not install all of them with the game.
 */
export type PvpMode = "duel" | "teams" | "ffa";
export type LoadingScene = {
  id: string;
  /**
   * The PvP mode it shows; none for a calm scene, such as champions
   * resting between matches (the owner, 20 Nov). Nothing reads it since
   * the loading tips went (27 Nov 2026); kept as the paintings' record.
   */
  mode?: PvpMode;
  /** Who is in it, each in a Legendary or Mythical skin from the Shop. */
  fighters: { champion: CharacterId; skin: string }[];
  /** Where the fight is (object-position), clear of the title's corner. */
  focus?: string;
};
export type LoadingArt = LoadingScene & { src: string };

export const LOADING_SCENES: LoadingScene[] = [
  // Calm scenes, made first (20 Nov).
  {
    id: "rest-hoi-an",
    fighters: [
      { champion: "mossloth", skin: "mossloth-hon-viet" },
      { champion: "lumoth", skin: "lumoth-hon-viet" },
    ],
  },
  {
    id: "rest-vanguard-hill",
    fighters: [
      { champion: "terradon", skin: "terradon-nova-vanguard" },
      { champion: "glacelle", skin: "glacelle-nova-vanguard" },
    ],
  },
  {
    id: "rest-moonlit-ruins",
    fighters: [
      { champion: "lumoth", skin: "lumoth-starweaver" },
      { champion: "duskveil", skin: "duskveil-eclipse" },
    ],
  },
  {
    id: "rest-sky-harbour",
    fighters: [
      { champion: "sunbara", skin: "sunbara-sky-pirates" },
      { champion: "astrabun", skin: "astrabun-sky-pirates" },
    ],
  },
  {
    id: "rest-aurora",
    fighters: [
      { champion: "halcyra", skin: "halcyra-starfletch" },
      { champion: "auralynx", skin: "auralynx-celestial-sage" },
    ],
  },
  {
    id: "rest-ring-toss",
    fighters: [
      { champion: "voltkit", skin: "voltkit-sky-pirates" },
      { champion: "astrabun", skin: "astrabun-sky-pirates" },
    ],
  },
  {
    id: "rest-market",
    fighters: [
      { champion: "mossloth", skin: "mossloth-hon-viet" },
      { champion: "sunbara", skin: "sunbara-sky-pirates" },
      { champion: "lumoth", skin: "lumoth-hon-viet" },
    ],
  },
  {
    id: "rest-picnic",
    fighters: [
      { champion: "terradon", skin: "terradon-nova-vanguard" },
      { champion: "glacelle", skin: "glacelle-nova-vanguard" },
    ],
  },
  {
    id: "duel-storm-vs-forge",
    mode: "duel",
    fighters: [
      { champion: "voltkit", skin: "voltkit-stormcrown" },
      { champion: "cindrake", skin: "cindrake-sunforged" },
    ],
  },
  {
    id: "duel-corsairs",
    mode: "duel",
    // Painted with a lot of floor: shown from higher up.
    focus: "50% 20%",
    fighters: [
      { champion: "voltkit", skin: "voltkit-sky-pirates" },
      { champion: "tidefin", skin: "tidefin-sky-pirates" },
    ],
  },
  {
    id: "duel-vanguard",
    mode: "duel",
    fighters: [
      { champion: "terradon", skin: "terradon-nova-vanguard" },
      { champion: "glacelle", skin: "glacelle-nova-vanguard" },
    ],
  },
  {
    id: "teams-hon-viet",
    mode: "teams",
    fighters: [
      { champion: "cindrake", skin: "cindrake-hon-viet" },
      { champion: "voltkit", skin: "voltkit-hon-viet" },
      { champion: "mossloth", skin: "mossloth-hon-viet" },
      { champion: "lumoth", skin: "lumoth-hon-viet" },
    ],
  },
  {
    id: "teams-stars-stripes",
    mode: "teams",
    fighters: [
      { champion: "voltkit", skin: "voltkit-stars-stripes" },
      { champion: "cindrake", skin: "cindrake-stars-stripes" },
      { champion: "shadopus", skin: "shadopus-stars-stripes" },
      { champion: "pyranda", skin: "pyranda-stars-stripes" },
    ],
  },
  {
    id: "ffa-mythicals",
    mode: "ffa",
    fighters: [
      { champion: "duskveil", skin: "duskveil-eclipse" },
      { champion: "halcyra", skin: "halcyra-starfletch" },
      { champion: "auralynx", skin: "auralynx-celestial-sage" },
      { champion: "terradon", skin: "terradon-world-shell" },
    ],
  },
  {
    id: "duel-eclipse",
    mode: "duel",
    fighters: [
      { champion: "duskveil", skin: "duskveil-eclipse" },
      { champion: "lumoth", skin: "lumoth-starweaver" },
    ],
  },
  {
    id: "ffa-sky-pirates",
    mode: "ffa",
    fighters: [
      { champion: "astrabun", skin: "astrabun-sky-pirates" },
      { champion: "sunbara", skin: "sunbara-sky-pirates" },
      { champion: "wombolder", skin: "wombolder-sky-pirates" },
    ],
  },
  // Ultimates in the game's arenas (the owner's second set, 20 Nov).
  {
    id: "ffa-shifting-ruins",
    mode: "ffa",
    // Shown from higher up: Astrabun (top right) clear of the title.
    focus: "50% 20%",
    fighters: [
      { champion: "coilemur", skin: "coilemur-hon-viet" },
      { champion: "pyranda", skin: "pyranda-hon-viet" },
      { champion: "auralynx", skin: "auralynx-nova-vanguard" },
      { champion: "astrabun", skin: "astrabun-nova-vanguard" },
    ],
  },
  {
    id: "ffa-ember-forge",
    mode: "ffa",
    // Shown from higher up: Duskveil (top right) clear of the title.
    focus: "50% 0%",
    fighters: [
      { champion: "cindrake", skin: "cindrake-stars-stripes" },
      { champion: "wombolder", skin: "wombolder-sky-pirates" },
      { champion: "tidefin", skin: "tidefin-hon-viet" },
      { champion: "duskveil", skin: "duskveil-eclipse" },
    ],
  },
  {
    id: "ffa-tide-pools",
    mode: "ffa",
    // Shown from higher up: Halcyra (top right) clear of the title.
    focus: "50% 0%",
    fighters: [
      { champion: "glacelle", skin: "glacelle-stars-stripes" },
      { champion: "shadopus", skin: "shadopus-sky-pirates" },
      { champion: "pangrove", skin: "pangrove-nova-vanguard" },
      { champion: "halcyra", skin: "halcyra-stars-stripes" },
    ],
  },
  {
    id: "duel-skyline-lance",
    mode: "duel",
    fighters: [
      { champion: "halcyra", skin: "halcyra-stars-stripes" },
      { champion: "coilemur", skin: "coilemur-sky-pirates" },
    ],
  },
];

const pictures = import.meta.glob<string>(
  "./art/loading-art/startup-art-*.webp",
  { eager: true, query: "?url", import: "default" },
);
const pictureOf = (id: string) =>
  pictures[`./art/loading-art/startup-art-${id}.webp`];

/** The scenes whose painting is in the game. */
export const LOADING_ART: LoadingArt[] = LOADING_SCENES.flatMap((scene) => {
  const src = pictureOf(scene.id);
  return src ? [{ ...scene, src }] : [];
});

/** The painting chosen (and downloaded) during the last start, for this one. */
export const NEXT_ART_KEY = "ea-next-art";

/**
 * This start's painting: the one the last start chose and downloaded, so it
 * is on the device before the curtain needs it. None on a first start (the
 * plain cover shows; the boot screen in index.html reads the same key).
 */
export function artForThisStart(list = LOADING_ART): LoadingArt | undefined {
  try {
    const id = localStorage.getItem(NEXT_ART_KEY);
    return list.find((art) => art.id === id);
  } catch {
    return undefined;
  }
}

/**
 * A painting for the next start: any of them with the same chance, but not
 * the one just shown (when there is another).
 */
export function pickNextArt(
  current: string | undefined,
  list = LOADING_ART,
  random = Math.random,
): LoadingArt | undefined {
  const choices =
    list.length > 1 ? list.filter((art) => art.id !== current) : list;
  return choices[Math.floor(random() * choices.length)];
}

/**
 * Once the game is up: choose the next start's painting and download it now,
 * so it is ready (and cached) before that start's curtain needs it.
 */
export function prepareNextArt(current: string | undefined) {
  const next = pickNextArt(current);
  try {
    if (next) localStorage.setItem(NEXT_ART_KEY, next.id);
    else localStorage.removeItem(NEXT_ART_KEY);
  } catch {
    return; // No storage: every start shows the plain cover.
  }
  if (!next) return;
  const picture = new Image();
  picture.decoding = "async";
  picture.src = next.src;
}
