import { iconLabel } from "./menu-icons";
import {
  ACTIONS,
  DEFAULT_PREFS,
  bind,
  bindable,
  codeLabel,
  controlPrefs,
  setControlPrefs,
  type Action,
  type CastMode,
} from "./controls";
import { PAD_LABELS, type PadAction } from "./gamepad";

/**
 * Settings → Controls: casting style, aim assist, key bindings and the
 * controller map. Click a binding box, then press a key (or click the box
 * again with a mouse button). Delete/Backspace clears, Esc cancels.
 */
export interface ControlsScreenOptions {
  /** Puts markup into the (already open or newly opened) settings dialog. */
  open(html: string): void;
  box: HTMLDialogElement;
  onBack(): void;
  padConnected: boolean;
}
type Capture = { action: Action; slot: 0 | 1; button: HTMLButtonElement };
let capturing: Capture | undefined;
let cleanupScreen: (() => void) | undefined;
/** True while a binding box waits for a key (game input stays off). */
export const controlsCapturing = () => !!capturing;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const actionName = (id: Action) => ACTIONS.find((a) => a.id === id)!.label;
const CAST_CHOICES: [CastMode, string, string][] = [
  [
    "preview",
    "Aim preview",
    "Hold a skill key to see where it lands; let go to cast. A quick tap casts right away.",
  ],
  ["instant", "Instant", "Cast the moment you press the key."],
];

export function controlsScreenHTML(padConnected: boolean) {
  const prefs = controlPrefs();
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  const rows = groups
    .map(
      (group) =>
        `<section class="binding-section" aria-label="${group} keys"><div class="binding-group">${group}</div><div class="binding-row binding-head"><span>Action</span><span>Main</span><span>Backup</span></div>` +
        ACTIONS.filter((a) => a.group === group)
          .map(
            ({ id, label }) =>
              `<div class="binding-row"><span>${label}</span>${([0, 1] as const)
                .map(
                  (slot) =>
                    `<button type="button" class="binding" data-action="${id}" data-slot="${slot}" aria-label="${label}, ${slot ? "backup" : "main"} key">${esc(codeLabel(prefs.bindings[id][slot]))}</button>`,
                )
                .join("")}</div>`,
          )
          .join("") + "</section>",
    )
    .join("");
  const cast = CAST_CHOICES.map(
    ([value, title, hint]) =>
      `<label class="choice"><input type="radio" name="cast" value="${value}"${prefs.cast === value ? " checked" : ""}><span><b>${title}</b><small>${hint}</small></span></label>`,
  ).join("");
  const pad = (Object.entries(PAD_LABELS) as [PadAction, string][])
    .map(
      ([action, button]) =>
        `<span><kbd>${button}</kbd>${action === "menu" ? "Menu" : actionName(action)}</span>`,
    )
    .join("");
  return (
    `<div class="eyebrow">Controls</div><h2>Make it yours.</h2>` +
    `<div class="controls-layout"><div class="controls-preferences"><fieldset class="cast-mode"><legend>Skill casting</legend>${cast}</fieldset>` +
    `<label class="choice assist"><input type="checkbox" id="aim-assist"${prefs.aimAssist ? " checked" : ""}><span><b>Aim assist (mouse)</b><small>Basic attacks snap to an opponent close to your cursor. Skills always go exactly where you aim.</small></span></label>` +
    `</div><div class="controls-bindings"><div class="bindings" role="group" aria-label="Key bindings">${rows}</div>` +
    `<p class="binding-note" id="binding-note" role="status">Click a box, then press a key or click it with the mouse button you want. Delete clears it, Esc cancels.</p>` +
    `<button type="button" id="controls-reset" class="quiet">${iconLabel("again", "Reset to defaults")}</button>` +
    `</div><div class="pad-map"><b>Controller</b> <small id="pad-status">${padConnected ? "Connected" : "Plug in or pair a controller and press any button."}</small><div class="controls-list">${pad}<span><kbd>L-STICK</kbd>Move</span><span><kbd>R-STICK</kbd>Aim (centred: aims at the nearest opponent)</span></div></div></div>` +
    `<button type="button" id="controls-back" class="secondary">${iconLabel("back", "Back to settings")}</button>`
  );
}

