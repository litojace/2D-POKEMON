import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import type { RaidBossId } from "../../../../packages/shared/src/raid-roster";
import {
  profileMarkup,
  profileView,
  type ProfileData,
  type ProfileView,
} from "./profile-view";
import { sharePlayerCard } from "./profile-card";
import "./profile.css";

/**
 * The player card's behaviour (UI remodel step 7). Markup comes from
 * profile-view.ts. It opens inside the Lobby as a panel from the HUD's
 * profile button. A title chip wears that title at once (the server's
 * answer, or its reason); Share card draws the card as a picture.
 */
export interface ProfileHooks {
  data(): ProfileData;
  /** Wear a title ("" for none); resolves once data() shows it. */
  equip(titleId: string): Promise<void>;
  /** A guest adds an email; resolves with what to say. */
  save(email: string): Promise<string>;
  /** Load the records again (after a problem). */
  retry(): Promise<void>;
  ranks(): void;
  journey(): void;
  raids(boss?: RaidBossId): void;
  onClose?(): void;
}
export interface ProfileScreen {
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: ProfileView;
}

export function openProfile(hooks: ProfileHooks): ProfileScreen {
  const view = profileView();
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  const root = () => panel.root;

  function render() {
    if (closed) return;
    const next = parse(profileMarkup(view, hooks.data()));
    patch(root(), template, next);
    template = next;
  }
  const focusOn = (selector: string) =>
    root().querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });

  async function equip(id: string) {
    if (view.equipping !== null) return;
    view.equipping = id;
    view.status = "";
    render();
    try {
      await hooks.equip(id);
      view.status = id ? "Title on. Other players see it now." : "Title off.";
    } catch (error) {
      view.status =
        error instanceof Error ? error.message : "That didn't work. Try again.";
    }
    view.equipping = null;
    render();
    focusOn(`[data-profile-title="${CSS.escape(id)}"]`);
  }
  async function share(button: HTMLButtonElement) {
    button.disabled = true;
    try {
      const result = await sharePlayerCard(hooks.data());
      view.status =
        result === "failed"
          ? "This browser couldn't make the picture."
          : result === "downloaded"
            ? "Card saved as a picture; the message is copied."
            : "";
    } catch {
      view.status = "This browser couldn't make the picture.";
    }
    button.disabled = false;
    render();
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.profileTitle !== undefined) void equip(d.profileTitle);
    else if (d.profileShare !== undefined) void share(t);
    else if (d.profileGo || d.profileBoss) {
      const go = d.profileGo,
        boss = d.profileBoss as RaidBossId | undefined;
      panel.close();
      if (go === "ranks") hooks.ranks();
      else if (go === "journey") hooks.journey();
      else hooks.raids(boss);
    } else if (d.profileRetry !== undefined) void hooks.retry().then(render);
  };
  const onSubmit = (event: SubmitEvent) => {
    const form = (event.target as Element).closest<HTMLFormElement>(
      "[data-profile-save]",
    );
    if (!form) return;
    event.preventDefault();
    const email = String(new FormData(form).get("email") ?? "").trim();
    const submit = form.querySelector<HTMLButtonElement>("button")!;
    submit.disabled = true;
    view.saveStatus = "Please wait…";
    render();
    void hooks
      .save(email)
      .then((text) => (view.saveStatus = text))
      .catch(
        (error) =>
          (view.saveStatus =
            error instanceof Error ? error.message : "Couldn't save it."),
      )
      .finally(() => {
        submit.disabled = false;
        render();
      });
  };
  // Arrows move along the title chips (and wrap to the next row).
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (!/^Arrow(Left|Right|Up|Down)$/.test(event.key)) return;
    if (!t.matches(".pf-titles > button")) return;
    const items = Array.from(
      t.parentElement!.querySelectorAll<HTMLButtonElement>(":scope > button"),
    );
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = items[items.indexOf(t as HTMLButtonElement) + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const html = profileMarkup(view, hooks.data());
  template = parse(html);
  panel = openHubPanel(html, {
    onClose: () => {
      closed = true;
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("submit", onSubmit);
  root().addEventListener("keydown", onKey);
  focusOn('.pf-titles > [aria-pressed="true"]');
  return {
    refresh: render,
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}
