/** Isolated real controls for browser event-lifecycle regression checks. */
import { TouchControls } from "../../../apps/client/src/touch-controls";
export function touchRecovery() {
  const root = document.createElement("div");
  root.id = "mobile-controls";
  document.body.append(root);
  const w = window as any;
  w.__allowed = true;
  w.__fired = [];
  w.__resets = 0;
  const controls = new TouchControls(
    root,
    () => w.__allowed && controls.focused,
    (a) => w.__fired.push(a),
    () => {},
    () => w.__resets++,
    true,
  );
  controls.update(
    true,
    ["Static Lance", "Ball Lightning", "Storm Grid", "Overcharge"],
    [0, 0, 0, 0],
    0,
    0,
  );
  w.__touch = controls;
  return controls;
}

export async function prismRecovery() {
  const { createRaidArena } =
    await import("../../../apps/server/src/raid-bosses");
  const { renderPrismatailControls, prismatailAim } =
    await import("../../../apps/client/src/prismatail-controls");
  const arena = createRaidArena("TOUCH", "prismatail");
  arena.add("hero", "Hero");
  arena.start();
  arena.phase = "playing";
  const snapshot = arena.snapshot(),
    me = snapshot.players.find((p) => !p.raidBoss)!;
  const frame = document.createElement("div");
  document.body.append(frame);
  renderPrismatailControls(snapshot, me, frame);
  (window as any).__lookingAway = () => !!prismatailAim(snapshot, me);
}
