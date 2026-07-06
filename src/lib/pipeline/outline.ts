import type { Color, OutlinePath, Region } from '../types';
import { deltaE } from './quantize';

export interface RegionsResult {
  regionMap: Int32Array;
  regions: Region[];
}

/**
 * Connected-components analysis (4-connectivity) over the label map.
 * Each region's seed is its raster-first pixel, i.e. the leftmost pixel of
 * its topmost row — which is exactly the start pixel Moore tracing needs.
 */
export function findRegions(labelMap: Int32Array, width: number, height: number): RegionsResult {
  const n = width * height;
  const regionMap = new Int32Array(n).fill(-1);
  const regions: Region[] = [];
  const stack = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (regionMap[start] !== -1) continue;
    const colorId = labelMap[start];
    const id = regions.length;
    let top = 0;
    stack[top++] = start;
    regionMap[start] = id;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (top > 0) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && regionMap[p - 1] === -1 && labelMap[p - 1] === colorId) {
        regionMap[p - 1] = id;
        stack[top++] = p - 1;
      }
      if (x < width - 1 && regionMap[p + 1] === -1 && labelMap[p + 1] === colorId) {
        regionMap[p + 1] = id;
        stack[top++] = p + 1;
      }
      if (y > 0 && regionMap[p - width] === -1 && labelMap[p - width] === colorId) {
        regionMap[p - width] = id;
        stack[top++] = p - width;
      }
      if (y < height - 1 && regionMap[p + width] === -1 && labelMap[p + width] === colorId) {
        regionMap[p + width] = id;
        stack[top++] = p + width;
      }
    }

    const startX = start % width;
    regions.push({
      id,
      colorId,
      area,
      centroid: { x: sumX / area, y: sumY / area },
      bbox: { minX, minY, maxX, maxY },
      seed: { x: startX, y: (start - startX) / width },
    });
  }

  return { regionMap, regions };
}

/**
 * Merge regions smaller than `minRegionSize` into the adjacent region whose
 * palette color is most similar (CIE76). Runs in passes because a merge can
 * create new sub-threshold regions; passes are capped for safety.
 */
export function mergeSmallRegions(
  labelMap: Int32Array,
  width: number,
  height: number,
  palette: Color[],
  minRegionSize: number,
  maxPasses = 8,
): Int32Array {
  if (minRegionSize <= 1) return labelMap;
  let current = labelMap;

  for (let pass = 0; pass < maxPasses; pass++) {
    const { regionMap, regions } = findRegions(current, width, height);
    if (regions.length <= 1) break;

    const isSmall = new Uint8Array(regions.length);
    let smallCount = 0;
    for (const r of regions) {
      if (r.area < minRegionSize) {
        isSmall[r.id] = 1;
        smallCount++;
      }
    }
    if (smallCount === 0 || smallCount === regions.length) break;

    const bestColor = new Int32Array(regions.length).fill(-1);
    const bestDist = new Float64Array(regions.length).fill(Number.POSITIVE_INFINITY);
    const evaluate = (small: number, neighborColor: number) => {
      const ownColor = regions[small].colorId;
      const d = deltaE(palette[ownColor].lab, palette[neighborColor].lab);
      if (d < bestDist[small]) {
        bestDist[small] = d;
        bestColor[small] = neighborColor;
      }
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const rp = regionMap[p];
        if (x < width - 1) {
          const rq = regionMap[p + 1];
          if (rp !== rq) {
            if (isSmall[rp]) evaluate(rp, regions[rq].colorId);
            if (isSmall[rq]) evaluate(rq, regions[rp].colorId);
          }
        }
        if (y < height - 1) {
          const rq = regionMap[p + width];
          if (rp !== rq) {
            if (isSmall[rp]) evaluate(rp, regions[rq].colorId);
            if (isSmall[rq]) evaluate(rq, regions[rp].colorId);
          }
        }
      }
    }

    let changed = false;
    const next = new Int32Array(current.length);
    for (let p = 0; p < current.length; p++) {
      const r = regionMap[p];
      if (isSmall[r] && bestColor[r] !== -1) {
        next[p] = bestColor[r];
        if (bestColor[r] !== current[p]) changed = true;
      } else {
        next[p] = current[p];
      }
    }
    current = next;
    if (!changed) break;
  }

  return current;
}

