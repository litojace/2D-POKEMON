/**
 * Open beta (owner, 28 Nov 2026): while the game is being finished, the web
 * build marks it BETA beside the ELEMENT ARENA wordmark (the loading
 * curtain, index.html's boot screen, the title and sign-in screens) and in
 * Settings → About. The App Store build does not: Apple's Guideline 2.2
 * keeps beta, demo and trial versions off the store (they belong on
 * TestFlight), and an in-app "Beta" label gets an app rejected.
 *
 * One flag, from the build: a store build is made with its own Vite mode
 * (`npm run ios:build` runs `vite build --mode ios`, docs/ios-app.md), and
 * the mark is off in that mode. index.html's boot screen reads the same
 * mode (`<html data-build="%MODE%">`). Inside the Capacitor shell it is off
 * too, whatever the bundle says, so a web bundle copied into the app by
 * mistake still shows no BETA. docs/open-beta.md.
 */
import "./open-beta.css";

/** Vite modes that make a store build (no BETA mark in them). */
export const STORE_MODES = ["ios", "android"] as const;

/** The rule, apart from the build it runs in (tests/unit/open-beta.test.ts). */
export const openBetaFor = (mode: string, inNativeShell: boolean) =>
  !inNativeShell && !(STORE_MODES as readonly string[]).includes(mode);

/** Capacitor's own global, without loading @capacitor/core this early. */
const inNativeShell = () =>
  Boolean(
    (
      globalThis as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor?.isNativePlatform?.(),
  );

/** True in the web build; false in a store build and in the app's shell. */
export const OPEN_BETA = openBetaFor(import.meta.env.MODE, inNativeShell());

/** The small BETA sticker beside the wordmark, or nothing in a store build. */
export const betaTag = () => (OPEN_BETA ? `<i class="beta-tag">Beta</i>` : "");
