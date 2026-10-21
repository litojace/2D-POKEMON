import type { ShopPreviewHandle } from "./shop-preview";

/** One shared Shop rig for the featured fighter; never render behind a menu. */
export function watchHomePreview(
  menu: HTMLElement,
  ...covers: (HTMLDialogElement | HTMLDetailsElement)[]
) {
  let preview: ShopPreviewHandle | undefined;
  let mounted: HTMLElement | undefined;
  let load: typeof import("./shop-preview") | undefined;
  let loading = false;
  let disposed = false;
  const sync = () => {
    const stage = menu.querySelector<HTMLElement>(".home-fighter-stage");
    if (
      menu.hidden ||
      !stage ||
      !stage.querySelector(".home-fighter-art > svg")
    ) {
      preview?.();
      preview = undefined;
      mounted = undefined;
      return;
    }
    const covered =
      document.hidden ||
      !!stage.closest("[inert]") ||
      covers.some((cover) => cover.open);
    if (preview) {
      if (mounted !== stage) {
        preview.update(stage);
        mounted = stage;
      }
      preview.suspend(covered);
    } else if (!covered) {
      if (load) {
        mounted = stage;
        preview = load.mountShopPreview(stage, "home");
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
    attributeFilter: ["hidden", "inert"],
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
