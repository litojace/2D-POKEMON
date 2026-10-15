const labels = ["Learn the mountain", "Falling debris", "Closing arena"];
export function raidDifficulty(peril: number, disabled: boolean) {
  return `<label class="raid-peril-label" id="raid-peril-label" for="raid-peril-trigger">Difficulty</label><div class="raid-difficulty-picker"><input id="raid-peril" type="hidden" value="${peril}"><button type="button" id="raid-peril-trigger" class="raid-peril-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="raid-peril-options" aria-labelledby="raid-peril-label raid-peril-current" ${disabled ? "disabled" : ""}><span id="raid-peril-current">Peril ${peril} · ${labels[peril - 1]}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button><div id="raid-peril-options" class="raid-peril-options" role="listbox" aria-label="Difficulty" hidden>${labels.map((label, i) => `<button type="button" role="option" aria-selected="${peril === i + 1}" data-peril="${i + 1}" tabindex="-1"><span class="raid-peril-number" aria-hidden="true">${i + 1}</span><span><b>Peril ${i + 1}</b><small>${label}</small></span><span class="raid-peril-check" aria-hidden="true">${peril === i + 1 ? "✓" : ""}</span></button>`).join("")}</div></div>`;
}

export function wireRaidDifficulty(root: ParentNode = document) {
  const trigger = root.querySelector<HTMLButtonElement>("#raid-peril-trigger");
  const list = root.querySelector<HTMLElement>("#raid-peril-options");
  const input = root.querySelector<HTMLInputElement>("#raid-peril");
  if (!trigger || !list || !input) return;
  const options = Array.from(
    list.querySelectorAll<HTMLButtonElement>("[data-peril]"),
  );
  const close = (focus = false) => {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focus) trigger.focus();
  };
  const open = () => {
    if (trigger.disabled) return;
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    (
      options.find((b) => b.dataset.peril === input.value) ?? options[0]
    ).focus();
  };
  trigger.onclick = () => (list.hidden ? open() : close());
  trigger.onkeydown = (e) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      open();
      if (e.key === "Home") options[0].focus();
      if (e.key === "End") options.at(-1)!.focus();
    } else if (e.key === "Escape") close();
  };
  options.forEach((button, index) => {
    button.onclick = () => {
      input.value = button.dataset.peril!;
      options.forEach((b) => {
        const selected = b === button;
        b.setAttribute("aria-selected", String(selected));
        b.querySelector(".raid-peril-check")!.textContent = selected ? "✓" : "";
      });
      root.querySelector("#raid-peril-current")!.textContent =
        `Peril ${input.value} · ${labels[Number(input.value) - 1]}`;
      close(true);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    button.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (e.key === "Tab") close();
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? options.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : options.length - 1)) %
                options.length;
        options[next].focus();
      }
    };
  });
  trigger.parentElement!.addEventListener("focusout", (e) => {
    if (!trigger.parentElement!.contains(e.relatedTarget as Node | null))
      close();
  });
}
