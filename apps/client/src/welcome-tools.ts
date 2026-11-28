import { menuIcon } from "./menu-icons";

/** The front door's disclosure owns its listeners, including across rerenders. */
export function welcomeTools(navClass: string, buttons: string): string {
  const nav = `<nav class="${navClass}" id="welcome-tools-actions" aria-label="Quick options">${buttons}</nav>`;
  // The old look stays intact while its visual specs move to Poster.
  if (document.documentElement.dataset.ui !== "poster") return nav;
  if (!customElements.get("welcome-tools")) {
    customElements.define(
      "welcome-tools",
      class extends HTMLElement {
        private listeners?: AbortController;

        connectedCallback() {
          this.listeners?.abort();
          this.listeners = new AbortController();
          const { signal } = this.listeners;
          const trigger = this.querySelector<HTMLButtonElement>(
            ".quick-menu-trigger",
          )!;
          const close = (focus = false) => {
            this.dataset.open = "false";
            trigger.setAttribute("aria-expanded", "false");
            if (focus) trigger.focus();
          };
          this.addEventListener(
            "click",
            (event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              if (target.closest(".quick-menu-trigger")) {
                const open = this.dataset.open !== "true";
                this.dataset.open = String(open);
                trigger.setAttribute("aria-expanded", String(open));
              }
            },
            { signal },
          );
          // Close before the existing action opens its dialog; focus returns
          // to the disclosure rather than an item that has just been hidden.
          this.addEventListener(
            "click",
            (event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("[data-gate-quick]")
              )
                close(true);
            },
            { capture: true, signal },
          );
          const gate = this.closest(".welcome-gate");
          gate?.addEventListener(
            "click",
            (event) => {
              if (
                this.dataset.open !== "true" ||
                this.contains(event.target as Node)
              )
                return;
              close();
              // Dismissing a menu must not also press the full-screen Start.
              event.preventDefault();
              event.stopPropagation();
            },
            { capture: true, signal },
          );
          gate?.addEventListener(
            "keydown",
            (event) => {
              if (
                (event as KeyboardEvent).key !== "Escape" ||
                this.dataset.open !== "true"
              )
                return;
              close(true);
              event.preventDefault();
              event.stopPropagation();
            },
            { signal },
          );
        }

        disconnectedCallback() {
          this.listeners?.abort();
        }
      },
    );
  }
  return `<welcome-tools class="quick-menu-shell" data-open="false"><button type="button" class="quick-menu-trigger" aria-expanded="false" aria-controls="welcome-tools-actions">${menuIcon("settings")}<span>MENU</span></button>${nav}</welcome-tools>`;
}
