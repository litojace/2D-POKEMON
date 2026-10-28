import type { RaidBossId } from "../../../packages/shared/src/raid";
import hero0 from "./art/raid-splash/grumblecrag.webp";
import thumb0 from "./art/raid-splash/grumblecrag-thumb.webp";
import hero1 from "./art/raid-splash/tidewyrm.webp";
import thumb1 from "./art/raid-splash/tidewyrm-thumb.webp";
import hero2 from "./art/raid-splash/gloomshade.webp";
import thumb2 from "./art/raid-splash/gloomshade-thumb.webp";
import hero3 from "./art/raid-splash/somnara.webp";
import thumb3 from "./art/raid-splash/somnara-thumb.webp";
import hero4 from "./art/raid-splash/prismatail.webp";
import thumb4 from "./art/raid-splash/prismatail-thumb.webp";
import hero5 from "./art/raid-splash/emberwing.webp";
import thumb5 from "./art/raid-splash/emberwing-thumb.webp";
import hero6 from "./art/raid-splash/storm-twins.webp";
import thumb6 from "./art/raid-splash/storm-twins-thumb.webp";

export const RAID_SPLASH: Record<RaidBossId, { hero: string; thumb: string }> =
  {
    grumblecrag: { hero: hero0, thumb: thumb0 },
    tidewyrm: { hero: hero1, thumb: thumb1 },
    gloomshade: { hero: hero2, thumb: thumb2 },
    somnara: { hero: hero3, thumb: thumb3 },
    prismatail: { hero: hero4, thumb: thumb4 },
    emberwing: { hero: hero5, thumb: thumb5 },
    "storm-twins": { hero: hero6, thumb: thumb6 },
  };

/** Small list images avoid downloading seven full splash illustrations. */
export function raidSplashImage(id: RaidBossId, hero = false) {
  const art = RAID_SPLASH[id];
  return `<img class="raid-splash-image" src="${hero ? art.hero : art.thumb}" alt="" width="${hero ? 1536 : 320}" height="${hero ? 1024 : 213}" decoding="async" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
}
