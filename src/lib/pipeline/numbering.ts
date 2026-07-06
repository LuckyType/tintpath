import type { LabelPlacement, Region } from '../types';

/** Font size in image pixels, scaled with region area and clamped. */
export function fontSizeForArea(area: number): number {
  return Math.max(8, Math.min(28, Math.round(Math.sqrt(area) * 0.35)));
}

/**
 * 3-4 chamfer distance transform to the nearest drawn line. A pixel counts as
 * a line pixel when any 4-neighbor belongs to a different region or when it
 * lies on the image edge (contours are traced along the edge too).
 * Distances are in chamfer units: divide by 3 for pixels.
 */
function distanceToBoundary(regionMap: Int32Array, width: number, height: number): Int32Array {
  const INF = 1 << 29;
  const dist = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const r = regionMap[p];
      const boundary =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        regionMap[p - 1] !== r ||
        regionMap[p + 1] !== r ||
        regionMap[p - width] !== r ||
        regionMap[p + width] !== r;
      dist[p] = boundary ? 0 : INF;
    }
  }

  // Forward pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      let d = dist[p];
      if (d === 0) continue;
      if (x > 0 && dist[p - 1] + 3 < d) d = dist[p - 1] + 3;
      if (y > 0) {
        if (dist[p - width] + 3 < d) d = dist[p - width] + 3;
        if (x > 0 && dist[p - width - 1] + 4 < d) d = dist[p - width - 1] + 4;
        if (x < width - 1 && dist[p - width + 1] + 4 < d) d = dist[p - width + 1] + 4;
      }
      dist[p] = d;
    }
  }

  // Backward pass
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      let d = dist[p];
      if (d === 0) continue;
      if (x < width - 1 && dist[p + 1] + 3 < d) d = dist[p + 1] + 3;
      if (y < height - 1) {
        if (dist[p + width] + 3 < d) d = dist[p + width] + 3;
        if (x < width - 1 && dist[p + width + 1] + 4 < d) d = dist[p + width + 1] + 4;
        if (x > 0 && dist[p + width - 1] + 4 < d) d = dist[p + width - 1] + 4;
      }
      dist[p] = d;
    }
  }

  return dist;
}

/**
 * Compute the label anchor for every region. The displayed number is the
 * palette color's 1-based index (classic paint-by-numbers: same color, same
 * number everywhere). Each anchor sits at the region's pole of inaccessibility
 * — the interior pixel farthest from any outline — and the font size is
 * capped by that clearance so digits never sit on a line.
 */
export function computePlacements(
  regionMap: Int32Array,
  width: number,
  height: number,
  regions: Region[],
): LabelPlacement[] {
  const dist = distanceToBoundary(regionMap, width, height);

  // Region ids from findRegions are dense (0..n-1), so plain arrays suffice.
  const centroidX = new Float64Array(regions.length);
  const centroidY = new Float64Array(regions.length);
  for (const r of regions) {
    centroidX[r.id] = r.centroid.x;
    centroidY[r.id] = r.centroid.y;
  }

  const bestDist = new Int32Array(regions.length).fill(-1);
  const bestPixel = new Int32Array(regions.length);
  const bestCentroidDist = new Float64Array(regions.length);
  for (let p = 0, y = 0; y < height; y++) {
    for (let x = 0; x < width; x++, p++) {
      const r = regionMap[p];
      const d = dist[p];
      if (d < bestDist[r]) continue;
      // Among equally clear pixels, prefer the one nearest the centroid so
      // numbers stay visually centered in elongated regions.
      const dc = (x - centroidX[r]) ** 2 + (y - centroidY[r]) ** 2;
      if (d > bestDist[r] || dc < bestCentroidDist[r]) {
        bestDist[r] = d;
        bestPixel[r] = p;
        bestCentroidDist[r] = dc;
      }
    }
  }

  return regions.map((r) => {
    const p = bestPixel[r.id];
    const x = p % width;
    const y = (p - x) / width;
    const clearance = bestDist[r.id] / 3; // chamfer units -> pixels
    const number = r.colorId + 1;
    const digits = String(number).length;
    // The glyph box must fit into the clearance circle: height and width caps
    const fitSize = Math.min(1.8 * clearance, (3.6 * clearance) / digits);
    const fontSize = Math.max(6, Math.min(fontSizeForArea(r.area), Math.round(fitSize)));
    return { regionId: r.id, colorId: r.colorId, number, x, y, fontSize };
  });
}
