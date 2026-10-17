/** Keep raid navigation outside the long, touch-scrollable panel. */
export function setDialogContent(dialog: HTMLDialogElement, html: string) {
  dialog.innerHTML = `<button type="button" id="close-dialog" class="close" aria-label="Close dialog">×</button>${html}`;
  if (!dialog.querySelector(".raid-hub")) return;
  const close = dialog.querySelector<HTMLButtonElement>("#close-dialog")!;
  const content = document.createElement("div");
  content.className = "raid-dialog-content";
  for (const node of Array.from(dialog.childNodes))
    if (node !== close) content.append(node);
  const toolbar = document.createElement("div");
  toolbar.className = "raid-dialog-toolbar";
  const back = content.querySelector<HTMLButtonElement>("#raid-hub-back");
  if (back) toolbar.append(back);
  toolbar.append(close);
  dialog.replaceChildren(toolbar, content);
}
