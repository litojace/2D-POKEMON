/**
 * Which build of the game this is: the commit it was built from, which the
 * build writes on the page as `<meta name="arena-build">`
 * (apps/client/vite.config.ts; Render sets RENDER_GIT_COMMIT). Undefined
 * while developing and in tests.
 *
 * It is read from the page, not compiled into the scripts, so a deploy that
 * changes nothing the game runs leaves every script's name as it was and
 * phones keep the copies they have.
 */
export function buildId(
  page: Pick<Document, "querySelector"> | undefined = globalThis.document,
): string | undefined {
  const id = page
    ?.querySelector('meta[name="arena-build"]')
    ?.getAttribute("content");
  return id && /^[a-z0-9-]{1,16}$/.test(id) ? id : undefined;
}
