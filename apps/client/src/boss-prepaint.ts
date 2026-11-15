/**
 * Boss atlases painted ahead of the battle, while the player waits in the
 * raid room (boss-vector-prewarm.ts schedules it).
 *
 * The battle renderer is destroyed after every battle (main.ts, so iOS keeps
 * the page), so each raid used to paint its boss's atlas again behind the
 * loading screen: up to 0.85 s on this machine, and the reason a raid loaded
 * in 1.6–1.8 s on an iPhone against 0.25 s for a duel.
 *
 * A painted atlas is taken once: the battle that uses it removes it from
 * here (its texture holds the canvas from then on), so nothing painted stays
 * in memory after the battle, and a rig that later repaints its canvas in
 * place (Tidelotl's phase skins) can't leave a stale copy for the next raid.
 */
const held = new Map<string, unknown>();

/** Paint `key` now unless it's already held. */
export function keepPrepainted<T>(key: string, paint: () => T) {
  if (!held.has(key)) held.set(key, paint());
}

/** The painted atlas for `key`: the one painted ahead (taken), or a new one. */
export function takePrepainted<T>(key: string, paint: () => T): T {
  if (!held.has(key)) return paint();
  const painted = held.get(key) as T;
  held.delete(key);
  return painted;
}

/** Drop what's held, except keys for the boss `keep` (an id prefix). */
export function forgetPrepainted(keep?: string) {
  for (const key of [...held.keys()])
    if (!keep || (key !== keep && !key.startsWith(`${keep}:`)))
      held.delete(key);
}

/** What's held now (tests). */
export const prepaintedKeys = () => [...held.keys()];
