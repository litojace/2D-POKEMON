/**
 * A stand-in 2D canvas for painting code in unit tests: every call and
 * style set is recorded (numbers rounded), so a painting's recipe can be
 * compared without a browser. `installRecordingDocument` gives painting
 * code that makes its own canvases (noise, shadow layers) recorders too.
 */
export function recordingContext(log: string[]) {
  const fmt = (v: unknown): string =>
    typeof v === "number"
      ? (Math.round(v * 1e4) / 1e4).toString()
      : typeof v === "string"
        ? v
        : v && typeof v === "object" && "__id" in (v as object)
          ? `#${(v as { __id: string }).__id}`
          : Array.isArray(v)
            ? `[${v.map(fmt).join(",")}]`
            : typeof v;
  let ids = 0;
  const gradient = (kind: string, args: unknown[]) => {
    const id = `${kind}${ids++}`;
    log.push(`${id}(${args.map(fmt).join(",")})`);
    return {
      __id: id,
      addColorStop: (o: number, c: string) =>
        log.push(`${id}.stop(${fmt(o)},${c})`),
    };
  };
  const canvas = { width: 1600, height: 900 } as Record<string, unknown>;
  const target: Record<string, unknown> = { canvas };
  return new Proxy(target, {
    get(t, key: string) {
      if (key in t) return t[key];
      if (key === "createLinearGradient" || key === "createRadialGradient")
        return (...a: unknown[]) => gradient(key.slice(6, 12), a);
      if (key === "createImageData")
        return (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        });
      if (key === "measureText") return () => ({ width: 10 });
      if (key === "getLineDash") return () => [];
      return (...a: unknown[]) => {
        log.push(`${key}(${a.map(fmt).join(",")})`);
      };
    },
    set(t, key: string, v) {
      if (key !== "canvas") log.push(`${key}=${fmt(v)}`);
      t[key] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
/** Make `document.createElement("canvas")` give recording canvases (returns an undo). */
export function installRecordingDocument(log: string[]) {
  const g = globalThis as unknown as { document?: unknown };
  const before = g.document;
  let n = 0;
  g.document = {
    createElement: () => {
      const id = `canvas${n++}`;
      const c: Record<string, unknown> = { __id: id, width: 0, height: 0 };
      c.getContext = () => recordingContext(log);
      return c;
    },
  };
  return () => {
    g.document = before;
  };
}
/** A short, stable fingerprint of a log (FNV-1a). */
export function fingerprint(log: string[]) {
  let h = 0x811c9dc5;
  for (const line of log)
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  return `${log.length}:${h.toString(16)}`;
}
