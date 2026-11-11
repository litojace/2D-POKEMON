// The harness's Chromium draws WebGL on the CPU (SwiftShader), which the real
// gpu-check.ts rightly calls software rendering, so Graphics Auto would start
// Low in every test. Report a graphics card instead, unless a test sets
// window.__softwareGpu (before the page loads) to see a school PC's browser.
import {
  classifyRenderer,
  type GpuInfo,
} from "../../../apps/client/src/gpu-check";

export { classifyRenderer, type GpuInfo };
export function gpuInfo(): GpuInfo {
  return (window as any).__softwareGpu
    ? classifyRenderer("Google SwiftShader", true)
    : { software: false, renderer: "Harness GPU" };
}
export const softwareRendering = () => gpuInfo().software;
