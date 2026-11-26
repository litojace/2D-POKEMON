import {
  setHudAttribute,
  setHudDisabled,
  setHudStyle,
  setHudText,
  sweepPercent,
} from "./hud-dom";
import { iconLabel, menuIcon } from "./menu-icons";
import { lockLandscape } from "./orientation";
import { stadiumBands } from "./stadium";
import { abilityIcon } from "./ability-icons";
import { rumble } from "./game-feel";
import type { AimKind } from "./touch-aim";
import {
  TouchInputState,
  controlExtent,
  mobileLayout,
  safeViewport,
  DEFAULT_CONTROLS,
  type ControlPreferences,
  type TouchAction,
} from "./mobile-input";
export { joystickVector } from "./mobile-input";
type Actions = { basic: boolean; skill: number; dash: boolean; jump: boolean };
/** The target button's crosshair. */
const AIM_ICON =
  '<svg class="touch-target-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
/** The cancel spot's cross (drag-to-aim). */
const CANCEL_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
/** How far (CSS px) a held skill finger moves before it aims by hand. */
export const AIM_DEAD_ZONE = 12;
/** A skill finger held to aim (touch-aim.ts). Client CSS px. */
interface AimGesture {
  slot: number;
  button: HTMLButtonElement;
  /** Where the finger came down, and where it is. */
  sx: number;
  sy: number;
  x: number;
  y: number;
  /** The button's size and the drag circle's radius. */
  size: number;
  radius: number;
  /** It has moved past the dead zone: it aims by hand. */
  manual: boolean;
  /** A finger (not a mouse or pen): a last touchend lifts it. */
  touch: boolean;
  /** Lifting now cancels: back at the middle, or over the cancel spot. */
  cancel: boolean;
  /** The cancel spot (the target button's place), measured once the drag starts. */
  spot?: { x: number; y: number; r: number };
}
/** What a touch on the left half may land on without starting the stick. */
const FLOAT_BLOCKERS =
  "button, a, input, select, textarea, label, summary, [role=button], dialog, .overlay-card, .practice-panel, #practice-controls, .mobile-tools, .touch-buttons, .header-menu, .ui-panel, .ui-modal";
