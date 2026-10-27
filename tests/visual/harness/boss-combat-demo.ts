/** Local capture fixture: real server combat, presentation only, no accounts or rewards. */
import { createRaidArena } from "../../../apps/server/src/raid-bosses";
import {
  packSnapshot,
  type RaidBossId,
  type RaidAttack,
} from "../../../packages/shared/src/index";
export function createBossCombatDemo(
  id: RaidBossId,
  publish = true,
  raidersAttack = true,
) {
  const arena = createRaidArena("RAID42", id);
  arena.add("me", "Tester", "voltkit");
  arena.add("p2", "Kai", "auralynx");
  arena.configure(1, false);
  arena.start();
  arena.phase = "playing";
  arena.raid.gilded = false;
  const local = arena as any;
  if (id === "emberwing") local.takeoff();
  local.nextAttack = 1e6;
  for (const hero of arena.heroes()) hero.hp = hero.maxHp = 10000;
  const w = window as any;
  let seq = 0;
  let directed: [number, number] | undefined;
  const emit = () => {
    const snapshot = arena.snapshot();
    if (publish) {
      w.__snap = packSnapshot(snapshot);
      w.__push?.();
    }
    return snapshot;
  };
  return {
    arena,
    snapshot: emit,
    face(view: "front" | "back" | "left" | "right") {
      directed = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] }[
        view
      ] as [number, number];
      const boss = arena.boss()!,
        hero = arena.heroes()[0];
      hero.x = boss.x + directed[0] * 230;
      hero.y = boss.y + directed[1] * 230;
      boss.angle = Math.atan2(directed[1], directed[0]);
      return emit();
    },
    cast(kind: RaidAttack) {
      local.startAttack(kind, arena.heroes()[0]);
      return emit();
    },
    step(seconds: number) {
      const count = Math.max(1, Math.round(seconds * 60));
      for (let n = 0; n < count; n++) {
        for (const [i, hero] of arena.heroes().entries()) {
          const angle = arena.time * 0.35 + i * Math.PI,
            target =
              directed && i === 0
                ? {
                    x: arena.boss()!.x + directed[0] * 230,
                    y: arena.boss()!.y + directed[1] * 230,
                  }
                : {
                    x: 800 + Math.cos(angle) * 280,
                    y: 450 + Math.sin(angle) * 190,
                  };
          const dx = target.x - hero.x,
            dy = target.y - hero.y,
            length = Math.hypot(dx, dy) || 1,
            boss = arena.boss()!;
          arena.submit(hero, {
            seq: ++seq,
            dx: dx / length,
            dy: dy / length,
            aimX: boss.x,
            aimY: boss.y,
            basic: raidersAttack,
            skill: -1,
            dash: false,
            jump: false,
          });
        }
        arena.tick(seconds / count);
        local.nextAttack = 1e6;
      }
      return emit();
    },
  };
}
