/** Keep navigation and actions outside long, touch-scrollable menu content. */
export function setDialogContent(dialog: HTMLDialogElement, html: string) {
  dialog.innerHTML = `<button type="button" id="close-dialog" class="close" aria-label="Close dialog">×</button>${html}`;
  dialog.classList.add("framed-dialog", "card");
  const raid = !!dialog.querySelector(".raid-hub");
  const close = dialog.querySelector<HTMLButtonElement>("#close-dialog")!;
  const content = document.createElement("div");
  content.className = `dialog-content${raid ? " raid-dialog-content" : ""}`;
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Menu content");
  for (const node of Array.from(dialog.childNodes))
    if (node !== close) content.append(node);
  const toolbar = document.createElement("div");
  toolbar.className = `dialog-toolbar${raid ? " raid-dialog-toolbar" : ""}`;
  const back = content.querySelector<HTMLButtonElement>(
    "#controls-back, #leaderboard-back, #credits-back",
  );
  if (back) toolbar.append(back);
  toolbar.append(close);
  const tabs = content.querySelector<HTMLElement>(
    ".raid-hub-tabs, .shop-tabs, .admin-tabs, .adventure-tabs",
  );
  const raidRoster = content.querySelector<HTMLElement>(".raid-boss-roster");
  dialog.classList.toggle("has-raid-roster", !!raidRoster);
  if (tabs) tabs.classList.add("dialog-tabs");
  dialog.classList.toggle("has-dialog-tabs", !!tabs);
  const inlineTabs = !!tabs && !back;
  dialog.classList.toggle("has-inline-tabs", inlineTabs);
  if (inlineTabs) toolbar.prepend(tabs!);
  else if (!tabs && !back) {
    const heading = content.querySelector<HTMLElement>(".missions-head, h2");
    if (heading) {
      heading.classList.add("dialog-heading");
      toolbar.prepend(heading);
    }
  }
  const footer = document.createElement("div");
  footer.className = "dialog-footer";
  footer.setAttribute("role", "group");
  footer.setAttribute("aria-label", "Screen actions");
  // Item-specific controls stay beside their items. Screen actions stay available
  // without scrolling past instructions, settings or long form fields.
  const actions = content.querySelectorAll<HTMLElement>(
    [
      ".dialog-actions",
      ".adventure-actions",
      ".fullscreen-actions",
      ".settings-actions",
      ".missions-shop",
      ".raid-hub-actions",
      "#controls-reset",
      "#control-reset",
      "#open-controls",
      "#profile-save > button",
      "#profile-title > button",
      "#profile-leaderboard",
      "#profile-raids",
      "#profile-adventure",
      "#friend-add > button",
      "#report-form > button[type=submit]",
    ].join(","),
  );
  for (const action of Array.from(actions)) {
    // Native form ownership preserves validation, Enter and submit events even
    // though the action is now outside its scrolling form.
    if (action instanceof HTMLButtonElement && action.form?.id)
      action.setAttribute("form", action.form.id);
    footer.append(action);
  }
  dialog.classList.toggle("has-dialog-footer", footer.childElementCount > 0);
  dialog.replaceChildren(
    toolbar,
    ...(tabs && !inlineTabs ? [tabs] : []),
    ...(raidRoster ? [raidRoster] : []),
    content,
    ...(footer.childElementCount ? [footer] : []),
  );
}

/** Includes form-associated buttons in the fixed action area. */
export function formSubmitButton(form: HTMLFormElement) {
  return Array.from(form.elements).find(
    (element): element is HTMLButtonElement =>
      element instanceof HTMLButtonElement && element.type === "submit",
  )!;
}
