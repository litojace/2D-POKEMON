/**
 * The Spire in battle (client): the harmless violet rings where Echoes are
 * about to appear, the HUD line ("Floor 7 · Wave 2/3 · 2 Echoes") and the
 * callout. The overlay cards (briefing, blessings, results) are in
 * spire-ui.ts.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import { CHARACTERS } from "@arena/shared";
import {
  SPIRE_ELITE_MECHANICS,
  spireBorrowed,
  SPIRE_FLOORS,
  SPIRE_PARTY,
  spireWaves,
} from "../../../packages/shared/src/spire";
import { ECHO_SKILL_COLOR } from "./spire-art";

/** A ring where an Echo is about to step out (harmless: a heads-up). */
export function drawSpireCourt(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced = false,
) {
  const s = state.raid?.spire;
  if (!s) return;
  for (const spawn of s.spawns) {
    const left = Math.max(0, spawn.at - state.time);
    const progress = Math.max(
      0,
      Math.min(1, 1 - left / SPIRE_PARTY.materialise),
    );
    const pulse = reduced ? 1 : 0.8 + Math.sin(state.time * 10) * 0.2;
    g.fillStyle(ECHO_SKILL_COLOR, 0.12 * pulse).fillEllipse(
      spawn.x,
      spawn.y + 18,
      96,
      40,
    );
    g.lineStyle(3, ECHO_SKILL_COLOR, 0.85).strokeEllipse(
      spawn.x,
      spawn.y + 18,
      96,
      40,
    );
    // It fills as the Echo takes shape.
    g.lineStyle(4, 0xe6dcff, 0.9)
      .beginPath()
      .arc(
        spawn.x,
        spawn.y - 46,
        14,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2,
        false,
      )
      .strokePath();
    g.fillStyle(CHARACTERS[spawn.character].color, 0.9).fillCircle(
      spawn.x,
      spawn.y - 46,
      6,
    );
  }
}

/** "Floor 7 · Wave 2/3 · 2 Echoes" (the elite: its name). */
export function spireHudLine(state: Snapshot) {
  const s = state.raid?.spire;
  if (!s) return "";
  if (s.kind === "elite") return `Floor ${s.floor} · Elite`;
  const echoes = s.echoesLeft;
  return `Floor ${s.floor} · Wave ${Math.max(1, s.wave)}/${s.waves} · ${echoes} ${echoes === 1 ? "Echo" : "Echoes"}`;
}
/** "Wave 2/3": what the floor bar on a wave floor counts. */
export function spireWaveLabel(state: Snapshot) {
  const s = state.raid?.spire;
  if (!s || !s.waves) return "";
  return `Wave ${Math.min(s.waves, Math.max(1, s.wave))}/${s.waves}`;
}
/**
 * Share of the floor beaten: each wave is an equal slice of the bar, filled
 * as its Echoes fall (waves before this one, and this one's fallen). Full
 * only when the floor is cleared: the last Echo of the last wave fell.
 */
export function spireFloorProgress(state: Snapshot) {
  const s = state.raid?.spire;
  if (!s || !s.waves) return 0;
  if (s.clearedAt !== undefined) return 100;
  // The floor's waves as the server spawns them (a big party has one more).
  const waves = spireWaves(s.floor, Math.max(1, state.raid?.partySize ?? 1));
  const size = Math.max(1, waves[Math.max(0, s.wave - 1)]?.length ?? 1);
  const fallen = Math.max(0, Math.min(1, 1 - s.echoesLeft / size));
  const done = Math.max(0, s.wave - 1) + fallen;
  // Never full before the server says the floor is cleared.
  return Math.max(0, Math.min(99.5, (done / s.waves) * 100));
}
/** The callout under the Spire's HUD. */
export function spireCue(state: Snapshot) {
  const r = state.raid!,
    s = r.spire!;
  if (s.clearedAt !== undefined)
    return s.kind === "boss"
      ? `${r.name} kneels! Floor ${s.floor} cleared.`
      : `Floor ${s.floor} cleared! The stairs open…`;
  if (state.phase !== "playing")
    return SPIRE_FLOORS[s.floor]?.name ?? "The Spire";
  if (s.kind === "elite") {
    if (r.staggerUntil > state.time) return "The captain reels — hit it now!";
    const m =
      SPIRE_ELITE_MECHANICS[
        SPIRE_FLOORS[s.floor]?.elite?.mechanic ?? "eruption"
      ];
    // (Polarity's countdown is its marks: they stay up after the warning.)
    if (
      r.warnings.some((w) => w.kind === m.attack) ||
      r.bubbles?.length ||
      r.polarities?.some((q) => !q.cancelled)
    )
      return m.cue;
    return `Echo Captain · it borrowed ${spireBorrowed(m)}`;
  }
  if (s.spawns.length) return "Echoes are taking shape — get ready!";
  if (!s.echoesLeft && s.wave < s.waves)
    return "Wave beaten — more are coming!";
  return r.message;
}
