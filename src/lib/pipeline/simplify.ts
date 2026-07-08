export interface Point {
  x: number;
  y: number;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  // Distance from p to the infinite line through a-b
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
}

/**
 * Douglas-Peucker path simplification (iterative, no recursion depth limit).
 * Endpoints are always kept.
 */
export function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2 || epsilon <= 0) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [s, e] = range;
    let maxDist = 0;
    let index = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistance(points[i], points[s], points[e]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = 1;
      stack.push([s, index], [index, e]);
    }
  }

  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/**
 * Simplify a closed contour (first point NOT repeated at the end).
 * The ring is closed virtually so the seam cannot be over-simplified away.
 */
export function simplifyClosed(points: Point[], epsilon: number): Point[] {
  if (points.length <= 3 || epsilon <= 0) return points.slice();
  const ring = [...points, points[0]];
  const simplified = simplifyPath(ring, epsilon);
  simplified.pop();
  return simplified;
}

/**
 * Simplify a run in a canonical orientation so that two regions simplifying
 * the same shared boundary run (traversed in opposite directions) end up with
 * exactly the same vertices — otherwise hairline gaps appear between fills.
 */
function simplifyCanonical(run: Point[], epsilon: number): Point[] {
  const a = run[0];
  const b = run[run.length - 1];
  let forward = a.y < b.y || (a.y === b.y && a.x <= b.x);
  if (a.x === b.x && a.y === b.y && run.length > 2) {
    // Closed run between the same junction: orient by the second point
    const p = run[1];
    const q = run[run.length - 2];
    forward = p.y < q.y || (p.y === q.y && p.x <= q.x);
  }
  if (forward) return simplifyPath(run, epsilon);
  return simplifyPath([...run].reverse(), epsilon).reverse();
}

/**
 * Simplify a closed region contour whose vertices include all junction
 * corners (see computeJunctions). The contour is split at junctions and each
 * run is simplified canonically, guaranteeing adjacent regions keep
 * coincident boundaries. Contours without junctions fall back to
 * simplifyClosed (isolated islands — nothing shares their boundary geometry
 * in a conflicting way).
 */
export function simplifyContour(
  points: Point[],
  epsilon: number,
  isJunction: (p: Point) => boolean,
): Point[] {
  if (points.length <= 3 || epsilon <= 0) return points.slice();

  const junctionIndices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (isJunction(points[i])) junctionIndices.push(i);
  }
  if (junctionIndices.length === 0) return simplifyClosed(points, epsilon);

  // Rotate so the contour starts at the first junction, then split into runs
  const n = points.length;
  const start = junctionIndices[0];
  const rotated = new Array<Point>(n);
  for (let i = 0; i < n; i++) rotated[i] = points[(start + i) % n];
  const cuts = junctionIndices.map((i) => (i - start + n) % n).sort((a, b) => a - b);
  cuts.push(n); // wrap back to the starting junction

  const out: Point[] = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const from = cuts[k];
    const to = cuts[k + 1];
    const run = to === n ? [...rotated.slice(from), rotated[0]] : rotated.slice(from, to + 1);
    const simplified = run.length <= 2 ? run : simplifyCanonical(run, epsilon);
    // Skip the run's last point — it starts the next run
    for (let i = 0; i < simplified.length - 1; i++) out.push(simplified[i]);
  }
  return out;
}
