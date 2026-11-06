/** Keep navigation and actions outside long, touch-scrollable menu content. */
export function setDialogContent(dialog: HTMLDialogElement, html: string) {
  // Build off-screen first, then swap the dialog's insides in one go.
  const staging = document.createElement("div");
  staging.innerHTML = `<button type="button" id="close-dialog" class="close" aria-label="Close dialog">×</button>${html}`;
  dialog.classList.add("framed-dialog", "card");
  const close = staging.querySelector<HTMLButtonElement>("#close-dialog")!;
  const content = document.createElement("div");
  content.className = "dialog-content";
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Menu content");
  for (const node of Array.from(staging.childNodes))
    if (node !== close) content.append(node);
  const toolbar = document.createElement("div");
  toolbar.className = "dialog-toolbar";
  const back = content.querySelector<HTMLButtonElement>(
    "#controls-back, #credits-back",
  );
  if (back) toolbar.append(back);
  toolbar.append(close);
  const tabs = content.querySelector<HTMLElement>(".admin-tabs");
  if (tabs) tabs.classList.add("dialog-tabs");
  dialog.classList.toggle("has-dialog-tabs", !!tabs);
  const inlineTabs = !!tabs && !back;
  dialog.classList.toggle("has-inline-tabs", inlineTabs);
  if (inlineTabs) toolbar.prepend(tabs!);
  else if (!tabs && !back) {
    const heading = content.querySelector<HTMLElement>("h2");
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
      ".fullscreen-actions",
      ".settings-actions",
      "#controls-reset",
      "#open-controls",
      "#profile-save > button",
      "#profile-title > button",
      "#profile-leaderboard",
      "#profile-raids",
      "#profile-adventure",
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
