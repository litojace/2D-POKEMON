/**
 * The picture before it goes anywhere (owner, 25 Nov 2026: "save it to the
 * phone"). Share card and the results' Share open this: the card large,
 * and the ways to keep it that this device really has.
 *
 * - Share: the device's share sheet with the picture. On iPhone and iPad
 *   it carries the file alone: with words beside it, iOS has dropped the
 *   words or its "Save Image" (WebKit bugs 251500, 255544).
 * - Save image: a download, where a download lands somewhere players find
 *   it (Android's Downloads, a computer). Not on iPhone or iPad: Safari
 *   files it in Files, an installed web app often drops it, and the app's
 *   web view has no downloads at all.
 * - Hold the picture: the system's own menu (Save to Photos on iPhone,
 *   Download image on Android). touch-hold.ts and style.css leave this one
 *   picture's menu alone. The iPhone app's Info.plist says why it adds to
 *   Photos (NSPhotoLibraryAddUsageDescription), or iOS would close it.
 *
 * Loaded only when a picture is shared (share-card.ts).
 */
import { button, esc } from "./ui/components";
import { isNativeApp } from "./native";
import { isIOSDevice } from "./render-budget";
import "./share-preview.css";

export interface PreviewOptions {
  blob: Blob;
  file: string;
  /** The words for a share sheet that keeps them (not iOS). */
  text: string;
  title?: string;
  /** What the picture is, for screen readers and the dialog's name. */
  label: string;
}

type Nav = Navigator & { canShare?: (data: ShareData) => boolean };

/** What this device can do with the picture. */
export function previewWays(
  o: { ios?: boolean; app?: boolean; touch?: boolean; canShare?: boolean } = {},
) {
  const ios = o.ios ?? isIOSDevice();
  const app = o.app ?? isNativeApp();
  const touch =
    o.touch ??
    (typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches);
  const save = !ios && !app;
  const hint =
    ios || app
      ? "Press and hold the picture, then Save to Photos."
      : touch
        ? "Or press and hold the picture to download it."
        : "";
  return { share: !!o.canShare, save, hint, filesOnly: ios || app };
}

let open: (() => void) | null = null;

/** Show the picture; resolves when it closes. */
export function showSharePreview(o: PreviewOptions): Promise<void> {
  open?.();
  const file = new File([o.blob], o.file, { type: "image/png" });
  const nav = navigator as Nav;
  let canShare = false;
  try {
    canShare = !!nav.share && !!nav.canShare?.({ files: [file] });
  } catch {
    canShare = false;
  }
  const ways = previewWays({ canShare });
  const url = URL.createObjectURL(o.blob);
  const returnFocus = document.activeElement as HTMLElement | null;
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="ui-scrim share-preview" data-share-preview><div class="ui-modal sp-modal" role="dialog" aria-modal="true" aria-label="${esc(o.label)}"><div class="sp-body"><img class="sp-picture" data-share-picture src="${url}" width="1200" height="630" alt="${esc(o.label)}"><p class="sp-hint" aria-live="polite">${esc(ways.hint)}</p></div><div class="ui-actions sp-actions">${button("Close", { icon: "cancel", attrs: { "data-sp-close": true } })}${ways.save ? button("Save image", { icon: "save", kind: ways.share ? "default" : "primary", attrs: { "data-sp-save": true } }) : ""}${ways.share ? button("Share", { icon: "share", kind: "primary", attrs: { "data-sp-share": true } }) : ""}</div></div></div>`;
  const scrim = wrap.firstElementChild as HTMLElement;
  const hint = scrim.querySelector<HTMLElement>(".sp-hint")!;
  const say = (words: string) => {
    hint.textContent = words;
    hint.hidden = !words;
  };
  say(ways.hint);

  return new Promise((resolve) => {
    const close = () => {
      if (open !== close) return;
      open = null;
      document.removeEventListener("keydown", onKey, true);
      scrim.remove();
      URL.revokeObjectURL(url);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      resolve();
    };
    open = close;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const stops = Array.from(scrim.querySelectorAll<HTMLElement>("button"));
        const i = stops.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        stops[
          (i + (event.shiftKey ? -1 : 1) + stops.length) % stops.length
        ]?.focus();
      }
    };
    async function share() {
      try {
        // Called straight from the tap, nothing awaited first: Safari lets
        // a page open the sheet only soon after a tap.
        await nav.share(
          ways.filesOnly
            ? { files: [file] }
            : {
                files: [file],
                text: o.text,
                title: o.title ?? "Element Arena",
              },
        );
        close();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        say(
          ways.save
            ? "Sharing didn't open here. Save image keeps the picture."
            : "Sharing didn't open here. Press and hold the picture to save it.",
        );
      }
    }
    function save() {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      say("Saved to your downloads.");
    }
    scrim.addEventListener("click", (event) => {
      const t = event.target as Element;
      if (t === scrim || t.closest("[data-sp-close]")) close();
      else if (t.closest("[data-sp-share]")) void share();
      else if (t.closest("[data-sp-save]")) save();
    });
    document.addEventListener("keydown", onKey, true);
    document.body.append(scrim);
    scrim
      .querySelector<HTMLElement>(
        "[data-sp-share], [data-sp-save], [data-sp-close]",
      )
      ?.focus({ preventScroll: true });
  });
}
