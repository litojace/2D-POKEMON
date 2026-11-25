/**
 * Phaser (about 1.4 MB of script) loads after the game's first screen, not
 * with it: running it took about half a second of a phone's start (measured
 * on an emulated iPhone at 4× CPU slowdown), and nothing before the first
 * battle or animated fighter needs it. The hub warms it while idle
 * (main.ts), so a battle starts as fast as before; a battle that comes
 * first waits for it (`ensureBattleRenderer`).
 *
 * Modules use `import type Phaser from "phaser"` for its types and this
 * module for the library itself.
 */
import type PhaserLib from "phaser";

/**
 * What only a battle draws with (battle-kit.ts: skill effects, bosses,
 * arenas, rigs) loads with Phaser, in its own file, for the same reason:
 * it was two fifths of the script the game starts with. `kit` is set
 * before `phaser()` answers, so code that runs once Phaser is here (a
 * scene, or behind `if (phaser())`) can use it; before that it is
 * undefined.
 */
export let kit: typeof import("./battle-kit");

let runtime: typeof PhaserLib | undefined;
let loading: Promise<typeof PhaserLib> | undefined;
const ready: ((lib: typeof PhaserLib) => void)[] = [];
const after: (() => void)[] = [];

/** Phaser, once it has loaded. */
export function phaser() {
  return runtime;
}

/** Load Phaser and the battle kit (once), then run what waits for them. */
export function loadPhaser(): Promise<typeof PhaserLib> {
  // Together: neither waits for the other to download.
  loading ??= Promise.all([import("phaser"), import("./battle-kit")]).then(
    ([module, battleKit]) => {
      const lib = (module.default ?? module) as typeof PhaserLib;
      kit = battleKit;
      for (const run of ready.splice(0)) run(lib);
      runtime = lib;
      for (const run of after.splice(0)) run();
      return lib;
    },
    (error: unknown) => {
      // Asked again later (another battle), try again.
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

/**
 * Run `adopt` with Phaser before anything else uses it: at once if it has
 * loaded, else as it arrives (before `loadPhaser` resolves).
 */
export function whenPhaser(adopt: (lib: typeof PhaserLib) => void) {
  if (runtime) adopt(runtime);
  else ready.push(adopt);
}

/**
 * Run `redo` once Phaser and the battle kit are usable (`phaser()` answers),
 * for what was skipped while they were on the way. Nothing runs if they have
 * already loaded.
 */
export function afterPhaser(redo: () => void) {
  if (!runtime) after.push(redo);
}
