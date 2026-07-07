import type { Color } from '../types';

// sRGB (D65) <-> CIE LAB conversion

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
}

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const EPS = 216 / 24389; // (6/29)^3
const KAPPA = 24389 / 27;

function fwd(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

function inv(t: number): number {
  const t3 = t ** 3;
  return t3 > EPS ? t3 : (116 * t - 16) / KAPPA;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl;
  const fx = fwd(x / XN);
  const fy = fwd(y / YN);
  const fz = fwd(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb(lab: [number, number, number]): [number, number, number] {
  const [l, a, b] = lab;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = inv(fx) * XN;
  const y = inv(fy) * YN;
  const z = inv(fz) * ZN;
  const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(rl), linearToSrgb(gl), linearToSrgb(bl)];
}

export function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

/** CIE76 delta E — euclidean distance in LAB space. */
export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function makeColor(id: number, lab: [number, number, number]): Color {
  const rgb = labToRgb(lab);
  return { id, lab, rgb, hex: rgbToHex(rgb) };
}

/** Deterministic PRNG so identical inputs always yield identical palettes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface QuantizeOptions {
  k: number;
  maxIterations?: number;
  sampleStride?: number;
  convergenceThreshold?: number;
  seed?: number;
}

export interface QuantizeResult {
  labelMap: Int32Array;
  palette: Color[];
}

/**
 * k-means color quantization in LAB space with k-means++ seeding.
 * Clustering runs on a pixel sample for speed; a final pass assigns every pixel.
 */
export function quantize(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: QuantizeOptions,
): QuantizeResult {
  const { k, maxIterations = 10, convergenceThreshold = 0.25, seed = 1 } = options;
  const pixelCount = width * height;
  const stride = options.sampleStride ?? (pixelCount > 250_000 ? 4 : 1);
  const rand = mulberry32(seed);

  // Collect LAB samples
  const sampleCount = Math.ceil(pixelCount / stride);
  const samples = new Float32Array(sampleCount * 3);
  for (let s = 0, p = 0; s < sampleCount; s++, p += stride) {
    const i = p * 4;
    const lab = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
    samples[s * 3] = lab[0];
    samples[s * 3 + 1] = lab[1];
    samples[s * 3 + 2] = lab[2];
  }

  const kEff = Math.max(1, Math.min(k, sampleCount));
  const centers = new Float32Array(kEff * 3);

  // k-means++ seeding
  const first = Math.floor(rand() * sampleCount);
  centers[0] = samples[first * 3];
  centers[1] = samples[first * 3 + 1];
  centers[2] = samples[first * 3 + 2];
  const minDistSq = new Float64Array(sampleCount).fill(Number.POSITIVE_INFINITY);
  for (let c = 1; c < kEff; c++) {
    const px = centers[(c - 1) * 3];
    const py = centers[(c - 1) * 3 + 1];
    const pz = centers[(c - 1) * 3 + 2];
    let total = 0;
    for (let s = 0; s < sampleCount; s++) {
      const dl = samples[s * 3] - px;
      const da = samples[s * 3 + 1] - py;
      const db = samples[s * 3 + 2] - pz;
      const d = dl * dl + da * da + db * db;
      if (d < minDistSq[s]) minDistSq[s] = d;
      total += minDistSq[s];
    }
    let idx: number;
    if (total <= 0) {
      idx = Math.floor(rand() * sampleCount);
    } else {
      let target = rand() * total;
      idx = sampleCount - 1;
      for (let s = 0; s < sampleCount; s++) {
        target -= minDistSq[s];
        if (target <= 0) {
          idx = s;
          break;
        }
      }
    }
    centers[c * 3] = samples[idx * 3];
    centers[c * 3 + 1] = samples[idx * 3 + 1];
    centers[c * 3 + 2] = samples[idx * 3 + 2];
  }

  // Lloyd iterations on samples
  const sums = new Float64Array(kEff * 3);
  const counts = new Int32Array(kEff);
  for (let iter = 0; iter < maxIterations; iter++) {
    sums.fill(0);
    counts.fill(0);
    for (let s = 0; s < sampleCount; s++) {
      const l = samples[s * 3];
      const a = samples[s * 3 + 1];
      const b = samples[s * 3 + 2];
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < kEff; c++) {
        const dl = l - centers[c * 3];
        const da = a - centers[c * 3 + 1];
        const db = b - centers[c * 3 + 2];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sums[best * 3] += l;
      sums[best * 3 + 1] += a;
      sums[best * 3 + 2] += b;
      counts[best]++;
    }
    let maxShift = 0;
    for (let c = 0; c < kEff; c++) {
      if (counts[c] === 0) {
        // Re-seed empty cluster from a random sample
        const s = Math.floor(rand() * sampleCount);
        centers[c * 3] = samples[s * 3];
        centers[c * 3 + 1] = samples[s * 3 + 1];
        centers[c * 3 + 2] = samples[s * 3 + 2];
        continue;
      }
      const nl = sums[c * 3] / counts[c];
      const na = sums[c * 3 + 1] / counts[c];
      const nb = sums[c * 3 + 2] / counts[c];
      const shift = Math.sqrt(
        (nl - centers[c * 3]) ** 2 +
          (na - centers[c * 3 + 1]) ** 2 +
          (nb - centers[c * 3 + 2]) ** 2,
      );
      if (shift > maxShift) maxShift = shift;
      centers[c * 3] = nl;
      centers[c * 3 + 1] = na;
      centers[c * 3 + 2] = nb;
    }
    if (maxShift < convergenceThreshold) break;
  }

  // Final pass: assign every pixel to its nearest center
  const labelMap = new Int32Array(pixelCount);
  const usage = new Int32Array(kEff);
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const lab = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let c = 0; c < kEff; c++) {
      const dl = lab[0] - centers[c * 3];
      const da = lab[1] - centers[c * 3 + 1];
      const db = lab[2] - centers[c * 3 + 2];
      const d = dl * dl + da * da + db * db;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    labelMap[p] = best;
    usage[best]++;
  }

  // Drop unused clusters, order palette by usage (most common color = number 1)
  const order: number[] = [];
  for (let c = 0; c < kEff; c++) if (usage[c] > 0) order.push(c);
  order.sort((a, b) => usage[b] - usage[a]);
  const remap = new Int32Array(kEff).fill(-1);
  const palette: Color[] = order.map((c, newId) => {
    remap[c] = newId;
    return makeColor(newId, [centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]]);
  });
  for (let p = 0; p < pixelCount; p++) labelMap[p] = remap[labelMap[p]];

  return { labelMap, palette };
}

