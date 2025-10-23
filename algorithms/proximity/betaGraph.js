import { Delaunay } from "https://cdn.jsdelivr.net/npm/d3-delaunay@6.0.4/+esm";
import { quadtree } from "https://cdn.jsdelivr.net/npm/d3-quadtree@3.0.1/+esm";

export function betaSkeleton(points, beta, opts = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    return { nodes: points.map((p, i) => ({ id: i, x: p[0], y: p[1] })), edges: [] };
  }
  if (!(beta > 0)) throw new Error("beta must be > 0");

  const { candidateMode = "complete", eps = 1e-9 } = opts;

  const pts = points.map(([x, y], i) => ({ x, y, i }));
  const qt = quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(pts);

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx,
      dy = ay - by;
    return dx * dx + dy * dy;
  };

  const isLeafNode = (node) => !node.length;

  const anyPointInIntersection = (i, j, c1x, c1y, c2x, c2y, r2, eps2) => {
    const minX = Math.min(c1x, c2x) - Math.sqrt(r2);
    const maxX = Math.max(c1x, c2x) + Math.sqrt(r2);
    const minY = Math.min(c1y, c2y) - Math.sqrt(r2);
    const maxY = Math.max(c1y, c2y) + Math.sqrt(r2);

    let found = false;
    qt.visit((node, x0, y0, x1, y1) => {
      if (found) return true;
      if (x0 > maxX || x1 < minX || y0 > maxY || y1 < minY) return true;

      if (isLeafNode(node)) {
        for (let d = node.data; d != undefined; d = d.next) {
          if (d.i !== i && d.i !== j) {
            const in1 = dist2(d.x, d.y, c1x, c1y) < r2 - eps2;
            if (in1) {
              const in2 = dist2(d.x, d.y, c2x, c2y) < r2 - eps2;
              if (in2) {
                found = true;
                return true;
              }
            }
          }
        }
      }
      return false;
    });
    return found;
  };

  const anyPointInUnion = (i, j, c1x, c1y, c2x, c2y, r2, eps2) => {
    const minX = Math.min(c1x, c2x) - Math.sqrt(r2);
    const maxX = Math.max(c1x, c2x) + Math.sqrt(r2);
    const minY = Math.min(c1y, c2y) - Math.sqrt(r2);
    const maxY = Math.max(c1y, c2y) + Math.sqrt(r2);

    let found = false;
    qt.visit((node, x0, y0, x1, y1) => {
      if (found) return true;
      if (x0 > maxX || x1 < minX || y0 > maxY || y1 < minY) return true;
      if (!node.length) {
        let d = node.data;
        do {
          if (d.i !== i && d.i !== j) {
            const in1 = dist2(d.x, d.y, c1x, c1y) < r2 - eps2;
            if (in1) {
              found = true;
              return true;
            }
            const in2 = dist2(d.x, d.y, c2x, c2y) < r2 - eps2;
            if (in2) {
              found = true;
              return true;
            }
          }
          d = d.next;
        } while (d);
      }
      return false;
    });
    return found;
  };

  // Candidate edges
  const wantComplete = candidateMode === "complete" || (candidateMode === "auto" && beta < 1);

  const candidates = [];

  if (wantComplete) {
    // All unordered pairs (i<j). O(n^2); use only when necessary.
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        candidates.push([i, j]);
      }
    }
  } else {
    const delaunay = Delaunay.from(points);
    const seen = new Set();
    for (let i = 0; i < points.length; i++) {
      for (const j of delaunay.neighbors(i)) {
        if (i < j) {
          const key = i + ":" + j;
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push([i, j]);
          }
        }
      }
    }
  }

  const edges = [];
  for (const [i, j] of candidates) {
    const pi = pts[i],
      pj = pts[j];
    const dx = pj.x - pi.x,
      dy = pj.y - pi.y;
    const d2 = dx * dx + dy * dy;
    if (d2 === 0) continue; // skip duplicates
    const d = Math.sqrt(d2);
    const t = beta / 2;

    // Centers along the line pq (works for all β>0).
    const c1x = (1 - t) * pi.x + t * pj.x;
    const c1y = (1 - t) * pi.y + t * pj.y;
    const c2x = t * pi.x + (1 - t) * pj.x;
    const c2y = t * pi.y + (1 - t) * pj.y;

    // Radii per standard definition.
    const r = beta >= 1 ? t * d : d / (2 * beta);
    const r2 = r * r;
    const eps2 = eps * d * (eps * d);

    let blocked;
    if (beta >= 1) {
      blocked = anyPointInIntersection(i, j, c1x, c1y, c2x, c2y, r2, eps2);
    } else {
      blocked = anyPointInUnion(i, j, c1x, c1y, c2x, c2y, r2, eps2);
    }

    if (!blocked) {
      edges.push({ source: i, target: j });
    }
  }

  const nodes = pts.map((p) => ({ id: p.i, x: p.x, y: p.y }));
  return { nodes, edges };
}
