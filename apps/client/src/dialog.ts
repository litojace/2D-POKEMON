/** Keep navigation and close controls outside long, touch-scrollable panels. */
export function setDialogContent(dialog: HTMLDialogElement, html: string) {
  dialog.innerHTML = `<button type="button" id="close-dialog" class="close" aria-label="Close dialog">×</button>${html}`;
  const raid = !!dialog.querySelector(".raid-hub");
  if (!raid && !dialog.querySelector(".shop")) return;
  const close = dialog.querySelector<HTMLButtonElement>("#close-dialog")!;
  const content = document.createElement("div");
  content.className = `dialog-content${raid ? " raid-dialog-content" : ""}`;
  for (const node of Array.from(dialog.childNodes))
    if (node !== close) content.append(node);
  const toolbar = document.createElement("div");
  toolbar.className = `dialog-toolbar${raid ? " raid-dialog-toolbar" : ""}`;
  const back = content.querySelector<HTMLButtonElement>("#raid-hub-back");
  if (back) toolbar.append(back);
  toolbar.append(close);
  dialog.replaceChildren(toolbar, content);
}
