import { isNativeApp, signInWithAppleNatively } from "./native";
import {
  nameAllowed,
  NAME_NOT_ALLOWED,
} from "../../../packages/shared/src/name-filter";
import { framedAvatar } from "./portraits";
import { openFittingRoom, type FittingRoom } from "./screens/fitting-room";
import type { FitMode, ShopSection } from "./screens/fitting-room-view";
import { openJourney, type JourneyScreen } from "./screens/journey";
import type { JourneyTab } from "./screens/journey-view";
import {
  playerLevel,
  JOURNEY_ITEM_BY_ID,
} from "../../../packages/shared/src/journey";
import { formSubmitButton } from "./dialog";
import { openRaids, type RaidScreen } from "./screens/raid-hall";
import type { RaidSeat, RaidTab } from "./screens/raid-hall-view";
import { iconLabel } from "./menu-icons";
import { coinChip, compactCoins, leafChip, coins } from "./shop-ui";
import { openMissions, type MissionsScreen } from "./screens/missions";
import type { Economy } from "../../../packages/shared/src/shop";
import { noteSeenRewards } from "./reward-reveal";
import {
  pacificDate,
  bossClears,
  frameStars,
  raidLookOf,
  type RaidBossId,
  type RaidLoadout,
  type RaidProgress,
  type RaidSlot,
} from "../../../packages/shared/src/raid";
import { TITLE_PRESETS, sortTitles } from "./player-nameplate";
import { isQuietRefresh } from "./session-refresh";
import { waitForServer } from "./server-connection";
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
  friendsBoardSchema,
  recentPlayersSchema,
  nameStatusSchema,
  type RecentPlayer,
  progressSchema,
  friendsSchema,
  friendCode,
  SERVER_TIME_HEADER,
  type Friend,
  blockedListSchema,
  type BlockedPlayer,
} from "../../../packages/shared/src/accounts";
import { askConfirm } from "./ui/hub-panel";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { renderOnline } from "./admin-online";
import { openProfile, type ProfileScreen } from "./screens/profile";
import type { ProfileData } from "./screens/profile-view";
import { openRanks, type RanksScreen } from "./screens/ranks";
import type { RanksData } from "./screens/ranks-view";
import {
  openFriends,
  readPinnedFriends,
  savePinnedFriends,
  type FriendsScreen,
} from "./screens/friends";
import type { FriendsData, FriendsRoom } from "./screens/friends-view";
import { noteServerTime } from "./server-clock";
import {
  authRedirectUrl,
  authErrorMessage,
  readAuthError,
  readAuthReturn,
  withoutAuthError,
  withoutAuthMarker,
} from "./auth-redirect";
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
/**
 * Sign in with Apple (docs/accounts-setup.md). The App Store asks apps that
 * offer Google sign-in to offer it too (App Review Guideline 4.8).
 */
