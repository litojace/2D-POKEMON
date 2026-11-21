/**
 * The party's health in a raid or Spire fight (owner, 20 Nov 2026): each
 * ally's name over a plain bar, top left. On phones the follow camera often
 * leaves allies off screen, and then their nameplate's health with them.
 * Allies only: your own health is on your nameplate, and the camera follows
 * you. Health reads as on the nameplates: green, orange when low, and when
 * down, red, filling with the revive (screens/raid-party.css).
 *
 * The rows are written once per roster; a snapshot then only sets each
 * bar's fill and state, and only when it changed (no markup rebuilt, no
 * layout read, per CLAUDE.md "Keeping battles smooth").
 */
import { maxHealth, type Fighter, type Snapshot } from "@arena/shared";
import "./screens/raid-party.css";

/** At or below this share of health a bar turns orange. */
export const LOW_HEALTH = 0.3;

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

let roster = "";
let rows = -1;

export function paintRaidParty(state: Snapshot, me: Fighter) {
  let box = document.getElementById("raid-party");
  const r = state.raid!;
  const allies = state.players.filter(
    (p) => p.id !== me.id && !p.raidBoss && !p.echo && !p.out,
  );
  const show = state.phase === "playing" && allies.length > 0;
  if (!box) {
    if (!show) return;
    box = document.createElement("div");
    box.id = "raid-party";
    box.setAttribute("role", "list");
    box.setAttribute("aria-label", "Your team");
    document.getElementById("battle")!.append(box);
  }
  if (box.hidden === show) box.hidden = !show;
  // The quick-chat button steps below the list on phones (raid-party.css).
  const count = show ? allies.length : 0;
  if (count !== rows) {
    rows = count;
    document.body.classList.toggle("raid-party-open", count > 0);
    document.body.style.setProperty("--raid-party-rows", String(count));
  }
  if (!show) return;
  const key = allies.map((p) => `${p.id}:${p.name}`).join("|");
  if (key !== roster) {
    roster = key;
    box.innerHTML = allies
      .map(
        (p) =>
          `<div class="rp-ally" role="listitem" data-ally="${escape(p.id)}"><b>${escape(p.name)}</b><span class="rp-bar" aria-hidden="true"><i></i></span></div>`,
      )
      .join("");
  }
  for (const p of allies) {
    const row = box.querySelector<HTMLElement>(
      `[data-ally="${CSS.escape(p.id)}"]`,
    );
    if (!row) continue;
    const down = r.downed[p.id];
    const share = Math.max(
      0,
      Math.min(
        1,
        p.hp / maxHealth(p.character, state.mode, state.players.length),
      ),
    );
    const fill = down ? down.progress : share;
    const look = down ? "down" : share <= LOW_HEALTH ? "low" : "ok";
    const fillText = fill.toFixed(3);
    if (row.dataset.state !== look) row.dataset.state = look;
    if (row.dataset.fill !== fillText) {
      row.dataset.fill = fillText;
      row.style.setProperty("--fill", fillText);
    }
    const label = down
      ? `${p.name}: down, ${Math.round(down.progress * 100)}% revived`
      : `${p.name}: ${Math.round(share * 100)}% health`;
    if (row.getAttribute("aria-label") !== label)
      row.setAttribute("aria-label", label);
  }
}
