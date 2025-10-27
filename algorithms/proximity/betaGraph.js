import { quadtree } from "https://cdn.jsdelivr.net/npm/d3-quadtree@3.0.1/+esm";

export function betaSkeleton(points, beta, opts = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    return { nodes: points.map((p, i) => ({ id: i, x: p[0], y: p[1] })), edges: [] };
  }
  if (!(beta > 0)) throw new Error("beta must be > 0");

  const { eps = 1e-9 } = opts;

  const pts = points.map(([x, y], i) => ({ x, y, i }));
  const qt = quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(pts);

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  const isLeafNode = (node) => !node.length;

  // operates on centers of two points and search radius
  const anyPointInIntersection = (i, j, c1x, c1y, c2x, c2y, r2, eps2) => {
    const r = Math.sqrt(r2);
    const minX = Math.min(c1x, c2x) - r;
    const maxX = Math.max(c1x, c2x) + r;
    const minY = Math.min(c1y, c2y) - r;
    const maxY = Math.max(c1y, c2y) + r;

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

  // NOTE: Keep this bi-directional for edge highlighting
  const candidates = [];
  for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) if (i !== j) candidates.push([i, j]);

  const edges = [];
  for (const [i, j] of candidates) {
    const pi = pts[i];
    const pj = pts[j];
    const dx = pj.x - pi.x;
    const dy = pj.y - pi.y;
    const d2 = dist2(pi.x, pi.y, pj.x, pj.y);
    if (d2 === 0) continue;

    const d = Math.sqrt(d2);
    const eps2 = eps * d * (eps * d);

    let c1x;
    let c1y;
    let c2x;
    let c2y;
    let r2;

    if (beta >= 1) {
      const t = beta / 2;
      const r = t * d;
      r2 = r * r;

      c1x = (1 - t) * pi.x + t * pj.x;
      c1y = (1 - t) * pi.y + t * pj.y;
      c2x = t * pi.x + (1 - t) * pj.x;
      c2y = t * pi.y + (1 - t) * pj.y;
    } else {
      const mx = (pi.x + pj.x) / 2;
      const my = (pi.y + pj.y) / 2;
      const ux = dx / d;
      const uy = dy / d;
      const px = -uy;
      const py = ux;
      const R = d / (2 * beta);
      r2 = R * R;

      const h2 = Math.max(0, R * R - (d * d) / 4);
      const h = Math.sqrt(h2);

      c1x = mx + h * px;
      c1y = my + h * py;
      c2x = mx - h * px;
      c2y = my - h * py;
    }

    const blocked = anyPointInIntersection(i, j, c1x, c1y, c2x, c2y, r2, eps2);
    if (!blocked) edges.push({ source: i, target: j });
  }

  const nodes = pts.map((p) => ({ id: p.i, x: p.x, y: p.y }));
  return { nodes, edges };
}
