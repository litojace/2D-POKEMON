import type Phaser from "phaser";

/** Wake WebKit's suspended drawing surface, and make a lost context recoverable. */
export function watchRendererLifecycle(
  game: Phaser.Game,
  active: () => boolean,
  resize: () => void,
) {
  let canvas: HTMLCanvasElement | undefined,
    lost = false;
  let recovery: HTMLElement | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  const dismiss = () => {
    clearTimeout(timer);
    recovery?.remove();
    recovery = undefined;
  };
  const showRecovery = () => {
    if (!lost || document.hidden || !active() || recovery) return;
    recovery = document.createElement("aside");
    recovery.id = "renderer-recovery";
    recovery.setAttribute("role", "status");
    recovery.style.cssText =
      "position:fixed;inset:0;z-index:2147483001;display:grid;place-content:center;gap:16px;padding:24px;background:#0b1020;color:#edf3ff;text-align:center;font:16px/1.5 system-ui";
    const text = document.createElement("p");
    text.textContent = "Restoring the arena display…";
    const retry = document.createElement("button");
    retry.textContent = "Reload and reconnect";
    retry.style.cssText =
      "min-height:44px;padding:12px 24px;border:0;border-radius:12px;background:#ffdc76;color:#211b0e;font:700 16px system-ui";
    retry.onclick = () => location.reload();
    recovery.append(text, retry);
    document.body.append(recovery);
  };
  const resume = () => {
    if (document.hidden || !active()) {
      game.loop.sleep();
      return;
    }
    if (lost) {
      clearTimeout(timer);
      timer = setTimeout(showRecovery, 1800);
      return;
    }
    if (game.isRunning) {
      // WebKit can restore a Home Screen page without the visibility event
      // that Phaser normally uses to clear its paused flag.
      if (game.isPaused) game.resume();
      resize();
      game.scale.refresh();
      game.loop.wake();
    }
  };
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    clearTimeout(timer);
    timer = setTimeout(showRecovery, 1800);
  };
  const onRestored = () => {
    lost = false;
    dismiss();
    resume();
  };
  const attach = () => {
    canvas = game.canvas;
    canvas?.addEventListener("webglcontextlost", onLost);
    canvas?.addEventListener("webglcontextrestored", onRestored);
  };
  const hide = () => game.loop.sleep();
  const dispose = () => {
    dismiss();
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("pageshow", resume);
    window.removeEventListener("pagehide", hide);
    canvas?.removeEventListener("webglcontextlost", onLost);
    canvas?.removeEventListener("webglcontextrestored", onRestored);
    game.events.off("ready", attach);
  };
  if (game.canvas) attach();
  else game.events.once("ready", attach);
  game.events.once("destroy", dispose);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", resume);
  window.addEventListener("pagehide", hide);
  return dispose;
}
