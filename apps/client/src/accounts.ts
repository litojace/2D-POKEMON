import { fighterAvatar } from "./fighter-art";
import { openWardrobe } from "./wardrobe";
import {
  adventureMarkup,
  type AdventureTab,
  type AdventureView,
} from "./adventure-ui";
import {
  playerLevel,
  JOURNEY_ITEM_BY_ID,
  seasonTheme,
} from "../../../packages/shared/src/journey";
import { formSubmitButton } from "./dialog";
import { raidAppearance, raidCosmeticOptions } from "./raid-ui";
import {
  raidBossPageMarkup,
  raidHubMarkup,
  type RaidHubTab,
} from "./raid-hub";
import { iconLabel } from "./menu-icons";
import {
  coinChip,
  coins,
  lookSlot,
  shopMarkup,
  shopPreviewMarkup,
  previewItem,
  type ShopTab,
  type ShopView,
} from "./shop-ui";
import { missionsMarkup } from "./missions-ui";
import {
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEM_BY_ID,
  type Economy,
} from "../../../packages/shared/src/shop";
import {
  RAID_COSMETICS,
  pacificDate,
  raidLookOf,
  type RaidBossId,
  type RaidCosmetic,
  type RaidLoadout,
  type RaidProgress,
  type RaidSlot,
} from "../../../packages/shared/src/raid";
import {
  TITLE_PRESETS,
  sortTitles,
  titlePickerMarkup,
  updateNameplate,
} from "./player-nameplate";
import { isQuietRefresh } from "./session-refresh";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  accountSchema,
  REPORT_CATEGORIES,
  type Account,
  type Title,
  type PlayerDirectory,
  type ReportList,
  type OnlineList,
  leaderboardSchema,
  progressSchema,
  friendsSchema,
  friendCode,
} from "../../../packages/shared/src/accounts";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { renderOnline } from "./admin-online";
import { leaderboardMarkup, progressMarkup, seasonName } from "./progress-view";
import { friendsScreenMarkup, type FriendsRoom } from "./friends-view";
import { FriendsHub } from "./friends-hub";
const EYE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
const EYE_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
/** Password input with an eye button inside the box to show or hide it. */
const passwordField = (label: string, name: string, attrs: string) =>
  `<label class="auth-field"><span>${label}</span><span class="password-field"><input name="${name}" type="password" ${attrs}><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false" title="Show password">${EYE}</button></span></label>`;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