export class TouchControls {
  readonly input = new TouchInputState();
  enabled: boolean;
  readonly available: boolean;
  preferences: ControlPreferences;
  private root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private buttons: HTMLButtonElement[];
  /**
   * Down in a raid: the stick still crawls toward an ally, the buttons do
   * nothing. Set before `update`, which then writes `disabled` once (main.ts
   * used to switch every button back off after each update, 30 times a
   * second).
   */
  downed = false;
  /** The target button (by Dash): steps through the enemies on screen. */
  private aim: HTMLButtonElement;
  /** Called on a tap of the target button (main.ts cycles the lock). */
  onTarget: () => void = () => {};
  /** Called once the controls are laid out (resize): main.ts measures them. */
  onLayout: () => void = () => {};
  private geometry = { x: 0, y: 0, radius: 1 };
  private resetActions: () => void;
  private canPlay: () => boolean;
  private fire: (
    action: Partial<Actions>,
    stamp: number,
    handled: number,
  ) => void;
  /**
   * How each skill slot (0–3) aims on a drag (touch-aim.ts): main.ts sets
   * it from the fighter's kit. Unknown slots fire on the press.
   */
  private aimKinds: AimKind[] = [];
  /** Skill fingers held to aim, by pointer. */
  private aiming = new Map<number, AimGesture>();
  /**
   * The last skill released after a drag: its direction (unit, screen),
   * how far into the circle (0–1) and when (performance.now). main.ts aims
   * the cast with it; null after a plain tap (the automatic aim).
   */
  drag: { slot: number; dx: number; dy: number; t: number; at: number } | null =
    null;
  private wheel!: HTMLElement;
  private wheelKnob!: HTMLElement;
  private cancelSpot!: HTMLElement;
  /** Each button's box in the cluster (CSS px, centre and size), from the last layout. */
  private boxes = new Map<string, { x: number; y: number; size: number }>();
  /** The buttons' circles on the screen, for setCovered; measured once per layout. */
  private covers?: {
    button: HTMLButtonElement;
    x: number;
    y: number;
    r: number;
  }[];
  /** Each skill's cooldown at the last update, to notice it coming back. */
  private lastLeft = new Map<HTMLButtonElement, number>();
  private wasActive = false;
  /** Ultimate meter still to fill (0 when ready): below full, a tap arms EX. */
  private ultLeft = 0;
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
    fire: (action: Partial<Actions>, stamp: number, handled: number) => void,
    notify: (text: string) => void,
    resetActions: () => void = () => {},
    preview = false,
  ) {
    this.root = root;
    this.resetActions = resetActions;
    this.canPlay = canPlay;
    this.fire = fire;
    // One layout for everyone: the joystick, button sizes and opacity were
    // player settings until 22 Nov 2026 and are no longer read (players set
    // them by mistake and couldn't find their way back). They shared the
    // "arena-controls" entry with key bindings (controls.ts), so that entry
    // stays.
    this.preferences = DEFAULT_CONTROLS;
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
      `<button type="button" class="touch-target" data-aim disabled aria-label="Target: no enemy on screen">${AIM_ICON}</button>` +
      '<div class="touch-aim-wheel" aria-hidden="true"><span></span></div>' +
      `<div class="touch-cancel" aria-hidden="true">${CANCEL_ICON}<small>CANCEL</small></div>` +
      "</div></div>";
    this.wheel = root.querySelector<HTMLElement>(".touch-aim-wheel")!;
    this.wheelKnob = this.wheel.querySelector<HTMLElement>("span")!;
    this.cancelSpot = root.querySelector<HTMLElement>(".touch-cancel")!;
    this.stick = root.querySelector(".joystick-area")!;
    this.knob = root.querySelector(".joystick-knob")!;
    this.buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        ".touch-buttons button:not([data-aim])",
      ),
    );
    this.aim = root.querySelector<HTMLButtonElement>("[data-aim]")!;
    // A tap: the next enemy on screen, then none (target-lock.ts). Not held,
    // and never a stick touch.
    this.aim.onpointerdown = (event) => {
      event.stopPropagation();
      if (!this.enabled || !canPlay() || this.aim.disabled) return;
      event.preventDefault();
      this.aim.classList.add("pressed");
      setTimeout(() => this.aim.classList.remove("pressed"), 120);
      this.onTarget();
    };
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
    /** Start the joystick: centred on the stick, or (`at`, floating) on
     * the touch, the stick drawn there until the finger lifts. */
    const startStick = (event: PointerEvent, at?: { x: number; y: number }) => {
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
      const home = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this.geometry = {
        ...(at ?? home),
        radius: this.preferences.joystickSize
          ? Number.parseFloat(root.style.getPropertyValue("--joystick-size")) *
            0.32
          : 40,
      };
      if (at) this.float(at.x - home.x, at.y - home.y);
      // Faint while no thumb is on it (touch-aim.ts, owner 26 Nov 2026).
      this.stick.classList.add("is-held");
      this.capture(this.stick, event.pointerId);
      this.move(event);
    };
    this.stick.onpointerdown = (event) => startStick(event);
    // A floating stick: a touch anywhere free on the left half of the screen
    // starts it right under the finger (owner, 5 Nov 2026), so moving never
    // waits for a thumb to find the stick. Buttons, menus, panels and the
    // stick itself answer their own touches.
    window.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || !this.enabled) return;
      if (event.clientX >= window.innerWidth / 2) return;
      const target = event.target as Element | null;
      if (
        !target ||
        this.stick.contains(target) ||
        target.closest(FLOAT_BLOCKERS) ||
        !document.body.classList.contains("battle-active")
      )
        return;
      startStick(event, { x: event.clientX, y: event.clientY });
    });
    window.addEventListener(
      "pointermove",
      (event) => {
        const gesture = this.aiming.get(event.pointerId);
        if (gesture) {
          this.moveAim(gesture, event.clientX, event.clientY);
          return;
        }
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
          // Only a finger lifted casts a held (aimed) skill; a cancelled
          // contact or a lost capture lets it go.
          this.release(id, event.type === "pointerup", event.timeStamp);
        },
        true,
      );
    for (const type of ["touchend", "touchcancel"])
      window.addEventListener(
        type,
        (event) => {
          if ((event as TouchEvent).touches.length) return;
          // Every finger is up. A skill still held to aim was lifted too,
          // if this came before its pointerup (WebKit's order may differ
          // from Chromium's): cast it as that lift would. A cancelled touch
          // casts nothing.
          if (type === "touchend")
            for (const [id, held] of [...this.aiming])
              if (held.touch) this.release(id, true, event.timeStamp);
          this.reset(true);
        },
        { capture: true, passive: true },
      );
    for (const button of this.buttons) {
      const action = (button.dataset.skill ??
        button.dataset.action) as TouchAction;
      button.onpointerdown = (event) => {
        const handled = performance.now();
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
        if (action === "attack")
          fire({ basic: true }, event.timeStamp, handled);
        else if (action === "dash")
          fire({ dash: true }, event.timeStamp, handled);
        else if (action === "jump")
          fire({ jump: true }, event.timeStamp, handled);
        else if (this.aimsOnDrag(Number(action)))
          // Held: the guide shows on the court, and it casts when the
          // finger lifts (where it was dragged, or the automatic aim).
          this.startAim(event, Number(action), button);
        else {
          this.drag = null;
          fire({ skill: Number(action) }, event.timeStamp, handled);
        }
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
    this.knob.style.transform = `translate(${this.input.knobX}px,${this.input.knobY}px)`;
  }
  /** Draw the stick `dx`,`dy` from its resting place (0, 0: back home). */
  private float(dx: number, dy: number) {
    const on = !!(dx || dy);
    this.stick.classList.toggle("is-floating", on);
    this.stick.style.transform = on ? `translate(${dx}px, ${dy}px)` : "";
  }
  private paint() {
    this.knob.style.transform = `translate(${this.input.knobX}px,${this.input.knobY}px)`;
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
  private release(id: number, commit = false, stamp?: number) {
    const owner = this.captures.get(id);
    if (
      !owner &&
      this.input.joystickPointer !== id &&
      !this.input.pointers.has(id)
    )
      return;
    this.captures.delete(id);
    if (id === this.input.joystickPointer) {
      this.float(0, 0);
      this.stick.classList.remove("is-held");
    }
    this.input.release(id);
    const gesture = this.aiming.get(id);
    if (gesture) {
      this.aiming.delete(id);
      this.endAim(gesture, commit, stamp);
    }
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
      this.float(0, 0);
      this.stick.classList.remove("is-held");
      // A held skill is let go, never cast. A cast already released keeps
      // its aim (`drag`): main.ts lets it run out.
      this.aiming.clear();
      this.hideAim();
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
    // Size the controls from the screen the game fills, not the visual
    // viewport alone: that shrinks while the on-screen keyboard is up or the
    // page is zoomed, and a battle that began then kept tiny controls (seen
    // in raids: joystick and buttons at their minimum on a large phone).
    const width = document.body.classList.contains("battle-active")
      ? controlExtent(window.visualViewport?.width, innerWidth)
      : this.root.clientWidth || innerWidth;
    const height = controlExtent(window.visualViewport?.height, innerHeight);
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
    // How high the controls reach: the cluster, and the target button where
    // it rises over the cluster's top. Panels placed over the controls (a
    // raid boss's own buttons) stand above both.
    const rise = Math.max(0, layout.aim.size / 2 - layout.aim.y);
    document.body.style.setProperty(
      "--combat-cluster-height",
      layout.height + rise + "px",
    );
    let context = cluster.querySelector<HTMLElement>(".touch-context");
    if (!context) {
      context = document.createElement("div");
      context.className = "touch-context";
      cluster.append(context);
    }
    Object.assign(context.style, {
      left: layout.context.x - layout.context.width / 2 + "px",
      top: layout.context.y - layout.context.height / 2 + "px",
      width: layout.context.width + "px",
      height: layout.context.height + "px",
    });
    context.style.setProperty("--ctx-size", layout.context.size + "px");
    Object.assign(this.aim.style, {
      left: layout.aim.x - layout.aim.size / 2 + "px",
      top: layout.aim.y - layout.aim.size / 2 + "px",
      width: layout.aim.size + "px",
      height: layout.aim.size + "px",
    });
    // A dragged skill's cancel spot takes the target button's place.
    Object.assign(this.cancelSpot.style, {
      left: layout.aim.x - layout.aim.size / 2 + "px",
      top: layout.aim.y - layout.aim.size / 2 + "px",
      width: layout.aim.size + "px",
      height: layout.aim.size + "px",
    });
    this.boxes.clear();
    this.boxes.set("aim", layout.aim);
    for (const target of layout.targets) this.boxes.set(target.action, target);
    this.covers = undefined;
    for (const target of layout.targets) {
      const button = this.buttons.find(
        (b) => (b.dataset.skill ?? b.dataset.action) === target.action,
      )!;
      button.style.setProperty(
        "--combat-icon-size",
        target.iconSize === undefined ? "" : `${target.iconSize}px`,
      );
      Object.assign(button.style, {
        left: target.x - target.size / 2 + "px",
        top: target.y - target.size / 2 + "px",
        width: target.size + "px",
        height: target.size + "px",
      });
    }
    this.onLayout();
  }
  /** How each skill slot aims on a drag (touch-aim.ts), from the fighter's kit. */
  setAims(kinds: readonly AimKind[]) {
    this.aimKinds = [...kinds];
  }
  /** A skill that reads the aim is held to aim; the rest fire on the press. */
  private aimsOnDrag(slot: number) {
    const kind = this.aimKinds[slot] ?? "self";
    // Below a full meter the ultimate button arms EX on the press.
    return kind !== "self" && !(slot === 3 && this.ultLeft > 0);
  }
  private startAim(
    event: PointerEvent,
    slot: number,
    button: HTMLButtonElement,
  ) {
    const box = this.boxes.get(String(slot));
    const size = box?.size ?? 56,
      radius = size * 1.15;
    this.aiming.set(event.pointerId, {
      slot,
      button,
      sx: event.clientX,
      sy: event.clientY,
      x: event.clientX,
      y: event.clientY,
      size,
      radius,
      manual: false,
      cancel: false,
      touch: event.pointerType === "touch",
    });
    if (box)
      Object.assign(this.wheel.style, {
        left: box.x - radius + "px",
        top: box.y - radius + "px",
        width: 2 * radius + "px",
        height: 2 * radius + "px",
      });
    this.wheelKnob.style.transform = "";
    this.wheel.classList.remove("is-cancel");
    this.wheel.classList.add("is-on");
  }
  private moveAim(g: AimGesture, x: number, y: number) {
    g.x = x;
    g.y = y;
    const dx = x - g.sx,
      dy = y - g.sy,
      len = Math.hypot(dx, dy);
    if (!g.manual && len > AIM_DEAD_ZONE) {
      g.manual = true;
      // The target button's place, measured now (an event, not a frame),
      // before the cancel spot covers it.
      const r = this.aim.getBoundingClientRect();
      g.spot = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        r: r.width / 2 + 10,
      };
      this.aim.classList.add("is-under-cancel");
      this.cancelSpot.classList.add("is-on");
    }
    const over =
      g.manual && !!g.spot && Math.hypot(x - g.spot.x, y - g.spot.y) < g.spot.r;
    // Back at the middle (Brawl Stars), or over the cancel spot (a MOBA).
    g.cancel = g.manual && (len < g.size * 0.26 || over);
    const k = len > g.radius ? g.radius / len : 1;
    this.wheelKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.wheel.classList.toggle("is-cancel", g.cancel);
    this.cancelSpot.classList.toggle("is-hot", over);
  }
  private endAim(g: AimGesture, commit: boolean, stamp?: number) {
    if (!this.aiming.size) this.hideAim();
    if (!commit || g.cancel || !this.enabled || !this.canPlay()) return;
    if (g.button.disabled) return;
    const handled = performance.now();
    const dx = g.x - g.sx,
      dy = g.y - g.sy,
      len = Math.hypot(dx, dy);
    this.drag =
      g.manual && len > 0
        ? {
            slot: g.slot,
            dx: dx / len,
            dy: dy / len,
            t: Math.min(1, len / g.radius),
            at: handled,
          }
        : null;
    this.fire({ skill: g.slot }, stamp ?? handled, handled);
  }
  private hideAim() {
    this.wheel.classList.remove("is-on", "is-cancel");
    this.cancelSpot.classList.remove("is-on", "is-hot");
    this.aim.classList.remove("is-under-cancel");
  }
  /**
   * The skill being held (the latest finger), for the guide on the court:
   * its slot, whether it aims by hand yet (`firm`) or would cancel, and the
   * drag's direction (unit, screen) and reach (0–1).
   */
  get aimGuide() {
    let g: AimGesture | undefined;
    for (const held of this.aiming.values()) g = held;
    if (!g) return undefined;
    const dx = g.x - g.sx,
      dy = g.y - g.sy,
      len = Math.hypot(dx, dy);
    return {
      slot: g.slot,
      firm: g.manual,
      cancel: g.cancel,
      dx: len ? dx / len : 0,
      dy: len ? dy / len : 0,
      t: Math.min(1, len / g.radius),
    };
  }
  /**
   * Fade the buttons an enemy stands behind (screen points, `n` of them in
   * `xs`/`ys`, CSS px), so the fight shows through; they still take a
   * finger. The circles are measured once per layout, never per frame.
   */
  setCovered(xs: readonly number[], ys: readonly number[], n: number) {
    if (!this.covers) {
      if (!n) return;
      const cluster = this.root.querySelector<HTMLElement>(".touch-buttons")!;
      const r = cluster.getBoundingClientRect();
      this.covers = [...this.buttons, this.aim].flatMap((button) => {
        const key =
          button === this.aim
            ? "aim"
            : (button.dataset.skill ?? button.dataset.action)!;
        const box = this.boxes.get(key);
        return box
          ? [
              {
                button,
                x: r.left + box.x,
                y: r.top + box.y,
                r: box.size / 2 + 6,
              },
            ]
          : [];
      });
    }
    for (const c of this.covers) {
      let behind = false;
      for (let i = 0; i < n && !behind; i++)
        behind = Math.hypot(xs[i] - c.x, ys[i] - c.y) < c.r;
      if (c.button.classList.contains("is-behind") !== behind)
        c.button.classList.toggle("is-behind", behind);
    }
  }
  /**
   * The target button's state each frame: on only while an enemy is on
   * screen (`available`), lit while a lock holds (`locked`).
   */
  setTarget(available: boolean, locked: boolean) {
    // Down in a raid: off, as the other buttons are.
    if (this.downed) available = locked = false;
    if (this.aim.disabled === available) {
      this.aim.disabled = !available;
      this.aim.setAttribute(
        "aria-label",
        available
          ? "Target: next enemy on screen"
          : "Target: no enemy on screen",
      );
    }
    if (this.aim.classList.contains("is-locked") !== locked)
      this.aim.classList.toggle("is-locked", locked);
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
    this.ultLeft = Math.max(0, 100 - ult);
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
      setHudDisabled(
        button,
        this.downed || !active || (action !== "attack" && left > 0 && !exReady),
      );
      if (button.dataset.iconName !== name) {
        // The art is the label: skills, the basic attack and the ultimate
        // carry no text over it (1–3 were keyboard keys anyway). Dash and
        // Jump use plain glyphs, so they keep a small word under the icon.
        button.innerHTML =
          abilityIcon(name) +
          (action === "dash" || action === "jump"
            ? `<span class="touch-key">${action.toUpperCase()}</span>`
            : "") +
          '<span class="touch-cooldown"></span>';
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
              : `${Math.floor(ult)}%`
            : left.toFixed(1);
      // In place (hud-dom.ts): a new text node for each tenth of a second
      // restyled every `:has()` rule's reach, on each cooling button.
      setHudText(button.querySelector<HTMLElement>(".touch-cooldown")!, text);
      const duration = isUlt
        ? 100
        : skill !== undefined
          ? durations[Number(skill)]
          : action === "dash"
            ? 3
            : action === "jump"
              ? 2
              : basic.duration;
      setHudStyle(button, "--cooldown", sweepPercent((100 * left) / duration));
      button.classList.toggle("cooling", left > 0);
      // A skill back from its cooldown flashes once and taps the phone
      // (Settings → Vibration), so eyes can stay on the fight.
      if (skill !== undefined && !isUlt) {
        const before = this.lastLeft.get(button) ?? 0;
        this.lastLeft.set(button, left);
        if (this.wasActive && active && before > 0 && left <= 0) {
          button.classList.add("skill-ready");
          setTimeout(() => button.classList.remove("skill-ready"), 600);
          rumble(12, 0.2);
        }
      }
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
            ? name + " · charging " + text + (exReady ? " · tap to arm EX" : "")
            : name + " · " + text + " seconds",
      );
    }
    this.wasActive = active;
  }
}
