import { confirmAge, saidUnderAge } from "./age-gate";
import { isNativeApp, PRIVACY_URL, signInWithAppleNatively } from "./native";
import {
  sessionCookieStorage,
  sharesSession,
} from "../../../packages/shared/src/session-cookie";
import {
  nameAllowed,
  NAME_NOT_ALLOWED,
} from "../../../packages/shared/src/name-filter";
import { identityPortrait } from "./portraits";
import { AVATAR_BY_ID, isAvatar } from "../../../packages/shared/src/avatars";
import { preparePhoto } from "./avatar-photo";
import { idle } from "./svg-raster";
import type { FittingRoom } from "./screens/fitting-room";
import type { FitMode, ShopSection } from "./screens/fitting-room-view";
import type { JourneyScreen } from "./screens/journey";
import type { JourneyTab } from "./screens/journey-view";
import {
  playerLevel,
  JOURNEY_ITEM_BY_ID,
} from "../../../packages/shared/src/journey";
import { formSubmitButton } from "./dialog";
import type { RaidScreen } from "./screens/raid-hall";
import type { RaidSeat, RaidTab } from "./screens/raid-hall-view";
import type { SpireTab } from "./screens/spire-view";
import type { SpireProgress } from "../../../packages/shared/src/spire";
import { markSpireSeen, spireSeenKeys } from "./spire-nudge";
import { iconLabel } from "./menu-icons";
import { coinChip, coins } from "./shop-ui";
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
import { isQuietRefresh } from "./session-refresh";
import { curtainCovers, waitForServer } from "./server-connection";
import {
  forgetProfileCopy,
  keepProfileCopy,
  readProfileCopy,
  type ProfileCopy,
} from "./profile-copy";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  accountSchema,
  REPORT_CATEGORIES,
  type Account,
  type Title,
  leaderboardSchema,
  friendsBoardSchema,
  recentPlayersSchema,
  matchHistorySchema,
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
import { guestWarning } from "./guest-warning";
import { CHARACTERS, type CharacterId } from "@arena/shared";
// The Admin panel's code loads when an admin opens it (showAdmin): no one
// else runs it. Its stylesheet stays in the startup one, at this place.
import type { AdminPanel, AdminView } from "./admin-panel";
import "./admin-panel.css";
import { openProfile, type ProfileScreen } from "./screens/profile";
import { openFriendCard, type FriendCardScreen } from "./screens/friend-card";
import type { HistoryQuery } from "./screens/match-history";
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
/** Sign in with Apple, hidden until it is set up (docs/accounts-setup.md). */
const APPLE_SIGN_IN = import.meta.env.VITE_APPLE_SIGN_IN === "on";
/** Apple's logo for its sign-in button (Apple's button guidelines). */
const APPLE_LOGO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
/**
 * How long a screen reuses the server's copy it was last shown (ms). Every
 * open re-asking (records, raids, ranks, your name…) was a blank-then-filled
 * screen and a second redraw when the answers came: the hitch players saw on
 * each open (Nov 2026). Whatever changes these copies forgets them sooner
 * (see `copies`).
 */
export const COPY_MAX_AGE_MS = 30_000;
/** Friends are who's online right now: asked again sooner. */
export const FRIENDS_MAX_AGE_MS = 10_000;
/** Between screens' code loaded ahead (preloadScreens), and before the first. */
const PRELOAD_GAP_MS = 4000;
/**
 * How long a login waits for the saved fighter and avatar before showing the
 * hub anyway (they then arrive a moment later, as before).
 */
const PROFILE_EXTRAS_MS = 4000;
const storageKey = "parena-auth";
/**
 * On elementarenausa.com the session lives in a cookie for the whole domain,
 * shared with the website's account area and its Play button
 * (packages/shared/src/session-cookie.ts, docs/website-accounts.md). Anywhere
 * else (other hosts, local dev, the iPhone app) it stays in this origin's
 * storage as before.
 */
