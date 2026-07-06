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
