// The website's account area (/account/): sign in, change email or
// password, sign out. Bundled to apps/site/account/account.js by
// tools/build-account.mjs (only this page loads it).
//
// On elementarenausa.com it shares the game's session through a cookie for
// the whole domain (packages/shared/src/session-cookie.ts): signed in here
// means signed in at play.elementarenausa.com, and the reverse.
import { createClient, type Session, type User } from "@supabase/supabase-js";
import {
  sessionCookieStorage,
  sharesSession,
} from "../../../packages/shared/src/session-cookie";

/** Written at deploy by tools/write-config.mjs from the Static Site's env. */
interface SiteConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  appleSignIn?: boolean;
  gameUrl?: string;
}
const config: SiteConfig = (window as any).EA_CONFIG ?? {};
const GAME = config.gameUrl || "https://play.elementarenausa.com/";
const HERE = `${location.origin}/account/`;
const KEY = "parena-auth"; // the game's storage key (apps/client/src/accounts.ts)

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const views = [
  "acct-loading",
  "acct-off",
  "acct-signin",
  "acct-on",
  "acct-reset",
];
function show(view: string) {
  for (const v of views) $(v).hidden = v !== view;
}
function say(id: string, text: string, ok = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle("ok", ok);
  el.hidden = !text;
}
async function busy<T>(button: HTMLButtonElement, work: () => Promise<T>) {
  button.disabled = true;
  try {
    return await work();
  } finally {
    button.disabled = false;
  }
}

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  show("acct-off");
} else {
  const cookie = sharesSession(location.hostname)
    ? sessionCookieStorage(document, localStorage)
    : null;
  cookie?.adopt(KEY);
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: cookie ?? localStorage,
      storageKey: KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  let recovering = false;

  const kind = (u: User) =>
    u.is_anonymous
      ? "guest"
      : u.identities?.some((i) => i.provider === "email")
        ? "email"
        : u.identities?.some((i) => i.provider === "apple")
          ? "apple"
          : "email";

  function render(session: Session | null) {
    if (recovering) return show("acct-reset");
    if (!session) return show("acct-signin");
    const u = session.user;
    const k = kind(u);
    $("acct-name").textContent =
      (u.user_metadata?.display_name as string) ||
      (u.user_metadata?.full_name as string) ||
      (k === "guest" ? "Guest player" : "Player");
    $("acct-email").textContent = u.email || "No email yet";
    $("acct-kind").textContent =
      k === "guest"
        ? "Guest account"
        : k === "apple"
          ? "Signed in with Apple"
          : "Email and password";
    $("acct-guest").hidden = k !== "guest";
    $("acct-forms").hidden = k === "guest";
    // Apple accounts have no password yet: they set one, no current password.
    $("pw-current-row").hidden = k !== "email";
    $("pw-title").textContent =
      k === "email" ? "Change password" : "Set a password";
    $("pending-email").hidden = !u.new_email;
    $("pending-email").textContent = u.new_email
      ? `Waiting for you to confirm ${u.new_email} from the email we sent.`
      : "";
    show("acct-on");
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recovering = true;
    // Supabase asks not to await its calls inside this callback.
    setTimeout(() => render(session), 0);
  });

  // Links from emails land here: say what happened, then tidy the address.
  const back = new URLSearchParams(location.search).get("done");
  if (back === "email") say("acct-note", "Your new email is confirmed.", true);
  if (back) history.replaceState(null, "", "/account/");

  $("signin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const remember = (form.elements.namedItem("remember") as HTMLInputElement)
      .checked;
    void busy(form.querySelector("button[type=submit]")!, async () => {
      say("signin-msg", "");
      if (cookie) cookie.remember(remember, KEY);
      else if (remember) localStorage.setItem("parena-remember", "yes");
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) say("signin-msg", error.message);
    });
  });

  $("forgot").addEventListener("click", () => {
    const email = ($("signin-email") as HTMLInputElement).value.trim();
    if (!email)
      return say(
        "signin-msg",
        "Type your email first, then tap Forgot password.",
      );
    void client.auth
      .resetPasswordForEmail(email, { redirectTo: HERE })
      .then(({ error }) =>
        error
          ? say("signin-msg", error.message)
          : say(
              "signin-msg",
              `If ${email} has an account, a link to choose a new password is on its way.`,
              true,
            ),
      );
  });

  const apple = $<HTMLButtonElement>("apple");
  apple.hidden = !config.appleSignIn;
  apple.addEventListener("click", () => {
    const remember = ($("signin-remember") as HTMLInputElement).checked;
    if (cookie) cookie.remember(remember, KEY);
    void client.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: HERE },
    });
  });

  $("email-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = (
      form.elements.namedItem("new-email") as HTMLInputElement
    ).value.trim();
    void busy(form.querySelector("button")!, async () => {
      const { error } = await client.auth.updateUser(
        { email },
        { emailRedirectTo: `${HERE}?done=email` },
      );
      if (error) return say("email-msg", error.message);
      form.reset();
      say(
        "email-msg",
        `Check ${email} (and your current inbox) and tap the link to confirm.`,
        true,
      );
      render((await client.auth.getSession()).data.session);
    });
  });

  $("pw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const field = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement).value.trim();
    void busy(form.querySelector("button")!, async () => {
      if (field("pw-new").length < 8)
        return say("pw-msg", "Use at least 8 characters.");
      if (field("pw-new") !== field("pw-again"))
        return say("pw-msg", "The two new passwords don't match.");
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user) return render(null);
      let nonce: string | undefined;
      if (kind(user) === "email") {
        // Someone at an unlocked computer can't change it without the old one.
        const check = await client.auth.signInWithPassword({
          email: user.email!,
          password: field("pw-current"),
        });
        if (check.error)
          return say("pw-msg", "Your current password isn't right.");
      } else {
        // No password yet (Apple): a code sent to the account's email proves
        // it's the owner, so a stolen session can't become a lasting login.
        nonce = field("pw-code") || undefined;
        if (!nonce) {
          const sent = await client.auth.reauthenticate();
          if (sent.error) return say("pw-msg", sent.error.message);
          $("pw-code-row").hidden = false;
          return say(
            "pw-msg",
            `We emailed a code to ${user.email}. Type it above and save again.`,
            true,
          );
        }
      }
      const { error } = await client.auth.updateUser({
        password: field("pw-new"),
        ...(nonce ? { nonce } : {}),
      });
      if (error) return say("pw-msg", error.message);
      // Sessions elsewhere (another device, and the check above) end here.
      await client.auth.signOut({ scope: "others" });
      form.reset();
      $("pw-code-row").hidden = true;
      say("pw-msg", "Password saved. Other devices are signed out.", true);
      render((await client.auth.getSession()).data.session);
    });
  });

  $("reset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const pw = (form.elements.namedItem("reset-new") as HTMLInputElement).value;
    void busy(form.querySelector("button")!, async () => {
      if (pw.length < 8) return say("reset-msg", "Use at least 8 characters.");
      const { error } = await client.auth.updateUser({ password: pw });
      if (error) return say("reset-msg", error.message);
      recovering = false;
      say("acct-note", "New password saved. You're signed in.", true);
      render((await client.auth.getSession()).data.session);
    });
  });

  $("signout").addEventListener("click", () => {
    // This browser only (the website and the game share it here).
    void client.auth.signOut({ scope: "local" }).then(() => render(null));
  });

  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-game]"))
    a.href = GAME;
  void client.auth.getSession().then(({ data }) => render(data.session));
}