const ownStorage = {
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
/** A session too big to share (MAX_SHARED) stays in ownStorage, unshared. */
const sharedCookie =
  typeof document !== "undefined" &&
  !isNativeApp() &&
  sharesSession(location.hostname)
    ? sessionCookieStorage(document, ownStorage)
    : null;
sharedCookie?.adopt(storageKey);
const storage = sharedCookie ?? ownStorage;
function remember(value: boolean) {
  if (value) localStorage.setItem("parena-remember", "yes");
  else localStorage.removeItem("parena-remember");
  if (sharedCookie) return sharedCookie.remember(value, storageKey);
  const token = storage.getItem(storageKey);
  storage.removeItem(storageKey);
  if (token) storage.setItem(storageKey, token);
}
type Hooks = {
  openDialog: (html: string) => void;
  /** Join or watch a friend's room from the friends list. */
  joinRoom?: (code: string) => void;
  watchRoom?: (code: string) => void;
  friendsRoom?: () => FriendsRoom;
  inviteFriend?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Where Friends opens while you are in a private room (its picker's place). */
  friendsHost?: () => HTMLElement | undefined;
  /** Open the chat on a conversation with a friend (chat/chat-ui.ts). */
  messageFriend?: (id: string, name: string) => void;
  /** Friends closed (a room puts its picker back). */
  onFriendsClosed?: () => void;
  notify: (message: string) => void;
  /** Running announcements from the admins, fetched at sign-in (announcements.ts). */
  announce?: (list: unknown) => void;
  onChange: () => void;
  onSession: (token: string | null, accountId?: string) => void;
  /** Same player, fresh token (background refresh): keep it for reconnects only. */
  onToken: (token: string) => void;
  beforeSignOut: () => Promise<void>;
  selectedCharacter?: () => CharacterId;
  /** Report another player's own picture (asks first; main.ts). */
  reportPhoto?: (photo: string, name: string) => Promise<void>;
  /** Make a fighter your Lobby fighter. */
  chooseFighter?: (id: CharacterId) => void;
  /** Start a match against a bot of that level (match history). */
  playBot?: (level: "easy" | "normal" | "hard") => void;
  /** The fighter saved with the account (picked on another device). */
  restoreFighter?: (id: CharacterId) => void;
  /** Show the Lobby (the Shop and Wardrobe open inside it). */
  toLobby?: () => void;
  /**
   * Where your card (the header's avatar) opens instead of the Lobby: the
   * Plaza while you are on it, so looking at your card doesn't send you
   * back to the Lobby (owner, 24 Nov). None: it opens in the Lobby.
   */
  profileHost?: () => HTMLElement | undefined;
  /** Create a raid room for a boss (today's challenge, or straight in solo). */
  startAdventure?: (mode: string) => void;
  startRaid?: (
    boss: RaidBossId,
    options: { solo?: boolean; returnTab?: RaidTab },
  ) => void;
  /** Start a Spire climb (from your party's checkpoint, checked by the server). */
  startSpire?: (options: { solo?: boolean; returnTab?: SpireTab }) => void;
  /** Your Lobby party for the raid seats, and whether you can start. */
  raidParty?: () => {
    party: RaidSeat[];
    leader: boolean;
    inRoom: boolean;
  };
  /** Invite a friend to your Lobby party (the server answers). */
  inviteToParty?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Friends with an invitation from you still open (party or room): every
   * Invite button says Invited until they answer or it expires.
   */
  invitedFriends?: () => ReadonlySet<string>;
};
export class AccountUI {
  /*
   * What the first screen shows is kept on this device as it changes
   * (profile-copy.ts): the setters below note each change, and the next
   * start draws the hub from that copy while the server's loads.
   */
  #account: Account | null = null;
  get account() {
    return this.#account;
  }
  set account(value: Account | null) {
    this.#account = value;
    this.rememberSoon();
  }
  /**
   * The saved session has been checked: the profile loaded (or failed), or
   * this device's copy of it is shown while the fresh one loads
   * (`fromCopy`).
   */
  checked = false;
  /**
   * The profile on screen is this device's saved copy; the server's fresh
   * copy is still on its way (it replaces it, or is dropped on failure).
   */
  fromCopy = false;
  #raidLook: RaidLoadout | undefined = undefined;
  /** Equipped raid look (undefined until loaded). */
  get raidLook() {
    return this.#raidLook;
  }
  set raidLook(value: RaidLoadout | undefined) {
    this.#raidLook = value;
    this.rememberSoon();
  }
  #raidClears: Partial<Record<RaidBossId, number>> = {};
  /** Saved clears per boss: stars on your boss frame. */
  get raidClears() {
    return this.#raidClears;
  }
  set raidClears(value: Partial<Record<RaidBossId, number>>) {
    this.#raidClears = value;
    this.rememberSoon();
  }
  #economy: Economy | undefined = undefined;
  /** Coins, owned items, missions (undefined until loaded or before migration 010). */
  get economy() {
    return this.#economy;
  }
  set economy(value: Economy | undefined) {
    this.#economy = value;
    this.rememberSoon();
  }
  session: Session | null = null;
  #avatar: string | null = null;
  /** Your library avatar (avatars.ts); null: none chosen (the default). */
  get avatar() {
    return this.#avatar;
  }
  set avatar(value: string | null) {
    this.#avatar = value;
    this.rememberSoon();
  }
  #savedFighter: string | null | undefined = undefined;
  /** The fighter the account has saved (undefined until asked, null: none). */
  private get savedFighter() {
    return this.#savedFighter;
  }
  private set savedFighter(value: string | null | undefined) {
    this.#savedFighter = value;
    this.rememberSoon();
  }
  private rememberTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Keep the first screen's data on this device, shortly after it changes
   * (several fields change together). Never mid-load: a half-loaded profile
   * (a new account with the last one's coins, say) is not a copy.
   */
  private rememberSoon() {
    clearTimeout(this.rememberTimer);
    this.rememberTimer = setTimeout(() => this.rememberProfile(), 300);
  }
  private rememberProfile() {
    clearTimeout(this.rememberTimer);
    this.rememberTimer = undefined;
    const account = this.#account;
    if (
      !account ||
      this.sessionLoad ||
      this.fromCopy ||
      this.session?.user.id !== account.id
    )
      return;
    keepProfileCopy({
      account,
      economy: this.#economy,
      raidLook: this.#raidLook,
      raidClears: this.#raidClears,
      spire: this.spireProgress,
      avatar: this.#avatar,
      fighter:
        this.#savedFighter === undefined
          ? undefined
          : this.#savedFighter && Object.hasOwn(CHARACTERS, this.#savedFighter)
            ? (this.#savedFighter as CharacterId)
            : null,
    });
  }
  /** Show this device's copy of the profile while the fresh one loads. */
  private showCopy(copy: ProfileCopy) {
    this.fromCopy = true;
    this.#account = copy.account;
    this.#economy = copy.economy;
    this.#raidLook = copy.raidLook;
    this.#raidClears = copy.raidClears;
    this.spireProgress = copy.spire;
    this.#avatar = copy.avatar;
    this.#savedFighter = copy.fighter;
    this.checked = true;
    this.renderNav();
    this.syncAvatar();
    if (copy.fighter) this.hooks.restoreFighter?.(copy.fighter);
  }
  /** The fresh profile couldn't load: nothing from the copy stays. */
  private dropCopy() {
    if (!this.fromCopy) return;
    this.fromCopy = false;
    this.#account = null;
    this.#economy = undefined;
    this.#raidLook = undefined;
    this.#raidClears = {};
    this.spireProgress = null;
    this.#avatar = null;
    this.#savedFighter = undefined;
  }
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
    // The website shares this session (syncSharedSession): look every 30 s.
    if (sharedCookie)
      setInterval(() => void this.syncSharedSession().catch(() => {}), 30_000);
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
    // A fresh load of the profile (a login, the server saying the account
    // changed, after an equip…) asks the server for everything again.
    this.forgetCopies();
    // Reloading the same player (after a purchase, an equip, a title change…)
    // keeps what's on screen until the fresh copy arrives. Clearing it first
    // made an open Shop say "Log in" and ask a signed-in player to sign in.
    // (A profile shown from this device's copy is not loaded yet: it loads
    // in full, as a new login does.)
    const samePlayer =
      !!session &&
      !!this.account &&
      !this.fromCopy &&
      session.user?.id === this.account.id;
    this.session = session;
    if (!samePlayer) {
      // A previous signed-out check says nothing about this new profile load.
      // Keep the gate in its loading state until this request has completed.
      this.checked = false;
      // Another player: the Shop and Wardrobe show nothing of the last one.
      this.fittingRoom?.close();
      this.fittingRoom = undefined;
      this.fitProgress = null;
      // Nor any other screen's last copy (each kept it for the next open).
      this.forgetCopies();
      this.raidProgress = null;
      this.raidFriends = null;
      this.profileData = { progress: null, raids: null, nameStatus: null };
      this.ranksData = { board: null, friends: null };
      this.friendsData = { list: null, recent: null };
      this.account = null;
      this.raidLook = undefined;
      this.raidClears = {};
      this.spireProgress = null;
      this.economy = undefined;
      this.savedFighter = undefined;
      this.avatar = null;
      this.blocked = [];
      this.fromCopy = false;
      clearTimeout(this.fighterTimer);
      // Signed out: this device keeps no one's profile.
      if (!session) forgetProfileCopy();
      // Signed in: draw the hub from this device's copy at once (the fresh
      // profile below replaces it as it arrives).
      const copy = session ? readProfileCopy(session.user.id) : null;
      if (copy) this.showCopy(copy);
    }
    this.hooks.onSession(session?.access_token ?? null, session?.user.id);
    if (session && !samePlayer) this.hooks.onChange();
    let freshAccount = false;
    if (session) {
      try {
        if (!samePlayer) await waitForServer();
        if (version !== this.generation) return;
        const account = accountSchema.parse(await this.api("/api/account"));
        if (version !== this.generation) return;
        freshAccount = true;
        this.account = account;
        // Announcements still running (migration 20261122120000); none
        // before it, and never in the way of signing in.
        void this.api("/api/announcements").then(
          (list) => this.hooks.announce?.(list),
          () => {},
        );
        // A new login: start on the fighter this account last picked, on
        // whatever device, wearing their avatar. Both are part of the first
        // screen (waited for below, briefly), so it never opens on the
        // default fighter and swaps a moment later.
        const extras = samePlayer
          ? []
          : [
              this.loadSavedFighter(version),
              this.loadAvatar(version),
              this.loadBlocked(version),
            ];
        // Raids, the Spire and the Shop are separate records: asked for
        // together, the profile (and the skins it wears) arrives in one
        // round trip instead of three in a row.
        const [raids, spire, economy] = await Promise.allSettled([
          this.fetchCopy("/api/raids"),
          this.fetchCopy("/api/spire"),
          this.fetchCopy("/api/economy"),
        ]);
        if (version !== this.generation) return;
        // Raid storage is optional until migration 007 is installed.
        if (raids.status === "fulfilled") {
          try {
            const progress = raids.value as RaidProgress;
            // Raids open with it at once (and ask again only once it's old).
            this.raidProgress = progress;
            this.raidLook = raidLookOf(progress);
            noteSeenRewards(account.id, progress);
            this.raidClears = bossClears(progress);
          } catch {
            /* An older server's record: no raid look. */
          }
        }
        // The Spire's climb, for the Lobby's Spire card (spire-nudge.ts).
        // Before the Spire's migration: no climb, no card.
        if (spire.status === "fulfilled" && spire.value)
          this.spireProgress = spire.value as SpireProgress;
        // The Shop needs migration 010.
        if (economy.status === "fulfilled")
          this.economy = economy.value as Economy;
        if (extras.length)
          await Promise.race([
            Promise.allSettled(extras),
            new Promise((resolve) => setTimeout(resolve, PROFILE_EXTRAS_MS)),
          ]);
        if (version !== this.generation) return;
        // An open Shop or Missions screen shows the fresh copy.
        this.fittingRoom?.refresh();
        this.missionsScreen?.refresh();
        this.journeyScreen?.refresh();
      } catch (error) {
        if (version !== this.generation) return;
        // Without the fresh account the saved copy goes too: the front door
        // offers to try again, as it always has. A refused login also
        // forgets it on this device.
        if (!freshAccount) {
          this.dropCopy();
          const status = (error as { status?: number } | null)?.status;
          if (status === 401 || status === 403 || status === 404)
            forgetProfileCopy();
        }
        this.hooks.notify(
          error instanceof Error
            ? error.message
            : "Unable to load your profile.",
        );
      }
    }
    this.fromCopy = false;
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
    this.rememberSoon();
    if (this.account) this.preloadScreens();
  }
  private preloaded = false;
  /**
   * The Raids, Shop and Journey code and styles load on demand, not with the
   * game (it starts sooner). Loaded in quiet moments after sign-in, the
   * first open of each is as quick as the next: on a 4× slowed CPU the first
   * Raids open took about twice as long as the next (Nov 2026).
   */
  private preloadScreens() {
    if (this.preloaded) return;
    this.preloaded = true;
    const loads: (() => Promise<unknown>)[] = [
      () => import("./screens/raid-hall"),
      () => import("./screens/fitting-room"),
      () => import("./screens/journey"),
    ];
    const next = () => {
      const load = loads.shift();
      if (!load) return;
      window.setTimeout(() => {
        // Not while a battle runs (it would compete): later.
        if (document.body.classList.contains("battle-active")) {
          loads.unshift(load);
          return next();
        }
        void idle(2000)
          .then(load)
          .catch(() => undefined)
          .finally(next);
      }, PRELOAD_GAP_MS);
    };
    next();
  }
  async refresh() {
    await this.setSession(this.session, true);
  }
  /**
   * The server's copies screens were shown, by account and path, with when
   * each was asked for (the request itself while it's on its way, so two
   * screens asking at once share it). Forgotten whenever they may have
   * changed: a request that changes something (any POST), the server saying
   * records changed (economy-changed → loadEconomy), another player.
   */
  private copies = new Map<string, { at: number; value: Promise<unknown> }>();
  /** GET `path`, or the copy asked for less than `maxAge` ms ago. */
  fetchCopy(path: string, maxAge = COPY_MAX_AGE_MS): Promise<unknown> {
    const key = `${this.account?.id ?? ""} ${path}`;
    const now = performance.now();
    const kept = this.copies.get(key);
    if (kept && now - kept.at < maxAge) return kept.value;
    const value = this.api(path);
    this.copies.set(key, { at: now, value });
    // A failure isn't kept: the next open asks again.
    value.catch(() => {
      if (this.copies.get(key)?.value === value) this.copies.delete(key);
    });
    return value;
  }
  /** The next screen asks the server again (its copies may be old). */
  forgetCopies() {
    this.copies.clear();
  }
  /**
   * With the shared cookie (elementarenausa.com), the website may refresh
   * the token or sign out while this tab is open: Supabase announces neither
   * to this origin. Take whatever the cookie holds now: a fresh token
   * quietly, another player (or none) as a real change.
   */
  async syncSharedSession() {
    if (!sharedCookie || !this.client || !this.checked) return;
    const { data } = await this.client.auth.getSession();
    const now = data.session;
    if ((now?.user.id ?? null) !== (this.session?.user.id ?? null))
      await this.setSession(now);
    else if (now && now.access_token !== this.session?.access_token) {
      this.session = now;
      this.hooks.onToken(now.access_token);
    }
  }
  async api(path: string, body?: unknown): Promise<unknown> {
    await this.syncSharedSession();
    // Something changes on the server: every copy may be old now.
    if (body !== undefined) this.forgetCopies();
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
      confirmIcon: "block",
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
  /** Your avatar, from the account (optional until its migration runs). */
  private async loadAvatar(version: number) {
    try {
      const { avatar } = (await this.api("/api/account/avatar")) as {
        avatar: unknown;
      };
      if (version !== this.generation) return;
      this.avatar = isAvatar(avatar) ? (avatar as string) : null;
      this.syncAvatar();
      this.profileScreen?.refresh();
      this.hooks.onChange();
    } catch {
      // The default shows.
    }
  }
  /**
   * Your own picture (13 and over, with an account): the photo made small
   * on this device (avatar-photo.ts), stored on the account, worn at once.
   */
  canUsePhoto() {
    return !!this.account && !this.account.guest && !saidUnderAge();
  }
  async uploadPhoto(file: File) {
    if (!this.canUsePhoto())
      throw new Error("Make an account to use your own picture.");
    const blob = await preparePhoto(file);
    await this.syncSharedSession();
    const origin = import.meta.env.VITE_SERVER_URL || location.origin;
    const response = await fetch(new URL("/api/account/avatar-photo", origin), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.session?.access_token ?? ""}`,
        "Content-Type": blob.type,
      },
      body: blob,
    });
    const reply = (await response.json().catch(() => ({}))) as {
      avatar?: unknown;
      error?: string;
    };
    if (!response.ok || !isAvatar(reply.avatar))
      throw new Error(reply.error ?? "That picture couldn't be saved.");
    this.avatar = reply.avatar as string;
    this.syncAvatar();
    this.hooks.onChange();
  }
  /** Report another player's picture (three reporters hide it). */
  async reportPhoto(photoId: string) {
    return (await this.api("/api/avatar-photo/report", { photo: photoId })) as {
      hidden?: boolean;
    };
  }
  /** Wear a library avatar: saved on the account, seen everywhere at once. */
  async chooseAvatar(id: string) {
    if (!AVATAR_BY_ID.has(id))
      throw new Error("Choose an avatar from the library.");
    await this.api("/api/account/avatar", { avatar: id });
    this.avatar = id;
    this.syncAvatar();
    this.hooks.onChange();
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
    // You, as everyone sees you: your avatar in your frame, whatever
    // fighter you play (docs/hidden-picks.md, "Avatars").
    const key = JSON.stringify([
      this.avatar,
      this.raidLook?.frame ?? null,
      frameStars(this.raidLook?.frame, this.raidClears),
    ]);
    if (avatar.dataset.avatarLook === key) return;
    avatar.innerHTML = identityPortrait({
      avatar: this.avatar,
      raidLook: this.raidLook,
      raidClears: this.raidClears,
    });
    avatar.dataset.avatarLook = key;
  }
  renderNav() {
    const root = element("account-nav");
    if (!root) return;
    root.innerHTML = this.account
      ? `<button class="quiet coin-button" id="account-coins" aria-label="Shop: ${this.economy?.unlimitedCoins ? "unlimited" : this.economy ? coins(this.economy.balance) : "your"} coins">${coinChip(this.economy?.balance, "", this.economy?.unlimitedCoins, true)}</button><button class="quiet" id="account-profile"><span class="account-avatar" data-champion="${this.hooks.selectedCharacter?.() ?? "voltkit"}" aria-hidden="true"></span><span class="account-name">${escape(this.account.displayName)}</span>${this.economy?.journey ? `<small class="nav-level">Lv ${playerLevel(this.economy.journey.xp).level}</small><span class="nav-xp" aria-hidden="true"><i style="width:${Math.round(playerLevel(this.economy.journey.xp).percent)}%"></i></span>` : ""}${this.account.title ? `<small class="nav-title" style="color:${escape(this.account.titleColor ?? "#ffe58f")}">${escape(this.account.title)}</small>` : ""}</button>${this.account.isAdmin ? `<button class="quiet" id="account-admin" aria-label="Admin" title="Admin">${iconLabel("admin", "Admin")}</button>` : ""}<button class="quiet" id="account-logout" aria-label="Log out" title="Log out">${iconLabel("leave", "Log out")}</button>`
      : `<button class="quiet" id="account-login">${iconLabel("enter", "Log in")}</button><button class="secondary" id="account-signup">${iconLabel("add-friend", "Sign up")}</button>`;
    this.syncAvatar();
    if (this.account) {
      element("account-profile").onclick = () => void this.showProfile();
      element("account-coins").onclick = () => void this.showShop();
      element("account-logout").onclick = () => void this.logOut();
      if (this.account.isAdmin)
        element("account-admin").onclick = () => void this.showAdmin();
    } else {
      element("account-login").onclick = () => this.showAuth("login");
      element("account-signup").onclick = () => this.showAuth("signup");
    }
  }
  /**
   * Log out on this device (the header's button, the title screen's Switch
   * account). A guest is warned first: their pass can't be recovered.
   */
  async logOut() {
    if (this.account?.guest && !this.confirmedGuestLogout) {
      this.hooks.openDialog(
        `<div class="eyebrow">Guest account</div><h2>Log out of your guest pass?</h2><p>Guest accounts can't be recovered after logging out: your records and titles would be lost. Save your account with an email first to keep them.</p><div class="dialog-actions"><button class="primary" id="guest-save">${iconLabel("save", "Save my account")}</button><button class="secondary" id="guest-leave">${iconLabel("leave", "Log out anyway")}</button></div>`,
      );
      element("guest-save").onclick = () => void this.showProfile();
      element("guest-leave").onclick = () => {
        this.confirmedGuestLogout = true;
        element<HTMLDialogElement>("dialog").close();
        void this.logOut();
      };
      return;
    }
    this.confirmedGuestLogout = false;
    await this.signOutHere();
  }
  /** Your avatar in your frame, as the header shows it (title screen). */
  identityPicture() {
    return identityPortrait({
      avatar: this.avatar,
      raidLook: this.raidLook,
      raidClears: this.raidClears,
    });
  }
  /** Your level, once the profile is in. */
  get level() {
    return this.economy?.journey
      ? playerLevel(this.economy.journey.xp).level
      : null;
  }
  /** How this account signs in: "apple", "google", "email" or "guest". */
  get signInMethod() {
    if (this.account?.guest) return "guest";
    const provider = (
      this.session?.user?.app_metadata as { provider?: unknown } | undefined
    )?.provider;
    return typeof provider === "string" ? provider : "email";
  }
  /**
   * Sign in with Apple in the iPhone app: Apple's own sheet, then Supabase
   * with its identity token. The server then trades Apple's one-time code
   * for a refresh token, so deleting the account can revoke it.
   */
  private async signInWithAppleApp(message: HTMLElement) {
    if (!this.client) return;
    if (!(await confirmAge(this.hooks.notify))) return;
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
    const html = `<section class="auth-panel" data-mode="${mode}"><div class="auth-head"><span class="auth-crest" aria-hidden="true"><svg viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="M32 2 42 21 62 32 43 43 32 62 21 43 2 32 21 21Zm0 14L16 32l16 16 16-16Z"/></svg></span><div class="auth-title">${copy[0]}</div><p>${copy[1]}</p></div>${tabs}${!this.client ? '<p class="auth-warning">Sign-in isn\'t available right now. Please try again later.</p>' : ""}<form id="auth-form" class="auth-form">${fields}${extras}<button class="auth-submit" type="submit" ${!this.client ? "disabled" : ""}>${submitLabel}</button>${APPLE_SIGN_IN && (mode === "login" || mode === "signup") ? `<button id="auth-apple" class="auth-secondary auth-apple" type="button" ${!this.client ? "disabled" : ""}>${APPLE_LOGO}<span>Continue with Apple</span></button>` : ""}<p id="auth-message" class="auth-message" role="status"></p></form>${guest}${back}<p class="auth-legal"><a href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy policy</a></p></section>`;
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
      element<HTMLInputElement>("auth-remember").checked = sharedCookie
        ? sharedCookie.remembered()
        : localStorage.getItem("parena-remember") === "yes";
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
    // On the website, Apple sign-in leaves for Apple's page and comes back
    // signed in.
    const signInWithApple = async () => {
      if (!this.client) return;
      // It can make a new account: the age question first (age-gate.ts).
      if (!(await confirmAge(this.hooks.notify))) return;
      remember(
        mode === "login" && element<HTMLInputElement>("auth-remember").checked,
      );
      const { error } = await this.client.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: authRedirectUrl(site, "auth-callback") },
      });
      if (error) message.textContent = error.message;
    };
    if (APPLE_SIGN_IN && (mode === "login" || mode === "signup"))
      element("auth-apple").onclick = () =>
        void (isNativeApp()
          ? this.signInWithAppleApp(message)
          : signInWithApple());
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
        if (!(await confirmAge(this.hooks.notify))) return;
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
        await this.warnNewGuest();
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
      // A new account: the neutral age question first (age-gate.ts).
      if (mode === "signup" && !(await confirmAge(this.hooks.notify))) return;
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
  private spireProgress: SpireProgress | null = null;
  /** The account's Spire climb, once loaded (null: unknown). */
  get spire() {
    return this.spireProgress;
  }
  /** The Spire page is showing: its open zones are seen (spire-nudge.ts). */
  private noteSpireSeen() {
    if (markSpireSeen(this.account?.id, spireSeenKeys(this.spireProgress)))
      this.hooks.onChange();
  }
  /**
   * Raids: the boss list and a boss's page, a panel inside the Lobby. It
   * opens at once with what is known, then shows the server's fresh copy of
   * your raid records and your friends.
   */
  private raidHall?: typeof import("./screens/raid-hall");
  /** The Raids screen's code, loaded ahead (leaving a raid room). */
  loadRaids() {
    return import("./screens/raid-hall").then((module) => {
      this.raidHall = module;
      return module;
    });
  }
  /**
   * `instant`: back from a fight to the screen it started from; it is drawn
   * in place, with the Lobby, rather than sliding in over it.
   */
  async showRaids(
    boss?: RaidBossId,
    tab?: RaidTab,
    spire?: SpireTab,
    instant = false,
  ) {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    // The raid screens' code and styles load the first time they open, not
    // with the game (a phone starts faster). Once loaded (or loaded ahead by
    // loadRaids), the screen opens in this same moment.
    const { openRaids } = this.raidHall ?? (await this.loadRaids());
    if (this.account?.id !== accountId) return;
    if (this.raidScreen?.isOpen) {
      if (spire) this.raidScreen.showSpire(spire);
      else this.raidScreen.show(boss, tab);
    } else {
      // It opens with the last copies (friends too), then asks again only
      // what is old.
      this.raidLoading = !this.raidProgress;
      this.raidProblem = "";
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
              spire: this.spireProgress,
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
              invited: [...(this.hooks.invitedFriends?.() ?? [])],
            };
          },
          start: (id, options) => this.hooks.startRaid?.(id, options),
          startSpire: (options) => this.hooks.startSpire?.(options),
          invite: (id) =>
            this.hooks.inviteToParty?.(id) ??
            Promise.resolve({ ok: false, error: "Parties are unavailable." }),
          friends: () => void this.showFriends(),
          wardrobe: () => void this.showWardrobe(),
          onSpire: () => this.noteSpireSeen(),
          onClose: () => (this.raidScreen = undefined),
        },
        { boss, tab, spire, instant },
      );
    }
    const screen = this.raidScreen;
    if (screen.view.mode === "spire") this.noteSpireSeen();
    const shown = [
      this.raidProgress,
      this.raidFriends,
      this.spireProgress,
      this.raidProblem,
      this.raidLoading,
    ];
    const [raids, friends, climb] = await Promise.allSettled([
      this.fetchCopy("/api/raids") as Promise<RaidProgress>,
      this.nearbyFriends(),
      this.fetchCopy("/api/spire") as Promise<SpireProgress>,
    ]);
    // The Spire's records (before its migration runs: none, still playable).
    if (climb.status === "fulfilled" && climb.value)
      this.spireProgress = climb.value;
    if (this.account?.id !== accountId || !screen.isOpen) return;
    if (screen.view.mode === "spire") this.noteSpireSeen();
    if (raids.status === "fulfilled") {
      if (raids.value !== this.raidProgress) {
        this.raidProgress = raids.value;
        this.raidLook = raidLookOf(raids.value);
        this.raidClears = bossClears(raids.value);
        this.hooks.onChange();
      }
      this.raidProblem = "";
    } else if (!this.raidProgress)
      this.raidProblem =
        raids.reason instanceof Error
          ? raids.reason.message
          : "Raid records are not available yet.";
    // The same list as last time stays the same array (no redraw).
    if (friends.status === "rejected") this.raidFriends ??= [];
    else if (
      !this.raidFriends ||
      JSON.stringify(friends.value.friends) !== JSON.stringify(this.raidFriends)
    )
      this.raidFriends = friends.value.friends;
    this.raidLoading = false;
    // The copies it opened with were still fresh: nothing to redraw.
    const now = [
      this.raidProgress,
      this.raidFriends,
      this.spireProgress,
      this.raidProblem,
      this.raidLoading,
    ];
    if (now.some((v, i) => v !== shown[i])) screen.refresh();
  }
  /** Redraw the Raids panel (your party changed). */
  refreshRaids() {
    this.raidScreen?.refresh();
  }
  /** Invitations you sent changed: redraw every Invite button. */
  refreshInvites() {
    this.raidScreen?.refresh();
    this.friendsScreen?.refresh();
  }
  /** Reload coins and missions (after a match, a raid or a purchase). */
  async loadEconomy() {
    if (!this.account) return;
    const version = this.generation;
    // A match, a raid or a purchase changed records, ranks and raids too.
    this.forgetCopies();
    try {
      const economy = (await this.fetchCopy("/api/economy")) as Economy;
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
  /**
   * Wear an item you own in its appearance slot (the reward reveal's "Wear
   * it now"); the server checks you own it.
   */
  async wearLook(slot: RaidSlot, item: string) {
    const account = this.account?.id;
    const result = (await this.api("/api/raids/equip", { slot, item })) as {
      progress?: RaidProgress;
    };
    if (this.account?.id !== account) return;
    this.raidLook = result.progress
      ? raidLookOf(result.progress)
      : ({ ...(this.raidLook ?? {}), [slot]: item } as RaidLoadout);
    this.syncAvatar();
    this.hooks.onChange();
  }
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
    // Its code and styles load the first time it opens, not with the game.
    const accountId = this.account?.id;
    const { openFittingRoom } = await import("./screens/fitting-room");
    if (this.account?.id !== accountId) return;
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
    const shown = [this.economy, this.fitProgress, this.fitLoading];
    const [economy, raids] = await Promise.allSettled([
      this.fetchCopy("/api/economy"),
      this.fetchCopy("/api/raids"),
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
    // Opened again on the copies it already showed: nothing to redraw.
    if (
      !this.fitProblem &&
      [this.economy, this.fitProgress, this.fitLoading].every(
        (v, i) => v === shown[i],
      )
    )
      return;
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
        avatar: this.avatar,
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
    // Its code and styles load the first time it opens, not with the game.
    const { openJourney } = await import("./screens/journey");
    if (this.account?.id !== accountId) return;
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
    const shown = this.economy;
    try {
      const economy = (await this.fetchCopy("/api/economy")) as Economy;
      if (this.account?.id !== accountId || !screen.isOpen) return;
      // Opened again on the copy it already shows: nothing to redraw.
      if (economy === shown && !this.journeyLoading) return;
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
    this.closeDialog();
  }
  /** Close any old dialog (a hub screen is opening). */
  private closeDialog() {
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
    const shown = this.economy;
    try {
      const economy = (await this.fetchCopy("/api/economy")) as Economy;
      if (this.account?.id !== accountId || !screen.isOpen) return;
      // Opened again on the copy it already shows: nothing to redraw.
      if (economy === shown && !this.missionsLoading) return;
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
  /** Where the card is open (the Plaza's layer), or none (the Lobby). */
  private profileHost?: HTMLElement;
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
    const host = this.hooks.profileHost?.();
    if (host) this.closeDialog();
    else this.toLobbyScreen();
    // Open where you are now: one left open in the other scene goes.
    if (this.profileScreen?.isOpen && this.profileHost !== host)
      this.profileScreen.close();
    this.profileHost = host;
    const accountId = this.account.id;
    if (!this.profileScreen?.isOpen) {
      // It opens on the records it showed last (another player's are
      // forgotten at sign-in), then asks again only what is old.
      this.profileData = {
        ...this.profileData,
        raids: this.profileData.raids ?? this.raidProgress ?? null,
      };
      this.profileScreen = openProfile({
        host,
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
            avatar: this.avatar,
            canUsePhoto: this.canUsePhoto(),
            look: this.raidLook,
            clears: this.raidClears,
            journey: this.economy?.journey,
            canDelete: !a.isAdmin,
          };
        },
        photo: async (file) => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen your card.");
          await this.uploadPhoto(file);
        },
        avatar: async (id) => {
          if (this.account?.id !== accountId)
            throw new Error("Your session changed. Reopen your card.");
          await this.chooseAvatar(id);
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
        history: (q) => this.matchHistory(q),
        playBot: this.hooks.playBot,
        isFriend: (id) => this.isFriend(id),
        friendCard: (id) => this.showFriendCard(id, false),
        onClose: () => (this.profileScreen = undefined),
      });
      // Which players in your matches are friends (their names open cards).
      // (Guests can have friends too.)
      void this.loadFriendList(accountId, FRIENDS_MAX_AGE_MS).then(() =>
        this.profileScreen?.refresh(),
      );
    }
    await this.loadProfile(accountId);
  }
  /** The raw answers the card was last drawn from (the same: no redraw). */
  private profileShown: unknown[] = [];
  private async loadProfile(accountId: string) {
    const screen = this.profileScreen;
    const [progress, raids, name] = await Promise.allSettled([
      this.fetchCopy("/api/progress"),
      this.fetchCopy("/api/raids") as Promise<RaidProgress>,
      this.fetchCopy("/api/account/name"),
    ]);
    if (this.account?.id !== accountId) return;
    const answers = [progress, raids, name].map((r) =>
      r.status === "fulfilled" ? r.value : r.reason,
    );
    // Opened again on copies it already drew: nothing to redraw.
    if (
      this.profileData.progress &&
      answers.every((v, i) => v === this.profileShown[i])
    )
      return;
    this.profileShown = answers;
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
    // It opens on the list it showed last (Recent loads again when picked).
    this.friendsData = { ...this.friendsData, recent: null };
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
          canMessage: !!this.hooks.messageFriend,
          canCard: !host,
          invited: this.hooks.invitedFriends?.(),
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
      reportPhoto: async (photo, name) => {
        const sure = await askConfirm({
          kicker: "Report a picture",
          title: `Report ${name}'s picture?`,
          art: identityPortrait({ avatar: `photo:${photo}` }),
          lines: [
            [
              "What happens",
              "Our team looks at it. Pictures that break the rules are removed.",
            ],
          ],
          confirm: "Report",
          confirmIcon: "report",
        });
        if (!sure) return "";
        await this.reportPhoto(photo);
        return "Thanks. The picture was reported.";
      },
      unblock: (id) => this.unblock(id),
      message: (id, name) => this.hooks.messageFriend?.(id, name),
      card: (id) => this.showFriendCard(id, true),
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
    const screen = this.friendsScreen;
    const shown = this.friendsData;
    await this.loadFriendList(accountId, FRIENDS_MAX_AGE_MS);
    // The list it opened with was still fresh: nothing to redraw.
    if (this.friendsData !== shown && screen.isOpen) screen.refresh();
  }
  /** A page of match history: yours, or a friend's (docs/match-history.md). */
  private async matchHistory(q: HistoryQuery & { player?: string }) {
    const params = new URLSearchParams({ kind: q.kind });
    if (q.player) params.set("player", q.player);
    if (q.at) params.set("at", q.at);
    if (q.id) params.set("id", q.id);
    const path = `/api/matches/history?${params}`;
    // The first page is kept like the card's other records, so the card
    // opened again shows it at once without asking (until records change).
    return matchHistorySchema.parse(
      await (q.at ? this.api(path) : this.fetchCopy(path)),
    );
  }
  private isFriend(id: string) {
    return !!this.friendsData.list?.friends.some((f) => f.id === id);
  }
  private friendCard?: FriendCardScreen;
  /**
   * A friend's player card and matches. From Friends it has a way back
   * there; from a match board it opens on its own.
   */
  async showFriendCard(id: string, fromFriends: boolean) {
    if (!this.ensurePlayer()) return;
    const accountId = this.account!.id;
    if (!this.friendsData.list) await this.loadFriendList(accountId);
    const person = this.friendsData.list?.friends.find((f) => f.id === id);
    if (this.account?.id !== accountId) return;
    if (!person) {
      this.hooks.notify("Only friends can see each other's matches.");
      return;
    }
    this.toLobbyScreen();
    this.friendCard = openFriendCard({
      person,
      history: (q) => {
        if (this.account?.id !== accountId)
          return Promise.reject(
            new Error("Your session changed. Reopen the card."),
          );
        return this.matchHistory(q);
      },
      back: fromFriends ? () => void this.showFriends() : undefined,
      isFriend: (other) => this.isFriend(other),
      open: (other) => void this.showFriendCard(other, fromFriends),
      onClose: () => (this.friendCard = undefined),
    });
  }
  /**
   * A new guest pass, said plainly once, when it's made: everything plays,
   * but it lives on this device only and can't be recovered once lost
   * (logging out, clearing the app's data, a new phone). Save my account
   * opens the player card, whose first block saves it with an email.
   */
  /**
   * A new guest's warning is due or showing: the Lobby tour waits for it
   * (main.ts startTour), then starts once it is answered ("guest-warning-done").
   */
  guestWarningPending = false;
  private async warnNewGuest() {
    if (!this.account?.guest) return;
    this.guestWarningPending = true;
    try {
      await this.showGuestWarning();
    } finally {
      this.guestWarningPending = false;
      window.dispatchEvent(new Event("guest-warning-done"));
    }
  }
  private async showGuestWarning() {
    // Over the Lobby, once the log-in's loading curtain has come and gone
    // (not under it, nor beside it while it fades). It starts a moment after
    // the log-in, so wait for the Lobby itself; never more than 20 s.
    const end = performance.now() + 20_000;
    while (
      performance.now() < end &&
      (!document.body.classList.contains("hub-active") || curtainCovers())
    )
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (!this.account?.guest) return;
    const save = await askConfirm(guestWarning());
    if (!save || !this.account?.guest) return;
    await this.showProfile();
    // Straight to the email box (its form is the card's first block).
    document
      .querySelector<HTMLInputElement>("[data-profile-save] input")
      ?.focus({ preventScroll: false });
  }
  /** The server's answer `friendsData.list` was read from. */
  private friendsListRaw: unknown;
  /** Load your friends (or reuse a copy younger than `maxAge` ms). */
  private async loadFriendList(accountId: string, maxAge = 0) {
    try {
      const raw = await this.fetchCopy("/api/friends", maxAge);
      if (this.account?.id !== accountId) return;
      if (raw === this.friendsListRaw && !this.friendsData.problem) return;
      this.friendsListRaw = raw;
      const list = friendsSchema.parse(raw);
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
  /** Your friends (the copy asked for in the last few seconds, if any). */
  async nearbyFriends() {
    return friendsSchema.parse(
      await this.fetchCopy("/api/friends", FRIENDS_MAX_AGE_MS),
    );
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
  /** The server's answer `ranksData.board` was read from. */
  private ranksBoardRaw: unknown;
  /**
   * Ranks: your rank and the leaderboard, a panel inside the Lobby. The
   * Friends board loads the first time it is picked.
   */
  async showLeaderboard() {
    if (!this.ensurePlayer()) return;
    this.toLobbyScreen();
    const accountId = this.account?.id;
    if (!this.ranksScreen?.isOpen) {
      // It opens on the boards it showed last, then asks again once old.
      this.ranksScreen = openRanks({
        data: () => ({
          ...this.ranksData,
          me: {
            name: this.account?.displayName ?? "You",
            avatar: this.avatar,
          },
        }),
        load: (scope) => this.loadRanks(scope, accountId),
        reportPhoto: (photo, name) =>
          void this.hooks.reportPhoto?.(photo, name),
        friends: () => void this.showFriends(),
        onClose: () => (this.ranksScreen = undefined),
      });
    }
    const shown = this.ranksData;
    await this.loadRanks("everyone", accountId);
    // Opened again on the board it already shows: nothing to redraw.
    if (this.ranksData !== shown) this.ranksScreen?.refresh();
  }
  private async loadRanks(scope: "everyone" | "friends", accountId?: string) {
    const fresh = () => this.account?.id === accountId;
    if (scope === "everyone") {
      if (this.ranksData.problem)
        this.ranksData = { ...this.ranksData, problem: "" };
      try {
        const raw = await this.fetchCopy("/api/leaderboard");
        // The copy the board was drawn from: keep the same data.
        if (fresh() && raw !== this.ranksBoardRaw) {
          this.ranksBoardRaw = raw;
          const board = leaderboardSchema.parse(raw);
          this.ranksData = { ...this.ranksData, board };
        }
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
  private adminPanel?: AdminPanel;
  /** The Admin panel (admin-panel.ts). `changes` open it on a section. */
  async showAdmin(changes: Partial<AdminView> = {}) {
    if (!this.account?.isAdmin) return;
    if (!this.adminPanel) {
      let panel: typeof import("./admin-panel");
      try {
        panel = await import("./admin-panel");
      } catch {
        // Offline, or a new version was deployed since this page loaded.
        this.hooks.notify("Could not open Admin. Check your connection.");
        return;
      }
      this.adminPanel ??= new panel.AdminPanel({
        api: (path, body) => this.api(path, body),
        openDialog: (html) => this.hooks.openDialog(html),
        fighterName: (id) => CHARACTERS[id as CharacterId]?.name ?? id,
      });
    }
    await this.adminPanel.show(changes);
  }
}
