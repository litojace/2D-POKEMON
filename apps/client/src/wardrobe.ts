import { CHARACTERS, type CharacterId } from "@arena/shared";
import type { Economy } from "../../../packages/shared/src/shop";
import type {
  RaidLoadout,
  RaidProgress,
} from "../../../packages/shared/src/raid";
import type { ShopPreviewHandle } from "./shop-preview";
import {
  WARDROBE_SLOTS,
  wardrobeItem,
  wardrobeMarkup,
  wardrobeOwned,
  wardrobeOutfit,
  wardrobePreviewParts,
  type WardrobeSlot,
  type WardrobeView,
} from "./wardrobe-ui";
interface WardrobeHooks {
  state(): {
    economy: Economy;
    progress: RaidProgress | null;
    look: RaidLoadout;
  };
  render(html: string): void;
  save(
    slot: WardrobeSlot,
    item: string | null,
    champion: CharacterId,
    stage?: number,
  ): Promise<void>;
  shop(): void;
  raids(): void;
}
/** A single preview renderer and delegated controls survive inventory refreshes. */
export function openWardrobe(
  root: HTMLDialogElement,
  champion: CharacterId,
  hooks: WardrobeHooks,
  problem = "",
) {
  const view: WardrobeView = { champion, slot: "all", action: "idle" };
  let preview: ShopPreviewHandle | undefined;
  let importing = false,
    disposed = false,
    saving = false;
  let message = "",
    failed = false;
  const events = new AbortController();
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    events.abort();
    observer.disconnect();
    preview?.();
    root.classList.remove("wardrobe-dialog");
  };
  const observer = new MutationObserver(() => {
    if (!root.querySelector(".wardrobe")) cleanup();
  });
  observer.observe(root, { childList: true });
  root.addEventListener("close", cleanup, { signal: events.signal });
  const render = (focus?: string, previewOnly = false, resetScroll = false) => {
    if (disposed) return;
    const scrolls = [".wardrobe-inventory", ".wardrobe-showcase"].map(
      (s) => [s, root.querySelector(s)?.scrollTop ?? 0] as const,
    );
    const { economy, progress, look } = hooks.state();
    if (previewOnly) {
      const parts = wardrobePreviewParts(view, economy, progress, look);
      root.querySelector(".wardrobe-preview")!.outerHTML = parts.stage;
      root.querySelector(".wardrobe-preview-actions")!.outerHTML =
        parts.animations;
      root.querySelector(".wardrobe-footer")!.outerHTML = parts.footer;
      for (const card of Array.from(
        root.querySelectorAll<HTMLElement>("[data-wardrobe-preview]"),
      )) {
        const active = card.dataset.wardrobePreview === view.preview;
        card.classList.toggle("is-selected", active);
        card.setAttribute("aria-pressed", String(active));
      }
    } else hooks.render(wardrobeMarkup(view, economy, progress, look, problem));
    root.classList.add("wardrobe-dialog");
    for (const [s, top] of scrolls)
      root.querySelector(s)?.scrollTo({ top: resetScroll ? 0 : top });
    const status = root.querySelector<HTMLElement>(".wardrobe-status")!;
    status.textContent = message;
    status.setAttribute("role", failed ? "alert" : "status");
    status.classList.toggle("is-error", failed);
    const panel = root.querySelector<HTMLElement>(".wardrobe-preview")!;
    if (preview) preview.update(panel);
    else if (!importing) {
      importing = true;
      void import("./shop-preview")
        .then(({ mountShopPreview }) => {
          const current = root.querySelector<HTMLElement>(".wardrobe-preview");
          if (!disposed && current) preview = mountShopPreview(current);
        })
        .catch(() => {
          // Matching still art remains usable if the animated renderer cannot load.
        });
    }
    if (focus)
      root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  };
  const save = async (
    slot: WardrobeSlot,
    item: string | null,
    focus: string,
  ) => {
    if (saving || disposed) return;
    saving = true;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
        ".wardrobe button, .wardrobe select",
      ),
    );
    buttons.forEach((b) => (b.disabled = true));
    const status = root.querySelector<HTMLElement>(".wardrobe-status")!;
    status.textContent = "Saving outfit…";
    root.querySelector(".wardrobe")?.setAttribute("aria-busy", "true");
    try {
      const { economy, look } = hooks.state();
      const stage = wardrobeOutfit(view, economy, look).skin?.stage;
      await hooks.save(slot, item, view.champion, stage);
      message = item
        ? `${wardrobeItem(item)?.name ?? "Item"} equipped${slot === "champion" ? " on this fighter" : " for every fighter"}.`
        : `${WARDROBE_SLOTS.find(([s]) => s === slot)![1]} taken off.`;
      failed = false;
      view.preview = undefined;
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : "Could not save your outfit. Try again.";
      failed = true;
    } finally {
      saving = false;
      if (!disposed) render(focus);
    }
  };
  root.addEventListener(
    "change",
    (event) => {
      const select = (event.target as Element).closest<HTMLSelectElement>(
        "#wardrobe-champion",
      );
      if (!select || saving) return;
      view.champion = select.value as CharacterId;
      view.preview = undefined;
      view.action = "idle";
      message = "";
      render("#wardrobe-champion", false, true);
    },
    { signal: events.signal },
  );
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        ".wardrobe button",
      );
      if (!button || saving) return;
      const { economy, progress } = hooks.state();
      if (button.hasAttribute("data-wardrobe-step")) {
        const ids = Object.keys(CHARACTERS) as CharacterId[];
        const step = Number(button.dataset.wardrobeStep);
        view.champion =
          ids[(ids.indexOf(view.champion) + step + ids.length) % ids.length];
        view.preview = undefined;
        view.action = "idle";
        message = "";
        render(`[data-wardrobe-step="${step}"]`, false, true);
      } else if (button.hasAttribute("data-wardrobe-slot")) {
        view.slot = button.dataset.wardrobeSlot as WardrobeView["slot"];
        render(`.wardrobe-filters [data-wardrobe-slot="${view.slot}"]`);
      } else if (button.hasAttribute("data-wardrobe-preview")) {
        const id = button.dataset.wardrobePreview!;
        const item = wardrobeOwned(economy, progress, view.champion).find(
          (i) => i.id === id,
        );
        if (id !== "original" && !item) return;
        view.preview = id;
        view.action =
          item?.slot === "entrance" || item?.slot === "victory"
            ? item.slot
            : "idle";
        message = "";
        render(`[data-wardrobe-preview="${id}"]`, true);
      } else if (button.hasAttribute("data-wardrobe-effects")) {
        view.effects = !view.effects;
        render("[data-wardrobe-effects]", true);
      } else if (button.hasAttribute("data-wardrobe-action")) {
        view.action = button.dataset.wardrobeAction as WardrobeView["action"];
        view.effects = false;
        render(
          matchMedia("(orientation: landscape) and (max-height: 600px)").matches
            ? "[data-wardrobe-effects]"
            : `[data-wardrobe-action="${view.action}"]`,
          true,
        );
      } else if (button.hasAttribute("data-wardrobe-clear")) {
        const slot = button.dataset.wardrobeClear as WardrobeSlot;
        if (WARDROBE_SLOTS.some(([s]) => s === slot))
          void save(
            slot,
            null,
            `.wardrobe-worn-row [data-wardrobe-slot="${slot}"]`,
          );
      } else if (button.hasAttribute("data-wardrobe-save")) {
        const item = wardrobeOwned(economy, progress, view.champion).find(
          (i) => i.id === button.dataset.wardrobeSave,
        );
        if (item)
          void save(
            item.slot,
            button.dataset.wardrobeRemove === "true" ? null : item.id,
            `.wardrobe-filters [data-wardrobe-slot="${view.slot}"]`,
          );
      } else if (button.hasAttribute("data-wardrobe-shop")) hooks.shop();
      else if (button.hasAttribute("data-wardrobe-raids")) hooks.raids();
    },
    { signal: events.signal },
  );
  render();
  return { refresh: () => render(), dispose: cleanup };
}
