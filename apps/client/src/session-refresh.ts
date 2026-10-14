/**
 * Supabase re-announces the session on every background token refresh and
 * whenever the tab regains focus (SIGNED_IN on visibilitychange, see
 * supabase/auth-js#579). For the same player with a loaded profile nothing on
 * screen changes, so the app should just keep the fresh token.
 */
export function isQuietRefresh(
  previous: { user: { id: string } } | null,
  next: { user: { id: string } } | null,
  profileLoaded: boolean,
  force = false,
) {
  return (
    !force &&
    profileLoaded &&
    !!previous &&
    !!next &&
    previous.user.id === next.user.id
  );
}
