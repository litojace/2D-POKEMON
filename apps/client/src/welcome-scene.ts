import { creatureSvg } from "./creature-design";
import { scopeIds } from "./fighter-art";
import type { CharacterId } from "@arena/shared";
import "./welcome-scene.css";

type View = "left" | "right" | "back";
const cast: {
  id: CharacterId;
  view: View;
  x: number;
  y: number;
  size?: number;
  floats?: boolean;
}[] = [
  { id: "mystowl", view: "right", x: 28, y: 45, floats: true },
  { id: "terradon", view: "left", x: 51, y: 44, size: 0.96 },
  { id: "duskveil", view: "left", x: 76, y: 48, floats: true },
  { id: "voltkit", view: "right", x: 12, y: 70 },
  { id: "lumoth", view: "left", x: 88, y: 73, floats: true },
  { id: "auralynx", view: "back", x: 25, y: 91, floats: true },
  { id: "cindrake", view: "back", x: 46, y: 98, size: 1.12 },
  { id: "tidefin", view: "back", x: 73, y: 94, size: 0.88 },
];

/** Source artwork, with a shared foot line and a separate soft contact shadow. */
function illustration(id: CharacterId, view: View) {
  const svg = creatureSvg(id, view === "back" ? "up" : view).replace(
    /<ellipse class="fighter-shadow"[^>]*\/>/,
    "",
  );
  const [x, y, w] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(" ")
    .map(Number);
  return scopeIds(
    svg
      .replace(/viewBox="[^"]+"/, `viewBox="${x} ${y} ${w} ${176 - y}"`)
      .replace("<svg ", '<svg focusable="false" '),
    `welcome-${id}`,
  );
}

/** A decorative, independently animated roster around the welcome campfire. */
export function welcomeScene() {
  return `<div class="gate-camp" aria-hidden="true"><div class="gate-camp-light"></div>${cast.map((c, i) => `<div class="gate-champion${c.floats ? " gate-champion-floats" : ""}" data-gate-champion="${c.id}" data-gate-view="${c.view}" style="--x:${c.x}%;--y:${c.y}%;--size:${c.size ?? 1};--phase:${-i * 0.71}s;--layer:${Math.round(c.y)}"><span class="gate-character-shadow"></span><div class="gate-champion-figure">${illustration(c.id, c.view)}</div></div>`).join("")}<div class="gate-campfire"><svg viewBox="0 0 120 140" focusable="false"><defs><linearGradient id="gate-fire-outer" x2="0" y2="1"><stop stop-color="#ffe3a0"/><stop offset=".55" stop-color="#ffb745"/><stop offset="1" stop-color="#ed6b38"/></linearGradient><linearGradient id="gate-fire-core" x2="0" y2="1"><stop stop-color="#fff8d2"/><stop offset="1" stop-color="#ffd76a"/></linearGradient></defs><g class="gate-fire-stones" fill="#7d7373"><ellipse cx="32" cy="122" rx="13" ry="7"/><ellipse cx="88" cy="122" rx="13" ry="7"/><ellipse cx="60" cy="128" rx="20" ry="6"/></g><g class="gate-fire-flames"><path class="gate-fire-outer" d="M31 117Q9 98 32 65Q31 85 43 86Q33 45 59 13Q53 43 74 57Q78 39 77 31Q111 78 94 108Q83 127 59 123Z" fill="url(#gate-fire-outer)"/><path class="gate-fire-inner" d="M46 119Q30 103 48 77Q47 92 58 96Q54 74 68 55Q66 82 78 94Q88 112 72 122Z" fill="url(#gate-fire-core)"/></g><g fill="#9c633e" stroke="#5c3d31" stroke-width="3"><path d="M23 117Q18 111 24 109L91 121Q99 125 92 130Z"/><path d="M29 129Q21 129 24 122L89 108Q98 107 96 114Z"/></g></svg>${Array.from({ length: 7 }, (_, i) => `<i class="gate-fire-ember" style="--ember:${i}"></i>`).join("")}</div></div>`;
}

/** Mount once per gate, dispose on navigation, and suspend hidden tabs. */
export function watchWelcomeMotion(menu: HTMLElement) {
  let gate: HTMLElement | null = null;
  let camp: HTMLElement | null = null;
  let animation: import("./welcome-animation").WelcomeAnimation | undefined;
  let disposed = false;
  let pending = 0;
  const sync = () => {
    gate = menu.querySelector<HTMLElement>(".welcome-gate");
    gate?.toggleAttribute("data-motion-paused", document.hidden || menu.hidden);
    const next = gate?.querySelector<HTMLElement>(".gate-camp") ?? null;
    if (next !== camp) {
      animation?.destroy();
      animation = undefined;
      camp = next;
      const version = ++pending;
      if (next)
        void import("./welcome-animation")
          .then((module) => {
            if (!disposed && version === pending && next.isConnected) {
              animation = module.mountWelcomeAnimation(next);
              animation.pause(document.hidden || menu.hidden);
            }
          })
          .catch(() => {
            /* The complete static artwork stays visible. */
          });
    }
    animation?.pause(document.hidden || menu.hidden);
  };
  const observer = new MutationObserver(sync);
  observer.observe(menu, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    disposed = true;
    pending++;
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    animation?.destroy();
  };
}
