import { askConfirm, openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import type { RaidBossId } from "../../../../packages/shared/src/raid-roster";
import {
  DELETE_WORD,
  profileMarkup,
  profileView,
  type ProfileData,
  type ProfileView,
} from "./profile-view";
import { esc } from "../ui/components";
import { sharePlayerCard } from "./profile-card";
import {
  checkName,
  NAME_CHANGE_DAYS,
} from "../../../../packages/shared/src/accounts";
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
  /** Change your name; resolves with the name the server kept. */
  rename(name: string): Promise<string>;
  /** A guest adds an email; resolves with what to say. */
  save(email: string): Promise<string>;
  /** Delete the account for good; resolves once it's gone (signed out). */
  deleteAccount(): Promise<void>;
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

  /** Open or close the name form (focus goes where you'd type or were). */
  function nameForm(open: boolean) {
    view.renaming = open;
    if (open) view.nameMessage = "";
    render();
    const input = root().querySelector<HTMLInputElement>(
      "[data-profile-name-form] input",
    );
    if (open && input) {
      input.value = hooks.data().name;
      input.focus({ preventScroll: true });
      input.select();
    } else focusOn("[data-profile-rename]");
  }
  /** Check the name, ask once more (the next change is 14 days away), send. */
  async function rename(raw: string) {
    if (view.nameBusy) return;
    const current = hooks.data().name;
    const { name, problem } = checkName(raw, current);
    if (problem) {
      view.nameMessage = problem;
      render();
      return;
    }
    const sure = await askConfirm({
      kicker: "Your name",
      title: "Change your name?",
      lines: [
        ["Now", esc(current)],
        ["New", `<b>${esc(name)}</b>`],
      ],
      total: ["Next change", `in ${NAME_CHANGE_DAYS} days`],
      confirm: "Change name",
    });
    if (!sure || closed) return;
    view.nameBusy = true;
    view.nameMessage = "";
    render();
    try {
      const kept = await hooks.rename(name);
      view.renaming = false;
      view.nameMessage = `Name changed. Everyone sees ${kept} now.`;
    } catch (error) {
      view.nameMessage =
        error instanceof Error ? error.message : "That didn't work. Try again.";
    }
    view.nameBusy = false;
    render();
    if (view.renaming)
      root()
        .querySelector<HTMLInputElement>("[data-profile-name-form] input")
        ?.focus({ preventScroll: true });
    else focusOn("[data-profile-rename]");
  }

  /** Open or close the delete form (focus goes to the box or the button). */
  function deleteForm(open: boolean) {
    view.deleting = open;
    view.deleteMessage = "";
    render();
    const input = root().querySelector<HTMLInputElement>(
      "[data-profile-delete-form] input",
    );
    if (open && input) {
      input.value = "";
      input.focus({ preventScroll: true });
      // On a phone the form opens below the fold: bring all of it in.
      input
        .closest("form")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else focusOn("[data-profile-delete]");
  }
  async function deleteAccount(typed: string) {
    if (view.deleteBusy) return;
    if (typed.trim().toUpperCase() !== DELETE_WORD) {
      view.deleteMessage = `Type ${DELETE_WORD} to delete your account.`;
      render();
      return;
    }
    view.deleteBusy = true;
    view.deleteMessage = "Deleting your account…";
    render();
    try {
      await hooks.deleteAccount();
      // Signed out: the card closes with the session.
      if (!closed) panel.close();
    } catch (error) {
      view.deleteBusy = false;
      view.deleteMessage =
        error instanceof Error ? error.message : "That didn't work. Try again.";
      render();
    }
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.profileTitle !== undefined) void equip(d.profileTitle);
    else if (d.profileRename !== undefined) nameForm(true);
    else if (d.profileNameCancel !== undefined) nameForm(false);
    else if (d.profileDelete !== undefined) deleteForm(true);
    else if (d.profileDeleteCancel !== undefined) deleteForm(false);
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
    const deleting = (event.target as Element).closest<HTMLFormElement>(
      "[data-profile-delete-form]",
    );
    if (deleting) {
      event.preventDefault();
      void deleteAccount(String(new FormData(deleting).get("confirm") ?? ""));
      return;
    }
    const named = (event.target as Element).closest<HTMLFormElement>(
      "[data-profile-name-form]",
    );
    if (named) {
      event.preventDefault();
      void rename(String(new FormData(named).get("name") ?? ""));
      return;
    }
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
    // Escape closes the name form before the card.
    if (event.key === "Escape" && view.renaming && !view.nameBusy) {
      event.preventDefault();
      event.stopPropagation();
      nameForm(false);
      return;
    }
    if (event.key === "Escape" && view.deleting && !view.deleteBusy) {
      event.preventDefault();
      event.stopPropagation();
      deleteForm(false);
      return;
    }
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
  // The name's countdown is redrawn while the card is open.
  const tick = setInterval(render, 30_000);
  panel = openHubPanel(html, {
    onClose: () => {
      closed = true;
      clearInterval(tick);
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
