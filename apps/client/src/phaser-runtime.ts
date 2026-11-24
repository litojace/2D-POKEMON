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

let runtime: typeof PhaserLib | undefined;
let loading: Promise<typeof PhaserLib> | undefined;
const ready: ((lib: typeof PhaserLib) => void)[] = [];

/** Phaser, once it has loaded. */
export function phaser() {
  return runtime;
}

/** Load Phaser (once), then run what waits for it. */
export function loadPhaser(): Promise<typeof PhaserLib> {
  loading ??= import("phaser").then(
    (module) => {
      const lib = (module.default ?? module) as typeof PhaserLib;
      for (const run of ready.splice(0)) run(lib);
      runtime = lib;
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
