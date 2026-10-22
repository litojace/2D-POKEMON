/** Use the court's vertical letterboxing for controls without reducing its size. */
export function fitDesktopBattleHud(battle: HTMLElement) {
  if (document.body.classList.contains("touch-mode") || battle.hidden) {
    battle.classList.remove("desktop-hud-outside");
    return;
  }
  const stage = battle.querySelector<HTMLElement>(".arena-stage");
  const frame = battle.querySelector<HTMLElement>(".arena-frame");
  const hud = battle.querySelector<HTMLElement>(
    document.body.classList.contains("battle-raid") ? "#raid-hud" : "#hud",
  );
  const skills = battle.querySelector<HTMLElement>("#abilities");
  if (!stage || !frame || !hud || !skills) return;

  battle.style.setProperty(
    "--desktop-arena-width",
    `${frame.getBoundingClientRect().width}px`,
  );
  // Measure the outside arrangement, including wrapped names and raid party bars.
  // The temporary class is resolved before painting, so resizing never flashes it.
  battle.classList.add("desktop-hud-outside");
  const hudHeight = Math.ceil(hud.getBoundingClientRect().height);
  const skillsHeight = Math.ceil(skills.getBoundingClientRect().height);
  const spare = stage.clientHeight - frame.getBoundingClientRect().height;
  const fits = hudHeight > 0 && spare >= hudHeight + skillsHeight + 20;
  battle.classList.toggle("desktop-hud-outside", fits);
  if (!fits) return;

  battle.style.setProperty("--desktop-outside-hud-height", `${hudHeight}px`);
  battle.style.setProperty(
    "--desktop-outside-skills-height",
    `${skillsHeight}px`,
  );
  // Keep equal breathing room beyond the two differently sized control rows.
  battle.style.setProperty(
    "--desktop-court-offset",
    `${(hudHeight - skillsHeight) / 2}px`,
  );
}
