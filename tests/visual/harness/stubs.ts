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
    off() {
      return s;
    },
    once(ev: string, fn: Handler) {
      return s.on(ev, fn);
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
    connect() {
      return s;
    },
    disconnect() {
      return s;
    },
    io: { on() {}, opts: {} },
    fire(ev: string, payload: unknown) {
      for (const fn of handlers[ev] ?? []) fn(payload);
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
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session } }),
      signOut: async () => ({}),
      signInWithPassword: async () => ({ error: { message: "Offline harness" } }),
    },
  };
}