/**
 * Quantize by mapping every pixel to the perceptually nearest color of a
 * fixed, user-supplied palette (e.g. the paints someone actually owns).
 * Unused colors are dropped and the rest ordered by usage, like `quantize`.
 */
export function quantizeToPalette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  paletteRgb: [number, number, number][],
): QuantizeResult {
  const pixelCount = width * height;
  const centers = paletteRgb.map(([r, g, b]) => rgbToLab(r, g, b));
  const labelMap = new Int32Array(pixelCount);
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 4;
    const lab = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let c = 0; c < centers.length; c++) {
      const dl = lab[0] - centers[c][0];
      const da = lab[1] - centers[c][1];
      const db = lab[2] - centers[c][2];
      const d = dl * dl + da * da + db * db;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    labelMap[p] = best;
  }
  // Keep the exact user colors (no re-averaging), then compact by usage
  const palette: Color[] = paletteRgb.map((rgb, id) => ({
    id,
    rgb,
    lab: centers[id],
    hex: rgbToHex(rgb),
  }));
  return { labelMap, palette: compactPalette(labelMap, palette) };
}

/**
 * Drop palette entries that no longer occur in the label map (e.g. after
 * region merging) and renumber labels by usage, most common first.
 */
export function compactPalette(labelMap: Int32Array, palette: Color[]): Color[] {
  const usage = new Int32Array(palette.length);
  for (let p = 0; p < labelMap.length; p++) usage[labelMap[p]]++;
  const order: number[] = [];
  for (let c = 0; c < palette.length; c++) if (usage[c] > 0) order.push(c);
  order.sort((a, b) => usage[b] - usage[a]);
  if (order.length === palette.length && order.every((c, i) => c === i)) {
    return palette;
  }
  const remap = new Int32Array(palette.length).fill(-1);
  const compacted = order.map((c, newId) => {
    remap[c] = newId;
    return { ...palette[c], id: newId };
  });
  for (let p = 0; p < labelMap.length; p++) labelMap[p] = remap[labelMap[p]];
  return compacted;
}
