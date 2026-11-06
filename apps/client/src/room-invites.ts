import {
  roomInviteSchema,
  type RoomInvite,
} from "../../../packages/shared/src/accounts";
import { iconLabel } from "./menu-icons";
import "./room-invites.css";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const modeName = {
  duel: "1v1 duel",
  teams: "2v2 teams",
  ffa: "Free-for-all",
  raid: "Boss raid",
  party: "Party",
};

/** Invitations never interrupt a battle or replace an open social/settings screen. */
export class RoomInvites {
  private queue: RoomInvite[] = [];
  private root = document.createElement("aside");
  private expiry?: ReturnType<typeof setTimeout>;
  private joining = false;
  clear() {
    this.queue = [];
    this.render();
  }
  constructor(
    private hooks: {
      accountId: () => string | undefined;
      canJoin: () => boolean;
      /** A declined party invitation (room invitations just expire). */
      decline?: (code: string) => void;
      join: (code: string, mode: RoomInvite["mode"]) => Promise<boolean>;
    },
  ) {
    this.root.className = "room-invite-notice";
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Room invitation");
    this.root.hidden = true;
    if ("showPopover" in this.root) this.root.popover = "manual";
    const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
    new MutationObserver(() => this.mount()).observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
    });
  }
  receive(data: unknown) {
    const parsed = roomInviteSchema.safeParse(data),
      now = Date.now();
    if (
      !parsed.success ||
      !this.hooks.accountId() ||
      parsed.data.fromId === this.hooks.accountId() ||
      parsed.data.expiresAt <= now ||
      parsed.data.expiresAt > now + 120000
    )
      return;
    const invite = parsed.data;
    this.queue = this.queue.filter(
      (item) => item.expiresAt > now && item.fromId !== invite.fromId,
    );
    this.queue.push(invite);
    this.queue = this.queue.slice(0, 4);
    this.render();
  }
  private mount() {
    if (this.root.hidden) return;
    const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
    const parent = dialog.open ? dialog : document.body;
    if (this.root.parentElement !== parent) parent.append(this.root);
    if (this.root.showPopover && !this.root.matches(":popover-open"))
      this.root.showPopover();
  }
  private render() {
    clearTimeout(this.expiry);
    this.queue = this.queue.filter((invite) => invite.expiresAt > Date.now());
    const invite = this.queue[0];
    if (!invite) {
      if (this.root.hidePopover && this.root.matches(":popover-open"))
        this.root.hidePopover();
      this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    const party = invite.mode === "party",
      joinLabel = party ? "Join party" : "Join room";
    this.root.innerHTML = `<div class="room-invite-heading">${iconLabel("friends", party ? "Party invitation" : "Room invitation")}${this.queue.length > 1 ? `<small>${this.queue.length} waiting</small>` : ""}</div><p><b>${escape(invite.name)}</b> ${party ? "invited you to their party" : "invited you to play"}</p><span class="room-invite-mode">${party ? "Stand together in the Lobby, then play" : `${modeName[invite.mode]} · ${invite.code}`}</span><div class="room-invite-actions"><button type="button" class="quiet" data-invite-decline>Decline</button><button type="button" class="primary btn-primary" data-invite-join>${iconLabel("enter", joinLabel)}</button></div><small class="room-invite-status" role="status" aria-live="polite"></small>`;
    this.root.querySelector<HTMLButtonElement>(
      "[data-invite-decline]",
    )!.onclick = () => {
      if (this.joining) return;
      this.queue.shift();
      if (party) this.hooks.decline?.(invite.code);
      this.render();
    };
    this.root.querySelector<HTMLButtonElement>("[data-invite-join]")!.onclick =
      async () => {
        if (this.joining) return;
        const status = this.root.querySelector<HTMLElement>(
          ".room-invite-status",
        )!;
        if (!this.hooks.canJoin()) {
          status.textContent = "Leave your current room before joining.";
          return;
        }
        if (invite.expiresAt <= Date.now()) return this.render();
        this.joining = true;
        const button =
          this.root.querySelector<HTMLButtonElement>("[data-invite-join]")!;
        const decline = this.root.querySelector<HTMLButtonElement>(
          "[data-invite-decline]",
        )!;
        decline.disabled = true;
        button.disabled = true;
        button.textContent = "Joining…";
        try {
          if (await this.hooks.join(invite.code, invite.mode)) {
            this.queue = [];
            this.render();
          } else
            status.textContent = party
              ? "That party is full or no longer open."
              : "Room unavailable. It may be full or already started.";
        } catch {
          status.textContent =
            "Couldn't join. Check your connection and try again.";
        } finally {
          this.joining = false;
          decline.disabled = false;
          button.disabled = false;
          button.innerHTML = iconLabel("enter", joinLabel);
        }
      };
    this.mount();
    this.expiry = setTimeout(
      () => this.render(),
      Math.max(1, invite.expiresAt - Date.now()),
    );
  }
}
