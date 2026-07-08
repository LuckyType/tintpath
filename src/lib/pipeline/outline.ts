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

// Edge-walk directions on the pixel-corner lattice: E, S, W, N (y grows down)
const EDGE_DX = [1, 0, -1, 0];
const EDGE_DY = [0, 1, 0, -1];

/**
 * Mark lattice corners where more than two boundary edges meet (three or four
 * regions touching, or a region boundary hitting the image border). Contours
 * must keep these corners as vertices so that shared boundary runs can be
 * simplified identically for both adjacent regions.
 * Grid is (width+1) x (height+1), indexed y * (width + 1) + x.
 */
export function computeJunctions(regionMap: Int32Array, width: number, height: number): Uint8Array {
  const gw = width + 1;
  const junctions = new Uint8Array(gw * (height + 1));
  const label = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : regionMap[y * width + x];

  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      const nw = label(x - 1, y - 1);
      const ne = label(x, y - 1);
      const sw = label(x - 1, y);
      const se = label(x, y);
      let edges = 0;
      if (nw !== ne) edges++;
      if (sw !== se) edges++;
      if (nw !== sw) edges++;
      if (ne !== se) edges++;
      if (edges > 2) junctions[y * gw + x] = 1;
    }
  }
  return junctions;
}

/**
 * Contour tracing along the pixel-EDGE lattice (crack following, clockwise,
 * region kept on the right). Returned points are lattice corners in
 * 0..width / 0..height, so two adjacent regions produce exactly coincident
 * boundary polylines — outlines render as a single line and region fills meet
 * without unpainted 1px cracks (which pixel-center tracing suffered from).
 *
 * `startX/startY` must be the region's raster-first pixel (see findRegions),
 * which guarantees the pixels above and to the left lie outside the region;
 * the walk starts at that pixel's top-left corner heading east.
 */
export function traceContour(
  regionMap: Int32Array,
  width: number,
  height: number,
  regionId: number,
  startX: number,
  startY: number,
  maxSteps: number,
  junctions?: Uint8Array,
): { x: number; y: number }[] {
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && regionMap[y * width + x] === regionId;

  // Next direction at corner (cx, cy) arriving with direction `dir`:
  // ahead-right pixel outside -> turn right; ahead-left inside -> turn left.
  const turnAt = (cx: number, cy: number, dir: number): number => {
    let rightInside: boolean;
    let leftInside: boolean;
    switch (dir) {
      case 0: // E
        rightInside = inside(cx, cy);
        leftInside = inside(cx, cy - 1);
        break;
      case 1: // S
        rightInside = inside(cx - 1, cy);
        leftInside = inside(cx, cy);
        break;
      case 2: // W
        rightInside = inside(cx - 1, cy - 1);
        leftInside = inside(cx - 1, cy);
        break;
      default: // N
        rightInside = inside(cx, cy - 1);
        leftInside = inside(cx - 1, cy - 1);
    }
    if (!rightInside) return (dir + 1) % 4;
    if (leftInside) return (dir + 3) % 4;
    return dir;
  };

  const gridWidth = width + 1;
  const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;
  let dir = 0; // east along the seed pixel's top edge

  for (let step = 0; step < maxSteps; step++) {
    cx += EDGE_DX[dir];
    cy += EDGE_DY[dir];
    const next = turnAt(cx, cy, dir);
    if (cx === startX && cy === startY && next === 0) {
      break; // back at the initial corner about to retrace the first edge
    }
    // Direction changes become vertices; junction corners are kept even on
    // straight runs so shared boundary runs stay splittable.
    if (next !== dir || junctions?.[cy * gridWidth + cx] === 1) {
      points.push({ x: cx, y: cy });
      dir = next;
    }
  }

  return points;
}

/** Trace the outer contour of every region. Points are raw (unsimplified). */
export function extractOutlines(
  regionMap: Int32Array,
  width: number,
  height: number,
  regions: Region[],
  junctions?: Uint8Array,
): OutlinePath[] {
  return regions.map((r) => ({
    regionId: r.id,
    points: traceContour(
      regionMap,
      width,
      height,
      r.id,
      r.seed.x,
      r.seed.y,
      4 * r.area + 16,
      junctions,
    ),
  }));
}
