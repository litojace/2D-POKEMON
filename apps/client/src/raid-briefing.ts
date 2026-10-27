import type { CharacterId } from "@arena/shared";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { raidGuideScene } from "./raid-guide-art";
type Scene = Parameters<typeof raidGuideScene>[0];
interface Step {
  title: string;
  action: string;
  cue: string;
  scene: Scene;
}
export interface BossBriefing {
  goal: string;
  steps: [Step, Step, Step];
  avoid: string;
}
const step = (
  title: string,
  action: string,
  cue: string,
  scene: Scene,
): Step => ({ title, action, cue, scene });
/** Explain the encounter in the same order a new player actually performs it. */
export function bossBriefing(boss: RaidBossId, solo: boolean): BossBriefing {
  switch (boss) {
    case "grumblecrag":
      return {
        goal: "Make the boss crash into a pillar, then attack its exposed core.",
        steps: [
          step(
            "Bait a pillar crash",
            "Keep a stone pillar between you and the boss. Dodge sideways when the red charge path locks.",
            "The boss hits the pillar and breaks its armor.",
            "charge",
          ),
          step(
            "Hit the open core",
            "Use your strongest skills while CORE OPEN is shown.",
            "Save your ultimate for this opening.",
            "core",
          ),
          step(
            solo ? "Repeat the opening" : "Help each other survive",
            solo
              ? "When its armor returns, lead the next charge into another pillar."
              : "Stand beside a fallen teammate to revive them. Bait another pillar crash when armor returns.",
            "Repeat until the boss is defeated.",
            solo ? "charge" : "revive",
          ),
        ],
        avoid: "Step out of red attack zones. Jump over ground shockwaves.",
      };
    case "tidewyrm":
      return {
        goal: "Lure its dive onto an island so you can attack it out of the water.",
        steps: [
          step(
            "Lead the ripple onto land",
            "When the dive ripple follows you, move onto an island. Step off before it lands.",
            "The boss lands on the island instead of in water.",
            "strand",
          ),
          step(
            "Attack while it is stranded",
            "Use your strongest skills while the boss is stuck on land.",
            "Move away again when it returns to the water.",
            "opening",
          ),
          step(
            "Get to land for High Tide",
            solo
              ? "Move onto an island when High Tide starts. The flooded floor hurts."
              : "Move onto islands when High Tide starts. Share the available space.",
            solo
              ? "Stay above the rising water."
              : "No more than two raiders on one island.",
            "tide",
          ),
        ],
        avoid: solo
          ? "Jump over waves. Trapped in a bubble? Keep tapping basic attack to escape."
          : "Jump over waves. Hit a trapped teammate’s bubble three times to free them.",
      };
    case "gloomshade":
      return {
        goal: "Keep the lanterns lit so you can find and hit the real boss.",
        steps: [
          step(
            "Light a dark lantern",
            "Hit an unlit lantern twice with basic attacks.",
            "A bright circle of light appears around it.",
            "lantern",
          ),
          step(
            "Look for the shadow",
            "Fight inside lantern light. Only the real boss casts a shadow.",
            "Attack the one with a shadow. Copies give you curses.",
            "shadow",
          ),
          step(
            "Cleanse your curses",
            solo
              ? "Stay in lantern light to remove curses. Relight lanterns when they go dark."
              : "Stay in lantern light to remove curses. Keep away from teammates while cursed.",
            "Your curse icons disappear as you recover.",
            "curse",
          ),
        ],
        avoid:
          "Move out of claw paths and shadow hands. Three curses make you Haunted.",
      };
    case "somnara":
      return {
        goal: "Read the rune sequence, then walk onto the matching pads in order.",
        steps: [
          step(
            "Read the dream",
            solo
              ? "You are the Dreamer. Read the rune symbols shown above the arena."
              : "The marked Dreamer sees the sequence. They tap the rune bar to share its symbols.",
            "Follow the symbols, not the pads’ positions.",
            "dream",
          ),
          step(
            "Step on the matching pads",
            "Walk onto a pad for the first rune, then the next one. Follow the shown order.",
            "Each correct step advances the sequence.",
            "runes",
          ),
          step(
            "Attack during the opening",
            "Complete the sequence, then use your strongest skills while Somnara is exposed.",
            "Repeat when a new dream sequence appears.",
            "opening",
          ),
        ],
        avoid:
          "Jump over rings, pop dream bubbles, and follow the moving Quiet Zone.",
      };
    case "prismatail":
      return {
        goal: "Connect the skylight to the boss’s heart to break its shield.",
        steps: [
          step(
            "Pick up the light",
            "Stand near the glowing skylight on the left of the arena. Your fighter carries its light onward.",
            "A gold beam connects to you when you are close enough.",
            "relay",
          ),
          step(
            "Point the mirrors onward",
            "Stand near a mirror. Use Turn mirror to point its arrow at the next post, then the heart.",
            "Build a chain: skylight → you → mirrors → heart.",
            "mirror",
          ),
          step(
            "Attack when the shield opens",
            "Use your strongest skills as soon as HEART OPEN appears.",
            "Reconnect the light when the shield returns.",
            "opening",
          ),
        ],
        avoid:
          "Fan: leave the wedge matching the crest’s colour and dot count. Glare: hold Look away until the flash ends.",
      };
    case "emberwing":
      return {
        goal: "Light all three braziers at the same time to bring Emberwing down.",
        steps: [
          step(
            "Stand on a brazier",
            "Stay inside a brazier’s circle for 1.5 seconds.",
            "Move to the next brazier when this one lights.",
            "braziers",
          ),
          step(
            "Keep all three burning",
            solo
              ? "Move quickly between braziers before the first fire goes out."
              : "Split up so all three braziers are burning at the same time.",
            "All three lit → Emberwing lands.",
            "ground-bird",
          ),
          step(
            "Attack the exposed heart",
            "Use your strongest skills while Emberwing is on the ground.",
            "When it takes off, light the braziers again.",
            "opening",
          ),
        ],
        avoid: solo
          ? "Dodge sideways out of dives. Jump over flame rings and avoid burning ground."
          : "Dodge sideways out of dives. Jump flame rings and keep marked explosions away from allies.",
      };
    case "storm-twins":
      return {
        goal: "Lower both health bars together, then defeat both before either revives.",
        steps: [
          step(
            "Balance both health bars",
            "Switch targets often. Tap Fizz or Crackle to choose who you attack.",
            "Avoid leaving one healthy while the other is nearly defeated.",
            "two-hearts",
          ),
          step(
            "Pair + with −",
            solo
              ? "When you get a sign, walk onto the floor pad with the opposite sign."
              : "When signs appear, meet a teammate with the opposite sign before the timer ends.",
            "Opposite signs cancel. Same signs do not.",
            "polarity-pair",
          ),
          step(
            "Finish the survivor quickly",
            "When one falls, switch to the other and finish before the revive timer ends.",
            "If the timer runs out, the fallen twin returns.",
            "twin-finish",
          ),
        ],
        avoid:
          "Keep clear of the lightning link. Move out of marked blast circles.",
      };
  }
}
export function raidBriefingGuide(
  boss: RaidBossId,
  character: CharacterId,
  solo: boolean,
) {
  const guide = bossBriefing(boss, solo);
  return `<section class="raid-guide-goal" aria-label="Your goal"><span>Your goal</span><p>${guide.goal}</p></section><ol class="raid-guide-steps" role="list">${guide.steps.map((s, i) => `<li><div class="raid-guide-step-heading"><span class="raid-guide-step-number" aria-hidden="true">${i + 1}</span><h3>${s.title}</h3></div>${raidGuideScene(s.scene, character, boss)}<p class="raid-guide-action">${s.action}</p><p class="raid-guide-cue">${s.cue}</p></li>`).join("")}</ol><aside class="raid-guide-safety"><b>Stay alive</b><p>${guide.avoid}</p></aside>`;
}