export function showControlsScreen(options: ControlsScreenOptions) {
  cleanupScreen?.();
  const { box } = options;
  options.open(controlsScreenHTML(options.padConnected));
  const note = box.querySelector<HTMLElement>("#binding-note")!;
  const buttons = () =>
    box.querySelectorAll<HTMLButtonElement>("button.binding");
  const label = (button: HTMLButtonElement) =>
    codeLabel(
      controlPrefs().bindings[button.dataset.action as Action][
        Number(button.dataset.slot) as 0 | 1
      ],
    );
  const stop = () => {
    if (capturing) {
      capturing.button.classList.remove("listening");
      capturing.button.textContent = label(capturing.button);
    }
    capturing = undefined;
  };
  const assign = (code: string | null) => {
    if (!capturing) return;
    const { action, slot } = capturing;
    if (code && !bindable(code)) {
      note.textContent = `${codeLabel(code)} is reserved by the browser. Pick another key.`;
      return;
    }
    const result = bind(controlPrefs().bindings, action, slot, code);
    setControlPrefs({ ...controlPrefs(), bindings: result.bindings });
    const name = actionName(action);
    note.textContent = !code
      ? `${name}: ${slot ? "backup" : "main"} key cleared.`
      : result.displaced
        ? `${codeLabel(code)} is now ${name} (taken from ${actionName(result.displaced)}).`
        : `${codeLabel(code)} is now ${name}.`;
    stop();
    for (const button of Array.from(buttons()))
      button.textContent = label(button);
  };
  for (const button of Array.from(buttons())) {
    button.onclick = () => {
      if (capturing?.button === button) return;
      stop();
      capturing = {
        action: button.dataset.action as Action,
        slot: Number(button.dataset.slot) as 0 | 1,
        button,
      };
      button.classList.add("listening");
      button.textContent = "Press a key…";
    };
    // A second click on a listening box binds that mouse button.
    button.onmousedown = (e) => {
      if (capturing?.button !== button) return;
      e.preventDefault();
      assign(`Mouse${e.button}`);
    };
    button.oncontextmenu = (e) => e.preventDefault();
  }
  // Capture phase on window, so the game and the dialog never see the key.
  const onKey = (e: KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === "Escape") stop();
    else if (e.code === "Delete" || e.code === "Backspace") assign(null);
    else assign(e.code);
  };
  const onCancel = (e: Event) => {
    if (capturing) e.preventDefault(); // Esc cancels listening, not the dialog.
  };
  const cleanup = () => {
    stop();
    window.removeEventListener("keydown", onKey, true);
    box.removeEventListener("cancel", onCancel);
    box.removeEventListener("close", cleanup);
    if (cleanupScreen === cleanup) cleanupScreen = undefined;
  };
  cleanupScreen = cleanup;
  window.addEventListener("keydown", onKey, true);
  box.addEventListener("cancel", onCancel);
  box.addEventListener("close", cleanup);
  for (const radio of Array.from(
    box.querySelectorAll<HTMLInputElement>('input[name="cast"]'),
  ))
    radio.onchange = () =>
      setControlPrefs({ ...controlPrefs(), cast: radio.value as CastMode });
  box.querySelector<HTMLInputElement>("#aim-assist")!.onchange = (e) =>
    setControlPrefs({
      ...controlPrefs(),
      aimAssist: (e.target as HTMLInputElement).checked,
    });
  box.querySelector<HTMLButtonElement>("#controls-reset")!.onclick = () => {
    setControlPrefs({ ...DEFAULT_PREFS });
    showControlsScreen(options); // Re-renders and replaces this screen's listeners.
    box.querySelector("#binding-note")!.textContent =
      "Back to the default keys.";
  };
  box.querySelector<HTMLButtonElement>("#controls-back")!.onclick = () => {
    cleanup();
    options.onBack();
  };
}