/** Google sign-in is hidden until it is set up in Supabase (see docs/accounts-setup.md). */
const GOOGLE_SIGN_IN = import.meta.env.VITE_GOOGLE_SIGN_IN === "on";
const storageKey = "parena-auth";
const storage = {
  getItem: (key: string) =>
    localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    (localStorage.getItem("parena-remember") === "yes"
      ? localStorage
      : sessionStorage
    ).setItem(key, value);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
function remember(value: boolean) {
  const token = storage.getItem(storageKey);
  storage.removeItem(storageKey);
  if (value) localStorage.setItem("parena-remember", "yes");
  else localStorage.removeItem("parena-remember");
  if (token) storage.setItem(storageKey, token);
}
type Hooks = {
  openDialog: (html: string) => void;
  /** Join or watch a friend's room from the friends list. */
  joinRoom?: (code: string) => void;
  watchRoom?: (code: string) => void;
  friendsRoom?: () => FriendsRoom;
  createFriendRoom?: () => void;
  inviteFriend?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  notify: (message: string) => void;
  onChange: () => void;
  onSession: (token: string | null, accountId?: string) => void;
  /** Same player, fresh token (background refresh): keep it for reconnects only. */
  onToken: (token: string) => void;
  beforeSignOut: () => Promise<void>;
  selectedCharacter?: () => CharacterId;
  /** Create a raid room for a boss (today's challenge, or straight in solo). */
  startAdventure?: (mode: string) => void;
  startRaid?: (
    boss: RaidBossId,
    options: { solo?: boolean; drill?: string; returnTab?: RaidHubTab },
  ) => void;
};
export class AccountUI {
  account: Account | null = null;
  /** The saved session has been checked (and the profile loaded, or failed). */
  checked = false;
  /** Equipped raid look (undefined until loaded). */
  raidLook: RaidLoadout | undefined = undefined;
  /** Coins, owned items, missions (undefined until loaded or before migration 010). */
  economy: Economy | undefined = undefined;
  session: Session | null = null;
  private confirmedGuestLogout = false;
  generation = 0;
  private sessionLoad:
    | { accountId: string | null; promise: Promise<void> }
    | undefined;
  client =
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
      ? createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              storage,
              storageKey,
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          },
        )
      : null;
  constructor(private hooks: Hooks) {
    this.renderNav();
    if (!this.client) {
      this.checked = true;
      hooks.onSession(null);
      return;
    }
    this.client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void this.setSession(session).then(() => {
          if (event === "PASSWORD_RECOVERY") this.showAuth("reset");
        });
      }, 0);
    });
    void this.client.auth
      .getSession()
      .then(({ data }) => this.setSession(data.session));
    if (location.pathname === "/email-confirmed")
      hooks.notify("Email confirmed. You can now log in.");
  }
  setSession(session: Session | null, force = false): Promise<void> {
    // Sign-in returns a session and also raises SIGNED_IN. Share the pending
    // profile load instead of reconnecting twice before the profile arrives.
    const accountId = session?.user.id ?? null;
    if (!force && this.sessionLoad?.accountId === accountId) {
      this.session = session;
      if (session) this.hooks.onToken(session.access_token);
      return this.sessionLoad.promise;
    }
    const loading = { accountId, promise: this.loadSession(session, force) };
    this.sessionLoad = loading;
    const clear = () => {
      if (this.sessionLoad === loading) this.sessionLoad = undefined;
    };
    void loading.promise.then(clear, clear);
    return loading.promise;
  }
  private async loadSession(session: Session | null, force: boolean) {
    // Supabase re-announces the session on every background token refresh and
    // whenever the tab regains focus. For the same signed-in player nothing on
    // screen changes: keep the fresh token quietly instead of reloading the
    // profile, re-rendering the menu and reconnecting the game socket.
    if (
      session &&
      isQuietRefresh(this.session, session, !!this.account, force)
    ) {
      this.session = session;
      this.hooks.onToken(session.access_token);
      return;
    }
    const version = ++this.generation;
    // Reloading the same player (after a purchase, an equip, a title change…)
    // keeps what's on screen until the fresh copy arrives. Clearing it first
    // made an open Shop say "Log in" and ask a signed-in player to sign in.
    const samePlayer =
      !!session && !!this.account && session.user?.id === this.account.id;
    this.session = session;
    if (!samePlayer) {
      // A previous signed-out check says nothing about this new profile load.
      // Keep the gate in its loading state until this request has completed.
      this.checked = false;
      this.wardrobePanel?.dispose();
      this.wardrobePanel = undefined;
      const wardrobe = document.querySelector<HTMLDialogElement>(
        "dialog:has(.wardrobe)",
      );
      wardrobe?.close();
      this.account = null;
      this.raidLook = undefined;
      this.economy = undefined;
    }
    this.hooks.onSession(session?.access_token ?? null, session?.user.id);
    if (session && !samePlayer) this.hooks.onChange();
    if (session) {
      try {
        const account = accountSchema.parse(await this.api("/api/account"));
        if (version !== this.generation) return;
        this.account = account;
        try {
          const progress = (await this.api("/api/raids")) as RaidProgress;
          if (version !== this.generation) return;
          this.raidLook = raidLookOf(progress);
        } catch {
          /* Raid storage is optional until migration 007 is installed. */
        }
        try {
          const economy = (await this.api("/api/economy")) as Economy;
          if (version !== this.generation) return;
          this.economy = economy;
        } catch {
          /* The Shop needs migration 010. */
        }
        // An open Shop or Missions screen shows the fresh copy.
        this.shopRefresh?.();
        this.missionsRefresh?.();
        this.adventureRefresh?.();
        this.wardrobePanel?.refresh();
      } catch (error) {
        if (version !== this.generation) return;
        this.hooks.notify(
          error instanceof Error
            ? error.message
            : "Unable to load your profile.",
        );
      }
    }
    this.checked = true;
    if (this.account) {
      try {
        localStorage.setItem("arena-has-account", "yes");
      } catch {
        /* optional */
      }
    }
    this.renderNav();
    this.hooks.onChange();
  }
  async refresh() {
    await this.setSession(this.session, true);
  }
  async api(path: string, body?: unknown): Promise<unknown> {
    const origin = import.meta.env.VITE_SERVER_URL || location.origin;
    const response = await fetch(new URL(path, origin), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${this.session?.access_token ?? ""}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Request failed.");
    return value;
  }
  ensurePlayer() {
    if (!this.account) {
      this.showAuth("login");
      return false;
    }
    return true;
  }
  renderNav() {
    const root = element("account-nav");
    if (!root) return;
    root.innerHTML = this.account
      ? `<button class="quiet coin-button" id="account-coins" aria-label="Shop: ${this.economy?.unlimitedCoins ? "unlimited" : this.economy ? coins(this.economy.balance) : "your"} coins">${coinChip(this.economy?.balance, "", this.economy?.unlimitedCoins)}</button><button class="quiet" id="account-profile"><span class="account-avatar" data-champion="${this.hooks.selectedCharacter?.() ?? "voltkit"}" aria-hidden="true">${fighterAvatar(this.hooks.selectedCharacter?.() ?? "voltkit", "account-nav", this.economy?.looks[this.hooks.selectedCharacter?.() ?? "voltkit"])}</span><span class="account-name">${escape(this.account.displayName)}</span>${this.economy?.journey ? `<small class="nav-level">Lv ${playerLevel(this.economy.journey.xp).level}</small><span class="nav-xp" aria-hidden="true"><i style="width:${Math.round(playerLevel(this.economy.journey.xp).percent)}%"></i></span>` : ""}${this.account.title ? `<small class="nav-title" style="color:${escape(this.account.titleColor ?? "#ffe58f")}">${escape(this.account.title)}</small>` : ""}</button>${this.account.isAdmin ? `<button class="quiet" id="account-admin" aria-label="Admin" title="Admin">${iconLabel("admin", "Admin")}</button>` : ""}<button class="quiet" id="account-logout" aria-label="Log out" title="Log out">${iconLabel("leave", "Log out")}</button>`
      : `<button class="quiet" id="account-login">${iconLabel("enter", "Log in")}</button><button class="secondary" id="account-signup">${iconLabel("add-friend", "Sign up")}</button>`;
    if (this.account) {
      element("account-profile").onclick = () => void this.showProfile();
      element("account-coins").onclick = () => void this.showShop();
      element("account-logout").onclick = async () => {
        if (this.account?.guest && !this.confirmedGuestLogout) {
          this.hooks.openDialog(
            `<div class="eyebrow">Guest account</div><h2>Log out of your guest pass?</h2><p>Guest accounts can't be recovered after logging out: your records and titles would be lost. Save your account with an email first to keep them.</p><div class="dialog-actions"><button class="primary" id="guest-save">${iconLabel("save", "Save my account")}</button><button class="secondary" id="guest-leave">${iconLabel("leave", "Log out anyway")}</button></div>`,
          );
          element("guest-save").onclick = () => void this.showProfile();
          element("guest-leave").onclick = () => {
            this.confirmedGuestLogout = true;
            element<HTMLDialogElement>("dialog").close();
            element("account-logout")?.click();
          };
          return;
        }
        this.confirmedGuestLogout = false;
        await this.hooks.beforeSignOut();
        const result = await this.client?.auth.signOut({ scope: "local" });
        if (result?.error) {
          this.hooks.notify(result.error.message);
          return;
        }
        storage.removeItem(storageKey);
        await this.setSession(null);
      };
      if (this.account.isAdmin)
        element("account-admin").onclick = () => void this.showAdmin();
    } else {
      element("account-login").onclick = () => this.showAuth("login");
      element("account-signup").onclick = () => this.showAuth("signup");
    }
  }
  showAuth(mode: "login" | "signup" | "forgot" | "reset") {
    const copy = {
      login: ["Welcome back", "Log in to step back into Elemental Plaza."],
      signup: ["Create your account", "Free to play. Your level, skins and friends follow you everywhere."],
      forgot: ["Reset your password", "Enter your email and we'll send you a recovery link."],
      reset: ["Choose a new password", "Use at least 8 characters."],
    }[mode];
    const field = (label: string, input: string) => `<label class="auth-field"><span>${label}</span>${input}</label>`;
    const tabs =
      mode === "login" || mode === "signup"
        ? `<div class="auth-tabs" role="tablist" aria-label="Account">${(["login", "signup"] as const).map((m) => `<button type="button" role="tab" data-auth-tab="${m}" aria-selected="${m === mode}">${m === "login" ? "Log in" : "Create account"}</button>`).join("")}</div>`
        : "";
    const fields = [
      mode === "signup" ? field("Display name", '<input name="displayName" maxlength="20" required autocomplete="nickname" placeholder="Your player name">') : "",
      mode !== "reset" ? field("Email", '<input name="email" type="email" required autocomplete="email" placeholder="you@example.com">') : "",
      mode !== "forgot" ? passwordField(mode === "reset" ? "New password" : "Password", "password", `${mode === "login" ? "" : 'minlength="8"'} maxlength="128" required autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="${mode === "login" ? "Your password" : "8+ characters"}"`) : "",
      mode === "signup" || mode === "reset" ? passwordField("Confirm password", "confirmPassword", 'minlength="8" maxlength="128" required autocomplete="new-password" placeholder="Type it again"') : "",
    ].join("");
    const extras =
      mode === "login"
        ? '<div class="auth-row"><label class="auth-check"><input id="auth-remember" type="checkbox"><span>Remember me</span></label><button type="button" class="auth-link" id="auth-forgot">Forgot password?</button></div>'
        : "";
    const submitLabel = { login: "Log in", signup: "Create account", forgot: "Send recovery link", reset: "Update password" }[mode];
    const guest =
      (mode === "login" || mode === "signup") && this.client
        ? `<div class="auth-divider"><span>or</span></div><form id="guest-form" class="auth-guest"><input name="nickname" maxlength="20" placeholder="Nickname (optional)" autocomplete="nickname" aria-label="Guest nickname"><button class="auth-secondary" type="submit">${iconLabel("user", "Play as a guest")}</button></form><p class="auth-note">No email needed. Save your account later from your profile to keep your progress.</p>`
        : "";
    const back = mode === "forgot" || mode === "reset" ? '<button type="button" class="auth-link auth-back" id="auth-switch">← Back to log in</button>' : "";
    const html = `<section class="auth-panel" data-mode="${mode}"><div class="auth-head"><span class="auth-crest" aria-hidden="true"><svg viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><div class="auth-title">${copy[0]}</div><p>${copy[1]}</p></div>${tabs}${!this.client ? '<p class="auth-warning">Sign-in isn\'t available right now. Please try again later.</p>' : ""}<form id="auth-form" class="auth-form">${fields}${extras}<button class="auth-submit" type="submit" ${!this.client ? "disabled" : ""}>${submitLabel}</button>${GOOGLE_SIGN_IN && (mode === "login" || mode === "signup") ? `<button id="auth-google" class="auth-secondary" type="button" ${!this.client ? "disabled" : ""}>Continue with Google</button>` : ""}<p id="auth-message" class="auth-message" role="status"></p></form>${guest}${back}</section>`;
    // On the welcome screen the panel sits in the page; elsewhere in a dialog.
    const host = document.getElementById("gate-auth");
    if (host) host.innerHTML = html;
    else this.hooks.openDialog(html);
    document.querySelectorAll<HTMLButtonElement>("[data-auth-tab]").forEach((tab) => {
      tab.onclick = () => this.showAuth(tab.dataset.authTab as "login" | "signup");
    });
    document.getElementById("auth-switch")?.addEventListener("click", () => this.showAuth("login"));
    if (mode === "login") {
      element("auth-forgot").onclick = () => this.showAuth("forgot");
      element<HTMLInputElement>("auth-remember").checked =
        localStorage.getItem("parena-remember") === "yes";
    }
    const form = element<HTMLFormElement>("auth-form");
    const message = element("auth-message");
    const submit = formSubmitButton(form);
    const site = import.meta.env.VITE_SITE_URL || location.origin;
    // Each password box has its own eye toggle.
    form
      .querySelectorAll<HTMLButtonElement>(".password-toggle")
      .forEach((toggle) => {
        toggle.onclick = () => {
          const field = toggle.parentElement!.querySelector("input")!;
          const show = field.type === "password";
          field.type = show ? "text" : "password";
          toggle.innerHTML = show ? EYE_OFF : EYE;
          toggle.setAttribute("aria-pressed", String(show));
          toggle.setAttribute(
            "aria-label",
            show ? "Hide password" : "Show password",
          );
          toggle.title = show ? "Hide password" : "Show password";
          field.focus();
        };
      });
    if (GOOGLE_SIGN_IN && (mode === "login" || mode === "signup"))
      element("auth-google").onclick = async () => {
        if (!this.client) return;
        remember(
          mode === "login" &&
            element<HTMLInputElement>("auth-remember").checked,
        );
        const { error } = await this.client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: new URL("/auth/callback", site).toString() },
        });
        if (error) message.textContent = error.message;
      };
    const guestForm = element<HTMLFormElement>("guest-form");
    if (guestForm)
      guestForm.onsubmit = async (event) => {
        event.preventDefault();
        if (!this.client) return;
        const button = formSubmitButton(guestForm);
        const nickname = String(
          new FormData(guestForm).get("nickname") ?? "",
        ).trim();
        button.disabled = true;
        message.textContent = "Setting up your guest pass…";
        // Keep the guest login on this device: it can't be recovered later.
        remember(true);
        const { data, error } = await this.client.auth.signInAnonymously(
          nickname ? { options: { data: { display_name: nickname } } } : {},
        );
        button.disabled = false;
        if (error) {
          message.textContent = /anonymous/i.test(error.message)
            ? "Guest play isn't switched on yet. Please sign up or log in."
            : error.message;
          return;
        }
        await this.setSession(data.session);
        element<HTMLDialogElement>("dialog").close();
        this.hooks.notify(
          "You're playing as a guest. Save your account from your profile any time to keep your progress.",
        );
      };
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!this.client) return;
      const fields = new FormData(form),
        email = String(fields.get("email") ?? ""),
        password = String(fields.get("password") ?? "");
      if (
        (mode === "signup" || mode === "reset") &&
        password !== fields.get("confirmPassword")
      ) {
        message.textContent = "Passwords do not match.";
        return;
      }
      submit.disabled = true;
      message.textContent = "Please wait…";
      try {
        if (mode === "login") {
          remember(element<HTMLInputElement>("auth-remember").checked);
          const result = await this.client.auth.signInWithPassword({
            email,
            password,
          });
          if (result.error) throw result.error;
          await this.setSession(result.data.session);
          element<HTMLDialogElement>("dialog").close();
        }
        if (mode === "signup") {
          remember(false);
          const result = await this.client.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: String(fields.get("displayName") ?? "").trim(),
              },
              emailRedirectTo: new URL("/email-confirmed", site).toString(),
            },
          });
          if (result.error) throw result.error;
          message.textContent = result.data.session
            ? "Account created. You are signed in."
            : "Check your email to confirm your account, then log in.";
        }
        if (mode === "forgot") {
          const result = await this.client.auth.resetPasswordForEmail(email, {
            redirectTo: new URL("/reset-password", site).toString(),
          });
          if (result.error) throw result.error;
          message.textContent =
            "If this email has an account, a recovery link will arrive shortly.";
        }
        if (mode === "reset") {
          if (!this.session)
            throw new Error(
              "Open the password recovery link from your email first.",
            );
          const result = await this.client.auth.updateUser({ password });
          if (result.error) throw result.error;
          message.textContent = "Password updated.";
        }
      } catch (error) {
        message.textContent =
          error instanceof Error ? error.message : "Sign-in failed.";
      } finally {
        submit.disabled = false;
      }
    };
  }
  /** The Raid Hub: every boss, rewards and appearance. */
  async showRaidHub(boss?: RaidBossId, tab: RaidHubTab = "overview") {
    let progress: RaidProgress | null = null;
    let problem = "";
    if (this.account)
      try {
        progress = (await this.api("/api/raids")) as RaidProgress;
        this.raidLook = raidLookOf(progress);
        this.hooks.onChange();
      } catch (error) {
        problem =
          error instanceof Error
            ? error.message
            : "Raid records are not available yet.";
      }
    const character = this.hooks.selectedCharacter?.() ?? "voltkit";
    const view: { boss?: RaidBossId; tab: RaidHubTab } = {
      boss: boss ?? "grumblecrag",
      tab,
    };
    const dialogEl = () =>
      document.getElementById("dialog") as HTMLDialogElement | null;
    const render = (top = false, revealBoss = false) => {
      this.hooks.openDialog(
        (view.boss
          ? raidBossPageMarkup(
              view.boss,
              view.tab,
              progress,
              progress
                ? raidAppearance(progress, character, this.economy?.owned)
                : "",
            )
          : raidHubMarkup(progress)) +
          (problem
            ? `<p class="raid-appearance-note raid-update-needed">${escape(problem)} Raids are still playable at Peril 1; saved rewards need the database update (migrations 007–009) and server storage configuration.</p>`
            : ""),
      );
      if (top)
        (
          dialogEl()?.querySelector<HTMLElement>(".raid-dialog-content") ??
          dialogEl()
        )?.scrollTo?.(0, 0);
      wire(revealBoss);
    };
    const wire = (revealBoss: boolean) => {
      const root = dialogEl();
      if (!root) return;
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-raid-boss]"),
      ))
        b.onclick = () => {
          const choosingFromRoster = b.classList.contains("raid-roster-card");
          view.boss = b.dataset.raidBoss as RaidBossId;
          if (!choosingFromRoster) view.tab = "overview";
          render(true, !choosingFromRoster);
          dialogEl()?.querySelector<HTMLButtonElement>(`.raid-roster-card[data-raid-boss="${view.boss}"]`)?.focus({preventScroll: true});
        };
      const selectedBoss = root.querySelector<HTMLElement>(".raid-roster-card.is-selected");
      if (selectedBoss && revealBoss) requestAnimationFrame(() => {
        if (!root.open || !selectedBoss.isConnected) return;
        const rail = selectedBoss.closest<HTMLElement>(".raid-boss-roster");
        if (!rail) return;
        // Only the rail can scroll. scrollIntoView would also move the dialog
        // and page, and is unnecessary after clicking a visible avatar.
        const r = rail.getBoundingClientRect(), b = selectedBoss.getBoundingClientRect();
        if (b.top < r.top) rail.scrollTop += b.top - r.top;
        else if (b.bottom > r.bottom) rail.scrollTop += b.bottom - r.bottom;
        if (b.left < r.left) rail.scrollLeft += b.left - r.left;
        else if (b.right > r.right) rail.scrollLeft += b.right - r.right;
      });
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-raid-tab]"),
      ))
        b.onclick = () => {
          view.tab = b.dataset.raidTab as RaidHubTab;
          render();
          root
            .querySelector<HTMLButtonElement>(`[data-raid-tab="${view.tab}"]`)
            ?.focus({preventScroll: true});
        };
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-raid-start]"),
      ))
        b.onclick = () =>
          view.boss &&
          this.hooks.startRaid?.(view.boss, {
            solo: b.dataset.raidStart === "solo",
          });
      for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-hub-practice]")))
        button.onclick = () => view.boss && this.hooks.startRaid?.(view.boss, {drill: button.dataset.hubPractice, returnTab: view.tab});
      const options = root.querySelector<HTMLElement>(".raid-equip");
      if (options && progress)
        this.bindAppearance(options, progress, character);
    };
    render(false, true);
  }
  /** Equip buttons on a boss's Rewards tab (saved on the server, then shown). */
  private bindAppearance(
    options: HTMLElement,
    progress: RaidProgress,
    character: CharacterId,
  ) {
    const status = document.querySelector<HTMLElement>(
      ".raid-appearance-status",
    );
    for (const button of Array.from(
      options.querySelectorAll<HTMLButtonElement>("button[data-raid-slot]"),
    ))
      button.onclick = async () => {
        const slot = button.dataset.raidSlot as RaidSlot;
        const item = (button.dataset.raidItem || null) as RaidCosmetic | null;
        const buttons = Array.from(
          options.querySelectorAll<HTMLButtonElement>("button"),
        );
        const disabled = buttons.map((b) => b.disabled);
        buttons.forEach((b) => {
          b.disabled = true;
        });
        button.setAttribute("aria-busy", "true");
        if (status) status.textContent = "Saving appearance…";
        try {
          const saved = (await this.api("/api/raids/equip", {
            slot,
            item,
          })) as {
            progress?: RaidProgress;
          };
          // Show what the server actually saved, never a guess.
          if (saved.progress) Object.assign(progress, saved.progress);
          else progress.loadout = { ...raidLookOf(progress), [slot]: item };
          this.raidLook = raidLookOf(progress);
          // The save worked: a hiccup redrawing the page behind the dialog
          // must not be reported as a failed save.
          try {
            this.hooks.onChange();
          } catch (error) {
            console.error(error);
          }
          if (!options.isConnected) return;
          // Update only the choices: keep the dialog and its scroll position.
          options.innerHTML = raidCosmeticOptions(
            progress,
            character,
            this.economy?.owned,
          );
          if (status)
            status.textContent = item
              ? `${(RAID_COSMETICS[item] ?? LOOK_ITEM_BY_ID[item]).name} equipped for all fighters.`
              : `${slot[0].toUpperCase() + slot.slice(1)} slot cleared.`;
          this.bindAppearance(options, progress, character);
        } catch (error) {
          buttons.forEach((b, i) => {
            b.disabled = disabled[i];
          });
          button.removeAttribute("aria-busy");
          if (status)
            status.textContent =
              error instanceof Error
                ? error.message
                : "Appearance could not be saved. Try again.";
        }
      };
  }
  /** Reload coins and missions (after a match, a raid or a purchase). */
  async loadEconomy() {
    if (!this.account) return;
    const version = this.generation;
    try {
      const economy = (await this.api("/api/economy")) as Economy;
      if (version !== this.generation) return;
      this.economy = economy;
      this.renderNav();
      this.hooks.onChange();
      this.shopRefresh?.();
      this.missionsRefresh?.();
    } catch {
      /* Shop storage needs migration 010. */
    }
  }
  /** Re-render the open Shop (set while it's open). */
  private shopRefresh?: () => void;
  private shopPreviewCleanup?: () => void;
  private shopView: ShopView = { tab: "today", champion: "voltkit" };
  private wardrobePanel?: ReturnType<typeof openWardrobe>;
  /** One inventory for purchased pieces and earned boss cosmetics. */
  async showWardrobe() {
    if (!this.ensurePlayer()) return;
    const generation = this.generation;
    this.wardrobePanel?.dispose();
    this.hooks.openDialog(
      '<section class="wardrobe-loading"><h2>Wardrobe</h2><p role="status">Loading your collection…</p></section>',
    );
    const results = await Promise.allSettled([
      this.api("/api/economy"),
      this.api("/api/raids"),
    ]);
    const root = document.getElementById("dialog") as HTMLDialogElement;
    if (
      generation !== this.generation ||
      !root.open ||
      !root.querySelector(".wardrobe-loading")
    )
      return;
    const [economy, raids] = results;
    if (economy.status === "fulfilled") this.economy = economy.value as Economy;
    if (!this.economy) {
      this.hooks.openDialog(
        '<h2>Wardrobe</h2><p role="alert">Your wardrobe could not load. Close this panel and try again.</p>',
      );
      return;
    }
    let progress =
      raids.status === "fulfilled" ? (raids.value as RaidProgress) : null;
    if (progress) this.raidLook = raidLookOf(progress);
    this.wardrobePanel?.dispose();
    this.wardrobePanel = openWardrobe(
      root,
      this.hooks.selectedCharacter?.() ?? "voltkit",
      {
        state: () => ({
          economy: this.economy!,
          progress,
          look: this.raidLook ?? {},
        }),
        render: (html) => this.hooks.openDialog(html),
        shop: () => void this.showShop(),
        raids: () => void this.showRaidHub(),
        save: async (slot, item, champion, stage) => {
          if (generation !== this.generation)
            throw new Error(
              "Your session changed. Reopen Wardrobe to continue.",
            );
          if (slot === "champion") {
            const result = (await this.api("/api/shop/equip", {
              champion,
              skin: item,
              ...(item ? { stage: stage ?? 1 } : {}),
            })) as { economy: Economy };
            if (generation !== this.generation) return;
            this.economy = result.economy;
          } else {
            const result = (await this.api("/api/raids/equip", {
              slot,
              item,
            })) as { progress: RaidProgress };
            if (generation !== this.generation) return;
            progress = result.progress;
            this.raidLook = raidLookOf(progress);
          }
          this.renderNav();
          try {
            this.hooks.onChange();
          } catch (error) {
            console.error(error);
          }
        },
      },
      results.some((r) => r.status === "rejected")
        ? "Some wardrobe data could not load. Reopen Wardrobe to refresh your collection."
        : "",
    );
  }
  private adventureRefresh?: () => void;
  private adventureCleanup?: () => void;
  async showAdventure(tab: AdventureTab = "levels") {
    if (!this.ensurePlayer()) return;
    const generation = this.generation;
    try {
      this.economy = (await this.api("/api/economy")) as Economy;
    } catch {
      /* The mode cards also work before progression storage is installed. */
    }
    if (generation !== this.generation) return;
    this.adventureCleanup?.();
    const view: AdventureView = {
      tab,
      preview:
        tab === "season"
          ? `season-${seasonTheme(this.economy?.journey?.season.id ?? new Date().toISOString().slice(0, 7))}-frame`
          : "wayfarer-frame",
    };
    const root = document.getElementById("dialog") as HTMLDialogElement;
    let preview: import("./shop-preview").ShopPreviewHandle | undefined;
    let importing = false,
      disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      preview?.();
      observer.disconnect();
      root.removeEventListener("close", cleanup);
      this.adventureRefresh = undefined;
    };
    const observer = new MutationObserver(() => {
      if (!root.querySelector(".adventure")) cleanup();
    });
    observer.observe(root, { childList: true });
    root.addEventListener("close", cleanup);
    this.adventureCleanup = cleanup;
    const render = () => {
      if (disposed) return;
      const top = root.querySelector(".dialog-content")?.scrollTop ?? 0;
      this.hooks.openDialog(
        adventureMarkup(
          view,
          this.economy,
          this.hooks.selectedCharacter?.() ?? "voltkit",
          this.raidLook,
        ),
      );
      const scroll = root.querySelector(".dialog-content");
      if (scroll) scroll.scrollTop = top;
      const panel = root.querySelector<HTMLElement>(".journey-preview");
      if (panel && preview) preview.update(panel);
      else if (panel && !importing) {
        importing = true;
        void import("./shop-preview").then(({ mountShopPreview }) => {
          importing = false;
          const current = root.querySelector<HTMLElement>(".journey-preview");
          if (!disposed && current) preview = mountShopPreview(current);
        });
      } else if (!panel && preview) {
        preview();
        preview = undefined;
      }
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-adventure-tab]"),
      ))
        b.onclick = () => {
          view.tab = b.dataset.adventureTab as AdventureTab;
          if (view.tab === "season")
            view.preview = `season-${seasonTheme(this.economy?.journey?.season.id ?? new Date().toISOString().slice(0, 7))}-frame`;
          render();
        };
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-journey-preview]"),
      ))
        b.onclick = () => {
          view.preview = b.dataset.journeyPreview;
          render();
        };
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-adventure-play]"),
      ))
        b.onclick = () => this.hooks.startAdventure?.(b.dataset.adventurePlay!);
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-journey-equip]"),
      ))
        b.onclick = async () => {
          b.disabled = true;
          try {
            const item = JOURNEY_ITEM_BY_ID[b.dataset.journeyEquip!];
            const result = (await this.api("/api/raids/cosmetic", {
              slot: item.slot,
              item: item.id,
            })) as { progress: RaidProgress };
            this.raidLook = raidLookOf(result.progress);
            this.hooks.onChange();
            render();
          } catch (error) {
            b.disabled = false;
            const status = root.querySelector(".adventure-status");
            if (status)
              status.textContent =
                error instanceof Error
                  ? error.message
                  : "Could not equip that reward.";
          }
        };
    };
    this.adventureRefresh = render;
    render();
  }
  /** The Shop: Today's Picks, champion skins, the Mythic Hall, collections and missions. */
  async showShop(tab?: ShopTab) {
    if (!this.ensurePlayer()) return;
    const view = this.shopView;
    if (tab) view.tab = tab;
    if (!view.preview)
      view.champion = this.hooks.selectedCharacter?.() ?? view.champion;
    let problem = "";
    try {
      this.economy = (await this.api("/api/economy")) as Economy;
      this.renderNav();
    } catch (error) {
      problem =
        error instanceof Error
          ? `${error.message} The Shop needs the latest database update (migration 010).`
          : "The Shop is not available yet.";
    }
    const dialogEl = () =>
      document.getElementById("dialog") as HTMLDialogElement | null;
    const status = (text: string, failed = false) => {
      const box = dialogEl()?.querySelector<HTMLElement>(".shop-status");
      if (box) {
        box.textContent = text;
        box.classList.toggle("is-error", failed);
        box.setAttribute("role", failed ? "alert" : "status");
      }
    };
    this.shopPreviewCleanup?.();
    let preview: import("./shop-preview").ShopPreviewHandle | undefined;
    let importing = false;
    let cancelled = false;
    const root = dialogEl()!;
    const cleanup = () => {
      if (cancelled) return;
      cancelled = true;
      preview?.();
      observer.disconnect();
      root.removeEventListener("close", cleanup);
    };
    const observer = new MutationObserver(() => {
      if (!root.querySelector(".shop")) cleanup();
    });
    observer.observe(root, { childList: true });
    root.addEventListener("close", cleanup);
    this.shopPreviewCleanup = cleanup;
    const render = (keepScroll = true, previewOnly = false) => {
      const root = dialogEl();
      const top =
        (root?.querySelector<HTMLElement>(".dialog-content") ?? root)
          ?.scrollTop ?? 0;
      const panel = root?.querySelector<HTMLElement>(".shop-preview");
      if (previewOnly && panel) {
        // Keep catalog SVGs, focus and scroll position intact while browsing.
        panel.outerHTML = shopPreviewMarkup(
          view,
          this.economy ?? null,
          this.raidLook ?? {},
        );
        const selected = previewItem(view, this.economy ?? null);
        for (const button of Array.from(
          root!.querySelectorAll<HTMLElement>("[data-shop-preview]"),
        )) {
          const active = button.dataset.shopPreview === selected;
          button.setAttribute("aria-pressed", String(active));
          button.closest(".shop-card")?.classList.toggle("is-selected", active);
        }
      } else
        this.hooks.openDialog(
          shopMarkup(view, this.economy ?? null, this.raidLook ?? {}, problem),
        );
      if (root && keepScroll)
        (root.querySelector<HTMLElement>(".dialog-content") ?? root).scrollTop =
          top;
      wire();
    };
    this.shopRefresh = () => {
      if (dialogEl()?.open && dialogEl()?.querySelector(".shop")) render();
      else this.shopRefresh = undefined;
    };
    const busy = async (
      button: HTMLButtonElement,
      work: () => Promise<string>,
    ) => {
      const all = Array.from(
        dialogEl()?.querySelectorAll<HTMLButtonElement>(
          ".shop button, .dialog-tabs [data-shop-tab]",
        ) ?? [],
      );
      all.forEach((b) => (b.disabled = true));
      button.setAttribute("aria-busy", "true");
      try {
        const message = await work();
        this.renderNav();
        try {
          this.hooks.onChange();
        } catch (error) {
          console.error(error);
        }
        render();
        status(message);
      } catch (error) {
        render();
        status(
          error instanceof Error
            ? error.message
            : "That didn't work. Try again.",
          true,
        );
      }
    };
    const wire = () => {
      const root = dialogEl();
      if (!root) return;
      const panel = root.querySelector<HTMLElement>(".shop-preview");
      if (panel && preview) preview.update(panel);
      else if (panel && !importing && !cancelled) {
        importing = true;
        void import("./shop-preview")
          .then(({ mountShopPreview }) => {
            const current = root.querySelector<HTMLElement>(".shop-preview");
            if (!cancelled && root.open && current)
              preview = mountShopPreview(current);
          })
          .catch(() => {
            const toggle = root.querySelector<HTMLButtonElement>(
              "[data-preview-toggle]",
            );
            if (toggle) {
              toggle.disabled = true;
              toggle.textContent = "Still preview";
            }
          });
      }
      const all = <T extends HTMLElement>(q: string) =>
        Array.from(root.querySelectorAll<T>(q));
      const restoreFocus = (selector: string) =>
        root
          .querySelector<HTMLElement>(selector)
          ?.focus({ preventScroll: true });
      for (const b of all<HTMLButtonElement>("[data-shop-ownership]"))
        b.onclick = () => {
          view.ownership = b.dataset.shopOwnership as ShopView["ownership"];
          render();
          restoreFocus(`[data-shop-ownership="${view.ownership}"]`);
        };
      for (const select of all<HTMLSelectElement>("[data-shop-rarity]"))
        select.onchange = () => {
          view.rarity = select.value as ShopView["rarity"];
          render();
          restoreFocus("[data-shop-rarity]");
        };
      for (const b of all<HTMLButtonElement>("[data-shop-reset]"))
        b.onclick = () => {
          view.ownership = "all";
          view.rarity = "all";
          render();
          restoreFocus('[data-shop-ownership="all"]');
        };
      for (const b of all<HTMLButtonElement>("[data-shop-collection]"))
        b.onclick = () => {
          view.collection = b.dataset.shopCollection as ShopView["collection"];
          view.preview = `${view.collection}-colours`;
          render();
          restoreFocus(`[data-shop-collection="${view.collection}"]`);
        };
      for (const b of all<HTMLButtonElement>("[data-shop-missions]"))
        b.onclick = () => void this.showMissions();
      for (const b of all<HTMLButtonElement>("[data-wardrobe-open]"))
        b.onclick = () => void this.showWardrobe();
      for (const b of all<HTMLButtonElement>("[data-shop-tab]"))
        b.onclick = () => {
          view.tab = b.dataset.shopTab as ShopTab;
          render(false);
          root
            .querySelector<HTMLButtonElement>(`[data-shop-tab="${view.tab}"]`)
            ?.focus();
        };
      for (const b of all<HTMLButtonElement>("[data-shop-champion]"))
        b.onclick = () => {
          view.champion = b.dataset.shopChampion as CharacterId;
          view.preview = this.economy?.looks[view.champion]?.skin ?? null;
          view.stage = this.economy?.looks[view.champion]?.stage ?? 1;
          render();
        };
      for (const b of all<HTMLButtonElement>("[data-shop-preview]"))
        b.onclick = () => {
          const id = b.dataset.shopPreview!;
          view.preview = id;
          const skin = CHAMPION_SKIN_BY_ID[id];
          if (skin) view.champion = skin.champion;
          view.stage =
            this.economy?.looks[view.champion]?.skin === id
              ? this.economy.looks[view.champion]!.stage
              : 1;
          render(true, true);
          // Bring an offscreen preview into view, without moving the catalog
          // when the selected look is already visible alongside it.
          const panel = root.querySelector<HTMLElement>(".shop-preview");
          const content =
            root.querySelector<HTMLElement>(".dialog-content") ?? root;
          const bounds = panel?.getBoundingClientRect();
          const viewport = content.getBoundingClientRect();
          if (
            bounds &&
            (bounds.bottom <= viewport.top || bounds.top >= viewport.bottom)
          )
            panel?.scrollIntoView?.({ block: "nearest" });
        };
      for (const b of all<HTMLButtonElement>("[data-shop-stage]"))
        b.onclick = async () => {
          view.stage = Number(b.dataset.shopStage);
          const id = view.preview;
          const reached = this.economy?.mythicTesting
            ? 3
            : id
              ? (this.economy?.awakening[id]?.stage ?? 0)
              : 0;
          // Wearing it: save a reached stage, or any stage available to an admin tester.
          if (
            id &&
            this.economy?.looks[view.champion]?.skin === id &&
            view.stage <= reached
          )
            return busy(b, async () => {
              this.economy = (
                (await this.api("/api/shop/equip", {
                  champion: view.champion,
                  skin: id,
                  stage: view.stage,
                })) as { economy: Economy }
              ).economy;
              return `Showing Stage ${"I".repeat(view.stage!)}.`;
            });
          render(true, true);
        };
      for (const b of all<HTMLButtonElement>("[data-shop-buy]"))
        b.onclick = () => {
          const id = b.dataset.shopBuy!;
          // Two taps: the first asks, the second buys.
          if (b.dataset.confirm !== "yes") {
            b.dataset.confirm = "yes";
            b.classList.add("is-confirming");
            const label = b.querySelector<HTMLElement>(".shop-price")!;
            const original = label.textContent;
            label.textContent = this.economy?.unlimitedCoins
              ? "Get for testing?"
              : `Buy for ${coins(Number(b.dataset.price))}?`;
            setTimeout(() => {
              if (!b.isConnected || b.dataset.confirm !== "yes") return;
              delete b.dataset.confirm;
              b.classList.remove("is-confirming");
              label.textContent = original;
            }, 4000);
            return;
          }
          void busy(b, async () => {
            this.economy = (
              (await this.api("/api/shop/buy", { item: id })) as {
                economy: Economy;
              }
            ).economy;
            // Sets contain several pieces; keep their real item preview selected.
            if (CHAMPION_SKIN_BY_ID[id] || LOOK_ITEM_BY_ID[id])
              view.preview = id;
            if (CHAMPION_SKIN_BY_ID[id])
              view.champion = CHAMPION_SKIN_BY_ID[id].champion;
            return `${CHAMPION_SKIN_BY_ID[id]?.name ?? LOOK_ITEM_BY_ID[id]?.name ?? "Set"} is yours. Equip it any time.`;
          });
        };
      for (const b of all<HTMLButtonElement>("[data-shop-equip]"))
        b.onclick = () =>
          void busy(b, async () => {
            const id = b.dataset.shopEquip!;
            const skin = CHAMPION_SKIN_BY_ID[id];
            if (skin) {
              const stage =
                this.economy?.mythicTesting && skin.rarity === "mythical"
                  ? view.preview === id
                    ? (view.stage ?? 1)
                    : 3
                  : (this.economy?.awakening[id]?.stage ?? 1);
              this.economy = (
                (await this.api("/api/shop/equip", {
                  champion: skin.champion,
                  skin: id,
                  stage,
                })) as { economy: Economy }
              ).economy;
              return `${skin.name} equipped on ${CHARACTERS[skin.champion].name}.`;
            }
            await this.equipLook(lookSlot(id)!, id);
            return `${LOOK_ITEM_BY_ID[id].name} equipped for every fighter.`;
          });
      for (const b of all<HTMLButtonElement>("[data-shop-unequip]"))
        b.onclick = () =>
          void busy(b, async () => {
            const id = b.dataset.shopUnequip!;
            const skin = CHAMPION_SKIN_BY_ID[id];
            if (skin) {
              this.economy = (
                (await this.api("/api/shop/equip", {
                  champion: skin.champion,
                  skin: null,
                })) as { economy: Economy }
              ).economy;
              return `${CHARACTERS[skin.champion].name} wears the original look.`;
            }
            await this.equipLook(lookSlot(id)!, null);
            return `${LOOK_ITEM_BY_ID[id].name} taken off.`;
          });
      for (const b of all<HTMLButtonElement>("[data-shop-unequip-champion]"))
        b.onclick = () =>
          void busy(b, async () => {
            const champion = b.dataset.shopUnequipChampion as CharacterId;
            this.economy = (
              (await this.api("/api/shop/equip", { champion, skin: null })) as {
                economy: Economy;
              }
            ).economy;
            view.preview = null;
            return `${CHARACTERS[champion].name} wears the original look.`;
          });
    };
    render(false);
  }
  /** Re-render the open Missions screen (set while it's open). */
  private missionsRefresh?: () => void;
  /** Daily missions: their own screen, opened from the home card. */
  async showMissions() {
    if (!this.ensurePlayer()) return;
    let problem = "";
    try {
      this.economy = (await this.api("/api/economy")) as Economy;
      this.renderNav();
    } catch (error) {
      problem =
        error instanceof Error
          ? `${error.message} Missions need the latest database update.`
          : "Missions are not available yet.";
    }
    const dialogEl = () =>
      document.getElementById("dialog") as HTMLDialogElement | null;
    const render = (message = "") => {
      const previous = dialogEl();
      const openGuide = previous?.querySelector<HTMLDialogElement>(
        ".mission-instructions[open]",
      );
      const openMission = openGuide?.dataset.missionGuide;
      const guideScroll =
        openGuide?.querySelector<HTMLElement>(".mission-popup-body")
          ?.scrollTop ?? 0;
      const focusedHelp = previous?.querySelector<HTMLButtonElement>(
        "[data-mission-help]:focus",
      )?.dataset.missionHelp;
      const scrollTop = previous?.querySelector(".missions-screen")
        ? (previous.querySelector<HTMLElement>(".dialog-content")?.scrollTop ??
          0)
        : 0;
      this.hooks.openDialog(missionsMarkup(this.economy ?? null, problem));
      const root = dialogEl();
      if (!root) return;
      for (const guide of Array.from(
        root.querySelectorAll<HTMLDialogElement>(".mission-instructions"),
      )) {
        const trigger = root.querySelector<HTMLButtonElement>(
          `[aria-controls="${guide.id}"]`,
        )!;
        const show = () => {
          guide.showModal();
          trigger.setAttribute("aria-expanded", "true");
        };
        trigger.onclick = show;
        guide.querySelector<HTMLButtonElement>(".mission-help-close")!.onclick =
          () => guide.close();
        guide.onclose = () => {
          trigger.setAttribute("aria-expanded", "false");
          trigger.focus({ preventScroll: true });
        };
        guide.onclick = (event) => {
          const rect = guide.getBoundingClientRect();
          if (
            event.target === guide &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            guide.close();
        };
        if (guide.dataset.missionGuide === openMission) {
          show();
          guide.querySelector<HTMLElement>(".mission-popup-body")!.scrollTop =
            guideScroll;
        } else if (!openMission && trigger.dataset.missionHelp === focusedHelp)
          trigger.focus({ preventScroll: true });
      }
      root.querySelector<HTMLElement>(".dialog-content")!.scrollTop = scrollTop;
      const status = root.querySelector<HTMLElement>(
        ".missions-screen .shop-status",
      );
      if (status) status.textContent = message;
      const shop = root.querySelector<HTMLButtonElement>("#missions-shop");
      if (shop) shop.onclick = () => void this.showShop();
      for (const b of Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-mission-reroll]"),
      ))
        b.onclick = async () => {
          root
            .querySelectorAll<HTMLButtonElement>(".missions-screen button")
            .forEach((x) => (x.disabled = true));
          b.setAttribute("aria-busy", "true");
          try {
            this.economy = (
              (await this.api("/api/missions/reroll", {
                slot: Number(b.dataset.missionReroll),
              })) as { economy: Economy }
            ).economy;
            this.renderNav();
            this.hooks.onChange();
            render("New mission ready.");
          } catch (error) {
            render(
              error instanceof Error
                ? error.message
                : "That didn't work. Try again.",
            );
          }
        };
    };
    this.missionsRefresh = () => {
      if (dialogEl()?.open && dialogEl()?.querySelector(".missions-screen"))
        render();
      else this.missionsRefresh = undefined;
    };
    render();
  }
  /** Equip a collection piece (or clear a slot) through the raid appearance route. */
  private async equipLook(slot: RaidSlot, item: string | null) {
    const saved = (await this.api("/api/raids/equip", { slot, item })) as {
      progress?: RaidProgress;
    };
    this.raidLook = saved.progress
      ? raidLookOf(saved.progress)
      : { ...this.raidLook, [slot]: item };
  }
  async showProfile() {
    if (!this.account) return;
    const account = this.account;
    this.hooks.openDialog(
      `<div class="profile-screen"><div class="eyebrow">Your player profile</div><h2>${escape(account.displayName)}</h2><p>${account.isAdmin ? "Administrator" : account.guest ? "Guest" : "Player"}${this.session?.user.email ? ` · ${escape(this.session.user.email)}` : ""}</p><div class="profile-layout"><div class="profile-customize">${account.guest ? `<form id="profile-save" class="account-form save-account"><p><b>Keep your progress.</b> Guest accounts live only on this device. Add your email to make this a full account: your records, titles and name come with you.</p><label>Email<input name="email" type="email" required autocomplete="email"></label><button class="primary">${iconLabel("save", "Save my account")}</button><p id="save-message" role="status"></p></form>` : ""}<form id="profile-title" class="account-form">${titlePickerMarkup(account.ownedTitles as Title[], account.title)}<button class="primary">${iconLabel("save", "Save title")}</button><p id="profile-message" role="status"></p></form><button class="secondary full" id="profile-leaderboard">${iconLabel("leaderboard", "Season standings")}</button><section id="profile-raid"><button class="secondary full" id="profile-raids">${iconLabel("bestiary", "Raid Hub & rewards")}</button><p id="profile-raid-stats" class="muted"></p></section></div><section id="profile-progress" class="progress"><p class="muted">Loading your progress…</p></section></div></div>`,
    );
    element("profile-leaderboard").onclick = () => void this.showLeaderboard();
    element("profile-raids").onclick = () => void this.showRaidHub();
    void this.api("/api/raids")
      .then((value) => {
        const p = value as RaidProgress,
          box = element("profile-raid-stats");
        if (box)
          box.textContent = `Boss raids: ${p.clears} clears · highest Peril ${p.highestPeril}`;
      })
      .catch(() => {});
    const save = element<HTMLFormElement>("profile-save");
    if (save)
      save.onsubmit = async (event) => {
        event.preventDefault();
        if (!this.client) return;
        const email = String(new FormData(save).get("email") ?? "").trim();
        const status = element("save-message");
        status.textContent = "Please wait…";
        const site = import.meta.env.VITE_SITE_URL || location.origin;
        const { error } = await this.client.auth.updateUser(
          { email },
          { emailRedirectTo: new URL("/email-confirmed", site).toString() },
        );
        status.textContent = error
          ? error.message
          : "Check your inbox and confirm the email. Then choose a password with “Forgot password?” on the login screen, or keep playing here.";
      };
    void this.api("/api/progress")
      .then((value) => {
        const box = element("profile-progress");
        if (box) {
          box.innerHTML = progressMarkup(
            progressSchema.parse(value),
            this.economy?.journey,
          );
          const adventure =
            box.querySelector<HTMLButtonElement>("#profile-adventure");
          if (adventure) adventure.onclick = () => void this.showAdventure();
        }
      })
      .catch((error) => {
        const box = element("profile-progress");
        if (box)
          box.innerHTML = `<p class="muted">${escape(
            error instanceof Error &&
              /database needs an update/.test(error.message)
              ? "Records, achievements and mastery switch on once the database update (migration 004) has been run."
              : "Your progress couldn’t be loaded right now.",
          )}</p>`;
      });
    // Live preview: the nameplate shows whichever title is picked, before saving.
    const titleForm = element<HTMLFormElement>("profile-title");
    const paintPreview = () => {
      const id = String(new FormData(titleForm).get("titleId") ?? "");
      const pick = (account.ownedTitles as Title[]).find((t) => t.id === id);
      updateNameplate(
        element("title-preview"),
        account.displayName,
        pick?.name ?? null,
        pick?.color ?? null,
        true,
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      const saved =
        (account.ownedTitles as Title[]).find((t) => t.name === account.title)
          ?.id ?? "";
      element("profile-message").textContent =
        id === saved ? "" : "Press Save title to equip it.";
    };
    titleForm.onchange = paintPreview;
    paintPreview();
    element<HTMLFormElement>("profile-title").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const titleId = String(
          new FormData(event.currentTarget as HTMLFormElement).get("titleId") ??
            "",
        );
        await this.api("/api/account/title", { titleId: titleId || null });
        await this.refresh();
        // Redraw so "Equipped" moves to the new title.
        await this.showProfile();
        element("profile-message").textContent = "Title updated.";
      } catch (error) {
        element("profile-message").textContent =
          error instanceof Error ? error.message : "Unable to update title.";
      }
    };
  }
  /** Friends keep one stable screen while live presence refreshes in the background. */
  friendsOpen = false;
  private friendsHub?: FriendsHub;
  async showFriends() {
    if (!this.ensurePlayer()) return;
    this.friendsHub?.dispose();
    const room = this.hooks.friendsRoom?.() ?? { canCreate: false };
    this.hooks.openDialog(
      friendsScreenMarkup(friendCode(this.account!.id), room),
    );
    this.friendsOpen = true;
    const hub = new FriendsHub(element<HTMLDialogElement>("dialog"), {
      accountId: this.account!.id,
      room,
      getRoom: this.hooks.friendsRoom,
      invite: this.hooks.inviteFriend,
      api: (path, body) => this.api(path, body),
      request: (body) => this.friendRequest(body),
      notify: this.hooks.notify,
      join: this.hooks.joinRoom,
      watch: this.hooks.watchRoom,
      createRoom: this.hooks.createFriendRoom,
      onClose: () => {
        if (this.friendsHub === hub) {
          this.friendsOpen = false;
          this.friendsHub = undefined;
        }
      },
    });
    this.friendsHub = hub;
    await hub.refresh();
  }
  async nearbyFriends() {
    return friendsSchema.parse(await this.api("/api/friends"));
  }
  /** Send a friend request by code or player id; says what happened. */
  async friendRequest(body: { code?: string; playerId?: string }) {
    const message = element("friend-message");
    try {
      const { result } = (await this.api("/api/friends/request", body)) as {
        result: string;
      };
      const text =
        result === "friends"
          ? "You're now friends."
          : result === "already"
            ? "You're already friends."
            : "Friend request sent.";
      if (message) message.textContent = text;
      else this.hooks.notify(text);
      if (this.friendsOpen) await this.loadFriends();
      return true;
    } catch (error) {
      const text =
        error instanceof Error && /database needs an update/.test(error.message)
          ? "Friends switch on once the database update (migration 005) has been run."
          : error instanceof Error
            ? error.message
            : "Couldn't send that request.";
      if (message) message.textContent = text;
      else this.hooks.notify(text);
      return false;
    }
  }
  async loadFriends() {
    await this.friendsHub?.refresh();
  }
  /** Quick check after login: say if someone wants to be friends. */
  async checkFriendRequests() {
    try {
      const list = friendsSchema.parse(await this.api("/api/friends"));
      if (list.incoming.length)
        this.hooks.notify(
          `${list.incoming.length === 1 ? `${list.incoming[0].name} wants` : `${list.incoming.length} players want`} to be friends. Open Menu → Friends.`,
        );
      return list;
    } catch {
      return undefined;
    }
  }
  /** This month's standings: player-vs-player wins, guests and bots excluded. */
  async showLeaderboard() {
    if (!this.ensurePlayer()) return;
    this.hooks.openDialog(
      `<div class="eyebrow">Season standings</div><h2>Leaderboard</h2><div id="leaderboard-body"><p class="muted">Loading…</p></div><button class="quiet" id="leaderboard-back">${iconLabel("back", "Back to profile")}</button>`,
    );
    element("leaderboard-back").onclick = () => void this.showProfile();
    try {
      const board = leaderboardSchema.parse(await this.api("/api/leaderboard"));
      const body = element("leaderboard-body");
      if (body)
        body.innerHTML = board.rating
          ? `<p>Players ranked by skill rating · ${escape(seasonName(board.season))} season.</p>${leaderboardMarkup(board)}`
          : `<p>${escape(seasonName(board.season))} · wins against other players. A new season starts each month.</p>${leaderboardMarkup(board)}`;
    } catch (error) {
      const body = element("leaderboard-body");
      if (body)
        body.innerHTML = `<p class="muted">${escape(error instanceof Error ? error.message : "Couldn’t load the standings.")}</p>`;
    }
  }
  /** Ask the admin team for help. `context` is attached automatically. */
  showReport(context: Record<string, string> = {}) {
    if (!this.account) {
      this.hooks.notify("Log in to report a problem.");
      this.showAuth("login");
      return;
    }
    this.hooks.openDialog(
      `<div class="eyebrow">Help us fix it</div><h2>Report a problem</h2><p>Tell the admins what happened. Your current screen${context.room ? ` and room code ${escape(context.room)}` : ""} are included automatically.</p><form id="report-form" class="account-form"><label>What kind of problem?<select name="category" required>${Object.entries(
        REPORT_CATEGORIES,
      )
        .map(([value, label]) => `<option value="${value}">${label}</option>`)
        .join(
          "",
        )}</select></label><label>What happened?<textarea name="message" rows="5" minlength="5" maxlength="1000" required placeholder="What were you doing, and what went wrong?"></textarea></label><small class="report-count" id="report-count">0 / 1000</small><button class="primary" type="submit">${iconLabel("report", "Send report")}</button><p id="report-message" role="status"></p></form>`,
    );
    const form = element<HTMLFormElement>("report-form");
    const text = form.elements.namedItem("message") as HTMLTextAreaElement;
    text.oninput = () =>
      (element("report-count").textContent = `${text.value.length} / 1000`);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const submit = formSubmitButton(form);
      const fields = new FormData(form);
      submit.disabled = true;
      try {
        await this.api("/api/reports", {
          category: String(fields.get("category")),
          message: String(fields.get("message") ?? "").trim(),
          context,
        });
        submit.remove();
        form.innerHTML =
          '<p class="report-thanks">Thanks! Your report was sent to the admins.</p>';
      } catch (error) {
        element("report-message").textContent =
          error instanceof Error ? error.message : "Could not send the report.";
        submit.disabled = false;
      }
    };
  }
  private adminView: {
    tab: "players" | "reports" | "online";
    search: string;
    offset: number;
    status: "open" | "resolved" | "all";
    reportOffset: number;
    message: string;
  } = {
    tab: "players",
    search: "",
    offset: 0,
    status: "open",
    reportOffset: 0,
    message: "",
  };
  private onlineTimer?: ReturnType<typeof setTimeout>;
  /** `refresh` re-renders in place without the "Loading…" flash (online auto-refresh). */
  async showAdmin(
    changes: Partial<typeof this.adminView> = {},
    refresh = false,
  ) {
    if (!this.account?.isAdmin) return;
    clearTimeout(this.onlineTimer);
    const view = Object.assign(this.adminView, { message: "" }, changes);
    const tab = (id: typeof view.tab, label: string, count?: number | string) =>
      `<button role="tab" class="admin-tab ${view.tab === id ? "active" : ""}" data-tab="${id}" aria-selected="${view.tab === id}">${label}${count ? ` <b class="admin-count${id === "online" ? " live" : ""}">${count}</b>` : ""}</button>`;
    const header = (open: number | string, online: number | string = "") =>
      `<div class="eyebrow">Administration</div><h2>Admin</h2><div class="admin-tabs" role="tablist">${tab("players", "Players")}${tab("online", "Online", online)}${tab("reports", "Reports", open)}</div>`;
    if (!refresh) this.hooks.openDialog(`${header("")}<p>Loading…</p>`);
    try {
      // Who's online comes from the game server's memory; it never blocks the rest.
      let onlineError = "";
      const onlineRequest = (
        this.api("/api/admin/online") as Promise<OnlineList>
      ).catch((error: unknown) => {
        onlineError =
          error instanceof Error ? error.message : "Online list unavailable.";
        return { players: [], guests: 0, at: new Date().toISOString() };
      });
      // Reports are optional: if they can't load, the player tools still work.
      let reportsError = "";
      const reports = (await this.api(
        `/api/admin/reports?status=${view.tab === "reports" ? view.status : "open"}&offset=${view.tab === "reports" ? view.reportOffset : 0}`,
      ).catch((error: unknown) => {
        reportsError =
          error instanceof Error ? error.message : "Reports are unavailable.";
        return { reports: [], total: 0, open: 0 };
      })) as ReportList;
      const online = await onlineRequest;
      let body = "";
      let titles: Title[] = [];
      let players: PlayerDirectory["players"] = [];
      if (view.tab === "players") {
        const [directory, catalog] = await Promise.all([
          this.api(
            `/api/admin/players?search=${encodeURIComponent(view.search)}&offset=${view.offset}`,
          ),
          this.api("/api/admin/titles"),
        ]);
        ({ players } = directory as PlayerDirectory);
        const total = (directory as PlayerDirectory).total;
        titles = catalog as Title[];
        const sorted = sortTitles(titles);
        body = `<div class="admin-title-tools"><select id="delete-title-select" aria-label="Title to delete"><option value="">Delete a title…</option>${sorted.map((t) => `<option value="${t.id}">${escape(t.name)}</option>`).join("")}</select><div class="admin-confirm" id="delete-title-confirm" hidden></div></div><form id="admin-search" class="admin-search"><input name="search" placeholder="Search name or player ID" value="${escape(view.search)}" aria-label="Search players"><button class="secondary">Search</button></form><div class="admin-list">${
          players
            .map((p) => {
              const owned = sortTitles(
                titles.filter((t) => p.titleIds.includes(t.id)),
              );
              const grantable = sortTitles(
                titles.filter((t) => t.active && !p.titleIds.includes(t.id)),
              );
              return `<div class="admin-row" data-player="${p.id}" data-name="${escape(p.displayName)}"><div class="admin-row-head"><strong>${escape(p.displayName)}</strong>${p.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ""}${p.suspended ? '<span class="admin-badge danger">SUSPENDED</span>' : ""}<small>Joined ${new Date(p.createdAt).toLocaleDateString()}</small></div><div class="admin-titles-row">${owned
                .map(
                  (t) =>
                    `<span class="title-chip" style="--chip:${t.color}">${escape(t.name)}<button type="button" data-revoke="${t.id}" aria-label="Remove ${escape(t.name)}" title="Remove title">×</button></span>`,
                )
                .join(
                  "",
                )}<select class="grant-select" aria-label="Grant a title to ${escape(p.displayName)}"><option value="">+ Grant title…</option>${grantable.map((t) => `<option value="${t.id}">${escape(t.name)}</option>`).join("")}<option value="__new">Create new title…</option></select></div>${
                p.isAdmin
                  ? ""
                  : `<div class="admin-actions"><button type="button" class="secondary" data-action="suspend">${p.suspended ? "Unsuspend" : "Suspend"}</button><button type="button" class="danger-button" data-action="delete">Delete</button></div>`
              }<div class="admin-confirm" hidden></div></div>`;
            })
            .join("") || "<p>No players found.</p>"
        }</div><div class="admin-pagination"><button id="admin-prev" class="quiet" ${view.offset === 0 ? "disabled" : ""}>Previous</button><span>${total ? `${view.offset + 1}–${Math.min(view.offset + 50, total)} of ${total}` : "0 players"}</span><button id="admin-next" class="quiet" ${view.offset + 50 >= total ? "disabled" : ""}>Next</button></div>`;
      } else if (view.tab === "online") {
        body = onlineError
          ? `<p class="admin-notice">${escape(onlineError)}</p>`
          : renderOnline(
              online,
              (id) => CHARACTERS[id as CharacterId]?.name ?? id,
            );
      } else {
        body = `<div class="report-filter" role="group" aria-label="Report status">${(["open", "resolved", "all"] as const).map((s) => `<button class="${view.status === s ? "active" : ""}" data-status="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div><div class="admin-list">${
          reports.reports
            .map(
              (r) =>
                `<article class="report-card ${r.status}" data-report="${r.id}"><div class="admin-row-head"><span class="report-category ${r.category}">${REPORT_CATEGORIES[r.category] ?? r.category}</span><strong>${escape(r.reporterName || "Deleted player")}</strong><small>${new Date(r.createdAt).toLocaleString()}</small></div><p class="report-text">${escape(r.message)}</p>${
                  Object.keys(r.context ?? {}).length
                    ? `<small class="report-context">${Object.entries(r.context)
                        .map(([k, v]) => `${escape(k)}: ${escape(String(v))}`)
                        .join(" · ")}</small>`
                    : ""
                }<button type="button" class="${r.status === "open" ? "secondary" : "quiet"}" data-resolve="${r.status === "open"}">${r.status === "open" ? "Mark resolved" : "Reopen"}</button></article>`,
            )
            .join("") ||
          `<p>No ${view.status === "all" ? "" : view.status + " "}reports.</p>`
        }</div><div class="admin-pagination"><button id="report-prev" class="quiet" ${view.reportOffset === 0 ? "disabled" : ""}>Previous</button><span>${reports.total ? `${view.reportOffset + 1}–${Math.min(view.reportOffset + 50, reports.total)} of ${reports.total}` : ""}</span><button id="report-next" class="quiet" ${view.reportOffset + 50 >= reports.total ? "disabled" : ""}>Next</button></div>`;
      }
      this.hooks.openDialog(
        `${header(reports.open, onlineError ? "" : online.players.length)}${reportsError ? `<p class="admin-notice">${escape(reportsError)}</p>` : ""}${view.tab === "reports" && reportsError ? "" : body}<p id="admin-message" role="status">${escape(view.message)}</p>`,
      );
      const say = (text: string) =>
        (element("admin-message").textContent = text);
      const fail = (error: unknown) =>
        say(error instanceof Error ? error.message : "Request failed.");
      document.querySelectorAll<HTMLButtonElement>(".admin-tab").forEach(
        (tab) =>
          (tab.onclick = () =>
            void this.showAdmin({
              tab: tab.dataset.tab as typeof view.tab,
            })),
      );
      if (view.tab === "online") {
        if (onlineError) return;
        element("online-refresh").onclick = () => void this.showAdmin({}, true);
        document.querySelectorAll<HTMLButtonElement>("[data-manage]").forEach(
          (button) =>
            (button.onclick = () =>
              void this.showAdmin({
                tab: "players",
                search:
                  button.closest<HTMLElement>("[data-online]")!.dataset
                    .online ?? "",
                offset: 0,
              })),
        );
        this.onlineTimer = setTimeout(() => {
          const dialog = document.getElementById(
            "dialog",
          ) as HTMLDialogElement | null;
          if (
            dialog?.open &&
            this.adminView.tab === "online" &&
            document.getElementById("online-refresh")
          )
            void this.showAdmin({}, true);
        }, 10000);
        return;
      }
      if (view.tab === "reports") {
        if (reportsError) return;
        document.querySelectorAll<HTMLButtonElement>("[data-status]").forEach(
          (b) =>
            (b.onclick = () =>
              void this.showAdmin({
                status: b.dataset.status as "open" | "resolved" | "all",
                reportOffset: 0,
              })),
        );
        element("report-prev").onclick = () =>
          void this.showAdmin({
            reportOffset: Math.max(0, view.reportOffset - 50),
          });
        element("report-next").onclick = () =>
          void this.showAdmin({ reportOffset: view.reportOffset + 50 });
        document
          .querySelectorAll<HTMLButtonElement>("[data-resolve]")
          .forEach((button) => {
            button.onclick = async () => {
              button.disabled = true;
              const id = Number(
                button.closest<HTMLElement>("[data-report]")!.dataset.report,
              );
              try {
                await this.api("/api/admin/reports/resolve", {
                  id,
                  resolved: button.dataset.resolve === "true",
                });
                await this.showAdmin({
                  message:
                    button.dataset.resolve === "true"
                      ? "Report marked resolved."
                      : "Report reopened.",
                });
              } catch (error) {
                fail(error);
                button.disabled = false;
              }
            };
          });
        return;
      }
      element<HTMLFormElement>("admin-search").onsubmit = (e) => {
        e.preventDefault();
        void this.showAdmin({
          search: String(
            new FormData(e.currentTarget as HTMLFormElement).get("search") ??
              "",
          ),
          offset: 0,
        });
      };
      element("admin-prev").onclick = () =>
        void this.showAdmin({ offset: Math.max(0, view.offset - 50) });
      element("admin-next").onclick = () =>
        void this.showAdmin({ offset: view.offset + 50 });
      const deleteSelect = element<HTMLSelectElement>("delete-title-select");
      const deleteBox = element("delete-title-confirm");
      deleteSelect.onchange = () => {
        const title = titles.find((t) => t.id === deleteSelect.value);
        if (!title) {
          deleteBox.hidden = true;
          return;
        }
        deleteBox.hidden = false;
        deleteBox.innerHTML = `<p><b>Delete the title "${escape(title.name)}"?</b> It is removed from every player who has it. This cannot be undone.</p><div class="admin-actions"><button type="button" class="danger-button" data-confirm>Delete title</button><button type="button" class="quiet" data-cancel>Cancel</button></div>`;
        deleteBox.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick =
          () => {
            deleteSelect.value = "";
            deleteBox.hidden = true;
          };
        const confirm =
          deleteBox.querySelector<HTMLButtonElement>("[data-confirm]")!;
        confirm.focus();
        confirm.onclick = async () => {
          confirm.disabled = true;
          try {
            await this.api("/api/admin/titles/delete", {
              id: title.id,
              confirm: true,
            });
            await this.showAdmin({
              message: `Title "${title.name}" was deleted.`,
            });
          } catch (error) {
            fail(error);
            confirm.disabled = false;
          }
        };
      };
      const grant = async (playerId: string, titleId: string, on: boolean) => {
        await this.api("/api/admin/grants", {
          playerId,
          titleId,
          grant: on,
        });
      };
      document.querySelectorAll<HTMLElement>(".admin-row").forEach((row) => {
        const id = row.dataset.player!,
          name = row.dataset.name!;
        const confirmBox = row.querySelector<HTMLElement>(".admin-confirm")!;
        row
          .querySelectorAll<HTMLButtonElement>("[data-revoke]")
          .forEach((button) => {
            button.onclick = async () => {
              button.disabled = true;
              try {
                await grant(id, button.dataset.revoke!, false);
                await this.showAdmin({
                  message: `Title removed from ${name}.`,
                });
              } catch (error) {
                fail(error);
                button.disabled = false;
              }
            };
          });
        const select = row.querySelector<HTMLSelectElement>(".grant-select")!;
        select.onchange = async () => {
          if (!select.value) return;
          if (select.value === "__new") {
            select.value = "";
            const preset =
              TITLE_PRESETS.find(
                (p) =>
                  !titles.some(
                    (t) => t.name.toLowerCase() === p.name.toLowerCase(),
                  ),
              ) ?? TITLE_PRESETS[0];
            confirmBox.hidden = false;
            confirmBox.innerHTML = `<form class="new-title-form"><input name="name" maxlength="40" required placeholder="Title name" value="${escape(preset.name)}" aria-label="New title name"><input name="color" type="color" value="${preset.color}" aria-label="Title color"><button class="primary">Create &amp; grant</button><button type="button" class="quiet" data-cancel>Cancel</button></form>`;
            const form = confirmBox.querySelector("form")!;
            confirmBox.querySelector<HTMLButtonElement>(
              "[data-cancel]",
            )!.onclick = () => {
              confirmBox.hidden = true;
              confirmBox.innerHTML = "";
            };
            form.onsubmit = async (event) => {
              event.preventDefault();
              const fields = new FormData(form);
              try {
                const titleId = (await this.api("/api/admin/titles", {
                  id: null,
                  name: String(fields.get("name")),
                  description: "An arena honor awarded by an administrator.",
                  color: String(fields.get("color")),
                  active: true,
                })) as string;
                await grant(id, titleId, true);
                await this.showAdmin({
                  message: `Created "${String(fields.get("name"))}" and granted it to ${name}.`,
                });
              } catch (error) {
                fail(error);
              }
            };
            return;
          }
          select.disabled = true;
          try {
            await grant(id, select.value, true);
            await this.showAdmin({ message: `Title granted to ${name}.` });
          } catch (error) {
            fail(error);
            select.disabled = false;
          }
        };
        row
          .querySelectorAll<HTMLButtonElement>("[data-action]")
          .forEach((button) => {
            button.onclick = () => {
              const deleting = button.dataset.action === "delete";
              const suspended = button.textContent === "Unsuspend";
              confirmBox.hidden = false;
              confirmBox.innerHTML = deleting
                ? `<p><b>Permanently delete ${escape(name)}?</b> Their login, profile and titles are removed for good. This cannot be undone.</p><label><span>Type <b>${escape(name)}</b> to confirm</span><input data-confirm-name autocomplete="off" aria-label="Type ${escape(name)} to confirm"></label><div class="admin-actions"><button type="button" class="danger-button" data-confirm disabled>Delete account</button><button type="button" class="quiet" data-cancel>Cancel</button></div>`
                : `<p><b>${suspended ? "Unsuspend" : "Suspend"} ${escape(name)}?</b> ${suspended ? "They will be able to log in and play again." : "They are removed from any match and can't play until unsuspended."}</p><div class="admin-actions"><button type="button" class="${suspended ? "primary" : "danger-button"}" data-confirm>${suspended ? "Unsuspend" : "Suspend"}</button><button type="button" class="quiet" data-cancel>Cancel</button></div>`;
              const confirm =
                confirmBox.querySelector<HTMLButtonElement>("[data-confirm]")!;
              const typed = confirmBox.querySelector<HTMLInputElement>(
                "[data-confirm-name]",
              );
              if (typed) {
                typed.oninput = () =>
                  (confirm.disabled = typed.value.trim() !== name);
                typed.focus();
              } else confirm.focus();
              confirmBox.querySelector<HTMLButtonElement>(
                "[data-cancel]",
              )!.onclick = () => {
                confirmBox.hidden = true;
                confirmBox.innerHTML = "";
              };
              confirm.onclick = async () => {
                confirm.disabled = true;
                try {
                  if (deleting)
                    await this.api("/api/admin/players/delete", {
                      id,
                      confirm: true,
                    });
                  else
                    await this.api("/api/admin/players/suspend", {
                      id,
                      suspended: !suspended,
                    });
                  await this.showAdmin({
                    message: deleting
                      ? `${name} was deleted.`
                      : `${name} is ${suspended ? "no longer suspended" : "suspended"}.`,
                  });
                } catch (error) {
                  fail(error);
                  confirm.disabled = false;
                }
              };
            };
          });
      });
    } catch (error) {
      this.hooks.openDialog(
        `<h2>Admin tools unavailable</h2><p>${escape(error instanceof Error ? error.message : "Unable to load administration.")}</p>`,
      );
    }
  }
}
