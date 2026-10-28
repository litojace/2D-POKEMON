import { expect, test, type Page } from "@playwright/test";
import { box, inside, openTown, snap } from "./helpers";

async function exposeAccount(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        "window.__account=accountsUI;window.__request=request;" + marker,
      ),
    });
  });
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`a replaced account stays paused until explicitly reclaimed at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width < 1000,
      hasTouch: size.width < 1000,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      const errors = await openTown(page);
      await page.evaluate(() => {
        const w = window as any,
          s = w.__sock;
        w.__connects = 0;
        s.disconnect = () => {
          if (s.connected) {
            s.connected = false;
            s.id = undefined;
            s.fire("disconnect", "io client disconnect");
          }
          return s;
        };
        s.connect = () => {
          w.__connects++;
          s.id = `new-${w.__connects}`;
          s.connected = true;
          setTimeout(() => s.fire("connect"), 0);
          return s;
        };
        s.fire("session-replaced");
      });
      await expect(page.locator("#gate-auth")).toContainText(
        "Playing on another device",
      );
      await expect(page.locator("#town-menu-toggle")).toHaveCount(0);
      await page.evaluate(async () => {
        const w = window as any;
        await w.__account.setSession({
          ...w.__account.session,
          access_token: "refreshed",
        });
        await w.__account.refresh();
      });
      expect(await page.evaluate(() => (window as any).__connects)).toBe(0);
      expect(await page.locator("#toast").textContent()).not.toMatch(
        /Connection lost|Server did not respond/,
      );
      const button = await box(page, "#gate-retry");
      expect(inside(button, { x: 0, y: 0, ...size })).toBe(true);
      await snap(page, info, `account-paused-${size.width}x${size.height}`);
      // Reloading/focusing a displaced tab must not take over the other device.
      await page.reload();
      await expect(page.locator("#gate-auth")).toContainText(
        "Playing on another device",
      );
      await page.click("#gate-retry");
      await page.evaluate(() => (window as any).__sock.fire("connect"));
      await expect(page.locator("#town-menu-toggle")).toBeVisible();
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("arena-session-replaced"),
        ),
      ).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const mode of ["login", "signup"] as const) {
  test(`${mode} shares duplicate auth events and ignores acknowledgements cancelled by an auth switch`, async ({
    page,
  }) => {
    await exposeAccount(page);
    const errors = await openTown(page);
    await page.evaluate(async (mode) => {
      const w = window as any,
        account = w.__account,
        session = account.session,
        s = w.__sock;
      await account.setSession(null);
      account.showAuth(mode);
      w.__authConnects = 0;
      w.__profileLoads = 0;
      const fetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        if (String(input).includes("/api/account")) {
          w.__profileLoads++;
          await new Promise<void>((resolve) => {
            w.__releaseProfile = resolve;
          });
        }
        return fetch(input, init);
      };
      s.disconnect = () => {
        s.connected = false;
        s.id = undefined;
        s.fire("disconnect", "io client disconnect");
        w.__cancelAck?.(new Error("socket has been disconnected"));
        return s;
      };
      s.connect = () => {
        s.connected = true;
        s.id = `auth-${++w.__authConnects}`;
        setTimeout(() => s.fire("connect"), 0);
        return s;
      };
      const timeout = s.timeout;
      s.timeout = (...args: unknown[]) => ({
        emit: (event: string, data: unknown, cb: unknown) => {
          if (event === "cancelled-request") {
            w.__cancelAck = cb;
            return;
          }
          return timeout(...args).emit(event, data, cb);
        },
      });
      void w.__request("cancelled-request");
      const signIn = async () => {
        // Supabase's auth callback accompanies the resolved sign-in response.
        setTimeout(() => {
          void account.setSession(session);
        }, 0);
        if (mode === "signup")
          setTimeout(() => {
            void account.setSession(session);
          }, 0);
        return { data: { session }, error: null };
      };
      account.client.auth.signInWithPassword = signIn;
      account.client.auth.signUp = signIn;
    }, mode);
    const form = page.locator("#auth-form");
    await form.locator('[name="email"]').fill("player@example.com");
    await form.locator('[name="password"]').fill("example-password");
    if (mode === "signup") {
      await form.locator('[name="displayName"]').fill("Tester");
      await form.locator('[name="confirmPassword"]').fill("example-password");
    }
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !!(window as any).__releaseProfile);
    // Let the queued auth event run while the first profile request is pending.
    await page.waitForTimeout(100);
    await expect(page.locator("#gate-auth")).toContainText(
      "Checking your account",
    );
    await expect(page.locator("#gate-auth")).not.toContainText(
      "couldn't load your profile",
    );
    expect(await page.evaluate(() => (window as any).__profileLoads)).toBe(1);
    expect(await page.evaluate(() => (window as any).__authConnects)).toBe(1);
    await page.evaluate(() => (window as any).__releaseProfile());
    await expect(page.locator("#town-menu-toggle")).toBeVisible();
    await page.evaluate(() => {
      const s = (window as any).__sock;
      s.fire("connect_error", new Error("xhr poll error"));
      s.fire("connect");
    });
    expect(await page.locator("#toast").textContent()).not.toMatch(
      /Connection lost|Server did not respond|xhr poll error/,
    );
    expect(errors).toEqual([]);
    await page.evaluate(() => {
      (window as any).__sock.fire("connect_error", {
        message: "Your login expired. Please sign in again.",
        data: { code: "ACCOUNT_ERROR", status: 401 },
      });
    });
    await expect(page.locator("#toast")).toContainText("Your login expired");
    await expect(page.locator("#connection")).toHaveText("LOGIN REQUIRED");
  });
}

test("shows a profile error only after a failed response, then shows loading while retrying", async ({
  page,
}) => {
  await exposeAccount(page);
  const errors = await openTown(page);
  await page.evaluate(async () => {
    const w = window as any,
      account = w.__account,
      session = account.session;
    await account.setSession(null);
    const fetch = window.fetch.bind(window);
    w.__profileFails = true;
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/account")) {
        await new Promise<void>((resolve) => {
          w.__finishProfile = resolve;
        });
        if (w.__profileFails)
          return new Response(
            JSON.stringify({ error: "Profile temporarily unavailable" }),
            { status: 503 },
          );
      }
      return fetch(input, init);
    };
    void account.setSession(session);
  });
  await expect(page.locator("#gate-auth")).toContainText(
    "Checking your account",
  );
  await expect(page.locator("#gate-auth")).not.toContainText(
    "couldn't load your profile",
  );
  await page.evaluate(() => (window as any).__finishProfile());
  await expect(page.locator("#gate-auth")).toContainText(
    "couldn't load your profile",
  );
  await page.click("#gate-retry");
  await expect(page.locator("#gate-auth")).toContainText(
    "Checking your account",
  );
  await expect(page.locator("#gate-auth")).not.toContainText(
    "couldn't load your profile",
  );
  await page.evaluate(() => {
    const w = window as any;
    w.__profileFails = false;
    w.__finishProfile();
  });
  await expect(page.locator("#town-menu-toggle")).toBeVisible();
  expect(errors).toEqual([]);
});
