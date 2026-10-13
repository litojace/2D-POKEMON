import { TITLE_PRESETS } from "./player-nameplate";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  accountSchema,
  REPORT_CATEGORIES,
  type Account,
  type Title,
  type PlayerDirectory,
  type ReportList,
} from "../../../packages/shared/src/accounts";
const EYE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
const EYE_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
/** Password input with an eye button inside the box to show or hide it. */
const passwordField = (label: string, name: string, attrs: string) =>
  `<label>${label}<span class="password-field"><input name="${name}" type="password" ${attrs}><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false" title="Show password">${EYE}</button></span></label>`;
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
      `<div class="eyebrow">ELEMENT ARENA ACCOUNTS</div><h2>${title}</h2>${!this.client ? "<p>Sign-in is not available yet. Accounts are being set up.</p>" : ""}<form id="auth-form" class="account-form">${mode === "signup" ? '<label>Display name<input name="displayName" maxlength="20" required autocomplete="nickname"></label>' : ""}${mode !== "reset" ? '<label>Email<input name="email" type="email" required autocomplete="email"></label>' : ""}${mode !== "forgot" ? passwordField("Password", "password", `${mode === "login" ? "" : 'minlength="8"'} maxlength="128" required autocomplete="${mode === "login" ? "current-password" : "new-password"}"`) : ""}${mode === "signup" || mode === "reset" ? passwordField("Confirm password", "confirmPassword", 'minlength="8" maxlength="128" required autocomplete="new-password"') : ""}${mode === "login" ? '<label class="checkbox-label"><input id="auth-remember" type="checkbox">Remember me</label>' : ""}<button class="primary" type="submit" ${!this.client ? "disabled" : ""}>${{ login: "Log in", signup: "Create account", forgot: "Send reset link", reset: "Update password" }[mode]}</button>${mode === "login" || mode === "signup" ? `<button id="auth-google" class="secondary" type="button" ${!this.client ? "disabled" : ""}>Continue with Google</button>` : ""}<p id="auth-message" role="status"></p></form><div class="auth-links"><button class="quiet" id="auth-switch">${mode === "login" ? "Create an account" : "Back to login"}</button>${mode === "login" ? '<button class="quiet" id="auth-forgot">Forgot password?</button>' : ""}</div>`,
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
  /** Ask the admin team for help. `context` is attached automatically. */
  showReport(context: Record<string, string> = {}) {
    if (!this.account) {
      this.hooks.notify("Log in to report a problem.");
      this.showAuth("login");
      return;
    }
    this.hooks.openDialog(
      `<div class="eyebrow">HELP US FIX IT</div><h2>Report a problem</h2><p>Tell the admins what happened. Your current screen${context.room ? ` and room code ${escape(context.room)}` : ""} are included automatically.</p><form id="report-form" class="account-form"><label>What kind of problem?<select name="category" required>${Object.entries(
        REPORT_CATEGORIES,
      )
        .map(([value, label]) => `<option value="${value}">${label}</option>`)
        .join(
          "",
        )}</select></label><label>What happened?<textarea name="message" rows="5" minlength="5" maxlength="1000" required placeholder="What were you doing, and what went wrong?"></textarea></label><small class="report-count" id="report-count">0 / 1000</small><button class="primary" type="submit">Send report</button><p id="report-message" role="status"></p></form>`,
    );
    const form = element<HTMLFormElement>("report-form");
    const text = form.elements.namedItem("message") as HTMLTextAreaElement;
    text.oninput = () =>
      (element("report-count").textContent = `${text.value.length} / 1000`);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
      const fields = new FormData(form);
      submit.disabled = true;
      try {
        await this.api("/api/reports", {
          category: String(fields.get("category")),
          message: String(fields.get("message") ?? "").trim(),
          context,
        });
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
    tab: "players" | "reports";
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
  async showAdmin(changes: Partial<typeof this.adminView> = {}) {
    if (!this.account?.isAdmin) return;
    const view = Object.assign(this.adminView, { message: "" }, changes);
    const header = (open: number | string) =>
      `<div class="eyebrow">ADMINISTRATION</div><h2>Admin</h2><div class="admin-tabs" role="tablist"><button role="tab" class="admin-tab ${view.tab === "players" ? "active" : ""}" data-tab="players" aria-selected="${view.tab === "players"}">Players</button><button role="tab" class="admin-tab ${view.tab === "reports" ? "active" : ""}" data-tab="reports" aria-selected="${view.tab === "reports"}">Reports${open ? ` <b class="admin-count">${open}</b>` : ""}</button></div>`;
    this.hooks.openDialog(`${header("")}<p>Loading…</p>`);
    try {
      const reports = (await this.api(
        `/api/admin/reports?status=${view.tab === "reports" ? view.status : "open"}&offset=${view.tab === "reports" ? view.reportOffset : 0}`,
      )) as ReportList;
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
        body = `<form id="admin-search" class="admin-search"><input name="search" placeholder="Search name or player ID" value="${escape(view.search)}" aria-label="Search players"><button class="secondary">Search</button></form><div class="admin-list">${
          players
            .map((p) => {
              const owned = titles.filter((t) => p.titleIds.includes(t.id));
              const grantable = titles.filter(
                (t) => t.active && !p.titleIds.includes(t.id),
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
        `${header(reports.open)}${body}<p id="admin-message" role="status">${escape(view.message)}</p>`,
      );
      const say = (text: string) =>
        (element("admin-message").textContent = text);
      const fail = (error: unknown) =>
        say(error instanceof Error ? error.message : "Request failed.");
      document.querySelectorAll<HTMLButtonElement>(".admin-tab").forEach(
        (tab) =>
          (tab.onclick = () =>
            void this.showAdmin({
              tab: tab.dataset.tab as "players" | "reports",
            })),
      );
      if (view.tab === "reports") {
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
