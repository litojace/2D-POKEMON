import { isIOSDevice } from "./render-budget";

/**
 * Is this browser drawing without a graphics card?
 *
 * School and office computers often do: an Intel graphics driver too old for
 * the browser (Chrome and Edge then turn the GPU off), "Use graphics
 * acceleration when available" switched off in Edge or Chrome, or a remote
 * or virtual desktop. Everything is then drawn by the processor: WebGL runs
 * on SwiftShader (or Windows' "Microsoft Basic Render Driver"), and every
 * blurred glass panel, glow and full-screen canvas costs CPU time. A fast
 * processor and plenty of memory do not help much, so these computers lag
 * where a cheap phone does not (owner, 11 Nov 2026: an i5-9xxx school PC
 * with 16 GB lagging in Edge).
 *
 * Graphics Auto starts Low on such a browser (graphics-quality.ts), and
 * Settings → Graphics says how to turn acceleration back on.
 */
export interface GpuInfo {
  /** Drawing on the processor (or no WebGL at all). */
  software: boolean;
  /** The WebGL renderer's name, as the browser reports it ("" if unknown). */
  renderer: string;
}

/** Renderer names of software rasterizers (Chromium, Firefox, Mesa, Windows). */
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|lavapipe|basic render|microsoft basic|software/i;

/**
 * Classify what a WebGL probe found. The renderer's name is the main sign
 * (Chromium 153 on SwiftShader reports "ANGLE (Google, Vulkan 1.3.0
 * (SwiftShader Device (Subzero) ...), SwiftShader driver)" and still grants a
 * failIfMajorPerformanceCaveat context). `caveat`: the browser refused such a
 * context but gave an ordinary one, which also means the CPU. `renderer` is
 * null when there is no WebGL at all: Phaser then falls back to its canvas
 * renderer, on the CPU too.
 */
export function classifyRenderer(
  renderer: string | null,
  caveat: boolean,
): GpuInfo {
  if (renderer === null) return { software: true, renderer: "" };
  return {
    software: caveat || SOFTWARE_RENDERER.test(renderer),
    renderer,
  };
}

function rendererName(gl: WebGLRenderingContext) {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const name = gl.getParameter(
    ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  ) as unknown;
  return typeof name === "string" ? name : "";
}

let cached: GpuInfo | undefined;
/**
 * Probe once per page: two throwaway 1×1 WebGL contexts, released at once.
 * iPhones and iPads always draw on their GPU and have few contexts to spare,
 * so they are not probed.
 */
export function gpuInfo(): GpuInfo {
  if (cached) return cached;
  cached = { software: false, renderer: "" };
  if (typeof document === "undefined" || isIOSDevice()) return cached;
  try {
    const strict = document
      .createElement("canvas")
      .getContext("webgl", { failIfMajorPerformanceCaveat: true });
    const gl = strict ?? document.createElement("canvas").getContext("webgl");
    cached = classifyRenderer(gl ? rendererName(gl) : null, !strict && !!gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* Unknown: assume a graphics card, as before. */
  }
  return cached;
}

/** This browser draws on the processor (see gpuInfo). */
export const softwareRendering = () => gpuInfo().software;