/**
 * 3x3 majority filter over the label map. Practical equivalent of a
 * morphological opening for multi-label images: single-pixel artifacts are
 * absorbed by their dominant neighbor label. Ties keep the original label.
 */
export function reduceNoiseFilter(labelMap: Int32Array, width: number, height: number): Int32Array {
  const out = new Int32Array(labelMap.length);
  const labels = new Int32Array(9);
  const votes = new Int32Array(9);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const own = labelMap[p];
      let distinct = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const label = labelMap[ny * width + nx];
          let found = false;
          for (let i = 0; i < distinct; i++) {
            if (labels[i] === label) {
              votes[i]++;
              found = true;
              break;
            }
          }
          if (!found) {
            labels[distinct] = label;
            votes[distinct] = 1;
            distinct++;
          }
        }
      }
      let winner = own;
      let winnerVotes = 0;
      let ownVotes = 0;
      for (let i = 0; i < distinct; i++) {
        if (labels[i] === own) ownVotes = votes[i];
        if (votes[i] > winnerVotes) {
          winnerVotes = votes[i];
          winner = labels[i];
        }
      }
      out[p] = winnerVotes > ownVotes ? winner : own;
    }
  }
  return out;
}

// Moore neighborhood, clockwise in screen coordinates (y grows downward):
// E, SE, S, SW, W, NW, N, NE
const DIR_X = [1, 1, 0, -1, -1, -1, 0, 1];
const DIR_Y = [0, 1, 1, 1, 0, -1, -1, -1];

function dirFromDelta(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) {
    if (DIR_X[d] === dx && DIR_Y[d] === dy) return d;
  }
  return 4;
}

/**
 * Moore-neighbor contour tracing of one region's outer boundary.
 * `startX/startY` must be the region's raster-first pixel (see findRegions),
 * which guarantees the west neighbor lies outside the region.
 */
export function traceContour(
  regionMap: Int32Array,
  width: number,
  height: number,
  regionId: number,
  startX: number,
  startY: number,
  maxSteps: number,
): { x: number; y: number }[] {
  const inRegion = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && regionMap[y * width + x] === regionId;

  const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;
  let searchStart = 4; // backtrack starts at the west neighbor
  let secondX = -1;
  let secondY = -1;

  for (let step = 0; step < maxSteps; step++) {
    let foundDir = -1;
    for (let i = 1; i <= 8; i++) {
      const dir = (searchStart + i) % 8;
      if (inRegion(cx + DIR_X[dir], cy + DIR_Y[dir])) {
        foundDir = dir;
        break;
      }
    }
    if (foundDir === -1) break; // isolated single pixel

    const nx = cx + DIR_X[foundDir];
    const ny = cy + DIR_Y[foundDir];
    // Stop when the walk would repeat its very first move (start -> second).
    if (cx === startX && cy === startY && points.length > 1 && nx === secondX && ny === secondY) {
      break;
    }
    if (points.length === 1) {
      secondX = nx;
      secondY = ny;
    }
    // Neighbor examined just before the hit becomes the new backtrack.
    const backDir = (foundDir + 7) % 8;
    const bx = cx + DIR_X[backDir];
    const by = cy + DIR_Y[backDir];
    cx = nx;
    cy = ny;
    points.push({ x: cx, y: cy });
    searchStart = dirFromDelta(bx - cx, by - cy);
  }

  // Drop a trailing revisit of the start pixel — the path is implicitly closed.
  if (points.length > 1) {
    const last = points[points.length - 1];
    if (last.x === startX && last.y === startY) points.pop();
  }
  return points;
}

/** Trace the outer contour of every region. Points are raw (unsimplified). */
export function extractOutlines(
  regionMap: Int32Array,
  width: number,
  height: number,
  regions: Region[],
): OutlinePath[] {
  return regions.map((r) => ({
    regionId: r.id,
    points: traceContour(regionMap, width, height, r.id, r.seed.x, r.seed.y, 4 * r.area + 16),
  }));
}
