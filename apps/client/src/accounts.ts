import { TITLE_PRESETS } from "./player-nameplate";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  accountSchema,
  type Account,
  type Title,
  type PlayerDirectory,
} from "../../../packages/shared/src/accounts";
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
  notify: (message: string) => void;
  onChange: () => void;
  onSession: (token: string | null) => void;
  beforeSignOut: () => Promise<void>;
};
export class AccountUI {
  account: Account | null = null;
  session: Session | null = null;
  generation = 0;
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
  async setSession(session: Session | null) {
    const version = ++this.generation;
    this.session = session;
    this.account = null;
    this.hooks.onSession(session?.access_token ?? null);
    if (session) {
      try {
        const account = accountSchema.parse(await this.api("/api/account"));
        if (version !== this.generation) return;
        this.account = account;
      } catch (error) {
        if (version !== this.generation) return;
        this.hooks.notify(
          error instanceof Error
            ? error.message
            : "Unable to load your profile.",
        );
      }
    }
    this.renderNav();
    this.hooks.onChange();
  }
  async refresh() {
    await this.setSession(this.session);
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
      ? `<button class="quiet" id="account-profile">${escape(this.account.displayName)}</button>${this.account.isAdmin ? '<button class="quiet" id="account-admin">Admin</button>' : ""}<button class="quiet" id="account-logout">Log out</button>`
      : '<button class="quiet" id="account-login">Log in</button><button class="secondary" id="account-signup">Sign up</button>';
    if (this.account) {
      element("account-profile").onclick = () => void this.showProfile();
      element("account-logout").onclick = async () => {
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
    const title = {
      login: "Welcome back.",
      signup: "Enter the arena.",
      forgot: "Recover your account.",
      reset: "Choose a new password.",
    }[mode];
    this.hooks.openDialog(
      `<div class="eyebrow">ELEMENT ARENA ACCOUNTS</div><h2>${title}</h2>${!this.client ? "<p>Sign-in is not available yet. Accounts are being set up.</p>" : ""}<form id="auth-form" class="account-form">${mode === "signup" ? '<label>Display name<input name="displayName" maxlength="20" required autocomplete="nickname"></label>' : ""}${mode !== "reset" ? '<label>Email<input name="email" type="email" required autocomplete="email"></label>' : ""}${mode !== "forgot" ? `<label>Password<input name="password" type="password" ${mode === "login" ? "" : 'minlength="8"'} maxlength="128" required autocomplete="${mode === "login" ? "current-password" : "new-password"}"></label><button class="quiet" id="auth-show-password" type="button">Show password</button>` : ""}${mode === "signup" || mode === "reset" ? '<label>Confirm password<input name="confirmPassword" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label>' : ""}${mode === "login" ? '<label class="checkbox-label"><input id="auth-remember" type="checkbox">Remember me</label>' : ""}<button class="primary" type="submit" ${!this.client ? "disabled" : ""}>${{ login: "Log in", signup: "Create account", forgot: "Send reset link", reset: "Update password" }[mode]}</button>${mode === "login" || mode === "signup" ? `<button id="auth-google" class="secondary" type="button" ${!this.client ? "disabled" : ""}>Continue with Google</button>` : ""}<p id="auth-message" role="status"></p></form><div class="auth-links"><button class="quiet" id="auth-switch">${mode === "login" ? "Create an account" : "Back to login"}</button>${mode === "login" ? '<button class="quiet" id="auth-forgot">Forgot password?</button>' : ""}</div>`,
    );
    element("auth-switch").onclick = () =>
      this.showAuth(mode === "login" ? "signup" : "login");
    if (mode === "login") {
      element("auth-forgot").onclick = () => this.showAuth("forgot");
      element<HTMLInputElement>("auth-remember").checked =
        localStorage.getItem("parena-remember") === "yes";
    }
    const form = element<HTMLFormElement>("auth-form");
    const message = element("auth-message");
    const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
    const site = import.meta.env.VITE_SITE_URL || location.origin;
    if (mode !== "forgot")
      element("auth-show-password").onclick = () => {
        const field = form.elements.namedItem("password") as HTMLInputElement;
        field.type = field.type === "password" ? "text" : "password";
        element("auth-show-password").textContent =
          field.type === "password" ? "Show password" : "Hide password";
      };
    if (mode === "login" || mode === "signup")
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
  async showProfile() {
    if (!this.account) return;
    const account = this.account;
    this.hooks.openDialog(
      `<div class="eyebrow">YOUR PLAYER PROFILE</div><h2>${escape(account.displayName)}</h2><p>${account.isAdmin ? "Administrator" : "Player"} · ${escape(this.session?.user.email ?? "")}</p><form id="profile-title" class="account-form"><label>Equipped title<select name="titleId"><option value="">No title</option>${account.ownedTitles.map((t) => `<option value="${t.id}" ${account.title === t.name ? "selected" : ""}>${escape(t.name)}</option>`).join("")}</select></label><button class="primary">Save title</button><p id="profile-message" role="status"></p></form>`,
    );
    element<HTMLFormElement>("profile-title").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const titleId = String(
          new FormData(event.currentTarget as HTMLFormElement).get("titleId") ??
            "",
        );
        await this.api("/api/account/title", { titleId: titleId || null });
        await this.refresh();
        element("profile-message").textContent = "Title updated.";
      } catch (error) {
        element("profile-message").textContent =
          error instanceof Error ? error.message : "Unable to update title.";
      }
    };
  }
  async showAdmin(search = "", offset = 0) {
    if (!this.account?.isAdmin) return;
    this.hooks.openDialog(
      '<div class="eyebrow">ADMINISTRATION</div><h2>Players & titles</h2><p>Loading…</p>',
    );
    try {
      const [directory, catalog] = await Promise.all([
        this.api(
          `/api/admin/players?search=${encodeURIComponent(search)}&offset=${offset}`,
        ),
        this.api("/api/admin/titles"),
      ]);
      const { players, total } = directory as PlayerDirectory;
      const titles = catalog as Title[];
      this.hooks.openDialog(
        `<div class="eyebrow">ADMINISTRATION</div><h2>Players & titles</h2><p>Solo test mode is available from the main menu. Changes below are stored and audited.</p><form id="admin-search" class="admin-search"><input name="search" placeholder="Search player name or ID" value="${escape(search)}"><button class="secondary">Search</button></form><div class="admin-players">${players.map((p) => `<form class="admin-player" data-player="${p.id}"><strong>${escape(p.displayName)} ${p.isAdmin ? "· ADMIN" : ""}</strong><small>${p.id}</small><label>Display name<input name="displayName" maxlength="20" value="${escape(p.displayName)}" required></label><label class="checkbox-label"><input name="suspended" type="checkbox" ${p.suspended ? "checked" : ""} ${p.isAdmin ? "disabled" : ""}>Suspended</label><button class="secondary" type="submit">Save player</button><div class="title-grants">${titles.map((t) => `<label class="checkbox-label"><input data-grant="${t.id}" type="checkbox" ${p.titleIds.includes(t.id) ? "checked" : ""}>${escape(t.name)}${t.active ? "" : " (retired)"}</label>`).join("")}</div></form>`).join("") || "<p>No players found.</p>"}</div><div class="admin-pagination"><button id="admin-prev" class="quiet" ${offset === 0 ? "disabled" : ""}>Previous</button><span>${offset + 1}–${Math.min(offset + 50, total)} of ${total}</span><button id="admin-next" class="quiet" ${offset + 50 >= total ? "disabled" : ""}>Next</button></div><h3>Titles</h3><p>Colors appear above fighters. Master titles glow; Grandmaster titles pulse; Legendary titles shimmer with gold sparkles.</p><button class="secondary" id="add-title-presets">Add rank title set</button><div class="admin-titles">${[null, ...titles].map((t) => `<form class="admin-title" data-title="${t?.id ?? ""}"><strong>${t ? "Edit title" : "Create title"}</strong><label>Name<input name="name" required maxlength="40" value="${escape(t?.name ?? "")}"></label><label>Description<input name="description" maxlength="160" value="${escape(t?.description ?? "")}"></label><label>Color<input name="color" type="color" value="${t?.color ?? "#d5f778"}"></label><label class="checkbox-label"><input name="active" type="checkbox" ${t?.active !== false ? "checked" : ""}>Active</label><button class="secondary">Save title</button></form>`).join("")}</div><p id="admin-message" role="status"></p>`,
      );
      const feedback = (error: unknown) =>
        (element("admin-message").textContent =
          error instanceof Error ? error.message : "Request failed.");
      element<HTMLFormElement>("admin-search").onsubmit = (e) => {
        e.preventDefault();
        void this.showAdmin(
          String(
            new FormData(e.currentTarget as HTMLFormElement).get("search") ??
              "",
          ),
          0,
        );
      };
      element("admin-prev").onclick = () =>
        void this.showAdmin(search, Math.max(0, offset - 50));
      element("admin-next").onclick = () =>
        void this.showAdmin(search, offset + 50);
      document
        .querySelectorAll<HTMLFormElement>(".admin-player")
        .forEach((form) => {
          form.onsubmit = async (e) => {
            e.preventDefault();
            const fields = new FormData(form);
            try {
              await this.api("/api/admin/players", {
                id: form.dataset.player,
                displayName: String(fields.get("displayName")),
                suspended: fields.has("suspended"),
              });
              element("admin-message").textContent = "Player saved.";
            } catch (error) {
              feedback(error);
            }
          };
          form.querySelectorAll<HTMLInputElement>("[data-grant]").forEach(
            (input) =>
              (input.onchange = async () => {
                input.disabled = true;
                try {
                  await this.api("/api/admin/grants", {
                    playerId: form.dataset.player,
                    titleId: input.dataset.grant,
                    grant: input.checked,
                  });
                  element("admin-message").textContent =
                    "Title ownership updated.";
                } catch (error) {
                  input.checked = !input.checked;
                  feedback(error);
                } finally {
                  input.disabled = false;
                }
              }),
          );
        });
      element<HTMLButtonElement>("add-title-presets").onclick = async () => {
        const button = element<HTMLButtonElement>("add-title-presets");
        button.disabled = true;
        try {
          for (const preset of TITLE_PRESETS) {
            if (
              titles.some(
                (t) => t.name.toLowerCase() === preset.name.toLowerCase(),
              )
            )
              continue;
            await this.api("/api/admin/titles", {
              id: null,
              name: preset.name,
              description: "An arena honor awarded by an administrator.",
              color: preset.color,
              active: true,
            });
          }
          await this.showAdmin(search, offset);
        } catch (error) {
          feedback(error);
          button.disabled = false;
        }
      };
      const newTitle = document.querySelector<HTMLFormElement>(
        '.admin-title[data-title=""]',
      );
      if (newTitle) {
        const presets = document.createElement("select");
        presets.setAttribute("aria-label", "Title preset");
        presets.innerHTML =
          '<option value="">Choose a rank preset (optional)</option>' +
          TITLE_PRESETS.map(
            (t, i) => `<option value="${i}">${t.name}</option>`,
          ).join("");
        newTitle.prepend(presets);
        presets.onchange = () => {
          if (presets.value === "") return;
          const preset = TITLE_PRESETS[Number(presets.value)];
          (newTitle.elements.namedItem("name") as HTMLInputElement).value =
            preset.name;
          (newTitle.elements.namedItem("color") as HTMLInputElement).value =
            preset.color;
          (
            newTitle.elements.namedItem("description") as HTMLInputElement
          ).value = "An arena honor awarded by an administrator.";
        };
      }
      document.querySelectorAll<HTMLFormElement>(".admin-title").forEach(
        (form) =>
          (form.onsubmit = async (e) => {
            e.preventDefault();
            const fields = new FormData(form);
            try {
              await this.api("/api/admin/titles", {
                id: form.dataset.title || null,
                name: String(fields.get("name")),
                description: String(fields.get("description")),
                color: String(fields.get("color")),
                active: fields.has("active"),
              });
              await this.showAdmin(search, offset);
            } catch (error) {
              feedback(error);
            }
          }),
      );
    } catch (error) {
      this.hooks.openDialog(
        `<h2>Admin tools unavailable</h2><p>${escape(error instanceof Error ? error.message : "Unable to load administration.")}</p>`,
      );
    }
  }
}
