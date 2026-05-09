/**
 * Jolly Space Cow - Physics & Geometry Utilities
 * Provides convex hull and point-in-polygon calculations for hit detection.
 */

const Physics = {
  /**
   * Calculates the cross product of three points.
   */
  crossProduct(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  },

  /**
   * Generates a convex hull from a set of points using Monotone Chain algorithm.
   */
  getConvexHull(points) {
    if (points.length <= 1) return points;
    points.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const upper = [];
    for (const p of points) {
      while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const lower = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    upper.pop(); lower.pop();
    return upper.concat(lower);
  },

  /**
   * Checks if a point is inside a polygon (Ray Casting).
   */
  isPointInPolygon(p, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > p.y) !== (polygon[j].y > p.y)) &&
        (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        isInside = !isInside;
      }
    }
    return isInside;
  },

  /**
   * Transforms a set of points based on translation, scale, and rotation.
   */
  getTransformedHull(hull, tx, ty, sx, sy, rot, ox, oy) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return hull.map(p => {
      // 1. Scale and Apply Offset relative to the anchor
      let lx = (p.x + ox) * sx;
      let ly = (p.y + oy) * sy;
      // 2. Rotate
      let rx = lx * cos - ly * sin;
      let ry = lx * sin + ly * cos;
      // 3. Translate to world space
      return { x: rx + tx, y: ry + ty };
    });
  }
};
