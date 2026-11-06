import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKIN_BY_ID,
  SHOP_BUNDLES,
  isChampionColours,
  ownedOn,
} from "../../../../packages/shared/src/shop";
import {
  lookOn,
  rewardBoss,
  type RaidSlot,
} from "../../../../packages/shared/src/raid";
import { lowGraphics } from "../graphics-quality";
import type { ShopPreviewHandle } from "../shop-preview";
import { itemPicture } from "../shop-ui";
import { askConfirm, openHubPanel, type HubPanel } from "../ui/hub-panel";
import { price, rarityTag } from "../ui/components";
import { parse, patch } from "../ui/patch";
import { previewViewBox, SHOP_PREVIEW } from "../shop-preview-layout";
import {
  dropUnownedTryOns,
  fitItem,
  fitView,
  fittingRoomMarkup,
  ownedFor,
  pendingChanges,
  purchase,
  rarityOf,
  reachedStage,
  stageOutfit,
  wornIn,
  type FitData,
  type FitMode,
  type FitSlot,
  type FitView,
  type ShopSection,
} from "./fitting-room-view";
import "./fitting-room.css";

/**
 * The fitting room's behaviour (UI remodel step 2). Markup comes from
 * fitting-room-view.ts. The screen opens inside the Lobby (openHubPanel),
 * keeps one live fighter renderer on its stage (a still one on Low
 * graphics), and only ever sends the existing calls: /api/shop/buy after
 * askConfirm(), /api/shop/equip for fighter skins and /api/raids/equip for
 * the shared looks. What the server answers is what the screen shows.
 */
export interface FittingRoomHooks {
  /** The player's current state (economy, raid progress, equipped looks). */
  data(): Omit<FitData, "low" | "seenDay">;
  /** Shop Colors are bought for one champion (migration 072). */
  buy(id: string, champion?: CharacterId): Promise<void>;
  equipSkin(
    champion: CharacterId,
    skin: string | null,
    stage?: number,
  ): Promise<void>;
  equipLook(slot: RaidSlot, item: string | null): Promise<void>;
  /** Wear (or take off, null) Shop Colors on one champion. */
  equipColours(champion: CharacterId, item: string | null): Promise<void>;
  /** Make this fighter your Lobby fighter (Mythic Trials count its wins). */
  playAs(champion: CharacterId): void;
  /** Open daily missions (they pay coins). */
  missions(): void;
  /** Load the player's state again. */
  retry(): void;
  notify(message: string): void;
  onClose?(): void;
}
export interface FittingRoomOptions {
  section?: ShopSection;
  champion: CharacterId;
}
export interface FittingRoom {
  /** Switch to the Shop or the Wardrobe (the stage and try-ons stay). */
  show(mode: FitMode, section?: ShopSection): void;
  /** Re-render from fresh data (keeps the canvas, pictures, focus, scroll). */
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: FitView;
}

const SEEN_KEY = "ea-shop-seen-day";
const seenDay = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
/** Attributes that say which control had focus, to find it again after a refresh. */
const FOCUS_KEYS = [
  "data-ui-item",
  "data-ui-section",
  "data-ui-mode",
  "data-ui-own",
  "data-ui-rarity",
  "data-fit-slot",
  "data-fit-fighter",
  "data-fit-collection",
  "data-fit-awaken",
  "data-fit-stars",
  "data-fit-play",
  "data-fit-more",
  "data-fit-buy",
  "data-fit-equip",
  "data-fit-unequip",
  "data-fit-save",
  "data-fit-revert",
];

