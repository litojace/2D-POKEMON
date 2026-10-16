import { iconLabel } from "./menu-icons";
export type FullscreenPlatform = "iphone" | "ipad" | "android" | "desktop";
/** Rough platform guess for the instructions (iPadOS reports as a Mac with touch). */
export function fullscreenPlatform(
  userAgent: string,
  touchPoints: number,
): FullscreenPlatform {
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (
    /iPad/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && touchPoints > 1)
  )
    return "ipad";
  if (/Android/.test(userAgent)) return "android";
  return "desktop";
}
/** Dialog body for the "Want fullscreen?" menu item. */
export function fullscreenHelp(options: {
  standalone: boolean;
  platform: FullscreenPlatform;
  canPrompt: boolean;
  canFullscreen: boolean;
}) {
  const { standalone, platform, canPrompt, canFullscreen } = options;
  if (standalone)
    return "<h2>You are already fullscreen</h2><p>Element Arena is running from your home screen, so there are no browser bars in the way. Turn your phone sideways for the best view.</p>";
  const apple =
    '<ol class="fullscreen-steps"><li>Open this page in <b>Safari</b>.</li><li>Tap <b>Share</b> (the square with an arrow; on newer iOS it may be under the <b>⋯</b> button).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>Element Arena</b> from your home screen and turn your phone sideways.</li></ol>';
  const android =
    '<ol class="fullscreen-steps"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu in the top corner.</li><li>Choose <b>Install app</b> (or <b>Add to Home screen</b>).</li><li>Open <b>Element Arena</b> from your home screen and turn your phone sideways.</li></ol>';
  const desktop =
    '<ol class="fullscreen-steps"><li>In Chrome or Edge, click the <b>install</b> icon at the right end of the address bar.</li><li>Or press <b>F11</b> (<b>Ctrl+Cmd+F</b> on Mac) to make the browser fullscreen.</li></ol>';
  const steps =
    platform === "iphone" || platform === "ipad"
      ? apple
      : platform === "android"
        ? android
        : desktop;
  const actions = [
    canPrompt
      ? `<button class="primary" id="fullscreen-install">${iconLabel("install", "Add to home screen")}</button>`
      : "",
    canFullscreen
      ? `<button class="secondary" id="fullscreen-now">${iconLabel("fullscreen", "Fullscreen for now")}</button>`
      : "",
  ].join("");
  return `<h2>Want fullscreen?</h2><p>Add Element Arena to your home screen. It then opens like an app, with no address bar or browser buttons taking up space, and starts faster next time.</p>${
    canPrompt ? "<p>Your browser can do it in one tap:</p>" : steps
  }${actions ? `<div class="fullscreen-actions">${actions}</div>` : ""}${
    platform === "iphone"
      ? '<p class="fullscreen-note">iPhone browsers only hide their bars for home-screen apps, so this is the way to get fullscreen there.</p>'
      : ""
  }<p class="fullscreen-note">It is free and takes no extra setup. Online battles still need an internet connection.</p>`;
}
