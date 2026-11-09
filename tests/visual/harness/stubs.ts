// Stand-ins for the network packages, so the real client runs with no server.
// window.__sock is the socket; window.__reply(event, data) answers requests.
type Handler = (payload: unknown) => void;
const w = window as unknown as Record<string, any>;

export function io() {
  const handlers: Record<string, Handler[]> = {};
  const answer = (ev: string, data: unknown) =>
    w.__reply?.(ev, data) ?? { ok: false, error: "Offline harness" };
  const s: Record<string, any> = {
    connected: true,
    id: "local",
    auth: {},
    handlers,
    on(ev: string, fn: Handler) {
      (handlers[ev] ??= []).push(fn);
      return s;
    },
    off(ev?: string, fn?: Handler) {
      if (!ev) {
        for (const key of Object.keys(handlers)) delete handlers[key];
      } else if (!fn) delete handlers[ev];
      else handlers[ev] = (handlers[ev] ?? []).filter((h) => h !== fn);
      return s;
    },
    once(ev: string, fn: Handler) {
      const once = (payload: unknown) => {
        s.off(ev, once);
        fn(payload);
      };
      return s.on(ev, once);
    },
    emit(ev: string, data: unknown, cb?: (r: unknown) => void) {
      w.__emit?.(ev, data);
      if (typeof cb === "function") cb(answer(ev, data));
      return s;
    },
    timeout() {
      return {
        emit(ev: string, data: unknown, cb?: (e: null, r: unknown) => void) {
          w.__emit?.(ev, data);
          setTimeout(() => cb?.(null, answer(ev, data)), 0);
        },
      };
    },
    // Like Socket.IO's: true while the socket is connected or retrying. A
    // test that sets it (and connected) to false stands for a connection the
    // server refused or closed; window.__connects counts connect() calls.
    active: true,
    connect() {
      w.__connects = (w.__connects ?? 0) + 1;
      return s;
    },
    disconnect() {
      return s;
    },
    io: { on() {}, opts: {} },
    fire(ev: string, payload: unknown) {
      for (const fn of [...(handlers[ev] ?? [])]) fn(payload);
    },
  };
  s.volatile = s;
  w.__sock = s;
  return s;
}

export function registerSW() {
  return () => {};
}

/** Always signed in as the harness account. */
export function createClient() {
  const session = {
    access_token: "offline",
    refresh_token: "r",
    user: { id: "11111111-1111-4111-8111-111111111111", is_anonymous: false },
  };
  return {
    auth: {
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        w.__authChange = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      // A refresh hands out a new token, as Supabase's does (TOKEN_REFRESHED);
      // window.__refreshes counts them.
      refreshSession: async () => {
        w.__refreshes = (w.__refreshes ?? 0) + 1;
        const fresh = { ...session, access_token: `fresh-${w.__refreshes}` };
        w.__authChange?.("TOKEN_REFRESHED", fresh);
        return { data: { session: fresh }, error: null };
      },
      getSession: async () => ({ data: { session } }),
      signOut: async () => ({}),
      signInWithPassword: async () => ({
        error: { message: "Offline harness" },
      }),
    },
  };
}
