import { quadtree } from "https://cdn.jsdelivr.net/npm/d3-quadtree@3.0.1/+esm";

const dist2 = (p1, p2) => Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

export function nnGraph(points, k = 5) {
  const pts = points.map(([x, y], i) => ({ x, y, i }));
  const nodes = pts.map((p) => ({ id: p.i, x: p.x, y: p.y }));
  const edges = [];

  const qt = quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(pts);

  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    const nbrs = knn(qt, q, k);
    nbrs.forEach((n) => {
      edges.push({ source: i, target: n.d.i });
    });
  }

  return { nodes, edges };
}

export function rknnGraph(points, k = 5, T = 1) {
  const pts = points.map(([x, y], i) => ({ x, y, i }));
  const nodes = pts.map((p) => ({ id: p.i, x: p.x, y: p.y }));
  const edges = [];

  const qt = quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(pts);

  const neighbors = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    neighbors[i] = knn(qt, q, k);
  }

  for (let i = 0; i < neighbors.length; i++) {
    const nbrs = neighbors[i];

    // Go through neighbors list and compare ranks
    for (let r1 = 0; r1 < nbrs.length; r1++) {
      const n = nbrs[r1].d.i;
      const revNbrs = neighbors[n];
      const r2 = revNbrs.findIndex((el) => el.d.i === i);
      if (r2 >= 0 && Math.abs(r2 - r1) <= T) edges.push({ source: i, target: n });
    }
  }

  return { nodes, edges };
}

const isLeafNode = (node) => !node.length;
const rectDist2 = (x, y, x0, y0, x1, y1) => {
  // Distance 0 means that point is inside the box
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return dx * dx + dy * dy;
};

// sorted list of neighbors
const knn = (qt, pt, k) => {
  if (k <= 0) return [];

  const neighbors = [];
  let maxDist = Infinity;

  qt.visit((node, x0, y0, x1, y1) => {
    if (neighbors.length === k && rectDist2(pt.x, pt.y, x0, y0, x1, y1) > maxDist) return true;

    if (isLeafNode(node)) {
      for (let d = node.data; d != undefined; d = d.next) {
        if (d.x === pt.x && d.y === pt.y) continue;

        const d2 = dist2(d, pt);
        const pos = neighbors.findIndex((e) => d2 < e.d2);
        neighbors.splice(pos >= 0 ? pos : neighbors.length, 0, { d, d2 });
        if (neighbors.length > k) neighbors.pop();
        if (neighbors.length === k) maxDist = neighbors[neighbors.length - 1].d2;
      }
    }
    return false;
  });

  return neighbors;
};
