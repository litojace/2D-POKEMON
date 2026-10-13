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
    this.stick.onpointerdown = (event) => {
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
      this.stick.setPointerCapture(event.pointerId);
      this.move(event);
    };
    this.stick.onpointermove = (event) => {
      if (!canPlay()) {
        this.reset();
        return;
      }
      this.move(event);
    };
    const release = (event: PointerEvent) => {
      this.input.release(event.pointerId);
      this.paint();
    };
    this.stick.onpointerup = release;
    this.stick.onpointercancel = release;
    this.stick.onlostpointercapture = release;
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
        button.setPointerCapture(event.pointerId);
        this.paint();
        if (action === "attack") fire({ basic: true });
        else if (action === "dash") fire({ dash: true });
        else if (action === "jump") fire({ jump: true });
        else fire({ skill: Number(action) });
      };
      button.onpointerup = release;
      button.onpointercancel = release;
      button.onlostpointercapture = release;
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
  reset() {
    if (
      this.input.joystickPointer !== null ||
      this.input.pointers.size ||
      this.input.dx ||
      this.input.dy
    ) {
      this.input.reset();
      this.resetActions();
      this.paint();
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
      "<h3>Mobile Controls</h3><p>Fixed joystick · settings are saved on this device.</p>" +
      (["joystickSize", "buttonSize", "opacity"] as const)
        .map(
          (key) =>
            `<label>${{ joystickSize: "JOYSTICK SIZE", buttonSize: "COMBAT BUTTON SIZE", opacity: "HUD OPACITY" }[key]} <input type="range" id="control-${key}" min="${key === "opacity" ? 0.4 : key === "buttonSize" ? 0.85 : 0.8}" max="${key === "opacity" ? 1 : key === "buttonSize" ? 1.2 : 1.25}" step=".05" value="${this.preferences[key]}"></label>`,
        )
        .join("") +
      '<button class="secondary" id="control-reset">Reset mobile layout</button>'
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
  ) {
    if (!active) this.reset();
    for (const button of this.buttons) {
      const skill = button.dataset.skill;
      const action = button.dataset.action;
      const left = Math.max(
        0,
        skill !== undefined
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
      button.disabled = !active || (action !== "attack" && left > 0);
      if (button.dataset.iconName !== name) {
        button.innerHTML =
          abilityIcon(name) +
          '<span class="touch-key">' +
          (skill !== undefined
            ? Number(skill) === 3
              ? "R"
              : Number(skill) + 1
            : action === "attack"
              ? "BASIC"
              : action === "dash"
                ? "DASH"
                : "JUMP") +
          '</span><span class="touch-cooldown"></span>';
        button.dataset.iconName = name;
        button.title = name;
      }
      const text = left > 0 ? left.toFixed(1) : "";
      const label = button.querySelector(".touch-cooldown")!;
      if (label.textContent !== text) label.textContent = text;
      const duration =
        skill !== undefined
          ? durations[Number(skill)]
          : action === "dash"
            ? 3
            : action === "jump"
              ? 2
              : basic.duration;
      button.style.setProperty(
        "--cooldown",
        Math.min(100, (100 * left) / duration) + "%",
      );
      button.classList.toggle("cooling", left > 0);
      button.setAttribute(
        "aria-label",
        left > 0 ? name + " · " + text + " seconds" : name,
      );
    }
  }
}
