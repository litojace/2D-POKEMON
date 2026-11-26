/**
 * Sound effects as data: a recipe is a few short layers (a tone or filtered
 * noise, each with its own pitch and filter sweep), rendered with Web Audio
 * in the moment. No audio files, so nothing downloads and the effects cost
 * a handful of nodes each (sfx-recipes.ts writes the recipes).
 */
export interface Sweep {
  type: BiquadFilterType;
  /** Cutoff at the start and at the end (Hz). */
  from: number;
  to: number;
  q?: number;
}
interface LayerBase {
  /** Start after the sound's start (s). */
  at?: number;
  /** Length, attack included (s). */
  length: number;
  /** Rise time (s); short attacks click on purpose, never under 2 ms. */
  attack?: number;
  /** Share of the length held at full level before the fade (0..1). */
  hold?: number;
  /** Peak level before the effects volume (a normal cast sums to about 1). */
  level: number;
  filter?: Sweep;
  /** Tremolo: the level wavers `depth` (0..1) at `rate` Hz. */
  flutter?: { rate: number; depth: number };
}
export interface ToneLayer extends LayerBase {
  tone: OscillatorType;
  /** Pitch at the start and at the end (Hz). */
  from: number;
  to: number;
  /** Vibrato: the pitch wavers by `depth` of itself at `rate` Hz. */
  wobble?: { rate: number; depth: number };
  detune?: number;
}
export interface NoiseLayer extends LayerBase {
  noise: true;
  filter: Sweep;
}
export type SfxLayer = ToneLayer | NoiseLayer;
export interface SfxRecipe {
  layers: SfxLayer[];
  /**
   * How much louder the whole sound plays (× its layers' levels), set from
   * measured loudness so short and long sounds, and every element, sit at
   * the same level on a phone's speaker (sfx-recipes.ts).
   */
  gain?: number;
}
/** The most a recipe's gain may raise it. */
export const SFX_MAX_GAIN = 4;
/** The most layers a recipe may have, and the longest it may last (s). */
export const SFX_MAX_LAYERS = 8;
export const SFX_MAX_SECONDS = 1.6;

export function isNoise(layer: SfxLayer): layer is NoiseLayer {
  return "noise" in layer;
}
/** When a recipe's last layer ends (s). */
export function sfxLength(recipe: SfxRecipe) {
  return Math.max(0, ...recipe.layers.map((l) => (l.at ?? 0) + l.length));
}

const FLOOR = 0.0001;
/**
 * Play `recipe` into `output` at time `t`. `pitch` scales every tone and
 * filter (small random changes keep repeated casts from sounding mechanical).
 * Returns when the sound ends (context time), or 0 if nothing played.
 */
export function playRecipe(
  ctx: BaseAudioContext,
  output: AudioNode,
  noise: AudioBuffer | undefined,
  recipe: SfxRecipe,
  t: number,
  options: { volume?: number; pan?: number; pitch?: number } = {},
  onEnd?: () => void,
) {
  const volume = (options.volume ?? 1) * (recipe.gain ?? 1),
    pitch = options.pitch ?? 1;
  if (volume <= 0) return 0;
  const stereo = ctx.createStereoPanner();
  stereo.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
  stereo.connect(output);
  const nodes: AudioNode[] = [stereo];
  let remaining = 0,
    end = t;
  const done = () => {
    if (--remaining > 0) return;
    nodes.forEach((n) => n.disconnect());
    onEnd?.();
  };
  for (const layer of recipe.layers) {
    if (isNoise(layer) && !noise) continue;
    const start = t + (layer.at ?? 0),
      length = Math.max(0.01, layer.length),
      stop = start + length,
      attack = Math.min(length * 0.5, Math.max(0.002, layer.attack ?? 0.004)),
      hold = Math.min(
        stop - 0.005,
        start + attack + length * (layer.hold ?? 0),
      );
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(FLOOR, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(FLOOR * 2, layer.level * volume),
      start + attack,
    );
    if (hold > start + attack)
      envelope.gain.setValueAtTime(layer.level * volume, hold);
    envelope.gain.exponentialRampToValueAtTime(FLOOR, stop);
    let head: AudioNode = envelope;
    if (layer.filter) {
      const f = ctx.createBiquadFilter();
      f.type = layer.filter.type;
      f.Q.value = layer.filter.q ?? 0.7;
      f.frequency.setValueAtTime(clampHz(layer.filter.from * pitch), start);
      f.frequency.exponentialRampToValueAtTime(
        clampHz(layer.filter.to * pitch),
        stop,
      );
      f.connect(envelope);
      head = f;
      nodes.push(f);
    }
    envelope.connect(stereo);
    nodes.push(envelope);
    let source: AudioScheduledSourceNode;
    if (isNoise(layer)) {
      const src = ctx.createBufferSource();
      src.buffer = noise!;
      src.loop = true;
      // A different stretch of the noise each time.
      const span = noise!.duration > 0.05 ? noise!.duration - 0.05 : 0;
      src.start(start, Math.random() * span);
      source = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = layer.tone;
      osc.frequency.setValueAtTime(clampHz(layer.from * pitch), start);
      if (layer.to !== layer.from)
        osc.frequency.exponentialRampToValueAtTime(
          clampHz(layer.to * pitch),
          stop,
        );
      if (layer.detune) osc.detune.value = layer.detune;
      if (layer.wobble) {
        const lfo = ctx.createOscillator(),
          depth = ctx.createGain();
        lfo.frequency.value = layer.wobble.rate;
        depth.gain.value = layer.from * pitch * layer.wobble.depth;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(start);
        lfo.stop(stop + 0.02);
        nodes.push(lfo, depth);
      }
      osc.start(start);
      source = osc;
    }
    if (layer.flutter) {
      // The tremolo rides a gain after the envelope, so the fade still ends at silence.
      const trem = ctx.createGain(),
        lfo = ctx.createOscillator(),
        depth = ctx.createGain();
      trem.gain.value = 1 - layer.flutter.depth / 2;
      lfo.frequency.value = layer.flutter.rate;
      depth.gain.value = layer.flutter.depth / 2;
      lfo.connect(depth).connect(trem.gain);
      lfo.start(start);
      lfo.stop(stop + 0.02);
      source.connect(trem).connect(head);
      nodes.push(trem, lfo, depth);
    } else source.connect(head);
    source.stop(stop + 0.02);
    nodes.push(source);
    remaining++;
    source.onended = done;
    end = Math.max(end, stop);
  }
  if (remaining === 0) {
    stereo.disconnect();
    return 0;
  }
  return end;
}
function clampHz(hz: number) {
  return Math.max(20, Math.min(18000, hz));
}
