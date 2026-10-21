import type { PreviewPlacement, ShopPreviewHandle } from "./shop-preview";

/** One Shop rig follows the visible Home or fighter-detail portrait. */
export function watchHomePreview(
  menu: HTMLElement,
  ...covers: (HTMLDialogElement | HTMLDetailsElement)[]
) {
  let preview: ShopPreviewHandle | undefined;
  let mounted: HTMLElement | undefined;
  let appearance = "";
  let load: typeof import("./shop-preview") | undefined;
  let loading = false;
  let disposed = false;
  const sync = () => {
    const detail = menu.querySelector<HTMLElement>(
      ".fighter-preview-slot .fighter-detail",
    );
    const selection =
      detail &&
      !detail.closest("[hidden], [inert]") &&
      detail.getClientRects().length
        ? detail
        : undefined;
    const stage =
      selection ?? menu.querySelector<HTMLElement>(".home-fighter-stage");
    const placement: PreviewPlacement = selection ? "selection" : "home";
    const host = stage?.querySelector<HTMLElement>(
      selection ? ".fighter-rig-stage" : ".home-fighter-art",
    );
    if (menu.hidden || !stage || !host?.querySelector(":scope > svg")) {
      preview?.();
      preview = undefined;
      mounted = undefined;
      appearance = "";
      return;
    }
    const covered =
      document.hidden ||
      !!stage.closest("[inert]") ||
      !!menu.querySelector(".lobby-room-drawer[open]") ||
      covers.some((cover) => cover.open);
    const key = JSON.stringify([
      placement,
      host.dataset.previewChampion,
      host.dataset.previewItem,
      host.dataset.previewStage,
      host.dataset.previewLook,
    ]);
    if (preview) {
      if (mounted !== stage || appearance !== key) {
        preview.update(stage, placement);
        mounted = stage;
        appearance = key;
      }
      preview.suspend(covered);
    } else if (!covered) {
      if (load) {
        mounted = stage;
        appearance = key;
        preview = load.mountShopPreview(stage, placement);
      } else if (!loading) {
        loading = true;
        void import("./shop-preview")
          .then((module) => {
            load = module;
            if (!disposed) sync();
          })
          .catch(() => {
            // Keep the matching SVG artwork when the renderer cannot load.
          });
      }
    }
  };
  const content = new MutationObserver(sync);
  content.observe(menu, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "hidden",
      "inert",
      "open",
      "data-preview-champion",
      "data-preview-item",
      "data-preview-stage",
      "data-preview-look",
    ],
  });
  const cover = new MutationObserver(sync);
  for (const panel of covers)
    cover.observe(panel, { attributes: true, attributeFilter: ["open"] });
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    disposed = true;
    content.disconnect();
    cover.disconnect();
    document.removeEventListener("visibilitychange", sync);
    preview?.();
  };
}
