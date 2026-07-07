import type { PipelineParams, PipelineResult } from '../types';
import { computePlacements } from './numbering';
import { extractOutlines, findRegions, mergeSmallRegions, reduceNoiseFilter } from './outline';
import { compactPalette, hexToRgb, quantize, quantizeToPalette } from './quantize';
import { simplifyClosed } from './simplify';

/** Douglas-Peucker tolerance scaled with image size (1-3 px). */
export function epsilonForSize(width: number, height: number): number {
  return Math.max(1, Math.min(3, Math.max(width, height) / 1000));
}

/**
 * The full processing pipeline: quantize -> denoise -> merge small regions ->
 * connected components -> contour trace -> simplify -> number placement.
 * Pure and synchronous so it runs identically in a Web Worker, on the main
 * thread and in unit tests.
 */
export function runPipelineSync(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: PipelineParams,
): PipelineResult {
  // A fixed user palette (>= 2 valid colors) bypasses k-means entirely
  const fixedRgb = (params.fixedPalette ?? [])
    .map(hexToRgb)
    .filter((rgb): rgb is [number, number, number] => rgb !== null);
  const quantized =
    fixedRgb.length >= 2
      ? quantizeToPalette(pixels, width, height, fixedRgb)
      : quantize(pixels, width, height, {
          k: params.detailLevel,
          seed: params.seed ?? 1,
        });

  let labelMap = quantized.labelMap;
  if (params.reduceNoise) {
    labelMap = reduceNoiseFilter(labelMap, width, height);
  }
  labelMap = mergeSmallRegions(labelMap, width, height, quantized.palette, params.minRegionSize);
  const palette = compactPalette(labelMap, quantized.palette);

  const { regionMap, regions } = findRegions(labelMap, width, height);
  // Largest regions first: painting order for filled exports and stable numbering
  regions.sort((a, b) => b.area - a.area);

  // Smoothing preference scales the Douglas-Peucker tolerance
  const smoothingFactor = params.smoothing === 'low' ? 0.5 : params.smoothing === 'high' ? 2 : 1;
  const epsilon = epsilonForSize(width, height) * smoothingFactor;
  const outlines = extractOutlines(regionMap, width, height, regions).map((o) => ({
    regionId: o.regionId,
    points: simplifyClosed(o.points, epsilon),
  }));
  const placements = computePlacements(regionMap, width, height, regions);

  return { labelMap, palette, regions, outlines, placements, width, height };
}
