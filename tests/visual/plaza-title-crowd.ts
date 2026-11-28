import type { Page } from "@playwright/test";

/**
 * A crowd round the player with titles of every tier, and some with none
 * (plaza-titles.spec.ts; the README's Plaza picture).
 *
 * [key, name, title, its colour (arena_titles), dx, dy] from the player.
 * The first five stand nearest: with the player, they are who the moving
 * effects play for.
 */
export const TITLE_CROWD: [
  string,
  string,
  string | null,
  string | null,
  number,
  number,
][] = [
  ["t-leg", "Mika", "Lone Mountain", "#c9a46a", -86, 6],
  ["t-epic", "Juno", "Mountain Conqueror", "#ffcf66", 88, 10],
  ["t-rare", "Pip", "Cragbreaker", "#e5bc73", -52, 84],
  ["t-none", "Sol", null, null, 48, 88],
  ["t-common", "Bea", "First Victory", "#9ee6a8", 0, -92],
  // Further out: titles that hold still.
  ["t-myth2", "Rook", "Legend", "#ffe08a", -200, -70],
  ["t-leg2", "Ivy", "Master Angler", "#5fb3ff", 196, -66],
  ["t-epic2", "Kai", "Tempest", "#50dbe9", -214, 96],
  ["t-rare2", "Zed", "Echo Breaker", "#b79cff", 206, 110],
  ["t-none2", "Ami", null, null, -150, 170],
  ["t-common2", "Lux", "Sprout", "#8ad66f", 132, 176],
  ["t-long", "Nori", "Earthshaker of the Spire", "#c9a46a", 0, 178],
];
/** The player's own title in that crowd: the top tier. */
export const MY_TITLE = {
  title: "Stormbreaker of the Spire",
  titleColor: "#8edfff",
};

/** Put the crowd round the player, at `at` (default: where they stand). */
export async function titleCrowd(
  page: Page,
  at?: { x: number; y: number },
  mine: { title: string | null; titleColor: string | null } = MY_TITLE,
) {
  await page.evaluate(
    ([crowd, at, mine]) => {
      const w = window as any,
        world = w.__plazaWorld;
      if (at) w.__plazaPosition(at.x, at.y);
      const me = world.bodyOf("local");
      for (const [key, name, title, titleColor, dx, dy] of crowd) {
        world.join(key, `acct-${key}`, {
          name,
          title,
          titleColor,
          level: 20,
          character: ["voltkit", "tidefin", "cindrake", "astrabun"][
            key.length % 4
          ],
          skin: null,
        });
        Object.assign(world.bodyOf(key), { x: me.x + dx, y: me.y + dy });
      }
      const profile = world.profileOf("local");
      Object.assign(profile, mine);
      w.__sock.fire("plaza-profiles", [profile]);
    },
    [TITLE_CROWD, at ?? null, mine] as const,
  );
}