const APPLE_SIGN_IN = import.meta.env.VITE_APPLE_SIGN_IN === "on";
/** Google's sign-in page refuses to open inside apps: web only. */
const SHOW_GOOGLE = GOOGLE_SIGN_IN && !isNativeApp();
/** Apple's logo for its sign-in button (Apple's button guidelines). */
const APPLE_LOGO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
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
  /** The top bar's Gold Leaves pill opens the Farm. */
  openFarm?: () => void;
  /** Join or watch a friend's room from the friends list. */
  joinRoom?: (code: string) => void;
  watchRoom?: (code: string) => void;
  friendsRoom?: () => FriendsRoom;
  inviteFriend?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Where Friends opens while you are in a private room (its picker's place). */
  friendsHost?: () => HTMLElement | undefined;
  /** Friends closed (a room puts its picker back). */
  onFriendsClosed?: () => void;
  notify: (message: string) => void;
  onChange: () => void;
  onSession: (token: string | null, accountId?: string) => void;
  /** Same player, fresh token (background refresh): keep it for reconnects only. */
  onToken: (token: string) => void;
  beforeSignOut: () => Promise<void>;
  selectedCharacter?: () => CharacterId;
  /** Make a fighter your Lobby fighter. */
  chooseFighter?: (id: CharacterId) => void;
  /** The fighter saved with the account (picked on another device). */
  restoreFighter?: (id: CharacterId) => void;
  /** Show the Lobby (the Shop and Wardrobe open inside it). */
  toLobby?: () => void;
  /** Create a raid room for a boss (today's challenge, or straight in solo). */
  startAdventure?: (mode: string) => void;
  startRaid?: (
    boss: RaidBossId,
    options: { solo?: boolean; drill?: string; returnTab?: RaidTab },
  ) => void;
  /** Your Lobby party for the raid seats, and whether you can start. */
  raidParty?: () => { party: RaidSeat[]; leader: boolean; inRoom: boolean };
  /** Invite a friend to your Lobby party (the server answers). */
  inviteToParty?: (id: string) => Promise<{ ok: boolean; error?: string }>;
};
export class AccountUI {
  account: Account | null = null;
  /** The saved session has been checked (and the profile loaded, or failed). */
  checked = false;
  /** Equipped raid look (undefined until loaded). */
  raidLook: RaidLoadout | undefined = undefined;
  /** Saved clears per boss: stars on your boss frame. */
  raidClears: Partial<Record<RaidBossId, number>> = {};
  /** Coins, owned items, missions (undefined until loaded or before migration 010). */
  economy: Economy | undefined = undefined;
  session: Session | null = null;
  /** The fighter the account has saved (undefined until asked, null: none). */
  private savedFighter: string | null | undefined = undefined;
  /** Counts this device's picks, so a slow answer never undoes a new one. */
  private fighterPicks = 0;
  private fighterTimer: ReturnType<typeof setTimeout> | undefined;
  private confirmedGuestLogout = false;
  generation = 0;
  private sessionLoad:
    { accountId: string | null; promise: Promise<void> } | undefined;
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
    const returned = readAuthReturn(location.pathname, location.search);
    // An expired or reused link still returns here, with Supabase's error in
    // the hash; it can also land on the bare root when the redirect was not
    // accepted. Report the failure instead of claiming the email is confirmed.
    const failed = readAuthError(location.search, location.hash);
    if (returned || failed) {
      // Keep Supabase's own ?code= / #access_token; drop only our marker and
      // any error so a refresh doesn't announce the result again.
      history.replaceState(
        history.state,
        "",
        withoutAuthError(withoutAuthMarker(location.href)),
      );
      if (failed) hooks.notify(authErrorMessage(returned, failed));
      else if (returned === "email-confirmed")
        hooks.notify("Email confirmed. You can now log in.");
    }
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
      // Another player: the Shop and Wardrobe show nothing of the last one.
      this.fittingRoom?.close();
      this.fittingRoom = undefined;
      this.fitProgress = null;
      this.account = null;
      this.raidLook = undefined;
      this.raidClears = {};
      this.economy = undefined;
      this.savedFighter = undefined;
      this.blocked = [];
      clearTimeout(this.fighterTimer);
    }
    this.hooks.onSession(session?.access_token ?? null, session?.user.id);
    if (session && !samePlayer) this.hooks.onChange();
    if (session) {
      try {
        if (!samePlayer) await waitForServer();
        if (version !== this.generation) return;
        const account = accountSchema.parse(await this.api("/api/account"));
        if (version !== this.generation) return;
        this.account = account;
        // A new login: start on the fighter this account last picked, on
        // whatever device (not awaited: the rest of the profile goes on).
        if (!samePlayer) void this.loadSavedFighter(version);
        if (!samePlayer) void this.loadBlocked(version);
        try {
          const progress = (await this.api("/api/raids")) as RaidProgress;
          if (version !== this.generation) return;
          this.raidLook = raidLookOf(progress);
          noteSeenRewards(account.id, progress);
          this.raidClears = bossClears(progress);
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
        this.fittingRoom?.refresh();
        this.missionsScreen?.refresh();
        this.journeyScreen?.refresh();
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
  /** The Farm reports a new leaf balance: update the pill in place. */
  setLeaves(balance: number) {
    if (!this.economy?.leaves || this.economy.leaves.balance === balance)
      return;
    this.economy.leaves.balance = balance;
    const b = document.querySelector("#account-leaves .leaf-chip b");
    if (b) b.textContent = compactCoins(balance);
    document
      .getElementById("account-leaves")
      ?.setAttribute("aria-label", `Farm: ${coins(balance)} Gold Leaves`);
  }
  async api(path: string, body?: unknown): Promise<unknown> {
    const origin = import.meta.env.VITE_SERVER_URL || location.origin;
    const sentAt = Date.now();
    const response = await fetch(new URL(path, origin), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${this.session?.access_token ?? ""}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    noteServerTime(
      response.headers.get(SERVER_TIME_HEADER),
      sentAt,
      Date.now(),
    );
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(value.error ?? "Request failed."), {
        status: response.status,
      });
    return value;
  }
  /**
   * The fighter saved with the account: shown here unless this device
   * picked another one while it was asked for. With none saved yet, the
   * fighter on screen is saved.
   */
  /** The players you blocked (migration 110), newest first. */
  blocked: BlockedPlayer[] = [];
  private async loadBlocked(version = this.generation) {
    try {
      const list = blockedListSchema.parse(await this.api("/api/blocks"));
      if (version === this.generation) this.blocked = list;
    } catch {
      // Before migration 110 nobody is blocked.
    }
    this.friendsScreen?.refresh();
  }
  isBlocked(id: string | null | undefined) {
    return !!id && this.blocked.some((b) => b.id === id);
  }
  /**
   * Block a player, after asking: they leave your friends, can't send you
   * requests or invites, and disappear from your Plaza. Resolves true once
   * blocked; throws the server's reason.
   */
  async block(id: string, name: string) {
    const sure = await askConfirm({
      kicker: "Block player",
      title: `Block ${name}?`,
      lines: [
        ["Friends", "Removed, with any requests"],
        ["Requests and invites", "They can't send you any"],
        ["Plaza", "You won't see them"],
      ],
      extra:
        '<p class="ui-note">They aren\'t told. You can unblock them under Friends → Recent.</p>',
      confirm: "Block",
    });
    if (!sure) return false;
    await this.api("/api/blocks", { playerId: id, block: true });
    this.blocked = [{ id, name }, ...this.blocked.filter((b) => b.id !== id)];
    await this.afterBlockChange(id);
    return true;
  }
  async unblock(id: string) {
    await this.api("/api/blocks", { playerId: id, block: false });
    this.blocked = this.blocked.filter((b) => b.id !== id);
    await this.afterBlockChange(id);
  }
  private async afterBlockChange(id: string) {
    const account = this.account?.id;
    if (!account) return;
    const recent = this.friendsData.recent;
    if (recent && this.isBlocked(id))
      this.friendsData = {
        ...this.friendsData,
        recent: recent.map((p) =>
          p.id === id ? { ...p, relation: "none" } : p,
        ),
      };
    if (this.friendsScreen?.isOpen) await this.loadFriendList(account);
    this.friendsScreen?.refresh();
  }
  private async loadSavedFighter(version: number) {
    const picks = this.fighterPicks;
    let fighter: unknown;
    try {
      ({ fighter } = (await this.api("/api/account/fighter")) as {
        fighter: unknown;
      });
    } catch {
      return; // Optional until migration 108 is installed.
    }
    if (version !== this.generation) return;
    if (typeof fighter === "string" && Object.hasOwn(CHARACTERS, fighter)) {
      this.savedFighter = fighter;
      // A pick made meanwhile is already on its way to the account.
      if (picks === this.fighterPicks)
        this.hooks.restoreFighter?.(fighter as CharacterId);
      return;
    }
    this.savedFighter = null;
    const current = this.hooks.selectedCharacter?.();
    if (current) this.saveFighter(current);
  }
  /** Keep a fighter you picked with your account (once you stop browsing). */
  saveFighter(id: CharacterId) {
    this.fighterPicks++;
    if (!this.account || !this.session) return;
    clearTimeout(this.fighterTimer);
    if (id === this.savedFighter) return;
    const version = this.generation;
    this.fighterTimer = setTimeout(() => {
      if (version !== this.generation || id === this.savedFighter) return;
      this.api("/api/account/fighter", { fighter: id }).then(
        () => {
          if (version === this.generation) this.savedFighter = id;
        },
        () => {
          /* Kept on this device; the next pick tries again. */
        },
      );
    }, 800);
  }
  ensurePlayer() {
    if (!this.account) {
      this.showAuth("login");
      return false;
    }
    return true;
  }
  /** Refresh frame/skin/fighter together without rebuilding an unchanged avatar. */
  syncAvatar() {
    const avatar = document.querySelector<HTMLElement>(
      "#account-profile .account-avatar",
    );
    if (!avatar || !this.account) return;
    const character = this.hooks.selectedCharacter?.() ?? "voltkit";
    const key = JSON.stringify([
      character,
      this.economy?.looks[character] ?? null,
      this.raidLook ?? null,
      frameStars(this.raidLook?.frame, this.raidClears),
    ]);
    if (avatar.dataset.avatarLook === key) return;
    avatar.innerHTML = framedAvatar(
      {
        character,
        raidLook: this.raidLook,
        championLooks: this.economy?.looks,
      },
      "account-nav",
      frameStars(this.raidLook?.frame, this.raidClears),
    );
    avatar.dataset.champion = character;
    avatar.dataset.avatarLook = key;
  }
  renderNav() {
    const root = element("account-nav");
    if (!root) return;
    root.innerHTML = this.account
      ? `<button class="quiet coin-button" id="account-coins" aria-label="Shop: ${this.economy?.unlimitedCoins ? "unlimited" : this.economy ? coins(this.economy.balance) : "your"} coins">${coinChip(this.economy?.balance, "", this.economy?.unlimitedCoins, true)}</button>${this.economy?.leaves ? `<button class="quiet coin-button" id="account-leaves" aria-label="Farm: ${coins(this.economy.leaves.balance)} Gold Leaves" title="Gold Leaves: earned on the Farm">${leafChip(this.economy.leaves.balance)}</button>` : ""}<button class="quiet" id="account-profile"><span class="account-avatar" data-champion="${this.hooks.selectedCharacter?.() ?? "voltkit"}" aria-hidden="true"></span><span class="account-name">${escape(this.account.displayName)}</span>${this.economy?.journey ? `<small class="nav-level">Lv ${playerLevel(this.economy.journey.xp).level}</small><span class="nav-xp" aria-hidden="true"><i style="width:${Math.round(playerLevel(this.economy.journey.xp).percent)}%"></i></span>` : ""}${this.account.title ? `<small class="nav-title" style="color:${escape(this.account.titleColor ?? "#ffe58f")}">${escape(this.account.title)}</small>` : ""}</button>${this.account.isAdmin ? `<button class="quiet" id="account-admin" aria-label="Admin" title="Admin">${iconLabel("admin", "Admin")}</button>` : ""}<button class="quiet" id="account-logout" aria-label="Log out" title="Log out">${iconLabel("leave", "Log out")}</button>`
      : `<button class="quiet" id="account-login">${iconLabel("enter", "Log in")}</button><button class="secondary" id="account-signup">${iconLabel("add-friend", "Sign up")}</button>`;
    this.syncAvatar();
    if (this.account) {
      element("account-profile").onclick = () => void this.showProfile();
      element("account-coins").onclick = () => void this.showShop();
      const leaves = document.getElementById("account-leaves");
      if (leaves) leaves.onclick = () => this.hooks.openFarm?.();
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
        await this.signOutHere();
      };
      if (this.account.isAdmin)
        element("account-admin").onclick = () => void this.showAdmin();
    } else {
      element("account-login").onclick = () => this.showAuth("login");
      element("account-signup").onclick = () => this.showAuth("signup");
    }
  }
  /**
   * Sign in with Apple in the iPhone app: Apple's own sheet, then Supabase
   * with its identity token. The server then trades Apple's one-time code
   * for a refresh token, so deleting the account can revoke it.
   */
  private async signInWithAppleApp(message: HTMLElement) {
    if (!this.client) return;
    message.textContent = "";
    try {
      const apple = await signInWithAppleNatively();
      if (!apple) return;
      message.textContent = "Signing you in…";
      remember(true);
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: "apple",
        token: apple.identityToken,
        nonce: apple.nonce,
      });
      if (error) throw error;
      // Apple shares the name only on the first sign-in, and not in the
      // token: keep it for the profile (migration 001 reads full_name).
      if (apple.fullName)
        await this.client.auth
          .updateUser({ data: { full_name: apple.fullName } })
          .catch(() => undefined);
      await this.setSession(data.session);
      element<HTMLDialogElement>("dialog").close();
      void this.api("/api/account/apple", {
        code: apple.authorizationCode,
      }).catch((reason) =>
        console.warn("[apple] couldn't keep the sign-in token", reason),
      );
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "Sign in with Apple failed.";
    }
  }
  /**
   * Sign out on this device: leave rooms and worlds, forget the session.
   * After an account deletion the login is already gone, so Supabase's own
   * sign-out may complain; the session is forgotten either way.
   */
  private async signOutHere(afterDelete = false) {
    await this.hooks.beforeSignOut();
    const result = await this.client?.auth.signOut({ scope: "local" });
    if (result?.error && !afterDelete) {
      this.hooks.notify(result.error.message);
      return;
    }
    storage.removeItem(storageKey);
    await this.setSession(null);
  }
  showAuth(mode: "login" | "signup" | "forgot" | "reset") {
    const copy = {
      login: ["Welcome back", "Log in to step back into Elemental Plaza."],
      signup: [
        "Create your account",
        "Free to play. Your level, skins and friends follow you everywhere.",
      ],
      forgot: [
        "Reset your password",
        "Enter your email and we'll send you a recovery link.",
      ],
      reset: ["Choose a new password", "Use at least 8 characters."],
    }[mode];
    const field = (label: string, input: string) =>
      `<label class="auth-field"><span>${label}</span>${input}</label>`;
    const tabs =
      mode === "login" || mode === "signup"
        ? `<div class="auth-tabs" role="tablist" aria-label="Account">${(["login", "signup"] as const).map((m) => `<button type="button" role="tab" data-auth-tab="${m}" aria-selected="${m === mode}">${m === "login" ? "Log in" : "Create account"}</button>`).join("")}</div>`
        : "";
    const fields = [
      mode === "signup"
        ? field(
            "Display name",
            '<input name="displayName" maxlength="20" required autocomplete="nickname" placeholder="Your player name">',
          )
        : "",
      mode !== "reset"
        ? field(
            "Email",
            '<input name="email" type="email" required autocomplete="email" placeholder="you@example.com">',
          )
        : "",
      mode !== "forgot"
        ? passwordField(
            mode === "reset" ? "New password" : "Password",
            "password",
            `${mode === "login" ? "" : 'minlength="8"'} maxlength="128" required autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="${mode === "login" ? "Your password" : "8+ characters"}"`,
          )
        : "",
      mode === "signup" || mode === "reset"
        ? passwordField(
            "Confirm password",
            "confirmPassword",
            'minlength="8" maxlength="128" required autocomplete="new-password" placeholder="Type it again"',
          )
        : "",
    ].join("");
    const extras =
      mode === "login"
        ? '<div class="auth-row"><label class="auth-check"><input id="auth-remember" type="checkbox"><span>Remember me</span></label><button type="button" class="auth-link" id="auth-forgot">Forgot password?</button></div>'
        : "";
    const submitLabel = {
      login: "Log in",
      signup: "Create account",
      forgot: "Send recovery link",
      reset: "Update password",
    }[mode];
    const guest =
      (mode === "login" || mode === "signup") && this.client
        ? `<div class="auth-divider"><span>or</span></div><form id="guest-form" class="auth-guest"><input name="nickname" maxlength="20" placeholder="Nickname (optional)" autocomplete="nickname" aria-label="Guest nickname"><button class="auth-secondary" type="submit">${iconLabel("user", "Play as a guest")}</button></form><p class="auth-note">No email needed. Save your account later from your profile to keep your progress.</p>`
        : "";
    const back =
      mode === "forgot" || mode === "reset"
        ? '<button type="button" class="auth-link auth-back" id="auth-switch">← Back to log in</button>'
        : "";
    const html = `<section class="auth-panel" data-mode="${mode}"><div class="auth-head"><span class="auth-crest" aria-hidden="true"><svg viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><div class="auth-title">${copy[0]}</div><p>${copy[1]}</p></div>${tabs}${!this.client ? '<p class="auth-warning">Sign-in isn\'t available right now. Please try again later.</p>' : ""}<form id="auth-form" class="auth-form">${fields}${extras}<button class="auth-submit" type="submit" ${!this.client ? "disabled" : ""}>${submitLabel}</button>${APPLE_SIGN_IN && (mode === "login" || mode === "signup") ? `<button id="auth-apple" class="auth-secondary auth-apple" type="button" ${!this.client ? "disabled" : ""}>${APPLE_LOGO}<span>Continue with Apple</span></button>` : ""}${SHOW_GOOGLE && (mode === "login" || mode === "signup") ? `<button id="auth-google" class="auth-secondary" type="button" ${!this.client ? "disabled" : ""}>Continue with Google</button>` : ""}<p id="auth-message" class="auth-message" role="status"></p></form>${guest}${back}</section>`;
    // On the welcome screen the panel sits in the page; elsewhere in a dialog.
    const host = document.getElementById("gate-auth");
    if (host) host.innerHTML = html;
    else this.hooks.openDialog(html);
    document
      .querySelectorAll<HTMLButtonElement>("[data-auth-tab]")
      .forEach((tab) => {
        tab.onclick = () =>
          this.showAuth(tab.dataset.authTab as "login" | "signup");
      });
    document
      .getElementById("auth-switch")
      ?.addEventListener("click", () => this.showAuth("login"));
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
    // Google and Apple leave for their own page and come back signed in.
    const signInWith = async (provider: "google" | "apple") => {
      if (!this.client) return;
      remember(
        mode === "login" && element<HTMLInputElement>("auth-remember").checked,
      );
      const { error } = await this.client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authRedirectUrl(site, "auth-callback") },
      });
      if (error) message.textContent = error.message;
    };
    if (SHOW_GOOGLE && (mode === "login" || mode === "signup"))
      element("auth-google").onclick = () => void signInWith("google");
    if (APPLE_SIGN_IN && (mode === "login" || mode === "signup"))
      element("auth-apple").onclick = () =>
        void (isNativeApp()
          ? this.signInWithAppleApp(message)
          : signInWith("apple"));
    const guestForm = element<HTMLFormElement>("guest-form");
    if (guestForm)
      guestForm.onsubmit = async (event) => {
        event.preventDefault();
        if (!this.client) return;
        const button = formSubmitButton(guestForm);
        const nickname = String(
          new FormData(guestForm).get("nickname") ?? "",
        ).trim();
        if (nickname && !nameAllowed(nickname)) {
          message.textContent = NAME_NOT_ALLOWED;
          return;
        }
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
      // The database would quietly name them "Trainer": say so first.
      if (
        mode === "signup" &&
        !nameAllowed(String(fields.get("displayName") ?? ""))
      ) {
        message.textContent = NAME_NOT_ALLOWED;
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
              emailRedirectTo: authRedirectUrl(site, "email-confirmed"),
            },
          });
          if (result.error) throw result.error;
          message.textContent = result.data.session
            ? "Account created. You are signed in."
            : "Check your email to confirm your account, then log in.";
        }
        if (mode === "forgot") {
          const result = await this.client.auth.resetPasswordForEmail(email, {
            redirectTo: authRedirectUrl(site, "reset-password"),
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
  /** The open Raids panel, if any (UI remodel step 5). */
  private raidScreen?: RaidScreen;
  private raidProgress: RaidProgress | null = null;
  private raidProblem = "";
  private raidLoading = false;
  private raidFriends: Friend[] | null = null;
  /**
   * Raids: the Raid Hall and a boss's page, a panel inside the Lobby. It
   * opens at once with what is known, then shows the server's fresh copy of
   * your raid records and your friends.
   */
  async showRaids(boss?: RaidBossId, tab?: RaidTab) {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    if (this.raidScreen?.isOpen) {
      this.raidScreen.show(boss, tab);
    } else {
      this.raidLoading = !this.raidProgress;
      this.raidProblem = "";
      this.raidFriends = null;
      this.raidScreen = openRaids(
        {
          data: () => {
            const room = this.hooks.raidParty?.() ?? {
              party: [],
              leader: true,
              inRoom: false,
            };
            return {
              progress: this.raidProgress,
              loading: this.raidLoading,
              problem: this.raidProblem,
              me: {
                name: this.account?.displayName ?? "You",
                character: this.hooks.selectedCharacter?.() ?? "voltkit",
              },
              party: room.party,
              leader: room.leader,
              inRoom: room.inRoom,
              friends: this.raidFriends,
            };
          },
          start: (id, options) => this.hooks.startRaid?.(id, options),
          invite: (id) =>
            this.hooks.inviteToParty?.(id) ??
            Promise.resolve({ ok: false, error: "Parties are unavailable." }),
          friends: () => void this.showFriends(),
          wardrobe: () => void this.showWardrobe(),
          onClose: () => (this.raidScreen = undefined),
        },
        { boss, tab },
      );
    }
    const screen = this.raidScreen;
    const [raids, friends] = await Promise.allSettled([
      this.api("/api/raids") as Promise<RaidProgress>,
      this.nearbyFriends(),
    ]);
    if (this.account?.id !== accountId || !screen.isOpen) return;
    if (raids.status === "fulfilled") {
      this.raidProgress = raids.value;
      this.raidProblem = "";
      this.raidLook = raidLookOf(raids.value);
      this.raidClears = bossClears(raids.value);
      this.hooks.onChange();
    } else if (!this.raidProgress)
      this.raidProblem =
        raids.reason instanceof Error
          ? raids.reason.message
          : "Raid records are not available yet.";
    this.raidFriends =
      friends.status === "fulfilled" ? friends.value.friends : [];
    this.raidLoading = false;
    screen.refresh();
  }
  /** Redraw the Raids panel (your party changed). */
  refreshRaids() {
    this.raidScreen?.refresh();
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
      this.fittingRoom?.refresh();
      this.missionsScreen?.refresh();
    } catch {
      /* Shop storage needs migration 010. */
    }
  }
  /** The open fitting room (Shop + Wardrobe), if any. */
  private fittingRoom?: FittingRoom;
  /** Raid progress for the Wardrobe (earned boss rewards, frame stars). */
  private fitProgress: RaidProgress | null = null;
  private fitProblem = "";
  private fitLoading = false;
  private fitRequest = 0;
  /** The Wardrobe: the fitting room on your items (owner's decision 3). */
  async showWardrobe() {
    return this.showFittingRoom("wardrobe");
  }
  /** The Shop: Today, Skins, the Mythic Hall and Collections. */
  async showShop(section?: ShopSection, champion?: CharacterId) {
    return this.showFittingRoom("shop", section, champion);
  }
  /** Close the fitting room (another screen is opening). */
  closeFittingRoom() {
    this.fittingRoom?.close();
  }
  /**
   * The fitting room opens inside the Lobby at once with what is known, then
   * shows the server's fresh copy of your coins, items and raid rewards.
   */
  private async showFittingRoom(
    mode: FitMode,
    section?: ShopSection,
    champion?: CharacterId,
  ) {
    if (!this.ensurePlayer()) return;
    // It lives in the Lobby: come back to it, and close any old dialog.
    this.toLobbyScreen();
    if (this.fittingRoom?.isOpen) this.fittingRoom.show(mode, section);
    else {
      this.fitLoading = !this.economy;
      this.fitProblem = "";
      this.fittingRoom = openFittingRoom(mode, this.fitHooks(), {
        section,
        champion: champion ?? this.hooks.selectedCharacter?.() ?? "voltkit",
      });
    }
    await this.loadFittingRoom();
  }
  private async loadFittingRoom() {
    const request = ++this.fitRequest;
    const accountId = this.account?.id;
    const [economy, raids] = await Promise.allSettled([
      this.api("/api/economy"),
      this.api("/api/raids"),
    ]);
    // A newer load, another player or a closed screen: leave it.
    if (
      request !== this.fitRequest ||
      this.account?.id !== accountId ||
      !this.fittingRoom?.isOpen
    )
      return;
    this.fitLoading = false;
    if (economy.status === "fulfilled") this.economy = economy.value as Economy;
    if (raids.status === "fulfilled") {
      this.fitProgress = raids.value as RaidProgress;
      this.raidLook = raidLookOf(this.fitProgress);
      this.raidClears = bossClears(this.fitProgress);
    }
    this.fitProblem =
      economy.status === "rejected"
        ? `${economy.reason instanceof Error ? economy.reason.message : "The Shop could not load."} The Shop needs the latest database update (migration 010).`
        : raids.status === "rejected"
          ? "Your raid rewards could not load. Close and reopen to try again."
          : "";
    this.renderNav();
    this.syncAvatar();
    this.fittingRoom.refresh();
  }
  private fitHooks() {
    const accountId = this.account?.id;
    // Equipping reloads the same player's profile (a new generation), so
    // only a different signed-in account stops further saves.
    const same = () => {
      if (this.account?.id !== accountId)
        throw new Error("Your session changed. Reopen the Shop to continue.");
    };
    const changed = () => {
      this.renderNav();
      try {
        this.hooks.onChange();
      } catch (error) {
        console.error(error);
      }
    };
    return {
      data: () => ({
        economy: this.economy ?? null,
        progress: this.fitProgress,
        look: this.raidLook ?? {},
        problem: this.fitProblem,
        loading: this.fitLoading,
      }),
      buy: async (item: string) => {
        same();
        // A load still on its way is older than this answer: drop it.
        this.fitRequest++;
        // The server sets the price and checks the balance: its answer counts.
        const result = (await this.api("/api/shop/buy", { item })) as {
          economy: Economy;
        };
        same();
        this.economy = result.economy;
        changed();
      },
      equipSkin: async (
        champion: CharacterId,
        skin: string | null,
        stage?: number,
      ) => {
        same();
        this.fitRequest++;
        const result = (await this.api("/api/shop/equip", {
          champion,
          skin,
          ...(skin ? { stage: stage ?? 1 } : {}),
        })) as { economy: Economy };
        same();
        this.economy = result.economy;
        changed();
      },
      equipLook: async (slot: RaidSlot, item: string | null) => {
        same();
        this.fitRequest++;
        const result = (await this.api("/api/raids/equip", { slot, item })) as {
          progress?: RaidProgress;
        };
        same();
        if (result.progress) {
          this.fitProgress = result.progress;
          this.raidLook = raidLookOf(result.progress);
          this.raidClears = bossClears(result.progress);
        } else this.raidLook = { ...this.raidLook, [slot]: item };
        changed();
      },
      playAs: (champion: CharacterId) => this.hooks.chooseFighter?.(champion),
      missions: () => {
        this.fittingRoom?.close();
        void this.showMissions();
      },
      retry: () => {
        this.fitLoading = true;
        this.fittingRoom?.refresh();
        void this.loadFittingRoom();
      },
      notify: (message: string) => this.hooks.notify(message),
    };
  }
  /** The open Journey panel, if any (UI remodel step 4). */
  private journeyScreen?: JourneyScreen;
  private journeyProblem = "";
  private journeyLoading = false;
  /**
   * The Journey: a panel inside the Lobby (Season · Levels · Weekly arcade).
   * It opens at once with what is known, then shows the server's fresh copy.
   */
  async showJourney(tab: JourneyTab = "season") {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    if (!this.journeyScreen?.isOpen) {
      this.journeyLoading = !this.economy;
      this.journeyProblem = "";
      this.journeyScreen = openJourney(
        {
          data: () => ({
            economy: this.economy ?? null,
            look: this.raidLook ?? {},
            champion: this.hooks.selectedCharacter?.() ?? "voltkit",
            loading: this.journeyLoading,
            problem: this.journeyProblem,
          }),
          equip: async (id) => {
            if (this.account?.id !== accountId)
              throw new Error("Your session changed. Reopen the Journey.");
            const item = JOURNEY_ITEM_BY_ID[id];
            // The shared appearance route, as the Wardrobe uses.
            const result = (await this.api("/api/raids/equip", {
              slot: item.slot,
              item: item.id,
            })) as { progress: RaidProgress };
            this.raidLook = raidLookOf(result.progress);
            this.raidClears = bossClears(result.progress);
            this.syncAvatar();
            this.hooks.onChange();
          },
          wardrobe: () => void this.showWardrobe(),
          play: (mode) => this.hooks.startAdventure?.(mode),
          onClose: () => (this.journeyScreen = undefined),
        },
        { tab },
      );
    }
    const screen = this.journeyScreen;
    try {
      const economy = (await this.api("/api/economy")) as Economy;
      if (this.account?.id !== accountId || !screen.isOpen) return;
      this.economy = economy;
      this.journeyProblem = "";
      this.renderNav();
    } catch (error) {
      if (this.account?.id !== accountId || !screen.isOpen) return;
      // The arcade still works before progression storage is installed.
      if (!this.economy)
        this.journeyProblem =
          error instanceof Error
            ? `${error.message} Levels and seasons need the latest database update.`
            : "Levels and seasons are not available yet.";
    }
    this.journeyLoading = false;
    screen.refresh();
  }
  /** The open Missions sheet, if any (UI remodel step 4). */
  private missionsScreen?: MissionsScreen;
  private missionsProblem = "";
  private missionsLoading = false;
  /** Leave for the Lobby (a hub screen lives there) and close any old dialog. */
  private toLobbyScreen() {
    this.hooks.toLobby?.();
    const dialog = document.getElementById(
      "dialog",
    ) as HTMLDialogElement | null;
    // The close button also resets the game's "menu open" input guard.
    if (dialog?.open)
      dialog.querySelector<HTMLButtonElement>("#close-dialog")?.click();
    if (dialog?.open) dialog.close();
  }
  /**
   * Daily missions: a sheet inside the Lobby. It opens at once with what is
   * known, then shows the server's fresh copy.
   */
  async showMissions() {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    if (!this.missionsScreen?.isOpen) {
      this.missionsLoading = !this.economy;
      this.missionsProblem = "";
      this.missionsScreen = openMissions({
        data: () => ({
          economy: this.economy ?? null,
          problem: this.missionsProblem,
          loading: this.missionsLoading,
        }),
        change: async (slot) => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen Missions.");
          // The server picks the new mission and counts the change.
          this.economy = (
            (await this.api("/api/missions/reroll", { slot })) as {
              economy: Economy;
            }
          ).economy;
          this.renderNav();
          this.hooks.onChange();
        },
        onClose: () => (this.missionsScreen = undefined),
      });
    }
    const screen = this.missionsScreen;
    try {
      const economy = (await this.api("/api/economy")) as Economy;
      if (this.account?.id !== accountId || !screen.isOpen) return;
      this.economy = economy;
      this.missionsProblem = "";
      this.renderNav();
    } catch (error) {
      if (this.account?.id !== accountId || !screen.isOpen) return;
      this.missionsProblem =
        error instanceof Error
          ? `${error.message} Missions need the latest database update.`
          : "Missions are not available yet.";
    }
    this.missionsLoading = false;
    screen.refresh();
  }
  /** The open player card, if any (UI remodel step 7). */
  private profileScreen?: ProfileScreen;
  private profileData: Pick<
    ProfileData,
    "progress" | "progressProblem" | "raids" | "nameStatus"
  > = { progress: null, raids: null, nameStatus: null };
  /**
   * The player card and profile: a panel inside the Lobby (HUD → your
   * name). It opens at once and fills in from the server.
   */
  async showProfile() {
    if (!this.account) return;
    this.toLobbyScreen();
    const accountId = this.account.id;
    if (!this.profileScreen?.isOpen) {
      this.profileData = {
        progress: null,
        raids: this.raidProgress ?? null,
        nameStatus: null,
      };
      this.profileScreen = openProfile({
        data: () => {
          const a = this.account!;
          return {
            ...this.profileData,
            name: a.displayName,
            title: a.title,
            titleColor: a.titleColor,
            titles: a.ownedTitles as Title[],
            guest: !!a.guest,
            role: a.isAdmin ? "Administrator" : a.guest ? "Guest" : "Player",
            email: this.session?.user.email ?? undefined,
            fighter: this.hooks.selectedCharacter?.() ?? "voltkit",
            journey: this.economy?.journey,
            canDelete: !a.isAdmin,
          };
        },
        equip: async (titleId) => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen your card.");
          await this.api("/api/account/title", { titleId: titleId || null });
          // The account (and the HUD's nameplate) from the server.
          await this.refresh();
        },
        rename: async (name) => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen your card.");
          // The database cleans the name and owns the 14 days.
          const status = nameStatusSchema.parse(
            await this.api("/api/account/name", { name }),
          );
          this.profileData = { ...this.profileData, nameStatus: status };
          // The account (the HUD, the card) from the server.
          await this.refresh();
          return this.account?.displayName ?? name;
        },
        save: async (email) => {
          if (!this.client) throw new Error("Accounts are not available.");
          const site = import.meta.env.VITE_SITE_URL || location.origin;
          const { error } = await this.client.auth.updateUser(
            { email },
            { emailRedirectTo: authRedirectUrl(site, "email-confirmed") },
          );
          if (error) throw new Error(error.message);
          return "Check your inbox and confirm the email. Then choose a password with “Forgot password?” on the login screen, or keep playing here.";
        },
        deleteAccount: async () => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen your card.");
          const apple = !!this.session?.user.identities?.some(
            (i) => i.provider === "apple",
          );
          // The server deletes the login and everything that's yours (and
          // revokes Sign in with Apple when it kept the app's token).
          const reply = (await this.api("/api/account/delete", {
            confirm: true,
          })) as { appleRevoked?: boolean };
          this.confirmedGuestLogout = false;
          await this.signOutHere(true);
          this.hooks.notify(
            reply.appleRevoked
              ? "Your account and its data are deleted, and Sign in with Apple is disconnected. Thanks for playing."
              : apple
                ? "Your account and its data are deleted. To also disconnect Sign in with Apple, open your Apple Account settings, Sign in with Apple, and remove Element Arena."
                : "Your account and its data are deleted. Thanks for playing.",
          );
        },
        retry: () => this.loadProfile(accountId),
        ranks: () => void this.showLeaderboard(),
        journey: () => void this.showJourney(),
        raids: (boss) =>
          void this.showRaids(boss, boss ? "rewards" : undefined),
        onClose: () => (this.profileScreen = undefined),
      });
    }
    await this.loadProfile(accountId);
  }
  private async loadProfile(accountId: string) {
    const screen = this.profileScreen;
    const [progress, raids, name] = await Promise.allSettled([
      this.api("/api/progress"),
      this.api("/api/raids") as Promise<RaidProgress>,
      this.api("/api/account/name"),
    ]);
    if (this.account?.id !== accountId) return;
    if (progress.status === "fulfilled")
      this.profileData = {
        ...this.profileData,
        progress: progressSchema.parse(progress.value),
        progressProblem: "",
      };
    else
      this.profileData = {
        ...this.profileData,
        progressProblem:
          progress.reason instanceof Error &&
          /database needs an update/.test(progress.reason.message)
            ? "Records, achievements and mastery switch on once the database update (migration 004) has been run."
            : "Your records couldn't be loaded right now.",
      };
    if (raids.status === "fulfilled")
      this.profileData = { ...this.profileData, raids: raids.value };
    // Before migration 066 there is no name status: the button stays and
    // the server explains if it can't change the name.
    if (name.status === "fulfilled") {
      const parsed = nameStatusSchema.safeParse(name.value);
      if (parsed.success)
        this.profileData = { ...this.profileData, nameStatus: parsed.data };
    }
    if (screen?.isOpen) screen.refresh();
  }
  /** The open Friends sheet, if any (UI remodel step 6). */
  private friendsScreen?: FriendsScreen;
  private friendsData: Pick<
    FriendsData,
    "list" | "problem" | "recent" | "recentProblem"
  > = { list: null, recent: null };
  get friendsOpen() {
    return !!this.friendsScreen?.isOpen;
  }
  /**
   * Friends: a sheet beside the Lobby (or, in a private room, where the
   * room's picker stands). It opens at once and fills in from the server.
   */
  async showFriends() {
    if (!this.ensurePlayer()) return;
    const accountId = this.account!.id;
    const host = this.hooks.friendsHost?.();
    if (!host) this.toLobbyScreen();
    if (this.friendsScreen?.isOpen) {
      await this.friendsScreen.reload();
      return;
    }
    this.friendsData = { list: null, recent: null };
    const fresh = () => this.account?.id === accountId;
    const ok = (reply: { ok: boolean; error?: string } | undefined) =>
      reply ?? { ok: false, error: "Invites are unavailable here." };
    this.friendsScreen = openFriends({
      host,
      pins: readPinnedFriends(accountId),
      data: () => {
        const room = host ? this.hooks.friendsRoom?.() : undefined;
        const party = this.hooks.raidParty?.();
        return {
          ...this.friendsData,
          blocked: this.blocked,
          room,
          party: {
            size: Math.max(1, party?.party.length ?? 1),
            ids: party?.party.map((s) => s.id) ?? [],
            leader: party?.leader ?? true,
          },
        };
      },
      reload: () => this.loadFriendList(accountId),
      loadRecent: async () => {
        this.friendsData = { ...this.friendsData, recentProblem: "" };
        try {
          const { players } = recentPlayersSchema.parse(
            await this.api("/api/friends/recent"),
          );
          if (fresh())
            this.friendsData = { ...this.friendsData, recent: players };
        } catch (error) {
          if (fresh())
            this.friendsData = {
              ...this.friendsData,
              recentProblem:
                error instanceof Error
                  ? error.message
                  : "Couldn't load recent players.",
            };
        }
      },
      respond: async (playerId, accept) => {
        await this.api("/api/friends/respond", { playerId, accept });
        await this.afterFriendChange(
          accountId,
          playerId,
          accept ? "friend" : "none",
        );
      },
      remove: async (playerId) => {
        await this.api("/api/friends/remove", { playerId });
        await this.afterFriendChange(accountId, playerId, "none");
      },
      request: async (body) => {
        const text = await this.sendFriendRequest(body);
        if (body.playerId)
          await this.afterFriendChange(
            accountId,
            body.playerId,
            text === "Friend request sent." ? "sent" : "friend",
          );
        else await this.loadFriendList(accountId);
        return text;
      },
      block: (id, name) => this.block(id, name),
      unblock: (id) => this.unblock(id),
      inviteToParty: async (id) => ok(await this.hooks.inviteToParty?.(id)),
      inviteToRoom: async (id) => ok(await this.hooks.inviteFriend?.(id)),
      join: (code) => this.hooks.joinRoom?.(code),
      watch: (code) => this.hooks.watchRoom?.(code),
      savePins: (pins) => savePinnedFriends(accountId, pins),
      onClose: () => {
        this.friendsScreen = undefined;
        this.hooks.onFriendsClosed?.();
      },
    });
    await this.friendsScreen.reload();
  }
  private async loadFriendList(accountId: string) {
    try {
      const list = friendsSchema.parse(await this.api("/api/friends"));
      if (this.account?.id !== accountId) return;
      this.friendsData = { ...this.friendsData, list, problem: "" };
    } catch (error) {
      if (this.account?.id !== accountId) return;
      this.friendsData = {
        ...this.friendsData,
        problem:
          error instanceof Error &&
          /database needs an update/.test(error.message)
            ? "Friends switch on once the database update (migration 005) has been run."
            : error instanceof Error
              ? error.message
              : "Couldn't load your friends.",
      };
    }
  }
  /** A request, answer or removal: the list and Recent show the new state. */
  private async afterFriendChange(
    accountId: string,
    id: string,
    relation: RecentPlayer["relation"],
  ) {
    const recent = this.friendsData.recent;
    if (recent)
      this.friendsData = {
        ...this.friendsData,
        recent: recent.map((p) => (p.id === id ? { ...p, relation } : p)),
      };
    await this.loadFriendList(accountId);
  }
  async nearbyFriends() {
    return friendsSchema.parse(await this.api("/api/friends"));
  }
  /** Send a friend request by code or player id; resolves with what happened. */
  private async sendFriendRequest(body: { code?: string; playerId?: string }) {
    try {
      const { result } = (await this.api("/api/friends/request", body)) as {
        result: string;
      };
      return result === "friends"
        ? "You're now friends."
        : result === "already"
          ? "You're already friends."
          : "Friend request sent.";
    } catch (error) {
      throw new Error(
        error instanceof Error && /database needs an update/.test(error.message)
          ? "Friends switch on once the database update (migration 005) has been run."
          : error instanceof Error
            ? error.message
            : "Couldn't send that request.",
      );
    }
  }
  /** Send a friend request from elsewhere (match results, the Plaza). */
  async friendRequest(body: { code?: string; playerId?: string }) {
    try {
      this.hooks.notify(await this.sendFriendRequest(body));
      if (this.friendsOpen) await this.loadFriends();
      return true;
    } catch (error) {
      this.hooks.notify((error as Error).message);
      return false;
    }
  }
  async loadFriends() {
    await this.friendsScreen?.reload();
  }
  /** Quick check after login: say if someone wants to be friends. */
  async checkFriendRequests() {
    try {
      const list = friendsSchema.parse(await this.api("/api/friends"));
      // Friends already shows them on top (and the toast would cover it).
      if (list.incoming.length && !this.friendsOpen)
        this.hooks.notify(
          `${list.incoming.length === 1 ? `${list.incoming[0].name} wants` : `${list.incoming.length} players want`} to be friends. Open Friends to answer.`,
        );
      return list;
    } catch {
      return undefined;
    }
  }
  /** The open Ranks panel, if any (UI remodel step 6). */
  private ranksScreen?: RanksScreen;
  private ranksData: Omit<RanksData, "me"> = { board: null, friends: null };
  /**
   * Ranks: your rank and the leaderboard, a panel inside the Lobby. The
   * Friends board loads the first time it is picked.
   */
  async showLeaderboard() {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    if (!this.ranksScreen?.isOpen) {
      this.ranksData = { board: null, friends: null };
      this.ranksScreen = openRanks({
        data: () => ({
          ...this.ranksData,
          me: { name: this.account?.displayName ?? "You" },
        }),
        load: (scope) => this.loadRanks(scope, accountId),
        friends: () => void this.showFriends(),
        onClose: () => (this.ranksScreen = undefined),
      });
    }
    await this.loadRanks("everyone", accountId);
    this.ranksScreen?.refresh();
  }
  private async loadRanks(scope: "everyone" | "friends", accountId?: string) {
    const fresh = () => this.account?.id === accountId;
    if (scope === "everyone") {
      this.ranksData = { ...this.ranksData, problem: "" };
      try {
        const board = leaderboardSchema.parse(
          await this.api("/api/leaderboard"),
        );
        if (fresh()) this.ranksData = { ...this.ranksData, board };
      } catch (error) {
        if (fresh())
          this.ranksData = {
            ...this.ranksData,
            problem:
              error instanceof Error
                ? error.message
                : "Couldn't load the standings.",
          };
      }
    } else {
      this.ranksData = { ...this.ranksData, friendsProblem: "" };
      try {
        const friends = friendsBoardSchema.parse(
          await this.api("/api/leaderboard/friends"),
        );
        if (fresh()) this.ranksData = { ...this.ranksData, friends };
      } catch (error) {
        if (fresh())
          this.ranksData = {
            ...this.ranksData,
            friendsProblem:
              error instanceof Error
                ? error.message
                : "Couldn't load your friends' ranks.",
          };
      }
    }
  }
  /** Ask the admin team for help. `context` is attached automatically. */
  showReport(
    context: Record<string, string> = {},
    category?: keyof typeof REPORT_CATEGORIES,
  ) {
    if (!this.account) {
      this.hooks.notify("Log in to report a problem.");
      this.showAuth("login");
      return;
    }
    this.hooks.openDialog(
      `<div class="eyebrow">Help us fix it</div><h2>${context.playerName ? `Report ${escape(context.playerName)}` : "Report a problem"}</h2><p>Tell the admins what happened. Your current screen${context.playerName ? " and who you're reporting" : ""}${context.room ? ` and room code ${escape(context.room)}` : ""} are included automatically.</p><form id="report-form" class="account-form"><label>What kind of problem?<select name="category" required>${Object.entries(
        REPORT_CATEGORIES,
      )
        .map(
          ([value, label]) =>
            `<option value="${value}"${value === category ? " selected" : ""}>${label}</option>`,
        )
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
