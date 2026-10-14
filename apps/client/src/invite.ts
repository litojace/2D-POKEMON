/**
 * Invite links: `https://parena.litojace.com/?room=ABC123` opens the game and
 * joins that room as soon as the player is signed in and connected. The code
 * survives a login detour (sessionStorage) and is removed from the address
 * bar so a refresh doesn't re-join.
 */
const KEY = "arena-invite";
const CODE = /^[A-Z0-9]{4,8}$/;

export function inviteUrl(origin: string, code: string) {
  return `${origin.replace(/\/$/, "")}/?room=${encodeURIComponent(code)}`;
}

/** The room code in a query string, normalised, or undefined. */
export function readInvite(search: string) {
  const code = new URLSearchParams(search).get("room")?.trim().toUpperCase();
  return code && CODE.test(code) ? code : undefined;
}

/** Call once at startup: remember an invite from the URL and tidy the URL. */
export function captureInvite() {
  try {
    const code = readInvite(location.search);
    if (!code) return pendingInvite();
    sessionStorage.setItem(KEY, code);
    const url = new URL(location.href);
    url.searchParams.delete("room");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    return code;
  } catch {
    return undefined;
  }
}
export function pendingInvite() {
  try {
    const code = sessionStorage.getItem(KEY) ?? undefined;
    return code && CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}
export function clearInvite() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* optional */
  }
}

/**
 * Share a room: the phone's share sheet when there is one, else the
 * clipboard. Resolves to what happened so the UI can say so.
 */
export async function shareInvite(
  code: string,
  origin = location.origin,
): Promise<"shared" | "copied" | "failed"> {
  const url = inviteUrl(origin, code);
  const text = `Join my Element Arena room ${code}`;
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  const coarse =
    typeof matchMedia !== "undefined" &&
    matchMedia("(pointer: coarse)").matches;
  if (coarse && nav.share && (nav.canShare?.({ url }) ?? true)) {
    try {
      await nav.share({ title: "Element Arena", text, url });
      return "shared";
    } catch (error) {
      // The player closed the sheet: that's not a failure worth a fallback.
      if (error instanceof DOMException && error.name === "AbortError")
        return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
