# Dependency audit updates

Render's `npm ci` audit output is a dependency warning, not a deployment failure.
The separate `packages are looking for funding` message is informational.

The audit before this update reported 17 affected dependency entries, including
two critical and three high entries. Compatible lockfile updates patch Express
4.22.3/body-parser 1.20.9, qs, Vite 6.4.5, fast-uri and serialize-javascript.

Vitest is updated from 3.2.7 to 4.1.12, removing the vulnerable Tinypool dependency
and patching the mocker advisories. Zod is updated from 3.25.76 to 4.6.7 to patch
oversized-collection validation. Record schemas now explicitly specify string
keys, preserving the existing report, progress and animation-pack formats under
Zod 4. These changes are validated with type checking, the complete test suite,
the production/PWA build and browser checks for login and startup.

After these updates, `npm audit --omit=dev` reports **zero vulnerabilities**.
The complete audit reports **four low entries** for the single unpatched
`deepmerge` advisory, inherited through `@rollup/plugin-node-resolve`,
`workbox-build` and `vite-plugin-pwa`. This dependency is used by the PWA build
tools, not the deployed game server. The currently published deepmerge release
4.3.1 has no patched successor. Recheck upstream when updating the PWA tools.

The audit's force-fix suggestion downgrades `vite-plugin-pwa` from 2.x to 0.2.1;
it is not a compatible security update for the current injectManifest/PWA setup.
That downgrade is deliberately not applied. Render may therefore still show the
four low development-tool warnings after deployment; high and critical entries
are resolved.
