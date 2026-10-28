import { setHudAttribute, setHudStyle } from "./hud-dom";
import { iconLabel, menuIcon } from "./menu-icons";
import { lockLandscape } from "./orientation";
import { stadiumBands } from "./stadium";
import { abilityIcon } from "./ability-icons";
import {
  TouchInputState,
  mobileLayout,
  safeViewport,
  controlPreferences,
  DEFAULT_CONTROLS,
  type ControlPreferences,
  type TouchAction,
} from "./mobile-input";
export { joystickVector } from "./mobile-input";
type Actions = { basic: boolean; skill: number; dash: boolean; jump: boolean };
export class TouchControls {
  readonly input = new TouchInputState();
  enabled: boolean;
  readonly available: boolean;
  preferences: ControlPreferences;
  private root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private buttons: HTMLButtonElement[];
  private geometry = { x: 0, y: 0, radius: 1 };
  private resetActions: () => void;
  private captures = new Map<number, HTMLElement>();
  private gestureFocus = false;
  /** iOS standalone may report hasFocus=false after returning to a visible
   * page. A fresh trusted touch re-arms it; blur/hide always revoke it. */
  get focused() {
    return !document.hidden && (document.hasFocus() || this.gestureFocus);
  }
  get dx() {
    return this.input.dx;
  }
  get dy() {
    return this.input.dy;
  }
  get basic() {
    return this.input.basic;
  }
  constructor(
    root: HTMLElement,
    canPlay: () => boolean,
    fire: (action: Partial<Actions>) => void,
    notify: (text: string) => void,
    resetActions: () => void = () => {},
    preview = false,
  ) {
    this.root = root;
    this.resetActions = resetActions;
    let stored: unknown;
    try {
      stored = JSON.parse(localStorage.getItem("arena-controls") ?? "null");
    } catch {
      stored = null;
    }
    this.preferences = controlPreferences(stored);
    this.available = preview || matchMedia("(pointer:coarse)").matches;
    root.hidden = !this.available;
    this.enabled =
      this.available && localStorage.getItem("arena-touch") !== "off";
    root.innerHTML =
      '<div class="mobile-tools"><button id="touch-toggle" class="quiet"></button><button id="mobile-fullscreen" class="quiet">Enter fullscreen ⛶</button><button id="mobile-settings" class="quiet">Mobile controls ⚙</button><span class="touch-note">Aim follows opponent</span></div><div class="rotate-hint" role="status"><span class="rotate-phone" aria-hidden="true"></span><span>Turn your phone sideways for the full arena</span></div><div class="touch-pad"><div class="joystick-area"><div class="joystick" role="group" aria-label="Movement joystick"><span class="joystick-knob"></span></div></div><div class="touch-buttons">' +
      (["dash", "jump", "0", "1", "2", "3", "attack"] as TouchAction[])
        .map(
          (action) =>
            "<button " +
            (isNaN(Number(action))
              ? 'data-action="' + action + '"'
              : 'data-skill="' + action + '"') +
            ' class="' +
            (action === "attack"
              ? "touch-attack"
              : action === "3"
                ? "touch-ultimate"
                : !isNaN(Number(action))
                  ? "touch-skill"
                  : "") +
            '"></button>',
        )
        .join("") +
      "</div></div>";
    this.stick = root.querySelector(".joystick-area")!;
    this.knob = root.querySelector(".joystick-knob")!;
    this.buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".touch-buttons button"),
    );
    const toggle = root.querySelector<HTMLButtonElement>("#touch-toggle")!;
    const display = () => {
      root.classList.toggle("touch-enabled", this.enabled);
      toggle.textContent = this.enabled
        ? "Touch controls: ON"
        : "Touch controls: OFF";
      document.body.classList.toggle("touch-mode", this.enabled);
      this.resize();
    };
    toggle.onclick = () => {
      if (!this.available) return;
      this.enabled = !this.enabled;
      localStorage.setItem("arena-touch", this.enabled ? "on" : "off");
      this.reset();
      display();
    };
    display();
    const fullscreen =
      root.querySelector<HTMLButtonElement>("#mobile-fullscreen")!;
    fullscreen.setAttribute("aria-label", "Toggle fullscreen");
    fullscreen.title = "Toggle fullscreen";
    this.root
      .querySelector<HTMLButtonElement>("#mobile-settings")!
      .setAttribute("aria-label", "Mobile controls settings");
    this.root.querySelector<HTMLButtonElement>("#mobile-settings")!.title =
      "Mobile controls settings";
    fullscreen.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          await lockLandscape();
        } else
          notify(
            "Use Add to Home Screen for standalone play. This browser does not support fullscreen.",
          );
      } catch {
        notify(
          "Fullscreen is unavailable here. Touch controls still work in the browser.",
        );
      }
    };
    document.addEventListener("fullscreenchange", () => {
      fullscreen.textContent = document.fullscreenElement
        ? "Exit fullscreen ⛶"
        : "Enter fullscreen ⛶";
      this.resize();
    });
    window.addEventListener(
      "pointerdown",
      (event) => {
        // A new contact cannot belong to the old gesture, even when Safari
        // recycled its pointerId without delivering the previous pointerup.
        this.release(event.pointerId);
        if (event.pointerType === "touch" && event.isPrimary) this.reset(true);
        if (
          event.isTrusted &&
          event.pointerType === "touch" &&
          this.enabled &&
          this.root.contains(event.target as Node)
        )
          this.gestureFocus = true;
      },
      true,
    );
    this.stick.onpointerdown = (event) => {
      const previous = this.input.joystickPointer;
      if (previous !== null && !this.hasCapture(previous))
        this.release(previous);
      if (
        !this.enabled ||
        !canPlay() ||
        !this.input.startJoystick(event.pointerId)
      )
        return;
      event.preventDefault();
      const rect = this.stick.getBoundingClientRect();
      this.geometry = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: this.preferences.joystickSize
          ? Number.parseFloat(root.style.getPropertyValue("--joystick-size")) *
            0.32
          : 40,
      };
      this.capture(this.stick, event.pointerId);
      this.move(event);
    };
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== this.input.joystickPointer) return;
        if (!canPlay()) {
          this.reset();
          return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
          this.release(event.pointerId);
          return;
        }
        this.move(event);
      },
      true,
    );
    // Capture at the window, including releases over disabled skill buttons,
    // overlays and detached controls. Native capture is a convenience, not
    // the only route through which an owned finger can be released.
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      window.addEventListener(
        type,
        (event) => {
          const id = (event as PointerEvent).pointerId;
          // An old lost-capture event may arrive after this pointerId was
          // reclaimed by a new contact. Do not cancel the new capture.
          if (event.type === "lostpointercapture" && this.hasCapture(id))
            return;
          this.release(id);
        },
        true,
      );
    for (const type of ["touchend", "touchcancel"])
      window.addEventListener(
        type,
        (event) => {
          if (!(event as TouchEvent).touches.length) this.reset(true);
        },
        { capture: true, passive: true },
      );
    for (const button of this.buttons) {
      const action = (button.dataset.skill ??
        button.dataset.action) as TouchAction;
      button.onpointerdown = (event) => {
        if (
          !this.enabled ||
          !canPlay() ||
          button.disabled ||
          !this.input.press(event.pointerId, action)
        )
          return;
        event.preventDefault();
        this.capture(button, event.pointerId);
        this.paint();
        if (action === "attack") fire({ basic: true });
        else if (action === "dash") fire({ dash: true });
        else if (action === "jump") fire({ jump: true });
        else fire({ skill: Number(action) });
      };
    }
    window.addEventListener("blur", () => this.reset());
    window.addEventListener("pagehide", () => this.reset());
    document.addEventListener("visibilitychange", () => this.reset());
    let resizeFrame = 0;
    const resize = () => {
      this.reset();
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => this.resize());
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    screen.orientation?.addEventListener("change", resize);
    new ResizeObserver(resize).observe(root);
    this.update(
      false,
      ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
      [0, 0, 0, 0],
      0,
      0,
    );
  }
  private move(event: PointerEvent) {
    this.input.move(
      event.pointerId,
      event.clientX - this.geometry.x,
      event.clientY - this.geometry.y,
      this.geometry.radius,
    );
    this.knob.style.transform = `translate(${this.dx * this.geometry.radius}px,${this.dy * this.geometry.radius}px)`;
  }
  private paint() {
    this.knob.style.transform = `translate(${this.dx * this.geometry.radius}px,${this.dy * this.geometry.radius}px)`;
    for (const button of this.buttons) {
      const action = button.dataset.skill ?? button.dataset.action;
      button.classList.toggle(
        "pressed",
        [...this.input.pointers.values()].includes(action as TouchAction),
      );
    }
  }
  private hasCapture(id: number) {
    try {
      return !!this.captures.get(id)?.hasPointerCapture(id);
    } catch {
      return false;
    }
  }
  private capture(owner: HTMLElement, id: number) {
    this.captures.set(id, owner);
    try {
      owner.setPointerCapture(id);
    } catch {
      /* Global move/end listeners also cover unavailable native capture. */
    }
  }
  private release(id: number) {
    const owner = this.captures.get(id);
    if (
      !owner &&
      this.input.joystickPointer !== id &&
      !this.input.pointers.has(id)
    )
      return;
    this.captures.delete(id);
    this.input.release(id);
    try {
      if (owner?.hasPointerCapture(id)) owner.releasePointerCapture(id);
    } catch {
      /* The OS may already have cancelled this contact. */
    }
    this.paint();
  }
  reset(preserveFocus = false) {
    if (!preserveFocus) this.gestureFocus = false;
    if (
      this.captures.size ||
      this.input.joystickPointer !== null ||
      this.input.pointers.size ||
      this.input.dx ||
      this.input.dy
    ) {
      const owners = [...this.captures];
      this.captures.clear();
      this.input.reset();
      this.resetActions();
      this.paint();
      for (const [id, owner] of owners)
        try {
          if (owner.hasPointerCapture(id)) owner.releasePointerCapture(id);
        } catch {
          /* Already released by the browser. */
        }
    }
  }
  resize() {
    this.reset();
    const width = document.body.classList.contains("battle-active")
      ? (window.visualViewport?.width ?? innerWidth)
      : this.root.clientWidth || innerWidth;
    const height = window.visualViewport?.height ?? innerHeight;
    const safe = getComputedStyle(this.root);
    const insets = Object.fromEntries(
      ["top", "right", "bottom", "left"].map((dir) => [
        dir,
        parseFloat(safe.getPropertyValue("--safe-" + dir)) || 0,
      ]),
    ) as { top: number; right: number; bottom: number; left: number };
    const viewport = safeViewport(width, height, insets);
    const layout = mobileLayout(
      viewport.width,
      width > height ? Math.max(180, viewport.height - 64) : viewport.height,
      this.preferences,
    );
    this.root.style.setProperty("--joystick-size", layout.joystick + "px");
    document.body.style.setProperty(
      "--movement-gutter",
      layout.joystick + 32 + "px",
    );
    document.body.style.setProperty(
      "--combat-gutter",
      layout.width + 12 + "px",
    );
    const bands = stadiumBands(viewport.height);
    document.body.classList.toggle("compact-landscape", layout.compact);
    if (layout.compact)
      bands.bottom = Math.max(layout.height, layout.joystick + 20) + 70;
    document.body.style.setProperty("--stadium-top", bands.top + "px");
    document.body.style.setProperty("--stadium-bottom", bands.bottom + "px");
    this.root.style.setProperty(
      "--hud-opacity",
      String(this.preferences.opacity),
    );
    const cluster = this.root.querySelector<HTMLElement>(".touch-buttons")!;
    cluster.style.width = layout.width + "px";
    cluster.style.height = layout.height + "px";
    for (const target of layout.targets) {
      const button = this.buttons.find(
        (b) => (b.dataset.skill ?? b.dataset.action) === target.action,
      )!;
      Object.assign(button.style, {
        left: target.x - target.size / 2 + "px",
        top: target.y - target.size / 2 + "px",
        width: target.size + "px",
        height: target.size + "px",
      });
    }
  }
  setPreferences(next: unknown) {
    this.preferences = controlPreferences(next);
    localStorage.setItem("arena-controls", JSON.stringify(this.preferences));
    this.resize();
  }
  settingsHTML() {
    if (!this.available) return "";
    return (
      `<h3 id="prefs-touch">${menuIcon("install")}Touch controls</h3><p class="prefs-note">Fixed joystick · saved on this device.</p>` +
      (["joystickSize", "buttonSize", "opacity"] as const)
        .map((key) => {
          const value = this.preferences[key];
          const [min, max] =
            key === "opacity"
              ? [0.4, 1]
              : key === "buttonSize"
                ? [0.85, 1.2]
                : [0.8, 1.25];
          const label = {
            joystickSize: "Joystick size",
            buttonSize: "Combat button size",
            opacity: "Controls opacity",
          }[key];
          return `<label class="prefs-slider"><span class="prefs-slider-label">${label}</span><output for="control-${key}" data-pref-for="control-${key}">${Math.round(value * 100)}%</output><input type="range" id="control-${key}" min="${min}" max="${max}" step=".05" value="${value}"></label>`;
        })
        .join("") +
      `<button class="secondary" id="control-reset">${iconLabel("again", "Reset mobile layout")}</button>`
    );
  }
  bindSettings() {
    if (!this.available) return;
    for (const key of ["joystickSize", "buttonSize", "opacity"] as const) {
      const input = document.getElementById(
        "control-" + key,
      ) as HTMLInputElement;
      input.oninput = () =>
        this.setPreferences({
          ...this.preferences,
          [key]: Number(input.value),
        });
    }
    document.getElementById("control-reset")!.onclick = () => {
      this.setPreferences(DEFAULT_CONTROLS);
      for (const key of ["joystickSize", "buttonSize", "opacity"] as const)
        (document.getElementById("control-" + key) as HTMLInputElement).value =
          String(this.preferences[key]);
    };
  }
  update(
    active: boolean,
    names: string[],
    cooldowns: number[],
    dash: number,
    jump: number,
    durations: number[] = [8, 12, 15, 18],
    basic = { name: "Attack", left: 0, duration: 1 },
    /** Ultimate meter 0–100: the ultimate button fills instead of counting down. */
    ult = 100,
    /** EX skills: meter needed to arm one, and whether one is armed. */
    exCost = Infinity,
    exArmed = false,
  ) {
    if (!active) this.reset();
    for (const button of this.buttons) {
      const skill = button.dataset.skill;
      const action = button.dataset.action;
      const isUlt = skill === "3";
      const left = Math.max(
        0,
        isUlt
          ? 100 - ult // "left" is the meter still to fill
          : skill !== undefined
            ? (cooldowns[Number(skill)] ?? 0)
            : action === "dash"
              ? dash
              : action === "jump"
                ? jump
                : basic.left,
      );
      const name =
        skill !== undefined
          ? names[Number(skill)]
          : action === "attack"
            ? basic.name
            : action === "dash"
              ? "Dash"
              : "Jump";
      // Basic attacks have no cooldown; the server enforces the attack interval.
      // The ultimate button also arms an EX skill once the meter allows one.
      const exReady = isUlt && left > 0 && ult >= exCost;
      button.disabled =
        !active || (action !== "attack" && left > 0 && !exReady);
      if (button.dataset.iconName !== name) {
        button.innerHTML =
          abilityIcon(name) +
          '<span class="touch-key">' +
          // Touch has no keys: number the skills 1–4 (4 is the ultimate).
          (skill !== undefined
            ? Number(skill) + 1
            : action === "attack"
              ? "BASIC"
              : action === "dash"
                ? "DASH"
                : "JUMP") +
          '</span><span class="touch-cooldown"></span>';
        button.dataset.iconName = name;
        button.title = name;
      }
      const text =
        left <= 0
          ? isUlt
            ? "READY"
            : ""
          : isUlt
            ? exArmed
              ? "EX ✓"
              : exReady
                ? `EX ${Math.floor(ult)}%`
                : `${Math.floor(ult)}%`
            : left.toFixed(1);
      const label = button.querySelector(".touch-cooldown")!;
      if (label.textContent !== text) label.textContent = text;
      const duration = isUlt
        ? 100
        : skill !== undefined
          ? durations[Number(skill)]
          : action === "dash"
            ? 3
            : action === "jump"
              ? 2
              : basic.duration;
      setHudStyle(
        button,
        "--cooldown",
        Math.min(100, (100 * left) / duration) + "%",
      );
      button.classList.toggle("cooling", left > 0);
      const ready = isUlt && left <= 0;
      if (ready && !button.classList.contains("ult-ready")) {
        // The meter just filled: pop once.
        button.classList.add("ult-burst");
        setTimeout(() => button.classList.remove("ult-burst"), 650);
      }
      button.classList.toggle("ult-ready", ready);
      button.classList.toggle("ex-ready", exReady);
      button.classList.toggle(
        "ex-armed",
        exArmed && skill !== undefined && !isUlt,
      );
      setHudAttribute(
        button,
        "aria-label",
        left <= 0
          ? name + (isUlt ? " · ultimate ready" : "")
          : isUlt
            ? name + " · charging " + text
            : name + " · " + text + " seconds",
      );
    }
  }
}
