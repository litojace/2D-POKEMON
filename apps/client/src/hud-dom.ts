/** Snapshot HUD updates preserve unchanged nodes/attributes. In particular,
 * resetting identical text at 15Hz causes avoidable layout/style work on phones. */
export function setHudText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}
export function setHudAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
export function setHudStyle(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value)
    element.style.setProperty(name, value);
}