export function openFittingRoom(
  mode: FitMode,
  hooks: FittingRoomHooks,
  options: FittingRoomOptions,
): FittingRoom {
  const view = fitView(mode, options.champion, {
    section: options.section ?? "today",
  });
  const low = lowGraphics();
  let seen = seenDay();
  /**
   * The state as the fighter on the stage sees it: Colors bought for it
   * count as owned and worn (migration 072). `everyOwned` keeps what is
   * owned for every fighter, which is what a collection set counts.
   */
  const data = (): FitData => {
    const raw = hooks.data();
    const e = raw.economy;
    return {
      ...raw,
      economy: e && {
        ...e,
        owned: ownedOn(e, view.champion),
        everyOwned: e.owned,
      },
      look: lookOn(raw.look, view.champion),
      low,
      seenDay: seen,
    };
  };
  /**
   * The Skin slot on this fighter. Shop Colors bought only for it go in its
   * own slot; anything else in the all-fighter slot, after taking off the
   * fighter's own Colors so the new look shows on it.
   */
  const wearLook = async (slot: RaidSlot, id: string | null) => {
    if (slot !== "skin") return hooks.equipLook(slot, id);
    const raw = hooks.data();
    const own = raw.look.colours?.[view.champion];
    if (id && isChampionColours(id) && !raw.economy?.owned.includes(id))
      return hooks.equipColours(view.champion, id);
    if (own) await hooks.equipColours(view.champion, null);
    // Taking off a fighter's own Colors leaves the all-fighter slot alone.
    if (id || !own) await hooks.equipLook(slot, id);
  };
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  let busy = false;
  let preview: ShopPreviewHandle | undefined;
  let importing = false;
  let previewHost: Element | null = null;

  const root = () => panel.root;
  const q = <T extends HTMLElement>(s: string) => root().querySelector<T>(s);
  const stageEl = () => q<HTMLElement>("[data-fit-region=stage]")!;
  const body = () => q<HTMLElement>("[data-fit-region=body]");

  /* ------------------------------------------------------------ render */
  const markSeen = () => {
    const day = data().economy?.picks.day;
    if (view.mode !== "shop" || view.section !== "today" || !day) return;
    if (seen === day) return;
    seen = day;
    try {
      localStorage.setItem(SEEN_KEY, day);
    } catch {
      /* The NEW tag simply stays. */
    }
  };
  const focusKey = () => {
    const el = document.activeElement;
    if (!el || !root().contains(el)) return "";
    const target = el.closest(FOCUS_KEYS.map((k) => `[${k}]`).join(","));
    if (!target) return "";
    const key = FOCUS_KEYS.find((k) => target.hasAttribute(k))!;
    return `[${key}="${CSS.escape(target.getAttribute(key)!)}"]`;
  };
  const syncRail = () => {
    for (const id of ["shop", "wardrobe"]) {
      const b = document.querySelector<HTMLElement>(
        `.lobby-rail [data-lobby-action="${id}"]`,
      );
      if (!b) continue;
      if (!closed && id === view.mode) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
  };
  function render(resetScroll = false) {
    if (closed) return;
    const key = focusKey();
    const html = fittingRoomMarkup(view, data());
    const next = parse(html);
    keepFrame(template, next);
    patch(root(), template, next);
    template = next;
    root().setAttribute(
      "aria-label",
      view.mode === "shop" ? "Shop" : "Wardrobe",
    );
    if (resetScroll) body()?.scrollTo({ top: 0 });
    // Lost, or on a control that just became disabled (the browser blurs
    // it a moment later).
    const active = document.activeElement as HTMLButtonElement | null;
    if (key && (!root().contains(active) || active?.disabled)) {
      // The same control if it is still usable, else the next action, else
      // the screen itself: focus never falls out to the page.
      const same = q<HTMLButtonElement>(key);
      const target =
        same && !same.disabled
          ? same
          : (q<HTMLElement>(".ui-panel-foot .ui-btn:not([disabled])") ??
            root());
      target.focus({ preventScroll: true });
    }
    afterRender();
  }
  /**
   * Another star level (or tier) on the same frame: update the frame in
   * place, so the portrait under it doesn't flicker and its effects stay.
   * The kept host is copied into the old markup, so patch() leaves it be.
   */
  function keepFrame(prev: HTMLElement, next: HTMLElement) {
    const sel = ".fit-frame-stage";
    const live = q<HTMLElement>(sel);
    const old = prev.querySelector<HTMLElement>(sel);
    const now = next.querySelector<HTMLElement>(sel);
    if (!live || !old || !now) return;
    const disc = (e: Element) => e.querySelector(".portrait-disc");
    if (
      old.dataset.previewItem !== now.dataset.previewItem ||
      old.dataset.previewChampion !== now.dataset.previewChampion ||
      !disc(old)?.isEqualNode(disc(now))
    )
      return;
    const frame = live.querySelector<HTMLElement>(".portrait-frame");
    const nextFrame = now.querySelector<HTMLElement>(".portrait-frame");
    if (!frame || !nextFrame) return;
    for (const name of ["data-tier", "aria-label"])
      live.setAttribute(name, now.getAttribute(name) ?? "");
    for (const name of [
      "class",
      "data-cosmetic",
      "data-portrait-frame",
      "data-frame-stars",
    ])
      if (frame.getAttribute(name) !== nextFrame.getAttribute(name))
        frame.setAttribute(name, nextFrame.getAttribute(name) ?? "");
    frame.dataset.tier = now.dataset.tier;
    const stars = frame.querySelector(":scope > .frame-stars");
    const nextStars = nextFrame.querySelector(":scope > .frame-stars");
    if (!stars?.isEqualNode(nextStars)) {
      stars?.remove();
      if (nextStars) frame.append(nextStars.cloneNode(true));
    }
    old.replaceWith(now.cloneNode(true));
  }
  /**
   * Frame the stage light (and the still fighter) on the stage's real size,
   * as the live rig frames its camera (shop-preview.ts resizeStage): the
   * markup can only carry the default size, and the light, unlike the still
   * fighter, stays in view over the rig.
   */
  function frameStage() {
    const host = stageEl()?.querySelector<HTMLElement>(
      ".shop-live-stage:not(.is-frame)",
    );
    if (!host) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const box = previewViewBox(
      host.dataset.previewAction ?? "idle",
      Math.max(1, Math.round((SHOP_PREVIEW.width * height) / width)),
    );
    host
      .querySelectorAll(":scope > .stage-light, .shop-preview-fallback > svg")
      .forEach((svg) => svg.setAttribute("viewBox", box));
  }
  const stageSize = new ResizeObserver(() => frameStage());
  function afterRender() {
    markSeen();
    syncRail();
    frameStage();
    const stage = stageEl();
    const host = stage.querySelector(".shop-live-stage");
    if (low) return;
    if (preview) {
      if (host !== previewHost) {
        preview.update(stage);
        previewHost = host;
      }
    } else if (!importing) {
      importing = true;
      void import("../shop-preview")
        .then(({ mountShopPreview }) => {
          if (closed) return;
          preview = mountShopPreview(stageEl());
          previewHost = stageEl().querySelector(".shop-live-stage");
        })
        .catch(() => {
          // The still fighter stays: the screen works without the live rig.
        });
    }
  }
  const say = (message: string, failed = false) => {
    const box = q<HTMLElement>(".fit-status");
    if (box) {
      box.textContent = message;
      box.setAttribute("role", failed ? "alert" : "status");
    }
    hooks.notify(message);
  };
  /** Run a server call; the screen re-renders from what the server answered. */
  const work = async (
    button: HTMLElement | null,
    job: () => Promise<string>,
  ) => {
    if (busy) return;
    busy = true;
    root().setAttribute("aria-busy", "true");
    button?.setAttribute("aria-busy", "true");
    try {
      const message = await job();
      if (closed) return;
      render();
      if (message) say(message);
    } catch (error) {
      if (closed) return;
      render();
      say(
        error instanceof Error ? error.message : "That didn't work. Try again.",
        true,
      );
    } finally {
      busy = false;
      if (!closed) {
        root().removeAttribute("aria-busy");
        button?.removeAttribute("aria-busy");
      }
    }
  };

  /* ---------------------------------------------------------- try-on */
  const setChampion = (c: CharacterId) => {
    if (c === view.champion) return;
    view.champion = c;
    delete view.tryOn.champion;
    view.stage = undefined;
    const sel = view.selected ? CHAMPION_SKIN_BY_ID[view.selected] : undefined;
    if (sel && sel.champion !== c) view.selected = null;
  };
  const tryOn = (id: string) => {
    if (id === "original") {
      view.tryOn.champion = null;
      view.stage = undefined;
      view.selected = null;
      view.action = "idle";
      return;
    }
    if (id === "none") {
      view.tryOn[view.slot] = null;
      if (view.selected && fitItem(view.selected)?.slot === view.slot)
        view.selected = null;
      view.action = "idle";
      return;
    }
    const set = SHOP_BUNDLES.find((b) => b.id === id);
    if (set) {
      for (const piece of set.items) {
        const item = fitItem(piece);
        if (item) view.tryOn[item.slot] = piece;
      }
      view.selected = id;
      view.action = "idle";
      return;
    }
    const item = fitItem(id);
    if (!item) return;
    const skin = CHAMPION_SKIN_BY_ID[id];
    if (skin) setChampion(skin.champion);
    if (item.slot === "champion" && view.tryOn.champion !== id)
      view.stage = undefined;
    if (view.selected !== id) view.frameStars = undefined;
    view.tryOn[item.slot] = id;
    view.selected = id;
    view.action =
      item.slot === "entrance" || item.slot === "victory" ? item.slot : "idle";
  };
  /** The Frame slot shows a frame on the stage: the one worn, else a boss frame. */
  const pickFrame = () => {
    const d = data();
    if (!d.economy) return;
    if (view.selected && fitItem(view.selected)?.slot === "frame") return;
    const frames = ownedFor("frame", view.champion, d.economy, d.progress);
    const shown =
      "frame" in view.tryOn ? view.tryOn.frame : wornIn("frame", view, d);
    view.selected =
      frames.find((i) => i.id === shown)?.id ??
      frames.find((i) => rewardBoss(i.id))?.id ??
      frames[0]?.id ??
      null;
    view.frameStars = undefined;
  };
  const setSlot = (slot: FitSlot) => {
    view.slot = slot;
    if (slot === "frame") pickFrame();
    else if (view.selected && fitItem(view.selected)?.slot === "frame")
      view.selected = null;
  };
  const setMode = (mode: FitMode) => {
    if (mode === view.mode) return;
    view.mode = mode;
    if (mode !== "wardrobe") return;
    // A Shop skin of another fighter brought that fighter on: your own
    // fighter comes back with your look.
    if (dropUnownedTryOns(view, data())) setChampion(options.champion);
    if (view.slot === "frame") pickFrame();
  };

  /* -------------------------------------------------------- spending */
  const buy = async (button: HTMLElement, id: string) => {
    const e = data().economy;
    const p = e ? purchase(id, e) : null;
    if (!e || !p || p.locked || p.short) return;
    const set = SHOP_BUNDLES.find((b) => b.id === id);
    const item = fitItem(id);
    const skin = CHAMPION_SKIN_BY_ID[id];
    const colours = isChampionColours(id);
    const who = CHARACTERS[view.champion].name;
    const art = set
      ? `<span class="fit-confirm-set">${set.items.map((i) => itemPicture(i, view.champion, `fit-confirm-${i}`)).join("")}</span>`
      : itemPicture(id, skin?.champion ?? view.champion, `fit-confirm-${id}`);
    const answer = askConfirm({
      kicker: "Confirm purchase",
      title: set?.name ?? item?.name ?? id,
      sub: set
        ? `<span class="ui-note">${set.items.length} pieces for every fighter</span>`
        : colours
          ? `${rarityTag(rarityOf(id))}<span class="ui-note">For ${who} only</span>`
          : `${rarityTag(rarityOf(id))}<span class="ui-note">${item?.source ?? ""}</span>`,
      art,
      lines: [
        ["Price", price(p.price, p.was)],
        ["Your coins", p.unlimited ? "Unlimited" : price(p.balance)],
      ],
      total: ["After", p.unlimited ? "Unlimited" : price(p.after)],
      extra: set
        ? '<p class="ui-note">20% off the pieces you don\'t own yet. Its Colors are for every fighter.</p>'
        : `${colours ? `<p class="ui-note">These colors are for ${who} only: buy them again for another fighter, or get the whole set for every fighter.</p>` : ""}<label class="fit-wear"><input type="checkbox" data-fit-wear checked> Wear it now</label>${p.unlimited ? '<p class="ui-note">Testing: purchases don\'t spend coins.</p>' : ""}`,
      confirm: "Buy",
      confirmAfter: price(p.price),
    });
    // The confirmation is on the page now; note the "Wear it now" box.
    const box = document.querySelector<HTMLInputElement>(
      "[data-ui-confirm] [data-fit-wear]",
    );
    let wear = !!box?.checked;
    box?.addEventListener("change", () => (wear = box.checked));
    if (!(await answer) || closed) return;
    await work(button, async () => {
      await hooks.buy(id, colours ? view.champion : undefined);
      const name = set?.name ?? item?.name ?? "It";
      if (!set && item && wear) {
        try {
          await equip(id);
        } catch (error) {
          throw new Error(
            `${name} is yours, but it couldn't be put on: ${error instanceof Error ? error.message : "try Equip again."}`,
          );
        }
        return `${name} ${colours ? `are ${who}'s` : "is yours"}, and you're wearing ${colours ? "them" : "it"}.`;
      }
      return set
        ? `${name}: every piece is yours.`
        : colours
          ? `${name} are ${who}'s.`
          : `${name} is yours.`;
    });
  };
  /** Wear one owned item now (the Shop's Equip). */
  const equip = async (id: string) => {
    const item = fitItem(id)!;
    const skin = CHAMPION_SKIN_BY_ID[id];
    if (skin) {
      const stage =
        view.tryOn.champion === id && view.stage
          ? Math.min(view.stage, reachedStage(id, data().economy))
          : reachedStage(id, data().economy);
      await hooks.equipSkin(skin.champion, id, stage);
      if (skin.champion === view.champion) {
        delete view.tryOn.champion;
        view.stage = undefined;
      }
    } else {
      await wearLook(item.slot as RaidSlot, id);
      delete view.tryOn[item.slot];
    }
  };
  const unequip = async (id: string) => {
    const item = fitItem(id)!;
    const skin = CHAMPION_SKIN_BY_ID[id];
    if (skin) {
      await hooks.equipSkin(skin.champion, null);
      if (skin.champion === view.champion) {
        delete view.tryOn.champion;
        view.stage = undefined;
      }
    } else {
      await wearLook(item.slot as RaidSlot, null);
      delete view.tryOn[item.slot];
    }
  };
  /** The Wardrobe's Equip: save every pending change, one call each. */
  const save = async () => {
    const changes = pendingChanges(view, data());
    let saved = 0;
    for (const c of changes) {
      if (c.slot === "champion")
        await hooks.equipSkin(view.champion, c.to, c.to ? c.stage : undefined);
      else await wearLook(c.slot as RaidSlot, c.to);
      delete view.tryOn[c.slot];
      if (c.slot === "champion") view.stage = undefined;
      saved++;
    }
    // A previewed star level is never saved; show the frame as it is.
    view.frameStars = undefined;
    view.selected = view.slot === "frame" ? view.selected : null;
    return `${CHARACTERS[view.champion].name}: ${saved} change${saved === 1 ? "" : "s"} saved.`;
  };

  /* ----------------------------------------------------------- input */
  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLElement>(
      "button, [data-ui-item]",
    );
    if (!t || !root().contains(t) || (t as HTMLButtonElement).disabled) return;
    const d = t.dataset;
    if (busy && !d.uiSection && !d.uiMode) return;
    let scroll = false;
    if (d.uiMode) {
      setMode(d.uiMode as FitMode);
      scroll = true;
    } else if (d.uiSection) {
      view.section = d.uiSection as ShopSection;
      scroll = true;
    } else if (d.uiItem) {
      tryOn(d.uiItem);
      if (view.action !== "idle") preview?.replay();
    } else if (d.fitFighter) setChampion(d.fitFighter as CharacterId);
    else if (d.fitSlot) {
      if (view.mode !== "wardrobe") {
        setMode("wardrobe");
        scroll = true;
      }
      setSlot(d.fitSlot as FitSlot);
    } else if (d.fitMore) {
      view.mode = "shop";
      if (d.fitMore === "champion") {
        view.section = "skins";
        view.ownership = "unowned";
      } else view.section = "collections";
      scroll = true;
    } else if (d.fitPlay) {
      view.action =
        view.action === d.fitPlay ? "idle" : (d.fitPlay as FitView["action"]);
      render();
      if (view.action !== "idle") preview?.replay();
      return;
    } else if (d.fitAwaken) {
      // Choosing a stage tries the shown Mythical on at that stage, so it
      // counts as a change (Equip saves it if reached; Revert undoes it).
      const shown = stageOutfit(view, data()).skin?.skin;
      if (shown) view.tryOn.champion = shown;
      view.stage = Number(d.fitAwaken);
    } else if (d.fitStars !== undefined) view.frameStars = Number(d.fitStars);
    else if (d.fitCollection) {
      view.collection = d.fitCollection as FitView["collection"];
      tryOn(`${view.collection}-colours`);
    } else if (d.uiOwn) view.ownership = d.uiOwn as FitView["ownership"];
    else if (d.uiRarity) view.rarity = d.uiRarity as FitView["rarity"];
    else if (d.fitReset !== undefined) {
      view.ownership = "all";
      view.rarity = "all";
    } else if (d.fitRevert !== undefined) {
      // Back to what you wear. In the Shop a skin of another fighter took
      // the stage with it: back to your own fighter too.
      if (view.mode === "shop") setChampion(options.champion);
      view.tryOn = {};
      view.stage = undefined;
      view.frameStars = undefined;
      view.action = "idle";
      if (view.selected && fitItem(view.selected)?.slot !== "frame")
        view.selected = null;
    } else if (d.fitBuy) return void buy(t, d.fitBuy);
    else if (d.fitEquip) {
      const id = d.fitEquip;
      return void work(t, async () => {
        await equip(id);
        return `${fitItem(id)?.name ?? "It"} equipped${CHAMPION_SKIN_BY_ID[id] ? ` on ${CHARACTERS[CHAMPION_SKIN_BY_ID[id].champion].name}` : isChampionColours(id) && !hooks.data().economy?.owned.includes(id) ? ` on ${CHARACTERS[view.champion].name}` : " for every fighter"}.`;
      });
    } else if (d.fitUnequip) {
      const id = d.fitUnequip;
      return void work(t, async () => {
        await unequip(id);
        return `${fitItem(id)?.name ?? "It"} taken off.`;
      });
    } else if (d.fitSave !== undefined) return void work(t, save);
    else if (d.fitMissions !== undefined) return hooks.missions();
    else if (d.fitPlayAs) {
      const c = d.fitPlayAs as CharacterId;
      hooks.playAs(c);
      hooks.notify(
        `You play as ${CHARACTERS[c].name}. Wins with them count for the Mythic Trial.`,
      );
      return;
    } else if (d.fitRetry !== undefined) return hooks.retry();
    else return;
    render(scroll);
  };

  // Hold to compare: the original look while pressed (pointer or key).
  const compare = (on: boolean) => {
    const b = q<HTMLButtonElement>("[data-preview-compare]");
    if (!b || !low) return;
    b.setAttribute("aria-pressed", String(on));
    const stage = stageEl();
    const [shown, original] = Array.from(
      stage.querySelectorAll<HTMLElement>(
        ".shop-live-stage > .shop-preview-fallback",
      ),
    );
    if (shown && original) {
      shown.hidden = on;
      original.hidden = !on;
    }
  };
  const onDown = (event: PointerEvent) => {
    if ((event.target as Element).closest("[data-preview-compare]"))
      compare(true);
  };
  const onUp = () => compare(false);

  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (
      (event.key === " " || event.key === "Enter") &&
      !event.repeat &&
      t.matches("[data-preview-compare]")
    ) {
      event.preventDefault();
      compare(true);
      return;
    }
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = arrows[event.key];
    if (!step) return;
    // Tabs, choices and grids move with the arrow keys.
    const group = t.closest<HTMLElement>(
      ".ui-tabs, .fit-slots, .ui-seg, .ui-chips, .ui-grid, .fit-stars, .fit-awaken",
    );
    if (!group || !root().contains(group)) return;
    const items = Array.from(
      group.querySelectorAll<HTMLElement>(":scope > button"),
    ).filter((b) => !(b as HTMLButtonElement).disabled);
    const i = items.indexOf(t.closest(":scope > button") ?? t);
    if (i < 0) return;
    let cols = items.length;
    if (group.classList.contains("ui-grid"))
      cols = getComputedStyle(group).gridTemplateColumns.split(" ").length;
    else if (step[1]) return;
    const next = items[i + step[0] + step[1] * cols];
    if (!next) return;
    event.preventDefault();
    next.focus();
    // Tabs follow focus (automatic activation).
    if (next.getAttribute("role") === "tab") next.click();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") compare(false);
  };

  /* ------------------------------------------------------------ open */
  if (view.mode === "wardrobe") setSlot(view.slot);
  const html = fittingRoomMarkup(view, data());
  template = parse(html);
  panel = openHubPanel(html, {
    rail: view.mode,
    onClose: () => {
      closed = true;
      stageSize.disconnect();
      clearInterval(clock);
      preview?.();
      preview = undefined;
      syncRail();
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("pointerdown", onDown);
  root().addEventListener("pointerup", onUp);
  root().addEventListener("pointercancel", onUp);
  root().addEventListener("pointerleave", onUp);
  root().addEventListener("keydown", onKey);
  root().addEventListener("keyup", onKeyUp);
  // Countdowns (server time) move on while the screen is open.
  const clock = setInterval(() => render(), 30_000);
  afterRender();
  stageSize.observe(root());

  return {
    show(mode, section) {
      if (closed) return;
      const changed =
        mode !== view.mode || (!!section && section !== view.section);
      setMode(mode);
      if (section) view.section = section;
      render(changed);
    },
    refresh: () => render(),
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}
