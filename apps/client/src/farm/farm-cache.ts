import type {
  FarmBalloon,
  FarmStall,
  FarmState,
} from "../../../../packages/shared/src/farm";

/*
 * The farm, ready before you open it: the last state the server sent (from
 * the farm's own loads and actions, or one background load when you reach
 * the hub), with the Supply Balloon and stall. It is kept in memory and in
 * this browser's storage, per player, until you log out or clear the site's
 * data, so the farm draws at once even after the browser was closed: moved
 * on by the time since it came, then refreshed from the server, which
 * always has the last word. Loading the farm counts as being on it (bugs
 * and crows can come if you were there in the last 150 s), so the
 * background load only runs when nothing is kept, once a session, and a
 * failed try is not repeated.
 */
type Kept = {
  owner: string;
  state?: FarmState;
  at: number;
  balloon?: FarmBalloon;
  stall?: FarmStall;
};
const STORE = "arena-farm:";
let ready: Kept | null = null;
const tried = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function stored(owner: string): Kept | null {
  try {
    const k = JSON.parse(localStorage.getItem(STORE + owner) ?? "null");
    return k?.v === 1 && k.state?.now
      ? { owner, state: k.state, at: k.at, balloon: k.balloon, stall: k.stall }
      : null;
  } catch {
    return null;
  }
}
export function keptFor(owner: string | undefined): Kept | null {
  if (!owner) return null;
  if (ready?.owner !== owner) ready = stored(owner);
  return ready;
}
export function keep(
  owner: string | undefined,
  patch: { state?: FarmState; balloon?: FarmBalloon; stall?: FarmStall },
) {
  if (!owner) return;
  if (patch.state && !patch.state.now) return;
  const prev = keptFor(owner) ?? { owner, at: 0 };
  ready = {
    ...prev,
    ...patch,
    at: patch.state ? Date.now() : prev.at,
  };
  // Written a moment later, so a burst of actions saves once.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const k = ready;
    if (!k?.state) return;
    try {
      localStorage.setItem(
        STORE + k.owner,
        JSON.stringify({
          v: 1,
          at: k.at,
          state: k.state,
          balloon: k.balloon,
          stall: k.stall,
        }),
      );
    } catch {
      /* No storage, or it is full: memory still works this session. */
    }
  }, 400);
}
/** Fetch the farm in the background, once, when nothing is kept. */
export function prefetchFarm(
  owner: string,
  load: () => Promise<FarmState>,
): void {
  if (tried.has(owner) || keptFor(owner)?.state) return;
  tried.add(owner);
  load()
    .then((state) => {
      // The farm may have opened meanwhile and kept a newer state.
      if (!keptFor(owner)?.state) keep(owner, { state });
    })
    .catch(() => {});
}
/** Forget every kept farm (logging out). */
export function forgetFarms(): void {
  ready = null;
  tried.clear();
  clearTimeout(saveTimer);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORE)) localStorage.removeItem(key);
    }
  } catch {
    /* No storage. */
  }
}
/** The kept farm for this owner, its clock moved on to now. */
export function readyFor(owner: string | undefined): FarmState | undefined {
  const k = keptFor(owner);
  if (!k?.state) return undefined;
  return {
    ...k.state,
    now: new Date(Date.parse(k.state.now) + (Date.now() - k.at)).toISOString(),
  };
}
