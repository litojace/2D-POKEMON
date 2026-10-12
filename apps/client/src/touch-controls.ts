import { abilityIcon } from "./ability-icons";
export function joystickVector(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  if (length < radius * 0.12) return { dx: 0, dy: 0 };
  const scale = Math.max(radius, length);
  return { dx: x / scale, dy: y / scale };
}
type Actions = { basic: boolean; skill: number; dash: boolean; jump: boolean };
export class TouchControls {
  dx = 0;
  dy = 0;
  basic = false;
  enabled: boolean;
  private pointer: number | null = null;
  private attackPointers = new Set<number>();
  private root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  constructor(
    root: HTMLElement,
    canPlay: () => boolean,
    fire: (action: Partial<Actions>) => void,
    notify: (text: string) => void,
  ) {
    this.root = root;
    this.enabled =
      localStorage.getItem("arena-touch") === "on" ||
      (localStorage.getItem("arena-touch") !== "off" &&
        matchMedia("(pointer: coarse)").matches);
    root.innerHTML = `<div class="mobile-tools"><button id="touch-toggle" class="quiet"></button><button id="mobile-fullscreen" class="quiet">Enter fullscreen ⛶</button><span class="touch-note">Landscape recommended · aims toward opponent</span></div><div class="touch-pad"><div class="joystick" role="group" aria-label="Movement joystick"><span class="joystick-knob"></span><span class="joystick-label">MOVE</span></div><div class="touch-buttons"><button data-action="dash">Dash</button><button data-action="jump">Jump</button><button data-skill="0">1<small>Skill</small></button><button data-skill="1">2<small>Skill</small></button><button data-skill="2">3<small>Skill</small></button><button data-skill="3" class="touch-ultimate">Ultimate</button><button data-action="attack" class="touch-attack">Attack</button></div></div>`;
    this.stick = root.querySelector(".joystick")!;
    this.knob = root.querySelector(".joystick-knob")!;
    const toggle = root.querySelector<HTMLButtonElement>("#touch-toggle")!;
    const display = () => {
      root.classList.toggle("touch-enabled", this.enabled);
      toggle.textContent = this.enabled
        ? "Touch controls: ON"
        : "Touch controls: OFF";
      document.body.classList.toggle("touch-mode", this.enabled);
    };
    toggle.onclick = () => {
      this.enabled = !this.enabled;
      localStorage.setItem("arena-touch", this.enabled ? "on" : "off");
      this.reset();
      display();
    };
    display();
    const fullscreen =
      root.querySelector<HTMLButtonElement>("#mobile-fullscreen")!;
    fullscreen.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        else
          notify(
            "Fullscreen is unavailable in this browser. Touch controls still work; use landscape for a wider arena.",
          );
      } catch {
        notify(
          "This browser could not enter fullscreen. Touch controls still work in the normal page.",
        );
      }
    };
    document.addEventListener("fullscreenchange", () => {
      fullscreen.textContent = document.fullscreenElement
        ? "Exit fullscreen ⛶"
        : "Enter fullscreen ⛶";
      this.reset();
    });
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.pointer) return;
      if (!canPlay()) {
        this.reset();
        return;
      }
      const rect = this.stick.getBoundingClientRect();
      const radius = rect.width * 0.32;
      const vector = joystickVector(
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
        radius,
      );
      this.dx = vector.dx;
      this.dy = vector.dy;
      this.knob.style.transform = `translate(${this.dx * radius}px,${this.dy * radius}px)`;
    };
    this.stick.onpointerdown = (event) => {
      if (!this.enabled || !canPlay() || this.pointer !== null) return;
      event.preventDefault();
      this.pointer = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      move(event);
    };
    this.stick.onpointermove = move;
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.pointer) {
        this.pointer = null;
        this.dx = this.dy = 0;
        this.knob.style.transform = "";
      }
    };
    this.stick.onpointerup = release;
    this.stick.onpointercancel = release;
    this.stick.onlostpointercapture = release;
    root
      .querySelectorAll<HTMLButtonElement>(".touch-buttons button")
      .forEach((button) => {
        button.onpointerdown = (event) => {
          if (!this.enabled || !canPlay() || button.disabled) return;
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          button.classList.add("pressed");
          if (button.dataset.action === "attack") {
            this.attackPointers.add(event.pointerId);
            this.basic = true;
          } else if (button.dataset.skill !== undefined)
            fire({ skill: Number(button.dataset.skill) });
          else if (button.dataset.action === "dash") fire({ dash: true });
          else fire({ jump: true });
        };
        const stop = (event: PointerEvent) => {
          this.attackPointers.delete(event.pointerId);
          this.basic = this.attackPointers.size > 0;
          button.classList.remove("pressed");
        };
        button.onpointerup = stop;
        button.onpointercancel = stop;
        button.onlostpointercapture = stop;
      });
    window.addEventListener("blur", () => this.reset());
    window.addEventListener("orientationchange", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    });
  }
  reset() {
    this.pointer = null;
    this.dx = this.dy = 0;
    this.basic = false;
    this.attackPointers.clear();
    this.knob.style.transform = "";
    this.root
      .querySelectorAll(".pressed")
      .forEach((el) => el.classList.remove("pressed"));
  }
  update(
    active: boolean,
    names: string[],
    cooldowns: number[],
    dash: number,
    jump: number,
    durations: number[] = [4, 7, 10, 30],
  ) {
    if (!active) this.reset();
    this.root
      .querySelectorAll<HTMLButtonElement>(".touch-buttons button")
      .forEach((button) => {
        const skill = button.dataset.skill;
        const left =
          skill !== undefined
            ? cooldowns[Number(skill)]
            : button.dataset.action === "dash"
              ? dash
              : button.dataset.action === "jump"
                ? jump
                : 0;
        const name =
          skill !== undefined
            ? names[Number(skill)]
            : button.dataset.action === "attack"
              ? "Attack"
              : button.dataset.action === "dash"
                ? "Dash"
                : "Jump";
        button.disabled = !active || left > 0;
        if (button.dataset.iconName !== name) {
          button.innerHTML =
            abilityIcon(name) +
            '<span class="touch-key">' +
            (skill !== undefined ? Number(skill) + 1 : "") +
            '</span><span class="touch-cooldown"></span>';
          button.dataset.iconName = name;
        }
        button.querySelector(".touch-cooldown")!.textContent =
          left > 0 ? left.toFixed(1) : "";
        const duration =
          skill !== undefined
            ? durations[Number(skill)]
            : button.dataset.action === "dash"
              ? 3
              : 2;
        button.style.setProperty(
          "--cooldown",
          Math.min(100, (100 * left) / duration) + "%",
        );
        button.classList.toggle("cooling", left > 0);
        button.title = name;
        button.setAttribute(
          "aria-label",
          left > 0 ? name + " · " + left.toFixed(1) + " seconds" : name,
        );
      });
  }
}
